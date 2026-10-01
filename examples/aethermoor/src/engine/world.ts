// Сборка зоны из ASCII-карты: пол, стены, декор, вода, маркеры, источники света, мини-карта.
import * as THREE from 'three';
import type { MarkerDef, ZoneDef } from '@/data/types';
import { floorTexture, wallTexture, wallTopTexture, waterNormal, windowTexture, bannerTexture, signTexture } from './textures';
import type { FloorStyle, WallStyle } from './textures';
import { withCutaway, colorMat, stdMat } from './materials';
import { Batcher, buildProp, SOLID_PROPS, LOW_PROPS } from './props';
import type { LightSource } from './props';
import { sharedGeo as SG } from './models';
import { CIRCLES } from '@/data/world';

export const TS = 2; // размер тайла в мировых единицах

export const WALL_CHARS = new Set(['#', 'H', '!', '|', 'o']);
const TERRAIN = new Set(['.', '=', '-', ',', ':', ';', 's', '~', 'w', '_']);

export interface Grid {
  w: number; h: number;
  walk: Uint8Array;   // 1 — непроходимо
  shot: Uint8Array;   // 1 — блокирует снаряды
  water: Uint8Array;  // 1 — глубокая вода, 2 — мелководье
  wall: Uint8Array;   // 1 — стена
  floor: string[];    // стиль пола (для звука шагов)
  ice: Float32Array;  // до какого времени (сек движка) клетка заморожена
  dyn: Uint8Array;    // динамические преграды (двери, паутина, блоки)
}

export interface MarkerInstance {
  key: string;
  ch: string;
  def: MarkerDef;
  col: number; row: number;
  x: number; z: number;
  facing: number;
}

export interface BuiltZone {
  def: ZoneDef;
  group: THREE.Group;
  grid: Grid;
  markers: MarkerInstance[];
  lights: LightSource[];
  minimap: HTMLCanvasElement;
  waterMat: THREE.MeshStandardMaterial | null;
  width: number; depth: number;
  wallH: number;
  dispose(): void;
}

export function cellIndex(g: Grid, col: number, row: number): number { return row * g.w + col; }
export function worldToCell(x: number, z: number): [number, number] { return [Math.floor(x / TS), Math.floor(z / TS)]; }
export function cellCenter(col: number, row: number): [number, number] { return [col * TS + TS / 2, row * TS + TS / 2]; }

function themeFloor(def: ZoneDef, ch: string, snow: boolean): FloorStyle | null {
  switch (ch) {
    case '.': {
      switch (def.theme) {
        case 'castle': return 'flag';
        case 'library': return 'wood';
        case 'tower': return 'stone';
        case 'dungeon': return 'dungeon';
        case 'ruins': return 'ruins';
        case 'sanctum': return 'sanctum';
        default: return snow ? 'snow' : 'grass';
      }
    }
    case '=': return 'wood';
    case '-': return 'carpet';
    case ',': return snow && def.outdoor ? 'snow' : 'grass';
    case ':': return 'dirt';
    case ';': return 'cobble';
    case 's': return 'sand';
    case 'w': return 'sand';
    case '~': return null;
    case '_': return null;
    default: return null;
  }
}

function wallStyleOf(def: ZoneDef): WallStyle {
  switch (def.theme) {
    case 'castle': return 'castle';
    case 'library': return 'library';
    case 'tower': return 'tower';
    case 'dungeon': return 'dungeon';
    case 'ruins': return 'ruins';
    case 'sanctum': return 'sanctum';
    case 'village': return 'village';
    case 'forest': return 'ruins';
    case 'lake': return 'ruins';
    default: return 'castle';
  }
}

const BLOCKING_MARKERS = new Set(['chest', 'block', 'web', 'gate', 'station', 'bed', 'board', 'waystone', 'crystal', 'brazier', 'door']);
const SHOT_BLOCKING_MARKERS = new Set(['block', 'web', 'gate', 'door']);

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const wallMatCache = new Map<string, THREE.Material[]>();
function wallMaterials(style: WallStyle, height: number): THREE.Material[] {
  const key = style + height;
  let m = wallMatCache.get(key);
  if (m) return m;
  const tex = wallTexture(style).clone();
  tex.repeat.set(1, height / TS);
  tex.needsUpdate = true;
  const side = withCutaway(new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, color: 0xffffff }));
  const top = withCutaway(new THREE.MeshStandardMaterial({ map: wallTopTexture(), roughness: 1, color: 0x6a6258 }));
  m = [side, side, top, top, side, side];
  wallMatCache.set(key, m);
  return m;
}

