// HTTP-сервер: REST + поток событий (SSE) + отдача панели.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Store } from './store.js';
import { loadAgents, loadKnowledge, composeContext } from './registry.js';
import { Catalog } from './catalog.js';
import { Orchestrator } from './orchestrator.js';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '..');
const PUBLIC_DIR = join(ROOT, 'public');
const PORT = Number(process.env.PORT || process.env.AO_PORT || 8787);
const HOST = process.env.AO_HOST || '127.0.0.1';
const TOKEN = process.env.AO_TOKEN || '';
// Кому разрешено встраивать панель в iframe. Пусто — никому: встраивание
// открывает панель чужой странице, поэтому это осознанное разрешение.
const EMBED_ORIGIN = (process.env.AO_EMBED_ORIGIN || '').trim();

const store = new Store();
const agents = loadAgents(ROOT);
if (!agents.length) {
  console.error('Не найден ни один агент. Проверь пути в src/registry.js');
  process.exit(1);
}
let knowledge = loadKnowledge(ROOT);
let catalog = Catalog.fromFile(knowledge.dir);
const orchestrator = new Orchestrator({
  store, agents,
  getContext: (agent) => composeContext(knowledge, agent, catalog),
  getCatalog: () => catalog,
});

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

function serveStatic(res, pathname) {
  const file = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const full = join(PUBLIC_DIR, file);
  if (!full.startsWith(PUBLIC_DIR) || !existsSync(full)) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Не найдено');
  }
  const headers = {
    'content-type': MIME[extname(full)] || 'application/octet-stream',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'same-origin',
  };
  if (extname(full) === '.html') {
    headers['content-security-policy'] =
      `frame-ancestors ${EMBED_ORIGIN ? `'self' ${EMBED_ORIGIN}` : "'none'"}`;
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
      return json(res, 200, orchestrator.snapshot());
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
      store.log('brain.updated', {
        message: `Пакет знаний перечитан: ${knowledge.files.length} файлов`,
      });
      return json(res, 200, { ok: true, files: knowledge.files, catalog: catalog.stats() });
    }

    if (pathname.startsWith('/api/')) return json(res, 404, { error: 'Неизвестный маршрут' });

    return serveStatic(res, pathname);
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
  console.log(`Панель: http://${HOST}:${PORT}${TOKEN ? '?token=***' : ''}`);
  console.log(EMBED_ORIGIN
    ? `Встраивание разрешено для: ${EMBED_ORIGIN}`
    : 'Встраивание запрещено (задайте AO_EMBED_ORIGIN, чтобы вставить панель в админку)');
});

export { server, orchestrator, store };
