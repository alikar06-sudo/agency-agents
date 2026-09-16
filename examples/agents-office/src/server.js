// HTTP-сервер: REST + поток событий (SSE) + отдача панели.
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.js';
import { loadAgents, loadKnowledge, composeContext } from './registry.js';
import { Catalog } from './catalog.js';
import { Orchestrator } from './orchestrator.js';
import { Orders } from './orders.js';
import { Scheduler, loadSchedule } from './schedule.js';
import { sendMessage, hasTelegram, whoAmI } from './telegram.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const PUBLIC_DIR = join(ROOT, 'public');
const PORT = Number(process.env.PORT || process.env.AO_PORT || 8787);
const HOST = process.env.AO_HOST || '127.0.0.1';
const TOKEN = process.env.AO_TOKEN || '';
// Кому разрешено встраивать панель в iframe. Пусто — никому: встраивание
// открывает панель чужой странице, поэтому это осознанное разрешение.
const EMBED_ORIGIN = (process.env.AO_EMBED_ORIGIN || '').trim();

/* Отпечаток собранной панели: по нему видно, какую версию реально отдаёт
   сервер и какую показывает браузер. Без него «я обновил, а не поменялось»
   невозможно проверить — остаётся только гадать. */
const BUILD = (() => {
  try {
    const parts = readdirSync(PUBLIC_DIR).sort().map((f) => {
      const st = statSync(join(PUBLIC_DIR, f));
      return `${f}:${st.size}:${Math.round(st.mtimeMs)}`;
    });
    return createHash('sha1').update(parts.join('|')).digest('hex').slice(0, 8);
  } catch {
    return 'unknown';
  }
})();
const STARTED_AT = new Date().toISOString();

/* Живой каталог. Пока он не задан, агенты работают по снимку из «знания» —
   значит правка цены в админке до них не доходит, пока снимок не пересобрали
   руками. С этим адресом каталог перечитывается сам. */
const CATALOG_URL = (process.env.AO_CATALOG_URL || '').trim();
const CATALOG_TOKEN = (process.env.AO_CATALOG_TOKEN || '').trim();
const CATALOG_REFRESH = Math.max(20, Number(process.env.AO_CATALOG_REFRESH_SEC || 120)) * 1000;

/* Заказы — тоже только на чтение. Без адреса агенты честно говорят, что
   заказов не видят, вместо того чтобы их выдумывать. */
const ORDERS_URL = (process.env.AO_ORDERS_URL || '').trim();
const ORDERS_TOKEN = (process.env.AO_ORDERS_TOKEN || '').trim();
const ORDERS_REFRESH = Math.max(20, Number(process.env.AO_ORDERS_REFRESH_SEC || 60)) * 1000;

const store = new Store();
const agents = loadAgents(ROOT);
if (!agents.length) {
  console.error('Не найден ни один агент. Проверь пути в src/registry.js');
  process.exit(1);
}
let knowledge = loadKnowledge(ROOT);
let catalog = Catalog.fromFile(knowledge.dir);
let orders = new Orders();
const schedule = loadSchedule(knowledge.dir);
const orchestrator = new Orchestrator({
  store, agents,
  getContext: (agent) => composeContext(knowledge, agent, catalog),
  getCatalog: () => catalog,
  getOrders: () => orders,
});

/* Тянем каталог из магазина. Неудача не должна обнулять ассортимент: если
   магазин не ответил, продолжаем работать по последней удачной копии. */
let catalogPrint = catalog.fingerprint();
async function pullCatalog(reason) {
  if (!CATALOG_URL) return false;
  try {
    const fresh = await Catalog.fromUrl(CATALOG_URL, CATALOG_TOKEN);
    const print = fresh.fingerprint();
    const first = catalog.source !== fresh.source;
    catalog = fresh;
    if (print === catalogPrint && !first) return false;
    catalogPrint = print;
    const st = fresh.stats();
    store.log('catalog.updated', {
      message: `Каталог из магазина: ${fresh.size} позиций, ${st.inStock} в наличии (${reason})`,
    });
    return true;
  } catch (err) {
    store.log('catalog.failed', {
      message: `Каталог из магазина не прочитан: ${err.message}. Работаю по последней копии (${catalog.size} позиций).`,
    });
    return false;
  }
}

let ordersPrint = '';
async function pullOrders(reason) {
  if (!ORDERS_URL) return false;
  try {
    const fresh = await Orders.fromUrl(ORDERS_URL, ORDERS_TOKEN);
    const print = fresh.fingerprint();
    orders = fresh;
    if (print === ordersPrint) return false;
    ordersPrint = print;
    store.log('orders.updated', {
      message: `Заказы из магазина: ${fresh.size} шт (${reason})`,
    });
    return true;
  } catch (err) {
    store.log('orders.failed', {
      message: `Заказы из магазина не прочитаны: ${err.message}. Работаю по последней копии (${orders.size} шт).`,
    });
    return false;
  }
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function json(res, code, body) {
  const payload = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) { reject(new Error('Тело запроса слишком большое')); req.destroy(); }
    });
    req.on('end', () => {
      if (!raw) return resolveBody({});
      try { resolveBody(JSON.parse(raw)); } catch { reject(new Error('Ожидался JSON')); }
    });
    req.on('error', reject);
  });
}

