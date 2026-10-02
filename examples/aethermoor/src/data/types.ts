// Общие типы данных игры. Весь контент (зоны, NPC, квесты, предметы) описывается этими структурами.

export type ZoneId =
  | 'gates' | 'hall' | 'library' | 'towers' | 'dungeons' | 'tunnels'
  | 'forest' | 'village' | 'lake' | 'ruins' | 'sanctum';

export type FactionId = 'academy' | 'circle' | 'village' | 'forest' | 'ash';
export type CircleId = 'flame' | 'bastion' | 'root' | 'star';
export type OriginId = 'guild' | 'bloodline' | 'common' | 'foundling';
export type Gender = 'm' | 'f';
export type StatId = 'int' | 'power' | 'defense' | 'speed';
export type Element = 'arcane' | 'fire' | 'frost' | 'storm' | 'light' | 'shadow' | 'nature' | 'physical';
export type SubjectId = 'theory' | 'potions' | 'defense' | 'transfig' | 'runes' | 'creatures' | 'practical';
export type EquipSlot = 'wand' | 'robe' | 'hat' | 'amulet' | 'ring';
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type ItemCategory =
  | 'weapon' | 'magic' | 'potion' | 'ingredient' | 'quest' | 'clothing' | 'accessory' | 'collectible';

export interface Appearance {
  skin: string;
  hair: string;
  hairStyle: 'short' | 'long' | 'bun' | 'curly' | 'bald' | 'tied' | 'wild';
  eyes: string;
  robe: string;
  trim: string;
  hat?: 'none' | 'pointed' | 'cap' | 'hood' | 'tall' | 'crown';
  beard?: 'none' | 'short' | 'long' | 'wild';
  beardColor?: string;
  glasses?: boolean;
  height?: number;
  build?: number;
  scarf?: string;
  ears?: 'normal' | 'pointed';
  gender?: 'm' | 'f';
  age?: 'child' | 'young' | 'adult' | 'old';
}

// ---------- Условия и эффекты (общий язык для диалогов, квестов, событий) ----------

export type Cond =
  | { flag: string; eq?: string | number | boolean }
  | { notFlag: string }
  | { quest: string; is: 'none' | 'active' | 'done' | 'failed' | 'started' | 'notDone' }
  | { objDone: [string, string] }
  | { objActive: [string, string] }
  | { item: string; count?: number }
  | { noItem: string }
  | { rel: string; gte?: number; lt?: number }
  | { rep: FactionId; gte?: number; lt?: number }
  | { stat: StatId; gte: number }
  | { spell: string }
  | { noSpell: string }
  | { hour: [number, number] }
  | { weekday: number[] }
  | { level: number }
  | { gold: number }
  | { gender: Gender }
  | { origin: OriginId }
  | { circle: CircleId }
  | { act: number; lt?: number }
  | { corruption: number; lt?: number }
  | { lessons: SubjectId; gte: number }
  | { exam: SubjectId }
  | { any: Cond[] }
  | { not: Cond }
  | { day: number }
  | { counter: string; gte: number }
  | { lessonReady: SubjectId }
  | { examReady: SubjectId }
  | { whisper: string }
  | { allies: number };

export type Effect =
  | { setFlag: string; value?: string | number | boolean }
  | { clearFlag: string }
  | { incFlag: string; by?: number }
  | { rel: string; delta: number }
  | { rep: FactionId; delta: number }
  | { circlePoints: number }
  | { give: string; count?: number; silent?: boolean }
  | { take: string; count?: number }
  | { gold: number }
  | { xp: number }
  | { startQuest: string }
  | { completeObjective: [string, string] }
  | { completeQuest: string }
  | { failQuest: string }
  | { learnSpell: string }
  | { learnRecipe: string }
  | { openShop: string }
  | { openCraft: 'alchemy' | 'artifice' }
  | { minigame: MinigameRequest }
  | { teleport: { zone: ZoneId; spawn: string } }
  | { setAct: number }
  | { corruption: number }
  | { heal: true }
  | { journal: string }
  | { toast: string }
  | { advanceTime: number }
  | { sleep: true }
  | { script: string; arg?: string | number }
  | { statPoints: number }
  | { stat: StatId; delta: number }
  | { ending: string }
  | { lesson: SubjectId }
  | { achievement: string }
  | { lore: string }
  | { startDialogue: string; npc?: string };

