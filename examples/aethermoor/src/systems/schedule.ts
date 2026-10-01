// Расписания NPC: где находится персонаж в текущий час.
import type { ScheduleEntry, ZoneId } from '@/data/types';
import { NPCS } from '@/data/npcs';
import { G } from '@/state/store';
import { checkAll, weekdayOf } from './logic';

export interface NpcLocation extends ScheduleEntry { npc: string }

export function npcLocation(id: string, hour?: number, day?: number): NpcLocation | null {
  const def = NPCS[id];
  if (!def) return null;
  if (!checkAll(def.presentIf)) return null;
  const g = G();
  const h = hour ?? g.time.min / 60;
  const wd = weekdayOf(day ?? g.time.day);
  const override = def.overrides?.find((o) => checkAll(o.if));
  const entries = (override ? override.schedule : def.schedule).filter((e) => !e.days || e.days.includes(wd));
  if (!entries.length) return null;
  let best: ScheduleEntry | null = null;
  for (const e of entries) if (e.from <= h && (!best || e.from >= best.from)) best = e;
  if (!best) best = entries.reduce((a, b) => (b.from > a.from ? b : a));
  return { ...best, npc: id };
}

export function npcsInZone(zone: ZoneId): NpcLocation[] {
  const out: NpcLocation[] = [];
  for (const id of Object.keys(NPCS)) {
    const loc = npcLocation(id);
    if (loc && loc.zone === zone) out.push(loc);
  }
  return out;
}

export function scheduleTable(id: string): { from: number; zone: ZoneId; activity?: string }[] {
  const def = NPCS[id];
  return def ? [...def.schedule].sort((a, b) => a.from - b.from).map((e) => ({ from: e.from, zone: e.zone, activity: e.activity })) : [];
}
