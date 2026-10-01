// Характеристики, уровни, производные параметры персонажа.
import type { StatId } from '@/data/types';
import { G, mutate, toast } from '@/state/store';
import type { GameState } from '@/state/gameState';
import { absMinutes } from '@/state/gameState';
import { ITEMS } from '@/data/items';
import { bus } from '@/core/bus';
import { hooks } from './logic';

export const MAX_LEVEL = 20;

export function xpToNext(level: number): number {
  return Math.round(90 * Math.pow(level, 1.55));
}

export interface Derived {
  maxHp: number;
  maxMana: number;
  hpRegen: number;
  manaRegen: number;
  spellPower: number;   // множитель урона
  defense: number;      // итоговая защита
  dmgTaken: number;     // множитель входящего урона
  moveSpeed: number;
  cdMult: number;
  crit: number;
  stats: Record<StatId, number>;
  wandElement?: string;
}

export function derived(g: GameState = G()): Derived {
  const s = { ...g.player.stats };
  let hp = 0, mana = 0, hpRegen = 0, manaRegen = 0, sp = 0, crit = 0;
  let wandElement: string | undefined;
  for (const slot of Object.keys(g.equipment) as (keyof GameState['equipment'])[]) {
    const uidv = g.equipment[slot];
    if (!uidv) continue;
    const inv = g.inventory.find((i) => i.uid === uidv);
    if (!inv) continue;
    const def = ITEMS[inv.id];
    if (!def?.stats) continue;
    const st = def.stats;
    s.int += st.int ?? 0; s.power += st.power ?? 0; s.defense += st.defense ?? 0; s.speed += st.speed ?? 0;
    hp += st.hp ?? 0; mana += st.mana ?? 0; hpRegen += st.hpRegen ?? 0; manaRegen += st.manaRegen ?? 0;
    sp += st.spellPower ?? 0; crit += st.crit ?? 0;
    if (slot === 'wand' && def.element) wandElement = def.element;
  }
  const now = absMinutes(g.time);
  for (const b of g.buffs) {
    if (b.until < now) continue;
    if (b.stat === 'spellPower') sp += b.amount;
    else if (b.stat === 'manaRegen') manaRegen += b.amount;
    else if (b.stat in s) s[b.stat as StatId] += b.amount;
  }
  const lvl = g.player.level;
  const circle = g.player.circle;
  const manaMult = circle === 'star' ? 1.2 : 1;
  const maxHp = Math.round(80 + lvl * 12 + s.defense * 7 + hp);
  const maxMana = Math.round((40 + lvl * 5 + s.int * 8 + mana) * manaMult);
  const defense = s.defense;
  return {
    maxHp,
    maxMana,
    hpRegen: 0.35 + lvl * 0.04 + hpRegen,
    manaRegen: 2.4 + s.int * 0.28 + manaRegen,
    spellPower: (1 + s.power * 0.07 + sp / 100) * (g.player.corruption >= 40 ? 1.1 : 1),
    defense,
    dmgTaken: 15 / (15 + defense * 1.6),
    moveSpeed: 5.4 * (1 + s.speed * 0.028),
    cdMult: 1 - Math.min(0.3, s.speed * 0.016),
    crit: Math.min(0.5, 0.05 + s.int * 0.006 + crit / 100),
    stats: s,
    wandElement,
  };
}

export function gainXp(n: number): void {
  const g = G();
  if (g.player.level >= MAX_LEVEL) return;
  const bonus = 1 + g.player.stats.int * 0.01;
  let xp = g.player.xp + Math.round(n * bonus);
  let level = g.player.level;
  let gained = 0;
  while (level < MAX_LEVEL && xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level++;
    gained++;
  }
  mutate((s) => {
    s.player.xp = xp;
    s.player.level = level;
    s.player.statPoints += gained * 3;
  });
  toast('xp', `+${Math.round(n * bonus)} опыта`);
  if (gained) {
    const d = derived();
    mutate((s) => { s.player.hp = d.maxHp; s.player.mana = d.maxMana; });
    toast('level', `Уровень ${level}!`, `+${gained * 3} очка характеристик · здоровье и мана восстановлены`);
    bus.emit('levelUp', { level });
    bus.emit('sfx', { id: 'levelup' });
    if (level >= 10) hooks.unlockAchievement('level_10');
  }
}

export function allocate(stat: StatId): void {
  if (G().player.statPoints <= 0) return;
  mutate((g) => { g.player.statPoints--; g.player.stats[stat]++; });
  bus.emit('sfx', { id: 'ui_confirm' });
}

export function healFull(): void {
  const d = derived();
  mutate((g) => { g.player.hp = d.maxHp; g.player.mana = d.maxMana; });
}

export function clampVitals(): void {
  const d = derived();
  const g = G();
  if (g.player.hp > d.maxHp || g.player.mana > d.maxMana) {
    mutate((s) => { s.player.hp = Math.min(s.player.hp, d.maxHp); s.player.mana = Math.min(s.player.mana, d.maxMana); });
  }
}

export function addBuff(id: string, stat: string, amount: number, minutes: number, label: string): void {
  mutate((g) => {
    const until = absMinutes(g.time) + minutes;
    g.buffs = g.buffs.filter((b) => b.id !== id && b.until > absMinutes(g.time));
    g.buffs.push({ id, stat, amount, until, label });
  });
}