export interface MinigameRequest {
  type: 'brew' | 'runes' | 'duel' | 'flight' | 'quiz' | 'glyph' | 'creature';
  id: string;            // идентификатор попытки (для квестов/уроков)
  difficulty?: number;   // 1..5
  recipe?: string;       // для зельеварения
  opponent?: string;     // для дуэли
  title?: string;
  onWin?: Effect[];
  onLose?: Effect[];
  minScore?: number;     // 0..1, порог победы
}

// ---------- Диалоги ----------

export interface DialogueChoice {
  text: string;
  next?: string;
  if?: Cond[];        // скрыть вариант, если условия не выполнены
  req?: Cond[];       // показать, но заблокировать, если не выполнены
  tag?: string;       // метка проверки: «[Интеллект 6]»
  effects?: Effect[];
  once?: string;      // флаг: вариант исчезает после выбора
}

export interface DialogueNode {
  speaker?: string;   // id NPC | 'player' | 'narrator'
  text: string;
  effects?: Effect[];
  choices?: DialogueChoice[];
  next?: string;
}

export interface DialogueDef {
  id: string;
  npc?: string;
  start: string;
  nodes: Record<string, DialogueNode>;
}

// ---------- NPC ----------

export interface ScheduleEntry {
  from: number;          // час (0..24), с которого действует запись
  zone: ZoneId;
  at: string;            // id якоря-маркера в зоне
  activity?: string;     // что делает (для карты/журнала)
  wander?: number;       // радиус блуждания, тайлы
  days?: number[];       // дни недели (0=пн..6=вс), если не все
}

export interface NpcDef {
  id: string;
  name: string;
  title: string;
  personality: string;
  circle?: CircleId;
  appearance: Appearance;
  schedule: ScheduleEntry[];
  dialogues: { if?: Cond[]; id: string; mark?: boolean }[];
  barks?: string[];
  presentIf?: Cond[];
  overrides?: { if: Cond[]; schedule: ScheduleEntry[] }[];  // особые расписания (болезнь, арест, сюжет)
  faction?: FactionId;
  essential?: boolean;
  voice?: number;       // высота «голоса» в синтезе
}

// ---------- Квесты ----------

export type QuestType =
  | 'main' | 'side' | 'hidden' | 'daily' | 'exploration' | 'puzzle' | 'combat' | 'relationship';

export type ObjectiveKind =
  | 'talk' | 'reach' | 'kill' | 'collect' | 'interact' | 'flag' | 'cast' | 'minigame' | 'lesson' | 'manual';

export interface Waypoint { zone: ZoneId; marker?: string; npc?: string }

export interface ObjectiveDef {
  id: string;
  text: string;
  kind: ObjectiveKind;
  target?: string;
  count?: number;
  where?: Waypoint;
  optional?: boolean;
  if?: Cond[];
  onComplete?: Effect[];
  hint?: string;
}

export interface Reward {
  xp?: number;
  gold?: number;
  items?: { id: string; count?: number }[];
  rep?: Partial<Record<FactionId, number>>;
  rel?: Record<string, number>;
  circlePoints?: number;
}

export interface QuestDef {
  id: string;
  title: string;
  type: QuestType;
  act?: number;
  giver?: string;
  zone?: ZoneId;
  summary: string;
  objectives: ObjectiveDef[];
  parallel?: boolean;
  rewards?: Reward;
  onStart?: Effect[];
  onComplete?: Effect[];
  next?: string;
  conditions?: Cond[];
  consequences?: string; // описание последствий для журнала
}

// ---------- Предметы ----------

export type StatBlock = Partial<Record<StatId | 'hp' | 'mana' | 'hpRegen' | 'manaRegen' | 'spellPower' | 'crit', number>>;

export interface ItemDef {
  id: string;
  name: string;
  category: ItemCategory;
  rarity: Rarity;
  desc: string;
  value: number;
  icon: string;
  color?: string;
  slot?: EquipSlot;
  stats?: StatBlock;
  element?: Element;     // для жезлов: стихия усиления
  use?: {
    heal?: number;
    mana?: number;
    buff?: { stat: StatId | 'spellPower' | 'manaRegen'; amount: number; minutes: number; label: string };
    cure?: boolean;
    effects?: Effect[];
    corruption?: number;
  };
  stack?: number;
  noSell?: boolean;
  noDrop?: boolean;
}

// ---------- Заклинания ----------

