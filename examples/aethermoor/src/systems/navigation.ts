// Навигация по метке задания: в какую сторону идти, даже если цель в другой области.
import type { Waypoint, ZoneId } from '@/data/types';
import { ZONES } from '@/data/zones';
import { npcLocation } from './schedule';
import { engine } from '@/engine/Engine';
import { G } from '@/state/store';
import { cellCenter } from '@/engine/world';

function exitsOf(z: ZoneId): { to: ZoneId; key: string; col: number; row: number }[] {
  const def = ZONES[z];
  const out: { to: ZoneId; key: string; col: number; row: number }[] = [];
  def.map.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const m = def.markers[row[c]];
      if (m?.kind === 'exit' && m.to) out.push({ to: m.to, key: m.id, col: c, row: r });
    }
  });
  return out;
}

export function nextZoneToward(from: ZoneId, to: ZoneId): ZoneId | null {
  if (from === to) return to;
  const prev = new Map<ZoneId, ZoneId>();
  const q: ZoneId[] = [from];
  const seen = new Set<ZoneId>([from]);
  while (q.length) {
    const z = q.shift()!;
    for (const e of exitsOf(z)) {
      if (seen.has(e.to)) continue;
      seen.add(e.to);
      prev.set(e.to, z);
      if (e.to === to) {
        let cur: ZoneId = to;
        while (prev.get(cur) !== from) cur = prev.get(cur)!;
        return cur;
      }
      q.push(e.to);
    }
  }
  return null;
}

export interface NavTarget { x: number; z: number; label: string; viaExit: boolean; zone: ZoneId }

// Цель в текущей зоне: сама точка/NPC или выход в нужную сторону.
export function resolveWaypoint(w: Waypoint): NavTarget | null {
  const here = G().pos.zone;
  let zone = w.zone;
  if (w.npc) {
    const loc = npcLocation(w.npc);
    if (loc) zone = loc.zone;
    if (zone === here) {
      const n = engine.npcs.find(w.npc);
      if (n) return { x: n.x, z: n.z, label: n.def.name, viaExit: false, zone };
      if (loc) { const m = engine.marker(loc.at); if (m) return { x: m.x, z: m.z, label: '', viaExit: false, zone }; }
    }
  }
  if (zone === here) {
    if (w.marker) {
      const m = engine.zone?.markers.find((mk) => mk.key === w.marker || mk.def.id === w.marker);
      if (m) return { x: m.x, z: m.z, label: '', viaExit: false, zone };
    }
    return null;
  }
  const next = nextZoneToward(here, zone);
  if (!next) return null;
  const ex = exitsOf(here).find((e) => e.to === next);
  if (!ex) return null;
  const [x, z] = cellCenter(ex.col, ex.row);
  return { x, z, label: ZONES[next].name, viaExit: true, zone: next };
}
