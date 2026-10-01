// Модели персонажей и существ, собранные из примитивов. Стиль — «кукольная» низкополигональность с мягким светом.
import * as THREE from 'three';
import type { Appearance } from '@/data/types';
import { colorMat, glowMat } from './materials';

const geo = {
  sphere: new THREE.SphereGeometry(1, 18, 14),
  sphereLo: new THREE.SphereGeometry(1, 10, 8),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 12),
  cylLo: new THREE.CylinderGeometry(1, 1, 1, 7),
  cone: new THREE.ConeGeometry(1, 1, 14),
  coneLo: new THREE.ConeGeometry(1, 1, 7),
  torus: new THREE.TorusGeometry(1, 0.12, 6, 20),
  ico: new THREE.IcosahedronGeometry(1, 0),
};

function robeGeometry(flare = 1): THREE.LatheGeometry {
  const pts: THREE.Vector2[] = [];
  const prof: [number, number][] = [[0.0, 0], [0.42 * flare, 0.02], [0.44 * flare, 0.08], [0.36, 0.5], [0.3, 0.85], [0.26, 1.05], [0.2, 1.18], [0.0, 1.2]];
  for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 16);
}
const robeGeos = new Map<number, THREE.LatheGeometry>();
function robeGeo(flare: number): THREE.LatheGeometry {
  const k = Math.round(flare * 10);
  let g = robeGeos.get(k);
  if (!g) { g = robeGeometry(k / 10); robeGeos.set(k, g); }
  return g;
}

function mesh(g: THREE.BufferGeometry, m: THREE.Material, sx = 1, sy = 1, sz = 1, x = 0, y = 0, z = 0): THREE.Mesh {
  const me = new THREE.Mesh(g, m);
  me.scale.set(sx, sy, sz);
  me.position.set(x, y, z);
  me.castShadow = true;
  return me;
}

export interface CharacterRig {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  robe: THREE.Mesh;
  wand: THREE.Group;
  wandTip: THREE.Object3D;
  hatSlot: THREE.Group;
  height: number;
  setRobe(color: string, trim?: string): void;
  setHat(kind: Appearance['hat'], color?: string): void;
  setWandColor(color: string, glow: number): void;
  dispose(): void;
}

