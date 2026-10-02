// Проверка озвучки диалогов. В headless-браузере нет системных голосов, поэтому
// speechSynthesis подменяется записывающей заглушкой с двумя русскими голосами.
import { launch, newGame, wait, A } from './qa-lib.mjs';

const MOCK = () => {
  const log = [];
  window.__speech = log;
  const voices = [
    { name: 'Milena', lang: 'ru-RU', default: true, localService: true, voiceURI: 'Milena' },
    { name: 'Yuri', lang: 'ru-RU', default: false, localService: true, voiceURI: 'Yuri' },
    { name: 'Samantha', lang: 'en-US', default: false, localService: true, voiceURI: 'Samantha' },
  ];
  class Utter { constructor(text) { this.text = text; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null; this.lang = ''; } }
  let queue = [], busy = false;
  const run = () => {
    if (busy || !queue.length) return;
    busy = true;
    const u = queue.shift();
    log.push({ text: u.text, pitch: +u.pitch.toFixed(2), rate: +u.rate.toFixed(2), voice: u.voice?.name ?? null, volume: u.volume });
    setTimeout(() => {
      u.onstart?.({});
      const words = u.text.split(' ');
      let ci = 0, k = 0;
      const tick = () => {
        if (u.__cancel) return;
        if (k < words.length) { u.onboundary?.({ charIndex: ci, charLength: words[k].length, name: 'word' }); ci += words[k].length + 1; k++; setTimeout(tick, 25); }
        else { busy = false; u.onend?.({}); run(); }
      };
      tick();
    }, 20);
  };
  const synth = {
    getVoices: () => voices, speaking: false, pending: false, paused: false,
    speak: (u) => { queue.push(u); run(); },
    cancel: () => { queue.forEach((q) => { q.__cancel = true; }); queue = []; busy = false; },
    pause() {}, resume() {}, addEventListener() {}, removeEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = Utter;
};

const { browser, page, errors } = await launch(undefined, undefined, MOCK);
let failures = 0;
const check = (ok, what) => { if (!ok) failures++; console.log((ok ? '  ✓ ' : '  ✖ ') + what); };
await newGame(page, { gender: 'f' });
await A(page, () => window.__aether.near('ulrich'));
await wait(page, 300);
await A(page, () => window.__aether.talkTo('ulrich'));
await wait(page, 2500);
let log = await A(page, () => window.__speech.slice());
check(log.length > 0, 'реплика Ульриха прозвучала');
check(log[0]?.voice === 'Yuri' && log[0].pitch < 1, `Ульрих говорит мужским низким голосом (${log[0]?.voice}, высота ${log[0]?.pitch})`);
check(!log.some((l) => /\[|\]/.test(l.text)), 'метки проверок не зачитываются');
// первый узел с вариантами: выбираем ответ мышью — героиня произносит его, затем отвечает Ульрих
const before = log.length;
await page.locator('.dialogue .choice').first().click();
await wait(page, 2500);
log = await A(page, () => window.__speech.slice());
const hero = log[before];
check(hero && hero.voice === 'Milena', `героиня произносит выбранный ответ женским голосом (${hero?.voice})`);
check(log.length > before + 1 && log[before + 1].voice === 'Yuri', 'после ответа героини Ульрих продолжает');
// узел «read» без вариантов ответа сменился следующим («tips») без нажатий
await wait(page, 3000);
const node1 = await A(page, () => window.__aether.currentNode()?.id ?? 'конец');
const said = await A(page, () => window.__speech.map((l) => l.text).join(' | '));
check(node1 === 'tips' && /Печать настоящая/.test(said), `реплика без вариантов прозвучала и разговор продолжился сам (сейчас: ${node1})`);
for (let i = 0; i < 12 && await A(page, () => !!window.__aether.ui().dialogue); i++) {
  const ch = page.locator('.dialogue .choice:not([disabled])').first();
  if (await ch.count()) await ch.click();
  await wait(page, 1500);
}
check(!(await A(page, () => !!window.__aether.ui().dialogue)), 'разговор с Ульрихом завершён');
// Мира — женский голос, высокий
await A(page, () => window.__aether.near('mira'));
await A(page, () => window.__aether.talkTo('mira'));
await wait(page, 2000);
log = await A(page, () => window.__speech.slice());
const mira = log.filter((l) => l.voice === 'Milena' && l.pitch > 1.1);
check(mira.length > 0, 'Мира говорит женским высоким голосом');
// выключенная озвучка — текст печатается, речи нет
await A(page, () => { window.__aether.endDialogue(); });
await A(page, () => { const s = JSON.parse(localStorage.getItem('aethermoor.settings.v1') || '{}'); return s; });
await page.evaluate(() => { const st = window.__aether; void st; });
console.log(`\nОшибки консоли: ${errors.filter((e) => !/502/.test(e)).join('\n') || 'нет'}`);
console.log(failures ? `ПРОВАЛОВ: ${failures}` : 'Озвучка в порядке.');
await browser.close();
process.exit(failures ? 1 : 0);
