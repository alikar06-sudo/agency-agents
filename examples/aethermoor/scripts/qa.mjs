// Полный автоматический прогон сюжета: акты I–V до финала через настоящие системы игры.
// Запуск: npm run dev (в другом терминале), затем node scripts/qa.mjs [--shots]
import { launch, newGame, talk, meet, runDialogue, goto, quest, shot, wait, A } from './qa-lib.mjs';

const SHOTS = process.argv.includes('--shots');
const { browser, page, errors } = await launch();
const log = (...a) => console.log(...a);
let failures = 0;
const check = (ok, what) => { if (!ok) { failures++; log('  ✖', what); } else log('  ✓', what); };
const snap = async (name) => { if (SHOTS) await shot(page, 'story_' + name); };
const state = (fn, arg) => A(page, fn, arg);
const flag = (f) => state((x) => !!window.__aether.G().flags[x], f);
const done = async (q) => (await quest(page, q))?.state === 'done';
const objDone = async (q, o) => ((await quest(page, q))?.done ?? []).includes(o);
const hour = (h) => state((x) => window.__aether.setHour(x), h);
const use = async (k) => { await state(() => window.__aether.setUI({ read: null })); const r = await state((x) => window.__aether.use(x), k); if (r !== 'ok') log('  !', k, r); return r; };
const closeRead = () => state(() => window.__aether.setUI({ read: null }));
const toMarker = (k) => state((x) => window.__aether.toMarker(x), k);
const killAll = (t) => state((x) => window.__aether.killAll(x), t);
const win = () => state(() => window.__aether.winMinigame(1));
const addItem = (id, n = 1) => state(([i, c]) => window.__aether.addItem(i, c), [id, n]);
const minigame = () => state(() => window.__aether.ui().minigame?.id ?? null);
async function lesson(npc, zone, spawn) {
  await goto(page, zone, spawn);
  await talk(page, npc, ['Начать урок']);
  await wait(page, 600);
  const challenge = await state(() => !!window.__aether.ui().challenge);
  if (challenge) {
    for (let i = 0; i < 8 && await state(() => !!window.__aether.ui().challenge); i++) { await killAll(); await wait(page, 700); }
  } else await win();
  await wait(page, 400);
}

