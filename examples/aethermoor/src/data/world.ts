// Мир Этермура: Круги, происхождения, фракции, предметы обучения, магазины, рецепты, достижения, хроника.
import type { CircleId, Effect, FactionId, OriginId, Rarity, StatId, SubjectId, ZoneId } from './types';

export const CIRCLES: Record<CircleId, {
  name: string; short: string; spec: string; color: string; trim: string; desc: string;
  bonus: Partial<Record<StatId, number>>; spell: string; passive: string; motto: string;
}> = {
  flame: {
    name: 'Круг Пламени', short: 'Пламя', spec: 'Боевая магия', color: '#8f2a2a', trim: '#d9a441',
    desc: 'Дуэлянты и боевые маги. Учат, что сила без дисциплины — лишь пожар.',
    bonus: { power: 2 }, spell: 'flame', passive: '+10% урона атакующих заклинаний', motto: '«Гори ярко — но не дотла»',
  },
  bastion: {
    name: 'Круг Бастиона', short: 'Бастион', spec: 'Защитная магия', color: '#2d4a6b', trim: '#c9d3dc',
    desc: 'Стражи и щитоносцы. Их барьеры держали стены Академии тысячу лет.',
    bonus: { defense: 2 }, spell: 'ward', passive: 'Щит поглощает на 25% больше урона', motto: '«Стой, где другие падают»',
  },
  root: {
    name: 'Круг Корня', short: 'Корень', spec: 'Целительство и природа', color: '#2f5a3a', trim: '#d6b25e',
    desc: 'Целители, травники и друзья лесных созданий. Терпеливы, как старые дубы.',
    bonus: { defense: 1, int: 1 }, spell: 'mend', passive: 'Зелья лечат на 30% сильнее, травы собираются вдвое',
    motto: '«Всё растёт из тишины»',
  },
  star: {
    name: 'Круг Звезды', short: 'Звезда', spec: 'Тайные искусства и руны', color: '#3d2d6b', trim: '#e3c46b',
    desc: 'Рунисты, астрономы и исследователи тайн. Видят узор там, где другие видят хаос.',
    bonus: { int: 2 }, spell: 'reveal', passive: '+20% маны, руны поддаются легче', motto: '«Смотри дальше света»',
  },
};

export const ORIGINS: Record<OriginId, { name: string; desc: string; bonus: Partial<Record<StatId, number>>; perk: string }> = {
  guild: {
    name: 'Дитя гильдии', desc: 'Вы выросли среди купцов портового Сольгарда. Цены, договоры и люди для вас — открытая книга.',
    bonus: { int: 1 }, perk: 'Больше стартовых крон, скидка 15% у торговцев',
  },
  bloodline: {
    name: 'Наследник древнего рода', desc: 'Ваш род упоминается в хрониках Основателей. От вас многого ждут — и многое прощают.',
    bonus: { power: 1 }, perk: 'Старые семьи знают вашу фамилию; особые реплики в диалогах',
  },
  common: {
    name: 'Из простых', desc: 'Сын или дочь мельника из долины. Вы привыкли к труду, а магия проснулась в вас внезапно.',
    bonus: { defense: 1, speed: 1 }, perk: 'Жители Ольхового Брода относятся к вам теплее',
  },
  foundling: {
    name: 'Найдёныш', desc: 'Вас нашли младенцем у корней Шепчущего леса. Отшельница вырастила вас среди трав и сов.',
    bonus: { int: 1, speed: 1 }, perk: 'Лесные создания реже нападают; знание трав',
  },
};

export const FACTIONS: Record<FactionId, { name: string; desc: string; color: string }> = {
  academy: { name: 'Преподаватели Академии', desc: 'Доверие наставников открывает доступ к закрытым залам и особым урокам.', color: '#e3c46b' },
  circle: { name: 'Ваш Круг', desc: 'Уважение товарищей по Кругу и очки в Кубке Кругов.', color: '#c08a4a' },
  village: { name: 'Ольховый Брод', desc: 'Жители деревни. Влияют на цены и просьбы о помощи.', color: '#9bbf6a' },
  forest: { name: 'Хранители Леса', desc: 'Лесные создания и их друзья. Определяют, насколько опасен лес.', color: '#5fae8a' },
  ash: { name: 'Орден Пепла', desc: 'Тайное общество, жаждущее силы Сердца Эфира.', color: '#a34a4a' },
};

