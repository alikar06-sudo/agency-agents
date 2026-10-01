// Движок заданий: цели, прогресс, награды, последствия, маршрутные метки.
import type { ObjectiveDef, QuestDef, Waypoint, ZoneId } from '@/data/types';
import { G, mutate, toast } from '@/state/store';
import { QUESTS } from '@/data/quests';
import { bus } from '@/core/bus';
import { apply, checkAll } from './logic';
import { addItem, countItem } from './inventory';
import { gainXp } from './player';
import { ITEMS } from '@/data/items';

export function questDef(id: string): QuestDef | undefined { return QUESTS[id]; }

export function startQuest(id: string): void {
  const def = QUESTS[id];
  if (!def) { console.warn('Неизвестный квест', id); return; }
  const existing = G().quests[id];
  if (existing && !(def.type === 'daily' && existing.state !== 'active')) return;
  if (!checkAll(def.conditions)) return;
  mutate((g) => {
    g.quests[id] = { state: 'active', done: [], counts: {}, startedDay: g.time.day };
    if (!g.tracked || def.type === 'main' || !g.quests[g.tracked] || g.quests[g.tracked].state !== 'active') g.tracked = id;
  });
  toast('quest', def.type === 'main' ? 'Сюжетное задание' : def.type === 'hidden' ? 'Тайное задание' : 'Новое задание', def.title);
  bus.emit('sfx', { id: 'quest_start' });
  apply(def.onStart);
  reevaluate(id);
  bus.emit('questUpdated', { quest: id });
}

export function isObjectiveDone(q: string, o: string): boolean {
  return !!G().quests[q]?.done.includes(o);
}

export function activeObjectives(id: string): ObjectiveDef[] {
  const def = QUESTS[id];
  const st = G().quests[id];
  if (!def || !st || st.state !== 'active') return [];
  const out: ObjectiveDef[] = [];
  for (const o of def.objectives) {
    if (st.done.includes(o.id)) continue;
    if (!checkAll(o.if)) continue;
    out.push(o);
    if (!def.parallel && !o.optional) break;
  }
  return out;
}

export function completeObjective(qid: string, oid: string): void {
  const def = QUESTS[qid];
  const st = G().quests[qid];
  if (!def || !st || st.state !== 'active' || st.done.includes(oid)) return;
  const obj = def.objectives.find((o) => o.id === oid);
  if (!obj) { console.warn('Неизвестная цель', qid, oid); return; }
  mutate((g) => { g.quests[qid].done.push(oid); });
  if (obj.kind === 'collect' && obj.target && obj.onComplete === undefined) { /* предметы остаются у игрока до сдачи */ }
  toast('quest', 'Цель выполнена', obj.text);
  bus.emit('sfx', { id: 'objective' });
  apply(obj.onComplete);
  const required = def.objectives.filter((o) => !o.optional && checkAll(o.if));
  const st2 = G().quests[qid];
  if (st2 && st2.state === 'active' && required.every((o) => st2.done.includes(o.id))) {
    completeQuest(qid);
  } else {
    reevaluate(qid);
  }
  bus.emit('questUpdated', { quest: qid });
}

export function completeQuest(id: string): void {
  const def = QUESTS[id];
  const st = G().quests[id];
  if (!def) return;
  if (!st) {
    // квест может быть завершён сюжетом, не будучи начатым
    mutate((g) => { g.quests[id] = { state: 'active', done: [], counts: {}, startedDay: g.time.day }; });
  } else if (st.state !== 'active') return;
  mutate((g) => {
    g.quests[id].state = 'done';
    g.quests[id].finishedDay = g.time.day;
    if (def.type === 'daily') g.counters.dailiesDone = (g.counters.dailiesDone ?? 0) + 1;
    g.counters.questsDone = (g.counters.questsDone ?? 0) + 1;
  });
  toast('quest', 'Задание выполнено', def.title);
  bus.emit('sfx', { id: 'quest_done' });
  const r = def.rewards;
  if (r) {
    if (r.gold) apply([{ gold: r.gold }]);
    if (r.items) for (const it of r.items) addItem(it.id, it.count ?? 1);
    if (r.rep) for (const [f, v] of Object.entries(r.rep)) apply([{ rep: f as never, delta: v as number }]);
    if (r.rel) for (const [npc, v] of Object.entries(r.rel)) apply([{ rel: npc, delta: v }]);
    if (r.circlePoints) apply([{ circlePoints: r.circlePoints }]);
    if (r.xp) gainXp(r.xp);
  }
  apply(def.onComplete);
  if (def.next) startQuest(def.next);
  mutate((g) => {
    if (g.tracked === id) {
      const next = Object.keys(g.quests).find((q) => g.quests[q].state === 'active' && QUESTS[q]?.type === 'main')
        ?? Object.keys(g.quests).find((q) => g.quests[q].state === 'active');
      g.tracked = next ?? null;
    }
  });
  if ((G().counters.dailiesDone ?? 0) >= 5) apply([{ achievement: 'daily_5' }]);
  bus.emit('questUpdated', { quest: id });
}

export function failQuest(id: string): void {
  const st = G().quests[id];
  if (!st || st.state !== 'active') return;
  mutate((g) => {
    g.quests[id].state = 'failed';
    if (g.tracked === id) g.tracked = null;
  });
  toast('warn', 'Задание провалено', QUESTS[id]?.title);
  bus.emit('questUpdated', { quest: id });
}

