// Обзорный прогон: новая игра и снимки всех зон (для визуальной проверки).
import { launch, newGame, goto, shot, wait, A } from './qa-lib.mjs';

const tour = [
  ['gates', 'start', 12], ['hall', 'from_gates', 14], ['library', 'from_hall', 15], ['towers', 'from_hall', 21],
  ['dungeons', 'from_hall', 22], ['tunnels', 'from_dungeons', 23], ['forest', 'from_gates', 11], ['village', 'from_gates', 13],
  ['lake', 'from_gates', 17], ['ruins', 'from_forest', 12], ['sanctum', 'from_tunnels', 23],
];
const only = process.argv.slice(2);
const { browser, page, errors } = await launch();
await newGame(page);
await A(page, () => { const a = window.__aether; a.mutate((g) => { g.act = 4; g.flags.forest_open = true; g.flags.tunnels_open = true; }); });
for (const [z, sp, hour] of tour) {
  if (only.length && !only.includes(z)) continue;
  try {
    await A(page, (h) => window.__aether.setHour(h), hour);
    await goto(page, z, sp);
    await wait(page, 1500);
    await shot(page, 'tour_' + z);
    console.log('ok', z);
  } catch (e) { console.log('FAIL', z, e.message); }
}
console.log('errors:', errors.length ? errors.slice(0, 10).join('\n') : 'none');
await browser.close();
