// Противники: модели, ИИ, статусы, анимация смерти.
import type { Engine } from './Engine';
import { ENEMIES } from '@/data/enemies';
import type { EnemyDef } from '@/data/types';
import { buildCreature } from './models';
import type { CreatureRig } from './models';
import { findPath, lineOfSight, moveCircle, blockedCell } from './physics';
import { TS } from './world';
import { bus } from '@/core/bus';
import { G } from '@/state/store';
import { BossBrain, createBossBrain } from './bosses';

export interface Statuses {
  burning: number; burnDps: number;
  chilled: number; chillStacks: number;
  frozen: number; rooted: number; stunned: number; pacified: number; blinded: number;
}

export type EnemyState = 'idle' | 'chase' | 'windup' | 'attack' | 'recover' | 'flee' | 'return' | 'dash';

let seq = 1;

export class EnemyEntity {
  readonly uid = 'e' + seq++;
  def: EnemyDef;
  rig: CreatureRig;
  x: number; z: number; facing = 0;
  radius: number;
  hp: number; maxHp: number;
  damageMult: number;
  dead = false; removed = false; deathT = 0;
  state: EnemyState = 'idle';
  stateT = 0;
  attackReady = 0;
  path: [number, number][] = [];
  pathT = 0;
  spawnX: number; spawnZ: number;
  markerKey?: string;
  groupKey?: string;
  respawn?: string;
  uniqueId?: string;
  aggro = false;
  flying: boolean;
  st: Statuses = { burning: 0, burnDps: 0, chilled: 0, chillStacks: 0, frozen: 0, rooted: 0, stunned: 0, pacified: 0, blinded: 0 };
  flash = 0;
  attackAnim = 0;
  t = Math.random() * 10;
  wanderT = 2;
  dashDir = { x: 0, z: 0 };
  dashHit = false;
  telegraph: { dispose(): void } | null = null;
  boss: BossBrain | null = null;
  lastHit = 0;
  invulnerable = false;
  moving = 0;
  knock = { x: 0, z: 0 };
  revealed = false;

  constructor(private eng: Engine, type: string, x: number, z: number, opts: { markerKey?: string; respawn?: string; uniqueId?: string } = {}) {
    const def = ENEMIES[type];
    if (!def) throw new Error('Неизвестный враг ' + type);
    this.def = def;
    const act = G().act;
    const scale = def.boss ? 1 : 1 + (act - 1) * 0.28 + (G().player.level - 1) * 0.03;
    this.maxHp = Math.round(def.hp * scale);
    this.hp = this.maxHp;
    this.damageMult = def.boss ? 1 : 1 + (act - 1) * 0.2;
    this.rig = buildCreature(def.model, def.color, def.color2, def.scale ?? 1);
    this.x = x; this.z = z;
    this.spawnX = x; this.spawnZ = z;
    this.radius = 0.45 * (def.scale ?? 1);
    this.flying = ['wisp', 'wraith', 'hollow', 'book', 'shade'].includes(def.model);
    this.markerKey = opts.markerKey;
    this.respawn = opts.respawn;
    this.uniqueId = opts.uniqueId;
    this.rig.root.position.set(x, 0, z);
    this.attackReady = eng.now + 0.8 + Math.random();
    if (def.boss) this.boss = createBossBrain(eng, this);
  }

  get alive(): boolean { return !this.dead; }

  speedMult(): number {
    const now = this.eng.now;
    if (this.st.frozen > now || this.st.stunned > now || this.st.rooted > now) return 0;
    return this.st.chilled > now ? 0.5 : 1;
  }

  canAct(): boolean {
    const now = this.eng.now;
    return this.st.frozen <= now && this.st.stunned <= now;
  }

  setState(s: EnemyState, t = 0): void {
    this.state = s;
    this.stateT = t;
    if (s !== 'windup' && this.telegraph) { this.telegraph.dispose(); this.telegraph = null; }
  }

