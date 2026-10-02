// Герой: управление, уклонение, щит, анимация, шаги.
import * as THREE from 'three';
import type { Engine } from './Engine';
import { buildCharacter, animateCharacter } from './models';
import { voice } from '@/core/voice';
import type { CharacterRig } from './models';
import { input } from '@/core/input';
import { bus } from '@/core/bus';
import { G, hasGame, ui } from '@/state/store';
import { derived } from '@/systems/player';
import { moveCircle } from './physics';
import { TS } from './world';
import { CIRCLES } from '@/data/world';
import { ITEMS } from '@/data/items';
import { useQuickItem } from '@/systems/inventory';
import type { LightSource } from './props';
import type { Appearance } from '@/data/types';

const DEFAULT_LOOK: Appearance = { skin: '#e0b89a', hair: '#3a2a1a', hairStyle: 'short', eyes: '#3a5a7a', robe: '#1e1a22', trim: '#c9a050' };

export class PlayerEntity {
  rig: CharacterRig;
  x = 0; z = 0; facing = 0;
  readonly radius = 0.42;
  private vx = 0; private vz = 0;
  dodgeT = 0;
  private dodgeDir = { x: 0, z: 1 };
  private dodgeReady = 0;
  iframesUntil = 0;
  castAnim = 0;
  shielding = false;
  shieldStart = 0;
  lightUntil = 0;
  hotUntil = 0;
  hotRate = 0;
  slowUntil = 0;
  rootUntil = 0;
  aimFaceUntil = 0;
  private t = 0;
  private stepAcc = 0;
  private lastSafe = { x: 0, z: 0 };
  private lookKey = '';
  private light: LightSource = { x: 0, y: 2, z: 0, color: 0xffd9a0, intensity: 0.9, distance: 7, flicker: 0, kind: 'player' };
  moving = 0;

  constructor(private eng: Engine) {
    this.rig = buildCharacter(DEFAULT_LOOK);
    eng.scene.add(this.rig.root);
  }

  private currentLookKey(): string {
    if (!hasGame()) return '';
    const g = G();
    return JSON.stringify([g.player.appearance, g.player.circle, g.equipment.robe, g.equipment.hat, g.equipment.wand]);
  }

  rebuild(): void {
    if (!hasGame()) return;
    const g = G();
    const a = g.player.appearance;
    const circle = CIRCLES[g.player.circle];
    const robeItem = g.equipment.robe ? g.inventory.find((i) => i.uid === g.equipment.robe) : null;
    const hatItem = g.equipment.hat ? g.inventory.find((i) => i.uid === g.equipment.hat) : null;
    const wandItem = g.equipment.wand ? g.inventory.find((i) => i.uid === g.equipment.wand) : null;
    const look: Appearance = { ...a, robe: robeItem ? ITEMS[robeItem.id]?.color ?? '#1e1a22' : '#1e1a22', trim: circle.trim, scarf: undefined, gender: g.player.gender === 'f' ? 'f' : 'm', age: 'young' };
    const old = this.rig;
    const rig = buildCharacter(look);
    rig.root.position.copy(old.root.position);
    rig.root.rotation.copy(old.root.rotation);
    rig.root.visible = old.root.visible;
    old.dispose();
    this.eng.scene.add(rig.root);
    this.rig = rig;
    rig.setRobe(look.robe, circle.color);
    if (hatItem) rig.setHat(hatItem.id === 'moon_hat' ? 'tall' : 'pointed', ITEMS[hatItem.id]?.color);
    rig.wand.visible = true;
    const wd = wandItem ? ITEMS[wandItem.id] : null;
    const glow = wd?.element === 'fire' ? 0xffa060 : wd?.element === 'frost' ? 0xa0e0ff : wd?.element === 'storm' ? 0xb0c0ff : 0xfff0c0;
    rig.setWandColor(wd?.color ?? '#6a4a2a', glow);
    this.eng.view?.setLook({ skin: a.skin, robe: look.robe, trim: circle.color, wand: wd?.color ?? '#6a4a2a', glow });
    rig.root.visible = this.eng.mode !== 'first' && !this.eng.title;
    this.lookKey = this.currentLookKey();
  }

  place(x: number, z: number, facing: number): void {
    this.x = x; this.z = z; this.facing = facing;
    this.lastSafe = { x, z };
    this.vx = this.vz = 0;
    this.dodgeT = 0;
    this.shielding = false;
    if (this.currentLookKey() !== this.lookKey) this.rebuild();
    this.rig.root.position.set(x, 0, z);
    this.rig.root.rotation.y = facing;
  }

  pushBack(): void {
    this.x = this.lastSafe.x;
    this.z = this.lastSafe.z;
    this.vx = this.vz = 0;
  }

