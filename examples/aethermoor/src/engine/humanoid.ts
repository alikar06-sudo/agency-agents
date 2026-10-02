// Реалистичные персонажи: скелет из суставов, человеческие пропорции по полу и возрасту,
// голова с нарисованной кожей, глазами, веками, бровями, носом и губами, причёски, мантии.
// Детали одного сустава сливаются в один меш с цветами вершин — так персонаж рисуется за ~18 вызовов.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Appearance } from '@/data/types';

export interface CharacterRig {
  root: THREE.Group;
  body: THREE.Group;      // всё тело (покачивание, кувырок)
  head: THREE.Group;
  armL: THREE.Group;      // плечевые суставы
  armR: THREE.Group;
  robe: THREE.Object3D;
  wand: THREE.Group;
  wandTip: THREE.Object3D;
  hatSlot: THREE.Group;
  height: number;
  // суставы и лицо для анимации
  hips: THREE.Group; spine: THREE.Group; neck: THREE.Group;
  elbowL: THREE.Group; elbowR: THREE.Group;
  thighL: THREE.Group; thighR: THREE.Group; kneeL: THREE.Group; kneeR: THREE.Group;
  skirt: THREE.Group;
  lids: THREE.Group; jaw: THREE.Group; mouthIn: THREE.Object3D;
  age: NonNullable<Appearance['age']>; gender: 'm' | 'f';
  state: { blink: number; nextBlink: number; lookYaw: number; lookPitch: number; mouth: number; talk: number };
  setRobe(color: string, trim?: string): void;
  setHat(kind: Appearance['hat'], color?: string): void;
  setWandColor(color: string, glow: number): void;
  dispose(): void;
}

// ---------------- геометрия ----------------

const G = {
  sphere: new THREE.SphereGeometry(1, 20, 14),
  sphereLo: new THREE.SphereGeometry(1, 12, 9),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16, 1),
  cone: new THREE.ConeGeometry(1, 1, 18),
  capsule: new THREE.CapsuleGeometry(1, 1, 4, 10),
  torus: new THREE.TorusGeometry(1, 0.12, 8, 28),
  box: new THREE.BoxGeometry(1, 1, 1),
};

const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Голова в «единицах головы»: подбородок y=0, макушка y=1, лицо смотрит в +z.
// Нос, глазницы, скулы, губы и подбородок вылеплены прямо в сетке — без отдельных «шариков».
export const EYE = { x: 0.128, y: 0.56, z: 0.316, r: 0.056 };
let headGeo: THREE.BufferGeometry | null = null;
function headGeometry(): THREE.BufferGeometry {
  if (headGeo) return headGeo;
  const g = new THREE.SphereGeometry(1, 96, 72);
  const p = g.attributes.position as THREE.BufferAttribute;
  const gauss = (dx: number, dy: number, sx: number, sy: number) => Math.exp(-(dx * dx) / (sx * sx) - (dy * dy) / (sy * sy));
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const low = smooth(0.15, -1.0, y);
    let X = x * 0.34 * (1 - 0.3 * low);
    let Z = z * 0.43 * (z < 0 ? 1 - 0.36 * low : 1 - 0.06 * low);
    const Y = y * 0.5;
    if (z > 0) {
      const hx = X, hy = Y + 0.5;    // координаты в единицах головы
      const f = smooth(0.0, 0.45, z); // только лицевая сторона
      // скулы
      X *= 1 + 0.05 * gauss(Math.abs(hx) - 0.24, hy - 0.47, 0.07, 0.06) * f;
      // глазницы: углубление вокруг глаза и надбровная дуга над ним
      for (const sd of [-1, 1]) {
        Z -= 0.05 * gauss(hx - sd * EYE.x, hy - EYE.y, 0.07, 0.045) * f;
        Z += 0.012 * gauss(hx - sd * EYE.x, hy - 0.655, 0.09, 0.025) * f;
      }
      // нос: спинка от переносицы к кончику, крылья ноздрей
      const along = smooth(0.62, 0.42, hy) * (1 - smooth(0.4, 0.37, hy));
      Z += 0.085 * along * gauss(hx, 0, 0.035 + (0.6 - hy) * 0.06, 1) * f;
      Z += 0.03 * gauss(hx, hy - 0.405, 0.04, 0.03) * f;
      for (const sd of [-1, 1]) Z += 0.022 * gauss(hx - sd * 0.042, hy - 0.39, 0.025, 0.022) * f;
      // губы и ямка над верхней губой
      Z += 0.016 * gauss(hx, hy - 0.305, 0.075, 0.02) * f;
      Z += 0.018 * gauss(hx, hy - 0.265, 0.065, 0.022) * f;
      Z -= 0.008 * gauss(hx, hy - 0.284, 0.06, 0.006) * f;
      // подбородок
      Z += 0.035 * gauss(hx, hy - 0.07, 0.09, 0.07) * f;
    }
    p.setXYZ(i, X, Y + 0.5, Z);
  }
  g.computeVertexNormals();
  headGeo = g;
  return g;
}

// Делим голову на лицо (своя развёртка — проекция спереди, подробная текстура) и остальное.
let headParts: { face: THREE.BufferGeometry; rest: THREE.BufferGeometry } | null = null;
export function faceUV(x: number, y: number): [number, number] { return [0.5 + x / 0.74, y]; }
function splitHead(): { face: THREE.BufferGeometry; rest: THREE.BufferGeometry } {
  if (headParts) return headParts;
  const src = headGeometry().toNonIndexed();
  const pos = src.attributes.position as THREE.BufferAttribute;
  const nor = src.attributes.normal as THREE.BufferAttribute;
  const fp: number[] = [], fn: number[] = [], fu: number[] = [], rp: number[] = [], rn: number[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    let minZ = Infinity;
    for (let j = 0; j < 3; j++) minZ = Math.min(minZ, pos.getZ(i + j) - Math.abs(pos.getX(i + j)) * 0.35);
    const isFace = minZ > 0.02;
    for (let j = 0; j < 3; j++) {
      const x = pos.getX(i + j), y = pos.getY(i + j), z = pos.getZ(i + j);
      (isFace ? fp : rp).push(x, y, z);
      (isFace ? fn : rn).push(nor.getX(i + j), nor.getY(i + j), nor.getZ(i + j));
      if (isFace) fu.push(...faceUV(x, y));
    }
  }
  const face = new THREE.BufferGeometry();
  face.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
  face.setAttribute('normal', new THREE.Float32BufferAttribute(fn, 3));
  face.setAttribute('uv', new THREE.Float32BufferAttribute(fu, 2));
  const rest = new THREE.BufferGeometry();
  rest.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
  rest.setAttribute('normal', new THREE.Float32BufferAttribute(rn, 3));
  headParts = { face, rest };
  return headParts;
}