export const STAT_NAMES: Record<StatId, string> = { int: 'Интеллект', power: 'Сила магии', defense: 'Защита', speed: 'Скорость' };
export const STAT_DESC: Record<StatId, string> = {
  int: 'Запас маны, критический шанс, проверки в диалогах и урокам теории.',
  power: 'Урон и сила всех заклинаний.',
  defense: 'Здоровье и снижение получаемого урона.',
  speed: 'Скорость передвижения и восстановления заклинаний.',
};

export const RARITY: Record<Rarity, { name: string; color: string }> = {
  common: { name: 'Обычный', color: '#c9c2b4' },
  uncommon: { name: 'Необычный', color: '#7fc77a' },
  rare: { name: 'Редкий', color: '#6aa8e8' },
  epic: { name: 'Эпический', color: '#b77ce8' },
  legendary: { name: 'Легендарный', color: '#f0b24a' },
};

export const WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
export const WEEKDAYS_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
export const MONTHS = ['Листопада', 'Студня', 'Снеженя', 'Лютеня'];

export const SUBJECTS: Record<SubjectId, {
  name: string; teacher: string; zone: ZoneId; room: string; anchor: string; minigame: 'quiz' | 'brew' | 'duel' | 'glyph' | 'runes' | 'creature' | 'arena';
  desc: string; days: number[]; lessons: { title: string; text: string; reward?: Effect[] }[]; exam: { title: string; reward: Effect[] };
}> = {
  theory: {
    name: 'Магическая теория', teacher: 'lowe', zone: 'hall', room: 'Аудитория теории', anchor: 'theory_desk', minigame: 'quiz',
    desc: 'Природа Эфира, законы заклинаний, история Основателей.', days: [0, 2, 4],
    lessons: [
      { title: 'Природа Эфира', text: 'Эфир — это не сила, а связь. Заклинание лишь просит мир о том, что он и так может.', reward: [{ learnSpell: 'light' }] },
      { title: 'Четыре Основателя', text: 'Пламя, Бастион, Корень и Звезда — четыре грани одного кристалла.', reward: [{ lore: 'founders' }] },
      { title: 'Резонанс', text: 'Два заклинания, наложенные друг на друга, порождают третье. Мы зовём это резонансом.', reward: [{ setFlag: 'knows_combos' }] },
    ],
    exam: { title: 'Экзамен по теории', reward: [{ stat: 'int', delta: 1 }] },
  },
  potions: {
    name: 'Зельеварение', teacher: 'pellinor', zone: 'dungeons', room: 'Алхимическая лаборатория', anchor: 'potions_desk', minigame: 'brew',
    desc: 'Травы, минералы и терпение. Котёл не прощает спешки.', days: [0, 1, 3],
    lessons: [
      { title: 'Целебный отвар', text: 'Порядок важнее состава: сначала основа, потом жар, потом лепестки.', reward: [{ learnRecipe: 'healing' }] },
      { title: 'Эликсир ясности', text: 'Мана — как вода в колодце. Иногда нужно помочь ей подняться.', reward: [{ learnRecipe: 'mana' }] },
      { title: 'Отвар каменной кожи', text: 'Железняк и терпение — лучшая броня.', reward: [{ learnRecipe: 'stoneskin' }] },
    ],
    exam: { title: 'Экзамен по зельеварению', reward: [{ learnRecipe: 'elixir_power' }] },
  },
  defense: {
    name: 'Защитная магия', teacher: 'corvin', zone: 'hall', room: 'Дуэльный зал', anchor: 'duel_desk', minigame: 'duel',
    desc: 'Щиты, контрзаклинания и искусство дуэли.', days: [1, 3, 4],
    lessons: [
      { title: 'Ритм дуэли', text: 'Не отвечай на удар раньше, чем он начат. Не опаздывай после.', reward: [{ stat: 'defense', delta: 1 }] },
      { title: 'Отражение', text: 'Идеальный щит не держит удар. Он возвращает его.', reward: [{ setFlag: 'knows_parry' }] },
      { title: 'Оковы', text: 'Иногда лучшая защита — лишить противника шага.', reward: [{ learnSpell: 'bind' }] },
    ],
    exam: { title: 'Экзаменационная дуэль', reward: [{ learnSpell: 'storm' }] },
  },
  transfig: {
    name: 'Трансформация', teacher: 'gravane', zone: 'hall', room: 'Класс трансформации', anchor: 'transfig_desk', minigame: 'glyph',
    desc: 'Изменение сути вещей. Самый строгий предмет Академии.', days: [0, 1, 4],
    lessons: [
      { title: 'Глифы формы', text: 'Каждая вещь помнит свою форму. Глиф лишь напоминает ей другую.', reward: [{ learnSpell: 'unlock' }] },
      { title: 'Вода и лёд', text: 'Холод — это неподвижность. Остановите воду — и она станет мостом.', reward: [{ learnSpell: 'frost' }] },
      { title: 'Сложные глифы', text: 'Чем сложнее глиф, тем тише должен быть ум.', reward: [{ stat: 'int', delta: 1 }] },
    ],
    exam: { title: 'Экзамен по трансформации', reward: [{ give: 'gravane_brooch' }] },
  },
  runes: {
    name: 'Древние руны', teacher: 'corvin', zone: 'towers', room: 'Руническая башня', anchor: 'runes_desk', minigame: 'runes',
    desc: 'Язык Основателей: печати, замки и сигилы силы.', days: [1, 2, 3],
    lessons: [
      { title: 'Линии силы', text: 'Руна — это русло. Эфир течёт туда, куда вы его направите.', reward: [{ learnSpell: 'reveal' }] },
      { title: 'Печати', text: 'Печать не запирает. Она убеждает дверь, что она — стена.', reward: [{ lore: 'seals' }] },
      { title: 'Резонансные узлы', text: 'Соедините все узлы — и камень запоёт.', reward: [{ stat: 'power', delta: 1 }] },
    ],
    exam: { title: 'Экзамен по рунам', reward: [{ give: 'rune_ring' }] },
  },
  creatures: {
    name: 'Магические существа', teacher: 'foxglove', zone: 'gates', room: 'Загоны у теплиц', anchor: 'creatures_desk', minigame: 'creature',
    desc: 'Как понять существо, которое думает песнями.', days: [2, 3, 4],
    lessons: [
      { title: 'Песня светлячков', text: 'Огоньки отвечают на мелодию. Повторите её — и они успокоятся.', reward: [{ learnSpell: 'whisper' }] },
      { title: 'Гончие тени', text: 'Тень боится не света, а огня, который помнит солнце.', reward: [{ rep: 'forest', delta: 10 }] },
      { title: 'Старшие создания', text: 'Древние существа помнят Основателей. Говорите с ними уважительно.', reward: [{ stat: 'int', delta: 1 }] },
    ],
    exam: { title: 'Экзамен по существам', reward: [{ give: 'feather_charm' }] },
  },
  practical: {
    name: 'Практическая магия', teacher: 'dorn', zone: 'gates', room: 'Тренировочное поле', anchor: 'practice_desk', minigame: 'arena',
    desc: 'Магия в движении: меткость, уклонение, выносливость.', days: [0, 1, 2, 3, 4],
    lessons: [
      { title: 'Искра и щит', text: 'Целься, стреляй, уходи с линии удара.', reward: [{ learnSpell: 'spark' }, { learnSpell: 'ward' }] },
      { title: 'Порыв', text: 'Воздух — самый честный союзник. Он толкает всех одинаково.', reward: [{ learnSpell: 'gust' }] },
      { title: 'Пламя', text: 'Огонь — это обещание. Не давай его тому, кого не готов сжечь.', reward: [{ learnSpell: 'flame' }] },
    ],
    exam: { title: 'Испытание на поле', reward: [{ learnSpell: 'blink' }] },
  },
};