const floorMatCache = new Map<string, THREE.Material>();
function floorMaterial(style: FloorStyle): THREE.Material {
  let m = floorMatCache.get(style);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ map: floorTexture(style), roughness: style === 'marble' ? 0.35 : 0.95, metalness: 0 });
    floorMatCache.set(style, m);
  }
  return m;
}

const planeGeo = new THREE.PlaneGeometry(TS, TS).rotateX(-Math.PI / 2);
const boxGeo = new THREE.BoxGeometry(TS, 1, TS).translate(0, 0.5, 0);

export interface BuildOptions { snow: boolean; seed?: number }

export function buildZone(def: ZoneDef, opts: BuildOptions): BuiltZone {
  const rows = def.map;
  const h = rows.length;
  const w = Math.max(...rows.map((r) => r.length));
  const n = w * h;
  const grid: Grid = {
    w, h,
    walk: new Uint8Array(n), shot: new Uint8Array(n), water: new Uint8Array(n), wall: new Uint8Array(n),
    floor: new Array(n).fill('stone'), ice: new Float32Array(n), dyn: new Uint8Array(n),
  };
  const group = new THREE.Group();
  group.name = 'zone_' + def.id;
  const wallH = def.wallHeight ?? (def.outdoor ? 3.2 : 3.6);
  const tallH = 10;
  const style = wallStyleOf(def);
  const rnd = rng((opts.seed ?? 1) * 7919 + def.id.length * 104729);
  const lights: LightSource[] = [];
  const markers: MarkerInstance[] = [];
  const counts = new Map<string, number>();
  const batch = new Batcher();
  const circleColors = Object.values(CIRCLES).map((c) => new THREE.Color(c.color).getHex());
  const propCtx = { b: batch, lights, rnd, wallH, circleColors, season: opts.snow ? 'winter' as const : 'autumn' as const };

  const charAt = (c: number, r: number): string => (r >= 0 && r < h && c >= 0 && c < w ? rows[r][c] ?? '_' : '#');
  const isWallCh = (ch: string) => WALL_CHARS.has(ch);

  const floors = new Map<FloorStyle, [number, number][]>();
  const walls: [number, number][] = [];
  const tall: [number, number][] = [];
  const waterCells: [number, number][] = [];
  const shallow: [number, number][] = [];

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const ch = charAt(c, r);
      const i = r * w + c;
      const [x, z] = cellCenter(c, r);
      if (ch === '_') { grid.walk[i] = 1; continue; }
      if (isWallCh(ch)) {
        grid.walk[i] = 1; grid.shot[i] = 1; grid.wall[i] = 1;
        if (ch === 'H') tall.push([c, r]); else walls.push([c, r]);
        continue;
      }
      let floorCh = ch;
      const marker = def.markers[ch];
      if (!TERRAIN.has(ch)) floorCh = marker?.floor ?? def.floor;
      if (ch === 'Q') floorCh = def.floor;
      if (floorCh === '~') { grid.water[i] = 1; grid.walk[i] = 1; waterCells.push([c, r]); grid.floor[i] = 'water'; }
      else {
        if (floorCh === 'w') { grid.water[i] = 2; shallow.push([c, r]); }
        const fs = themeFloor(def, floorCh, opts.snow);
        if (fs) {
          if (!floors.has(fs)) floors.set(fs, []);
          floors.get(fs)!.push([c, r]);
          grid.floor[i] = floorCh === 'w' ? 'water' : fs;
        }
      }
      if (marker) {
        const cnt = counts.get(ch) ?? 0;
        counts.set(ch, cnt + 1);
        const key = cnt === 0 ? marker.id : `${marker.id}_${cnt}`;
        markers.push({ key, ch, def: marker, col: c, row: r, x, z, facing: marker.facing ?? facingFromWalls(c, r) });
        if (BLOCKING_MARKERS.has(marker.kind)) grid.walk[i] = 1;
        if (SHOT_BLOCKING_MARKERS.has(marker.kind)) grid.shot[i] = 1;
        if (marker.kind === 'secret' && marker.prop === 'wall') { grid.walk[i] = 1; grid.shot[i] = 1; }
      } else if (SOLID_PROPS.has(ch) || ch === 'Q') {
        grid.walk[i] = 1;
        if (!LOW_PROPS.has(ch)) grid.shot[i] = 1;
        buildProp(ch, x, z, facingFromWalls(c, r), propCtx);
        if (ch === 'Q') buildTower(batch, x, z, lights, rnd);
      } else if (ch === '*' || ch === '"') {
        buildProp(ch, x, z, 0, propCtx);
      }
    }
  }

  function facingFromWalls(c: number, r: number): number {
    // Поворот пропа «спиной к стене»: 0 — смотрит на юг (+z, к камере).
    if (isWallCh(charAt(c, r - 1))) return 0;
    if (isWallCh(charAt(c - 1, r))) return Math.PI / 2;
    if (isWallCh(charAt(c + 1, r))) return -Math.PI / 2;
    if (isWallCh(charAt(c, r + 1))) return Math.PI;
    return 0;
  }

  // ---------- полы ----------
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();
  for (const [fs, cells] of floors) {
    const im = new THREE.InstancedMesh(planeGeo, floorMaterial(fs), cells.length);
    cells.forEach(([c, r], k) => {
      const [x, z] = cellCenter(c, r);
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, ((c * 7 + r * 13) % 4) * (Math.PI / 2), 0);
      dummy.updateMatrix();
      im.setMatrixAt(k, dummy.matrix);
      const v = 0.86 + rnd() * 0.22;
      im.setColorAt(k, col.setRGB(v, v, v));
    });
    im.receiveShadow = true;
    group.add(im);
  }

  // Земля за краем карты (на улице), чтобы мир не обрывался в пустоту.
  if (def.outdoor) {
    const groundTex = floorTexture(opts.snow ? 'snow' : 'grass').clone();
    groundTex.repeat.set((w * TS + 160) / TS, (h * TS + 160) / TS);
    groundTex.needsUpdate = true;
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(w * TS + 160, h * TS + 160).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, color: 0x9a9a9a }),
    );
    ground.position.set((w * TS) / 2, -0.03, (h * TS) / 2);
    ground.receiveShadow = true;
    group.add(ground);
  } else {
    const under = new THREE.Mesh(new THREE.PlaneGeometry(w * TS + 60, h * TS + 60).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x050407 }));
    under.position.set((w * TS) / 2, -0.05, (h * TS) / 2);
    group.add(under);
  }

  // ---------- стены ----------
  const addWalls = (cells: [number, number][], height: number) => {
    if (!cells.length) return;
    const im = new THREE.InstancedMesh(boxGeo, wallMaterials(style, height), cells.length);
    cells.forEach(([c, r], k) => {
      const [x, z] = cellCenter(c, r);
      dummy.position.set(x, 0, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, height, 1);
      dummy.updateMatrix();
      im.setMatrixAt(k, dummy.matrix);
      const v = 0.82 + rnd() * 0.25;
      im.setColorAt(k, col.setRGB(v, v * 0.98, v * 0.95));
    });
    dummy.scale.set(1, 1, 1);
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
  };
  addWalls(walls, wallH);
  addWalls(tall, tallH);

  // ---------- украшения стен: факелы, окна, знамёна ----------
  const decoSide = (c: number, r: number): [number, number] | null => {
    // приоритет — южная грань (её видно камере)
    const dirs: [number, number][] = [[0, 1], [-1, 0], [1, 0], [0, -1]];
    for (const [dc, dr] of dirs) {
      const ch = charAt(c + dc, r + dr);
      if (!isWallCh(ch) && ch !== '_' && ch !== '~') return [dc, dr];
    }
    return null;
  };
  const winTex = windowTexture();
  const windowMat = stdMat('windowpane', () => new THREE.MeshStandardMaterial({ map: winTex, emissiveMap: winTex, emissive: 0xffffff, emissiveIntensity: 1, color: 0x222222, roughness: 0.3, transparent: false }));
  const torchMetal = colorMat(0x2a2420, { metal: 0.6, rough: 0.5 });
  const flameMat = stdMat('torchflame', () => new THREE.MeshBasicMaterial({ color: 0xffb050 }));
  let bannerIdx = 0;
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const ch = charAt(c, r);
    if (ch !== '!' && ch !== '|' && ch !== 'o') continue;
    const side = decoSide(c, r);
    if (!side) continue;
    const [x, z] = cellCenter(c, r);
    const fx = x + side[0] * (TS / 2 + 0.02);
    const fz = z + side[1] * (TS / 2 + 0.02);
    const ry = Math.atan2(side[0], side[1]);
    if (ch === '!') {
      batch.add('sconce', SG.box, torchMetal, [fx + side[0] * 0.12, 2.05, fz + side[1] * 0.12], [0.12, 0.4, 0.12], [side[1] * 0.4, 0, -side[0] * 0.4]);
      batch.add('torchflame', SG.sphereLo, flameMat, [fx + side[0] * 0.25, 2.4, fz + side[1] * 0.25], [0.1, 0.2, 0.1], [0, 0, 0], undefined, false);
      lights.push({ x: fx + side[0] * 0.6, y: 2.4, z: fz + side[1] * 0.6, color: 0xff9a40, intensity: 2.2, distance: 11, flicker: 0.35, glow: 1.6, kind: 'torch' });
    } else if (ch === '|') {
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.3), windowMat);
      pane.position.set(fx, 1.85, fz);
      pane.rotation.y = ry;
      group.add(pane);
      lights.push({ x: fx + side[0] * 1.5, y: 2.2, z: fz + side[1] * 1.5, color: 0xbfd4ff, intensity: 1, distance: 9, flicker: 0, glow: 0, kind: 'window' });
    } else if (ch === 'o') {
      const ids = Object.values(CIRCLES);
      const circle = ids[bannerIdx++ % ids.length];
      const tex = bannerTexture(circle.color, circle.trim, bannerIdx % 4 === 0 ? 3 : (bannerIdx - 1) % 4);
      const banner = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), stdMat('banner_' + circle.color, () => new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.3, roughness: 0.9, side: THREE.DoubleSide })));
      banner.position.set(fx, 2.2, fz);
      banner.rotation.y = ry;
      group.add(banner);
    }
  }

  // Освещённые окна на высоких стенах фасада.
  if (tall.length) {
    const winGlow = stdMat('facadewin', () => new THREE.MeshBasicMaterial({ color: 0xffc070 }));
    for (const [c, r] of tall) {
      if (isWallCh(charAt(c, r + 1))) continue;
      const [x, z] = cellCenter(c, r);
      for (let k = 0; k < 2; k++) {
        if (rnd() < 0.35) continue;
        batch.add('facadewin', SG.box, winGlow, [x + (rnd() - 0.5) * 1.0, 4 + rnd() * 5, z + TS / 2 + 0.02], [0.35, 0.6, 0.04], [0, 0, 0], undefined, false);
      }
    }
  }

  // ---------- вода ----------
  let waterMat: THREE.MeshStandardMaterial | null = null;
  if (waterCells.length || shallow.length) {
    const nrm = waterNormal();
    waterMat = new THREE.MeshStandardMaterial({
      color: 0x1e4a5e, roughness: 0.08, metalness: 0.3, normalMap: nrm, normalScale: new THREE.Vector2(0.5, 0.5),
      transparent: true, opacity: 0.88, emissive: 0x06141c,
    });
    const all = [...waterCells.map((c) => [c, -0.18] as const), ...shallow.map((c) => [c, 0.04] as const)];
    const im = new THREE.InstancedMesh(planeGeo, waterMat, all.length);
    all.forEach(([[c, r], y], k) => {
      const [x, z] = cellCenter(c, r);
      dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
      im.setMatrixAt(k, dummy.matrix);
    });
    im.receiveShadow = true;
    group.add(im);
    if (waterCells.length) {
      const bed = new THREE.InstancedMesh(planeGeo, new THREE.MeshStandardMaterial({ color: 0x0c1a20, roughness: 1 }), waterCells.length);
      waterCells.forEach(([c, r], k) => {
        const [x, z] = cellCenter(c, r);
        dummy.position.set(x, -0.9, z); dummy.updateMatrix();
        bed.setMatrixAt(k, dummy.matrix);
      });
      group.add(bed);
    }
  }

  // таблички с текстом
  for (const m of markers) {
    if (m.def.kind === 'interact' && m.def.prop === 'sign' && m.def.label) {
      const sign = new THREE.Group();
      const post = new THREE.Mesh(SG.cylLo, colorMat(0x4a3220));
      post.scale.set(0.06, 1.4, 0.06); post.position.y = 0.7;
      const board = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 0.06), [colorMat(0x4a3220), colorMat(0x4a3220), colorMat(0x4a3220), colorMat(0x4a3220),
        new THREE.MeshStandardMaterial({ map: signTexture(m.def.label) }), colorMat(0x4a3220)]);
      board.position.y = 1.45;
      sign.add(post, board);
      sign.position.set(m.x, 0, m.z);
      sign.rotation.y = m.facing;
      sign.traverse((o) => { o.castShadow = true; });
      group.add(sign);
    }
  }

  group.add(batch.build());

  // ---------- мини-карта ----------
  const minimap = renderMinimap(def, grid, rows, w, h);

  return {
    def, group, grid, markers, lights, minimap, waterMat,
    width: w * TS, depth: h * TS, wallH,
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if ((m as THREE.InstancedMesh).isInstancedMesh) (m as THREE.InstancedMesh).dispose();
      });
      group.removeFromParent();
    },
  };
}

