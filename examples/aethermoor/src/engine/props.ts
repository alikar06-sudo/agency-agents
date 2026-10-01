// Статичные декорации собираются в инстансы: одна отрисовка на тип детали вместо сотен.
import * as THREE from 'three';
import { colorMat, withCutaway, stdMat } from './materials';
import { bookshelfTexture } from './textures';
import { sharedGeo as G } from './models';

export interface LightSource {
  x: number; y: number; z: number;
  color: number;
  intensity: number;
  distance: number;
  flicker: number;
  glow?: number;     // размер ореола
  kind?: string;
  id?: string;
  on?: boolean;
}

interface BatchGroup { geo: THREE.BufferGeometry; mat: THREE.Material | THREE.Material[]; mats: THREE.Matrix4[]; colors: THREE.Color[] | null; shadow: boolean }

export class Batcher {
  private groups = new Map<string, BatchGroup>();
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private sv = new THREE.Vector3();

  add(key: string, geo: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], pos: [number, number, number], scale: [number, number, number], rot: [number, number, number] = [0, 0, 0], color?: THREE.Color, shadow = true): void {
    let g = this.groups.get(key);
    if (!g) { g = { geo, mat, mats: [], colors: color ? [] : null, shadow }; this.groups.set(key, g); }
    this.e.set(rot[0], rot[1], rot[2]);
    this.q.setFromEuler(this.e);
    this.m.compose(this.v.set(pos[0], pos[1], pos[2]), this.q, this.sv.set(scale[0], scale[1], scale[2]));
    g.mats.push(this.m.clone());
    if (g.colors) g.colors.push(color ?? new THREE.Color(1, 1, 1));
  }

  build(): THREE.Group {
    const root = new THREE.Group();
    for (const g of this.groups.values()) {
      const im = new THREE.InstancedMesh(g.geo, g.mat, g.mats.length);
      g.mats.forEach((m, i) => im.setMatrixAt(i, m));
      if (g.colors) g.colors.forEach((c, i) => im.setColorAt(i, c));
      im.castShadow = g.shadow;
      im.receiveShadow = true;
      im.instanceMatrix.needsUpdate = true;
      im.computeBoundingSphere();
      root.add(im);
    }
    return root;
  }
}

// Локальные преобразования детали относительно центра пропа с поворотом ry.
function place(cx: number, cz: number, ry: number, lx: number, ly: number, lz: number): [number, number, number] {
  const c = Math.cos(ry), s = Math.sin(ry);
  return [cx + lx * c + lz * s, ly, cz - lx * s + lz * c];
}

const M = {
  wood: () => colorMat(0x5a3a22, { rough: 0.85 }),
  woodDark: () => colorMat(0x3a2414, { rough: 0.85 }),
  woodCut: () => colorMat(0x5a3a22, { rough: 0.85, cut: true }),
  stone: () => colorMat(0x8a8274, { rough: 0.95, flat: true }),
  stoneCut: () => colorMat(0x8a8274, { rough: 0.95, cut: true }),
  iron: () => colorMat(0x2a2a2e, { rough: 0.45, metal: 0.7 }),
  gold: () => colorMat(0xc8a050, { rough: 0.35, metal: 0.8 }),
  candle: () => colorMat(0xf0e6cc, { rough: 0.6 }),
  flame: () => stdMat('flame', () => new THREE.MeshBasicMaterial({ color: 0xffc060 })),
  leaf: () => stdMat('leafcut', () => withCutaway(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }))),
  trunk: () => colorMat(0x4a3220, { rough: 1, cut: true }),
  books: () => stdMat('bookshelf', () => {
    const tex = bookshelfTexture();
    const side = new THREE.MeshStandardMaterial({ color: 0x3a2416, roughness: 0.9 });
    const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    return [withCutaway(side), withCutaway(side.clone()), withCutaway(side.clone()), side, withCutaway(front), withCutaway(side.clone())] as unknown as THREE.Material;
  }) as unknown as THREE.Material[],
  cloth: (c: number) => colorMat(c, { rough: 0.95 }),
  water: () => stdMat('fountainwater', () => new THREE.MeshStandardMaterial({ color: 0x4a8ab0, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.8, emissive: 0x0a2030 })),
  potion: (c: number) => colorMat(c, { rough: 0.2, emissive: c, ei: 0.35 }),
  hedge: () => colorMat(0x2f5a30, { rough: 0.95, flat: true }),
  flower: () => stdMat('flower', () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })),
  grass: () => stdMat('grasstuft', () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, flatShading: true })),
};