function authorized(req, url) {
  if (!TOKEN) return true;
  const header = req.headers.authorization || '';
  return header === `Bearer ${TOKEN}` || url.searchParams.get('token') === TOKEN;
}

function serveStatic(res, pathname, ifNoneMatch) {
  const file = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const full = join(PUBLIC_DIR, file);
  if (!full.startsWith(PUBLIC_DIR) || !existsSync(full)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Не найдено');
  }
  /* Валидаторы обязательны. Без Cache-Control и ETag браузер кэширует файл
     «на своё усмотрение» и после выкладки новой версии продолжает показывать
     старую панель — особенно внутри iframe, который держат открытым часами.
     no-cache не запрещает кэш, а требует каждый раз спросить сервер: ответ
     304 без тела стоит копейки, зато обновление доходит сразу. */
  const st = statSync(full);
  const etag = `W/"${st.size.toString(16)}-${Math.round(st.mtimeMs).toString(16)}"`;
  const headers = {
    'content-type': MIME[extname(full)] || 'application/octet-stream',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
    'cache-control': 'no-cache',
    etag,
    'last-modified': st.mtime.toUTCString(),
  };
  if (extname(full) === '.html') {
    headers['content-security-policy'] =
      `frame-ancestors ${EMBED_ORIGIN ? `'self' ${EMBED_ORIGIN}` : "'none'"}`;
  }
  if (ifNoneMatch === etag) {
    res.writeHead(304, headers);
    return res.end();
  }
  res.writeHead(200, headers);
  res.end(readFileSync(full));
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (!authorized(req, url)) return json(res, 401, { error: 'Нужен токен доступа' });

  try {
    if (pathname === '/api/state' && req.method === 'GET') {
      const snapshot = orchestrator.snapshot();
      snapshot.runtime.build = BUILD;
      snapshot.runtime.telegram = hasTelegram();
      snapshot.runtime.schedule = schedule.length;
      return json(res, 200, snapshot);
    }

    if (pathname === '/api/stream' && req.method === 'GET') {
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-cache, no-transform',
        connection: 'keep-alive',
        'x-accel-buffering': 'no',
      });
      res.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);
      const unsubscribe = store.subscribe((event) => {
        res.write(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
      });
      const ping = setInterval(() => res.write(': ping\n\n'), 25000);
      req.on('close', () => { clearInterval(ping); unsubscribe(); });
      return;
    }

    if (pathname === '/api/tasks' && req.method === 'POST') {
      const body = await readBody(req);
      if (!body.title?.trim()) return json(res, 400, { error: 'Нужен заголовок задачи' });
      const task = orchestrator.submit({
        title: body.title.trim(),
        input: (body.input || '').trim(),
        agentId: body.agentId || null,
      });
      return json(res, 201, task);
    }

    const action = pathname.match(/^\/api\/tasks\/([\w-]+)\/(approve|reject|retry)$/);
    if (action && req.method === 'POST') {
      const [, id, verb] = action;
      const body = verb === 'reject' ? await readBody(req) : {};
      const task =
        verb === 'approve' ? orchestrator.approve(id)
        : verb === 'reject' ? orchestrator.reject(id, body.reason || '')
        : orchestrator.retry(id);
      return json(res, 200, task);
    }

    const agentMatch = pathname.match(/^\/api\/agents\/([\w-]+)$/);
    if (agentMatch && req.method === 'GET') {
      const agent = orchestrator.agentById(agentMatch[1]);
      if (!agent) return json(res, 404, { error: 'Агент не найден' });
      return json(res, 200, agent);
    }

    if (pathname === '/api/brain' && req.method === 'GET') {
      return json(res, 200, {
        present: knowledge.present,
        dir: knowledge.dir,
        files: knowledge.files,
        catalog: catalog.stats(),
        text: knowledge.present
          ? [knowledge.digest, knowledge.business].filter(Boolean).join('\n\n---\n\n')
          : knowledge.brain,
      });
    }

    // Перечитать пакет знаний после `python3 знания/обновить.py`
    if (pathname === '/api/brain/reload' && req.method === 'POST') {
      knowledge = loadKnowledge(ROOT);
      catalog = Catalog.fromFile(knowledge.dir);
      if (CATALOG_URL) await pullCatalog('кнопка «перечитать знания»');
      if (ORDERS_URL) await pullOrders('кнопка «перечитать знания»');
      store.log('brain.updated', {
        message: `Пакет знаний перечитан: ${knowledge.files.length} файлов`,
      });
      return json(res, 200, { ok: true, files: knowledge.files, catalog: catalog.stats() });
    }

    /* Отправка покупателю. Делается только по явному нажатию владельца:
       автоотправка от имени магазина — слишком дорогая ошибка, чтобы доверить
       её циклу без человека. Управляющий проверяет, владелец подтверждает. */
    if (pathname === '/api/send' && req.method === 'POST') {
      if (!hasTelegram()) return json(res, 400, { error: 'AO_TELEGRAM_TOKEN не задан' });
      const body = await readBody(req);
      const task = body.taskId ? store.tasks.get(body.taskId) : null;
      const text = (body.text ?? task?.output ?? '').trim();
      if (!text) return json(res, 400, { error: 'Нечего отправлять: текст пуст' });
      if (task && task.review?.verdict === 'rework') {
        return json(res, 400, { error: 'Управляющий вернул работу на доработку — сначала исправьте' });
      }
      try {
        const sent = await sendMessage({ chatId: body.chatId, text });
        if (task) {
          store.updateTask(task.id, {
            sent: { at: new Date().toISOString(), chatId: sent.chatId, parts: sent.parts },
          }, { event: 'task.sent', message: `Отправлено покупателю: ${task.title}` });
        } else {
          store.log('task.sent', { message: `Отправлено покупателю (${sent.parts} сообщ.)` });
        }
        return json(res, 200, { ok: true, ...sent });
      } catch (err) {
        store.log('send.failed', { message: `Не отправилось: ${err.message}` });
        return json(res, 400, { error: err.message });
      }
    }

    // Чем именно сейчас отвечает сервер — для проверки после выкладки
    if (pathname === '/api/version' && req.method === 'GET') {
      return json(res, 200, {
        build: BUILD, startedAt: STARTED_AT, agents: agents.length,
        catalogSource: catalog.source, catalogReadAt: catalog.at, catalog: catalog.stats(),
        ordersSource: orders.source, orders: orders.stats(),
        telegram: hasTelegram(), schedule: schedule.length,
      });
    }

    if (pathname.startsWith('/api/')) return json(res, 404, { error: 'Неизвестный маршрут' });

    return serveStatic(res, pathname, req.headers['if-none-match']);
  } catch (err) {
    console.error('[server]', err);
    return json(res, 400, { error: err.message });
  }
});