  alert(): void {
    if (this.aggro || this.dead) return;
    this.aggro = true;
    this.st.pacified = 0;
    if (this.def.boss) bus.emit('sfx', { id: 'boss_roar' });
    else if (this.def.model === 'hound') bus.emit('sfx', { id: 'howl', x: this.x, z: this.z });
    if (this.groupKey) for (const e of this.eng.enemies) if (e.groupKey === this.groupKey && !e.aggro) e.alert();
  }

  update(dt: number): void {
    this.t += dt;
    const now = this.eng.now;
    if (this.dead) {
      this.deathT += dt;
      this.rig.root.position.y = -this.deathT * 0.8;
      this.rig.root.scale.setScalar(Math.max(0.01, 1 - this.deathT * 0.8));
      if (this.deathT > 1.2) this.removed = true;
      return;
    }
    const p = this.eng.player;
    const dx = p.x - this.x, dz = p.z - this.z;
    const dist = Math.hypot(dx, dz);

    // статусы
    if (this.st.burning > now) {
      this.eng.combat.dot(this, this.st.burnDps * dt, 'fire');
      if (Math.random() < dt * 14) this.eng.particles.emit({ x: this.x, y: 1, z: this.z, count: 1, spread: 0.4, speed: 0.6, up: 2, life: 0.6, color: 0xffa040, color2: 0xff3010, size: 0.5 });
    }
    if (this.st.frozen > now && Math.random() < dt * 4) this.eng.particles.emit({ x: this.x, y: 1.2, z: this.z, count: 1, spread: 0.5, speed: 0.2, life: 0.8, color: 0xd0f4ff, size: 0.3 });
    if (this.st.rooted > now && Math.random() < dt * 5) this.eng.particles.emit({ x: this.x, y: 0.2, z: this.z, count: 1, spread: 0.5, speed: 0.3, up: 0.6, life: 0.6, color: 0x8ac05a, size: 0.3 });
    if (this.dead) return;
    // свет «Светоча» обжигает теней
    if (this.def.tags?.includes('shade') && p.lightUntil > now && dist < 4.5) this.eng.combat.dot(this, 8 * dt, 'light');

    if (this.def.ai === 'dummy') { this.updateDummy(dt); this.finishFrame(dt, 0); return; }

    // обнаружение героя
    const pacified = this.st.pacified > now;
    if (!this.aggro && !pacified && G().player.hp > 0) {
      if (dist < this.def.aggroRange && lineOfSight(this.eng.zone!.grid, this.x, this.z, p.x, p.z)) this.alert();
    }
    // поводок
    if (this.aggro && !this.def.boss && Math.hypot(this.x - this.spawnX, this.z - this.spawnZ) > 32) {
      this.aggro = false;
      this.setState('return');
      this.hp = this.maxHp;
    }
    if (G().player.hp <= 0) this.aggro = false;

    let speed = 0;
    if (this.boss && this.aggro) {
      speed = this.boss.update(dt, dist);
    } else if (!this.aggro || pacified) {
      speed = this.updateIdle(dt);
    } else if (this.canAct()) {
      speed = this.updateCombat(dt, dist, dx, dz);
    }
    this.finishFrame(dt, speed);
  }

  private finishFrame(dt: number, speed: number): void {
    // отбрасывание
    if (Math.abs(this.knock.x) + Math.abs(this.knock.z) > 0.01) {
      const [nx, nz] = moveCircle(this.eng.zone!.grid, this.x, this.z, this.knock.x * dt, this.knock.z * dt, this.radius, this.eng.now, this.flying);
      this.x = nx; this.z = nz;
      this.knock.x *= Math.max(0, 1 - dt * 6);
      this.knock.z *= Math.max(0, 1 - dt * 6);
    }
    this.moving += ((speed > 0.1 ? 1 : 0) - this.moving) * Math.min(1, dt * 8);
    this.flash = Math.max(0, this.flash - dt);
    this.rig.flash(this.flash > 0);
    this.attackAnim = Math.max(0, this.attackAnim - dt * 2.5);
    const frozen = this.st.frozen > this.eng.now;
    if (!frozen) this.rig.animate(this.t, this.moving, this.state === 'windup' ? Math.min(1, this.stateT * 2) : this.attackAnim, dt);
    this.rig.root.position.set(this.x, 0, this.z);
    this.rig.root.rotation.y = this.facing;
  }