export interface RecipeDef {
  id: string; name: string; station: 'alchemy' | 'artifice'; result: string; count: number;
  ingredients: { id: string; count: number }[];
  steps?: ('add' | 'stir' | 'heat')[];
  desc: string;
}

export const RECIPES: Record<string, RecipeDef> = {
  healing: { id: 'healing', name: 'Целебный отвар', station: 'alchemy', result: 'potion_heal', count: 2,
    ingredients: [{ id: 'sunleaf', count: 2 }, { id: 'spring_water', count: 1 }], desc: 'Восстанавливает здоровье.' },
  mana: { id: 'mana', name: 'Эликсир ясности', station: 'alchemy', result: 'potion_mana', count: 2,
    ingredients: [{ id: 'moonpetal', count: 1 }, { id: 'aether_quartz', count: 1 }], desc: 'Восстанавливает ману.' },
  stoneskin: { id: 'stoneskin', name: 'Отвар каменной кожи', station: 'alchemy', result: 'potion_stone', count: 1,
    ingredients: [{ id: 'ironstone', count: 2 }, { id: 'marsh_mint', count: 1 }], desc: 'Временно повышает защиту.' },
  elixir_power: { id: 'elixir_power', name: 'Эликсир пламени духа', station: 'alchemy', result: 'potion_power', count: 1,
    ingredients: [{ id: 'ember_cap', count: 2 }, { id: 'star_dust', count: 1 }], desc: 'Временно усиливает заклинания.' },
  awakening: { id: 'awakening', name: 'Пробуждающее зелье', station: 'alchemy', result: 'potion_awaken', count: 1,
    ingredients: [{ id: 'moonpetal', count: 2 }, { id: 'sunleaf', count: 1 }, { id: 'spring_water', count: 1 }], desc: 'Снимает чары сна. Нужно для Тоби.' },
  greater_heal: { id: 'greater_heal', name: 'Большой целебный эликсир', station: 'alchemy', result: 'potion_heal_big', count: 1,
    ingredients: [{ id: 'potion_heal', count: 2 }, { id: 'lake_tear', count: 1 }], desc: 'Мощное лечение.' },
  antidote: { id: 'antidote', name: 'Противоядие от пепла', station: 'alchemy', result: 'ash_antidote', count: 1,
    ingredients: [{ id: 'ash_poppy', count: 1 }, { id: 'moonpetal', count: 1 }, { id: 'lake_tear', count: 1 }], desc: 'Нейтрализует пепельный настой.' },
  focus_ring: { id: 'focus_ring', name: 'Кольцо фокуса', station: 'artifice', result: 'focus_ring', count: 1,
    ingredients: [{ id: 'aether_quartz', count: 2 }, { id: 'ironstone', count: 1 }], desc: 'Кольцо, ускоряющее восстановление маны.' },
  ward_amulet: { id: 'ward_amulet', name: 'Амулет оберега', station: 'artifice', result: 'ward_amulet', count: 1,
    ingredients: [{ id: 'ironstone', count: 2 }, { id: 'spider_silk', count: 2 }], desc: 'Повышает защиту.' },
  wand_core: { id: 'wand_core', name: 'Грозовая сердцевина', station: 'artifice', result: 'storm_wand', count: 1,
    ingredients: [{ id: 'storm_feather', count: 1 }, { id: 'aether_quartz', count: 2 }, { id: 'oak_branch', count: 1 }], desc: 'Жезл с сердцевиной из пера грозовой птицы.' },
  shadow_lantern: { id: 'shadow_lantern', name: 'Фонарь теней', station: 'artifice', result: 'shadow_lantern', count: 1,
    ingredients: [{ id: 'shade_essence', count: 3 }, { id: 'aether_quartz', count: 1 }], desc: 'Талисман, усиливающий световую магию.' },
  silk_robe: { id: 'silk_robe', name: 'Мантия из паучьего шёлка', station: 'artifice', result: 'silk_robe', count: 1,
    ingredients: [{ id: 'spider_silk', count: 4 }, { id: 'moonpetal', count: 1 }], desc: 'Лёгкая и прочная мантия.' },
};

