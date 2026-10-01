// Типизированная шина событий: движок, системы и интерфейс общаются через неё, не зная друг о друге.
import type { Element, ZoneId } from '@/data/types';

export interface GameEvents {
  enemyKilled: { type: string; zone: ZoneId; boss?: boolean; tags?: string[]; uniqueId?: string };
  itemChanged: { id: string; qty: number };
  reached: { zone: ZoneId; marker: string };
  interacted: { id: string; zone: ZoneId };
  talked: { npc: string };
  dialogueEnded: { npc?: string; dialogue: string };
  spellCast: { spell: string; target?: string };
  spellHitObject: { spell: string; object: string; kind: string };
  flagSet: { flag: string };
  minigameDone: { id: string; type: string; score: number; win: boolean };
  lessonDone: { subject: string; score: number };
  zoneEntered: { zone: ZoneId };
  questUpdated: { quest: string };
  hourChanged: { day: number; hour: number };
  dayChanged: { day: number };
  playerDamaged: { amount: number; element: Element };
  playerDied: Record<string, never>;
  levelUp: { level: number };
  combo: { id: string };
  achievement: { id: string };
  sfx: { id: string; x?: number; z?: number; volume?: number; pitch?: number };
}

type Handler<T> = (payload: T) => void;

class Bus {
  private map = new Map<string, Set<Handler<unknown>>>();

  on<K extends keyof GameEvents>(type: K, fn: Handler<GameEvents[K]>): () => void {
    let set = this.map.get(type);
    if (!set) { set = new Set(); this.map.set(type, set); }
    set.add(fn as Handler<unknown>);
    return () => set!.delete(fn as Handler<unknown>);
  }

  emit<K extends keyof GameEvents>(type: K, payload: GameEvents[K]): void {
    const set = this.map.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.error(`[bus] ${type}`, err); }
    }
  }
}

export const bus = new Bus();