try {
  // ======================= АКТ I =======================
  log('— Акт I');
  await newGame(page);
  await snap('01_arrival');
  await talk(page, 'ulrich');
  check(await objDone('mq_arrival', 'letter'), 'письмо показано Ульриху');
  await meet(page, 'mira', [1, 2]);
  check(await objDone('mq_arrival', 'mira'), 'знакомство с Мирой');
  await goto(page, 'hall', 'from_gates');
  await toMarker('hall_center');
  await wait(page, 900);
  check(await objDone('mq_arrival', 'hall'), 'вход в Большой зал');
  await meet(page, 'veist');
  check(await state(() => window.__aether.G().inventory.some((i) => i.id === 'student_robe') && window.__aether.G().spells.known.length >= 1), 'церемония: мантия, жезл и заклинание Круга');
  await snap('02_ceremony');
  await hour(22);
  await goto(page, 'towers', 'from_hall');
  await use('bed_star');
  await wait(page, 400);
  await page.click('.modal .btn.primary');
  await wait(page, 2200);
  check(await done('mq_arrival'), 'первая ночь — задание «Новое начало» выполнено');

  await hour(10);
  await lesson('dorn', 'gates', 'from_hall');
  check(await objDone('mq_first_lessons', 'practical'), 'урок практической магии (испытание на поле)');
  await lesson('pellinor', 'dungeons', 'from_hall');
  check(await objDone('mq_first_lessons', 'potions'), 'урок зельеварения');
  await hour(15);
  await lesson('lowe', 'hall', 'from_dungeons');
  check(await done('mq_first_lessons'), 'первый учебный день завершён');

  await hour(19);
  await goto(page, 'library', 'from_hall');
  await meet(page, 'mira');
  check(await objDone('mq_whispers', 'library'), 'встреча с Мирой в библиотеке');
  await hour(22);
  await goto(page, 'hall', 'from_library');
  await wait(page, 800);
  check(await state(() => window.__aether.enemies().some((e) => e.type === 'shade_blob')), 'ночью в галерее появляется Теневой сгусток');
  await snap('03_shade');
  await killAll('shade_blob');
  await wait(page, 800);
  check(await flag('shade_defeated'), 'сгусток побеждён, получена чёрная руна');
  await meet(page, 'corvin');
  check(await objDone('mq_whispers', 'corvin'), 'разговор с Корвином');
  await hour(8);
  await goto(page, 'hall', 'from_towers');
  await meet(page, 'veist');
  check(await state(() => window.__aether.G().act) === 2, 'акт II начался');

  // ======================= АКТ II =======================
  log('— Акт II');
  await hour(11);
  await use('glitch_transfig');
  await wait(page, 600);
  check(await state(() => window.__aether.enemies().filter((e) => e.type === 'book_swarm').length) >= 3, 'сбой оживил книги');
  await snap('04_books');
  await killAll();
  await goto(page, 'dungeons', 'from_hall');
  await use('glitch_dungeon');
  await wait(page, 500);
  await killAll();
  await goto(page, 'towers', 'from_hall');
  await state(() => window.__aether.reveal('glitch_tower'));
  await wait(page, 300);
  await use('glitch_tower');
  check(await state(() => window.__aether.G().inventory.find((i) => i.id === 'rune_fragment')?.qty ?? 0) === 3, 'собраны три фрагмента руны');
  await hour(21);
  check((await quest(page, 'mq_sleepwalker'))?.state === 'active', 'ночью начинается история лунатика');

  await hour(13);
  await goto(page, 'library', 'from_hall');
  await meet(page, 'mira', ['Как нам туда попасть', 'Поговорю с Корвином']);
  check(await done('mq_glitches') && await objDone('mq_restricted', 'mira'), 'фрагменты у Миры, план запретной секции');
  await addItem('restricted_pass');
  await goto(page, 'library', 'from_hall');
  await use('restricted_door');
  await wait(page, 600);
  check(await flag('restricted_open'), 'запретная секция открыта пропуском');
  await use('codex');
  await closeRead();
  await meet(page, 'mira', [0]);
  check(!!(await minigame()), 'расшифровка — головоломка рун');
  await win();
  await wait(page, 400);
  await meet(page, 'mira');
  check(await state(() => window.__aether.G().act) === 3, 'тайна печатей раскрыта, акт III');

  // лунатик
  await hour(22);
  await goto(page, 'hall', 'from_library');
  await meet(page, 'toby', [0]);
  check(await flag('toby_sick'), 'Тоби уснул беспробудным сном');
  await hour(10);
  await goto(page, 'hall', 'from_towers');
  await meet(page, 'mabel');
  check(await objDone('mq_sleepwalker', 'mabel') && await state(() => window.__aether.G().recipes.includes('awakening')), 'Мэйбел дала рецепт пробуждающего зелья');
  await goto(page, 'gates', 'from_hall');
  await meet(page, 'bran');
  check(await objDone('mq_sleepwalker', 'bran'), 'Бран открыл лес');
  await addItem('moonpetal', 2); await addItem('sunleaf', 1); await addItem('spring_water', 1);
  await goto(page, 'dungeons', 'from_hall');
  await closeRead();
  await use('cauldron');
  await wait(page, 400);
  await page.locator('.card', { hasText: 'Пробуждающее зелье' }).locator('button', { hasText: 'Быстро' }).click();
  await wait(page, 300);
  await page.click('.trade .tab-close');
  check(await objDone('mq_sleepwalker', 'brew'), 'пробуждающее зелье сварено');
  await goto(page, 'hall', 'from_dungeons');
  await meet(page, 'toby');
  check(await done('mq_sleepwalker'), 'Тоби проснулся');

  // ======================= АКТ III =======================
  log('— Акт III');
  await goto(page, 'forest', 'from_gates');
  await toMarker('seal_glade');
  await wait(page, 1500);
  await runDialogue(page);
  await wait(page, 700);
  check(await flag('soren_forest_seen'), 'встреча с Сореном у печати Корня');
  await snap('05_fangmaw');
  await killAll(); await wait(page, 500); await killAll();
  await use('seal_root');
  await win();
  await wait(page, 1600);
  check(await flag('seal_root'), 'печать Корня восстановлена');
  await goto(page, 'lake', 'from_gates');
  await wait(page, 600);
  await killAll('lake_queen');
  await wait(page, 600);
  await use('seal_water');
  await win();
  await wait(page, 1600);
  check(await flag('seal_water'), 'печать Вод восстановлена');
  await goto(page, 'ruins', 'from_forest');
  await wait(page, 600);
  await killAll('ruin_golem');
  await wait(page, 600);
  await use('seal_stone');
  await win();
  await wait(page, 1600);
  check(await state(() => window.__aether.G().act) === 4, 'все печати восстановлены, акт IV');

  // ======================= АКТ IV =======================
  log('— Акт IV');
  await hour(13);
  await goto(page, 'library', 'from_hall');
  await meet(page, 'mira', [0]);
  check(await objDone('mq_suspicion', 'mira'), 'подозрения обсуждены с Мирой');
  await state(() => window.__aether.mutate((g) => { g.player.gold = Math.max(g.player.gold, 60); }));
  await goto(page, 'hall', 'from_library');
  await meet(page, 'nico', ['30 крон']);
  check(await flag('nico_key_given'), 'Нико дал ключ от кладовой');
  await goto(page, 'dungeons', 'from_hall');
  await use('storeroom_door');
  await wait(page, 500);
  await use('ash_sigil');
  check(await objDone('mq_suspicion', 'storeroom'), 'знак Ордена найден в кладовой');
  await hour(14);
  await goto(page, 'towers', 'from_hall');
  await meet(page, 'veist', ['сам']);
  check(await flag('chose_confront'), 'решено говорить с Пеллинором самому');
  await goto(page, 'dungeons', 'from_hall');
  await meet(page, 'pellinor', [0, 'Интеллект 7']);
  check(await flag('pellinor_spared') && await done('mq_suspicion'), 'Пеллинор сдался сам');

  await hour(22);
  await goto(page, 'gates', 'from_hall');
  await wait(page, 2500);
  check(await state(() => window.__aether.enemies().filter((e) => e.type === 'cultist').length) === 3, 'Ночь Пепла: первая волна');
  await snap('06_night_of_ash');
  for (let i = 0; i < 4 && !(await objDone('mq_night_of_ash', 'defend')); i++) { await killAll('cultist'); await wait(page, 3600); }
  check(await objDone('mq_night_of_ash', 'defend'), 'нападение отбито');
  await meet(page, 'cassian', [0, 'дуэли']);
  await wait(page, 300);
  await win();
  await wait(page, 500);
  await runDialogue(page);
  check(await flag('cassian_redeemed'), 'Кассиан остался на нашей стороне');
  await state(() => window.__aether.sleep());
  await wait(page, 2200);
  await runDialogue(page, ['Нет']);
  check(await flag('voice_answered') && await flag('mira_taken'), 'голос из-под камня; Миру похитили');
  await goto(page, 'hall', 'from_towers');
  await meet(page, 'veist');
  check(await state(() => window.__aether.G().act) === 5, 'ключ Основателей получен, акт V');

  // ======================= АКТ V =======================
  log('— Акт V');
  await goto(page, 'tunnels', 'from_dungeons');
  await use('sealed_door');
  await wait(page, 600);
  check(await flag('sealed_door_open'), 'Печатная дверь открыта');
  await goto(page, 'sanctum', 'from_tunnels');
  await toMarker('heart_chamber');
  await wait(page, 1200);
  await runDialogue(page, [0, 'против']);
  await wait(page, 900);
  check(await state(() => window.__aether.enemies().some((e) => e.type === 'soren')), 'бой с Сореном');
  await snap('07_soren');
  await killAll('soren');
  await wait(page, 2400);
  await runDialogue(page);
  check(await state(() => window.__aether.enemies().some((e) => e.type === 'hollow_king')), 'Полый Король восстал');
  await snap('08_hollow');
  await killAll();
  await wait(page, 900);
  check(await objDone('mq_sanctum', 'hollow'), 'Полый Король повержен');
  await use('heart');
  await wait(page, 300);
  await runDialogue(page, ['клятву']);
  await wait(page, 600);
  check(await state(() => window.__aether.ui().screen) === 'ending', 'финальный экран');
  await page.click('text=Читать эпилог');
  await wait(page, 600);
  await snap('09_epilogue');
  for (let i = 0; i < 6; i++) { const b = await page.$('.ending .btn.primary'); const t = b ? await b.innerText() : ''; if (!/Далее|Итоги/.test(t)) break; await b.click(); await wait(page, 300); }
  await snap('10_stats');
  check(await page.isVisible('text=Продолжить исследовать мир'), 'итоги и продолжение игры после финала');
} catch (e) {
  failures++;
  log('ОШИБКА', e.message);
  await shot(page, 'story_fail');
}

const real = errors.filter((e) => !/502|Bad Gateway|ERR_CONNECTION|api\/health/.test(e));
log(`\nОшибки консоли: ${real.length ? '\n' + real.slice(0, 15).join('\n') : 'нет'}`);
log(failures ? `ПРОВАЛОВ: ${failures}` : 'Сюжет пройден полностью.');
await browser.close();
process.exit(failures || real.length ? 1 : 0);
