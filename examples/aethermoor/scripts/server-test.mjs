// Проверка API сервера: профиль, сохранения, авторизация, ошибки.
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import http from 'node:http';

const dist = await mkdtemp(join(tmpdir(), 'aether-dist-'));
await mkdir(join(dist, 'assets'));
await writeFile(join(dist, 'index.html'), '<!doctype html><title>Этермур</title>');
await writeFile(join(dist, 'assets', 'app.js'), 'console.log(1)');
process.env.AETHER_DIST = dist;
const { createServer, store } = await import('../server/server.mjs');
const raw = (path) => new Promise((r) => http.get({ host: '127.0.0.1', port: srv.address().port, path }, (res) => { let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => r({ status: res.statusCode, body: b, headers: res.headers })); }));

store.dir = await mkdtemp(join(tmpdir(), 'aether-'));
await store.init();
const srv = createServer().listen(0);
await new Promise((r) => srv.once('listening', r));
const base = `http://127.0.0.1:${srv.address().port}`;
let failed = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✖ ') + m); if (!c) failed++; };
const j = async (path, init = {}) => { const r = await fetch(base + path, init); const t = await r.text(); return { status: r.status, body: t ? JSON.parse(t) : null }; };

ok((await j('/api/health')).body.ok === true, 'health');
const p = (await j('/api/profile', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ displayName: '<b>Эйлин</b>' }) })).body;
ok(p.id && p.token && p.displayName === 'bЭйлин/b', 'создание профиля и очистка имени');
const H = { 'content-type': 'application/json', 'x-player-id': p.id, 'x-player-token': p.token };
ok((await j('/api/profile', { headers: H })).status === 200, 'профиль по токену');
ok((await j('/api/profile', { headers: { ...H, 'x-player-token': 'x'.repeat(64) } })).status === 401, 'чужой токен отклонён');
ok((await j('/api/saves', { headers: H })).body.saves.length === 0, 'пустой список сохранений');
const state = { version: 3, updatedAt: Date.now(), player: { name: 'Эйлин' } };
ok((await j('/api/saves/1', { method: 'PUT', headers: H, body: JSON.stringify({ state, meta: { level: 4, zone: 'hall', act: 2 } }) })).status === 204, 'запись в ячейку 1');
ok((await j('/api/saves/hack', { method: 'PUT', headers: H, body: JSON.stringify({ state }) })).status === 400, 'неизвестная ячейка отклонена');
ok((await j('/api/saves/2', { method: 'PUT', headers: H, body: JSON.stringify({ state: { nope: 1 } }) })).status === 400, 'некорректное сохранение отклонено');
const got = await j('/api/saves/1', { headers: H });
ok(got.body.state.player.name === 'Эйлин' && got.body.meta.level === 4, 'чтение сохранения');
ok((await j('/api/saves', { headers: H })).body.saves.length === 1, 'список содержит запись');
ok((await j('/api/saves/1', { method: 'DELETE', headers: H })).status === 204, 'удаление');
ok((await j('/api/saves/1', { headers: H })).status === 404, 'после удаления — 404');
ok((await j('/api/saves', {})).status === 401, 'без профиля — 401');
const idx = await raw('/some/spa/route');
ok(idx.status === 200 && idx.body.includes('Этермур'), 'SPA: неизвестный путь отдаёт index.html');
const asset = await raw('/assets/app.js');
ok(asset.status === 200 && /immutable/.test(asset.headers['cache-control']), 'ассеты с долгим кэшем');
const trav = await raw('/..%2f..%2f..%2fetc%2fpasswd');
ok(!trav.body.includes('root:'), 'обход путей не выходит за пределы dist');
srv.close();
console.log(failed ? `ПРОВАЛОВ: ${failed}` : 'API в порядке.');
process.exit(failed ? 1 : 0);