  wandTipWorld(): THREE.Vector3 {
    const v = new THREE.Vector3();
    if (this.eng.mode === 'first' && this.eng.view?.group.visible) return this.eng.view.tipWorld(v);
    this.rig.wandTip.getWorldPosition(v);
    return v;
  }

  lightSource(): LightSource {
    const now = this.eng.now;
    const lit = this.lightUntil > now;
    this.light.x = this.x;
    this.light.z = this.z;
    this.light.y = lit ? 3.2 : 2.2;
    const deep = this.eng.zone?.def.dark || this.eng.zone?.def.theme === 'sanctum' || this.eng.zone?.def.theme === 'dungeon';
    this.light.intensity = lit ? 2.8 : deep ? 1.3 : 0.55;
    this.light.distance = lit ? 17 : deep ? 9 : 6;
    this.light.color = lit ? 0xfff0c0 : 0xffd9a0;
    return this.light;
  }

  update(dt: number): void {
    this.t += dt;
    const now = this.eng.now;
    if (this.currentLookKey() !== this.lookKey) this.rebuild();
    const d = derived();
    const g = G();
    const dead = g.player.hp <= 0;

    // --- желаемое направление движения (экранные оси: вверх = −z)
    let mx = 0, mz = 0;
    if (!dead) {
      if (input.isDown('up')) mz -= 1;
      if (input.isDown('down')) mz += 1;
      if (input.isDown('left')) mx -= 1;
      if (input.isDown('right')) mx += 1;
      if (input.touch.active) { mx += input.touch.moveX; mz += input.touch.moveY; }
    }
    // в режимах обзора «вперёд» — это направление взгляда камеры
    const look = this.eng.mode !== 'iso';
    if (look) {
      const fx = Math.sin(this.eng.yaw), fz = Math.cos(this.eng.yaw);
      const wx = fx * -mz + -fz * mx, wz = fz * -mz + fx * mx;
      mx = wx; mz = wz;
    }
    const ml = Math.hypot(mx, mz);
    if (ml > 1) { mx /= ml; mz /= ml; }
    const rooted = this.rootUntil > now;

    // --- кувырок
    if (input.wasPressed('dodge') && now >= this.dodgeReady && !rooted && !dead) {
      const dir = ml > 0.1 ? { x: mx / Math.max(ml, 1e-3), z: mz / Math.max(ml, 1e-3) } : { x: Math.sin(this.facing), z: Math.cos(this.facing) };
      const l = Math.hypot(dir.x, dir.z) || 1;
      this.dodgeDir = { x: dir.x / l, z: dir.z / l };
      this.dodgeT = 0.32;
      this.dodgeReady = now + 0.75;
      this.iframesUntil = now + 0.36;
      this.shielding = false;
      bus.emit('sfx', { id: 'dodge' });
      this.eng.smoke.emit({ x: this.x, y: 0.2, z: this.z, count: 10, speed: 1.5, life: 0.6, color: 0x8a7a6a, size: 0.9, size2: 1.6, alpha: 0.35, drag: 3 });
    }

    let speed = d.moveSpeed;
    const sprint = input.isDown('sprint') && !this.shielding;
    if (sprint) speed *= 1.42;
    if (this.slowUntil > now) speed *= 0.5;
    if (this.shielding) speed *= 0.5;
    if (this.castAnim > 0.5) speed *= 0.85;
    let dx: number, dz: number;
    if (this.dodgeT > 0) {
      this.dodgeT -= dt;
      dx = this.dodgeDir.x * 13 * dt;
      dz = this.dodgeDir.z * 13 * dt;
      this.facing = Math.atan2(this.dodgeDir.x, this.dodgeDir.z);
    } else {
      const tx = rooted ? 0 : mx * speed, tz = rooted ? 0 : mz * speed;
      const k = 1 - Math.exp(-dt * 14);
      this.vx += (tx - this.vx) * k;
      this.vz += (tz - this.vz) * k;
      dx = this.vx * dt; dz = this.vz * dt;
    }
    const grid = this.eng.zone!.grid;
    const [nx, nz] = moveCircle(grid, this.x, this.z, dx, dz, this.radius, now);
    // мягкое расталкивание с NPC и врагами
    let px = nx, pz = nz;
    for (const e of this.eng.enemies) {
      if (e.dead || e.flying) continue;
      const ex = px - e.x, ez = pz - e.z;
      const dd = Math.hypot(ex, ez), min = this.radius + e.radius;
      if (dd < min && dd > 1e-4) { px += (ex / dd) * (min - dd) * 0.6; pz += (ez / dd) * (min - dd) * 0.6; }
    }
    [px, pz] = this.eng.npcs.separate(px, pz, this.radius);
    [this.x, this.z] = moveCircle(grid, px, pz, 0, 0, this.radius, now);
    const c = Math.floor(this.x / TS), r = Math.floor(this.z / TS);
    if (grid.water[r * grid.w + c] !== 1) this.lastSafe = { x: this.x, z: this.z };
    else if (grid.ice[r * grid.w + c] <= now) { this.pushBack(); }

    const actualSpeed = Math.hypot(dx, dz) / Math.max(dt, 1e-4);
    this.moving = Math.min(1, actualSpeed / 5);

    // --- направление взгляда
    const aimDir = this.eng.screenToWorldDir();
    if (this.dodgeT <= 0) {
      let targetFacing = this.facing;
      if (this.eng.mode === 'first') targetFacing = this.eng.yaw;
      else if (this.aimFaceUntil > now || this.shielding) targetFacing = Math.atan2(aimDir.x, aimDir.z);
      else if (ml > 0.1) targetFacing = Math.atan2(mx, mz);
      let diff = targetFacing - this.facing;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.facing += diff * Math.min(1, dt * 14);
    }

    // --- бой и действия
    if (!dead && !ui().dialogue) {
      const combat = this.eng.combat;
      if ((input.mouse.left || input.mouse.leftPressed || input.isDown('attack')) && this.dodgeT <= 0) combat.castSpell('spark', true);
      const wantShield = (input.mouse.right || input.isDown('shield')) && g.spells.known.includes('ward') && this.dodgeT <= 0;
      if (wantShield && !this.shielding) {
        if (combat.startShield()) { this.shielding = true; this.shieldStart = now; }
      } else if (!wantShield && this.shielding) {
        this.shielding = false;
        combat.stopShield();
      }
      for (let i = 0; i < 6; i++) {
        if (input.wasPressed(`spell${i + 1}` as 'spell1')) {
          const id = g.spells.slots[i];
          if (id) combat.castSpell(id, false);
        }
      }
      if (input.wasPressed('potion')) useQuickItem();
      if (input.wasPressed('interact')) this.eng.useNearest();
    }

    // --- шаги
    if (this.moving > 0.2 && this.dodgeT <= 0) {
      this.stepAcc += dt * (sprint ? 2.6 : 2.0) * this.moving;
      if (this.stepAcc > 1) {
        this.stepAcc = 0;
        const f = grid.floor[r * grid.w + c] ?? 'stone';
        const id = f === 'grass' || f === 'snow' || f === 'dirt' || f === 'sand' ? 'step_grass' : f === 'wood' || f === 'carpet' ? 'step_wood' : f === 'water' ? 'step_water' : 'step_stone';
        bus.emit('sfx', { id, volume: 0.55, x: this.x, z: this.z });
        if (f === 'snow' || f === 'dirt') this.eng.smoke.emit({ x: this.x, y: 0.1, z: this.z, count: 2, speed: 0.6, life: 0.5, color: f === 'snow' ? 0xffffff : 0x8a7050, size: 0.4, alpha: 0.4 });
        if (f === 'water') this.eng.particles.emit({ x: this.x, y: 0.1, z: this.z, count: 4, speed: 1.2, up: 1.5, gravity: 6, life: 0.4, color: 0x9ad0ff, size: 0.15 });
      }
    }

    // --- эффекты на герое
    if (this.lightUntil > now && Math.random() < dt * 20) {
      this.eng.particles.emit({ x: this.x + Math.sin(this.t * 2) * 0.6, y: 2.6 + Math.sin(this.t * 3) * 0.2, z: this.z + Math.cos(this.t * 2) * 0.6, count: 1, speed: 0.3, life: 0.8, color: 0xfff0b0, size: 0.35, up: 0.3 });
    }
    if (this.shielding) {
      const a = this.t * 4;
      if (Math.random() < dt * 40) this.eng.particles.emit({ x: this.x + Math.cos(a) * 1.0, y: 0.6 + Math.random() * 1.6, z: this.z + Math.sin(a) * 1.0, count: 1, speed: 0.2, life: 0.5, color: 0x8ac8ff, size: 0.3 });
    }
    if (this.hotUntil > now && Math.random() < dt * 8) {
      this.eng.particles.emit({ x: this.x, y: 0.5, z: this.z, count: 2, spread: 0.5, speed: 0.5, up: 1.4, life: 0.9, color: 0x8af0a0, size: 0.3 });
    }

    this.castAnim = Math.max(0, this.castAnim - dt * 3);
    const dodgePhase = this.dodgeT > 0 ? 1 - this.dodgeT / 0.32 : 0;
    animateCharacter(this.rig, this.t, this.moving, this.shielding ? 0.8 : this.castAnim, dodgePhase, dt, { mouth: voice.mouth('player', this.t), lookYaw: 0, lookPitch: this.eng.mode === 'third' ? -this.eng.pitch * 0.4 : 0 });
    this.rig.root.position.set(this.x, 0, this.z);
    this.rig.root.rotation.y = this.facing;
    const hurt = (this.rig.root.userData.hurt ?? 0) as number;
    if (hurt > 0) this.rig.root.userData.hurt = hurt - dt;
  }
}
