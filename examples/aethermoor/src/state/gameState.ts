// Сериализуемое состояние партии. Именно этот объект уходит в сохранение (локально или на сервер).
import type {
  Appearance, CircleId, EquipSlot, FactionId, Gender, OriginId, StatId, SubjectId, ZoneId,
} from '@/data/types';

export const SAVE_VERSION = 1;

export interface InvItem { uid: string; id: string; qty: number; q?: number }

export interface QuestProgress {
  state: 'active' | 'done' | 'failed';
  done: string[];                  // завершённые цели
  counts: Record<string, number>;  // прогресс счётных целей
  startedDay: number;
  finishedDay?: number;
}

export interface Drop { uid: string; id: string; qty: number; x: number; z: number }

export interface Buff { id: string; stat: string; amount: number; until: number; label: string }

export interface PlayerState {
  name: string;
  gender: Gender;
  appearance: Appearance;
  origin: OriginId;
  circle: CircleId;
  level: number;
  xp: number;
  statPoints: number;
  stats: Record<StatId, number>;
  hp: number;
  mana: number;
  gold: number;
  corruption: number;
}

export interface GameState {
  version: number;
  id: string;
  createdAt: number;
  updatedAt: number;
  playTime: number;
  player: PlayerState;
  pos: { zone: ZoneId; x: number; z: number; facing: number };
  inventory: InvItem[];
  equipment: Record<EquipSlot, string | null>;
  quickItem: string | null;
  spells: { known: string[]; slots: (string | null)[]; combos: string[] };
  quests: Record<string, QuestProgress>;
  tracked: string | null;
  flags: Record<string, string | number | boolean>;
  rel: Record<string, number>;
  rep: Record<FactionId, number>;
  circlePoints: Record<CircleId, number>;
  time: { day: number; min: number };
  act: number;
  visited: ZoneId[];
  explored: Partial<Record<ZoneId, string>>;
  opened: string[];
  harvested: Record<string, number>;
  defeated: string[];
  subjects: Record<SubjectId, { lessons: number; lastDay: number; exam: string | null; best: number }>;
  recipes: string[];
  achievements: string[];
  lore: string[];
  journal: { day: number; text: string }[];
  drops: Partial<Record<ZoneId, Drop[]>>;
  counters: Record<string, number>;
  dailies: { day: number; ids: string[] };
  buffs: Buff[];
  ending: string | null;
  records: Record<string, number>;
}

export const SUBJECT_IDS: SubjectId[] = ['theory', 'potions', 'defense', 'transfig', 'runes', 'creatures', 'practical'];

export function uid(prefix = 'u'): string {
  return prefix + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

export function absMinutes(t: { day: number; min: number }): number {
  return (t.day - 1) * 1440 + t.min;
}

export interface NewCharacter {
  name: string;
  gender: Gender;
  appearance: Appearance;
  origin: OriginId;
  circle: CircleId;
  stats: Record<StatId, number>;
}

export function createGameState(c: NewCharacter): GameState {
  const subjects = {} as GameState['subjects'];
  for (const s of SUBJECT_IDS) subjects[s] = { lessons: 0, lastDay: 0, exam: null, best: 0 };
  const now = Date.now();
  return {
    version: SAVE_VERSION,
    id: uid('save_'),
    createdAt: now,
    updatedAt: now,
    playTime: 0,
    player: {
      name: c.name,
      gender: c.gender,
      appearance: c.appearance,
      origin: c.origin,
      circle: c.circle,
      level: 1,
      xp: 0,
      statPoints: 0,
      stats: { ...c.stats },
      hp: 9999,
      mana: 9999,
      gold: c.origin === 'guild' ? 120 : c.origin === 'bloodline' ? 80 : 40,
      corruption: 0,
    },
    pos: { zone: 'gates', x: 0, z: 0, facing: 0 },
    inventory: [],
    equipment: { wand: null, robe: null, hat: null, amulet: null, ring: null },
    quickItem: null,
    spells: { known: [], slots: [null, null, null, null, null, null], combos: [] },
    quests: {},
    tracked: null,
    flags: {},
    rel: {},
    rep: { academy: 0, circle: 0, village: c.origin === 'common' ? 15 : 0, forest: c.origin === 'foundling' ? 20 : 0, ash: 0 },
    circlePoints: { flame: 40, bastion: 55, root: 35, star: 50 },
    time: { day: 1, min: 16 * 60 },
    act: 1,
    visited: [],
    explored: {},
    opened: [],
    harvested: {},
    defeated: [],
    subjects,
    recipes: [],
    achievements: [],
    lore: [],
    journal: [],
    drops: {},
    counters: {},
    dailies: { day: 0, ids: [] },
    buffs: [],
    ending: null,
    records: {},
  };
}

// Миграции сохранений: при изменении формата добавляйте шаг сюда.
export function migrateSave(raw: unknown): GameState | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as GameState;
  if (!s.player || !s.pos || typeof s.version !== 'number') return null;
  if (s.version > SAVE_VERSION) return null;
  s.records ??= {};
  s.buffs ??= [];
  s.drops ??= {};
  s.counters ??= {};
  s.lore ??= [];
  s.journal ??= [];
  s.version = SAVE_VERSION;
  return s;
}