export const SHOPS: Record<string, { name: string; owner: string; stock: string[]; buys: string[]; mood: string }> = {
  quartermaster: {
    name: 'Каптёрка Академии', owner: 'brassby', mood: 'Всё по уставу. Всё по описи.',
    stock: ['potion_heal', 'potion_mana', 'spring_water', 'sunleaf', 'student_robe', 'apprentice_wand', 'study_notes', 'candle_charm'],
    buys: ['ingredient', 'collectible', 'potion', 'clothing', 'weapon', 'accessory', 'magic'],
  },
  alchemist: {
    name: '«Котёл и Ключ»', owner: 'tilda', mood: 'Пахнет мятой, серой и чем-то запретным.',
    stock: ['potion_heal', 'potion_mana', 'potion_stone', 'moonpetal', 'marsh_mint', 'ember_cap', 'spring_water', 'lake_tear', 'aether_quartz'],
    buys: ['ingredient', 'potion', 'collectible'],
  },
  artificer: {
    name: '«Медвяк и сыновья»', owner: 'goran', mood: 'Звон молоточков и запах раскалённой меди.',
    stock: ['oak_wand', 'ember_wand', 'frost_wand', 'traveler_robe', 'warden_coat', 'scholar_hat', 'iron_ring', 'quartz_amulet', 'ironstone'],
    buys: ['weapon', 'clothing', 'accessory', 'magic', 'ingredient'],
  },
  wanderer: {
    name: 'Повозка Зейна', owner: 'zane', mood: 'Редкости из дальних краёв. Цены — тоже.',
    stock: ['star_dust', 'storm_feather', 'potion_heal_big', 'moon_hat', 'comet_ring', 'founders_map', 'elixir_luck'],
    buys: ['ingredient', 'collectible', 'magic', 'accessory', 'weapon', 'clothing', 'potion'],
  },
};