server.listen(PORT, HOST, () => {
  const mode = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
    ? 'боевой режим (модель подключена)'
    : 'ДЕМО-режим (ANTHROPIC_API_KEY не задан)';
  console.log(`Agents Office — ${mode}`);
  console.log(`Агентов загружено: ${agents.length}`);
  console.log(knowledge.present
    ? `Знания: ${knowledge.files.length} файлов · каталог ${catalog.size} позиций (${catalog.stats().inStock} в наличии)`
    : 'Знания: папка «знания» не найдена, работаю по BRAIN.md');
  console.log(`Сборка панели: ${BUILD}`);
  console.log(`Расписание: ${schedule.length ? `${schedule.length} задач` : 'пусто (знания/расписание.json)'}`);
  console.log(ORDERS_URL ? `Заказы: ${ORDERS_URL.replace(/\?.*$/, '')}` : 'Заказы: не подключены (AO_ORDERS_URL)');
  console.log(CATALOG_URL
    ? `Каталог: живой, ${CATALOG_URL.replace(/\?.*$/, '')}, обновление раз в ${CATALOG_REFRESH / 1000} с`
    : 'Каталог: снимок из «знания» (задайте AO_CATALOG_URL, чтобы читать магазин вживую)');
  console.log(`Панель: http://${HOST}:${PORT}${TOKEN ? '?token=***' : ''}`);
  console.log(EMBED_ORIGIN
    ? `Встраивание разрешено для: ${EMBED_ORIGIN}`
    : 'Встраивание запрещено (задайте AO_EMBED_ORIGIN, чтобы вставить панель в админку)');
});

if (CATALOG_URL) {
  await pullCatalog('старт');
  setInterval(() => pullCatalog('по расписанию'), CATALOG_REFRESH).unref?.();
}

if (ORDERS_URL) {
  await pullOrders('старт');
  setInterval(() => pullOrders('по расписанию'), ORDERS_REFRESH).unref?.();
}

new Scheduler({
  jobs: schedule,
  log: (type, payload) => store.log(type, payload),
  onFire: (job) => orchestrator.submit({
    title: job.title, input: job.input, agentId: job.agentId,
  }),
}).start();

/* Показываем владельцу, какой именно бот подключён: перепутанный токен иначе
   обнаружился бы только после сообщения не тому человеку. */
if (hasTelegram()) {
  whoAmI()
    .then((me) => console.log(`Telegram: отправка через @${me.username}`))
    .catch((err) => console.error(`Telegram: токен задан, но бот не отвечает — ${err.message}`));
}

export { server, orchestrator, store, pullCatalog };