// Проверка «состояний» — предметов, флагов, уроков — которые могли уже выполниться.
export function reevaluate(id?: string): void {
  const g = G();
  const ids = id ? [id] : Object.keys(g.quests).filter((q) => g.quests[q].state === 'active');
  for (const qid of ids) {
    for (const o of activeObjectives(qid)) {
      if (o.kind === 'collect' && o.target && countItem(o.target) >= (o.count ?? 1)) completeObjective(qid, o.id);
      else if (o.kind === 'flag' && o.target && G().flags[o.target]) completeObjective(qid, o.id);
      else if (o.kind === 'lesson' && o.target && (G().subjects[o.target as keyof typeof g.subjects]?.lessons ?? 0) >= (o.count ?? 1)) completeObjective(qid, o.id);
    }
  }
}

function progress(kind: ObjectiveDef['kind'], match: (o: ObjectiveDef) => boolean, amount = 1): void {
  const g = G();
  for (const qid of Object.keys(g.quests)) {
    if (g.quests[qid].state !== 'active') continue;
    for (const o of activeObjectives(qid)) {
      if (o.kind !== kind || !match(o)) continue;
      const need = o.count ?? 1;
      const cur = (G().quests[qid].counts[o.id] ?? 0) + amount;
      mutate((s) => { s.quests[qid].counts[o.id] = cur; });
      if (cur >= need) completeObjective(qid, o.id);
      else {
        toast('quest', o.text, `${cur} / ${need}`);
        bus.emit('questUpdated', { quest: qid });
      }
    }
  }
}

export function initQuestSystem(): () => void {
  const offs = [
    bus.on('enemyKilled', (e) => progress('kill', (o) => {
      if (o.where && o.where.zone !== e.zone) return false;
      if (!o.target || o.target === '*') return true;
      if (o.target.startsWith('tag:')) return !!e.tags?.includes(o.target.slice(4));
      return o.target === e.type || o.target === e.uniqueId;
    })),
    bus.on('itemChanged', () => reevaluate()),
    bus.on('flagSet', () => reevaluate()),
    bus.on('lessonDone', () => reevaluate()),
    bus.on('reached', (e) => progress('reach', (o) => o.target === e.marker && (!o.where || o.where.zone === e.zone))),
    bus.on('interacted', (e) => progress('interact', (o) => o.target === e.id)),
    bus.on('dialogueEnded', (e) => { if (e.npc) progress('talk', (o) => o.target === e.npc); }),
    bus.on('spellCast', (e) => progress('cast', (o) => o.target === e.spell || o.target === `${e.spell}@${e.target}`)),
    bus.on('spellHitObject', (e) => progress('cast', (o) => o.target === `${e.spell}@${e.object}`)),
    bus.on('minigameDone', (e) => { if (e.win) progress('minigame', (o) => o.target === e.id); }),
  ];
  return () => offs.forEach((f) => f());
}

export function trackedQuest(): QuestDef | null {
  const t = G().tracked;
  return t ? QUESTS[t] ?? null : null;
}

export function setTracked(id: string | null): void {
  mutate((g) => { g.tracked = id; });
}

export interface ActiveWaypoint { quest: string; objective: ObjectiveDef; where: Waypoint }

export function waypoints(onlyTracked = true): ActiveWaypoint[] {
  const g = G();
  const ids = onlyTracked ? (g.tracked ? [g.tracked] : []) : Object.keys(g.quests).filter((q) => g.quests[q].state === 'active');
  const out: ActiveWaypoint[] = [];
  for (const q of ids) for (const o of activeObjectives(q)) if (o.where) out.push({ quest: q, objective: o, where: o.where });
  return out;
}

export function objectiveProgressText(qid: string, o: ObjectiveDef): string {
  const st = G().quests[qid];
  if (o.kind === 'collect' && o.target) return `${Math.min(countItem(o.target), o.count ?? 1)}/${o.count ?? 1}`;
  if ((o.count ?? 1) > 1) return `${st?.counts[o.id] ?? 0}/${o.count}`;
  return '';
}

export function questsByState(state: 'active' | 'done' | 'failed'): QuestDef[] {
  const g = G();
  return Object.keys(g.quests).filter((q) => g.quests[q].state === state && QUESTS[q]).map((q) => QUESTS[q]);
}

export function rewardText(def: QuestDef): string {
  const r = def.rewards;
  if (!r) return '—';
  const parts: string[] = [];
  if (r.xp) parts.push(`${r.xp} опыта`);
  if (r.gold) parts.push(`${r.gold} крон`);
  if (r.items) parts.push(...r.items.map((i) => `${ITEMS[i.id]?.name ?? i.id}${(i.count ?? 1) > 1 ? ' ×' + i.count : ''}`));
  if (r.circlePoints) parts.push(`${r.circlePoints} очков Кругу`);
  return parts.join(' · ') || '—';
}

// Ежедневные поручения с доски объявлений.
export function dailyOffers(): string[] {
  const g = G();
  if (g.dailies.day !== g.time.day) {
    const pool = Object.values(QUESTS).filter((q) => q.type === 'daily' && checkAll(q.conditions)).map((q) => q.id);
    const seed = g.time.day * 9301 + 49297;
    const shuffled = pool.map((id, i) => ({ id, k: Math.sin(seed + i * 17.3) })).sort((a, b) => a.k - b.k).map((x) => x.id);
    const ids = shuffled.slice(0, 3);
    mutate((s) => { s.dailies = { day: s.time.day, ids }; });
  }
  return G().dailies.ids;
}

export function zoneOfWaypoint(w: Waypoint): ZoneId { return w.zone; }