export function buildCharacter(a: Appearance, opts: { material?: THREE.Material; ghost?: boolean } = {}): CharacterRig {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const h = a.height ?? 1;
  const build = a.build ?? 1;
  const override = opts.material;
  const skin = override ?? colorMat(a.skin, { rough: 0.7 });
  const hairM = override ?? colorMat(a.hair, { rough: 0.85 });
  let robeM = override ?? colorMat(a.robe, { rough: 0.92 });
  let trimM = override ?? colorMat(a.trim, { rough: 0.6, metal: 0.2 });

  const robe = mesh(robeGeo(1 + (build - 1) * 0.6), robeM, build, 1.1 * h, build, 0, 0, 0);
  body.add(robe);
  const hem = mesh(geo.torus, trimM, 0.43 * build, 0.43 * build, 0.25, 0, 0.06, 0);
  hem.rotation.x = Math.PI / 2;
  body.add(hem);
  // плечи / воротник
  const shoulders = mesh(geo.sphereLo, robeM, 0.34 * build, 0.16, 0.24 * build, 0, 1.2 * h, 0);
  body.add(shoulders);
  // галстук-шарф цветов Круга
  const tie = mesh(geo.box, trimM, 0.07, 0.3, 0.04, 0, 1.06 * h, 0.2 * build);
  tie.rotation.x = -0.18;
  body.add(tie);
  if (a.scarf) {
    const sc = mesh(geo.torus, override ?? colorMat(a.scarf), 0.2, 0.2, 0.9, 0, 1.28 * h, 0);
    sc.rotation.x = Math.PI / 2;
    body.add(sc);
  }

  const head = new THREE.Group();
  head.position.set(0, 1.42 * h, 0);
  body.add(head);
  const neck = mesh(geo.cylLo, skin, 0.07, 0.12, 0.07, 0, -0.12, 0);
  head.add(neck);
  const skull = mesh(geo.sphere, skin, 0.2, 0.23, 0.21, 0, 0.05, 0);
  head.add(skull);
  if (a.ears === 'pointed') {
    for (const s of [-1, 1]) {
      const ear = mesh(geo.coneLo, skin, 0.04, 0.16, 0.04, s * 0.2, 0.08, -0.02);
      ear.rotation.z = -s * 1.1;
      head.add(ear);
    }
  }
  const eyeM = opts.ghost ? glowMat(0xd8f0ff) : colorMat(a.eyes, { rough: 0.3 });
  for (const s of [-1, 1]) head.add(mesh(geo.sphereLo, eyeM, 0.028, 0.034, 0.02, s * 0.075, 0.06, 0.19));
  // нос
  head.add(mesh(geo.sphereLo, skin, 0.03, 0.04, 0.04, 0, 0.0, 0.205));
  if (a.glasses) {
    const gm = colorMat(0x2a2620, { metal: 0.8, rough: 0.3 });
    for (const s of [-1, 1]) head.add(mesh(geo.torus, gm, 0.055, 0.055, 0.3, s * 0.075, 0.06, 0.205));
  }
  // волосы
  const hs = a.hairStyle;
  if (hs !== 'bald') {
    head.add(mesh(geo.sphere, hairM, 0.215, 0.17, 0.22, 0, 0.13, -0.01));
    if (hs === 'long' || hs === 'curly' || hs === 'wild') {
      const back = mesh(geo.sphere, hairM, 0.22, hs === 'long' ? 0.36 : 0.3, 0.17, 0, -0.08, -0.08);
      head.add(back);
      if (hs === 'curly' || hs === 'wild') {
        for (let i = 0; i < 7; i++) {
          const a2 = (i / 7) * Math.PI * 2;
          head.add(mesh(geo.sphereLo, hairM, 0.09, 0.09, 0.09, Math.cos(a2) * 0.2, 0.05 + Math.sin(i * 1.7) * 0.08, Math.sin(a2) * 0.16 - 0.04));
        }
      }
    } else if (hs === 'bun') {
      head.add(mesh(geo.sphere, hairM, 0.1, 0.1, 0.1, 0, 0.24, -0.14));
    } else if (hs === 'tied') {
      head.add(mesh(geo.cylLo, hairM, 0.05, 0.28, 0.05, 0, -0.08, -0.22));
    }
    // чёлка
    head.add(mesh(geo.sphereLo, hairM, 0.17, 0.06, 0.1, 0, 0.2, 0.12));
  }
  if (a.beard && a.beard !== 'none') {
    const bm = override ?? colorMat(a.beardColor ?? a.hair, { rough: 0.9 });
    const len = a.beard === 'long' ? 0.42 : a.beard === 'wild' ? 0.3 : 0.12;
    const beard = mesh(geo.coneLo, bm, 0.16, len, 0.1, 0, -0.08 - len / 2, 0.12);
    beard.rotation.x = Math.PI;
    head.add(beard);
    if (a.beard === 'wild') head.add(mesh(geo.sphereLo, bm, 0.2, 0.16, 0.14, 0, -0.04, 0.08));
  }
  const hatSlot = new THREE.Group();
  hatSlot.position.set(0, 0.2, 0);
  head.add(hatSlot);

  // руки
  const mkArm = (side: number): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(side * 0.3 * build, 1.22 * h, 0);
    const sleeve = mesh(geo.cylLo, robeM, 0.09, 0.5, 0.09, 0, -0.25, 0);
    g.add(sleeve);
    const cuff = mesh(geo.cylLo, trimM, 0.1, 0.06, 0.1, 0, -0.48, 0);
    g.add(cuff);
    const hand = mesh(geo.sphereLo, skin, 0.065, 0.075, 0.065, 0, -0.56, 0);
    g.add(hand);
    body.add(g);
    return g;
  };
  const armL = mkArm(-1);
  const armR = mkArm(1);
  armL.rotation.z = -0.12;
  armR.rotation.z = 0.12;

  const wand = new THREE.Group();
  wand.position.set(0, -0.58, 0.04);
  wand.rotation.x = Math.PI / 2 + 0.2;
  const wandM = colorMat(0x6a4a2a, { rough: 0.6 });
  const shaft = mesh(geo.cylLo, wandM, 0.018, 0.42, 0.018, 0, 0.18, 0);
  wand.add(shaft);
  const tipM = new THREE.MeshBasicMaterial({ color: 0xfff0c0 });
  const tip = mesh(geo.sphereLo, tipM, 0.03, 0.03, 0.03, 0, 0.4, 0);
  tip.castShadow = false;
  wand.add(tip);
  const wandTip = new THREE.Object3D();
  wandTip.position.set(0, 0.42, 0);
  wand.add(wandTip);
  armR.add(wand);
  wand.visible = false;

  const rig: CharacterRig = {
    root, body, head, armL, armR, robe, wand, wandTip, hatSlot, height: 1.7 * h,
    setRobe(color: string, trim?: string) {
      if (override) return;
      robeM = colorMat(color, { rough: 0.92 });
      robe.material = robeM;
      shoulders.material = robeM;
      (armL.children[0] as THREE.Mesh).material = robeM;
      (armR.children[0] as THREE.Mesh).material = robeM;
      if (trim) {
        trimM = colorMat(trim, { rough: 0.6, metal: 0.2 });
        hem.material = trimM; tie.material = trimM;
        (armL.children[1] as THREE.Mesh).material = trimM;
        (armR.children[1] as THREE.Mesh).material = trimM;
      }
    },
    setHat(kind, color = '#2a2430') {
      hatSlot.clear();
      if (!kind || kind === 'none') return;
      const m = override ?? colorMat(color, { rough: 0.85 });
      if (kind === 'pointed' || kind === 'tall') {
        const tall = kind === 'tall' ? 0.75 : 0.5;
        hatSlot.add(mesh(geo.cyl, m, 0.32, 0.03, 0.32, 0, -0.02, 0));
        const c = mesh(geo.cone, m, 0.2, tall, 0.2, 0, tall / 2 - 0.02, 0);
        c.rotation.z = 0.12;
        hatSlot.add(c);
      } else if (kind === 'cap') {
        hatSlot.add(mesh(geo.sphere, m, 0.23, 0.12, 0.23, 0, -0.02, 0));
      } else if (kind === 'hood') {
        const hood = mesh(geo.sphere, m, 0.27, 0.3, 0.27, 0, -0.1, -0.04);
        hatSlot.add(hood);
      } else if (kind === 'crown') {
        const cm = override ?? colorMat(0xd8b050, { metal: 0.8, rough: 0.3 });
        for (let i = 0; i < 7; i++) {
          const ang = (i / 7) * Math.PI * 2;
          const sp = mesh(geo.coneLo, cm, 0.04, 0.22, 0.04, Math.cos(ang) * 0.19, 0.06, Math.sin(ang) * 0.19);
          hatSlot.add(sp);
        }
      }
    },
    setWandColor(color: string, glow: number) {
      shaft.material = colorMat(color, { rough: 0.5 });
      tipM.color.setHex(glow);
    },
    dispose() { root.removeFromParent(); },
  };
  rig.setHat(a.hat ?? 'none');
  return rig;
}

