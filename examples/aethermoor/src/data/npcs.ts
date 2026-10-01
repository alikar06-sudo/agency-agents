// Обитатели Этермура: внешность, характер, расписание, разговоры.
import type { NpcDef, ScheduleEntry } from './types';

const W = [0, 1, 2, 3, 4];     // будни
const WE = [5, 6];             // выходные

// Типовой день ученика: завтрак — занятия — обед — двор — ужин — гостиная — сон.
function studentDay(seat: string, day1: string, day1z: NpcDef['schedule'][number]['zone'], day2: string, day2z: NpcDef['schedule'][number]['zone'], dorm: string, evening = 'common_room'): ScheduleEntry[] {
  return [
    { from: 0, zone: 'towers', at: dorm, activity: 'sleep' },
    { from: 7, zone: 'hall', at: seat, activity: 'Завтрак' },
    { from: 9, zone: day1z, at: day1, activity: 'Занятия', wander: 1 },
    { from: 12, zone: 'hall', at: seat, activity: 'Обед' },
    { from: 13, zone: day2z, at: day2, activity: 'Свободное время', wander: 2 },
    { from: 18, zone: 'hall', at: seat, activity: 'Ужин' },
    { from: 19, zone: 'towers', at: evening, activity: 'Гостиная', wander: 2 },
    { from: 22, zone: 'towers', at: dorm, activity: 'sleep' },
  ];
}