export type SpellSchool = 'attack' | 'defense' | 'heal' | 'control' | 'movement' | 'utility' | 'secret';
export type SpellKind = 'bolt' | 'nova' | 'cone' | 'self' | 'blink' | 'pulse' | 'aura' | 'chain' | 'zone' | 'shield';

export interface SpellDef {
  id: string;
  name: string;
  incantation: string;
  school: SpellSchool;
  element: Element;
  kind: SpellKind;
  desc: string;
  world?: string;       // как применяется вне боя
  cost: number;
  cooldown: number;     // секунды
  level: number;        // минимальный уровень персонажа
  damage?: number;
  radius?: number;
  range?: number;
  speed?: number;
  duration?: number;
  color: number;
  color2: number;
  sound: string;
  acquire: string;      // условия получения (описание)
  rank?: number;        // ранг заклинания (для замков и т.п.)
}

export interface ComboDef {
  id: string;
  name: string;
  first: string;        // статус на цели / заклинание
  second: string;       // заклинание, которым «закрывают» комбо
  desc: string;
  color: number;
}

// ---------- Враги ----------

export type EnemyAI = 'dummy' | 'melee' | 'ranged' | 'charger' | 'caster' | 'wisp' | 'slam' | 'boss';

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  damage: number;
  speed: number;
  xp: number;
  gold: [number, number];
  loot: { item: string; chance: number; count?: [number, number] }[];
  weak: Element[];
  resist: Element[];
  ai: EnemyAI;
  attackRange: number;
  aggroRange: number;
  attackCooldown: number;
  model: string;
  scale?: number;
  color: number;
  color2?: number;
  boss?: boolean;
  element?: Element;
  tags?: string[];
  phases?: number;
  desc: string;
}

// ---------- Зоны ----------

export type MarkerKind =
  | 'spawn' | 'exit' | 'anchor' | 'chest' | 'door' | 'herb' | 'ore' | 'interact' | 'enemy'
  | 'secret' | 'brazier' | 'crystal' | 'block' | 'web' | 'seal' | 'waystone' | 'light' | 'pickup'
  | 'station' | 'bed' | 'board' | 'lore' | 'plate' | 'gate';

export interface MarkerDef {
  kind: MarkerKind;
  id: string;
  floor?: string;          // символ пола под маркером
  to?: ZoneId;             // exit
  spawn?: string;          // exit → точка входа
  label?: string;
  lock?: number;           // door/chest: ранг замка для «Отворения»
  key?: string;            // предмет-ключ
  locked?: Cond[];         // exit/door закрыт, пока условия не выполнены (если заданы — должны выполняться)
  lockedText?: string;
  loot?: { id: string; count?: number }[];
  gold?: number;
  item?: string;           // herb/ore/pickup
  enemy?: string;          // enemy
  count?: number;
  respawn?: 'zone' | 'day' | 'never';
  if?: Cond[];             // маркер активен только при условиях
  hidden?: boolean;        // скрыт до «Откровения»
  effects?: Effect[];      // interact
  once?: boolean;
  station?: 'alchemy' | 'artifice';
  color?: number;
  text?: string;           // для табличек/лора
  group?: string;          // группа головоломки
  facing?: number;
  radius?: number;
  power?: number;          // сила света для kind: light
  prop?: string;           // визуальная модель для interact
  deco?: string;           // символ декоративного пропа, который строится под маркером (без блокировки)
  dialogue?: string;
  lore?: string;
}

export interface ZoneDef {
  id: ZoneId;
  name: string;
  subtitle: string;
  theme: 'castle' | 'dungeon' | 'outdoor' | 'forest' | 'village' | 'lake' | 'ruins' | 'sanctum' | 'library' | 'tower';
  outdoor: boolean;
  music: string;
  ambient: string[];
  floor: string;           // символ пола по умолчанию под объектами
  map: string[];
  markers: Record<string, MarkerDef>;
  fog: [number, number];   // near, far
  ambientLight?: number;   // множитель
  dark?: boolean;          // тёмная зона: без «Светоча» почти ничего не видно
  unlock?: Cond[];
  lockedText?: string;
  wallHeight?: number;
  skyCeiling?: [number, number, number, number]; // зачарованный звёздный потолок: col0, row0, col1, row1
  waystone?: string;       // id точки быстрого перемещения
  mapPos: [number, number];// положение на карте мира (0..1)
}