// Борода повторяет форму челюсти: нижняя часть лица и щёк, отверстие для рта, края — по сетке головы.
function beardShell(puff: number, kind: string): THREE.BufferGeometry {
  const src = headGeometry().toNonIndexed();
  const pos = src.attributes.position as THREE.BufferAttribute;
  const out: number[] = [];
  const v = new THREE.Vector3();
  // граница бороды: над ртом — усы до носа, по бокам поднимается к вискам; рот — эллипс
  const top = (x: number) => (kind === 'short' ? 0.335 : 0.35) + 0.15 * smooth(0.06, 0.3, Math.abs(x));
  const MX = 0.072, MY = 0.03, M0 = 0.285;
  const inside = (x: number, y: number, z: number) => y <= top(x) && z > -0.1 && !((x / MX) ** 2 + ((y - M0) / MY) ** 2 < 1 && z > 0.2);
  for (let i = 0; i < pos.count; i += 3) {
    let any = false;
    for (let j = 0; j < 3; j++) if (inside(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j))) any = true;
    if (!any) continue;
    for (let j = 0; j < 3; j++) {
      v.set(pos.getX(i + j), pos.getY(i + j), pos.getZ(i + j));
      // вершины за краем притягиваем к линии границы — край получается ровным, без «зубцов» сетки
      if (v.y > top(v.x)) v.y = top(v.x);
      const e = (v.x / MX) ** 2 + ((v.y - M0) / MY) ** 2;
      if (e < 1 && v.z > 0.2) { const k = 1 / Math.sqrt(Math.max(e, 1e-4)); v.x *= k; v.y = M0 + (v.y - M0) * k; }
      const lowK = Math.max(0, 0.3 - v.y) / 0.3;
      v.x *= puff; v.z = v.z * puff + lowK * 0.015 * (puff - 1) * 10; v.y -= lowK * 0.02 * (puff - 1) * 10;
      out.push(v.x, v.y, v.z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
  g.computeVertexNormals();
  const uv = new Float32Array((out.length / 3) * 2);
  for (let i = 0; i < out.length / 3; i++) { uv[i * 2] = out[i * 3] * 2 + 0.5; uv[i * 2 + 1] = out[i * 3 + 1]; }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}

// ---------------- текстуры ----------------

const texCache = new Map<string, THREE.Texture>();
function canvasTex(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.Texture {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return '#' + c.getHexString();
}

// Лицо в проекции спереди: u = 0.5 + x/0.74, v = y (подбородок внизу). Брови, ресницы, тени носа, губы, румянец, щетина.
function faceTexture(a: Appearance, gender: 'm' | 'f', age: string): THREE.Texture {
  const key = ['face', a.skin, a.hair, gender, age, a.beard ?? '', a.beardColor ?? ''].join('|');
  return canvasTex(key, 512, 512, (ctx) => {
    const W = 512, S = 512;
    const U = (x: number) => (0.5 + x / 0.74) * W;
    const V = (y: number) => (1 - y) * S;
    ctx.fillStyle = a.skin; ctx.fillRect(0, 0, W, S);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '120,60,45' : '255,235,215'},${Math.random() * 0.03})`;
      ctx.beginPath(); ctx.arc(Math.random() * W, Math.random() * S, 1 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
    }
    const blob = (x: number, y: number, rx: number, ry: number, rgb: string, alpha: number) => {
      const r = Math.max(rx, ry);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, `rgba(${rgb},${alpha})`); g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.save(); ctx.translate(x, y); ctx.scale(rx / r, ry / r); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    };
    const fem = gender === 'f';
    // тени и румянец
    for (const sd of [-1, 1]) {
      blob(U(sd * 0.25), V(0.44), 46, 34, '205,95,85', fem ? 0.26 : 0.14);
      blob(U(sd * EYE.x), V(EYE.y + 0.005), 44, 26, '80,45,45', 0.26);
      blob(U(sd * 0.05), V(0.48), 12, 46, '110,60,50', 0.13);     // тень у крыльев носа
      blob(U(sd * 0.2), V(0.18), 60, 40, '90,50,40', 0.08);       // скулы → челюсть
    }
    blob(U(0), V(0.5), 9, 50, '255,240,225', 0.16);                // блик на спинке носа
    blob(U(0), V(0.4), 22, 13, '200,100,90', 0.18);                 // кончик носа
    for (const sd of [-1, 1]) { ctx.fillStyle = 'rgba(60,25,20,0.55)'; ctx.beginPath(); ctx.ellipse(U(sd * 0.036), V(0.378), 6, 3.5, sd * 0.4, 0, Math.PI * 2); ctx.fill(); }
    // ресницы и линия века вокруг глаз
    const lash = fem ? 'rgba(25,15,15,0.85)' : 'rgba(40,25,20,0.6)';
    for (const sd of [-1, 1]) {
      const cx = U(sd * EYE.x), cy = V(EYE.y);
      const w = (EYE.r / 0.74) * W * 1.25, hgt = (EYE.r) * S * 0.75;
      ctx.strokeStyle = lash; ctx.lineWidth = fem ? 4 : 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx - w, cy + 2); ctx.quadraticCurveTo(cx, cy - hgt * 1.25, cx + w, cy + 1 - (fem ? 3 : 0)); ctx.stroke();
      ctx.strokeStyle = 'rgba(70,40,35,0.35)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - w * 0.9, cy + 3); ctx.quadraticCurveTo(cx, cy + hgt * 1.05, cx + w * 0.9, cy + 2); ctx.stroke();
      // складка века
      ctx.strokeStyle = 'rgba(90,50,45,0.25)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx - w * 0.9, cy - hgt * 0.9); ctx.quadraticCurveTo(cx, cy - hgt * 1.9, cx + w * 0.95, cy - hgt * 0.8); ctx.stroke();
    }
    // брови
    const browCol = new THREE.Color(a.hairStyle === 'bald' && a.beardColor ? a.beardColor : a.hair);
    for (const sd of [-1, 1]) {
      const x0 = U(sd * 0.065), x1 = U(sd * 0.225), yb = V(0.648);
      for (let i = 0; i < (fem ? 40 : 70); i++) {
        const t = Math.random();
        const x = x0 + (x1 - x0) * t, y = yb - Math.sin(t * Math.PI * 0.85) * 12 + (t * 6) + (Math.random() - 0.5) * (fem ? 4 : 7);
        ctx.strokeStyle = `rgba(${Math.round(browCol.r * 200)},${Math.round(browCol.g * 200)},${Math.round(browCol.b * 200)},${0.5 + Math.random() * 0.4})`;
        ctx.lineWidth = fem ? 1.6 : 2.2;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + sd * (4 + Math.random() * 4), y - 2 - Math.random() * 3); ctx.stroke();
      }
    }
    // губы: верхняя с «луком Купидона», нижняя полнее, тёмная линия смыкания
    const lip = new THREE.Color(a.skin).lerp(new THREE.Color(fem ? '#b0484a' : '#9a5048'), fem ? 0.55 : 0.4);
    const lipC = '#' + lip.getHexString();
    const mx = U(0), my = V(0.285), mw = (0.078 / 0.74) * W;
    ctx.fillStyle = lipC;
    ctx.beginPath();
    ctx.moveTo(mx - mw, my);
    ctx.bezierCurveTo(mx - mw * 0.6, my - 10, mx - mw * 0.25, my - 14, mx, my - 9);
    ctx.bezierCurveTo(mx + mw * 0.25, my - 14, mx + mw * 0.6, my - 10, mx + mw, my);
    ctx.bezierCurveTo(mx + mw * 0.55, my + 17, mx - mw * 0.55, my + 17, mx - mw, my);
    ctx.fill();
    blob(mx, my + 8, mw * 0.5, 6, '255,230,220', 0.18);
    ctx.strokeStyle = 'rgba(60,20,20,0.75)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(mx - mw, my); ctx.quadraticCurveTo(mx, my + 3, mx + mw, my); ctx.stroke();
    // щетина у взрослых мужчин без бороды
    if (!fem && (age === 'adult' || age === 'old') && (!a.beard || a.beard === 'none')) {
      for (let i = 0; i < 9000; i++) {
        const x = U((Math.random() - 0.5) * 0.6), y = V(0.04 + Math.random() * 0.32);
        if (Math.abs(x - mx) < mw * 1.05 && Math.abs(y - my) < 16) continue;
        if (Math.abs(x - mx) < 60 && y < V(0.33) && y > V(0.36)) continue;
        ctx.fillStyle = `rgba(45,38,42,${0.05 + Math.random() * 0.09})`;
        ctx.fillRect(x, y, 1.4, 1.4);
      }
    }
    // морщины
    if (age === 'old') {
      ctx.strokeStyle = 'rgba(90,50,40,0.3)'; ctx.lineWidth = 1.6;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(U(-0.16), V(0.78 + i * 0.035)); ctx.quadraticCurveTo(U(0), V(0.79 + i * 0.035), U(0.16), V(0.78 + i * 0.035)); ctx.stroke(); }
      for (const sd of [-1, 1]) {
        ctx.save(); ctx.strokeStyle = 'rgba(90,50,40,0.14)'; ctx.lineWidth = 1.2;
        for (let i = 0; i < 2; i++) { ctx.beginPath(); ctx.moveTo(U(sd * 0.205), V(0.56 - i * 0.025)); ctx.lineTo(U(sd * 0.235), V(0.555 - i * 0.04)); ctx.stroke(); }
        ctx.restore();
        ctx.beginPath(); ctx.moveTo(U(sd * 0.06), V(0.4)); ctx.quadraticCurveTo(U(sd * 0.1), V(0.33), U(sd * 0.095), V(0.25)); ctx.stroke();
      }
    }
    // веснушки у рыжих
    const hc = new THREE.Color(a.hair);
    if (hc.r > 0.6 && hc.g < 0.45 && age !== 'old') {
      for (let i = 0; i < 110; i++) {
        ctx.fillStyle = `rgba(150,75,45,${0.25 + Math.random() * 0.3})`;
        ctx.beginPath(); ctx.arc(U((Math.random() - 0.5) * 0.4), V(0.4 + Math.random() * 0.14), 1 + Math.random() * 1.6, 0, Math.PI * 2); ctx.fill();
      }
    }
  });
}

// Глаз: белок, радужка с прожилками и тёмным ободком, зрачок, блик. Радужка — в u=0.25 (смотрит в +z).
function eyeTexture(color: string, ghost: boolean): THREE.Texture {
  return canvasTex('eye|' + color + (ghost ? '|g' : ''), 128, 64, (ctx) => {
    ctx.fillStyle = ghost ? '#d8f4ff' : '#f2ede6';
    ctx.fillRect(0, 0, 128, 64);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    g.addColorStop(0.6, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(120,60,60,0.25)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 64);
    const ir = ctx.createRadialGradient(32, 32, 2, 32, 32, 11);
    ir.addColorStop(0, shade(color, 1.35)); ir.addColorStop(0.7, color); ir.addColorStop(1, shade(color, 0.45));
    ctx.fillStyle = ir; ctx.beginPath(); ctx.arc(32, 32, 11, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.6;
    for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(32 + Math.cos(a) * 4, 32 + Math.sin(a) * 4); ctx.lineTo(32 + Math.cos(a) * 10, 32 + Math.sin(a) * 10); ctx.stroke(); }
    ctx.fillStyle = ghost ? '#a8e8ff' : '#0c0a0a'; ctx.beginPath(); ctx.arc(32, 32, 4.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(29, 28.5, 1.8, 0, Math.PI * 2); ctx.fill();
  });
}

// Пряди волос: продольные штрихи разной яркости.
function hairTexture(color: string): THREE.Texture {
  return canvasTex('hair|' + color, 128, 128, (ctx) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 420; i++) {
      const x = Math.random() * 128, k = 0.7 + Math.random() * 0.6;
      ctx.strokeStyle = shade(color, k); ctx.globalAlpha = 0.35 + Math.random() * 0.4; ctx.lineWidth = 0.6 + Math.random() * 1.2;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.bezierCurveTo(x + 3, 40, x - 3, 90, x + Math.random() * 4, 128); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  });
}

// ---------------- материалы ----------------

const matCache = new Map<string, THREE.Material>();
function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = matCache.get(key) as T | undefined;
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}
const vcMat = () => cached('vc', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.02 }));
const vcClothMat = () => cached('vcCloth', () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, side: THREE.DoubleSide }));

// ---------------- сборка деталей ----------------

type Role = 'robe' | 'trim' | 'skin' | 'hair' | 'beard' | 'fixed';
interface Part { geo: THREE.BufferGeometry; role: Role; color: THREE.Color }

class Parts {
  list: Part[] = [];
  add(geo: THREE.BufferGeometry, role: Role, color: string | number, pos: [number, number, number], scale: [number, number, number] = [1, 1, 1], rot: [number, number, number] = [0, 0, 0]): this {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    this.addM(geo, role, color, m);
    return this;
  }
  addM(geo: THREE.BufferGeometry, role: Role, color: string | number, m: THREE.Matrix4): this {
    const g = geo.index ? geo.clone() : geo.clone();
    g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const geo2 = g.index ? g : g;
    this.list.push({ geo: geo2, role, color: new THREE.Color(color) });
    return this;
  }
  build(mat: THREE.Material): THREE.Mesh | null {
    if (!this.list.length) return null;
    const geos = this.list.map((p) => {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
      const n = g.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = p.color.r; col[i * 3 + 1] = p.color.g; col[i * 3 + 2] = p.color.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    });
    const merged = mergeGeometries(geos, false)!;
    const mesh = new THREE.Mesh(merged, mat);
    // диапазоны вершин по ролям — для перекраски мантии
    const ranges: { role: Role; start: number; count: number }[] = [];
    let off = 0;
    geos.forEach((g, i) => { ranges.push({ role: this.list[i].role, start: off, count: g.attributes.position.count }); off += g.attributes.position.count; });
    mesh.userData.ranges = ranges;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    return mesh;
  }
}

function recolor(mesh: THREE.Object3D, role: Role, color: string): void {
  const m = mesh as THREE.Mesh;
  const ranges = m.userData?.ranges as { role: Role; start: number; count: number }[] | undefined;
  if (!ranges) return;
  const c = new THREE.Color(color);
  const attr = m.geometry.attributes.color as THREE.BufferAttribute;
  for (const r of ranges) {
    if (r.role !== role) continue;
    for (let i = r.start; i < r.start + r.count; i++) attr.setXYZ(i, c.r, c.g, c.b);
  }
  attr.needsUpdate = true;
}

function joint(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// ---------------- персонаж ----------------

export function buildCharacter(a: Appearance, opts: { material?: THREE.Material; ghost?: boolean } = {}): CharacterRig {
  const gender = a.gender ?? 'm';
  const age = a.age ?? 'adult';
  const h = a.height ?? 1;
  const build = a.build ?? 1;
  const H = 1.78 * h;
  const headRatio = age === 'child' ? 1 / 5.6 : age === 'young' ? 1 / 6.9 : 1 / 7.3;
  const headH = H * headRatio;
  const fem = gender === 'f';
  const override = opts.material;
  const ghost = !!opts.ghost;

  const root = new THREE.Group();
  const body = joint(root, 0, 0, 0);
  const hipY = H * 0.53;
  const hips = joint(body, 0, hipY, 0);
  const spine = joint(hips, 0, 0, 0);

  // --- пропорции туловища (в долях роста)
  const k = (v: number) => v * H;
  // полнота сильнее сказывается на талии, чем на ширине плеч: крупный человек не превращается в шкаф
  const bw = 1 + (build - 1) * 0.5;
  const shoulderW = k(fem ? 0.098 : 0.11) * bw;
  const torsoTop = H - headH - k(0.045) - hipY;      // от тазобедренного сустава до плеч
  const rHip = k(fem ? 0.104 : 0.094) * bw;
  const rWaist = k(fem ? 0.078 : 0.09) * build;
  const rChest = k(fem ? 0.098 : 0.106) * (1 + (build - 1) * 0.75);
  const rShoulder = k(fem ? 0.096 : 0.108) * bw;
  const robeColor = a.robe;
  const trimColor = a.trim;
  const skin = a.skin;

  // --- туловище в мантии, воротник, планка, у учеников — рубашка и галстук
  const torso = new Parts();
  const prof = [
    new THREE.Vector2(rHip * 0.98, 0),
    new THREE.Vector2(rWaist, torsoTop * 0.36),
    new THREE.Vector2(rChest, torsoTop * 0.7),
    new THREE.Vector2(rShoulder, torsoTop * 0.92),
    new THREE.Vector2(rShoulder * 0.7, torsoTop * 1.0),
    new THREE.Vector2(k(0.04), torsoTop * 1.03),
  ];
  torso.add(new THREE.LatheGeometry(prof, 24), 'robe', robeColor, [0, 0, 0], [1, 1, 0.66]);
  for (const s of [-1, 1]) torso.add(G.sphere, 'robe', robeColor, [s * (shoulderW - k(0.012)), torsoTop * 0.92, 0], [k(0.044), k(0.036), k(0.046)]);
  torso.add(G.torus, 'trim', trimColor, [0, torsoTop * 1.0, 0], [k(0.045), k(0.045), k(0.11)], [Math.PI / 2, 0, 0]);
  torso.add(G.box, 'trim', trimColor, [0, torsoTop * 0.74, rChest * 0.66 * 0.97], [k(0.012), torsoTop * 0.34, k(0.006)]);
  if (age === 'young' || age === 'child') {
    torso.add(G.cone, 'fixed', '#efe9df', [0, torsoTop * 0.93, rChest * 0.6], [k(0.032), k(0.06), k(0.012)], [Math.PI, 0, 0]);
    torso.add(G.box, 'trim', trimColor, [0, torsoTop * 0.82, rChest * 0.64], [k(0.016), k(0.11), k(0.006)], [-0.08, 0, 0]);
  }
  const torsoMesh = torso.build(override ?? vcClothMat())!;
  spine.add(torsoMesh);

  // --- шея и голова
  const neck = joint(spine, 0, torsoTop * 0.98, -k(0.004));
  const neckParts = new Parts();
  neckParts.add(G.cyl, 'skin', skin, [0, headH * 0.16, 0], [k(0.028) * (fem ? 0.9 : 1.05), headH * 0.42, k(0.028) * (fem ? 0.9 : 1.05)]);
  neck.add(neckParts.build(override ?? vcMat())!);
  const head = joint(neck, 0, headH * 0.22, k(0.01));
  const headInner = joint(head, 0, 0, 0);
  headInner.scale.setScalar(headH);
  const skinKey = [a.skin, gender, age, a.beard ?? '', a.hair, a.beardColor ?? ''].join('|');
  const emiss = new THREE.Color(a.skin).multiplyScalar(0.06);
  const faceMat = override ?? cached('facemat|' + skinKey, () => new THREE.MeshStandardMaterial({ map: faceTexture(a, gender, age), roughness: 0.6, emissive: emiss }));
  const restMat = override ?? cached('skinplain|' + a.skin, () => new THREE.MeshStandardMaterial({ color: a.skin, roughness: 0.62, emissive: emiss }));
  const featMat = override ?? cached('skinfeat|' + a.skin, () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, emissive: emiss }));
  const hp = splitHead();
  const faceMesh = new THREE.Mesh(hp.face, faceMat);
  const restMesh = new THREE.Mesh(hp.rest, restMat);
  faceMesh.castShadow = restMesh.castShadow = true;
  headInner.add(faceMesh, restMesh);

  // уши
  const ears = new Parts();
  for (const s2 of [-1, 1]) {
    ears.add(G.sphere, 'skin', skin, [s2 * 0.33, 0.52, -0.02], [0.03, 0.1, 0.064], [0, s2 * 0.35, 0]);
    ears.add(G.sphere, 'skin', shade(skin, 0.85), [s2 * 0.345, 0.52, -0.015], [0.012, 0.07, 0.04], [0, s2 * 0.35, 0]);
  }
  headInner.add(ears.build(featMat)!);

  // глаза в глазницах
  const eyeMat = override ?? cached('eye|' + a.eyes + ghost, () => new THREE.MeshStandardMaterial({ map: eyeTexture(a.eyes, ghost), roughness: 0.12, emissive: ghost ? new THREE.Color(0x8ad8ff) : new THREE.Color(0x111111), emissiveIntensity: ghost ? 0.8 : 1 }));
  const eyes = new THREE.Group();
  for (const s2 of [-1, 1]) {
    const e = new THREE.Mesh(G.sphere, eyeMat);
    e.scale.setScalar(EYE.r);
    e.position.set(s2 * EYE.x, EYE.y, EYE.z);
    eyes.add(e);
  }
  headInner.add(eyes);
  // веки: верхнее моргает, нижнее неподвижно; вместе дают миндалевидный разрез
  const lids = joint(headInner, 0, EYE.y, EYE.z);
  const lidUp = new Parts();
  const capUp = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.42);
  for (const s2 of [-1, 1]) lidUp.add(capUp, 'skin', skin, [s2 * EYE.x, 0, 0], [EYE.r * 1.07, EYE.r * 1.07, EYE.r * 1.07]);
  lids.add(lidUp.build(featMat)!);
  lids.rotation.x = 0.05;
  const lidLow = new Parts();
  const capLow = new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, Math.PI * 0.68, Math.PI * 0.32);
  for (const s2 of [-1, 1]) lidLow.add(capLow, 'skin', skin, [s2 * EYE.x, EYE.y, EYE.z], [EYE.r * 1.06, EYE.r * 1.06, EYE.r * 1.06], [-0.25, 0, 0]);
  headInner.add(lidLow.build(featMat)!);

  // рот: тёмная щель открывается при речи, нижняя губа опускается
  const jaw = joint(headInner, 0, 0.285, 0.402);
  const mouthIn = new THREE.Mesh(G.sphereLo, override ?? cached('mouthIn', () => new THREE.MeshBasicMaterial({ color: 0x2a0c0c })));
  mouthIn.scale.set(0.05, 0.001, 0.012);
  jaw.add(mouthIn);

  // волосы, борода, очки
  const hairCol = a.hair;
  const hairMat = override ?? cached('hairmat|' + hairCol, () => new THREE.MeshStandardMaterial({ map: hairTexture(hairCol), roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide }));
  const hairParts: THREE.BufferGeometry[] = [];
  const addHair = (geo: THREE.BufferGeometry, pos: [number, number, number], scale: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
    const g = geo.clone().applyMatrix4(m);
    hairParts.push(g.index ? g.toNonIndexed() : g);
  };
  const hs = a.hairStyle;
  if (hs !== 'bald') {
    // шапка волос: линия роста надо лбом, сзади ниже
    const cap = new THREE.SphereGeometry(1, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.53);
    addHair(cap, [0, 0.6, -0.025], [0.365, 0.46, 0.46], [-0.52, 0, 0]);
    // пряди у висков
    for (const s of [-1, 1]) addHair(G.sphere, [s * 0.3, 0.62, 0.08], [0.07, 0.17, 0.14], [0, 0, s * 0.12]);
    if (hs === 'long' || hs === 'wild') {
      const sheet = new THREE.CylinderGeometry(0.34, hs === 'wild' ? 0.46 : 0.4, 1, 28, 1, true, Math.PI * 0.4, Math.PI * 1.2);
      addHair(sheet, [0, hs === 'wild' ? 0.35 : 0.22, -0.04], [1, hs === 'wild' ? 0.7 : 1.0, 1.08]);
      for (const s of [-1, 1]) addHair(G.capsule, [s * 0.3, 0.3, 0.12], [0.06, 0.38, 0.05], [0.1, 0, s * 0.08]);
    }
    if (hs === 'curly' || hs === 'wild') {
      // кудри: шапка с плотным рельефом мелких завитков (смещение вершин по нормали)
      const curls = new THREE.SphereGeometry(1, 64, 32, 0, Math.PI * 2, 0, Math.PI * 0.56);
      const cp = curls.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < cp.count; i++) {
        const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i);
        const n = Math.sin(x * 31 + y * 7) * Math.sin(y * 29 - z * 5) * Math.sin(z * 33 + x * 9);
        const k = 1.06 + 0.07 * Math.abs(n) + 0.03 * Math.sin(x * 13) * Math.cos(z * 11);
        cp.setXYZ(i, x * k, y * k, z * k);
      }
      curls.computeVertexNormals();
      addHair(curls, [0, 0.6, -0.03], [0.37, hs === 'wild' ? 0.5 : 0.48, 0.48], [-0.5, 0, 0]);
      if (hs === 'wild') for (let i = 0; i < 9; i++) { const t = (i / 9) * Math.PI * 2; addHair(G.cone, [Math.cos(t) * 0.28, 0.95, Math.sin(t) * 0.3 - 0.08], [0.06, 0.2, 0.06], [Math.sin(t) * 0.8, 0, -Math.cos(t) * 0.8]); }
    }
    if (hs === 'bun') addHair(G.sphere, [0, 0.95, -0.3], [0.16, 0.15, 0.15]);
    if (hs === 'tied') {
      addHair(G.sphereLo, [0, 0.7, -0.42], [0.07, 0.07, 0.07]);
      addHair(G.capsule, [0, 0.35, -0.48], [0.055, 0.5, 0.055], [0.22, 0, 0]);
    }
    if (hs === 'short') addHair(G.sphere, [0, 0.93, 0.12], [0.3, 0.1, 0.26], [0.35, 0, 0]);
  } else if (age === 'old' || gender === 'm') {
    // венчик волос вокруг лысины
    const ring = new THREE.CylinderGeometry(0.345, 0.33, 0.22, 28, 1, true, Math.PI * 0.5, Math.PI);
    addHair(ring, [0, 0.62, -0.02], [1, 1, 1.22]);
  }
  const beardCol = a.beardColor ?? a.hair;
  if (a.beard && a.beard !== 'none') {
    const bg = beardShell(a.beard === 'wild' ? 1.12 : a.beard === 'long' ? 1.08 : 1.05, a.beard);
    const beardGeo: THREE.BufferGeometry[] = [];
    const addB = (geo: THREE.BufferGeometry, pos: [number, number, number], scale: [number, number, number], rot: [number, number, number] = [0, 0, 0]) => {
      const m = new THREE.Matrix4().compose(new THREE.Vector3(...pos), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(...scale));
      const g = geo.clone().applyMatrix4(m);
      beardGeo.push(g.index ? g.toNonIndexed() : g);
    };
    // челюстная часть смотрит вперёд: сегмент сферы повёрнут к лицу
    beardGeo.push(bg);
    if (a.beard === 'long') addB(G.cone, [0, -0.2, 0.25], [0.2, 0.75, 0.13], [Math.PI + 0.25, 0, 0]);
    if (a.beard === 'wild') { addB(G.sphereLo, [0, 0.08, 0.3], [0.26, 0.2, 0.18]); addB(G.cone, [0, -0.12, 0.27], [0.18, 0.4, 0.12], [Math.PI + 0.2, 0, 0]); }
    const bm = new THREE.Mesh(mergeGeometries(beardGeo.map((g) => { for (const k2 of Object.keys(g.attributes)) if (k2 !== 'position' && k2 !== 'normal' && k2 !== 'uv') g.deleteAttribute(k2); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); return g; }), false)!, override ?? cached('hairmat|' + beardCol, () => new THREE.MeshStandardMaterial({ map: hairTexture(beardCol), roughness: 0.6, side: THREE.DoubleSide })));
    bm.castShadow = true;
    headInner.add(bm);
  }
  if (hairParts.length) {
    for (const g of hairParts) { for (const k2 of Object.keys(g.attributes)) if (k2 !== 'position' && k2 !== 'normal' && k2 !== 'uv') g.deleteAttribute(k2); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
    const hm = new THREE.Mesh(mergeGeometries(hairParts, false)!, hairMat);
    hm.castShadow = true;
    headInner.add(hm);
  }
  if (a.ears === 'pointed') {
    const ep = new Parts();
    for (const s of [-1, 1]) ep.add(G.cone, 'skin', skin, [s * 0.4, 0.62, -0.02], [0.04, 0.2, 0.05], [0, 0, -s * 1.15]);
    headInner.add(ep.build(override ?? vcMat())!);
  }
  if (a.glasses) {
    const gp = new Parts();
    for (const s of [-1, 1]) {
      gp.add(G.torus, 'fixed', '#2a2620', [s * 0.135, 0.56, 0.405], [0.075, 0.075, 0.25]);
      gp.add(G.box, 'fixed', '#2a2620', [s * 0.24, 0.575, 0.2], [0.008, 0.012, 0.38], [0, s * 0.15, 0]);
    }
    gp.add(G.box, 'fixed', '#2a2620', [0, 0.57, 0.42], [0.06, 0.01, 0.01]);
    const gm = gp.build(override ?? cached('glassesVc', () => new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.8, roughness: 0.3 })))!;
    headInner.add(gm);
  }
  const hatSlot = joint(headInner, 0, 0.9, -0.02);

  // --- руки: плечо, локоть, кисть
  const upperLen = k(0.18), foreLen = k(0.15);
  const armR0 = fem ? k(0.026) : k(0.031);
  const mkArm = (side: number) => {
    const sh = joint(spine, side * shoulderW, torsoTop * 0.9, 0);
    const up = new Parts();
    up.add(G.cyl, 'robe', robeColor, [0, -upperLen / 2, 0], [armR0 * 1.25, upperLen, armR0 * 1.25]);
    up.add(G.sphere, 'robe', robeColor, [0, -upperLen, 0], [armR0 * 1.15, armR0 * 1.15, armR0 * 1.15]);
    sh.add(up.build(override ?? vcClothMat())!);
    const el = joint(sh, 0, -upperLen, 0);
    const fo = new Parts();
    // широкий рукав-колокол и манжета
    fo.add(new THREE.CylinderGeometry(1.0, 1.75, 1, 18, 1, true), 'robe', robeColor, [0, -foreLen * 0.48, 0], [armR0 * 1.15, foreLen * 0.96, armR0 * 1.15]);
    fo.add(G.torus, 'trim', trimColor, [0, -foreLen * 0.96, 0], [armR0 * 1.95, armR0 * 1.95, armR0 * 1.2], [Math.PI / 2, 0, 0]);
    // кисть: ладонь, четыре пальца и большой палец
    const hy = -foreLen - k(0.032);
    fo.add(G.sphere, 'skin', skin, [0, hy, 0], [k(0.02), k(0.034), k(0.011)]);
    for (let i = 0; i < 4; i++) fo.add(G.capsule, 'skin', skin, [(i - 1.5) * k(0.0105) * side, hy - k(0.042) + Math.abs(i - 1.5) * k(0.004), k(0.004)], [k(0.0047), k(0.012) * (i === 3 ? 0.8 : 1), k(0.0047)], [0.25, 0, 0]);
    fo.add(G.capsule, 'skin', skin, [-side * k(0.02), hy - k(0.014), k(0.008)], [k(0.0055), k(0.01), k(0.0055)], [0.2, 0, side * 0.5]);
    el.add(fo.build(override ?? vcClothMat())!);
    sh.rotation.z = side * 0.08;
    return { sh, el, handY: hy };
  };
  const L = mkArm(-1);
  const R = mkArm(1);

  // жезл в правой руке
  const wand = new THREE.Group();
  wand.position.set(0, R.handY - k(0.02), k(0.012));
  wand.rotation.x = Math.PI / 2 + 0.25;
  const shaftMat = cached('wand|#6a4a2a', () => new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.55 }));
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(k(0.004), k(0.0065), k(0.21), 8).translate(0, k(0.09), 0), shaftMat);
  wand.add(shaft);
  const tipM = new THREE.MeshBasicMaterial({ color: 0xfff0c0 });
  const tip = new THREE.Mesh(G.sphereLo, tipM);
  tip.scale.setScalar(k(0.008));
  tip.position.set(0, k(0.2), 0);
  wand.add(tip);
  const wandTip = new THREE.Object3D();
  wandTip.position.set(0, k(0.21), 0);
  wand.add(wandTip);
  R.el.add(wand);
  wand.visible = false;

  // --- ноги под мантией: бедро, голень, сапог
  const thighLen = hipY - k(0.04) - k(0.25), shinLen = k(0.25);
  const mkLeg = (side: number) => {
    const th = joint(hips, side * k(0.05) * build, 0, 0);
    const tp = new Parts();
    tp.add(G.cyl, 'fixed', '#2a2622', [0, -thighLen / 2, 0], [k(0.045) * build, thighLen, k(0.045) * build]);
    th.add(tp.build(override ?? vcMat())!);
    const kn = joint(th, 0, -thighLen, 0);
    const sp = new Parts();
    sp.add(G.cyl, 'fixed', '#2a2622', [0, -shinLen / 2, 0], [k(0.034), shinLen, k(0.034)]);
    sp.add(G.sphere, 'fixed', '#3a2618', [0, -shinLen - k(0.012), k(0.03)], [k(0.035), k(0.026), k(0.075)]);
    kn.add(sp.build(override ?? vcMat())!);
    return { th, kn };
  };
  const LL = mkLeg(-1);
  const RL = mkLeg(1);

  // --- юбка мантии: от бёдер до щиколоток, раскачивается при ходьбе
  const skirt = joint(hips, 0, 0, 0);
  const sk = new Parts();
  const hemY = -(hipY - k(fem ? 0.05 : 0.065));
  const hemR = k(fem ? 0.17 : 0.155) * (0.9 + build * 0.1);
  sk.add(new THREE.LatheGeometry([
    new THREE.Vector2(hemR, hemY), new THREE.Vector2(hemR * 0.93, hemY * 0.7), new THREE.Vector2(rHip * 1.12, hemY * 0.25), new THREE.Vector2(rHip * 0.99, 0.002),
  ], 26), 'robe', robeColor, [0, 0, 0], [1, 1, 0.78]);
  sk.add(G.torus, 'trim', trimColor, [0, hemY + k(0.004), 0], [hemR, hemR * 0.78, k(0.08)], [Math.PI / 2, 0, 0]);
  skirt.add(sk.build(override ?? vcClothMat())!);

  const rig: CharacterRig = {
    root, body, head, armL: L.sh, armR: R.sh, robe: torsoMesh, wand, wandTip, hatSlot, height: H,
    hips, spine, neck, elbowL: L.el, elbowR: R.el, thighL: LL.th, thighR: RL.th, kneeL: LL.kn, kneeR: RL.kn, skirt,
    lids, jaw, mouthIn, age, gender,
    state: { blink: 0, nextBlink: 1 + Math.random() * 3, lookYaw: 0, lookPitch: 0, mouth: 0, talk: 0 },
    setRobe(color: string, trim?: string) {
      if (override) return;
      root.traverse((o) => { recolor(o, 'robe', color); if (trim) recolor(o, 'trim', trim); });
    },
    setHat(kind, color = '#2a2430') {
      hatSlot.clear();
      if (!kind || kind === 'none') return;
      const hp = new Parts();
      const c = color;
      if (kind === 'pointed' || kind === 'tall') {
        const tall = kind === 'tall' ? 1.5 : 1.0;
        hp.add(G.cyl, 'fixed', c, [0, -0.02, 0], [0.62, 0.035, 0.62]);
        hp.add(G.cone, 'fixed', c, [0.04, tall / 2, 0], [0.38, tall, 0.38], [0, 0, 0.14]);
        hp.add(G.cyl, 'fixed', shade(c, 0.6), [0, 0.04, 0], [0.39, 0.07, 0.39]);
      } else if (kind === 'cap') {
        hp.add(G.sphere, 'fixed', c, [0, -0.08, 0.02], [0.4, 0.2, 0.47]);
      } else if (kind === 'hood') {
        const hood = new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.72);
        hp.add(hood, 'fixed', c, [0, -0.25, -0.06], [0.44, 0.58, 0.52], [-0.55, 0, 0]);
      } else if (kind === 'crown') {
        hp.add(G.cyl, 'fixed', '#d8b050', [0, -0.05, 0], [0.37, 0.07, 0.42]);
        for (let i = 0; i < 9; i++) { const t = (i / 9) * Math.PI * 2; hp.add(G.cone, 'fixed', '#d8b050', [Math.cos(t) * 0.36, 0.05, Math.sin(t) * 0.41], [0.04, 0.16, 0.04]); }
      }
      const m = hp.build(override ?? vcClothMat());
      if (m) hatSlot.add(m);
    },
    setWandColor(color: string, glow: number) {
      shaft.material = cached('wand|' + color, () => new THREE.MeshStandardMaterial({ color, roughness: 0.5 }));
      tipM.color.setHex(glow);
    },
    dispose() { root.removeFromParent(); },
  };
  rig.setHat(a.hat ?? 'none');
  return rig;
}

// ---------------- анимация ----------------

export interface AnimExtra { mouth?: number; lookYaw?: number; lookPitch?: number; talk?: number }

// Ходьба с работой коленей и рук, дыхание, перенос веса, моргание, взгляд, речь, каст, кувырок.
export function animateCharacter(rig: CharacterRig, t: number, moving: number, cast: number, dodge: number, dt: number, extra: AnimExtra = {}): void {
  const st = rig.state;
  const old = rig.age === 'old';
  const pace = old ? 6.6 : 8.2;
  const ph = t * pace;
  const m = moving;
  const sL = Math.sin(ph), sR = Math.sin(ph + Math.PI);
  // ноги
  rig.thighL.rotation.x = -sL * 0.48 * m;
  rig.thighR.rotation.x = -sR * 0.48 * m;
  rig.kneeL.rotation.x = Math.max(0, Math.sin(ph - 1.1)) * 0.85 * m;
  rig.kneeR.rotation.x = Math.max(0, Math.sin(ph + Math.PI - 1.1)) * 0.85 * m;
  // таз, корпус, юбка
  const H = rig.height;
  rig.body.position.y = (Math.abs(Math.cos(ph)) * 0.022 * m - 0.012 * m) * H + Math.sin(t * 1.7) * 0.0015 * H;
  rig.hips.rotation.y = sL * 0.07 * m;
  rig.spine.rotation.y = -sL * 0.1 * m;
  rig.hips.rotation.z = Math.sin(t * 0.45) * 0.015 * (1 - m);
  rig.spine.rotation.x = (old ? 0.13 : 0.02) + m * 0.05;
  rig.spine.scale.y = 1 + Math.sin(t * 1.8) * 0.006;
  rig.skirt.rotation.x = Math.sin(ph * 2) * 0.03 * m - 0.02 * m;
  rig.skirt.rotation.z = sL * 0.02 * m;
  // руки: мах в противофазе ногам, локти слегка согнуты
  const talk = extra.talk ?? 0;
  const armSwing = 0.38 * m;
  rig.armL.rotation.x += ((sL * armSwing + talk * Math.sin(t * 1.9) * 0.08) - rig.armL.rotation.x) * Math.min(1, dt * 12);
  rig.elbowL.rotation.x = -0.18 - m * 0.22 - talk * (0.35 + Math.sin(t * 2.3) * 0.25);
  const castTarget = -1.4 * cast;
  const rTarget = cast > 0 ? castTarget : sR * armSwing - talk * (0.25 + Math.sin(t * 1.6 + 1) * 0.15);
  rig.armR.rotation.x += (rTarget - rig.armR.rotation.x) * Math.min(1, dt * 14);
  rig.elbowR.rotation.x = cast > 0 ? -0.15 : -0.2 - m * 0.22 - talk * (0.45 + Math.sin(t * 2.0 + 2) * 0.3);
  // взгляд и голова
  const ly = extra.lookYaw ?? Math.sin(t * 0.6) * 0.18 * (1 - m);
  const lp = extra.lookPitch ?? 0;
  st.lookYaw += (Math.max(-1.0, Math.min(1.0, ly)) - st.lookYaw) * Math.min(1, dt * 4);
  st.lookPitch += (lp - st.lookPitch) * Math.min(1, dt * 4);
  rig.head.rotation.y = st.lookYaw;
  rig.head.rotation.x = st.lookPitch + (old ? -0.1 : 0) + talk * Math.sin(t * 3.1) * 0.04;
  rig.neck.rotation.x = -(old ? 0.08 : 0);
  // моргание
  st.nextBlink -= dt;
  if (st.nextBlink <= 0) { st.blink = 0.16; st.nextBlink = 2 + Math.random() * 4; }
  if (st.blink > 0) st.blink -= dt;
  const closed = st.blink > 0 ? Math.sin((st.blink / 0.16) * Math.PI) : 0;
  rig.lids.rotation.x = 0.05 + closed * 0.85;
  // губы: открытость рта от голоса
  const mouth = extra.mouth ?? 0;
  st.mouth += (mouth - st.mouth) * Math.min(1, dt * 18);
  rig.jaw.position.y = 0.285 - st.mouth * 0.012;
  rig.mouthIn.scale.y = 0.001 + st.mouth * 0.022;
  // кувырок
  rig.body.rotation.x = dodge > 0 ? Math.sin(dodge * Math.PI) * -0.9 : 0;
  if (dodge > 0) rig.body.position.y -= Math.sin(dodge * Math.PI) * 0.25 * H;
}