const list: NpcDef[] = [
  // ================= Преподаватели =================
  {
    id: 'veist', name: 'Аурелиан Вейст', title: 'Архимагистр Академии', faction: 'academy', essential: true, voice: 0.7,
    personality: 'Мудрый, ироничный, скрывает усталость. Помнит всех учеников по именам.',
    appearance: { skin: '#e2c4aa', hair: '#e8e4dc', hairStyle: 'long', eyes: '#6a8aa8', robe: '#8a8a72', trim: '#d8c890', hat: 'tall', beard: 'long', beardColor: '#eeeae2', height: 1.08 },
    schedule: [
      { from: 0, zone: 'towers', at: 'head_office', activity: 'Кабинет' },
      { from: 7, zone: 'hall', at: 'head_table', activity: 'Завтрак в Большом зале' },
      { from: 9, zone: 'towers', at: 'head_office', activity: 'Кабинет' },
      { from: 12, zone: 'hall', at: 'head_table', activity: 'Обед' },
      { from: 13, zone: 'towers', at: 'head_office', activity: 'Кабинет' },
      { from: 18, zone: 'hall', at: 'head_table', activity: 'Ужин' },
      { from: 20, zone: 'towers', at: 'head_office', activity: 'Кабинет' },
    ],
    overrides: [
      { if: [{ quest: 'mq_arrival', is: 'active' }], schedule: [{ from: 0, zone: 'hall', at: 'head_table', activity: 'Церемония Кругов' }] },
      { if: [{ flag: 'veist_wounded' }, { notFlag: 'game_ended' }], schedule: [{ from: 0, zone: 'hall', at: 'nurse_post', activity: 'Ранен, лежит в лазарете' }] },
    ],
    dialogues: [
      { if: [{ objActive: ['mq_arrival', 'ceremony'] }], id: 'veist_ceremony', mark: true },
      { if: [{ objActive: ['mq_whispers', 'morning'] }], id: 'veist_morning', mark: true },
      { if: [{ objActive: ['mq_suspicion', 'accuse'] }], id: 'veist_accuse', mark: true },
      { if: [{ objActive: ['mq_night_of_ash', 'veist'] }], id: 'veist_key', mark: true },
      { id: 'veist_idle' },
    ],
    barks: ['Любопытство — лучший учитель. И худший советчик.', 'Чай остывает, а тайны — нет.', 'Ах, юность. Я помню её смутно, но с удовольствием.'],
  },
  {
    id: 'gravane', name: 'Изольда Гравейн', title: 'Профессор трансформации, заместитель Архимагистра', faction: 'academy', voice: 1.05,
    personality: 'Строгая, справедливая, редко улыбается — но если улыбнулась, вы это заслужили.',
    appearance: { skin: '#e8cdb8', hair: '#9a948c', hairStyle: 'bun', eyes: '#5a7a5a', robe: '#1e2a22', trim: '#5a8a5a', hat: 'pointed', height: 1.04 },
    schedule: [
      { from: 0, zone: 'towers', at: 'staff_quarters', activity: 'sleep' },
      { from: 7, zone: 'hall', at: 'staff_2', activity: 'Завтрак' },
      { from: 9, zone: 'hall', at: 'transfig_desk', activity: 'Урок трансформации' },
      { from: 12, zone: 'hall', at: 'staff_2', activity: 'Обед' },
      { from: 13, zone: 'hall', at: 'transfig_desk', activity: 'Урок трансформации' },
      { from: 18, zone: 'hall', at: 'staff_2', activity: 'Ужин' },
      { from: 20, zone: 'hall', at: 'corridor_e', activity: 'Обход галереи', wander: 4 },
      { from: 23, zone: 'towers', at: 'staff_quarters', activity: 'sleep' },
    ],
    dialogues: [
      { if: [{ flag: 'caught_curfew_pending' }], id: 'gravane_caught', mark: true },
      { id: 'gravane_main' },
    ],
    barks: ['Палочку держат кончиками пальцев, а не кулаком.', 'Опоздание — это тоже трансформация. Времени в пустоту.', 'Ровнее спину, мистер — или мисс.'],
  },
  {
    id: 'corvin', name: 'Сайлас Корвин', title: 'Магистр защитной магии и древних рун', faction: 'academy', voice: 0.8,
    personality: 'Немногословен, язвителен, никому не доверяет. Ходит по ночам по самым тёмным углам замка.',
    appearance: { skin: '#d8c0ac', hair: '#141218', hairStyle: 'long', eyes: '#3a3a44', robe: '#16242a', trim: '#4a7a8a', height: 1.06, build: 0.95 },
    presentIf: [{ notFlag: 'corvin_arrested' }],
    schedule: [
      { from: 0, zone: 'dungeons', at: 'night_corridor', activity: 'Бродит по подземельям', wander: 3 },
      { from: 6, zone: 'towers', at: 'staff_quarters', activity: 'sleep' },
      { from: 8, zone: 'hall', at: 'staff_3', activity: 'Завтрак' },
      { from: 9, zone: 'hall', at: 'duel_desk', activity: 'Урок защитной магии' },
      { from: 12, zone: 'hall', at: 'staff_3', activity: 'Обед' },
      { from: 13, zone: 'towers', at: 'runes_desk', activity: 'Урок древних рун' },
      { from: 18, zone: 'hall', at: 'staff_3', activity: 'Ужин' },
      { from: 20, zone: 'library', at: 'restricted_desk', activity: 'Запретная секция' },
    ],
    overrides: [
      { if: [{ flag: 'shade_defeated' }, { notFlag: 'corvin_confronted' }], schedule: [{ from: 0, zone: 'hall', at: 'corridor_e', activity: 'Осматривает галерею' }] },
      { if: [{ flag: 'ally_corvin' }, { flag: 'soren_challenge' }, { quest: 'mq_sanctum', is: 'active' }], schedule: [{ from: 0, zone: 'sanctum', at: 'ally_corvin', activity: 'Держит щит над вами' }] },
    ],
    dialogues: [
      { if: [{ objActive: ['mq_whispers', 'corvin'] }], id: 'corvin_confront', mark: true },
      { if: [{ objActive: ['rq_corvin', 'deliver'] }, { flag: 'elias_answered' }], id: 'corvin_debt_done', mark: true },
      { if: [{ quest: 'rq_corvin', is: 'none' }, { act: 3 }, { rel: 'corvin', gte: 10 }], id: 'corvin_debt', mark: true },
      { id: 'corvin_main' },
    ],
    barks: ['…', 'Не путайтесь под ногами.', 'Тени любят тех, кто их не замечает.'],
  },
  {
    id: 'pellinor', name: 'Феликс Пеллинор', title: 'Мастер зельеварения', faction: 'academy', voice: 1.15,
    personality: 'Добродушный, шумный, обожает пироги и учеников. Слишком часто улыбается.',
    appearance: { skin: '#e8b898', hair: '#b8642a', hairStyle: 'curly', eyes: '#6a4a2a', robe: '#8a6a2a', trim: '#e0b860', beard: 'short', beardColor: '#a8582a', build: 1.35, height: 0.98, glasses: true },
    presentIf: [{ notFlag: 'pellinor_gone' }, { notFlag: 'pellinor_fled' }],
    schedule: [
      { from: 0, zone: 'dungeons', at: 'pellinor_quarters', activity: 'sleep' },
      { from: 7, zone: 'hall', at: 'staff_4', activity: 'Завтрак' },
      { from: 9, zone: 'dungeons', at: 'potions_desk', activity: 'Урок зельеварения' },
      { from: 12, zone: 'hall', at: 'staff_4', activity: 'Обед' },
      { from: 13, zone: 'dungeons', at: 'potions_desk', activity: 'Урок зельеварения' },
      { from: 18, zone: 'village', at: 'inn_table', activity: 'Ужинает в «Дремлющем филине»' },
      { from: 21, zone: 'dungeons', at: 'storeroom_door', activity: '«Проверяет запасы»' },
    ],
    overrides: [
      { if: [{ flag: 'ally_pellinor' }, { flag: 'soren_challenge' }, { quest: 'mq_sanctum', is: 'active' }], schedule: [{ from: 0, zone: 'sanctum', at: 'ally_pellinor', activity: 'Варит зелья для вас' }] },
      { if: [{ flag: 'pellinor_spared' }], schedule: [{ from: 0, zone: 'hall', at: 'nurse_post', activity: 'Под присмотром сестры Мэйбел' }] },
    ],
    dialogues: [
      { if: [{ objActive: ['mq_suspicion', 'confront'] }], id: 'pellinor_confront', mark: true },
      { if: [{ flag: 'pellinor_spared' }], id: 'pellinor_spared' },
      { id: 'pellinor_main' },
    ],
    barks: ['Ах, юный алхимик! Котлы ждут!', 'Мята, мята, где моя мята…', 'Никогда не нюхайте то, что светится фиолетовым.'],
  },
  {
    id: 'lowe', name: 'Октавиан Лоу', title: 'Магистр магической теории', faction: 'academy', voice: 0.65,
    personality: 'Древний, рассеянный, засыпает посреди фразы, но помнит каждую дату за тысячу лет.',
    appearance: { skin: '#e8d4c0', hair: '#f0f0f0', hairStyle: 'bald', eyes: '#7a7a8a', robe: '#4a4a5a', trim: '#a8a8c0', beard: 'short', beardColor: '#f0f0f0', glasses: true, height: 0.94 },
    schedule: [
      { from: 0, zone: 'towers', at: 'staff_quarters', activity: 'sleep' },
      { from: 8, zone: 'hall', at: 'staff_1', activity: 'Завтрак' },
      { from: 9, zone: 'hall', at: 'theory_desk', activity: 'Урок теории' },
      { from: 12, zone: 'hall', at: 'staff_1', activity: 'Обед' },
      { from: 13, zone: 'hall', at: 'theory_desk', activity: 'Урок теории' },
      { from: 17, zone: 'library', at: 'reading_table', activity: 'Читает (или спит) в библиотеке' },
      { from: 21, zone: 'towers', at: 'staff_quarters', activity: 'sleep' },
    ],
    dialogues: [{ id: 'lowe_main' }],
    barks: ['В году семьсот двенадцатом… о чём это я…', 'Хррр… А? Я не сплю. Я размышляю.', 'Эфир — это не сила. Запишите.'],
  },
  {
    id: 'dorn', name: 'Дорн Хальвард', title: 'Капитан, наставник практической магии', faction: 'academy', voice: 0.85,
    personality: 'Бывший боевой маг пограничной стражи. Громкий, прямой, требовательный и заботливый.',
    appearance: { skin: '#c8987a', hair: '#7a7a7a', hairStyle: 'short', eyes: '#5a6a7a', robe: '#5a2a24', trim: '#b0b0b8', beard: 'short', beardColor: '#6a6a6a', build: 1.3, height: 1.06 },
    schedule: [
      { from: 0, zone: 'towers', at: 'staff_quarters', activity: 'sleep' },
      { from: 7, zone: 'hall', at: 'staff_1', activity: 'Завтрак' },
      { from: 8, zone: 'gates', at: 'practice_desk', activity: 'Тренировочное поле', wander: 2 },
      { from: 18, zone: 'village', at: 'inn_bar', activity: 'Кружка эля в таверне' },
      { from: 22, zone: 'towers', at: 'staff_quarters', activity: 'sleep' },
    ],
    dialogues: [
      { if: [{ quest: 'sq_dueling', is: 'none' }, { act: 2 }], id: 'dorn_dueling_offer', mark: true },
      { if: [{ quest: 'sq_flight', is: 'none' }, { act: 2 }, { quest: 'sq_dueling', is: 'started' }], id: 'dorn_flight_offer', mark: true },
      { id: 'dorn_main' },
    ],
    barks: ['Ноги! Работайте ногами!', 'Кто не уклоняется — тот лечится.', 'Щит поднимают ДО удара, а не после!'],
  },
  {
    id: 'foxglove', name: 'Ренна Фоксглов', title: 'Наставница магических существ', faction: 'forest', voice: 1.1,
    personality: 'Смешливая, бесстрашная, разговаривает с огоньками как с детьми.',
    appearance: { skin: '#f0c8a8', hair: '#b85a2a', hairStyle: 'curly', eyes: '#4a8a5a', robe: '#4a5a2a', trim: '#c8a050', scarf: '#c86a3a', height: 0.98 },
    schedule: [
      { from: 0, zone: 'towers', at: 'staff_quarters', activity: 'sleep' },
      { from: 8, zone: 'gates', at: 'creatures_desk', activity: 'Теплицы и загоны', wander: 2 },
      { from: 17, zone: 'forest', at: 'bran_hut', activity: 'В гостях у Брана', wander: 2 },
      { from: 21, zone: 'towers', at: 'staff_quarters', activity: 'sleep' },
    ],
    dialogues: [
      { if: [{ quest: 'sq_lake_spirits', is: 'none' }, { act: 3 }], id: 'foxglove_spirits', mark: true },
      { id: 'foxglove_main' },
    ],
    barks: ['Тише, тише, малыш…', 'Огоньки не кусаются. Ну, почти.', 'Кто-нибудь видел мою сову? Она опять ушла гулять.'],
  },
  {
    id: 'quill', name: 'Ода Квилл', title: 'Хранительница библиотеки', faction: 'academy', voice: 1.2,
    personality: 'Педантичная, подозрительная, бесконечно преданная книгам. Помнит каждого, кто загнул страницу.',
    appearance: { skin: '#eedad0', hair: '#e0dcd8', hairStyle: 'bun', eyes: '#5a4a6a', robe: '#4a2a5a', trim: '#b8a0d0', glasses: true, height: 0.96, build: 0.85 },
    schedule: [
      { from: 0, zone: 'library', at: 'quill_quarters', activity: 'sleep' },
      { from: 8, zone: 'library', at: 'librarian_desk', activity: 'Библиотека открыта' },
      { from: 21, zone: 'library', at: 'restricted_gate', activity: 'Стережёт запретную секцию' },
    ],
    dialogues: [
      { if: [{ flag: 'broke_into_restricted' }, { notFlag: 'quill_knows_breakin' }], id: 'quill_breakin', mark: true },
      { if: [{ quest: 'sq_lost_tomes', is: 'none' }], id: 'quill_tomes_offer', mark: true },
      { id: 'quill_main' },
    ],
    barks: ['Тише! Это библиотека, а не базар.', 'Руки чистые? Покажите.', 'Книги возвращают. Всегда. Без исключений.'],
  },
  {
    id: 'mabel', name: 'Сестра Мэйбел', title: 'Целительница лазарета', faction: 'academy', voice: 1.1,
    personality: 'Тёплая, ворчливая, лечит всех — и людей, и метлы, и поцарапанное самолюбие.',
    appearance: { skin: '#e8c0a0', hair: '#5a3a2a', hairStyle: 'bun', eyes: '#6a5a4a', robe: '#e0e4ec', trim: '#6a8ac8', hat: 'cap', build: 1.2, height: 0.95 },
    schedule: [{ from: 0, zone: 'hall', at: 'nurse_post', activity: 'Лазарет', wander: 1 }],
    dialogues: [
      { if: [{ objActive: ['mq_sleepwalker', 'mabel'] }], id: 'mabel_toby', mark: true },
      { id: 'mabel_main' },
    ],
    barks: ['Опять кто-то упал с лестницы?', 'Пейте, пейте. Невкусно — значит полезно.'],
  },
  {
    id: 'brassby', name: 'Бронзобокий', title: 'Механический приказчик каптёрки', faction: 'academy', voice: 1.4,
    personality: 'Заводной автомат времён Основателей. Говорит по уставу и обожает инвентаризацию.',
    appearance: { skin: '#b0884a', hair: '#7a5a2a', hairStyle: 'bald', eyes: '#6ad8ff', robe: '#6a4a2a', trim: '#e0b860', hat: 'cap', height: 0.92, build: 1.1 },
    schedule: [{ from: 0, zone: 'hall', at: 'shop_counter', activity: 'Каптёрка' }],
    dialogues: [{ id: 'brassby_main' }],
    barks: ['Опись. Учёт. Порядок.', 'Тик-так. Покупатель обнаружен.'],
  },
  {
    id: 'ulrich', name: 'Ульрих', title: 'Привратник и ночной страж', faction: 'academy', voice: 0.8,
    personality: 'Усатый ветеран, строгий к нарушителям, добрый к первокурсникам.',
    appearance: { skin: '#d0a080', hair: '#6a5a4a', hairStyle: 'short', eyes: '#4a4a4a', robe: '#3a4a5a', trim: '#a8a8a8', hat: 'cap', beard: 'short', beardColor: '#6a5a4a', build: 1.25, height: 1.04 },
    schedule: [
      { from: 6, zone: 'gates', at: 'gate_post', activity: 'Охраняет ворота', wander: 1 },
      { from: 22, zone: 'hall', at: 'corridor_w', activity: 'Ночной обход', wander: 5 },
    ],
    dialogues: [
      { if: [{ objActive: ['mq_arrival', 'letter'] }], id: 'ulrich_arrival', mark: true },
      { if: [{ objActive: ['sq_smuggler', 'return'] }], id: 'ulrich_smuggler' },
      { id: 'ulrich_main' },
    ],
    barks: ['Пропуск? Шучу. Проходи.', 'После десяти — по кроватям!', 'Тихая ночь. Слишком тихая.'],
  },
  {
    id: 'bran', name: 'Бран Тёрнвуд', title: 'Лесничий Академии', faction: 'forest', voice: 0.6,
    personality: 'Огромный, неуклюжий, нежный к любым созданиям. Плохо хранит секреты.',
    appearance: { skin: '#c89070', hair: '#3a2a1a', hairStyle: 'wild', eyes: '#3a2a1a', robe: '#5a4a32', trim: '#7a5a3a', beard: 'wild', beardColor: '#3a2a1a', build: 1.6, height: 1.32 },
    schedule: [
      { from: 0, zone: 'forest', at: 'bran_hut', activity: 'sleep' },
      { from: 7, zone: 'gates', at: 'garden', activity: 'Работает в саду', wander: 2 },
      { from: 12, zone: 'forest', at: 'bran_hut', activity: 'У своей хижины', wander: 2 },
      { from: 23, zone: 'forest', at: 'bran_hut', activity: 'sleep' },
    ],
    dialogues: [
      { if: [{ objActive: ['mq_sleepwalker', 'bran'] }], id: 'bran_forest', mark: true },
      { if: [{ quest: 'sq_bran_garden', is: 'none' }, { act: 2 }], id: 'bran_garden_offer', mark: true },
      { id: 'bran_main' },
    ],
    barks: ['Осторожней с грибами, они обидчивые.', 'Ух, ну и денёк!', 'Чайку? У меня всегда чайник на огне.'],
  },

  // ================= Ученики =================
  {
    id: 'mira', name: 'Мира Вэйл', title: 'Ученица Круга Звезды', circle: 'star', essential: true, voice: 1.2,
    personality: 'Умная, упрямая, всегда с книгой. Верит, что любую тайну можно разгадать, если читать достаточно внимательно.',
    appearance: { skin: '#f2d2bc', hair: '#8a5a32', hairStyle: 'curly', eyes: '#6a4a2a', robe: '#1e1a22', trim: '#e3c46b', height: 0.9 },
    schedule: studentDay('gh_seat_1', 'reading_table', 'library', 'corridor_w', 'hall', 'star_dorm'),
    overrides: [
      { if: [{ flag: 'mira_rescued' }, { notFlag: 'game_ended' }, { quest: 'mq_sanctum', is: 'active' }], schedule: [{ from: 0, zone: 'sanctum', at: 'mira_chains', activity: 'Рядом с вами' }] },
      { if: [{ objActive: ['mq_arrival', 'mira'] }], schedule: [{ from: 0, zone: 'gates', at: 'arrival_meet', activity: 'Ждёт у ворот' }] },
      { if: [{ objActive: ['mq_whispers', 'library'] }], schedule: [{ from: 0, zone: 'library', at: 'reading_table', activity: 'Ждёт вас в библиотеке' }] },
      { if: [{ objActive: ['rq_mira', 'stars'] }], schedule: [{ from: 0, zone: 'towers', at: 'common_room', activity: 'Гостиная' }, { from: 20, zone: 'towers', at: 'balcony', activity: 'Смотрит на звёзды' }, { from: 24, zone: 'towers', at: 'star_dorm', activity: 'sleep' }] },
      { if: [{ flag: 'mira_taken' }, { notFlag: 'mira_rescued' }], schedule: [{ from: 0, zone: 'sanctum', at: 'mira_chains', activity: 'В плену' }] },
    ],
    dialogues: [
      { if: [{ objActive: ['mq_arrival', 'mira'] }], id: 'mira_arrival', mark: true },
      { if: [{ objActive: ['mq_whispers', 'library'] }], id: 'mira_library', mark: true },
      { if: [{ objActive: ['mq_glitches', 'mira'] }, { item: 'rune_fragment', count: 3 }], id: 'mira_fragments', mark: true },
      { if: [{ objActive: ['mq_restricted', 'mira'] }], id: 'mira_restricted', mark: true },
      { if: [{ objActive: ['mq_restricted', 'decode'] }], id: 'mira_decode', mark: true },
      { if: [{ objActive: ['mq_restricted', 'reveal'] }], id: 'mira_seals', mark: true },
      { if: [{ objActive: ['mq_suspicion', 'mira'] }], id: 'mira_suspicion', mark: true },
      { if: [{ objActive: ['rq_mira', 'stars'] }, { hour: [20, 24] }], id: 'mira_stars', mark: true },
      { if: [{ quest: 'rq_mira', is: 'none' }, { act: 2 }, { rel: 'mira', gte: 20 }], id: 'mira_stars_offer', mark: true },
      { if: [{ flag: 'mira_taken' }, { notFlag: 'mira_rescued' }], id: 'mira_captive' },
      { id: 'mira_main' },
    ],
    barks: ['В книге сказано иначе…', 'Ты читал(а) «Хронику Основателей»? Ах да, её никто не читал.', 'Не отставай!'],
  },
  {
    id: 'toby', name: 'Тоби Ренвик', title: 'Ученик Круга Пламени', circle: 'flame', voice: 1.0,
    personality: 'Рыжий, веснушчатый, вечно всё роняет. Самый верный друг, какого только можно пожелать.',
    appearance: { skin: '#f4d0b8', hair: '#c8501e', hairStyle: 'short', eyes: '#4a6a8a', robe: '#1e1a22', trim: '#d9a441', height: 0.92 },
    schedule: studentDay('gh_seat_4', 'courtyard_bench', 'gates', 'fountain_side', 'gates', 'flame_dorm'),
    overrides: [
      { if: [{ objActive: ['mq_sleepwalker', 'find'] }], schedule: [
        { from: 0, zone: 'hall', at: 'corridor_w', activity: 'Бродит во сне' }, { from: 4, zone: 'towers', at: 'flame_dorm', activity: 'sleep' },
        { from: 7, zone: 'hall', at: 'gh_seat_4', activity: 'Завтрак' }, { from: 9, zone: 'gates', at: 'courtyard_bench', activity: 'Сонный' },
        { from: 21, zone: 'hall', at: 'corridor_w', activity: 'Бродит во сне' }] },
      { if: [{ flag: 'toby_sick' }, { notFlag: 'toby_cured' }], schedule: [{ from: 0, zone: 'hall', at: 'nurse_post', activity: 'Спит в лазарете — не просыпается' }] },
    ],
    dialogues: [
      { if: [{ objActive: ['mq_sleepwalker', 'find'] }, { hour: [21, 4] }], id: 'toby_sleepwalk', mark: true },
      { if: [{ objActive: ['mq_sleepwalker', 'cure'] }], id: 'toby_cure', mark: true },
      { if: [{ flag: 'toby_sick' }, { notFlag: 'toby_cured' }], id: 'toby_asleep' },
      { if: [{ quest: 'sq_toby_charm', is: 'none' }], id: 'toby_charm_offer', mark: true },
      { if: [{ quest: 'sq_letter', is: 'none' }, { act: 2 }, { quest: 'sq_toby_charm', is: 'done' }], id: 'toby_letter_offer', mark: true },
      { id: 'toby_main' },
    ],
    barks: ['Ой! Это не я. Оно само упало.', 'Ты не видел(а) мою сову? Деревянную такую…', 'Сегодня на ужин пирог! Наверное!'],
  },
  {
    id: 'cassian', name: 'Кассиан Морвель', title: 'Ученик Круга Бастиона', circle: 'bastion', voice: 0.95,
    personality: 'Высокомерный наследник древнего рода. Колючий снаружи, растерянный внутри.',
    appearance: { skin: '#f2e0d4', hair: '#e8e0c8', hairStyle: 'short', eyes: '#6a8aa8', robe: '#1e1a22', trim: '#c9d3dc', height: 0.95, build: 0.9 },
    presentIf: [{ notFlag: 'cassian_left' }],
    schedule: studentDay('gh_seat_2', 'corridor_e', 'hall', 'arrival_meet', 'gates', 'bastion_dorm'),
    overrides: [
      { if: [{ flag: 'ally_cassian' }, { flag: 'soren_challenge' }, { quest: 'mq_sanctum', is: 'active' }], schedule: [{ from: 0, zone: 'sanctum', at: 'ally_cassian', activity: 'Сражается рядом' }] },
      { if: [{ objActive: ['mq_arrival', 'mira'] }], schedule: [{ from: 0, zone: 'gates', at: 'gate_post', activity: 'Скучает у ворот' }] },
      { if: [{ objActive: ['mq_night_of_ash', 'cassian'] }], schedule: [{ from: 0, zone: 'gates', at: 'fountain_side', activity: 'Стоит у фонтана' }] },
    ],
    dialogues: [
      { if: [{ objActive: ['mq_night_of_ash', 'cassian'] }], id: 'cassian_choice', mark: true },
      { if: [{ objActive: ['rq_cassian', 'return'] }, { item: 'cassian_locket' }], id: 'cassian_locket', mark: true },
      { if: [{ quest: 'rq_cassian', is: 'none' }, { act: 2 }, { rel: 'cassian', gte: 0 }], id: 'cassian_shadow_offer', mark: true },
      { id: 'cassian_main' },
    ],
    barks: ['Посторонись.', 'Мой прадед основал половину этой школы. Ну, четверть.', 'Хм. Неплохо. Для новичка.'],
  },
  {
    id: 'elodie', name: 'Элоди Сартр', title: 'Ученица Круга Корня', circle: 'root', voice: 1.25,
    personality: 'Знает все сплетни Академии и все травы в теплицах.',
    appearance: { skin: '#c8906a', hair: '#1a1210', hairStyle: 'tied', eyes: '#3a2a1a', robe: '#1e1a22', trim: '#d6b25e', height: 0.9 },
    schedule: studentDay('gh_seat_3', 'garden', 'gates', 'creatures_desk', 'gates', 'root_dorm'),
    dialogues: [{ id: 'elodie_main' }],
    barks: ['Слышал(а)? Говорят, в подземельях кто-то плачет по ночам.', 'Мята для памяти, полынь — от сглаза.'],
  },
  {
    id: 'nico', name: 'Нико Фэй', title: 'Ученик Круга Пламени', circle: 'flame', voice: 1.05,
    personality: 'Шутник и авантюрист. Знает тайные ходы — и как пройти мимо стражи.',
    appearance: { skin: '#a87050', hair: '#2a1a10', hairStyle: 'curly', eyes: '#2a1a10', robe: '#1e1a22', trim: '#d9a441', height: 0.93 },
    schedule: studentDay('gh_seat_4', 'corridor_w', 'hall', 'courtyard_bench', 'gates', 'flame_dorm'),
    dialogues: [
      { if: [{ objActive: ['mq_suspicion', 'storeroom'] }, { notFlag: 'nico_key_given' }], id: 'nico_key', mark: true },
      { id: 'nico_main' },
    ],
    barks: ['Пс-с. Хочешь узнать секрет?', 'Если что — меня тут не было.'],
  },
  {
    id: 'agatha', name: 'Агата Блэквуд', title: 'Староста Круга Бастиона', circle: 'bastion', voice: 1.1,
    personality: 'Правильная до зубовного скрежета. Ведёт счёт нарушениям.',
    appearance: { skin: '#f0d8c8', hair: '#2a2028', hairStyle: 'long', eyes: '#4a3a5a', robe: '#1e1a22', trim: '#c9d3dc', glasses: true, height: 0.94 },
    schedule: studentDay('gh_seat_2', 'corridor_e', 'hall', 'reading_table', 'library', 'bastion_dorm'),
    dialogues: [
      { if: [{ flag: 'event_argument' }], id: 'ev_argument', mark: true },
      { id: 'agatha_main' },
    ],
    barks: ['Минус пять очков. Мысленно.', 'Галстук завязан неправильно.'],
  },
  {
    id: 'ren', name: 'Рен Тальво', title: 'Ученик Круга Звезды', circle: 'star', voice: 0.95,
    personality: 'Тихий звездочёт. Говорит редко, но точно.',
    appearance: { skin: '#e8c8a8', hair: '#4a5a6a', hairStyle: 'long', eyes: '#6a7a9a', robe: '#1e1a22', trim: '#e3c46b', height: 0.96 },
    schedule: studentDay('gh_seat_1', 'reading_table', 'library', 'balcony', 'towers', 'star_dorm'),
    dialogues: [{ id: 'ren_main' }],
    barks: ['Сегодня Северная Корона особенно ясна.', '…'],
  },

  // ================= Ольховый Брод =================
  {
    id: 'tilda', name: 'Тильда Брюн', title: 'Хозяйка лавки «Котёл и Ключ»', faction: 'village', voice: 1.15,
    personality: 'Острая на язык травница. Торгуется до последней кроны.',
    appearance: { skin: '#e0b090', hair: '#6a4a3a', hairStyle: 'tied', eyes: '#4a6a4a', robe: '#4a5a3a', trim: '#a8c070', scarf: '#8a3a4a', height: 0.95 },
    schedule: [
      { from: 0, zone: 'village', at: 'tilda_home', activity: 'sleep' },
      { from: 8, zone: 'village', at: 'alchemist_counter', activity: 'Лавка открыта' },
      { from: 20, zone: 'village', at: 'inn_table', activity: 'В таверне' },
      { from: 23, zone: 'village', at: 'tilda_home', activity: 'sleep' },
    ],
    dialogues: [{ id: 'tilda_main' }],
    barks: ['Свежая мята! Почти свежая!', 'Студентам скидка. Маленькая. Очень.'],
  },
  {
    id: 'goran', name: 'Горан Медвяк', title: 'Артефактор и кузнец', faction: 'village', voice: 0.7,
    personality: 'Немногословный мастер. Уважает тех, кто бережёт инструмент.',
    appearance: { skin: '#c08868', hair: '#2a2a2a', hairStyle: 'short', eyes: '#3a3a3a', robe: '#3a2a22', trim: '#a87a3a', beard: 'long', beardColor: '#3a3a3a', build: 1.45, height: 1.05 },
    schedule: [
      { from: 0, zone: 'village', at: 'goran_home', activity: 'sleep' },
      { from: 7, zone: 'village', at: 'smithy', activity: 'Кузница', wander: 1 },
      { from: 19, zone: 'village', at: 'inn_bar', activity: 'В таверне' },
      { from: 22, zone: 'village', at: 'goran_home', activity: 'sleep' },
    ],
    dialogues: [
      { if: [{ objActive: ['sq_smuggler', 'return'] }], id: 'goran_smuggler', mark: true },
      { if: [{ quest: 'sq_smuggler', is: 'none' }, { act: 2 }], id: 'goran_smuggler_offer', mark: true },
      { id: 'goran_main' },
    ],
    barks: ['Хорошая сталь не торопится.', 'Хм.'],
  },
  {
    id: 'martha', name: 'Марта Хоуп', title: 'Хозяйка таверны «Дремлющий филин»', faction: 'village', voice: 1.05,
    personality: 'Добрая, громкая, кормит всех. Тётушка Тоби.',
    appearance: { skin: '#f0c0a0', hair: '#c86a3a', hairStyle: 'bun', eyes: '#4a6a8a', robe: '#8a3a2a', trim: '#e8d8b0', build: 1.3, height: 0.96 },
    schedule: [{ from: 0, zone: 'village', at: 'inn_counter', activity: 'Таверна', wander: 1 }],
    dialogues: [
      { if: [{ objActive: ['sq_letter', 'deliver'] }], id: 'martha_letter', mark: true },
      { id: 'martha_main' },
    ],
    barks: ['Садись, садись, голодный небось!', 'Суп дня — грибной. Вчерашний тоже грибной.'],
  },
  {
    id: 'ivar', name: 'Старейшина Ивар', title: 'Голова Ольхового Брода', faction: 'village', voice: 0.65,
    personality: 'Осторожный, помнит старые времена, не доверяет «замковым».',
    appearance: { skin: '#d8b090', hair: '#c8c8c8', hairStyle: 'short', eyes: '#5a5a5a', robe: '#4a3a2a', trim: '#8a7a5a', beard: 'long', beardColor: '#d0d0d0', height: 0.98 },
    schedule: [
      { from: 0, zone: 'village', at: 'elder_home', activity: 'sleep' },
      { from: 8, zone: 'village', at: 'square', activity: 'На площади', wander: 2 },
      { from: 18, zone: 'village', at: 'elder_home', activity: 'Дома' },
    ],
    dialogues: [
      { if: [{ objActive: ['mq_village', 'ivar'] }], id: 'ivar_lights', mark: true },
      { id: 'ivar_main' },
    ],
    barks: ['Ох, замковые… Опять что-то ищете?', 'Ночами над холмом огни. Нехорошие огни.'],
  },
  {
    id: 'fin', name: 'Фин', title: 'Сын пекаря', faction: 'village', voice: 1.5,
    personality: 'Восьмилетний сорванец, мечтает о магии.',
    appearance: { skin: '#f0c8a8', hair: '#d8a050', hairStyle: 'wild', eyes: '#4a8aa8', robe: '#6a7a4a', trim: '#c8a870', height: 0.68 },
    schedule: [
      { from: 0, zone: 'village', at: 'bakery', activity: 'sleep' },
      { from: 8, zone: 'village', at: 'square', activity: 'Играет', wander: 3 },
      { from: 20, zone: 'village', at: 'bakery', activity: 'Дома' },
    ],
    dialogues: [
      { if: [{ objActive: ['sq_kitten', 'return'] }, { item: 'lost_kitten' }], id: 'fin_kitten_return', mark: true },
      { if: [{ quest: 'sq_kitten', is: 'none' }], id: 'fin_kitten', mark: true },
      { id: 'fin_main' },
    ],
    barks: ['Покажи заклинание! Ну покажи!', 'Когда вырасту — буду боевым магом!'],
  },
  {
    id: 'olm', name: 'Старый Ольм', title: 'Рыбак с Зеркального озера', faction: 'village', voice: 0.6,
    personality: 'Молчаливый старик, знает озеро и его призраков.',
    appearance: { skin: '#c89878', hair: '#9a9a9a', hairStyle: 'wild', eyes: '#5a6a7a', robe: '#3a4a5a', trim: '#6a7a6a', hat: 'cap', beard: 'wild', beardColor: '#a0a0a0', height: 0.97 },
    schedule: [{ from: 0, zone: 'lake', at: 'olm_pier', activity: 'Рыбачит', wander: 1 }],
    dialogues: [
      { if: [{ objActive: ['sq_lake_spirits', 'olm'] }], id: 'olm_spirits', mark: true },
      { id: 'olm_main' },
    ],
    barks: ['Клюёт… Не клюёт.', 'Духи сегодня беспокойные.'],
  },
  {
    id: 'zane', name: 'Зейн', title: 'Странствующий торговец', voice: 0.9,
    personality: 'Обаятельный проходимец с повозкой редкостей. Не задаёт вопросов — и вам не советует.',
    appearance: { skin: '#b07850', hair: '#1a1a1a', hairStyle: 'tied', eyes: '#c8a050', robe: '#5a2a5a', trim: '#e0b040', hat: 'pointed', scarf: '#c8a040', height: 1.0 },
    presentIf: [{ any: [{ weekday: [5, 6] }, { flag: 'event_zane' }] }],
    schedule: [
      { from: 0, zone: 'village', at: 'wagon', activity: 'Спит в повозке' },
      { from: 9, zone: 'village', at: 'wagon', activity: 'Торгует' },
    ],
    overrides: [{ if: [{ flag: 'event_zane' }], schedule: [{ from: 0, zone: 'gates', at: 'courtyard_bench', activity: 'Заглянул в Академию' }] }],
    dialogues: [
      { if: [{ objActive: ['sq_smuggler', 'return'] }, { item: 'smuggled_crate' }], id: 'zane_smuggler' },
      { id: 'zane_main' },
    ],
    barks: ['Редкости! Диковины! Почти не краденые!', 'Для тебя, друг, особая цена.'],
  },

  // ================= Сюжетные =================
  {
    id: 'elias', name: 'Архивариус Элиас', title: 'Призрак Первой Академии', voice: 0.55,
    personality: 'Учёный, переживший собственную смерть. Говорит медленно и очень точно.',
    appearance: { skin: '#a8d8e8', hair: '#c8e8f0', hairStyle: 'long', eyes: '#e8ffff', robe: '#6a9aa8', trim: '#c8f0ff', beard: 'long', beardColor: '#c8e8f0', height: 1.02, build: 0.85 },
    schedule: [{ from: 0, zone: 'ruins', at: 'archive', activity: 'Среди своих книг', wander: 1 }],
    dialogues: [
      { if: [{ objActive: ['rq_corvin', 'deliver'] }, { notFlag: 'elias_answered' }], id: 'elias_corvin', mark: true },
      { if: [{ quest: 'sq_elias', is: 'none' }], id: 'elias_first', mark: true },
      { if: [{ objActive: ['sq_elias', 'return'] }], id: 'elias_pages', mark: true },
      { id: 'elias_main' },
    ],
    barks: ['Тысяча лет. А пыль всё та же.', 'Вы пришли за правдой? Она тяжелее, чем кажется.'],
  },
  {
    id: 'yalla', name: 'Отшельница Ялла', title: 'Травница Шепчущего леса', faction: 'forest', voice: 0.9,
    personality: 'Знает лес, как свою ладонь. Для найдёныша — почти мать.',
    appearance: { skin: '#b88a6a', hair: '#d0c8b8', hairStyle: 'wild', eyes: '#6a8a4a', robe: '#3a4a2a', trim: '#8a7a4a', hat: 'hood', height: 0.94 },
    schedule: [{ from: 0, zone: 'forest', at: 'yalla_grove', activity: 'Собирает травы', wander: 2 }],
    dialogues: [{ id: 'yalla_main' }],
    barks: ['Лес помнит тебя.', 'Не рви то, что можно попросить.'],
  },
  {
    id: 'soren', name: 'Сорен Мальграв', title: 'Глава Ордена Пепла', voice: 0.75,
    personality: 'Блестящий, холодный, уверенный, что магия должна принадлежать сильным.',
    appearance: { skin: '#c8b8b0', hair: '#2a2424', hairStyle: 'short', eyes: '#e05a2a', robe: '#1a1418', trim: '#e05a2a', hat: 'hood', height: 1.08 },
    presentIf: [{ flag: 'soren_visible' }],
    schedule: [{ from: 0, zone: 'forest', at: 'seal_root', activity: 'Ритуал' }],
    dialogues: [{ id: 'soren_forest' }],
    barks: ['Пепел помнит огонь.'],
  },
];

export const NPCS: Record<string, NpcDef> = Object.fromEntries(list.map((n) => [n.id, n]));

// Голоса, которые говорят в диалогах, но не ходят по миру.
export const VOICES: Record<string, { name: string; title: string }> = {
  hollow: { name: 'Голос из-под камня', title: '' },
  mirror: { name: 'Зеркало Кругов', title: '' },
  lake_queen: { name: 'Владычица озера', title: 'Дух Зеркального озера' },
  narrator: { name: '', title: '' },
};