export const ACHIEVEMENTS: Record<string, { name: string; desc: string; hidden?: boolean }> = {
  first_spell: { name: 'Первая искра', desc: 'Сотворить первое заклинание.' },
  first_blood: { name: 'Боевое крещение', desc: 'Победить первого противника.' },
  slayer: { name: 'Гроза теней', desc: 'Победить 100 противников.' },
  combo_first: { name: 'Резонанс', desc: 'Открыть первую комбинацию заклинаний.' },
  combo_all: { name: 'Мастер резонанса', desc: 'Открыть все комбинации заклинаний.' },
  spells_10: { name: 'Полный гримуар', desc: 'Изучить 10 заклинаний.' },
  brewer: { name: 'Алхимик', desc: 'Сварить превосходное зелье.' },
  duelist: { name: 'Чемпион дуэлей', desc: 'Выиграть дуэльный турнир.' },
  flyer: { name: 'Хозяин ветра', desc: 'Пройти гонку над озером.' },
  explorer: { name: 'Картограф', desc: 'Посетить все области мира.' },
  secrets: { name: 'Знаки Основателей', desc: 'Найти все скрытые знаки Основателей.' },
  rich: { name: 'Кошелёк гильдии', desc: 'Накопить 1000 крон.' },
  level_10: { name: 'Подмастерье', desc: 'Достичь 10 уровня.' },
  friend: { name: 'Верный друг', desc: 'Достичь близких отношений с кем-либо.' },
  scholar: { name: 'Отличник', desc: 'Сдать все экзамены.' },
  night_owl: { name: 'Ночная сова', desc: 'Гулять после отбоя и не попасться.' },
  caught: { name: 'Пойман с поличным', desc: 'Попасться ночному патрулю.', hidden: true },
  bookworm: { name: 'Книжный червь', desc: 'Собрать 8 страниц хроники.' },
  seals: { name: 'Хранитель печатей', desc: 'Восстановить все три печати.' },
  boss_hound: { name: 'Укротитель Клыкаря', desc: 'Победить вожака теневых гончих.' },
  boss_lake: { name: 'Тишина над водой', desc: 'Упокоить Владычицу озера.' },
  boss_golem: { name: 'Разрушитель камня', desc: 'Победить Хранителя Руин.' },
  ending_guardian: { name: 'Хранитель Сердца', desc: 'Получить концовку «Хранитель».' },
  ending_sacrifice: { name: 'Цена света', desc: 'Получить концовку «Жертва».' },
  ending_free: { name: 'Свободный Эфир', desc: 'Получить концовку «Освобождение».' },
  ending_dark: { name: 'Полый венец', desc: 'Получить концовку «Повелитель Пустоты».', hidden: true },
  crafter: { name: 'Мастеровой', desc: 'Создать предмет в мастерской.' },
  daily_5: { name: 'Надёжный помощник', desc: 'Выполнить 5 ежедневных поручений.' },
  pacifist_lake: { name: 'Голос покоя', desc: 'Успокоить озёрных духов «Шёпотом».', hidden: true },
  redeemer: { name: 'Вторая попытка', desc: 'Убедить Кассиана выбрать свет.' },
};

