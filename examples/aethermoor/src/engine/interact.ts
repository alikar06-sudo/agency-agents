// Интерактивные объекты мира: двери, сундуки, травы, станции, головоломки, тайники, печати, выходы.
import * as THREE from 'three';
import { FOUNDER_MARKS } from '@/data/world';
import type { Engine } from './Engine';
import type { BuiltZone, MarkerInstance } from './world';
import { TS, cellCenter } from './world';
import { colorMat, glowMat } from './materials';
import { glowTexture, runeCircleTexture } from './textures';
import { sharedGeo as SG } from './models';
import { G, mutate, setUI, toast } from '@/state/store';
import { apply, checkAll } from '@/systems/logic';
import { addItem, countItem } from '@/systems/inventory';
import { bus } from '@/core/bus';
import { ITEMS } from '@/data/items';
import { ZONES } from '@/data/zones';
import { LORE } from '@/data/world';
import { startDialogue } from '@/systems/dialogue';
import { blockedCell } from './physics';

export function unlockRank(): number {
  const g = G();
  return 1 + (g.subjects.transfig.exam ? 1 : 0) + (g.player.level >= 8 ? 1 : 0) + (g.flags.unlock_bonus ? 1 : 0);
}

const sprite = (color: number, size: number) => {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(size);
  return s;
};

export class Interactable {
  obj = new THREE.Group();
  x: number; z: number;
  key: string;
  revealed: boolean;
  active = true;
  t = Math.random() * 10;
  state: Record<string, unknown> = {};
  private glow: THREE.Sprite | null = null;

  constructor(private mgr: InteractManager, public m: MarkerInstance) {
    this.x = m.x; this.z = m.z;
    this.key = m.key;
    this.revealed = !m.def.hidden || G().opened.includes(this.sid('rev'));
    this.build();
    this.obj.position.set(m.x, 0, m.z);
    this.obj.visible = this.revealed && this.condOk();
    mgr.eng.scene.add(this.obj);
    this.syncGrid();
  }

  get eng(): Engine { return this.mgr.eng; }
  get zone(): string { return this.mgr.zone!.def.id; }
  sid(prefix = ''): string { return `${prefix ? prefix + ':' : ''}${this.zone}:${this.key}`; }
  get kind(): string { return this.m.def.kind; }
  condOk(): boolean { return checkAll(this.m.def.if); }
  isOpened(): boolean { return G().opened.includes(this.sid()); }
  markOpened(): void { if (!this.isOpened()) mutate((g) => { g.opened.push(this.sid()); }); }

