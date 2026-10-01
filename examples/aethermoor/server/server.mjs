// Сервер Академии Этермур: профили игроков, облачные сохранения и раздача собранной игры.
// Без внешних зависимостей: node server/server.mjs  (порт AETHER_PORT, по умолчанию 8790).
//
// API (JSON):
//   GET    /api/health                 → { ok, version, time }
//   POST   /api/profile                → создать гостевой профиль { id, token, displayName }
//   GET    /api/profile                → профиль по заголовкам x-player-id / x-player-token
//   PUT    /api/profile                → { displayName }
//   GET    /api/saves                  → { saves: SaveMeta[] }
//   GET    /api/saves/:slot            → { state, meta }
//   PUT    /api/saves/:slot            → { state, meta } → 204
//   DELETE /api/saves/:slot            → 204
//
// Хранилище — интерфейс Store ниже. FileStore пишет JSON-файлы в server/data;
// для продакшена его можно заменить реализацией поверх Postgres/SQLite/KV, не трогая маршруты.
import http from 'node:http';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, rm, readdir, stat } from 'node:fs/promises';
import { createReadStream, existsSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(process.env.AETHER_DATA ?? join(ROOT, 'data'));
const DIST_DIR = resolve(process.env.AETHER_DIST ?? join(ROOT, '..', 'dist'));
const PORT = Number(process.env.AETHER_PORT ?? process.env.PORT ?? 8790);
const HOST = process.env.AETHER_HOST ?? '127.0.0.1';
const VERSION = '1.0.0';
const SLOTS = new Set(['auto', '1', '2', '3']);
const MAX_BODY = 2 * 1024 * 1024;

// ---------------- хранилище ----------------

const sha256 = (s) => createHash('sha256').update(s).digest('hex');

class FileStore {
  constructor(dir) { this.dir = dir; this.locks = new Map(); }
  async init() { await mkdir(join(this.dir, 'profiles'), { recursive: true }); await mkdir(join(this.dir, 'saves'), { recursive: true }); }
  profilePath(id) { return join(this.dir, 'profiles', `${id}.json`); }
  saveDir(id) { return join(this.dir, 'saves', id); }
  async readJson(path) { try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; } }
  // атомарная запись: временный файл + переименование, по одной записи на файл за раз
  async writeJson(path, value) {
    const prev = this.locks.get(path) ?? Promise.resolve();
    const next = prev.then(async () => {
      await mkdir(dirname(path), { recursive: true });
      const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
      await writeFile(tmp, JSON.stringify(value));
      await rename(tmp, path);
    });
    this.locks.set(path, next.catch(() => {}));
    return next;
  }
  async createProfile(displayName) {
    const id = randomUUID();
    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    await this.writeJson(this.profilePath(id), { id, tokenHash: sha256(token), displayName, createdAt: now, updatedAt: now });
    return { id, token, displayName };
  }
  async getProfile(id) { return /^[0-9a-f-]{36}$/.test(id ?? '') ? this.readJson(this.profilePath(id)) : null; }
  async updateProfile(p) { p.updatedAt = Date.now(); await this.writeJson(this.profilePath(p.id), p); }
  async listSaves(id) {
    const dir = this.saveDir(id);
    if (!existsSync(dir)) return [];
    const out = [];
    for (const f of await readdir(dir)) {
      if (!f.endsWith('.json')) continue;
      const doc = await this.readJson(join(dir, f));
      if (doc?.meta) out.push(doc.meta);
    }
    return out.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  }
  async getSave(id, slot) { return this.readJson(join(this.saveDir(id), `${slot}.json`)); }
  async putSave(id, slot, doc) { await this.writeJson(join(this.saveDir(id), `${slot}.json`), doc); }
  async deleteSave(id, slot) { await rm(join(this.saveDir(id), `${slot}.json`), { force: true }); }
}

const store = new FileStore(DATA_DIR);

// ---------------- помощники HTTP ----------------

function send(res, status, body, headers = {}) {
  const data = body === undefined ? '' : JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers });
  res.end(data);
}
const fail = (res, status, error) => send(res, status, { error });

function readBody(req) {
  return new Promise((ok, bad) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { bad(Object.assign(new Error('too large'), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return ok({});
      try { ok(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { bad(Object.assign(new Error('bad json'), { status: 400 })); }
    });
    req.on('error', bad);
  });
}

function cleanName(v) {
  const s = String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 40);
  return s || 'Гость';
}

async function auth(req) {
  const id = req.headers['x-player-id'];
  const token = req.headers['x-player-token'];
  if (typeof id !== 'string' || typeof token !== 'string') return null;
  const p = await store.getProfile(id);
  if (!p) return null;
  const a = Buffer.from(p.tokenHash, 'hex');
  const b = Buffer.from(sha256(token), 'hex');
  return a.length === b.length && timingSafeEqual(a, b) ? p : null;
}

// простое ограничение частоты создания профилей: 20 в минуту с одного адреса
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const b = buckets.get(ip) ?? { n: 0, t: now };
  if (now - b.t > 60_000) { b.n = 0; b.t = now; }
  b.n++;
  buckets.set(ip, b);
  return b.n > 20;
}