export const LORE: Record<string, { title: string; text: string }> = {
  founders: { title: 'О четырёх Основателях', text: 'Тысячу лет назад четверо магов — Аэла Пламенная, Торвальд Бастион, Сильвия из Корней и Звездочёт Орин — пришли в долину, где из скалы бил свет. Они назвали его Сердцем Эфира и построили вокруг него школу, чтобы свет служил всем, а не одному.' },
  seals: { title: 'О печатях', text: 'Печать не запирает. Она убеждает. Четыре Основателя оставили четыре печати: Корня — в лесу, Вод — в озере, Камня — в старых руинах. Четвёртая печать — они сами, их клятва, вплетённая в стены Академии.' },
  hollow: { title: 'Полый Король', text: 'Был пятый. Его имя вычеркнуто из всех хроник. Он хотел испить Сердце, чтобы жить вечно, — и Сердце выпило его. Осталась лишь пустота в форме человека. Основатели заперли её под Академией.' },
  ash_order: { title: 'Орден Пепла', text: '«Из пепла поднимется новый огонь». Так писали на стенах те, кто верил, что Сердце должно принадлежать сильнейшим. Орден запрещён уже триста лет. Но пепел, как известно, долго тлеет.' },
  first_academy: { title: 'Первая Академия', text: 'До нынешнего замка была другая школа — на холме за лесом. Её разрушил пожар в год, когда пятый Основатель исчез. Архивариус Элиас остался в её руинах, говорят, до сих пор.' },
  lake_queen: { title: 'Владычица озера', text: 'Зеркальное озеро хранит печать Вод. Её стережёт дух утонувшей ученицы, которая поклялась не пропускать никого, кто несёт в сердце пепел.' },
  aether: { title: 'Об Эфире', text: 'Эфир — нить, связывающая всё живое. Маг не создаёт силу, а лишь просит мир о том, что он и так способен сделать.' },
  circles: { title: 'О Кругах', text: 'Ученики делятся на четыре Круга по наследию Основателей. Зеркало Кругов не выбирает — оно лишь показывает то, что ученик выбрал сам.' },
  curfew: { title: 'Устав Академии, §12', text: 'После десятого удара колокола ученики обязаны находиться в спальнях своих Кругов. Нарушители лишаются очков Круга и отправляются на отработку к лесничему.' },
  heart: { title: 'Сердце Эфира', text: 'Кристалл в глубине скалы. Кто владеет им — владеет магией долины. Кто разобьёт его — освободит магию для всего мира, но лишит долину её чуда.' },
};

export const FOUNDER_MARKS = 12;
