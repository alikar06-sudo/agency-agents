// Столкновения с сеткой, прямая видимость, поиск пути A*.
import type { Grid } from './world';
import { TS, cellCenter } from './world';

export function inBounds(g: Grid, c: number, r: number): boolean { return c >= 0 && r >= 0 && c < g.w && r < g.h; }

export function blockedCell(g: Grid, c: number, r: number, now: number, flying = false): boolean {
  if (!inBounds(g, c, r)) return true;
  const i = r * g.w + c;
  if (g.water[i] === 1) {
    if (g.ice[i] > now) return false;
    return !flying;
  }
  return g.walk[i] === 1 || (g.dyn[i] & 1) === 1;
}

export function shotBlocked(g: Grid, c: number, r: number): boolean {
  if (!inBounds(g, c, r)) return true;
  const i = r * g.w + c;
  return g.shot[i] === 1 || (g.dyn[i] & 2) === 2;
}

export function blockedAt(g: Grid, x: number, z: number, now: number): boolean {
  return blockedCell(g, Math.floor(x / TS), Math.floor(z / TS), now);
}

// Движение круга с выталкиванием из непроходимых клеток (скольжение вдоль стен).
export function moveCircle(g: Grid, x: number, z: number, dx: number, dz: number, r: number, now: number, flying = false): [number, number] {
  let nx = x + dx;
  let nz = z + dz;
  for (let iter = 0; iter < 3; iter++) {
    const c0 = Math.floor((nx - r) / TS), c1 = Math.floor((nx + r) / TS);
    const r0 = Math.floor((nz - r) / TS), r1 = Math.floor((nz + r) / TS);
    let pushed = false;
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      if (!blockedCell(g, cc, rr, now, flying)) continue;
      const minX = cc * TS, maxX = minX + TS, minZ = rr * TS, maxZ = minZ + TS;
      const px = Math.max(minX, Math.min(nx, maxX));
      const pz = Math.max(minZ, Math.min(nz, maxZ));
      let ddx = nx - px, ddz = nz - pz;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 >= r * r) continue;
      if (d2 < 1e-8) {
        // центр внутри клетки — выталкиваем по направлению, откуда пришли
        ddx = x - (minX + TS / 2); ddz = z - (minZ + TS / 2);
        const l = Math.hypot(ddx, ddz) || 1;
        nx = minX + TS / 2 + (ddx / l) * (TS / 2 + r + 0.01);
        nz = minZ + TS / 2 + (ddz / l) * (TS / 2 + r + 0.01);
      } else {
        const d = Math.sqrt(d2);
        const push = r - d + 0.001;
        nx += (ddx / d) * push;
        nz += (ddz / d) * push;
      }
      pushed = true;
    }
    if (!pushed) break;
  }
  return [nx, nz];
}

// Прямая видимость по сетке (DDA).
export function lineOfSight(g: Grid, x0: number, z0: number, x1: number, z1: number): boolean {
  const dx = x1 - x0, dz = z1 - z0;
  const dist = Math.hypot(dx, dz);
  const steps = Math.ceil(dist / (TS * 0.25));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const c = Math.floor((x0 + dx * t) / TS), r = Math.floor((z0 + dz * t) / TS);
    if (shotBlocked(g, c, r)) return false;
  }
  return true;
}

// Луч до первой преграды: возвращает точку остановки (для «Скачка»).
export function castRay(g: Grid, x0: number, z0: number, x1: number, z1: number, now: number, r = 0.4): [number, number] {
  const dx = x1 - x0, dz = z1 - z0;
  const dist = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(dist / 0.2));
  let lx = x0, lz = z0;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const x = x0 + dx * t, z = z0 + dz * t;
    if (shotBlocked(g, Math.floor(x / TS), Math.floor(z / TS))) break;
    lx = x; lz = z;
  }
  // откатываемся назад до проходимой клетки
  for (let back = 0; back < 40; back++) {
    const c = Math.floor(lx / TS), rr = Math.floor(lz / TS);
    if (!blockedCell(g, c, rr, now) &&
      !blockedCell(g, Math.floor((lx + r) / TS), rr, now) && !blockedCell(g, Math.floor((lx - r) / TS), rr, now) &&
      !blockedCell(g, c, Math.floor((lz + r) / TS), now) && !blockedCell(g, c, Math.floor((lz - r) / TS), now)) break;
    lx -= (dx / (dist || 1)) * 0.2;
    lz -= (dz / (dist || 1)) * 0.2;
  }
  return [lx, lz];
}

// A* по клеткам, 8 направлений, без срезания углов.
export function findPath(g: Grid, x0: number, z0: number, x1: number, z1: number, now: number, maxNodes = 2500): [number, number][] | null {
  const sc = Math.floor(x0 / TS), sr = Math.floor(z0 / TS);
  let tc = Math.floor(x1 / TS), tr = Math.floor(z1 / TS);
  if (!inBounds(g, sc, sr) || !inBounds(g, tc, tr)) return null;
  if (blockedCell(g, tc, tr, now)) {
    // цель в стене — ищем ближайшую свободную соседнюю
    let found = false;
    for (let rad = 1; rad <= 2 && !found; rad++) for (let dr = -rad; dr <= rad && !found; dr++) for (let dc = -rad; dc <= rad && !found; dc++) {
      if (!blockedCell(g, tc + dc, tr + dr, now)) { tc += dc; tr += dr; found = true; }
    }
    if (!found) return null;
  }
  const W = g.w;
  const start = sr * W + sc, goal = tr * W + tc;
  if (start === goal) return [cellCenter(tc, tr)];
  const open: number[] = [start];
  const came = new Map<number, number>();
  const gs = new Map<number, number>([[start, 0]]);
  const fs = new Map<number, number>([[start, Math.hypot(tc - sc, tr - sr)]]);
  const closed = new Set<number>();
  let nodes = 0;
  while (open.length && nodes++ < maxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if ((fs.get(open[i]) ?? 1e9) < (fs.get(open[bi]) ?? 1e9)) bi = i;
    const cur = open[bi];
    open.splice(bi, 1);
    if (cur === goal) {
      const path: [number, number][] = [];
      let k: number | undefined = cur;
      while (k !== undefined && k !== start) {
        path.push(cellCenter(k % W, Math.floor(k / W)));
        k = came.get(k);
      }
      return path.reverse();
    }
    closed.add(cur);
    const cc = cur % W, cr = Math.floor(cur / W);
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dc && !dr) continue;
      const nc = cc + dc, nr = cr + dr;
      if (blockedCell(g, nc, nr, now)) continue;
      if (dc && dr && (blockedCell(g, cc + dc, cr, now) || blockedCell(g, cc, cr + dr, now))) continue;
      const ni = nr * W + nc;
      if (closed.has(ni)) continue;
      const ng = (gs.get(cur) ?? 0) + (dc && dr ? 1.414 : 1);
      if (ng < (gs.get(ni) ?? 1e9)) {
        came.set(ni, cur);
        gs.set(ni, ng);
        fs.set(ni, ng + Math.hypot(tc - nc, tr - nr));
        if (!open.includes(ni)) open.push(ni);
      }
    }
  }
  return null;
}
