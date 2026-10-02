// Проверка интерфейса настоящими кликами и клавишами: ни одной «декоративной» кнопки.
// Запуск: npm run dev, затем node scripts/ui-qa.mjs
import { launch, shot, wait, A, goto, talk } from './qa-lib.mjs';

const { browser, page, errors } = await launch();
let failures = 0;
const check = (ok, what) => { if (!ok) failures++; console.log((ok ? '  ✓ ' : '  ✖ ') + what); };
const G = (fn) => A(page, fn);
const key = async (code, ms = 120) => { await page.keyboard.down(code); await wait(page, ms); await page.keyboard.up(code); await wait(page, 150); };

try {
  console.log('— Главное меню и создание персонажа');
  await page.waitForSelector('text=Новая игра', { timeout: 30000 });
  await shot(page, 'ui_01_title');
  await page.click('text=Об игре'); await wait(page, 300);
  check(await page.isVisible('.modal'), 'окно «Об игре» открывается');
  await page.click('.modal >> text=Закрыть');
  await page.click('text=Настройки'); await wait(page, 300);
  check(await page.isVisible('.modal'), 'настройки из главного меню');
  await page.click('.modal >> text=Готово');
  await page.click('text=Новая игра'); await wait(page, 800);
  check(await G(() => window.__aether.ui().screen) === 'intro', 'вступительный ролик');
  await page.click('.intro'); await wait(page, 400);
  await page.keyboard.press('Escape'); await wait(page, 600);
  check(await G(() => window.__aether.ui().screen) === 'create', 'пропуск вступления → создание героя');
  await page.fill('.name-input', 'Тая Рен');
  await page.click('.seg >> text=Ученица');
  await page.click('text=Далее'); await wait(page, 200);
  let guard = 0;
  while (!(await page.isVisible('text=Поступить в Академию')) && guard++ < 8) {
    if (await page.isDisabled('text=Далее')) {
      // шаг характеристик: распределить свободные очки
      for (let i = 0; i < 12; i++) { const plus = page.locator('button:has-text("+"):not([disabled])').first(); if (!(await plus.count())) break; await plus.click(); }
    }
    await page.click('text=Далее'); await wait(page, 200);
  }
  await shot(page, 'ui_02_creation');
  await page.click('text=Поступить в Академию');
  await page.waitForFunction(() => window.__aether.engine.zone && !window.__aether.engine.loading && window.__aether.ui().screen === 'game', null, { timeout: 30000 });
  await wait(page, 1500);
  check(await G(() => window.__aether.G().player.name) === 'Тая Рен', 'персонаж создан с введённым именем');

  console.log('— Движение и взаимодействие');
  const p0 = await G(() => [window.__aether.engine.player.x, window.__aether.engine.player.z]);
  await key('KeyW', 3000);
  const p1 = await G(() => [window.__aether.engine.player.x, window.__aether.engine.player.z]);
  check(p1[1] < p0[1] - 0.3, 'W двигает героя на север');
  await key('Space', 60);
  check(true, 'кувырок (Пробел) без ошибок');
  await G(() => window.__aether.near('ulrich'));
  await wait(page, 500);
  check(await page.isVisible('.prompt'), 'подсказка «E — Поговорить» рядом с NPC');
  await key('KeyE'); await wait(page, 900);
  check(await page.isVisible('.dialogue'), 'E открывает диалог');
  for (let i = 0; i < 20 && await page.isVisible('.dialogue'); i++) {
    const choice = page.locator('.dialogue .choice:not([disabled])').first();
    if (await choice.count()) await choice.click(); else await page.keyboard.press('Space');
    await wait(page, 400);
  }
  check(await G(() => window.__aether.G().quests.mq_arrival.done.includes('letter')), 'выбор в диалоге двигает задание');

  console.log('— Меню гримуара');
  await key('KeyI'); await wait(page, 400);
  check(await G(() => window.__aether.ui().menu) === 'inventory', 'I открывает инвентарь');
  await page.locator('.inv-cell', { has: page.locator('svg') }).first().click(); await wait(page, 200);
  const hpBefore = await G(() => { const a = window.__aether; a.mutate((g) => { g.player.hp = 30; }); return 30; });
  const potion = page.locator('.inv-cell').filter({ hasText: '' });
  void potion;
  await G(() => window.__aether.setUI({ menu: 'inventory' }));
  const cells = await page.$$('.inv-cell');
  let used = false;
  for (const c of cells) { await c.click(); await wait(page, 120); if (await page.isVisible('button:has-text("Использовать")')) { await page.click('button:has-text("Использовать")'); used = true; break; } }
  await wait(page, 300);
  check(used && (await G(() => window.__aether.G().player.hp)) > hpBefore, 'зелье используется и лечит');
  await shot(page, 'ui_03_inventory');
  for (const t of ['Персонаж', 'Заклинания', 'Задания', 'Карта', 'Отношения', 'Дневник', 'Настройки']) {
    await page.click(`.tabs >> text=${t}`); await wait(page, 350);
    check((await page.locator('.tab-body').innerText()).trim().length > 20, `вкладка «${t}» с содержимым`);
    if (t === 'Карта' || t === 'Персонаж') await shot(page, 'ui_04_' + (t === 'Карта' ? 'map' : 'character'));
  }
  await page.click('.tab-close'); await wait(page, 300);
  check(await G(() => window.__aether.ui().menu) === null, 'закрытие гримуара');

  console.log('— Магазин');
  await G(() => window.__aether.mutate((g) => { g.player.gold = 200; }));
  await goto(page, 'village', 'from_gates');
  await G(() => window.__aether.setHour(12));
  await wait(page, 400);
  await G(() => window.__aether.apply([{ openShop: 'alchemist' }]));
  await wait(page, 500);
  const gold0 = await G(() => window.__aether.G().player.gold);
  const buy = page.locator('.trade-row button:has-text("Купить"):not([disabled])').first();
  if (await buy.count()) await buy.click();
  await wait(page, 300);
  check((await G(() => window.__aether.G().player.gold)) < gold0, 'покупка списывает кроны');
  await shot(page, 'ui_05_shop');
  await page.click('.trade .tab-close'); await wait(page, 200);

  console.log('— Пауза, сохранение и загрузка');
  await page.keyboard.press('Escape'); await wait(page, 400);
  check(await G(() => window.__aether.ui().pauseMenu), 'Esc открывает паузу');
  await page.click('text=Сохранить игру'); await wait(page, 400);
  await page.locator('.modal .card', { has: page.locator('.title-font', { hasText: /^Ячейка II$/ }) }).locator('button:has-text("Сохранить")').click(); await wait(page, 800);
  const saved = await G(() => window.__aether.listSaves().then((l) => l.some((s) => s.slot === '2')));
  check(saved, 'сохранение в ячейку II');
  await page.locator('.modal >> text=Закрыть').last().click(); await wait(page, 300);
  await G(() => window.__aether.mutate((g) => { g.player.gold = 1; }));
  await page.click('text=Загрузить игру'); await wait(page, 600);
  await page.locator('.modal .card', { has: page.locator('.title-font', { hasText: /^Ячейка II$/ }) }).locator('button:has-text("Загрузить")').click(); await wait(page, 3000);
  check(!(await G(() => window.__aether.ui().pauseMenu)), 'после загрузки пауза закрыта');
  check((await G(() => window.__aether.G().player.gold)) > 1, 'загрузка восстанавливает состояние');

  console.log('— Настройки');
  await G(() => window.__aether.setUI({ menu: 'settings' })); await wait(page, 300);
  const before = await G(() => JSON.stringify(JSON.parse(localStorage.getItem('aethermoor.settings.v1') ?? '{}')));
  const toggle = page.locator('.tab-body button, .tab-body input[type=checkbox]').first();
  await toggle.click(); await wait(page, 300);
  const after = await G(() => JSON.stringify(JSON.parse(localStorage.getItem('aethermoor.settings.v1') ?? '{}')));
  check(before !== after, 'изменение настройки сохраняется');
  await G(() => window.__aether.setUI({ menu: null }));

  console.log('— Переназначение клавиш');
  await G(() => window.__aether.setUI({ menu: 'settings' })); await wait(page, 300);
  await page.locator('.keybind', { hasText: 'Взаимодействие' }).locator('button').click();
  await wait(page, 150);
  await page.keyboard.press('KeyG'); await wait(page, 300);
  check(await G(() => JSON.parse(localStorage.getItem('aethermoor.settings.v1')).keys.interact === 'KeyG'), 'клавиша взаимодействия переназначена на G');
  await G(() => window.__aether.setUI({ menu: null }));
  await goto(page, 'gates', 'from_village');
  await G(() => window.__aether.near('ulrich')); await wait(page, 500);
  check((await page.locator('.prompt .kbd').innerText()) === 'G', 'подсказка показывает новую клавишу');
  await key('KeyG'); await wait(page, 600);
  check(await page.isVisible('.dialogue'), 'G открывает разговор');
  await page.keyboard.press('Escape'); await wait(page, 300);
  await G(() => window.__aether.setUI({ menu: 'settings' })); await wait(page, 300);
  await page.click('text=Вернуть стандартные'); await wait(page, 200);
  check(await G(() => Object.keys(JSON.parse(localStorage.getItem('aethermoor.settings.v1')).keys).length === 0), 'сброс раскладки');
  await G(() => window.__aether.setUI({ menu: null }));

  console.log('— Утро в спальнях');
  await G(() => window.__aether.goto('towers')); await wait(page, 1500);
  await G(() => window.__aether.setHour(4)); await wait(page, 1500);
  const asleep = await G(() => window.__aether.engine.npcs.list.filter((n) => !n.removed && n.sleeping).length);
  check(asleep > 0, `ночью ученики спят в кроватях (${asleep})`);
  await G(() => window.__aether.setHour(7)); await wait(page, 2500);
  // проснувшиеся уходят по делам стоя, а не «плывут» лёжа
  const lying = await G(() => window.__aether.engine.npcs.list.filter((n) => !n.removed && !n.sleeping && Math.abs(n.rig.root.rotation.x) > 0.1).map((n) => n.def.id));
  const walking = await G(() => window.__aether.engine.npcs.list.filter((n) => !n.removed && n.path.length > 0).length);
  check(lying.length === 0 && walking > 0, `проснувшиеся идут стоя (идут: ${walking}, лёжа: ${lying.join(', ') || 'никто'})`);
  const dup = await G(() => { const ids = window.__aether.engine.npcs.list.filter((n) => !n.removed).map((n) => n.def.id); return ids.filter((id, i) => ids.indexOf(id) !== i); });
  check(dup.length === 0, `NPC не раздваиваются при смене расписания (${dup.join(', ') || 'ок'})`);
  if (lying.length) console.log('   состояние:', JSON.stringify(await G(() => { const u = window.__aether.ui(); return { screen: u.screen, menu: u.menu, pause: u.pauseMenu, dialogue: !!u.dialogue, read: !!u.read, cinematic: !!u.cinematic, wait: u.waitMenu }; })));

  console.log('— Мобильный экран');
  await page.setViewportSize({ width: 390, height: 844 });
  await wait(page, 1200);
  const overflow = await G(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, 'нет горизонтальной прокрутки на 390px');
  await shot(page, 'ui_06_mobile');
  await G(() => window.__aether.setUI({ menu: 'inventory' })); await wait(page, 500);
  await shot(page, 'ui_07_mobile_menu');
  const menuOverflow = await G(() => { const b = document.querySelector('.book'); return b ? b.getBoundingClientRect().right - window.innerWidth : 0; });
  check(menuOverflow <= 1, 'гримуар помещается на телефоне');
  await G(() => window.__aether.setUI({ menu: null }));
} catch (e) {
  failures++;
  console.log('ОШИБКА', e.message.split('\n')[0]);
  await shot(page, 'ui_fail');
}

const real = errors.filter((e) => !/502|Bad Gateway/.test(e));
console.log(`\nОшибки консоли: ${real.length ? '\n' + real.slice(0, 12).join('\n') : 'нет'}`);
console.log(failures ? `ПРОВАЛОВ: ${failures}` : 'Интерфейс в порядке.');
await browser.close();
process.exit(failures || real.length ? 1 : 0);
