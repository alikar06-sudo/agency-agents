// Гримуар: все заклинания и резонансные комбинации.
import type { ComboDef, SpellDef } from './types';

const list: SpellDef[] = [
  { id: 'spark', name: 'Искра', incantation: 'Фаль эн', school: 'attack', element: 'arcane', kind: 'bolt',
    desc: 'Быстрый сгусток чистого Эфира. Основа боевой магии.', world: 'Разбивает хрупкие преграды и активирует руны-мишени.',
    cost: 3, cooldown: 0.38, level: 1, damage: 14, speed: 24, range: 20, color: 0x9fd0ff, color2: 0xe8f4ff, sound: 'spark',
    acquire: 'Первый урок практической магии у капитана Хальварда.' },
  { id: 'ward', name: 'Щит Эгиды', incantation: 'Эгида торн', school: 'defense', element: 'arcane', kind: 'shield',
    desc: 'Удерживайте ПКМ: барьер поглощает 75% урона. В первые мгновения отражает снаряды обратно.', world: 'Защищает от ловушек и падающих обломков.',
    cost: 8, cooldown: 0.8, level: 1, duration: 0, color: 0x7fb8ff, color2: 0xcfe6ff, sound: 'ward',
    acquire: 'Первый урок практической магии.' },
  { id: 'light', name: 'Светоч', incantation: 'Эльдра сай', school: 'utility', element: 'light', kind: 'aura',
    desc: 'Парящий огонёк освещает путь 90 секунд и жжёт теней вокруг вас.', world: 'Освещает тёмные залы; тени боятся его.',
    cost: 10, cooldown: 3, level: 1, damage: 6, radius: 4.5, duration: 90, color: 0xfff0b0, color2: 0xffd27a, sound: 'light',
    acquire: 'Урок магической теории у магистра Лоу.' },
  { id: 'gust', name: 'Порыв', incantation: 'Вэнти ар', school: 'control', element: 'nature', kind: 'cone',
    desc: 'Волна ветра отбрасывает врагов и сбивает их атаки.', world: 'Сдвигает каменные блоки, разгоняет туман и сбивает пламя.',
    cost: 10, cooldown: 2.6, level: 2, damage: 10, range: 6, radius: 1.1, color: 0xc8f0e0, color2: 0xffffff, sound: 'gust',
    acquire: 'Второй урок практической магии.' },
  { id: 'flame', name: 'Пламя', incantation: 'Игнар ос', school: 'attack', element: 'fire', kind: 'bolt',
    desc: 'Огненный шар взрывается и поджигает врагов.', world: 'Зажигает жаровни, сжигает паутину и сухие лозы.',
    cost: 14, cooldown: 2.2, level: 2, damage: 26, radius: 2.6, speed: 18, range: 18, color: 0xff7a2a, color2: 0xffd060, sound: 'flame',
    acquire: 'Третий урок практической магии (Круг Пламени знает его с первого дня).' },
  { id: 'frost', name: 'Иней', incantation: 'Глас ирэ', school: 'control', element: 'frost', kind: 'bolt',
    desc: 'Ледяной осколок замедляет; два попадания подряд — замораживают.', world: 'Превращает воду в лёд: можно пройти по озеру.',
    cost: 12, cooldown: 1.8, level: 3, damage: 16, radius: 2.4, speed: 20, range: 18, color: 0x9ae0ff, color2: 0xffffff, sound: 'frost',
    acquire: 'Второй урок трансформации у профессора Гравейн.' },
  { id: 'mend', name: 'Исцеление', incantation: 'Сильва мэр', school: 'heal', element: 'nature', kind: 'self',
    desc: 'Мгновенно лечит и продолжает лечить ещё 5 секунд.', world: 'Возвращает силы раненым созданиям.',
    cost: 18, cooldown: 9, level: 1, damage: 40, duration: 5, color: 0x8af0a0, color2: 0xe8ffd0, sound: 'mend',
    acquire: 'Дар Круга Корня; остальным — от сестры Мэйбел в лазарете.' },
  { id: 'blink', name: 'Скачок', incantation: 'Шаэ вир', school: 'movement', element: 'arcane', kind: 'blink',
    desc: 'Мгновенный перенос к курсору (до 7 шагов). Вы неуязвимы в момент переноса.', world: 'Перепрыгивает провалы и узкие расщелины.',
    cost: 12, cooldown: 3.5, level: 4, range: 7.5, color: 0xc8a0ff, color2: 0xffffff, sound: 'blink',
    acquire: 'Экзамен по практической магии.' },
  { id: 'bind', name: 'Оковы', incantation: 'Нэкс тал', school: 'control', element: 'nature', kind: 'bolt',
    desc: 'Корни сковывают цель на 3 секунды.', world: 'Удерживает механизмы и рычаги на месте.',
    cost: 12, cooldown: 6, level: 3, damage: 8, speed: 20, range: 16, duration: 3, color: 0x8ac05a, color2: 0xd8f0a0, sound: 'bind',
    acquire: 'Третий урок защитной магии у магистра Корвина.' },
  { id: 'unlock', name: 'Отворение', incantation: 'Клавис ун', school: 'utility', element: 'arcane', kind: 'pulse',
    desc: 'Открывает запертые рунами двери и сундуки (ранг замка не выше ранга заклинания).', world: 'Двери, сундуки, решётки.',
    cost: 8, cooldown: 1.5, level: 1, radius: 3.2, color: 0xe3c46b, color2: 0xfff0c0, sound: 'unlock',
    acquire: 'Первый урок трансформации.' },
  { id: 'reveal', name: 'Откровение', incantation: 'Вэла ис', school: 'utility', element: 'light', kind: 'pulse',
    desc: 'Волна света проявляет скрытое: тайные знаки, двери, невидимых врагов.', world: 'Поиск секретов. Чем ближе тайна, тем громче звон.',
    cost: 8, cooldown: 4, level: 1, radius: 9, color: 0xffe9a0, color2: 0xffffff, sound: 'reveal',
    acquire: 'Первый урок древних рун (Круг Звезды знает его с первого дня).' },
  { id: 'storm', name: 'Молния', incantation: 'Тарэн вольт', school: 'attack', element: 'storm', kind: 'chain',
    desc: 'Разряд бьёт ближайшего к курсору врага и перескакивает ещё на двоих.', world: 'Заряжает древние кристаллы-механизмы.',
    cost: 16, cooldown: 2.8, level: 5, damage: 30, range: 12, color: 0xa8c0ff, color2: 0xffffff, sound: 'storm',
    acquire: 'Экзамен по защитной магии.' },
  { id: 'whisper', name: 'Шёпот', incantation: 'Мур эла', school: 'control', element: 'nature', kind: 'pulse',
    desc: 'Мягкая песня успокаивает зверей и духов поблизости. На людей действует как убеждение.', world: 'Открывает особые варианты в разговорах с NPC, усмиряет существ.',
    cost: 10, cooldown: 6, level: 2, radius: 6, duration: 20, color: 0xf0c0e8, color2: 0xffffff, sound: 'whisper',
    acquire: 'Урок о магических существах у наставницы Фоксглов.' },
  { id: 'eclipse', name: 'Затмение', incantation: '— — —', school: 'secret', element: 'shadow', kind: 'nova',
    desc: 'Волна пустоты рвёт всё вокруг. Каждое применение усиливает порчу.', world: 'Гасит любой свет. Тьма любит, когда её зовут.',
    cost: 28, cooldown: 12, level: 6, damage: 90, radius: 6, color: 0x5a2a7a, color2: 0x1a0a2a, sound: 'eclipse',
    acquire: 'Скрытое. Предлагается тем, кто прислушается к голосу из-под Академии.' },
  { id: 'starfall', name: 'Звёздный дождь', incantation: 'Орин астра', school: 'secret', element: 'light', kind: 'zone',
    desc: 'С неба падают звёзды: огромный урон в области курсора.', world: 'Освещает всё вокруг на несколько мгновений.',
    cost: 35, cooldown: 15, level: 6, damage: 34, radius: 4, duration: 2.2, color: 0xfff0a0, color2: 0xa0c0ff, sound: 'starfall',
    acquire: 'Скрытое. Найдите все восемь знаков Основателей.' },
];

