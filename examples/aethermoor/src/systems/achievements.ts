// Достижения: разблокировка и автоматические проверки по событиям.
import { ACHIEVEMENTS } from '@/data/world';
import { G, hasGame, mutate, toast } from '@/state/store';
import { bus } from '@/core/bus';
import { COMBOS } from '@/data/spells';
import { ZONES } from '@/data/zones';

export function unlockAchievement(id: string): void {
  if (!hasGame()) return;
  const def = ACHIEVEMENTS[id];
  if (!def || G().achievements.includes(id)) return;
  mutate((g) => { g.achievements.push(id); });
  toast('achievement', `Достижение: ${def.name}`, def.desc);
  bus.emit('sfx', { id: 'achievement' });
  bus.emit('achievement', { id });
}

export function checkPassiveAchievements(): void {
  if (!hasGame()) return;
  const g = G();
  if (g.player.gold >= 1000) unlockAchievement('rich');
  if (g.spells.known.length >= 10) unlockAchievement('spells_10');
  if (g.spells.combos.length >= 1) unlockAchievement('combo_first');
  if (g.spells.combos.length >= COMBOS.length) unlockAchievement('combo_all');
  if ((g.counters.kills ?? 0) >= 1) unlockAchievement('first_blood');
  if ((g.counters.kills ?? 0) >= 100) unlockAchievement('slayer');
  if ((g.counters.casts ?? 0) >= 1) unlockAchievement('first_spell');
  if (Object.values(g.rel).some((v) => v >= 80)) unlockAchievement('friend');
  if (g.lore.length >= 8) unlockAchievement('bookworm');
  if (Object.keys(ZONES).every((z) => g.visited.includes(z as never))) unlockAchievement('explorer');
  if (Object.values(g.subjects).every((s) => s.exam)) unlockAchievement('scholar');
}

export function initAchievements(): () => void {
  const offs = [
    bus.on('enemyKilled', () => checkPassiveAchievements()),
    bus.on('questUpdated', () => checkPassiveAchievements()),
    bus.on('itemChanged', () => checkPassiveAchievements()),
    bus.on('zoneEntered', () => checkPassiveAchievements()),
    bus.on('combo', () => checkPassiveAchievements()),
    bus.on('spellCast', () => { if ((G().counters.casts ?? 0) <= 1) checkPassiveAchievements(); }),
  ];
  return () => offs.forEach((f) => f());
}