function buildTower(b: Batcher, x: number, z: number, lights: LightSource[], rnd: () => number): void {
  const stone = colorMat(0x8a8070, { rough: 0.95, cut: true });
  const roof = colorMat(0x2e3440, { rough: 0.7, cut: true });
  const glow = stdMat('towerwin', () => new THREE.MeshBasicMaterial({ color: 0xffc070 }));
  const hgt = 12 + rnd() * 5;
  b.add('towerbody', SG.cyl, stone, [x, hgt / 2, z], [1.9, hgt, 1.9]);
  b.add('towerrim', SG.cyl, stone, [x, hgt + 0.2, z], [2.2, 0.5, 2.2]);
  b.add('towerroof', SG.cone, roof, [x, hgt + 3.2, z], [2.4, 6, 2.4]);
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 2 + (rnd() - 0.5) * 1.2;
    const y = 4 + rnd() * (hgt - 6);
    b.add('towerwin', SG.box, glow, [x + Math.cos(a) * 1.9, y, z + Math.sin(a) * 1.9], [0.35, 0.6, 0.1], [0, -a, 0], undefined, false);
  }
  lights.push({ x, y: hgt + 0.5, z: z + 2, color: 0xffb060, intensity: 0, distance: 1, flicker: 0, glow: 0, kind: 'decor' });
}