export const SPELLS: Record<string, SpellDef> = Object.fromEntries(list.map((s) => [s.id, s]));
export const SPELL_ORDER = list.map((s) => s.id);

export const COMBOS: ComboDef[] = [
  { id: 'steam', name: 'Паровой взрыв', first: 'chilled', second: 'flame', color: 0xe8f0ff,
    desc: 'Огонь по замороженной или охлаждённой цели: взрыв пара ранит всех рядом и ослепляет.' },
  { id: 'firestorm', name: 'Огненный вихрь', first: 'burning', second: 'gust', color: 0xff8a3a,
    desc: 'Порыв раздувает пламя: огонь перекидывается на всех врагов в конусе.' },
  { id: 'thunder', name: 'Громовые оковы', first: 'rooted', second: 'storm', color: 0xc0d0ff,
    desc: 'Молния по скованной цели: двойной урон и оглушение.' },
  { id: 'shatter', name: 'Ледяной раскол', first: 'frozen', second: 'spark', color: 0xbfefff,
    desc: 'Искра по замороженной цели раскалывает лёд: огромный урон и осколки вокруг.' },
  { id: 'pyre', name: 'Погребальный костёр', first: 'rooted', second: 'flame', color: 0xff5a2a,
    desc: 'Пламя по скованной цели: горение втрое сильнее.' },
];

export const SCHOOL_NAMES: Record<string, string> = {
  attack: 'Атакующее', defense: 'Защитное', heal: 'Лечебное', control: 'Контроль', movement: 'Перемещение', utility: 'Окружение', secret: 'Тайное',
};

export const ELEMENT_NAMES: Record<string, string> = {
  arcane: 'Эфир', fire: 'Огонь', frost: 'Лёд', storm: 'Гроза', light: 'Свет', shadow: 'Тьма', nature: 'Природа', physical: 'Физический',
};