// ---------------- API ----------------

async function api(req, res, path) {
  if (path === '/api/health' && req.method === 'GET') return send(res, 200, { ok: true, version: VERSION, time: Date.now() });

  if (path === '/api/profile') {
    if (req.method === 'POST') {
      if (rateLimited(req.socket.remoteAddress ?? '?')) return fail(res, 429, 'Слишком много запросов');
      const body = await readBody(req);
      const p = await store.createProfile(cleanName(body.displayName));
      return send(res, 201, p);
    }
    const p = await auth(req);
    if (!p) return fail(res, 401, 'Нужен профиль');
    if (req.method === 'GET') return send(res, 200, { id: p.id, displayName: p.displayName, createdAt: p.createdAt });
    if (req.method === 'PUT') {
      const body = await readBody(req);
      p.displayName = cleanName(body.displayName);
      await store.updateProfile(p);
      return send(res, 200, { id: p.id, displayName: p.displayName });
    }
    return fail(res, 405, 'Метод не поддерживается');
  }

  if (path === '/api/saves' || path.startsWith('/api/saves/')) {
    const p = await auth(req);
    if (!p) return fail(res, 401, 'Нужен профиль');
    if (path === '/api/saves') {
      if (req.method !== 'GET') return fail(res, 405, 'Метод не поддерживается');
      return send(res, 200, { saves: await store.listSaves(p.id) });
    }
    const slot = decodeURIComponent(path.slice('/api/saves/'.length));
    if (!SLOTS.has(slot)) return fail(res, 400, 'Неизвестная ячейка');
    if (req.method === 'GET') {
      const doc = await store.getSave(p.id, slot);
      return doc ? send(res, 200, doc) : fail(res, 404, 'Сохранения нет');
    }
    if (req.method === 'PUT') {
      const body = await readBody(req);
      const state = body.state;
      if (!state || typeof state !== 'object' || typeof state.version !== 'number' || !state.player) return fail(res, 400, 'Некорректное сохранение');
      const m = body.meta ?? {};
      const meta = {
        slot, source: 'cloud',
        name: String(m.name ?? state.player.name ?? '').slice(0, 40), level: Number(m.level) || 1,
        zone: String(m.zone ?? ''), zoneName: String(m.zoneName ?? ''), day: Number(m.day) || 1, min: Number(m.min) || 0,
        playTime: Number(m.playTime) || 0, updatedAt: Number(state.updatedAt) || Date.now(), circle: String(m.circle ?? ''), act: Number(m.act) || 1,
      };
      await store.putSave(p.id, slot, { state, meta });
      return send(res, 204);
    }
    if (req.method === 'DELETE') { await store.deleteSave(p.id, slot); return send(res, 204); }
    return fail(res, 405, 'Метод не поддерживается');
  }
  return fail(res, 404, 'Нет такого маршрута');
}

// ---------------- статика (собранная игра) ----------------

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

async function serveStatic(req, res, path) {
  if (!existsSync(DIST_DIR)) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
    return res.end('Игра не собрана. Выполните: npm run build');
  }
  let rel = normalize(decodeURIComponent(path)).replace(/^([/\\])+/, '');
  let file = resolve(DIST_DIR, rel);
  if (!file.startsWith(DIST_DIR + sep) && file !== DIST_DIR) return fail(res, 403, 'Запрещено');
  let info = await stat(file).catch(() => null);
  if (!info || info.isDirectory()) { file = join(DIST_DIR, 'index.html'); rel = 'index.html'; info = await stat(file).catch(() => null); }
  if (!info) return fail(res, 404, 'Не найдено');
  const hashed = rel.startsWith('assets' + sep) || rel.startsWith('assets/');
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'content-length': info.size,
    'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache',
    'x-content-type-options': 'nosniff',
  });
  if (req.method === 'HEAD') return res.end();
  createReadStream(file).pipe(res);
}

// ---------------- запуск ----------------

export function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://local');
    try {
      if (url.pathname.startsWith('/api/')) await api(req, res, url.pathname);
      else if (req.method === 'GET' || req.method === 'HEAD') await serveStatic(req, res, url.pathname);
      else fail(res, 405, 'Метод не поддерживается');
    } catch (err) {
      const status = err?.status ?? 500;
      if (status === 500) console.error(err);
      if (!res.headersSent) fail(res, status, status === 500 ? 'Внутренняя ошибка' : err.message);
      else res.end();
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await store.init();
  createServer().listen(PORT, HOST, () => {
    console.log(`Этермур: сервер на http://${HOST}:${PORT}  (данные: ${DATA_DIR})`);
  });
}

export { store };