// Анимация гуманоида: шаг, дыхание, каст, кувырок.
export function animateCharacter(rig: CharacterRig, t: number, moving: number, cast: number, dodge: number, dt: number): void {
  const swing = Math.sin(t * 9) * 0.55 * moving;
  const bob = Math.abs(Math.sin(t * 9)) * 0.05 * moving + Math.sin(t * 2) * 0.008;
  rig.body.position.y = bob;
  rig.robe.rotation.y = Math.sin(t * 9) * 0.06 * moving;
  rig.robe.scale.x = rig.robe.scale.z = (rig.robe.userData.base ?? (rig.robe.userData.base = rig.robe.scale.x)) * (1 + Math.sin(t * 9) * 0.03 * moving);
  rig.armL.rotation.x = swing;
  const castTarget = -1.35 * cast;
  rig.armR.rotation.x += ((cast > 0 ? castTarget : -swing) - rig.armR.rotation.x) * Math.min(1, dt * 18);
  rig.head.rotation.y = Math.sin(t * 0.7) * 0.1 * (1 - moving);
  rig.body.rotation.x = dodge > 0 ? Math.sin(dodge * Math.PI) * -0.9 : 0;
  rig.body.position.y -= dodge > 0 ? Math.sin(dodge * Math.PI) * 0.45 : 0;
}