function renderMinimap(def: ZoneDef, grid: Grid, rows: string[], w: number, h: number): HTMLCanvasElement {
  const S = 4;
  const c = document.createElement('canvas');
  c.width = w * S; c.height = h * S;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = def.outdoor ? '#1c2418' : '#0c0a0e';
  ctx.fillRect(0, 0, c.width, c.height);
  for (let r = 0; r < h; r++) for (let col = 0; col < w; col++) {
    const ch = rows[r][col] ?? '_';
    const i = r * w + col;
    let color: string | null = null;
    if (ch === '_') continue;
    if (grid.wall[i]) color = def.outdoor ? '#6a6050' : '#8a7a60';
    else if (grid.water[i] === 1) color = '#24506a';
    else if (grid.water[i] === 2) color = '#3a6a80';
    else if (ch === 'T' || ch === 'Y' || ch === 'h') color = '#2a4a26';
    else if (SOLID_PROPS.has(ch) || ch === 'Q') color = '#4a4038';
    else {
      const f = grid.floor[i];
      color = f === 'grass' ? '#3a5230' : f === 'dirt' ? '#5a4a34' : f === 'cobble' ? '#5a5650' : f === 'wood' ? '#5a4030'
        : f === 'carpet' ? '#6a2a2a' : f === 'snow' ? '#c8d0dc' : f === 'sand' ? '#8a7a5a' : '#4a4640';
    }
    ctx.fillStyle = color;
    ctx.fillRect(col * S, r * S, S, S);
  }
  return c;
}