export interface PropContext {
  b: Batcher;
  lights: LightSource[];
  rnd: () => number;
  wallH: number;
  circleColors: number[];
  season: 'autumn' | 'winter';
}

export function buildProp(ch: string, x: number, z: number, ry: number, ctx: PropContext): void {
  const { b, rnd } = ctx;
  switch (ch) {
    case 'T': { // сосна
      const s = 0.85 + rnd() * 0.45;
      b.add('trunk', G.cylLo, M.trunk(), [x, 0.8 * s, z], [0.2 * s, 1.6 * s, 0.2 * s]);
      const greens = ctx.season === 'winter' ? [0x2e4a3a, 0x3a5a48] : [0x24452c, 0x2e5534, 0x1e3c28];
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Color(greens[Math.floor(rnd() * greens.length)]);
        b.add('pine', G.coneLo, M.leaf(), [x, (1.6 + i * 1.0) * s, z], [(1.35 - i * 0.32) * s, 1.7 * s, (1.35 - i * 0.32) * s], [0, rnd() * 3, 0], c);
      }
      if (ctx.season === 'winter') b.add('pinesnow', G.coneLo, M.leaf(), [x, 3.75 * s, z], [0.5 * s, 0.6 * s, 0.5 * s], [0, 0, 0], new THREE.Color(0xe8eef8));
      break;
    }
    case 'Y': { // лиственное дерево в осенних красках
      const s = 0.85 + rnd() * 0.4;
      b.add('trunk', G.cylLo, M.trunk(), [x, 1.1 * s, z], [0.26 * s, 2.2 * s, 0.26 * s]);
      const autumn = ctx.season === 'winter' ? [0x6a5a4a, 0x7a6a5a] : [0xc8642a, 0xd89a2a, 0x9a3a1e, 0x6a8a2e, 0xe0b040];
      for (let i = 0; i < 4; i++) {
        const c = new THREE.Color(autumn[Math.floor(rnd() * autumn.length)]);
        const ox = (rnd() - 0.5) * 1.2 * s, oz = (rnd() - 0.5) * 1.2 * s;
        const r = (0.8 + rnd() * 0.5) * s;
        b.add('oak', G.ico, M.leaf(), [x + ox, (2.5 + rnd() * 0.9) * s, z + oz], [r, r * 0.85, r], [rnd() * 3, rnd() * 3, 0], c);
      }
      break;
    }
    case 'B': { // книжный шкаф
      const [px, , pz] = place(x, z, ry, 0, 0, -0.55);
      b.add('shelf', G.box, M.books(), [px, 1.45, pz], [1.95, 2.9, 0.7], [0, ry, 0]);
      break;
    }
    case 't': { // стол
      b.add('tabletop', G.box, M.wood(), [x, 0.82, z], [1.9, 0.1, 1.15], [0, ry, 0]);
      for (const [lx, lz] of [[-0.8, -0.45], [0.8, -0.45], [-0.8, 0.45], [0.8, 0.45]]) {
        const p = place(x, z, ry, lx, 0.4, lz);
        b.add('tableleg', G.box, M.woodDark(), p, [0.1, 0.8, 0.1], [0, ry, 0]);
      }
      const r = rnd();
      if (r < 0.45) {
        const p = place(x, z, ry, (rnd() - 0.5) * 1.2, 0.98, (rnd() - 0.5) * 0.5);
        b.add('candle', G.cylLo, M.candle(), p, [0.05, 0.22, 0.05]);
        b.add('flame', G.sphereLo, M.flame(), [p[0], 1.14, p[2]], [0.035, 0.07, 0.035], [0, 0, 0], undefined, false);
        ctx.lights.push({ x: p[0], y: 1.2, z: p[2], color: 0xffb060, intensity: 0.8, distance: 6, flicker: 0.25, glow: 0.7, kind: 'candle' });
      } else if (r < 0.75) {
        const p = place(x, z, ry, (rnd() - 0.5) * 1.2, 0.92, (rnd() - 0.5) * 0.5);
        b.add('tbook', G.box, colorMat([0x7a2a24, 0x2a4a6a, 0x3a5a2a][Math.floor(rnd() * 3)]), p, [0.32, 0.08, 0.42], [0, rnd() * 3, 0]);
      } else {
        for (let i = 0; i < 2; i++) {
          const p = place(x, z, ry, (rnd() - 0.5) * 1.3, 0.95, (rnd() - 0.5) * 0.6);
          b.add('plate', G.cylLo, M.gold(), p, [0.16, 0.02, 0.16]);
          b.add('goblet', G.cylLo, M.gold(), [p[0] + 0.22, 0.98, p[2]], [0.04, 0.16, 0.04]);
        }
      }
      break;
    }
    case 'b': { // кровать с балдахином
      const col = ctx.circleColors[Math.floor(rnd() * ctx.circleColors.length)];
      b.add('bedframe', G.box, M.woodDark(), [x, 0.35, z], [1.2, 0.3, 1.9], [0, ry, 0]);
      b.add('mattress', G.box, M.cloth(0xe8e0d0), [x, 0.55, z], [1.1, 0.16, 1.8], [0, ry, 0]);
      const bl = place(x, z, ry, 0, 0.66, 0.25);
      b.add('blanket', G.box, M.cloth(col), bl, [1.14, 0.1, 1.2], [0, ry, 0]);
      const pl = place(x, z, ry, 0, 0.68, -0.65);
      b.add('pillow', G.box, M.cloth(0xf4f0e6), pl, [0.7, 0.14, 0.32], [0, ry, 0]);
      for (const [lx, lz] of [[-0.55, -0.9], [0.55, -0.9], [-0.55, 0.9], [0.55, 0.9]]) {
        const p = place(x, z, ry, lx, 1.2, lz);
        b.add('bedpost', G.cylLo, M.woodDark(), p, [0.05, 2.4, 0.05]);
      }
      const can = place(x, z, ry, 0, 2.42, 0);
      b.add('canopy', G.box, M.cloth(col), can, [1.2, 0.06, 1.9], [0, ry, 0]);
      break;
    }
    case 'P': { // колонна
      const h = ctx.wallH;
      b.add('pillar', G.cyl, M.stoneCut(), [x, h / 2, z], [0.42, h, 0.42]);
      b.add('pillarbase', G.box, M.stoneCut(), [x, 0.2, z], [1.05, 0.4, 1.05]);
      b.add('pillartop', G.box, M.stoneCut(), [x, h - 0.2, z], [1.05, 0.4, 1.05]);
      break;
    }
    case 'r': { // камень
      const s = 0.5 + rnd() * 0.6;
      b.add('rock', G.ico, M.stone(), [x + (rnd() - 0.5) * 0.4, s * 0.5, z + (rnd() - 0.5) * 0.4], [s * 1.2, s, s * 1.1], [rnd() * 3, rnd() * 3, rnd() * 3], new THREE.Color().setHSL(0.1, 0.05, 0.4 + rnd() * 0.2));
      if (rnd() < 0.5) b.add('rock', G.ico, M.stone(), [x + 0.5, s * 0.3, z - 0.4], [s * 0.6, s * 0.5, s * 0.5], [rnd() * 3, rnd() * 3, 0], new THREE.Color().setHSL(0.1, 0.05, 0.35 + rnd() * 0.2));
      break;
    }
    case 'x': { // ящик или бочка
      if (rnd() < 0.5) {
        b.add('crate', G.box, M.wood(), [x, 0.45, z], [0.9, 0.9, 0.9], [0, rnd(), 0]);
        if (rnd() < 0.5) b.add('crate', G.box, M.wood(), [x + 0.1, 1.2, z], [0.6, 0.6, 0.6], [0, rnd(), 0]);
      } else {
        b.add('barrel', G.cyl, M.wood(), [x, 0.55, z], [0.42, 1.1, 0.42]);
        b.add('barrelring', G.cyl, M.iron(), [x, 0.85, z], [0.44, 0.06, 0.44]);
        b.add('barrelring', G.cyl, M.iron(), [x, 0.25, z], [0.44, 0.06, 0.44]);
      }
      break;
    }
    case 'h': { // куст
      for (let i = 0; i < 3; i++) {
        const c = new THREE.Color().setHSL(0.28 + rnd() * 0.05, 0.4, 0.2 + rnd() * 0.08);
        b.add('bush', G.ico, M.leaf(), [x + (rnd() - 0.5) * 0.8, 0.55, z + (rnd() - 0.5) * 0.8], [0.7, 0.6, 0.7], [rnd() * 3, rnd() * 3, 0], c);
      }
      break;
    }
    case 'S': { // статуя основателя
      b.add('pedestal', G.box, M.stoneCut(), [x, 0.5, z], [1.2, 1.0, 1.2]);
      b.add('statuebody', G.cone, M.stoneCut(), [x, 1.95, z], [0.5, 1.9, 0.5], [0, 0, 0]);
      b.add('statuehead', G.sphere, M.stoneCut(), [x, 3.05, z], [0.24, 0.28, 0.24]);
      b.add('statuehat', G.cone, M.stoneCut(), [x, 3.5, z], [0.24, 0.6, 0.24]);
      b.add('statuestaff', G.cylLo, M.stoneCut(), [x + 0.45, 2.1, z + 0.1], [0.05, 2.6, 0.05]);
      break;
    }
    case 'F': { // фонтан
      b.add('fbasin', G.cyl, M.stone(), [x, 0.3, z], [1.7, 0.6, 1.7]);
      b.add('fwater', G.cyl, M.water(), [x, 0.55, z], [1.5, 0.08, 1.5], [0, 0, 0], undefined, false);
      b.add('fpillar', G.cyl, M.stone(), [x, 1.2, z], [0.25, 1.6, 0.25]);
      b.add('fbowl', G.cyl, M.stone(), [x, 1.9, z], [0.7, 0.18, 0.7]);
      b.add('fwater', G.cyl, M.water(), [x, 2.0, z], [0.6, 0.05, 0.6], [0, 0, 0], undefined, false);
      ctx.lights.push({ x, y: 1.5, z, color: 0x6ab0ff, intensity: 0.5, distance: 6, flicker: 0, glow: 0, kind: 'fountain' });
      break;
    }
    case 'k': { // котёл
      b.add('cauldron', G.sphere, M.iron(), [x, 0.55, z], [0.6, 0.5, 0.6]);
      b.add('cauldronrim', G.cyl, M.iron(), [x, 0.95, z], [0.55, 0.08, 0.55]);
      b.add('brew', G.cyl, M.potion(0x5ae07a), [x, 0.98, z], [0.5, 0.03, 0.5], [0, 0, 0], undefined, false);
      ctx.lights.push({ x, y: 1.2, z, color: 0x6aff8a, intensity: 0.6, distance: 5, flicker: 0.15, glow: 0.9, kind: 'brew' });
      break;
    }
    case 'c': { // канделябр
      b.add('candpole', G.cylLo, M.iron(), [x, 0.9, z], [0.05, 1.8, 0.05]);
      b.add('candbase', G.cylLo, M.iron(), [x, 0.05, z], [0.3, 0.1, 0.3]);
      b.add('candarm', G.box, M.iron(), [x, 1.75, z], [0.8, 0.05, 0.05]);
      for (const ox of [-0.38, 0, 0.38]) {
        b.add('candle', G.cylLo, M.candle(), [x + ox, 1.92, z], [0.05, 0.25, 0.05]);
        b.add('flame', G.sphereLo, M.flame(), [x + ox, 2.1, z], [0.04, 0.08, 0.04], [0, 0, 0], undefined, false);
      }
      ctx.lights.push({ x, y: 2.1, z, color: 0xffb060, intensity: 1.4, distance: 9, flicker: 0.3, glow: 1.4, kind: 'candelabra' });
      break;
    }
    case 'l': { // фонарный столб / жаровня
      b.add('lamppost', G.cylLo, M.iron(), [x, 1.3, z], [0.07, 2.6, 0.07]);
      b.add('lampcage', G.box, M.iron(), [x, 2.75, z], [0.32, 0.4, 0.32]);
      b.add('lampglass', G.box, stdMat('lampglass', () => new THREE.MeshBasicMaterial({ color: 0xffd080 })), [x, 2.75, z], [0.24, 0.32, 0.24], [0, 0, 0], undefined, false);
      ctx.lights.push({ x, y: 2.75, z, color: 0xffc070, intensity: 1.8, distance: 12, flicker: 0.12, glow: 1.8, kind: 'lamp' });
      break;
    }
    case '*': { // цветы
      for (let i = 0; i < 6; i++) {
        const c = new THREE.Color([0xe8d060, 0xe86a8a, 0xd0d8ff, 0xb070e0, 0xffffff][Math.floor(rnd() * 5)]);
        b.add('flower', G.sphereLo, M.flower(), [x + (rnd() - 0.5) * 1.6, 0.18, z + (rnd() - 0.5) * 1.6], [0.08, 0.08, 0.08], [0, 0, 0], c, false);
        b.add('stem', G.cylLo, colorMat(0x3a6a2a), [x + (rnd() - 0.5) * 1.6, 0.08, z + (rnd() - 0.5) * 1.6], [0.02, 0.16, 0.02], [0, 0, 0], undefined, false);
      }
      break;
    }
    case '"': { // высокая трава
      for (let i = 0; i < 7; i++) {
        const c = new THREE.Color().setHSL(0.22 + rnd() * 0.08, 0.45, 0.25 + rnd() * 0.15);
        const hgt = 0.4 + rnd() * 0.5;
        b.add('tuft', G.coneLo, M.grass(), [x + (rnd() - 0.5) * 1.7, hgt / 2, z + (rnd() - 0.5) * 1.7], [0.08, hgt, 0.08], [(rnd() - 0.5) * 0.4, 0, (rnd() - 0.5) * 0.4], c, false);
      }
      break;
    }
    case 'n': { // скамья
      b.add('bench', G.box, M.wood(), [x, 0.45, z], [1.8, 0.08, 0.45], [0, ry, 0]);
      for (const lx of [-0.75, 0.75]) b.add('benchleg', G.box, M.woodDark(), place(x, z, ry, lx, 0.22, 0), [0.08, 0.44, 0.4], [0, ry, 0]);
      break;
    }
    case 'G': { // решётка
      for (let i = -3; i <= 3; i++) {
        const p = place(x, z, ry, i * 0.28, 1.4, 0);
        b.add('bar', G.cylLo, M.iron(), p, [0.04, 2.8, 0.04]);
      }
      b.add('barh', G.box, M.iron(), [x, 2.6, z], [2, 0.08, 0.08], [0, ry, 0]);
      b.add('barh', G.box, M.iron(), [x, 0.4, z], [2, 0.08, 0.08], [0, ry, 0]);
      break;
    }
    case 'f': { // забор
      for (const lx of [-0.8, 0, 0.8]) b.add('fencepost', G.box, M.wood(), place(x, z, ry, lx, 0.55, 0), [0.12, 1.1, 0.12], [0, ry, 0]);
      b.add('fencerail', G.box, M.wood(), [x, 0.8, z], [2, 0.08, 0.06], [0, ry, 0]);
      b.add('fencerail', G.box, M.wood(), [x, 0.4, z], [2, 0.08, 0.06], [0, ry, 0]);
      break;
    }
    case 'R': { // обломки
      for (let i = 0; i < 4; i++) {
        const s = 0.3 + rnd() * 0.5;
        b.add('rubble', G.box, M.stone(), [x + (rnd() - 0.5) * 1.4, s * 0.4, z + (rnd() - 0.5) * 1.4], [s * 1.4, s * 0.8, s], [rnd(), rnd() * 3, rnd()], new THREE.Color().setHSL(0.1, 0.06, 0.38 + rnd() * 0.15));
      }
      break;
    }
    case 'u': { // стела / надгробие
      b.add('stele', G.box, M.stoneCut(), [x, 0.8, z], [0.8, 1.6, 0.25], [0, ry, (rnd() - 0.5) * 0.15]);
      break;
    }
  }
}

export const SOLID_PROPS = new Set(['T', 'Y', 'B', 't', 'b', 'P', 'r', 'x', 'h', 'S', 'F', 'k', 'c', 'l', 'n', 'G', 'f', 'R', 'u']);
// Пропы, сквозь которые проходят снаряды (низкие).
export const LOW_PROPS = new Set(['t', 'b', 'r', 'x', 'h', 'F', 'k', 'n', 'f', 'R', 'u']);