// ---------------- Существа ----------------

export interface CreatureRig {
  root: THREE.Group;
  parts: Record<string, THREE.Object3D>;
  animate(t: number, moving: number, attack: number, dt: number): void;
  flash(on: boolean): void;
}

function creatureFlash(materials: THREE.MeshStandardMaterial[]): (on: boolean) => void {
  const base = materials.map((m) => m.emissive.getHex());
  return (on) => materials.forEach((m, i) => m.emissive.setHex(on ? 0xffffff : base[i]));
}

function ownMat(color: number, o: { rough?: number; metal?: number; emissive?: number; ei?: number; transparent?: boolean; opacity?: number; flat?: boolean } = {}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color, roughness: o.rough ?? 0.8, metalness: o.metal ?? 0, emissive: o.emissive ?? 0, emissiveIntensity: o.ei ?? 1,
    transparent: o.transparent, opacity: o.opacity ?? 1, flatShading: o.flat,
  });
}

export function buildCreature(model: string, color: number, color2 = 0xff4030, scale = 1): CreatureRig {
  const root = new THREE.Group();
  const s = new THREE.Group();
  s.scale.setScalar(scale);
  root.add(s);
  const parts: Record<string, THREE.Object3D> = {};
  const mats: THREE.MeshStandardMaterial[] = [];
  const M = (c: number, o?: Parameters<typeof ownMat>[1]) => { const m = ownMat(c, o); mats.push(m); return m; };
  let anim: CreatureRig['animate'] = () => {};

  switch (model) {
    case 'dummy': {
      const wood = M(0x6a4a2a);
      const straw = M(color, { rough: 1 });
      s.add(mesh(geo.cylLo, wood, 0.06, 1.6, 0.06, 0, 0.8, 0));
      const torso = mesh(geo.cyl, straw, 0.3, 0.8, 0.26, 0, 1.15, 0);
      s.add(torso);
      s.add(mesh(geo.box, wood, 1.1, 0.07, 0.07, 0, 1.35, 0));
      const head = mesh(geo.sphereLo, M(0xc8b080, { rough: 1 }), 0.22, 0.24, 0.22, 0, 1.75, 0);
      s.add(head);
      s.add(mesh(geo.torus, M(0xc04040), 0.3, 0.3, 0.6, 0, 1.15, 0).rotateX(Math.PI / 2));
      parts.torso = torso;
      anim = (t, _m, attack) => { s.rotation.z = Math.sin(t * 20) * 0.15 * attack; };
      break;
    }
    case 'wisp': {
      const core = mesh(geo.sphere, new THREE.MeshBasicMaterial({ color }), 0.18, 0.18, 0.18, 0, 1.4, 0);
      core.castShadow = false;
      const halo = mesh(geo.sphere, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }), 0.4, 0.4, 0.4, 0, 1.4, 0);
      halo.castShadow = false;
      s.add(core, halo);
      parts.core = core;
      anim = (t) => {
        core.position.y = halo.position.y = 1.3 + Math.sin(t * 3) * 0.2;
        halo.scale.setScalar(0.38 + Math.sin(t * 7) * 0.06);
      };
      break;
    }
    case 'shade': {
      const dark = M(color, { transparent: true, opacity: 0.88, emissive: 0x1a0830, ei: 0.6 });
      const robe = mesh(geo.cone, dark, 0.55, 1.7, 0.55, 0, 0.95, 0);
      robe.rotation.x = Math.PI;
      robe.position.y = 1.0;
      s.add(robe);
      const hood = mesh(geo.sphere, dark, 0.32, 0.36, 0.32, 0, 1.75, 0);
      s.add(hood);
      const eyeM = new THREE.MeshBasicMaterial({ color: 0xc0a0ff });
      for (const x of [-0.1, 0.1]) { const e = mesh(geo.sphereLo, eyeM, 0.045, 0.03, 0.03, x, 1.76, 0.27); e.castShadow = false; s.add(e); }
      for (const x of [-1, 1]) {
        const claw = mesh(geo.coneLo, dark, 0.08, 0.7, 0.08, x * 0.45, 1.1, 0.1);
        claw.rotation.z = x * 0.6;
        s.add(claw);
        parts['claw' + x] = claw;
      }
      parts.robe = robe;
      anim = (t, moving, attack) => {
        s.position.y = 0.15 + Math.sin(t * 2.5) * 0.1;
        robe.rotation.y = t * 0.6;
        (parts['claw-1'] as THREE.Mesh).rotation.x = -attack * 1.4;
        (parts['claw1'] as THREE.Mesh).rotation.x = -attack * 1.4;
        s.rotation.x = moving * 0.15;
      };
      break;
    }
    case 'hound': {
      const fur = M(color, { rough: 0.95, flat: true });
      const eye = new THREE.MeshBasicMaterial({ color: color2 === 0xff4030 ? 0xff5a3a : color2 });
      const bodyG = new THREE.Group();
      bodyG.position.y = 0.75;
      s.add(bodyG);
      bodyG.add(mesh(geo.box, fur, 0.55, 0.5, 1.3, 0, 0, 0));
      bodyG.add(mesh(geo.box, fur, 0.6, 0.55, 0.5, 0, 0.08, 0.45));
      const headG = new THREE.Group();
      headG.position.set(0, 0.25, 0.8);
      bodyG.add(headG);
      headG.add(mesh(geo.box, fur, 0.4, 0.38, 0.45, 0, 0, 0));
      headG.add(mesh(geo.box, fur, 0.26, 0.2, 0.35, 0, -0.08, 0.3));
      for (const x of [-0.12, 0.12]) {
        headG.add(mesh(geo.coneLo, fur, 0.08, 0.25, 0.06, x, 0.28, -0.05));
        const e = mesh(geo.sphereLo, eye, 0.04, 0.035, 0.03, x, 0.06, 0.23); e.castShadow = false; headG.add(e);
      }
      const tail = mesh(geo.coneLo, fur, 0.07, 0.6, 0.07, 0, 0.15, -0.8);
      tail.rotation.x = -2.2;
      bodyG.add(tail);
      const legs: THREE.Mesh[] = [];
      for (const [x, z] of [[-0.2, 0.45], [0.2, 0.45], [-0.2, -0.45], [0.2, -0.45]]) {
        const l = mesh(geo.cylLo, fur, 0.07, 0.7, 0.07, x, -0.4, z);
        bodyG.add(l);
        legs.push(l);
      }
      parts.head = headG;
      anim = (t, moving, attack) => {
        legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 14 + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.6 : 0)) * 0.7 * moving; });
        bodyG.position.y = 0.75 + Math.abs(Math.sin(t * 14)) * 0.06 * moving - attack * 0.25;
        headG.rotation.x = attack * 0.4;
        tail.rotation.z = Math.sin(t * 6) * 0.3;
      };
      break;
    }
    case 'spider': {
      const shell = M(color, { rough: 0.5, flat: true });
      const bodyG = new THREE.Group();
      bodyG.position.y = 0.55;
      s.add(bodyG);
      bodyG.add(mesh(geo.sphereLo, shell, 0.45, 0.35, 0.55, 0, 0.1, -0.35));
      bodyG.add(mesh(geo.sphereLo, shell, 0.28, 0.22, 0.3, 0, 0, 0.25));
      const eye = new THREE.MeshBasicMaterial({ color: 0x9aff6a });
      for (const x of [-0.08, 0.08, -0.15, 0.15]) { const e = mesh(geo.sphereLo, eye, 0.035, 0.035, 0.035, x, 0.08, 0.5); e.castShadow = false; bodyG.add(e); }
      const legs: THREE.Group[] = [];
      for (let i = 0; i < 8; i++) {
        const side = i < 4 ? -1 : 1;
        const k = i % 4;
        const g = new THREE.Group();
        g.position.set(side * 0.2, 0, 0.3 - k * 0.2);
        g.rotation.y = side * (0.4 + k * 0.35) + (side < 0 ? Math.PI : 0);
        const upper = mesh(geo.cylLo, shell, 0.035, 0.6, 0.035, 0.28, 0.12, 0);
        upper.rotation.z = -1.0;
        g.add(upper);
        const lower = mesh(geo.cylLo, shell, 0.03, 0.7, 0.03, 0.62, -0.18, 0);
        lower.rotation.z = 0.5;
        g.add(lower);
        bodyG.add(g);
        legs.push(g);
      }
      anim = (t, moving, attack) => {
        legs.forEach((g, i) => { g.rotation.x = Math.sin(t * 16 + i * 1.3) * 0.25 * moving; });
        bodyG.rotation.x = -attack * 0.4;
      };
      break;
    }
    case 'sentinel': {
      const stone = M(color, { rough: 0.9, flat: true });
      const rune = new THREE.MeshBasicMaterial({ color: 0x6ad0ff });
      const bodyG = new THREE.Group();
      s.add(bodyG);
      bodyG.add(mesh(geo.box, stone, 0.9, 0.9, 0.6, 0, 1.5, 0));
      bodyG.add(mesh(geo.box, stone, 0.6, 0.5, 0.45, 0, 0.95, 0));
      const head = mesh(geo.box, stone, 0.42, 0.42, 0.42, 0, 2.17, 0);
      bodyG.add(head);
      const eyeSlit = mesh(geo.box, rune, 0.3, 0.05, 0.05, 0, 2.2, 0.22); eyeSlit.castShadow = false; bodyG.add(eyeSlit);
      const core = mesh(geo.ico, rune, 0.12, 0.12, 0.12, 0, 1.55, 0.31); core.castShadow = false; bodyG.add(core);
      const arms: THREE.Group[] = [];
      for (const x of [-1, 1]) {
        const a = new THREE.Group();
        a.position.set(x * 0.6, 1.8, 0);
        a.add(mesh(geo.box, stone, 0.35, 0.35, 0.35, 0, 0, 0));
        a.add(mesh(geo.box, stone, 0.28, 0.9, 0.28, 0, -0.6, 0));
        a.add(mesh(geo.box, stone, 0.38, 0.38, 0.38, 0, -1.15, 0.05));
        bodyG.add(a);
        arms.push(a);
      }
      const legs: THREE.Mesh[] = [];
      for (const x of [-0.22, 0.22]) { const l = mesh(geo.box, stone, 0.3, 0.75, 0.3, x, 0.38, 0); bodyG.add(l); legs.push(l); }
      parts.core = core;
      anim = (t, moving, attack) => {
        legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 5 + i * Math.PI) * 0.35 * moving; });
        arms.forEach((a) => { a.rotation.x = -attack * 2.4 + Math.sin(t * 5) * 0.15 * moving; });
        core.rotation.y = t * 2;
      };
      break;
    }
    case 'book': {
      const cover = M(color, { rough: 0.7 });
      const pages = M(0xe8dcc0, { rough: 1 });
      const g = new THREE.Group();
      g.position.y = 1.2;
      s.add(g);
      const left = new THREE.Group();
      const right = new THREE.Group();
      left.add(mesh(geo.box, cover, 0.4, 0.03, 0.55, -0.2, 0, 0));
      left.add(mesh(geo.box, pages, 0.36, 0.06, 0.5, -0.19, 0.04, 0));
      right.add(mesh(geo.box, cover, 0.4, 0.03, 0.55, 0.2, 0, 0));
      right.add(mesh(geo.box, pages, 0.36, 0.06, 0.5, 0.19, 0.04, 0));
      g.add(left, right);
      anim = (t, _m, attack) => {
        const flap = 0.5 + Math.sin(t * 16) * 0.5 + attack;
        left.rotation.z = flap;
        right.rotation.z = -flap;
        g.position.y = 1.1 + Math.sin(t * 4) * 0.15;
      };
      break;
    }
    case 'wraith': {
      const ghost = M(color, { transparent: true, opacity: 0.62, emissive: color, ei: 0.35 });
      const robe = mesh(geo.cone, ghost, 0.5, 1.9, 0.5, 0, 1.1, 0);
      robe.rotation.x = Math.PI;
      s.add(robe);
      const head = mesh(geo.sphere, ghost, 0.24, 0.28, 0.24, 0, 1.95, 0);
      s.add(head);
      const hair = mesh(geo.cone, ghost, 0.3, 0.8, 0.2, 0, 1.6, -0.12);
      hair.rotation.x = Math.PI;
      s.add(hair);
      const eyeM = new THREE.MeshBasicMaterial({ color: 0xe0ffff });
      for (const x of [-0.08, 0.08]) { const e = mesh(geo.sphereLo, eyeM, 0.04, 0.025, 0.02, x, 1.97, 0.21); e.castShadow = false; s.add(e); }
      const arms: THREE.Mesh[] = [];
      for (const x of [-1, 1]) {
        const arm = mesh(geo.coneLo, ghost, 0.07, 0.8, 0.07, x * 0.4, 1.4, 0.15);
        arm.rotation.z = x * 0.4;
        s.add(arm);
        arms.push(arm);
      }
      anim = (t, _m, attack) => {
        s.position.y = 0.2 + Math.sin(t * 1.6) * 0.15;
        robe.rotation.y = Math.sin(t) * 0.3;
        arms.forEach((a) => { a.rotation.x = -0.4 - attack * 1.2 + Math.sin(t * 2) * 0.1; });
      };
      break;
    }
    case 'hollow': {
      const voidM = M(color, { transparent: true, opacity: 0.92, emissive: 0x200838, ei: 0.8 });
      const robe = mesh(geo.cone, voidM, 0.7, 2.2, 0.7, 0, 1.2, 0);
      robe.rotation.x = Math.PI;
      s.add(robe);
      s.add(mesh(geo.sphereLo, voidM, 0.5, 0.25, 0.4, 0, 2.2, 0));
      const face = mesh(geo.sphere, M(0x000000, { rough: 1 }), 0.24, 0.3, 0.22, 0, 2.55, 0.02);
      s.add(face);
      const eyeM = new THREE.MeshBasicMaterial({ color: 0xffffff });
      for (const x of [-0.08, 0.08]) { const e = mesh(geo.sphereLo, eyeM, 0.04, 0.02, 0.02, x, 2.58, 0.21); e.castShadow = false; s.add(e); }
      const crownM = new THREE.MeshBasicMaterial({ color: 0x9a7aff });
      for (let i = 0; i < 9; i++) {
        const a2 = (i / 9) * Math.PI * 2;
        const sp = mesh(geo.coneLo, crownM, 0.04, 0.35 + (i % 2) * 0.15, 0.04, Math.cos(a2) * 0.25, 2.88, Math.sin(a2) * 0.22);
        sp.castShadow = false;
        s.add(sp);
      }
      const arms: THREE.Mesh[] = [];
      for (const x of [-1, 1]) {
        const arm = mesh(geo.coneLo, voidM, 0.1, 1.3, 0.1, x * 0.6, 1.7, 0.1);
        arm.rotation.z = x * 0.5;
        s.add(arm);
        arms.push(arm);
      }
      anim = (t, _m, attack) => {
        s.position.y = 0.3 + Math.sin(t * 1.2) * 0.2;
        arms.forEach((a, i) => { a.rotation.x = -0.3 - attack * 1.6 + Math.sin(t * 1.5 + i) * 0.15; });
        robe.rotation.y = t * 0.3;
      };
      break;
    }
    default: {
      // cultist и прочие гуманоиды — используем персонажа
      const rig = buildCharacter({
        skin: model === 'cultist' ? '#c8a890' : '#d8b8a0', hair: '#1a1410', hairStyle: 'short', eyes: '#ff6a3a',
        robe: '#' + color.toString(16).padStart(6, '0'), trim: '#' + color2.toString(16).padStart(6, '0'), hat: 'hood',
      });
      rig.setHat('hood', '#' + color.toString(16).padStart(6, '0'));
      rig.wand.visible = true;
      rig.setWandColor('#2a1a1a', color2);
      s.add(rig.root);
      parts.wandTip = rig.wandTip;
      anim = (t, moving, attack, dt) => animateCharacter(rig, t, moving, attack, 0, dt);
      rig.root.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
        if (m && m.isMeshStandardMaterial) {
          const own = m.clone();
          (o as THREE.Mesh).material = own;
          mats.push(own);
        }
      });
    }
  }
  root.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
  return { root, parts, animate: anim, flash: creatureFlash(mats) };
}

export const sharedGeo = geo;