  moveToward(tx: number, tz: number, speed: number, dt: number): number {
    const sp = speed * this.speedMult();
    if (sp <= 0) return 0;
    const grid = this.eng.zone!.grid;
    let gx = tx, gz = tz;
    const direct = lineOfSight(grid, this.x, this.z, tx, tz);
    if (!direct && !this.flying) {
      this.pathT -= dt;
      if (this.pathT <= 0 || !this.path.length) {
        this.pathT = 0.6;
        this.path = findPath(grid, this.x, this.z, tx, tz, this.eng.now, 1200) ?? [];
      }
      if (this.path.length) {
        [gx, gz] = this.path[0];
        if (Math.hypot(gx - this.x, gz - this.z) < 0.4) this.path.shift();
      }
    } else this.path = [];
    const dx = gx - this.x, dz = gz - this.z;
    const l = Math.hypot(dx, dz);
    if (l < 0.05) return 0;
    const [nx, nz] = moveCircle(grid, this.x, this.z, (dx / l) * sp * dt, (dz / l) * sp * dt, this.radius, this.eng.now, this.flying);
    // не наезжаем друг на друга
    let ax = nx, az = nz;
    for (const o of this.eng.enemies) {
      if (o === this || o.dead) continue;
      const ox = ax - o.x, oz = az - o.z;
      const d = Math.hypot(ox, oz), min = this.radius + o.radius;
      if (d < min && d > 1e-4) { ax += (ox / d) * (min - d) * 0.5; az += (oz / d) * (min - d) * 0.5; }
    }
    if (!blockedCell(grid, Math.floor(ax / TS), Math.floor(az / TS), this.eng.now, this.flying)) { this.x = ax; this.z = az; }
    else { this.x = nx; this.z = nz; }
    this.faceTo(gx, gz, dt * 10);
    return sp;
  }

  faceTo(tx: number, tz: number, k: number): void {
    const target = Math.atan2(tx - this.x, tz - this.z);
    let d = target - this.facing;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.facing += d * Math.min(1, k);
  }

  private updateDummy(dt: number): void {
    if (this.eng.now - this.lastHit > 3 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + dt * 20);
  }

