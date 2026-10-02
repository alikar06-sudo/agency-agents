// Три хранилища: партия (сохраняется), интерфейс (не сохраняется), настройки (localStorage).
import { create } from 'zustand';
import { produce } from 'immer';
import type { GameState } from './gameState';
import type { MinigameRequest } from '@/data/types';

// ---------------- Партия ----------------

export const useGame = create<{ g: GameState | null }>(() => ({ g: null }));

export function G(): GameState {
  const g = useGame.getState().g;
  if (!g) throw new Error('Игра не загружена');
  return g;
}

export function hasGame(): boolean {
  return useGame.getState().g !== null;
}

export function mutate(fn: (g: GameState) => void): void {
  const cur = useGame.getState().g;
  if (!cur) return;
  useGame.setState({ g: produce(cur, fn) });
}

export function setGame(g: GameState | null): void {
  useGame.setState({ g });
}

// ---------------- Интерфейс ----------------

export type Screen = 'boot' | 'title' | 'intro' | 'create' | 'game' | 'ending';
export type MenuTab = 'character' | 'inventory' | 'spells' | 'quests' | 'map' | 'relations' | 'journal' | 'settings';

export interface Toast {
  id: number;
  kind: 'quest' | 'item' | 'xp' | 'info' | 'warn' | 'achievement' | 'level' | 'rep' | 'spell' | 'combo';
  title: string;
  text?: string;
}

export interface DialogueSession {
  dialogue: string;
  node: string;
  npc?: string;
  key: number;
}

export interface CinematicSlide {
  title?: string;
  text: string;
  speaker?: string;
  hold?: number;
}

export interface Cinematic {
  id: string;
  slides: CinematicSlide[];
  onEnd?: () => void;
  style?: 'letterbox' | 'full';
}

export interface ReadDoc { title: string; body: string; kind?: 'lore' | 'note' | 'sign' | 'board' }

export interface UIState {
  screen: Screen;
  menu: MenuTab | null;
  pauseMenu: boolean;
  dialogue: DialogueSession | null;
  shop: string | null;
  craft: 'alchemy' | 'artifice' | null;
  minigame: MinigameRequest | null;
  prompt: { text: string; key: string; sub?: string } | null;
  toasts: Toast[];
  banner: { title: string; subtitle: string; id: number } | null;
  boss: { name: string; hp: number; max: number; phase?: string } | null;
  cinematic: Cinematic | null;
  read: ReadDoc | null;
  fade: boolean;
  dead: boolean;
  waitMenu: boolean;
  fastTravel: boolean;
  cloud: 'unknown' | 'online' | 'offline';
  lookLocked: boolean;                 // мышь захвачена для обзора
  hint: string | null;
  challenge: { title: string; goal: string; left: number } | null;
  ending: string | null;
  vignette: number;
}

export const useUI = create<UIState>(() => ({
  screen: 'boot',
  menu: null,
  pauseMenu: false,
  dialogue: null,
  shop: null,
  craft: null,
  minigame: null,
  prompt: null,
  toasts: [],
  banner: null,
  boss: null,
  cinematic: null,
  read: null,
  fade: false,
  lookLocked: false,
  dead: false,
  waitMenu: false,
  fastTravel: false,
  cloud: 'unknown',
  hint: null,
  challenge: null,
  ending: null,
  vignette: 0,
}));

export function ui(): UIState { return useUI.getState(); }
export function setUI(p: Partial<UIState>): void { useUI.setState(p); }

// Мир ставится на паузу, когда открыт любой модальный слой.
export function isModalOpen(s: UIState = ui()): boolean {
  return s.screen !== 'game' || !!s.menu || s.pauseMenu || !!s.dialogue || !!s.shop || !!s.craft ||
    !!s.minigame || !!s.cinematic || !!s.read || s.dead || s.waitMenu || s.fastTravel;
}

let toastSeq = 1;
export function toast(kind: Toast['kind'], title: string, text?: string): void {
  const t: Toast = { id: toastSeq++, kind, title, text };
  useUI.setState((s) => ({ toasts: [...s.toasts.slice(-4), t] }));
  setTimeout(() => {
    useUI.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== t.id) }));
  }, kind === 'achievement' || kind === 'level' ? 5200 : 3800);
}

let bannerSeq = 1;
export function banner(title: string, subtitle: string): void {
  const id = bannerSeq++;
  setUI({ banner: { title, subtitle, id } });
  setTimeout(() => { if (ui().banner?.id === id) setUI({ banner: null }); }, 3600);
}

// ---------------- Настройки ----------------

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  ambient: number;
  quality: 'low' | 'medium' | 'high';
  showDamage: boolean;
  textSpeed: number;     // символов в секунду (0 — мгновенно)
  zoom: number;
  touch: 'auto' | 'on' | 'off';
  shake: boolean;
  minimapRotate: boolean;
  keys: Partial<Record<string, string>>;   // переназначенные клавиши: действие → код клавиши
  camera: 'iso' | 'third' | 'first';       // вид: сверху, из-за плеча, от первого лица
  sensitivity: number;                     // чувствительность обзора мышью
  invertY: boolean;
  fov: number;                             // поле зрения от первого лица, градусы
  voice: boolean;          // озвучка реплик
  voiceVolume: number;
  voiceRate: number;
  voiceHero: boolean;      // герой произносит выбранные ответы вслух
  voiceBarks: boolean;     // прохожие произносят свои фразы
  autoAdvance: boolean;    // после озвученной реплики разговор продолжается сам
}

const SETTINGS_KEY = 'aethermoor.settings.v1';

function loadSettings(): Settings {
  const def: Settings = {
    master: 0.8, music: 0.55, sfx: 0.8, ambient: 0.6, quality: 'medium', showDamage: true,
    textSpeed: 60, zoom: 1, touch: 'auto', shake: true, minimapRotate: false, keys: {},
    camera: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'third' : 'first', sensitivity: 1, invertY: false, fov: 75,
    voice: true, voiceVolume: 1, voiceRate: 1, voiceHero: true, voiceBarks: true, autoAdvance: true,
  };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...def, ...JSON.parse(raw) };
  } catch { /* приватный режим: работаем с настройками по умолчанию */ }
  return def;
}

export const useSettings = create<Settings>(() => loadSettings());

export function setSettings(p: Partial<Settings>): void {
  useSettings.setState(p);
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(useSettings.getState())); } catch { /* ignore */ }
}