  private build(): void {
    const d = this.m.def;
    const o = this.obj;
    switch (d.kind) {
      case 'exit': {
        const toName = d.to ? ZONES[d.to]?.name ?? d.label : d.label;
        this.state.label = d.label ?? toName;
        const mat = new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
        const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.8), mat);
        plane.position.y = 1.4;
        plane.rotation.y = this.m.facing;
        o.add(plane);
        const rune = new THREE.Mesh(new THREE.CircleGeometry(0.8, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: runeCircleTexture('#ffd9a0'), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
        rune.position.y = 0.04;
        o.add(rune);
        this.state.mat = mat;
        break;
      }
      case 'chest': {
        const wood = colorMat(0x6a3a1a, { rough: 0.7 });
        const band = colorMat(0xc8a050, { metal: 0.8, rough: 0.3 });
        const base = new THREE.Mesh(SG.box, wood); base.scale.set(1.1, 0.55, 0.7); base.position.y = 0.3; o.add(base);
        const lidG = new THREE.Group(); lidG.position.set(0, 0.58, -0.35); o.add(lidG);
        const lid = new THREE.Mesh(SG.box, wood); lid.scale.set(1.12, 0.22, 0.72); lid.position.set(0, 0.1, 0.35); lidG.add(lid);
        for (const x of [-0.4, 0.4]) { const b = new THREE.Mesh(SG.box, band); b.scale.set(0.08, 0.6, 0.74); b.position.set(x, 0.3, 0); o.add(b); }
        const lock = new THREE.Mesh(SG.box, d.lock ? glowMat(0x8ab0ff) : band); lock.scale.set(0.16, 0.18, 0.06); lock.position.set(0, 0.5, 0.37); o.add(lock);
        o.rotation.y = this.m.facing;
        this.state.lid = lidG;
        if (this.isOpened()) lidG.rotation.x = -1.6;
        else { this.glow = sprite(d.lock ? 0x8ab0ff : 0xffd080, 1.4); this.glow.position.y = 0.9; o.add(this.glow); }
        break;
      }
      case 'door': {
        const frame = colorMat(0x3a2a1e, { rough: 0.8 });
        const leafM = colorMat(0x5a3a22, { rough: 0.75 });
        const iron = colorMat(0x2a2a2e, { metal: 0.7, rough: 0.4 });
        const pivot = new THREE.Group();
        const horiz = this.isHorizontalPassage();
        pivot.rotation.y = horiz ? 0 : Math.PI / 2;
        o.add(pivot);
        const hinge = new THREE.Group(); hinge.position.set(-0.95, 0, 0); pivot.add(hinge);
        const leaf = new THREE.Mesh(SG.box, leafM); leaf.scale.set(1.9, 2.9, 0.16); leaf.position.set(0.95, 1.45, 0); hinge.add(leaf);
        for (const y of [0.6, 2.3]) { const b = new THREE.Mesh(SG.box, iron); b.scale.set(1.92, 0.12, 0.2); b.position.set(0.95, y, 0); hinge.add(b); }
        const top = new THREE.Mesh(SG.box, frame); top.scale.set(2, 0.3, 0.4); top.position.set(0, 3.0, 0); pivot.add(top);
        if (d.lock) {
          const r = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), new THREE.MeshBasicMaterial({ map: runeCircleTexture('#8ab0ff'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
          r.position.set(0.95, 1.5, 0.1); hinge.add(r);
          this.state.rune = r;
        }
        this.state.hinge = hinge;
        if (this.isOpened()) hinge.rotation.y = -1.7;
        break;
      }
      case 'gate': {
        const iron = colorMat(0x2a2a2e, { metal: 0.7, rough: 0.4 });
        const bars = new THREE.Group();
        const horiz = this.isHorizontalPassage();
        bars.rotation.y = horiz ? 0 : Math.PI / 2;
        for (let i = -3; i <= 3; i++) { const b = new THREE.Mesh(SG.cylLo, iron); b.scale.set(0.05, 3, 0.05); b.position.set(i * 0.28, 1.5, 0); bars.add(b); }
        const h = new THREE.Mesh(SG.box, iron); h.scale.set(2, 0.1, 0.1); h.position.y = 2.6; bars.add(h);
        o.add(bars);
        this.state.bars = bars;
        break;
      }
      case 'herb':
      case 'ore': {
        const item = ITEMS[d.item ?? 'sunleaf'];
        const color = new THREE.Color(item?.color ?? '#88cc66');
        if (d.item === 'spring_water') {
          const ring = new THREE.Mesh(SG.cyl, colorMat(0x7a7468, { rough: 0.9 })); ring.scale.set(0.8, 0.5, 0.8); ring.position.y = 0.25; o.add(ring);
          const water = new THREE.Mesh(SG.cyl, new THREE.MeshStandardMaterial({ color: 0x4a9ac8, roughness: 0.05, emissive: 0x0a3a5a })); water.scale.set(0.66, 0.05, 0.66); water.position.y = 0.5; o.add(water);
        } else if (d.kind === 'herb') {
          for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2;
            const leaf = new THREE.Mesh(SG.coneLo, colorMat(0x3a7a3a, { rough: 0.9 }));
            leaf.scale.set(0.08, 0.5, 0.08); leaf.position.set(Math.cos(a) * 0.15, 0.25, Math.sin(a) * 0.15); leaf.rotation.set(Math.sin(a) * 0.5, 0, Math.cos(a) * 0.5);
            o.add(leaf);
          }
          const bloom = new THREE.Mesh(SG.sphereLo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6 }));
          bloom.scale.setScalar(0.14); bloom.position.y = 0.55; o.add(bloom);
        } else {
          const rock = new THREE.Mesh(SG.ico, colorMat(0x5a5650, { flat: true })); rock.scale.set(0.6, 0.45, 0.55); rock.position.y = 0.3; o.add(rock);
          for (let i = 0; i < 3; i++) {
            const cr = new THREE.Mesh(SG.coneLo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.7, roughness: 0.2 }));
            cr.scale.set(0.08, 0.4, 0.08); cr.position.set((i - 1) * 0.2, 0.6, (i % 2) * 0.1); cr.rotation.z = (i - 1) * 0.4; o.add(cr);
          }
        }
        this.glow = sprite(color.getHex(), 0.9); this.glow.position.y = 0.6; o.add(this.glow);
        break;
      }
      case 'station': {
        if (d.station === 'alchemy') {
          const pot = new THREE.Mesh(SG.sphere, colorMat(0x1e1e22, { metal: 0.6, rough: 0.4 })); pot.scale.set(0.7, 0.55, 0.7); pot.position.y = 0.6; o.add(pot);
          const brew = new THREE.Mesh(SG.cyl, new THREE.MeshStandardMaterial({ color: 0x5ae07a, emissive: 0x2a8a3a, emissiveIntensity: 1 })); brew.scale.set(0.6, 0.03, 0.6); brew.position.y = 1.05; o.add(brew);
          this.glow = sprite(0x6aff8a, 1.6); this.glow.position.y = 1.2; o.add(this.glow);
        } else {
          const bench = new THREE.Mesh(SG.box, colorMat(0x5a3a22)); bench.scale.set(1.8, 0.15, 0.9); bench.position.y = 0.9; o.add(bench);
          for (const [x, z] of [[-0.8, -0.35], [0.8, -0.35], [-0.8, 0.35], [0.8, 0.35]]) { const l = new THREE.Mesh(SG.box, colorMat(0x3a2414)); l.scale.set(0.1, 0.9, 0.1); l.position.set(x, 0.45, z); o.add(l); }
          const anvil = new THREE.Mesh(SG.box, colorMat(0x3a3a3e, { metal: 0.8, rough: 0.35 })); anvil.scale.set(0.5, 0.25, 0.3); anvil.position.set(0.3, 1.1, 0); o.add(anvil);
          const gem = new THREE.Mesh(SG.ico, new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x4a8aff, emissiveIntensity: 0.8 })); gem.scale.setScalar(0.12); gem.position.set(-0.4, 1.1, 0); o.add(gem);
          this.glow = sprite(0x9fd8ff, 1.0); this.glow.position.set(-0.4, 1.2, 0); o.add(this.glow);
          o.rotation.y = this.m.facing;
        }
        break;
      }
      case 'bed': {
        const col = new THREE.Color(this.mgr.circleColor());
        const frame = new THREE.Mesh(SG.box, colorMat(0x3a2414)); frame.scale.set(1.2, 0.3, 1.9); frame.position.y = 0.35; o.add(frame);
        const mat = new THREE.Mesh(SG.box, colorMat(0xe8e0d0)); mat.scale.set(1.1, 0.16, 1.8); mat.position.y = 0.55; o.add(mat);
        const blanket = new THREE.Mesh(SG.box, new THREE.MeshStandardMaterial({ color: col, roughness: 0.95 })); blanket.scale.set(1.14, 0.1, 1.2); blanket.position.set(0, 0.66, 0.25); o.add(blanket);
        const pillow = new THREE.Mesh(SG.box, colorMat(0xf4f0e6)); pillow.scale.set(0.7, 0.14, 0.32); pillow.position.set(0, 0.68, -0.65); o.add(pillow);
        o.rotation.y = this.m.facing;
        this.glow = sprite(0xffd9a0, 0.6); this.glow.position.y = 1.2; o.add(this.glow);
        break;
      }
      case 'board': {
        const post = colorMat(0x4a3220);
        for (const x of [-0.8, 0.8]) { const p = new THREE.Mesh(SG.box, post); p.scale.set(0.12, 2.2, 0.12); p.position.set(x, 1.1, 0); o.add(p); }
        const b = new THREE.Mesh(SG.box, colorMat(0x6a4a2a)); b.scale.set(1.8, 1.1, 0.08); b.position.y = 1.6; o.add(b);
        for (let i = 0; i < 5; i++) { const n = new THREE.Mesh(SG.box, colorMat(0xe8dcc0)); n.scale.set(0.3, 0.38, 0.02); n.position.set(-0.6 + i * 0.3, 1.6 + (i % 2) * 0.15, 0.06); n.rotation.z = (i - 2) * 0.08; o.add(n); }
        o.rotation.y = this.m.facing;
        break;
      }
      case 'lore':
      case 'pickup': {
        if (d.kind === 'lore') {
          const lect = new THREE.Mesh(SG.box, colorMat(0x4a3220)); lect.scale.set(0.5, 1.0, 0.4); lect.position.y = 0.5; o.add(lect);
          const book = new THREE.Mesh(SG.box, colorMat(0x8a2a24)); book.scale.set(0.55, 0.06, 0.4); book.position.y = 1.05; book.rotation.x = -0.3; o.add(book);
          this.glow = sprite(0xffe0a0, 1.2); this.glow.position.y = 1.3; o.add(this.glow);
        } else {
          const it = ITEMS[d.item ?? ''];
          const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: new THREE.Color(it?.color ?? '#ffffff'), emissive: new THREE.Color(it?.color ?? '#ffffff'), emissiveIntensity: 0.5 }));
          gem.position.y = 0.6; o.add(gem);
          this.state.gem = gem;
          this.glow = sprite(0xfff0c0, 1.0); this.glow.position.y = 0.6; o.add(this.glow);
        }
        if (this.isOpened()) this.active = false;
        break;
      }
      case 'interact': {
        const prop = d.prop ?? 'orb';
        if (prop === 'sign') break; // табличка построена вместе с зоной
        if (prop === 'mirror') {
          const frame = new THREE.Mesh(SG.box, colorMat(0xc8a050, { metal: 0.8, rough: 0.3 })); frame.scale.set(1.4, 2.6, 0.15); frame.position.y = 1.4; o.add(frame);
          const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 2.3), new THREE.MeshStandardMaterial({ color: 0x9ab0d0, metalness: 1, roughness: 0.05, emissive: 0x1a2a4a })); glass.position.set(0, 1.4, 0.08); o.add(glass);
          o.rotation.y = this.m.facing;
        } else if (prop === 'lever') {
          const base = new THREE.Mesh(SG.box, colorMat(0x3a3a3e, { metal: 0.6 })); base.scale.set(0.4, 0.3, 0.3); base.position.y = 0.15; o.add(base);
          const arm = new THREE.Mesh(SG.cylLo, colorMat(0x8a6a3a)); arm.scale.set(0.05, 0.8, 0.05); arm.position.y = 0.5; arm.rotation.z = 0.5; o.add(arm);
          this.state.arm = arm;
        } else if (prop === 'none') {
          // невидимая точка взаимодействия
        } else if (prop === 'well' || prop === 'spring') {
          const ring = new THREE.Mesh(SG.cyl, colorMat(0x7a7468, { rough: 0.9 })); ring.scale.set(0.8, 0.7, 0.8); ring.position.y = 0.35; o.add(ring);
          const water = new THREE.Mesh(SG.cyl, new THREE.MeshStandardMaterial({ color: 0x3a7a9a, roughness: 0.1, emissive: 0x0a2a3a })); water.scale.set(0.65, 0.05, 0.65); water.position.y = 0.66; o.add(water);
        } else {
          const orb = new THREE.Mesh(SG.sphere, new THREE.MeshStandardMaterial({ color: d.color ?? 0x9ab0ff, emissive: d.color ?? 0x5a7aff, emissiveIntensity: 0.8, roughness: 0.2 }));
          orb.scale.setScalar(0.25); orb.position.y = 1.2; o.add(orb);
          const ped = new THREE.Mesh(SG.cyl, colorMat(0x7a7468)); ped.scale.set(0.3, 0.9, 0.3); ped.position.y = 0.45; o.add(ped);
          this.glow = sprite(d.color ?? 0x9ab0ff, 1.4); this.glow.position.y = 1.2; o.add(this.glow);
          this.state.orb = orb;
        }
        break;
      }
      case 'secret': {
        if (d.prop === 'wall') {
          const wall = new THREE.Mesh(new THREE.BoxGeometry(TS, 3.4, TS), colorMat(0x8a7a62, { rough: 0.95 })); wall.position.y = 1.7; o.add(wall);
          this.state.wall = wall;
        } else {
          const sig = new THREE.Mesh(new THREE.CircleGeometry(0.7, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: runeCircleTexture('#ffe9a0'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
          sig.position.y = 0.05; o.add(sig);
          this.glow = sprite(0xffe9a0, 1.8); this.glow.position.y = 0.6; o.add(this.glow);
          this.state.sig = sig;
        }
        if (this.isOpened()) this.active = false;
        break;
      }
      case 'brazier': {
        const bowl = new THREE.Mesh(SG.cyl, colorMat(0x2a2a2e, { metal: 0.6, rough: 0.4 })); bowl.scale.set(0.5, 0.25, 0.5); bowl.position.y = 1.05; o.add(bowl);
        const leg = new THREE.Mesh(SG.cylLo, colorMat(0x2a2a2e, { metal: 0.6 })); leg.scale.set(0.08, 1, 0.08); leg.position.y = 0.5; o.add(leg);
        const fire = sprite(0xff8a3a, 1.8); fire.position.y = 1.5; o.add(fire);
        this.state.fire = fire;
        this.state.lit = G().opened.includes(this.sid('lit')) || G().flags[`puzzle_${this.zone}_${d.group}`];
        fire.visible = !!this.state.lit;
        this.state.light = { x: this.x, y: 1.6, z: this.z, color: 0xff8a3a, intensity: 1.8, distance: 10, flicker: 0.3, kind: 'brazier', on: !!this.state.lit };
        this.mgr.zone!.lights.push(this.state.light as never);
        break;
      }
      case 'crystal': {
        const cr = new THREE.Mesh(SG.ico, new THREE.MeshStandardMaterial({ color: 0x8aa8ff, emissive: 0x2a3a8a, emissiveIntensity: 0.4, roughness: 0.2, flatShading: true }));
        cr.scale.set(0.45, 0.9, 0.45); cr.position.y = 1.2; o.add(cr);
        const base = new THREE.Mesh(SG.cylLo, colorMat(0x5a5650)); base.scale.set(0.5, 0.5, 0.5); base.position.y = 0.25; o.add(base);
        this.state.cr = cr;
        this.state.charged = G().opened.includes(this.sid('chg')) || G().flags[`puzzle_${this.zone}_${d.group}`];
        this.glow = sprite(0xa8c0ff, 2); this.glow.position.y = 1.2; o.add(this.glow);
        this.glow.visible = !!this.state.charged;
        if (this.state.charged) (cr.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.6;
        break;
      }
      case 'block': {
        const b = new THREE.Mesh(SG.box, colorMat(0x8a8070, { rough: 0.95, flat: true })); b.scale.set(1.8, 1.6, 1.8); b.position.y = 0.8; o.add(b);
        const rune = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: runeCircleTexture('#c8f0e0'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        rune.position.set(0, 0.8, 0.91); o.add(rune);
        this.state.col = this.m.col; this.state.row = this.m.row;
        break;
      }
      case 'plate': {
        const pl = new THREE.Mesh(SG.box, colorMat(0x6a6458)); pl.scale.set(1.6, 0.1, 1.6); pl.position.y = 0.05; o.add(pl);
        const r = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: runeCircleTexture('#c8f0e0'), transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
        r.position.y = 0.12; o.add(r);
        this.state.rune = r;
        break;
      }
      case 'web': {
        const mat = new THREE.MeshBasicMaterial({ color: 0xe8e8f0, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
        for (let i = 0; i < 3; i++) {
          const p = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.6), mat); p.position.y = 1.3; p.rotation.y = (i / 3) * Math.PI; o.add(p);
        }
        if (this.isOpened()) this.active = false;
        break;
      }
      case 'seal': {
        const circle = new THREE.Mesh(new THREE.CircleGeometry(2.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: runeCircleTexture(this.isOpened() ? '#a0e8ff' : '#c04a4a'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        circle.position.y = 0.05; o.add(circle);
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
          const pil = new THREE.Mesh(SG.box, colorMat(0x6a6458, { rough: 0.9 })); pil.scale.set(0.35, 1.6, 0.35); pil.position.set(Math.cos(a) * 2.1, 0.8, Math.sin(a) * 2.1); o.add(pil);
          const gem = sprite(this.isOpened() ? 0xa0e8ff : 0xff5a3a, 0.8); gem.position.set(Math.cos(a) * 2.1, 1.8, Math.sin(a) * 2.1); o.add(gem);
        }
        this.glow = sprite(this.isOpened() ? 0xa0e8ff : 0xff5a3a, 3); this.glow.position.y = 0.8; o.add(this.glow);
        this.state.circle = circle;
        break;
      }
      case 'waystone': {
        const stone = new THREE.Mesh(SG.box, colorMat(0x6a6a72, { rough: 0.9, flat: true })); stone.scale.set(0.8, 2.4, 0.5); stone.position.y = 1.2; o.add(stone);
        const rune = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: runeCircleTexture('#8ad8ff'), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        rune.position.set(0, 1.5, 0.26); o.add(rune);
        this.glow = sprite(0x8ad8ff, 1.6); this.glow.position.y = 1.5; o.add(this.glow);
        o.rotation.y = this.m.facing;
        break;
      }
      case 'light': {
        const cr = new THREE.Mesh(SG.ico, new THREE.MeshBasicMaterial({ color: d.color ?? 0x8ad8ff })); cr.scale.setScalar(0.25); cr.position.y = 1.8; o.add(cr);
        this.glow = sprite(d.color ?? 0x8ad8ff, 2.2); this.glow.position.y = 1.8; o.add(this.glow);
        this.mgr.zone!.lights.push({ x: this.x, y: 1.8, z: this.z, color: d.color ?? 0x8ad8ff, intensity: d.power ?? 1.6, distance: d.prop === 'candles' ? 10 : (d.radius ?? 10), flicker: 0.05, kind: 'crystal' });
        if (d.prop === 'candles') this.buildFloatingCandles(d.radius ?? 6);
        if (d.prop === 'fireplace') {
          cr.visible = false;
          const stone = colorMat(0x6a5a4a, { rough: 0.95 });
          const hearth = new THREE.Mesh(SG.box, stone); hearth.scale.set(3.2, 2.6, 1.0); hearth.position.set(0, 1.3, -0.5); o.add(hearth);
          const mouth = new THREE.Mesh(SG.box, colorMat(0x120c0a)); mouth.scale.set(1.8, 1.3, 0.2); mouth.position.set(0, 0.75, 0.02); o.add(mouth);
          const mantel = new THREE.Mesh(SG.box, colorMat(0x4a3220)); mantel.scale.set(3.6, 0.2, 1.2); mantel.position.set(0, 2.65, -0.4); o.add(mantel);
          for (let i = 0; i < 3; i++) { const log = new THREE.Mesh(SG.cylLo, colorMat(0x3a2414)); log.scale.set(0.12, 1.1, 0.12); log.rotation.z = Math.PI / 2; log.rotation.y = (i - 1) * 0.4; log.position.set(0, 0.2 + i * 0.08, 0.15); o.add(log); }
          if (this.glow) { this.glow.position.set(0, 0.7, 0.2); this.glow.material.color.set(0xff8a3a); this.glow.scale.setScalar(2.6); }
          const l = this.mgr.zone!.lights[this.mgr.zone!.lights.length - 1];
          l.color = 0xff8a3a; l.intensity = 2.6; l.distance = 14; l.flicker = 0.35; l.y = 1; l.z = this.z + 0.6;
          this.state.fire = true;
        }
        break;
      }
      default:
        break;
    }
  }

  private buildFloatingCandles(r: number): void {
    // парящие свечи Большого зала
    const n = Math.round(r * r * 1.4);
    const candles: { m: THREE.Mesh; f: THREE.Sprite; ox: number; oz: number; y: number; ph: number }[] = [];
    const wax = colorMat(0xf4ecd8, { rough: 0.6 });
    for (let i = 0; i < n; i++) {
      const ox = (Math.random() - 0.5) * r * 2.2, oz = (Math.random() - 0.5) * r * 1.6;
      const m = new THREE.Mesh(SG.cylLo, wax);
      m.scale.set(0.06, 0.32 + Math.random() * 0.2, 0.06);
      const f = sprite(0xffc070, 0.55);
      this.obj.add(m, f);
      candles.push({ m, f, ox, oz, y: 4.2 + Math.random() * 1.6, ph: Math.random() * 10 });
    }
    this.state.candles = candles;
    this.obj.position.y = 0;
  }

  isHorizontalPassage(): boolean {
    const g = this.mgr.zone!.grid;
    const w = (c: number, r: number) => c < 0 || r < 0 || c >= g.w || r >= g.h || g.wall[r * g.w + c] === 1;
    return w(this.m.col - 1, this.m.row) || w(this.m.col + 1, this.m.row);
  }

  syncGrid(): void {
    const g = this.mgr.zone!.grid;
    const i = this.m.row * g.w + this.m.col;
    const k = this.kind;
    const visible = this.revealed && this.condOk();
    if (k === 'door') {
      const open = this.isOpened();
      g.walk[i] = open ? 0 : 1; g.shot[i] = open ? 0 : 1;
    } else if (k === 'gate') {
      const open = this.gateOpen();
      g.walk[i] = open ? 0 : 1; g.shot[i] = open ? 0 : 1;
      (this.state.bars as THREE.Object3D).position.y = open ? 2.9 : 0;
    } else if (k === 'web') {
      const gone = this.isOpened();
      g.walk[i] = gone ? 0 : 1; g.shot[i] = gone ? 0 : 1;
      this.obj.visible = !gone;
    } else if (k === 'secret' && this.m.def.prop === 'wall') {
      const open = this.isOpened();
      g.walk[i] = open ? 0 : 1; g.shot[i] = open ? 0 : 1;
      this.obj.visible = !open;
    } else if (['chest', 'station', 'bed', 'board', 'waystone', 'crystal', 'brazier'].includes(k)) {
      g.walk[i] = visible ? 1 : 0;
    }
  }

  gateOpen(): boolean {
    const d = this.m.def;
    if (d.group && G().flags[`puzzle_${this.zone}_${d.group}`]) return true;
    return d.if ? checkAll(d.if) : false;
  }

  prompt(): { text: string; sub?: string } | null {
    const d = this.m.def;
    if (!this.active || !this.obj.visible) return null;
    switch (d.kind) {
      case 'chest': return this.isOpened() ? null : { text: d.lock ? `Заперто рунами (ранг ${d.lock})` : 'Открыть', sub: d.label ?? 'Сундук' };
      case 'door': {
        if (this.isOpened()) return null;
        if (d.lock) return { text: `Руническая печать (ранг ${d.lock})`, sub: d.key && countItem(d.key) ? 'Открыть ключом' : 'Нужно «Отворение»' };
        return { text: 'Открыть', sub: d.label ?? 'Дверь' };
      }
      case 'gate': return this.gateOpen() ? null : { text: 'Закрыто', sub: d.label ?? 'Решётка' };
      case 'herb':
      case 'ore': {
        if (!this.harvestable()) return null;
        return { text: d.kind === 'herb' ? 'Собрать' : 'Добыть', sub: ITEMS[d.item ?? '']?.name };
      }
      case 'station': return { text: d.station === 'alchemy' ? 'Варить зелья' : 'Мастерить', sub: d.label ?? (d.station === 'alchemy' ? 'Котёл' : 'Верстак') };
      case 'bed': return { text: 'Отдохнуть', sub: d.label ?? 'Кровать' };
      case 'board': return { text: 'Читать объявления', sub: d.label ?? 'Доска поручений' };
      case 'lore': return { text: 'Читать', sub: d.label ?? LORE[d.lore ?? '']?.title ?? 'Книга' };
      case 'pickup': return this.isOpened() ? null : { text: 'Подобрать', sub: ITEMS[d.item ?? '']?.name };
      case 'interact': return { text: d.text && !d.effects && !d.dialogue ? 'Осмотреть' : (d.label ? 'Использовать' : 'Осмотреть'), sub: d.label };
      case 'secret': return this.revealed && !this.isOpened() && d.prop !== 'wall' ? { text: 'Коснуться знака', sub: d.label ?? 'Знак Основателей' } : null;
      case 'brazier': return this.state.lit ? null : { text: 'Холодная жаровня', sub: 'Нужен огонь' };
      case 'crystal': return this.state.charged ? null : { text: 'Тусклый кристалл', sub: 'Ждёт разряда' };
      case 'seal': return this.condOk() ? { text: this.isOpened() ? 'Печать восстановлена' : 'Восстановить печать', sub: d.label ?? 'Древняя печать' } : null;
      case 'waystone': return { text: 'Камень перехода', sub: 'Быстрое перемещение' };
      case 'block': return { text: 'Тяжёлый блок', sub: '«Порыв» сдвинет его' };
      case 'web': return this.isOpened() ? null : { text: 'Паутина', sub: 'Сожгите «Пламенем»' };
      default: return null;
    }
  }

  harvestable(): boolean {
    const day = G().harvested[this.sid()];
    return day === undefined || day < G().time.day;
  }

  use(): void {
    const d = this.m.def;
    const eng = this.eng;
    bus.emit('interacted', { id: this.key, zone: this.mgr.zone!.def.id });
    if (d.id !== this.key) bus.emit('interacted', { id: d.id, zone: this.mgr.zone!.def.id });
    switch (d.kind) {
      case 'chest': {
        if (this.isOpened()) return;
        if (d.lock && !this.state.unlocked) { toast('warn', 'Сундук заперт рунами', `Используйте «Отворение» (нужен ранг ${d.lock})`); bus.emit('sfx', { id: 'ui_error' }); return; }
        this.openChest();
        return;
      }
      case 'door': {
        if (this.isOpened()) return;
        if (d.locked && !checkAll(d.locked)) { toast('warn', 'Закрыто', d.lockedText ?? 'Дверь не поддаётся.'); bus.emit('sfx', { id: 'ui_error' }); return; }
        if (d.key && countItem(d.key)) { this.openDoor(); return; }
        if (d.lock) { toast('warn', 'Руническая печать', `Нужно «Отворение» ранга ${d.lock} (ваш ранг: ${unlockRank()})`); bus.emit('sfx', { id: 'ui_error' }); return; }
        this.openDoor();
        return;
      }
      case 'gate': toast('warn', d.label ?? 'Решётка', d.lockedText ?? 'Её открывает какой-то механизм.'); return;
      case 'herb':
      case 'ore': {
        if (!this.harvestable()) return;
        const mult = d.kind === 'herb' && G().player.circle === 'root' ? 2 : 1;
        const bonus = d.kind === 'herb' && G().player.origin === 'foundling' && Math.random() < 0.4 ? 1 : 0;
        addItem(d.item!, (d.count ?? 1) * mult + bonus);
        mutate((g) => { g.harvested[this.sid()] = g.time.day; g.counters.harvested = (g.counters.harvested ?? 0) + 1; });
        eng.particles.emit({ x: this.x, y: 0.6, z: this.z, count: 16, speed: 2, up: 1.5, life: 0.7, color: 0xb0ff90, size: 0.35 });
        this.obj.visible = false;
        return;
      }
      case 'station': setUI({ craft: d.station ?? 'alchemy' }); bus.emit('sfx', { id: 'ui_open' }); return;
      case 'bed': setUI({ waitMenu: true }); return;
      case 'board': setUI({ read: { title: d.label ?? 'Доска поручений', body: '', kind: 'board' } }); bus.emit('sfx', { id: 'page' }); return;
      case 'lore': {
        const lore = d.lore ? LORE[d.lore] : null;
        if (lore) { apply([{ lore: d.lore! }]); setUI({ read: { title: lore.title, body: lore.text, kind: 'lore' } }); }
        else if (d.text) setUI({ read: { title: d.label ?? 'Записи', body: d.text, kind: 'note' } });
        apply(d.effects);
        bus.emit('sfx', { id: 'page' });
        return;
      }
      case 'pickup': {
        if (this.isOpened()) return;
        this.markOpened();
        addItem(d.item!, d.count ?? 1);
        apply(d.effects);
        this.active = false;
        this.obj.visible = false;
        return;
      }
      case 'interact': {
        if (d.once && G().flags[`used_${this.sid()}`]) { if (d.text) setUI({ read: { title: d.label ?? '', body: d.text, kind: 'note' } }); return; }
        if (d.once) mutate((g) => { g.flags[`used_${this.sid()}`] = true; });
        if (d.dialogue) { startDialogue(d.dialogue); return; }
        if (d.text) setUI({ read: { title: d.label ?? '', body: d.text, kind: d.prop === 'sign' ? 'sign' : 'note' } });
        apply(d.effects);
        if (this.state.arm) (this.state.arm as THREE.Object3D).rotation.z = -0.5;
        return;
      }
      case 'secret': {
        if (!this.revealed || this.isOpened() || d.prop === 'wall') return;
        this.markOpened();
        this.active = false;
        eng.particles.emit({ x: this.x, y: 0.8, z: this.z, count: 60, speed: 4, up: 2, life: 1.2, color: 0xffe9a0, color2: 0xffffff, size: 0.6 });
        bus.emit('sfx', { id: 'secret' });
        mutate((g) => { g.counters.founder_marks = (g.counters.founder_marks ?? 0) + 1; });
        const n = G().counters.founder_marks ?? 0;
        toast('achievement', `Знак Основателей ${n} / ${FOUNDER_MARKS}`, d.text ?? 'Древний символ вспыхнул и угас.');
        apply(d.effects);
        apply([{ xp: 40 }]);
        if (n >= FOUNDER_MARKS) apply([{ achievement: 'secrets' }]);
        this.obj.visible = false;
        return;
      }
      case 'seal': {
        if (!this.condOk() || this.isOpened()) return;
        setUI({ minigame: { type: 'runes', id: `seal_${d.id}`, difficulty: 4, title: d.label ?? 'Восстановление печати', onWin: [...(d.effects ?? []), { script: 'sealRestored', arg: `${this.zone}:${this.key}` }] } });
        return;
      }
      case 'waystone': {
        const flag = `waystone_${this.zone}`;
        if (!G().flags[flag]) { apply([{ setFlag: flag }]); toast('info', 'Камень перехода пробуждён', 'Теперь сюда можно быстро вернуться'); bus.emit('sfx', { id: 'teleport' }); }
        setUI({ fastTravel: true });
        return;
      }
      case 'brazier': toast('info', 'Жаровня', 'Подожгите её заклинанием «Пламя».'); return;
      case 'crystal': toast('info', 'Кристалл', 'Зарядите его «Молнией» или несколькими «Искрами».'); return;
      case 'block': toast('info', 'Каменный блок', 'Сдвиньте его «Порывом».'); return;
      case 'web': toast('info', 'Паутина', 'Сожгите её «Пламенем».'); return;
      default: return;
    }
  }

  openChest(): void {
    const d = this.m.def;
    this.markOpened();
    if (this.state.lid) (this.state.lid as THREE.Object3D).rotation.x = -1.6;
    if (this.glow) this.glow.visible = false;
    bus.emit('sfx', { id: 'chest' });
    this.eng.particles.emit({ x: this.x, y: 0.8, z: this.z, count: 40, speed: 3, up: 2, life: 1, color: 0xffd080, size: 0.5 });
    for (const it of d.loot ?? []) addItem(it.id, it.count ?? 1);
    if (d.gold) apply([{ gold: d.gold }]);
    apply(d.effects);
    mutate((g) => { g.counters.chests = (g.counters.chests ?? 0) + 1; });
  }

  openDoor(): void {
    this.markOpened();
    bus.emit('sfx', { id: 'door' });
    this.syncGrid();
    apply(this.m.def.effects);
  }

  // заклинание «Отворение»
  tryUnlock(): string | null {
    const d = this.m.def;
    if ((d.kind !== 'door' && d.kind !== 'chest') || !d.lock || this.isOpened() || this.state.unlocked) return null;
    const rank = unlockRank();
    if (d.lock > rank) {
      toast('warn', 'Печать слишком сложна', `Ранг замка ${d.lock}, ваш ранг «Отворения» — ${rank}. Сдайте экзамен по трансформации или наберитесь опыта.`);
      bus.emit('sfx', { id: 'ui_error' });
      return null;
    }
    if (d.locked && !checkAll(d.locked)) { toast('warn', 'Печать не поддаётся', d.lockedText ?? ''); return null; }
    this.state.unlocked = true;
    this.eng.particles.emit({ x: this.x, y: 1.4, z: this.z, count: 40, speed: 3, life: 0.8, color: 0xe3c46b, size: 0.5 });
    if (this.state.rune) (this.state.rune as THREE.Object3D).visible = false;
    bus.emit('sfx', { id: 'unlock', x: this.x, z: this.z });
    if (d.kind === 'door') this.openDoor(); else this.openChest();
    bus.emit('spellHitObject', { spell: 'unlock', object: this.key, kind: d.kind });
    mutate((g) => { g.counters.unlocked = (g.counters.unlocked ?? 0) + 1; });
    return this.key;
  }

  reveal(): boolean {
    if (this.revealed) return false;
    this.revealed = true;
    mutate((g) => { if (!g.opened.includes(this.sid('rev'))) g.opened.push(this.sid('rev')); });
    this.obj.visible = this.condOk();
    this.eng.particles.emit({ x: this.x, y: 1, z: this.z, count: 40, speed: 2, up: 1, life: 1.2, color: 0xffe9a0, size: 0.6 });
    bus.emit('sfx', { id: 'secret', x: this.x, z: this.z });
    if (this.kind === 'secret' && this.m.def.prop === 'wall') {
      this.markOpened();
      toast('info', 'Тайный проход!', 'Стена растворилась в свете.');
      apply(this.m.def.effects);
    }
    this.syncGrid();
    bus.emit('spellHitObject', { spell: 'reveal', object: this.key, kind: this.kind });
    return true;
  }

  spellHit(spell: string): boolean {
    const d = this.m.def;
    if (!this.obj.visible) return false;
    if (d.kind === 'brazier' && spell === 'flame' && !this.state.lit) {
      this.state.lit = true;
      (this.state.fire as THREE.Object3D).visible = true;
      (this.state.light as { on: boolean }).on = true;
      mutate((g) => { if (!g.opened.includes(this.sid('lit'))) g.opened.push(this.sid('lit')); });
      bus.emit('sfx', { id: 'burn', x: this.x, z: this.z });
      this.eng.particles.emit({ x: this.x, y: 1.5, z: this.z, count: 30, speed: 2, up: 2, life: 0.8, color: 0xffa040, size: 0.6 });
      bus.emit('spellHitObject', { spell, object: this.key, kind: 'brazier' });
      this.mgr.checkGroup(d.group);
      return true;
    }
    if (d.kind === 'crystal' && (spell === 'storm' || spell === 'spark') && !this.state.charged) {
      const hits = ((this.state.hits as number) ?? 0) + (spell === 'storm' ? 3 : 1);
      this.state.hits = hits;
      const cr = this.state.cr as THREE.Mesh;
      (cr.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.4 + Math.min(3, hits) * 0.4;
      bus.emit('sfx', { id: 'resonance', x: this.x, z: this.z, pitch: 1 + hits * 0.2 });
      if (hits >= 3) {
        this.state.charged = true;
        if (this.glow) this.glow.visible = true;
        mutate((g) => { if (!g.opened.includes(this.sid('chg'))) g.opened.push(this.sid('chg')); });
        this.eng.particles.emit({ x: this.x, y: 1.2, z: this.z, count: 40, speed: 3, life: 0.8, color: 0xa8c0ff, size: 0.5 });
        bus.emit('spellHitObject', { spell: 'storm', object: this.key, kind: 'crystal' });
        this.mgr.checkGroup(d.group);
      }
      return true;
    }
    if (d.kind === 'web' && spell === 'flame' && !this.isOpened()) {
      this.markOpened();
      this.syncGrid();
      this.active = false;
      bus.emit('sfx', { id: 'burn', x: this.x, z: this.z });
      this.eng.particles.emit({ x: this.x, y: 1.3, z: this.z, count: 50, spread: 0.8, speed: 2, up: 2, life: 0.9, color: 0xffa040, color2: 0x3a2a1a, size: 0.6 });
      bus.emit('spellHitObject', { spell, object: this.key, kind: 'web' });
      return true;
    }
    if (d.kind === 'interact' && d.prop === 'target' && (spell === 'spark' || spell === 'flame' || spell === 'frost')) {
      bus.emit('spellHitObject', { spell, object: this.key, kind: 'target' });
      this.eng.particles.emit({ x: this.x, y: 1.2, z: this.z, count: 20, speed: 3, life: 0.5, color: 0x9ad0ff, size: 0.4 });
      return true;
    }
    return false;
  }

  push(dx: number, dz: number): boolean {
    if (this.kind !== 'block') return false;
    const g = this.mgr.zone!.grid;
    const ax = Math.abs(dx) > Math.abs(dz) ? Math.sign(dx) : 0;
    const az = ax === 0 ? Math.sign(dz) : 0;
    const c = this.state.col as number, r = this.state.row as number;
    const nc = c + ax, nr = r + az;
    if (blockedCell(g, nc, nr, this.eng.now) || this.mgr.items.some((it) => it !== this && it.kind === 'block' && it.state.col === nc && it.state.row === nr)) {
      bus.emit('sfx', { id: 'ui_error' });
      return false;
    }
    g.dyn[r * g.w + c] = 0;
    g.dyn[nr * g.w + nc] = 3;
    this.state.col = nc; this.state.row = nr;
    const [x, z] = cellCenter(nc, nr);
    this.state.tx = x; this.state.tz = z;
    bus.emit('sfx', { id: 'slam', x, z, volume: 0.6 });
    this.eng.smoke.emit({ x: this.x, y: 0.3, z: this.z, count: 10, speed: 1.5, life: 0.8, color: 0x8a7a6a, size: 1, alpha: 0.4 });
    setTimeout(() => this.mgr.checkPlates(), 400);
    return true;
  }

  update(dt: number): void {
    this.t += dt;
    if (this.glow) this.glow.scale.setScalar((this.glow.userData.base ?? (this.glow.userData.base = this.glow.scale.x)) * (1 + Math.sin(this.t * 2.5) * 0.12));
    if (this.kind === 'herb' || this.kind === 'ore') this.obj.visible = this.revealed && this.condOk() && this.harvestable();
    if (this.kind === 'pickup' && this.state.gem) { const gem = this.state.gem as THREE.Object3D; gem.rotation.y += dt * 2; gem.position.y = 0.6 + Math.sin(this.t * 3) * 0.1; }
    if (this.kind === 'interact' && this.state.orb) (this.state.orb as THREE.Object3D).position.y = 1.2 + Math.sin(this.t * 2) * 0.08;
    if (this.kind === 'door' && this.isOpened()) {
      const h = this.state.hinge as THREE.Object3D;
      h.rotation.y += (-1.7 - h.rotation.y) * Math.min(1, dt * 4);
    }
    if (this.kind === 'block' && this.state.tx !== undefined) {
      this.x += ((this.state.tx as number) - this.x) * Math.min(1, dt * 8);
      this.z += ((this.state.tz as number) - this.z) * Math.min(1, dt * 8);
      this.obj.position.set(this.x, 0, this.z);
    }
    if (this.kind === 'seal' && this.state.circle) (this.state.circle as THREE.Object3D).rotation.y += dt * 0.3;
    if (this.state.fire === true && Math.random() < dt * 12) this.eng.particles.emit({ x: this.x + (Math.random() - 0.5) * 1.2, y: 0.5, z: this.z + 0.2, count: 1, speed: 0.4, up: 1.6, life: 0.7, color: 0xffa040, color2: 0xff3010, size: 0.6 });
    if (this.kind === 'exit') {
      const mat = this.state.mat as THREE.MeshBasicMaterial;
      mat.opacity = 0.12 + Math.sin(this.t * 2) * 0.05;
      const p = this.eng.player;
      const dist = Math.hypot(p.x - this.x, p.z - this.z);
      const { w, h } = this.eng.size;
      const target = this.m.def.to ? ZONES[this.m.def.to] : null;
      const locked = (this.m.def.locked && !checkAll(this.m.def.locked)) || (target?.unlock && !checkAll(target.unlock));
      this.eng.floaters.label('exit_' + this.key, `<span>${locked ? '🔒 ' : '➜ '}${this.state.label as string}</span>`, 'exit-label');
      this.eng.floaters.placeLabel('exit_' + this.key, this.x, 3.1, this.z, this.eng.camera, w, h, dist < 9);
    }
    const candles = this.state.candles as { m: THREE.Mesh; f: THREE.Sprite; ox: number; oz: number; y: number; ph: number }[] | undefined;
    if (candles) {
      for (const c of candles) {
        const y = c.y + Math.sin(this.t * 0.8 + c.ph) * 0.15;
        c.m.position.set(c.ox, y, c.oz);
        c.f.position.set(c.ox, y + 0.28, c.oz);
      }
    }
    if (this.kind === 'plate') {
      const pressed = this.mgr.items.some((it) => it.kind === 'block' && it.state.col === this.m.col && it.state.row === this.m.row);
      ((this.state.rune as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = pressed ? 1 : 0.35;
    }
  }

  dispose(): void { this.obj.removeFromParent(); }
}

export class InteractManager {
  items: Interactable[] = [];
  zone: BuiltZone | null = null;
  private exits = new Map<number, MarkerInstance>();

  constructor(public eng: Engine) {
    const refresh = () => this.refreshConditions();
    bus.on('flagSet', refresh);
    bus.on('questUpdated', refresh);
    bus.on('hourChanged', refresh);
    bus.on('enemyKilled', () => setTimeout(refresh, 50));
    bus.on('itemChanged', refresh);
  }

  circleColor(): string {
    const c = G().player.circle;
    return { flame: '#8f2a2a', bastion: '#2d4a6b', root: '#2f5a3a', star: '#3d2d6b' }[c];
  }

  build(z: BuiltZone): void {
    this.zone = z;
    this.exits.clear();
    for (const m of z.markers) {
      if (m.def.kind === 'spawn' || m.def.kind === 'anchor' || m.def.kind === 'enemy') continue;
      if (m.def.kind === 'exit') this.exits.set(m.row * z.grid.w + m.col, m);
      this.items.push(new Interactable(this, m));
    }
    // блоки помечаем как динамические преграды
    for (const it of this.items) if (it.kind === 'block') { z.grid.dyn[it.m.row * z.grid.w + it.m.col] = 3; z.grid.walk[it.m.row * z.grid.w + it.m.col] = 0; }
  }

  exitAt(c: number, r: number): MarkerInstance | null {
    const m = this.exits.get(r * this.zone!.grid.w + c);
    if (!m) return null;
    if (m.def.if && !checkAll(m.def.if)) return null;
    return m;
  }

  refreshConditions(): void {
    if (!this.zone) return;
    for (const it of this.items) {
      const vis = it.revealed && it.condOk();
      if (it.kind !== 'web' && !(it.kind === 'secret' && it.m.def.prop === 'wall') && it.kind !== 'herb' && it.kind !== 'ore') it.obj.visible = vis && (it.kind !== 'pickup' || !it.isOpened()) && (it.kind !== 'secret' || !it.isOpened());
      it.syncGrid();
    }
  }

  nearest(x: number, z: number, r: number): { item: Interactable; dist: number } | null {
    let best: Interactable | null = null;
    let bd = r;
    for (const it of this.items) {
      if (!it.active || !it.obj.visible || it.kind === 'exit') continue;
      const d = Math.hypot(it.x - x, it.z - z) - (['station', 'board', 'seal', 'bed', 'door', 'gate', 'block'].includes(it.kind) ? 0.9 : 0);
      if (d < bd && it.prompt()) { bd = d; best = it; }
    }
    return best ? { item: best, dist: bd } : null;
  }

  unlockNear(x: number, z: number, r: number): string | undefined {
    let any = false;
    for (const it of this.items) {
      if (Math.hypot(it.x - x, it.z - z) > r + 1) continue;
      const k = it.tryUnlock();
      if (k) return k;
      if ((it.kind === 'door' || it.kind === 'chest') && it.m.def.lock && !it.isOpened()) any = true;
    }
    if (!any) toast('info', 'Рядом нет рунических замков');
    return undefined;
  }

  revealNear(x: number, z: number, r: number): string | undefined {
    let found: string | undefined;
    for (const it of this.items) {
      if (it.revealed || !it.condOk()) continue;
      if (Math.hypot(it.x - x, it.z - z) <= r && it.reveal()) found = it.key;
    }
    if (!found) {
      let nd = 1e9;
      for (const it of this.items) {
        if (it.revealed || !it.condOk()) continue;
        nd = Math.min(nd, Math.hypot(it.x - x, it.z - z));
      }
      if (nd < 26) {
        const steps = Math.round(nd / 2);
        toast('spell', 'Эфир отзывается…', steps < 7 ? 'Тайна совсем близко!' : steps < 11 ? `Тайна рядом — около ${steps} шагов` : 'Где-то в этой области спрятана тайна');
        bus.emit('sfx', { id: 'resonance', pitch: Math.max(0.6, 2 - nd / 15) });
      } else toast('info', 'Ничего скрытого поблизости');
    }
    return found;
  }

  spellAt(spell: string, x: number, z: number, r: number): Interactable | null {
    for (const it of this.items) {
      if (Math.hypot(it.x - x, it.z - z) > r + 0.6) continue;
      if (it.spellHit(spell)) return it;
    }
    return null;
  }

  projectileHit(spell: string, x: number, z: number): boolean {
    for (const it of this.items) {
      if (!['brazier', 'crystal', 'web'].includes(it.kind) && !(it.kind === 'interact' && it.m.def.prop === 'target')) continue;
      if (Math.hypot(it.x - x, it.z - z) > 1.0) continue;
      if (it.spellHit(spell)) return true;
      if (it.kind !== 'interact') return true; // объект поглощает снаряд, даже если не реагирует
    }
    return false;
  }

  gust(px: number, pz: number, dx: number, dz: number, range: number): void {
    for (const it of this.items) {
      if (it.kind !== 'block') continue;
      const ex = it.x - px, ez = it.z - pz;
      const d = Math.hypot(ex, ez);
      if (d > range || (ex * dx + ez * dz) / (d || 1) < 0.5) continue;
      it.push(dx, dz);
    }
  }

  checkGroup(group?: string): void {
    if (!group || !this.zone) return;
    const members = this.items.filter((it) => it.m.def.group === group && (it.kind === 'brazier' || it.kind === 'crystal'));
    if (!members.length) return;
    const solved = members.every((it) => (it.kind === 'brazier' ? it.state.lit : it.state.charged));
    if (solved) this.solve(group);
  }

  checkPlates(): void {
    const groups = new Set(this.items.filter((it) => it.kind === 'plate').map((it) => it.m.def.group ?? ''));
    for (const gname of groups) {
      const plates = this.items.filter((it) => it.kind === 'plate' && (it.m.def.group ?? '') === gname);
      const ok = plates.every((pl) => this.items.some((b) => b.kind === 'block' && b.state.col === pl.m.col && b.state.row === pl.m.row));
      if (ok && gname) this.solve(gname);
    }
  }

  private solve(group: string): void {
    const flag = `puzzle_${this.zone!.def.id}_${group}`;
    if (G().flags[flag]) return;
    apply([{ setFlag: flag }]);
    bus.emit('sfx', { id: 'rune_ok' });
    toast('info', 'Механизм пробудился', 'Где-то открылся проход');
    apply([{ xp: 80 }]);
    for (const it of this.items) {
      if (it.m.def.group !== group) continue;
      if (it.kind === 'door' && !it.isOpened()) it.openDoor();
      if (it.m.def.effects && (it.kind === 'brazier' || it.kind === 'crystal' || it.kind === 'plate' || it.kind === 'gate')) apply(it.m.def.effects);
      it.syncGrid();
    }
    mutate((g) => { g.counters.puzzles = (g.counters.puzzles ?? 0) + 1; });
  }

  update(dt: number): void { for (const it of this.items) it.update(dt); }

  find(key: string): Interactable | undefined { return this.items.find((it) => it.key === key || it.m.def.id === key); }

  clear(): void {
    for (const it of this.items) { it.dispose(); this.eng.floaters.removeLabel('exit_' + it.key); }
    this.items = [];
    this.exits.clear();
    this.zone = null;
  }
}