  private updateIdle(dt: number): number {
    if (this.state === 'return') {
      const s = this.moveToward(this.spawnX, this.spawnZ, this.def.speed, dt);
      if (Math.hypot(this.x - this.spawnX, this.z - this.spawnZ) < 1) this.setState('idle');
      return s;
    }
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 3 + Math.random() * 4;
      const a = Math.random() * Math.PI * 2;
      this.path = [[this.spawnX + Math.cos(a) * 3, this.spawnZ + Math.sin(a) * 3]];
    }
    if (this.path.length && this.def.speed > 0) {
      const [tx, tz] = this.path[0];
      if (Math.hypot(tx - this.x, tz - this.z) < 0.5) { this.path = []; return 0; }
      return this.moveToward(tx, tz, this.def.speed * 0.4, dt);
    }
    return 0;
  }

  private updateCombat(dt: number, dist: number, dx: number, dz: number): number {
    const d = this.def;
    const now = this.eng.now;
    const p = this.eng.player;
    this.stateT += dt;
    const combat = this.eng.combat;
    const dmg = d.damage * this.damageMult;
    switch (this.state) {
      case 'windup': {
        this.faceTo(p.x, p.z, dt * (d.ai === 'charger' ? 2 : 6));
        const wind = d.ai === 'slam' ? 1.0 : d.ai === 'charger' ? 0.7 : d.ai === 'caster' ? 0.6 : 0.5;
        if (this.stateT >= wind) {
          this.attackAnim = 1;
          if (d.ai === 'melee') {
            const fx = this.x + Math.sin(this.facing) * 1.2, fz = this.z + Math.cos(this.facing) * 1.2;
            if (Math.hypot(p.x - fx, p.z - fz) < 1.5) combat.damagePlayer(dmg, d.element ?? 'shadow', this.x, this.z, this);
            bus.emit('sfx', { id: 'enemy_attack', x: this.x, z: this.z });
            this.setState('recover');
          } else if (d.ai === 'slam') {
            combat.slam(this.x + Math.sin(this.facing) * 1.3, this.z + Math.cos(this.facing) * 1.3, 3.0, dmg, 'physical');
            this.setState('recover');
          } else if (d.ai === 'charger') {
            this.dashDir = { x: Math.sin(this.facing), z: Math.cos(this.facing) };
            this.dashHit = false;
            this.setState('dash');
          } else {
            const tip = { x: this.x + Math.sin(this.facing) * 0.6, z: this.z + Math.cos(this.facing) * 0.6 };
            const dir = { x: Math.sin(this.facing), z: Math.cos(this.facing) };
            const kind = d.model === 'spider' ? 'web' : d.element === 'frost' ? 'ice' : d.element === 'fire' ? 'fire' : 'dark';
            combat.enemyBolt(tip.x, 1.2, tip.z, dir.x, dir.z, { speed: d.ai === 'wisp' ? 11 : 13, damage: dmg, element: d.element ?? (kind === 'web' ? 'nature' : 'arcane'), kind, color: d.ai === 'wisp' ? d.color : undefined });
            if (d.ai === 'caster' && Math.random() < 0.4) {
              for (const off of [-0.25, 0.25]) {
                const a = this.facing + off;
                combat.enemyBolt(tip.x, 1.2, tip.z, Math.sin(a), Math.cos(a), { speed: 12, damage: dmg * 0.7, element: d.element ?? 'fire', kind });
              }
            }
            bus.emit('sfx', { id: 'enemy_cast', x: this.x, z: this.z });
            this.setState('recover');
          }
          this.attackReady = now + d.attackCooldown * (0.8 + Math.random() * 0.4);
        }
        return 0;
      }
      case 'dash': {
        const sp = 14 * this.speedMult();
        const [nx, nz] = moveCircle(this.eng.zone!.grid, this.x, this.z, this.dashDir.x * sp * dt, this.dashDir.z * sp * dt, this.radius, now);
        const blocked = Math.hypot(nx - this.x, nz - this.z) < sp * dt * 0.3;
        this.x = nx; this.z = nz;
        if (!this.dashHit && Math.hypot(p.x - this.x, p.z - this.z) < this.radius + 0.8) {
          this.dashHit = true;
          combat.damagePlayer(dmg * 1.2, 'shadow', this.x, this.z, this);
        }
        if (this.stateT > 0.55 || blocked) this.setState('recover');
        if (Math.random() < 0.5) this.eng.smoke.emit({ x: this.x, y: 0.3, z: this.z, count: 1, speed: 0.5, life: 0.5, color: 0x2a2030, size: 0.8, alpha: 0.5 });
        return sp;
      }
      case 'recover': {
        if (this.stateT > (d.ai === 'slam' ? 1.1 : d.ai === 'charger' ? 0.9 : 0.5)) this.setState('chase');
        return 0;
      }
      case 'flee': {
        const s = this.moveToward(this.x - dx * 2, this.z - dz * 2, d.speed * 1.1, dt);
        if (this.stateT > 1.2 || dist > 7) this.setState('chase');
        return s;
      }
      default: {
        if (this.state !== 'chase') this.setState('chase');
        const los = lineOfSight(this.eng.zone!.grid, this.x, this.z, p.x, p.z);
        const ready = now >= this.attackReady && this.st.blinded <= now;
        if (d.ai === 'melee') {
          if (dist <= d.attackRange + 0.3 && ready) { this.startWindup(); return 0; }
          return dist > d.attackRange * 0.8 ? this.moveToward(p.x, p.z, d.speed, dt) : 0;
        }
        if (d.ai === 'charger') {
          if (ready && los && dist > 2.5 && dist < 9) { this.startWindup(); return 0; }
          if (dist <= 1.8 && ready) { this.attackReady = now + 1; combat.damagePlayer(dmg * 0.7, 'shadow', this.x, this.z, this); this.attackAnim = 1; return 0; }
          return this.moveToward(p.x, p.z, d.speed, dt);
        }
        if (d.ai === 'slam') {
          if (dist <= d.attackRange + 0.4 && ready) { this.startWindup(); return 0; }
          return this.moveToward(p.x, p.z, d.speed, dt);
        }
        if (d.ai === 'ranged' || d.ai === 'caster' || d.ai === 'wisp') {
          const want = d.ai === 'caster' ? 8 : d.ai === 'wisp' ? 6 : 6.5;
          if (d.ai === 'caster' && dist < 3 && now > (this.stateT2 ?? 0)) { this.stateT2 = now + 6; combat.enemyBlink(this); return 0; }
          if (ready && los && dist < d.attackRange) { this.startWindup(); return 0; }
          if (d.ai === 'wisp') {
            const a = this.t * 0.8 + this.uid.length;
            return this.moveToward(p.x + Math.cos(a) * want, p.z + Math.sin(a) * want, d.speed, dt);
          }
          if (dist < want - 2) { this.setState('flee'); return 0; }
          if (dist > want + 1 || !los) return this.moveToward(p.x, p.z, d.speed, dt);
          this.faceTo(p.x, p.z, dt * 6);
          // стрейф
          const side = Math.sin(this.t * 0.7) > 0 ? 1 : -1;
          return this.moveToward(this.x + (-dz / dist) * side * 2, this.z + (dx / dist) * side * 2, d.speed * 0.5, dt);
        }
        return 0;
      }
    }
  }

  stateT2?: number;

  startWindup(): void {
    const d = this.def;
    this.setState('windup');
    const combat = this.eng.combat;
    const p = this.eng.player;
    this.faceTo(p.x, p.z, 1);
    if (d.ai === 'slam') this.telegraph = combat.telegraphCircle(this.x + Math.sin(this.facing) * 1.3, this.z + Math.cos(this.facing) * 1.3, 3.0, 1.0, 0xff4020);
    else if (d.ai === 'charger') this.telegraph = combat.telegraphLine(this.x, this.z, Math.sin(this.facing), Math.cos(this.facing), 8, 1.4, 0.7);
    else if (d.ai === 'melee') this.telegraph = combat.telegraphCircle(this.x + Math.sin(this.facing) * 1.2, this.z + Math.cos(this.facing) * 1.2, 1.4, 0.5, 0xff5030);
    else if (d.ai === 'caster') this.eng.particles.emit({ x: this.x, y: 1.6, z: this.z, count: 12, spread: 0.3, speed: 1, life: 0.6, color: 0xff7030, size: 0.4 });
    else this.eng.particles.emit({ x: this.x, y: 1.3, z: this.z, count: 6, spread: 0.2, speed: 0.6, life: 0.4, color: d.color, size: 0.3 });
  }

  dispose(): void {
    if (this.telegraph) this.telegraph.dispose();
    this.boss?.dispose();
    this.rig.root.removeFromParent();
    this.rig.root.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material && !Array.isArray(m.material) && (m.material as THREE.Material & { __own?: boolean })) {
        // материалы существ уникальны — освобождаем
        (m.material as THREE.Material).dispose();
      }
    });
  }
}

import type * as THREE from 'three';
