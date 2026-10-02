// Общие помощники для автоматических прогонов в headless Chromium.
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';

export const OUT = new URL('../qa-output/', import.meta.url).pathname;
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

export async function launch(url = process.env.QA_URL || 'http://127.0.0.1:5173/', viewport = { width: 1440, height: 860 }, initScript = null) {
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find((p) => existsSync(p));
  const browser = await chromium.launch({ executablePath: exe, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport });
  if (initScript) await page.addInitScript(initScript);
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack ?? '').split('\n').slice(0, 4).join('\n')));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__aether, null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  return { browser, page, errors };
}

export const A = (page, fn, arg) => page.evaluate(fn, arg);
export const shot = (page, name) => page.screenshot({ path: OUT + name + '.png' });
export const wait = (page, ms) => page.waitForTimeout(ms);

export async function newGame(page, opts = {}) {
  await page.evaluate((o) => {
    window.__aether.newGame({
      name: o.name ?? 'Эйлин Грей', gender: o.gender ?? 'f', origin: o.origin ?? 'common', circle: o.circle ?? 'star',
      appearance: { skin: '#e8c0a0', hair: '#6a4a2a', hairStyle: 'long', eyes: '#3a5a7a', robe: '#1e1a22', trim: '#e3c46b', glasses: false, height: 0.94, build: 0.94 },
      stats: { int: 7, power: 4, defense: 4, speed: 4 },
    });
  }, opts);
  await page.waitForFunction(() => window.__aether.engine.zone && !window.__aether.engine.loading, null, { timeout: 30000 });
  await page.waitForTimeout(1200);
}

// Проговаривает текущий диалог: выбирает варианты по списку индексов (по умолчанию — первый доступный).
export async function runDialogue(page, picks = [], maxSteps = 40) {
  for (let i = 0; i < maxSteps; i++) {
    const st = await page.evaluate(() => {
      const a = window.__aether;
      const d = a.ui().dialogue;
      if (!d) return null;
      const cur = a.currentNode();
      return { id: cur?.id, text: cur?.node.text, choices: cur ? a.choicesFor(cur.node).map((c) => ({ index: c.index, enabled: c.enabled, text: c.text })) : [] };
    });
    if (!st) return;
    if (st.choices.length) {
      const want = picks.length ? picks.shift() : null;
      const pick = st.choices.find((c) => (typeof want === 'number' ? c.index === want : typeof want === 'string' ? c.text.includes(want) : c.enabled)) ?? st.choices.find((c) => c.enabled);
      await page.evaluate((idx) => window.__aether.choose(idx), pick.index);
    } else {
      await page.evaluate(() => window.__aether.advance());
    }
    await page.waitForTimeout(80);
  }
}

export async function talk(page, npc, picks = []) {
  const ok = await page.evaluate((n) => window.__aether.near(n), npc);
  if (!ok) throw new Error('NPC не найден в зоне: ' + npc);
  await page.waitForTimeout(300);
  await page.evaluate((n) => window.__aether.talkTo(n), npc);
  await page.waitForTimeout(200);
  await runDialogue(page, picks);
}

export async function goto(page, zone, spawn = 'start') {
  await page.evaluate(([z, s]) => window.__aether.goto(z, s), [zone, spawn]);
  await page.waitForFunction((z) => window.__aether.engine.zone?.def.id === z && !window.__aether.engine.loading, zone, { timeout: 30000 });
  await page.waitForTimeout(800);
}

export async function quest(page, id) {
  return page.evaluate((q) => { const s = window.__aether.G().quests[q]; return s ? { state: s.state, done: s.done } : null; }, id);
}

// Найти NPC по его текущему расписанию (перейти в нужную зону) и поговорить.
export async function meet(page, npc, picks = []) {
  const loc = await page.evaluate((n) => window.__aether.where(n), npc);
  if (!loc) throw new Error('NPC сейчас нигде: ' + npc);
  const cur = await page.evaluate(() => window.__aether.engine.zone?.def.id);
  if (cur !== loc.zone) await goto(page, loc.zone, 'start');
  await page.waitForTimeout(400);
  await talk(page, npc, picks);
}
