// Обзор мышью без захвата указателя. Встроенные страницы (iframe) и некоторые браузеры молча
// игнорируют requestPointerLock — тогда камера должна следовать за обычным курсором или тачпадом.
import { launch, newGame, wait, A } from './qa-lib.mjs';

const SILENT_LOCK = () => {
  // как во встроенной странице без разрешения: запрос не захватывает мышь и не сообщает об ошибке
  Element.prototype.requestPointerLock = function () { return undefined; };
};

const { browser, page, errors } = await launch(undefined, { width: 1280, height: 760 }, SILENT_LOCK);
let failures = 0;
const check = (ok, what) => { if (!ok) failures++; console.log((ok ? '  ✓ ' : '  ✖ ') + what); };
await A(page, () => localStorage.setItem('aethermoor.settings.v1', JSON.stringify({ camera: 'first', voice: false })));
await page.reload(); await page.waitForFunction(() => !!window.__aether, null, { timeout: 30000 }); await wait(page, 1500);
await newGame(page);
const yaw = () => A(page, () => window.__aether.engine.yaw);
const pitch = () => A(page, () => window.__aether.engine.pitch);

// 1. курсор (тачпад) вправо — камера поворачивается вправо, без щелчков
await page.mouse.move(640, 380);
await wait(page, 300);
let y0 = await yaw();
for (let i = 1; i <= 10; i++) { await page.mouse.move(640 + i * 20, 380); await wait(page, 40); }
await wait(page, 500);
let y1 = await yaw();
check(y0 - y1 > 0.3, `движение курсора вправо поворачивает камеру вправо (${(y0 - y1).toFixed(2)} рад)`);
// и обратно влево
for (let i = 1; i <= 10; i++) { await page.mouse.move(840 - i * 20, 380); await wait(page, 40); }
await wait(page, 500);
const y2 = await yaw();
check(y2 - y1 > 0.3, `движение влево поворачивает обратно (${(y2 - y1).toFixed(2)} рад)`);
// вверх-вниз меняет наклон
const p0 = await pitch();
for (let i = 1; i <= 6; i++) { await page.mouse.move(640, 380 - i * 20); await wait(page, 40); }
await wait(page, 400);
check((await pitch()) - p0 > 0.1, 'движение вверх поднимает взгляд');

// 2. щелчок: захват молча не сработал — игра это замечает и дальше не «съедает» щелчки
await page.mouse.click(640, 300);
await wait(page, 1600);
check(await A(page, () => window.__aether.inputLockFailed()), 'молчаливый отказ захвата распознан');
await A(page, () => window.__aether.mutate((g) => { if (!g.spells.known.includes('spark')) g.spells.known.push('spark'); }));
const c0 = await A(page, () => window.__aether.G().counters.casts ?? 0);
await page.mouse.click(640, 300);
await wait(page, 900);
const c1 = await A(page, () => window.__aether.G().counters.casts ?? 0);
check(c1 > c0, `щелчок после этого — заклинание (произнесено: ${c1 - c0})`);

// 3. курсор у правого края — камера продолжает поворачиваться
await page.mouse.move(1268, 560);
await wait(page, 300);
const t0 = await A(page, () => window.__aether.engine.now);
y0 = await yaw();
await wait(page, 1500);
y1 = await yaw();
const t1 = await A(page, () => window.__aether.engine.now);
// скорость в игровом времени: на программном рендере кадров мало, а шаг кадра ограничен
const rate = (y0 - y1) / Math.max(1e-3, t1 - t0);
check(rate > 1, `у края экрана поворот продолжается (${rate.toFixed(2)} рад/с)`);
// курсор над кнопками интерфейса у края — камера стоит
await page.mouse.move(1240, 725);
await wait(page, 400);
y0 = await yaw();
await wait(page, 1200);
y1 = await yaw();
check(Math.abs(y0 - y1) < 0.02, 'над кнопками интерфейса камера не крутится');

const real = errors.filter((e) => !/502|Bad Gateway/.test(e));
console.log(`\nОшибки консоли: ${real.length ? real.join('\n') : 'нет'}`);
console.log(failures ? `ПРОВАЛОВ: ${failures}` : 'Обзор без захвата мыши работает.');
await browser.close();
process.exit(failures || real.length ? 1 : 0);
