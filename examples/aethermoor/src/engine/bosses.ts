// Сценарии боссов: фазы, особые атаки, призыв помощников.
import type { Engine } from './Engine';
import type { EnemyEntity } from './enemy';
import { setUI } from '@/state/store';
import { bus } from '@/core/bus';
import { blockedCell } from './physics';
import { TS } from './world';

export interface BossBrain {
  phase: number;
  update(dt: number, dist: number): number;
  dispose(): void;
}

type Attack = { name: string; cd: number; ready: number; run: () => void; when?: () => boolean };

export function createBossBrain(eng: Engine, e: EnemyEntity): BossBrain {
  const c = eng.combat;
  const p = () => eng.player;
  const dmg = () => e.def.damage * e.damageMult;
  let phase = 1;
  let busy = 0;
  let summoned50 = false;
  let summoned25 = false;
  const ring = (n: number, speed: number, kind: 'dark' | 'ice' | 'fire', offset = 0) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + offset;
      c.enemyBolt(e.x, 1.3, e.z, Math.sin(a), Math.cos(a), { speed, damage: dmg() * 0.6, element: kind === 'ice' ? 'frost' : kind === 'fire' ? 'fire' : 'shadow', kind });
    }
    bus.emit('sfx', { id: 'enemy_cast', x: e.x, z: e.z, volume: 1.2 });
  };
  const fan = (n: number, spread: number, speed: number, kind: 'dark' | 'ice' | 'fire' | 'rock') => {
    const base = Math.atan2(p().x - e.x, p().z - e.z);
    for (let i = 0; i < n; i++) {
      const a = base + (n === 1 ? 0 : (i / (n - 1) - 0.5) * spread);
      c.enemyBolt(e.x + Math.sin(a) * 0.8, 1.4, e.z + Math.cos(a) * 0.8, Math.sin(a), Math.cos(a), { speed, damage: dmg() * (kind === 'rock' ? 1.2 : 0.7), element: kind === 'ice' ? 'frost' : kind === 'fire' ? 'fire' : kind === 'rock' ? 'physical' : 'shadow', kind: kind === 'rock' ? 'rock' : kind });
    }
    bus.emit('sfx', { id: 'enemy_cast', x: e.x, z: e.z, volume: 1.2 });
  };
  const summon = (type: string, n: number) => {
    for (let i = 0; i < n; i++) {
      for (let tries = 0; tries < 12; tries++) {
        const a = Math.random() * Math.PI * 2;
        const x = e.x + Math.cos(a) * (3 + Math.random() * 3), z = e.z + Math.sin(a) * (3 + Math.random() * 3);
        if (!blockedCell(eng.zone!.grid, Math.floor(x / TS), Math.floor(z / TS), eng.now)) {
          const s = eng.spawnEnemy(type, x, z, { aggro: true });
          if (s) eng.particles.emit({ x, y: 1, z, count: 30, speed: 3, life: 0.8, color: 0x9a6aff, size: 0.6 });
          break;
        }
      }
    }
  };
  const aoeOnPlayer = (r: number, delay: number, color: number, element: 'fire' | 'shadow' | 'frost' | 'physical' = 'shadow', count = 1) => {
    for (let i = 0; i < count; i++) {
      const ox = count > 1 ? (Math.random() - 0.5) * 6 : 0, oz = count > 1 ? (Math.random() - 0.5) * 6 : 0;
      c.delayedAoe(p().x + ox, p().z + oz, r, delay + i * 0.15, dmg(), element, color);
    }
  };
  const dash = () => {
    e.faceTo(p().x, p().z, 1);
    e.telegraph = c.telegraphLine(e.x, e.z, Math.sin(e.facing), Math.cos(e.facing), 10, 1.8, 0.6);
    e.setState('windup');
    e.stateT = 0;
  };

  let attacks: Attack[] = [];
  const id = e.def.id;
  const mk = (name: string, cd: number, run: () => void, when?: () => boolean): Attack => ({ name, cd, ready: eng.now + 1 + Math.random() * 2, run, when });

  switch (id) {
    case 'shade_blob':
      attacks = [
        mk('ring', 6, () => ring(10, 8, 'dark')),
        mk('grasp', 4.5, () => aoeOnPlayer(2.2, 1.1, 0x8a4aff)),
      ];
      break;
    case 'fangmaw':
      attacks = [
        mk('dash', 4.2, dash),
        mk('triple', 9, () => { dash(); setTimeout(() => { if (!e.dead) dash(); }, 1600); }, () => phase >= 2),
        mk('howl', 14, () => { bus.emit('sfx', { id: 'howl', x: e.x, z: e.z, volume: 1.5 }); summon('hound', 1); }, () => phase >= 2),
      ];
      break;
    case 'lake_queen':
      attacks = [
        mk('fan', 3.2, () => fan(phase >= 2 ? 7 : 5, 1.1, 12, 'ice')),
        mk('nova', 7, () => c.delayedAoe(e.x, e.z, 4.2, 1.2, dmg() * 1.2, 'frost', 0x7ad8ff)),
        mk('blink', 8, () => c.enemyBlink(e, 9)),
        mk('rain', 11, () => aoeOnPlayer(1.8, 1.2, 0x7ad8ff, 'frost', 4), () => phase >= 2),
      ];
      break;
    case 'ruin_golem':
      attacks = [
        mk('slam', 4, () => { e.telegraph = c.telegraphCircle(e.x, e.z, 4.5, 1.3, 0xff6020); setTimeout(() => { if (!e.dead) { c.slam(e.x, e.z, 4.5, dmg() * 1.3, 'physical'); } e.telegraph?.dispose(); e.telegraph = null; }, 1300); busy = 1.6; }),
        mk('rock', 3.4, () => fan(phase >= 2 ? 3 : 1, 0.5, 14, 'rock')),
        mk('quake', 10, () => aoeOnPlayer(2.4, 1.4, 0xd08a40, 'physical', 5), () => phase >= 2),
      ];
      break;
    case 'pellinor_boss':
      attacks = [
        mk('flask', 2.6, () => aoeOnPlayer(2.4, 1.0, 0x8aff6a, 'nature' as 'shadow')),
        mk('fire', 4, () => fan(3, 0.6, 13, 'fire')),
        mk('smoke', 10, () => { for (let i = 0; i < 4; i++) aoeOnPlayer(1.8, 0.9 + i * 0.3, 0x6a6a6a, 'shadow'); }, () => phase >= 2),
      ];
      break;
    case 'cassian_boss':
      attacks = [
        mk('volley', 2.2, () => fan(3, 0.45, 15, 'ice')),
        mk('blink', 5, () => c.enemyBlink(e, 7)),
        mk('nova', 8, () => c.delayedAoe(e.x, e.z, 3.5, 1.0, dmg(), 'frost', 0xc9d3dc)),
      ];
      break;
    case 'soren':
      attacks = [
        mk('fan', 2.6, () => fan(phase >= 2 ? 7 : 5, 1.0, 13, 'fire')),
        mk('meteor', 6, () => aoeOnPlayer(2.6, 1.3, 0xff5020, 'fire', phase >= 2 ? 4 : 2)),
        mk('ring', 9, () => ring(14, 9, 'fire', Math.random())),
        mk('blink', 7, () => c.enemyBlink(e, 10)),
      ];
      break;
    case 'hollow_king':
      attacks = [
        mk('grasp', 3, () => aoeOnPlayer(2.6, 1.2, 0x7a3aff, 'shadow', phase >= 2 ? 3 : 1)),
        mk('ring', 6, () => { ring(16, 7, 'dark'); setTimeout(() => { if (!e.dead) ring(16, 7, 'dark', 0.2); }, 700); }),
        mk('nova', 8, () => c.delayedAoe(e.x, e.z, 5.5, 1.4, dmg() * 1.4, 'shadow', 0x5a2a9a)),
        mk('shades', 16, () => summon('shade', 2)),
      ];
      break;
  }

  const brain: BossBrain = {
    get phase() { return phase; },
    update(dt, dist) {
      const now = eng.now;
      const frac = e.hp / e.maxHp;
      if (frac < 0.5 && phase === 1) {
        phase = 2;
        bus.emit('sfx', { id: 'boss_roar' });
        eng.addShake(0.6);
        eng.particles.emit({ x: e.x, y: 1.5, z: e.z, count: 60, speed: 6, life: 1, color: e.def.color2 ?? 0xff6a3a, size: 0.8 });
      }
      if (!summoned50 && frac < 0.55) {
        summoned50 = true;
        if (id === 'shade_blob') summon('shade', 2);
        if (id === 'lake_queen') summon('wraith', 2);
        if (id === 'ruin_golem') summon('sentinel', 1);
        if (id === 'soren') summon('cultist', 2);
        if (id === 'pellinor_boss') { e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.15); eng.floaters.text(e.x, 3, e.z, 'Глоток зелья!', 'heal'); }
      }
      if (!summoned25 && frac < 0.25) {
        summoned25 = true;
        if (id === 'shade_blob') summon('shade', 2);
        if (id === 'hollow_king') summon('shade', 3);
      }
      setUI({ boss: { name: e.def.name, hp: Math.max(0, e.hp), max: e.maxHp, phase: phase === 2 ? 'Ярость' : undefined } });

      if (!e.canAct()) return 0;
      // рывки (Клыкарь) обрабатываются общей логикой состояния
      if (e.state === 'windup') {
        e.stateT += dt;
        if (e.stateT > 0.6) {
          e.telegraph?.dispose(); e.telegraph = null;
          e.dashDir = { x: Math.sin(e.facing), z: Math.cos(e.facing) };
          e.dashHit = false;
          e.setState('dash');
        }
        return 0;
      }
      if (e.state === 'dash') {
        e.stateT += dt;
        const sp = 17;
        const before = { x: e.x, z: e.z };
        e.moveToward(e.x + e.dashDir.x * 3, e.z + e.dashDir.z * 3, sp, dt);
        if (!e.dashHit && Math.hypot(p().x - e.x, p().z - e.z) < e.radius + 1) { e.dashHit = true; c.damagePlayer(dmg() * 1.3, 'shadow', e.x, e.z, e); }
        if (e.stateT > 0.6 || Math.hypot(e.x - before.x, e.z - before.z) < 0.02) e.setState('chase');
        return sp;
      }
      busy -= dt;
      if (busy > 0) return 0;
      for (const a of attacks) {
        if (now < a.ready || (a.when && !a.when())) continue;
        a.ready = now + a.cd * (phase >= 2 ? 0.75 : 1) * (0.85 + Math.random() * 0.3);
        e.attackAnim = 1;
        a.run();
        busy = Math.max(busy, 0.7);
        return 0;
      }
      // сближение / дистанция
      const ranged = ['lake_queen', 'pellinor_boss', 'cassian_boss', 'soren'].includes(id);
      const want = ranged ? 7 : 1.8;
      if (dist > want) return e.moveToward(p().x, p().z, e.def.speed, dt);
      if (!ranged && dist < 2.4 && now > (e.stateT2 ?? 0)) {
        e.stateT2 = now + 1.6;
        e.attackAnim = 1;
        c.damagePlayer(dmg() * 0.8, e.def.element ?? 'physical', e.x, e.z, e);
      }
      e.faceTo(p().x, p().z, dt * 6);
      return 0;
    },
    dispose() { setUI({ boss: null }); },
  };
  return brain;
}
