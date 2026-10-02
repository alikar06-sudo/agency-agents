// Боевая система: заклинания, снаряды, урон, статусы, резонансы, щит, добыча, смерть героя.
import * as THREE from 'three';
import type { Engine } from './Engine';
import type { EnemyEntity } from './enemy';
import type { Element } from '@/data/types';
import { SPELLS, COMBOS } from '@/data/spells';
import { ITEMS } from '@/data/items';
import { RARITY } from '@/data/world';
import { G, mutate, setUI, toast, ui } from '@/state/store';
import { derived, gainXp } from '@/systems/player';
import { addItem } from '@/systems/inventory';
import { bus } from '@/core/bus';
import { input } from '@/core/input';
import { castRay, lineOfSight, shotBlocked, blockedCell } from './physics';
import { TS, cellCenter } from './world';
import { glowTexture, telegraphTexture } from './textures';
import { unlockAchievement } from '@/systems/achievements';
import { advanceTime } from '@/systems/time';
import { apply } from '@/systems/logic';

interface Projectile {
  owner: 'player' | 'enemy';
  x: number; y: number; z: number;
  vx: number; vz: number;
  radius: number;
  damage: number;
  element: Element;
  spell?: string;
  kind: string;
  life: number;
  color: number;
  mesh: THREE.Sprite;
  travelled: number;
  src?: EnemyEntity;
}

interface Timed { until: number; update?: (t: number) => void; done?: () => void; dispose?: () => void }

interface Pickup { kind: 'gold' | 'item'; amount: number; itemId?: string; dropUid?: string; x: number; z: number; mesh: THREE.Object3D; t: number; delay: number }

const spriteMats = new Map<number, THREE.SpriteMaterial>();
function spriteMat(color: number): THREE.SpriteMaterial {
  let m = spriteMats.get(color);
  if (!m) {
    m = new THREE.SpriteMaterial({ map: glowTexture(), color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
    spriteMats.set(color, m);
  }
  return m;
}

export class Combat {
  private cds = new Map<string, number>();
  projectiles: Projectile[] = [];
  private timed: Timed[] = [];
  pickups: Pickup[] = [];
  private shieldMesh: THREE.Mesh;
  private lightOrb: THREE.Sprite;
  private iceMesh: THREE.InstancedMesh;
  private iceT = 0;
  private pendHp = 0;
  private pendMana = 0;
  private flushT = 0;
  private inCombatT = 0;
  private aim = new THREE.Vector3();

  constructor(private eng: Engine) {
    this.shieldMesh = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x7fb8ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.shieldMesh.visible = false;
    eng.scene.add(this.shieldMesh);
    this.lightOrb = new THREE.Sprite(spriteMat(0xfff0b0));
    this.lightOrb.scale.setScalar(1.2);
    this.lightOrb.visible = false;
    eng.scene.add(this.lightOrb);
    this.iceMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(TS, TS).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xcfefff, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85, emissive: 0x2a5a7a }),
      400,
    );
    this.iceMesh.count = 0;
    this.iceMesh.receiveShadow = true;
    eng.scene.add(this.iceMesh);
  }

  cooldownLeft(id: string): number { return Math.max(0, (this.cds.get(id) ?? 0) - this.eng.now); }
  cooldownTotal(id: string): number { return (SPELLS[id]?.cooldown ?? 1) * derived().cdMult; }
  get inCombat(): boolean { return this.inCombatT > 0; }

  private aimPoint(): THREE.Vector3 {
    const p = this.eng.player;
    if (this.eng.mode !== 'iso') {
      // обзор от первого лица / из-за плеча: цель по центру экрана с мягким доведением
      const f = this.eng.forward();
      let best: EnemyEntity | null = null, bestScore = Math.cos(0.2);
      for (const e of this.eng.enemies) {
        if (e.dead || e.st.pacified > this.eng.now) continue;
        const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
        if (d > 22 || d < 0.3) continue;
        const cos = (dx * f.x + dz * f.z) / d;
        if (cos > bestScore && lineOfSight(this.eng.zone!.grid, p.x, p.z, e.x, e.z)) { bestScore = cos; best = e; }
      }
      if (best) return this.aim.set(best.x, 1, best.z);
      return this.aim.copy(this.eng.aim);
    }
    if (input.touch.active || !input.mouse.inside) {
      // автонаведение на ближайшего врага
      let best: EnemyEntity | null = null, bd = 14;
      for (const e of this.eng.enemies) {
        if (e.dead || e.st.pacified > this.eng.now) continue;
        const d = Math.hypot(e.x - p.x, e.z - p.z);
        if (d < bd && lineOfSight(this.eng.zone!.grid, p.x, p.z, e.x, e.z)) { bd = d; best = e; }
      }
      if (best) return this.aim.set(best.x, 1, best.z);
      return this.aim.set(p.x + Math.sin(p.facing) * 8, 1, p.z + Math.cos(p.facing) * 8);
    }
    return this.aim.copy(this.eng.aim);
  }

  // ---------------- Заклинания ----------------

  castSpell(id: string, auto = false): boolean {
    const g = G();
    const sp = SPELLS[id];
    const eng = this.eng;
    const p = eng.player;
    if (!sp) return false;
    if (!g.spells.known.includes(id)) {
      if (!auto) toast('warn', 'Заклинание не изучено');
      else if (id === 'spark' && !ui().dialogue && Math.random() < 0.02) toast('info', 'Вы ещё не знаете боевых заклинаний', 'Их преподают на уроках практической магии');
      return false;
    }
    if (p.dodgeT > 0 || g.player.hp <= 0) return false;
    if (g.player.level < sp.level) { if (!auto) toast('warn', `«${sp.name}» требует уровень ${sp.level}`); return false; }
    const ready = this.cds.get(id) ?? 0;
    if (eng.now < ready) { if (!auto) { toast('warn', `«${sp.name}» восстанавливается`); bus.emit('sfx', { id: 'ui_error' }); } return false; }
    const cost = sp.cost;
    if (g.player.mana + this.pendMana < cost) { if (!auto || Math.random() < 0.05) { toast('warn', 'Не хватает маны'); bus.emit('sfx', { id: 'ui_error' }); } return false; }
    if (sp.kind === 'shield') { this.burstShield(); }
    const aim = this.aimPoint();
    const tip = p.wandTipWorld();
    const ox = tip.x || p.x, oz = tip.z || p.z;
    let dx = aim.x - p.x, dz = aim.z - p.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl; dz /= dl;
    this.flush();
    mutate((s) => { s.player.mana = Math.max(0, s.player.mana - cost); s.counters.casts = (s.counters.casts ?? 0) + 1; s.counters[`cast_${id}`] = (s.counters[`cast_${id}`] ?? 0) + 1; });
    this.cds.set(id, eng.now + sp.cooldown * derived().cdMult);
    p.castAnim = 1;
    p.aimFaceUntil = eng.now + 0.7;
    p.facing = Math.atan2(dx, dz);
    bus.emit('sfx', { id: sp.sound, x: p.x, z: p.z });
    eng.particles.emit({ x: ox, y: 1.4, z: oz, count: 8, speed: 2, life: 0.35, color: sp.color, color2: sp.color2, size: 0.35 });
    const power = derived().spellPower;
    let target: string | undefined;

    switch (sp.kind) {
      case 'bolt': {
        this.playerBolt(id, ox, oz, dx, dz);
        break;
      }
      case 'cone': {
        this.gust(p.x, p.z, dx, dz, sp.range ?? 6, (sp.damage ?? 10));
        break;
      }
      case 'aura': {
        p.lightUntil = eng.now + (sp.duration ?? 90);
        eng.particles.emit({ x: p.x, y: 2.5, z: p.z, count: 40, speed: 3, life: 1, color: 0xfff0b0, size: 0.5 });
        break;
      }
      case 'self': {
        const heal = Math.round((sp.damage ?? 40) * (g.player.circle === 'root' ? 1.3 : 1) * (0.8 + power * 0.25));
        this.healPlayer(heal);
        p.hotUntil = eng.now + (sp.duration ?? 5);
        p.hotRate = 6 * (g.player.circle === 'root' ? 1.3 : 1);
        eng.particles.emit({ x: p.x, y: 1, z: p.z, count: 40, spread: 0.6, speed: 2, up: 2, life: 1, color: 0x8af0a0, color2: 0xe8ffd0, size: 0.5 });
        break;
      }
      case 'blink': {
        const range = sp.range ?? 7.5;
        const tx = p.x + dx * Math.min(range, dl), tz = p.z + dz * Math.min(range, dl);
        const [lx, lz] = castRay(eng.zone!.grid, p.x, p.z, tx, tz, eng.now);
        eng.particles.emit({ x: p.x, y: 1, z: p.z, count: 30, spread: 0.4, speed: 3, life: 0.6, color: 0xc8a0ff, size: 0.5 });
        p.x = lx; p.z = lz;
        p.iframesUntil = eng.now + 0.3;
        eng.particles.emit({ x: lx, y: 1, z: lz, count: 30, spread: 0.4, speed: 3, life: 0.6, color: 0xffffff, color2: 0xc8a0ff, size: 0.5 });
        break;
      }
      case 'pulse': {
        target = this.pulse(id, aim);
        break;
      }
      case 'chain': {
        this.chainLightning(aim, sp.damage ?? 30);
        break;
      }
      case 'nova': {
        this.nova(p.x, p.z, sp.radius ?? 6, sp.damage ?? 90, sp.element, sp.color);
        apply([{ corruption: 2 }]);
        break;
      }
      case 'zone': {
        this.starfall(aim.x, aim.z, sp.radius ?? 4, sp.damage ?? 34, sp.duration ?? 2.2);
        break;
      }
      case 'shield': break;
    }
    bus.emit('spellCast', { spell: id, target });
    if ((G().counters.casts ?? 0) <= 1) unlockAchievement('first_spell');
    return true;
  }

  private playerBolt(id: string, ox: number, oz: number, dx: number, dz: number): void {
    const sp = SPELLS[id];
    const size = id === 'spark' ? 0.7 : id === 'flame' ? 1.4 : 1.0;
    const mesh = new THREE.Sprite(spriteMat(sp.color));
    mesh.scale.setScalar(size);
    this.eng.scene.add(mesh);
    this.projectiles.push({
      owner: 'player', x: ox, y: 1.3, z: oz, vx: dx * (sp.speed ?? 20), vz: dz * (sp.speed ?? 20), radius: id === 'flame' ? 0.45 : 0.32,
      damage: sp.damage ?? 10, element: sp.element, spell: id, kind: id, life: (sp.range ?? 18) / (sp.speed ?? 20), color: sp.color, mesh, travelled: 0,
    });
  }

  enemyBolt(x: number, y: number, z: number, dx: number, dz: number, o: { speed: number; damage: number; element: Element; kind: string; color?: number }): void {
    const color = o.color ?? (o.kind === 'fire' ? 0xff6a2a : o.kind === 'ice' ? 0x8ad8ff : o.kind === 'web' ? 0xe8e8f0 : o.kind === 'rock' ? 0xc0905a : 0xb06aff);
    const mesh = new THREE.Sprite(spriteMat(color));
    mesh.scale.setScalar(o.kind === 'rock' ? 1.6 : 1.0);
    this.eng.scene.add(mesh);
    this.projectiles.push({ owner: 'enemy', x, y, z, vx: dx * o.speed, vz: dz * o.speed, radius: o.kind === 'rock' ? 0.6 : 0.35, damage: o.damage, element: o.element, kind: o.kind, life: 2.2, color, mesh, travelled: 0 });
  }

  // ---------------- Щит ----------------

  startShield(): boolean {
    const g = G();
    if (g.player.mana < 8) { toast('warn', 'Не хватает маны для щита'); return false; }
    this.flush();
    mutate((s) => { s.player.mana -= 8; });
    bus.emit('sfx', { id: 'ward' });
    bus.emit('spellCast', { spell: 'ward' });
    return true;
  }
  stopShield(): void { /* визуал гаснет в update */ }
  private burstShield(): void {
    const p = this.eng.player;
    p.shielding = true;
    p.shieldStart = this.eng.now;
    setTimeout(() => { if (!(input.mouse.right || input.isDown('shield'))) p.shielding = false; }, 1500);
  }

  // ---------------- Урон по врагам ----------------

  damageEnemy(e: EnemyEntity, base: number, element: Element, opts: { spell?: string; knock?: { x: number; z: number; force: number }; noCrit?: boolean; combo?: boolean } = {}): number {
    if (e.dead || e.invulnerable) return 0;
    const d = derived();
    const now = this.eng.now;
    let mult = d.spellPower;
    const sp = opts.spell ? SPELLS[opts.spell] : null;
    if (d.wandElement && d.wandElement === element) mult *= 1.25;
    if (sp?.school === 'attack' && G().player.circle === 'flame') mult *= 1.1;
    let tag = 'dmg';
    if (e.def.weak.includes(element)) { mult *= 1.5; tag = 'dmg weak'; }
    if (e.def.resist.includes(element)) { mult *= 0.5; tag = 'dmg resist'; }
    if (e.def.id === 'ruin_golem' && element === 'storm') mult *= 1.5;
    let crit = false;
    if (!opts.noCrit && Math.random() < d.crit) { mult *= 1.75; crit = true; tag = 'dmg crit'; }
    const amount = Math.max(1, Math.round(base * mult * (0.9 + Math.random() * 0.2)));
    e.hp -= amount;
    e.flash = 0.12;
    e.lastHit = now;
    if (e.st.pacified > now) e.st.pacified = 0;
    e.alert();
    if (opts.knock && !e.def.boss) { e.knock.x += opts.knock.x * opts.knock.force; e.knock.z += opts.knock.z * opts.knock.force; }
    this.eng.floaters.text(e.x, 2.2 * (e.def.scale ?? 1), e.z, String(amount) + (crit ? '!' : ''), opts.combo ? 'dmg combo' : tag);
    bus.emit('sfx', { id: crit ? 'hit_crit' : 'hit', x: e.x, z: e.z, pitch: 0.9 + Math.random() * 0.2 });
    this.inCombatT = 5;
    if (e.hp <= 0) this.killEnemy(e);
    return amount;
  }

  dot(e: EnemyEntity, amount: number, element: Element): void {
    if (e.dead) return;
    let mult = 1;
    if (e.def.weak.includes(element)) mult = 1.5;
    if (e.def.resist.includes(element)) mult = 0.5;
    e.hp -= amount * mult;
    e.lastHit = this.eng.now;
    if (e.hp <= 0) this.killEnemy(e);
  }

  private applySpellEffects(e: EnemyEntity, spell: string, dirX: number, dirZ: number): void {
    const now = this.eng.now;
    const sp = SPELLS[spell];
    const power = derived().spellPower;
    const boss = !!e.def.boss;
    // резонансы проверяются ДО наложения нового статуса
    if (spell === 'flame' && (e.st.chilled > now || e.st.frozen > now)) {
      this.combo('steam', e);
      e.st.chilled = 0; e.st.frozen = 0; e.st.chillStacks = 0;
      for (const o of this.eng.enemies) if (!o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 3.5) { this.damageEnemy(o, 40, 'fire', { combo: true, noCrit: true }); o.st.blinded = now + 3; }
      return;
    }
    if (spell === 'flame' && e.st.rooted > now) {
      this.combo('pyre', e);
      e.st.burning = now + 5; e.st.burnDps = 18 * power;
      return;
    }
    if (spell === 'storm' && e.st.rooted > now) {
      this.combo('thunder', e);
      this.damageEnemy(e, 30, 'storm', { combo: true });
      e.st.stunned = now + (boss ? 1 : 2.5);
      return;
    }
    if (spell === 'spark' && e.st.frozen > now) {
      this.combo('shatter', e);
      e.st.frozen = 0; e.st.chillStacks = 0;
      this.damageEnemy(e, 55, 'frost', { combo: true });
      for (const o of this.eng.enemies) if (o !== e && !o.dead && Math.hypot(o.x - e.x, o.z - e.z) < 3) this.damageEnemy(o, 22, 'frost', { combo: true, noCrit: true });
      return;
    }
    if (spell === 'gust' && e.st.burning > now) {
      this.combo('firestorm', e);
      for (const o of this.eng.enemies) {
        if (o.dead) continue;
        const ox = o.x - this.eng.player.x, oz = o.z - this.eng.player.z;
        const d = Math.hypot(ox, oz);
        if (d < 8 && (ox * dirX + oz * dirZ) / (d || 1) > 0.3) { this.damageEnemy(o, 30, 'fire', { combo: true, noCrit: true }); o.st.burning = now + 4; o.st.burnDps = Math.max(o.st.burnDps, 7 * power); }
      }
      return;
    }
    switch (spell) {
      case 'flame': e.st.burning = now + 4; e.st.burnDps = 6 * power; break;
      case 'frost':
        if (e.st.chilled > now) {
          e.st.chillStacks++;
          if (e.st.chillStacks >= 2) { e.st.frozen = now + (boss ? 0.8 : 2.6); e.st.chillStacks = 0; bus.emit('sfx', { id: 'freeze', x: e.x, z: e.z }); }
        } else { e.st.chillStacks = 1; }
        e.st.chilled = now + 3.5;
        break;
      case 'bind': e.st.rooted = now + (boss ? 1 : (sp.duration ?? 3)); break;
      case 'gust':
        if (e.state === 'windup' && !boss) e.setState('recover');
        break;
    }
  }

  private combo(id: string, e: EnemyEntity): void {
    const def = COMBOS.find((c) => c.id === id)!;
    bus.emit('sfx', { id: 'combo', x: e.x, z: e.z });
    this.eng.particles.emit({ x: e.x, y: 1.2, z: e.z, count: 70, spread: 0.5, speed: 7, life: 0.9, color: def.color, color2: 0xffffff, size: 0.8 });
    this.eng.addShake(0.35);
    this.eng.floaters.text(e.x, 3.2, e.z, def.name, 'combo-name', 1.6);
    this.eng.addDynLight(e.x, 2, e.z, def.color, 3, 12, 0.5);
    mutate((g) => { g.counters.combos = (g.counters.combos ?? 0) + 1; });
    if (!G().spells.combos.includes(id)) {
      mutate((g) => { g.spells.combos.push(id); });
      toast('combo', `Резонанс открыт: ${def.name}`, def.desc);
      gainXp(60);
    }
    bus.emit('combo', { id });
  }

  private killEnemy(e: EnemyEntity): void {
    if (e.dead) return;
    e.dead = true;
    e.hp = 0;
    if (e.telegraph) { e.telegraph.dispose(); e.telegraph = null; }
    const eng = this.eng;
    const def = e.def;
    if (def.ai === 'dummy') {
      // манекен падает и встаёт через пару секунд
      bus.emit('sfx', { id: 'hit_crit', x: e.x, z: e.z });
      eng.particles.emit({ x: e.x, y: 1.2, z: e.z, count: 20, speed: 3, life: 0.6, color: 0xd8c080, size: 0.4 });
      const { x, z } = e;
      const key = e.markerKey;
      setTimeout(() => { if (eng.zone) eng.spawnEnemy('dummy', x, z, { markerKey: key }); }, 2500);
    } else {
      bus.emit('sfx', { id: def.tags?.includes('shade') ? 'shade_die' : 'enemy_die', x: e.x, z: e.z });
      eng.particles.emit({ x: e.x, y: 1, z: e.z, count: def.boss ? 120 : 30, spread: 0.6, speed: def.boss ? 7 : 3, life: def.boss ? 1.6 : 0.9, color: def.color === 0x1a1028 ? 0x8a6aff : def.color, color2: 0x000000, size: 0.6 });
      const [g0, g1] = def.gold;
      const gold = Math.round(g0 + Math.random() * (g1 - g0));
      if (gold > 0) {
        const n = Math.min(4, Math.max(1, Math.round(gold / 8)));
        for (let i = 0; i < n; i++) this.spawnGold(Math.ceil(gold / n), e.x, e.z);
      }
      for (const l of def.loot) {
        if (Math.random() < l.chance) {
          const [c0, c1] = l.count ?? [1, 1];
          this.spawnItemPickup(l.item, Math.round(c0 + Math.random() * (c1 - c0)), e.x + (Math.random() - 0.5), e.z + (Math.random() - 0.5));
        }
      }
      gainXp(def.xp);
    }
    const zone = eng.zone!.def.id;
    mutate((g) => {
      g.counters.kills = (g.counters.kills ?? 0) + (def.ai === 'dummy' ? 0 : 1);
      g.counters[`kill_${def.id}`] = (g.counters[`kill_${def.id}`] ?? 0) + 1;
      if (e.markerKey) {
        const key = `killed_${zone}_${e.markerKey.split('#')[0]}`;
        if (e.respawn === 'never' && !g.defeated.includes(key)) {
          // группа считается побеждённой, когда пали все
          const rest = eng.enemies.filter((o) => o !== e && !o.dead && o.markerKey?.split('#')[0] === e.markerKey!.split('#')[0]);
          if (!rest.length) g.defeated.push(key);
        }
        if (e.respawn === 'day') g.flags[key] = g.time.day;
      }
      if (def.boss && !g.defeated.includes('boss_' + def.id)) g.defeated.push('boss_' + def.id);
    });
    if (def.boss) {
      setUI({ boss: null });
      eng.addShake(0.8);
      const ach: Record<string, string> = { fangmaw: 'boss_hound', lake_queen: 'boss_lake', ruin_golem: 'boss_golem' };
      if (ach[def.id]) unlockAchievement(ach[def.id]);
    }
    bus.emit('enemyKilled', { type: def.id, zone, boss: def.boss, tags: def.tags, uniqueId: e.uniqueId });
  }

  // ---------------- Урон по герою ----------------

  damagePlayer(amount: number, element: Element, sx: number, sz: number, src?: EnemyEntity): void {
    const eng = this.eng;
    const p = eng.player;
    const g = G();
    if (g.player.hp <= 0) return;
    if (eng.now < p.iframesUntil) { eng.floaters.text(p.x, 2.4, p.z, 'Уклонение', 'miss'); return; }
    this.inCombatT = 5;
    const d = derived();
    let amt = amount * d.dmgTaken;
    if (p.shielding) {
      const parry = eng.now - p.shieldStart < 0.3;
      if (parry && src && !src.def.boss) {
        src.st.stunned = eng.now + 1.2;
        eng.floaters.text(p.x, 2.4, p.z, 'Парирование!', 'parry');
        bus.emit('sfx', { id: 'parry' });
        mutate((s) => { s.counters.parries = (s.counters.parries ?? 0) + 1; });
        return;
      }
      const absorb = G().player.circle === 'bastion' ? 0.85 : 0.75;
      amt *= 1 - absorb;
      this.pendMana -= amount * 0.25;
      bus.emit('sfx', { id: 'shield_block' });
      eng.particles.emit({ x: p.x + (sx - p.x) * 0.2, y: 1.3, z: p.z + (sz - p.z) * 0.2, count: 12, speed: 3, life: 0.4, color: 0x9ad0ff, size: 0.4 });
    }
    const final = Math.max(1, Math.round(amt));
    this.flush();
    mutate((s) => { s.player.hp = Math.max(0, s.player.hp - final); });
    eng.floaters.text(p.x, 2.4, p.z, '-' + final, 'dmg-player');
    eng.addShake(Math.min(0.5, final / 40));
    bus.emit('sfx', { id: 'player_hurt' });
    bus.emit('playerDamaged', { amount: final, element });
    if (G().player.hp <= 0) this.playerDied();
  }

  healPlayer(n: number): void {
    const d = derived();
    this.flush();
    mutate((s) => { s.player.hp = Math.min(d.maxHp, s.player.hp + n); });
    this.eng.floaters.text(this.eng.player.x, 2.4, this.eng.player.z, '+' + Math.round(n), 'heal');
  }

  private playerDied(): void {
    bus.emit('sfx', { id: 'death' });
    bus.emit('playerDied', {});
    for (const e of this.eng.enemies) e.aggro = false;
    setTimeout(() => setUI({ dead: true }), 900);
  }

  revive(): void {
    const d = derived();
    const lost = Math.floor(G().player.gold * 0.1);
    mutate((s) => {
      s.player.hp = Math.round(d.maxHp * 0.6);
      s.player.mana = Math.round(d.maxMana * 0.6);
      s.player.gold -= lost;
      s.counters.deaths = (s.counters.deaths ?? 0) + 1;
    });
    advanceTime(120);
    setUI({ dead: false, boss: null });
    if (lost > 0) toast('warn', `Сестра Мэйбел взяла ${lost} крон за лечение`);
    void this.eng.enterZone('hall', 'infirmary');
  }

  // ---------------- Особые атаки и телеграфы ----------------

  telegraphCircle(x: number, z: number, r: number, dur: number, color = 0xff4020): { dispose(): void } {
    const mat = new THREE.MeshBasicMaterial({ map: telegraphTexture(), color, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(r * 2, r * 2).rotateX(-Math.PI / 2), mat);
    m.position.set(x, 0.06, z);
    const fill = new THREE.Mesh(new THREE.CircleGeometry(r, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
    fill.position.set(x, 0.07, z);
    fill.scale.setScalar(0.01);
    this.eng.scene.add(m, fill);
    const start = this.eng.now;
    let disposed = false;
    const t: Timed = {
      until: start + dur + 0.05,
      update: (now) => { const k = Math.min(1, (now - start) / dur); fill.scale.setScalar(Math.max(0.01, k)); mat.opacity = 0.5 + Math.sin(now * 20) * 0.2; },
      dispose: () => { if (!disposed) { disposed = true; m.removeFromParent(); fill.removeFromParent(); m.geometry.dispose(); fill.geometry.dispose(); mat.dispose(); (fill.material as THREE.Material).dispose(); } },
    };
    this.timed.push(t);
    return { dispose: () => { t.until = 0; } };
  }

  telegraphLine(x: number, z: number, dx: number, dz: number, len: number, w: number, dur: number): { dispose(): void } {
    const mat = new THREE.MeshBasicMaterial({ color: 0xff4020, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len).rotateX(-Math.PI / 2).translate(0, 0, len / 2), mat);
    m.position.set(x, 0.07, z);
    m.rotation.y = Math.atan2(dx, dz);
    this.eng.scene.add(m);
    const start = this.eng.now;
    let disposed = false;
    const t: Timed = {
      until: start + dur + 0.05,
      update: (now) => { mat.opacity = 0.25 + Math.min(1, (now - start) / dur) * 0.35; },
      dispose: () => { if (!disposed) { disposed = true; m.removeFromParent(); m.geometry.dispose(); mat.dispose(); } },
    };
    this.timed.push(t);
    return { dispose: () => { t.until = 0; } };
  }

  delayedAoe(x: number, z: number, r: number, delay: number, damage: number, element: Element, color: number): void {
    this.telegraphCircle(x, z, r, delay, color);
    this.timed.push({
      until: this.eng.now + delay,
      done: () => {
        if (!this.eng.zone) return;
        const p = this.eng.player;
        this.eng.particles.emit({ x, y: 0.5, z, count: 40, spread: r * 0.5, speed: 4, up: 3, life: 0.8, color, size: 0.7 });
        this.eng.addDynLight(x, 1.5, z, color, 2.5, r * 4, 0.4);
        bus.emit('sfx', { id: element === 'fire' ? 'explosion' : 'slam', x, z });
        if (Math.hypot(p.x - x, p.z - z) < r + 0.3) this.damagePlayer(damage, element, x, z);
      },
    });
  }

  slam(x: number, z: number, r: number, damage: number, element: Element): void {
    const p = this.eng.player;
    this.eng.particles.emit({ x, y: 0.3, z, count: 50, spread: r * 0.4, speed: 5, up: 2, gravity: 6, life: 0.8, color: 0xb0a080, size: 0.6 });
    this.eng.smoke.emit({ x, y: 0.4, z, count: 20, spread: r * 0.5, speed: 2, life: 1.2, color: 0x6a5a4a, size: 1.6, size2: 2.4, alpha: 0.5 });
    this.eng.addShake(0.5);
    bus.emit('sfx', { id: 'slam', x, z });
    if (Math.hypot(p.x - x, p.z - z) < r + 0.3) this.damagePlayer(damage, element, x, z);
  }

  enemyBlink(e: EnemyEntity, maxD = 6): void {
    const p = this.eng.player;
    for (let tries = 0; tries < 20; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = 5 + Math.random() * maxD;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (blockedCell(this.eng.zone!.grid, Math.floor(x / TS), Math.floor(z / TS), this.eng.now, e.flying)) continue;
      if (!lineOfSight(this.eng.zone!.grid, x, z, p.x, p.z)) continue;
      this.eng.particles.emit({ x: e.x, y: 1, z: e.z, count: 25, speed: 3, life: 0.6, color: e.def.color2 ?? 0xa06aff, size: 0.5 });
      e.x = x; e.z = z;
      this.eng.particles.emit({ x, y: 1, z, count: 25, speed: 3, life: 0.6, color: e.def.color2 ?? 0xa06aff, size: 0.5 });
      bus.emit('sfx', { id: 'teleport', x, z });
      return;
    }
  }

  private gust(px: number, pz: number, dx: number, dz: number, range: number, damage: number): void {
    const eng = this.eng;
    for (let i = 0; i < 40; i++) {
      const a = Math.atan2(dx, dz) + (Math.random() - 0.5) * 1.1;
      eng.particles.emit({ x: px + dx * 0.8, y: 1, z: pz + dz * 0.8, count: 1, speed: 10, dir: [Math.sin(a), 0.05, Math.cos(a)], cone: 0.95, life: 0.5, color: 0xd8fff0, size: 0.5, drag: 2 });
    }
    for (const e of eng.enemies) {
      if (e.dead) continue;
      const ex = e.x - px, ez = e.z - pz;
      const d = Math.hypot(ex, ez);
      if (d > range || d < 0.01) continue;
      if ((ex * dx + ez * dz) / d < 0.45) continue;
      this.applySpellEffects(e, 'gust', dx, dz);
      if (!e.dead) this.damageEnemy(e, damage, 'nature', { spell: 'gust', knock: { x: ex / d, z: ez / d, force: 9 } });
    }
    eng.interact.gust(px, pz, dx, dz, range);
    // отражаем вражеские снаряды
    for (const pr of this.projectiles) {
      if (pr.owner !== 'enemy') continue;
      const ex = pr.x - px, ez = pr.z - pz;
      const d = Math.hypot(ex, ez);
      if (d < range && (ex * dx + ez * dz) / (d || 1) > 0.4) { pr.vx = dx * 14; pr.vz = dz * 14; pr.owner = 'player'; pr.spell = undefined; pr.life = 1; }
    }
  }

  private pulse(id: string, aim: THREE.Vector3): string | undefined {
    const eng = this.eng;
    const p = eng.player;
    const sp = SPELLS[id];
    const ring = (color: number, r: number) => {
      for (let i = 0; i < 48; i++) {
        const a = (i / 48) * Math.PI * 2;
        eng.particles.emit({ x: p.x, y: 0.6, z: p.z, count: 1, speed: r * 2.2, dir: [Math.cos(a), 0, Math.sin(a)], cone: 1, life: 0.5, color, size: 0.5, drag: 1 });
      }
    };
    if (id === 'unlock') {
      ring(sp.color, 3);
      const near = Math.hypot(aim.x - p.x, aim.z - p.z) < 5 ? aim : new THREE.Vector3(p.x, 0, p.z);
      return eng.interact.unlockNear(near.x, near.z, sp.radius ?? 3.2) ?? eng.interact.unlockNear(p.x, p.z, sp.radius ?? 3.2);
    }
    if (id === 'reveal') {
      ring(sp.color, sp.radius ?? 9);
      eng.addDynLight(p.x, 2, p.z, 0xffe9a0, 3, 18, 0.8);
      for (const e of eng.enemies) if (Math.hypot(e.x - p.x, e.z - p.z) < (sp.radius ?? 9)) e.revealed = true;
      return eng.interact.revealNear(p.x, p.z, sp.radius ?? 9);
    }
    if (id === 'whisper') {
      ring(sp.color, sp.radius ?? 6);
      let calmed = 0;
      for (const e of eng.enemies) {
        if (e.dead || e.def.boss) continue;
        if (Math.hypot(e.x - p.x, e.z - p.z) > (sp.radius ?? 6)) continue;
        if (e.def.tags?.includes('calm') || e.def.tags?.includes('beast')) {
          e.st.pacified = eng.now + (e.def.tags?.includes('calm') ? 120 : 20);
          e.aggro = false;
          e.setState('idle');
          calmed++;
          eng.floaters.text(e.x, 2.4, e.z, '♪', 'calm');
        }
      }
      if (calmed) {
        mutate((g) => { g.counters.calmed = (g.counters.calmed ?? 0) + calmed; });
        if (eng.zone?.def.id === 'lake' && eng.enemies.filter((e) => e.def.id === 'wraith' && e.st.pacified > eng.now).length >= 3) apply([{ setFlag: 'lake_spirits_calmed' }, { achievement: 'pacifist_lake' }]);
      }
      const npc = eng.npcs.nearest(p.x, p.z, 5);
      if (npc) {
        apply([{ setFlag: `whisper_${npc.def.id}`, value: G().time.day * 1440 + G().time.min }]);
        toast('spell', `${npc.def.name.split(' ')[0]} прислушивается к вам`, 'В разговоре откроются особые варианты');
        return npc.def.id;
      }
      return calmed ? 'creature' : undefined;
    }
    return undefined;
  }

  private chainLightning(aim: THREE.Vector3, damage: number): void {
    const eng = this.eng;
    const p = eng.player;
    const hit = new Set<EnemyEntity>();
    let from = { x: p.x, z: p.z };
    let first: EnemyEntity | null = null;
    let bd = 1e9;
    for (const e of eng.enemies) {
      if (e.dead) continue;
      const dp = Math.hypot(e.x - p.x, e.z - p.z);
      if (dp > (SPELLS.storm.range ?? 12)) continue;
      const da = Math.hypot(e.x - aim.x, e.z - aim.z);
      if (da < bd && lineOfSight(eng.zone!.grid, p.x, p.z, e.x, e.z)) { bd = da; first = e; }
    }
    // кристаллы-механизмы рядом с прицелом
    const crystal = eng.interact.spellAt('storm', aim.x, aim.z, 2.5);
    if (crystal) { this.bolt(p.x, p.z, crystal.x, crystal.z); }
    if (!first) {
      if (!crystal) {
        const tx = p.x + (aim.x - p.x), tz = p.z + (aim.z - p.z);
        this.bolt(p.x, p.z, tx, tz);
      }
      return;
    }
    let cur: EnemyEntity | null = first;
    let dmg = damage;
    for (let k = 0; k < 3 && cur; k++) {
      this.bolt(from.x, from.z, cur.x, cur.z);
      hit.add(cur);
      this.applySpellEffects(cur, 'storm', 0, 0);
      if (!cur.dead) this.damageEnemy(cur, dmg, 'storm', { spell: 'storm' });
      from = { x: cur.x, z: cur.z };
      dmg *= 0.7;
      let next: EnemyEntity | null = null, nd = 5.5;
      for (const e of eng.enemies) {
        if (e.dead || hit.has(e)) continue;
        const d = Math.hypot(e.x - from.x, e.z - from.z);
        if (d < nd) { nd = d; next = e; }
      }
      cur = next;
    }
  }

  private bolt(x0: number, z0: number, x1: number, z1: number): void {
    const pts: THREE.Vector3[] = [];
    const n = 10;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const j = i === 0 || i === n ? 0 : 0.5;
      pts.push(new THREE.Vector3(x0 + (x1 - x0) * t + (Math.random() - 0.5) * j, 1.3 + (Math.random() - 0.5) * j, z0 + (z1 - z0) * t + (Math.random() - 0.5) * j));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0xd0e0ff, transparent: true, opacity: 1, blending: THREE.AdditiveBlending });
    const line = new THREE.Line(geo, mat);
    this.eng.scene.add(line);
    this.eng.addDynLight(x1, 1.5, z1, 0xa8c0ff, 3, 12, 0.25);
    this.eng.particles.emit({ x: x1, y: 1.3, z: z1, count: 14, speed: 4, life: 0.35, color: 0xd0e0ff, size: 0.4 });
    const start = this.eng.now;
    this.timed.push({ until: start + 0.22, update: (now) => { mat.opacity = 1 - (now - start) / 0.22; }, dispose: () => { line.removeFromParent(); geo.dispose(); mat.dispose(); } });
  }

  private nova(x: number, z: number, r: number, damage: number, element: Element, color: number): void {
    const eng = this.eng;
    for (let i = 0; i < 80; i++) {
      const a = (i / 80) * Math.PI * 2;
      eng.particles.emit({ x, y: 1, z, count: 1, speed: r * 2.4, dir: [Math.cos(a), 0, Math.sin(a)], cone: 1, life: 0.6, color: 0x8a4aff, color2: 0x000000, size: 0.9, drag: 1.2 });
    }
    eng.smoke.emit({ x, y: 1, z, count: 30, spread: 1, speed: 4, life: 1.2, color: 0x1a0a2a, size: 2, size2: 3, alpha: 0.7 });
    eng.addShake(0.6);
    for (const e of eng.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < r) this.damageEnemy(e, damage, element, { spell: 'eclipse', knock: { x: (e.x - x) / (d || 1), z: (e.z - z) / (d || 1), force: 6 } });
    }
    void color;
  }

  private starfall(x: number, z: number, r: number, damage: number, dur: number): void {
    const eng = this.eng;
    const n = 9;
    for (let i = 0; i < n; i++) {
      const at = eng.now + (i / n) * dur;
      const sx = x + (Math.random() - 0.5) * r * 2, sz = z + (Math.random() - 0.5) * r * 2;
      const star = new THREE.Sprite(spriteMat(0xfff0a0));
      star.scale.setScalar(1.4);
      star.visible = false;
      eng.scene.add(star);
      this.timed.push({
        until: at + 0.45,
        update: (now) => {
          if (now < at) return;
          star.visible = true;
          const k = Math.min(1, (now - at) / 0.45);
          star.position.set(sx - 3 * (1 - k), 14 * (1 - k) + 0.3, sz - 2 * (1 - k));
          eng.particles.emit({ x: star.position.x, y: star.position.y, z: star.position.z, count: 1, speed: 0.3, life: 0.4, color: 0xa0c0ff, size: 0.5 });
        },
        dispose: () => { star.removeFromParent(); },
        done: () => {
          eng.particles.emit({ x: sx, y: 0.4, z: sz, count: 30, speed: 5, up: 2, life: 0.6, color: 0xfff0a0, color2: 0xa0c0ff, size: 0.6 });
          eng.addDynLight(sx, 1.5, sz, 0xfff0c0, 3, 10, 0.3);
          bus.emit('sfx', { id: 'explosion', x: sx, z: sz, volume: 0.6 });
          for (const e of eng.enemies) if (!e.dead && Math.hypot(e.x - sx, e.z - sz) < 1.8) this.damageEnemy(e, damage, 'light', { spell: 'starfall' });
        },
      });
    }
  }

  freezeWater(x: number, z: number, r: number): void {
    const g = this.eng.zone!.grid;
    const c0 = Math.floor((x - r) / TS), c1 = Math.floor((x + r) / TS);
    const r0 = Math.floor((z - r) / TS), r1 = Math.floor((z + r) / TS);
    let any = false;
    for (let rr = r0; rr <= r1; rr++) for (let cc = c0; cc <= c1; cc++) {
      if (cc < 0 || rr < 0 || cc >= g.w || rr >= g.h) continue;
      const i = rr * g.w + cc;
      if (!g.water[i]) continue;
      const [cx, cz] = cellCenter(cc, rr);
      if (Math.hypot(cx - x, cz - z) > r + TS * 0.5) continue;
      if (g.ice[i] < this.eng.now + 5) any = true;
      g.ice[i] = this.eng.now + 28;
    }
    if (any) {
      bus.emit('sfx', { id: 'freeze', x, z });
      bus.emit('spellHitObject', { spell: 'frost', object: 'water', kind: 'water' });
      this.iceT = 0;
    }
  }

  // ---------------- Добыча ----------------

  spawnGold(amount: number, x: number, z: number): void {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0xf0c050, metalness: 0.9, roughness: 0.25, emissive: 0x5a4010 }));
    m.rotation.x = Math.PI / 2;
    const g = new THREE.Group();
    g.add(m);
    const glow = new THREE.Sprite(spriteMat(0xffd060));
    glow.scale.setScalar(0.8);
    g.add(glow);
    this.eng.scene.add(g);
    this.pickups.push({ kind: 'gold', amount, x: x + (Math.random() - 0.5) * 1.4, z: z + (Math.random() - 0.5) * 1.4, mesh: g, t: Math.random() * 6, delay: 0.5 });
  }

  spawnItemPickup(itemId: string, qty: number, x: number, z: number, dropUid?: string): void {
    const def = ITEMS[itemId];
    if (!def) return;
    const color = new THREE.Color(RARITY[def.rarity].color).getHex();
    const g = new THREE.Group();
    const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), new THREE.MeshStandardMaterial({ color: new THREE.Color(def.color ?? '#ffffff'), emissive: color, emissiveIntensity: 0.6, roughness: 0.3 }));
    g.add(gem);
    const glow = new THREE.Sprite(spriteMat(color));
    glow.scale.setScalar(1.1);
    g.add(glow);
    this.eng.scene.add(g);
    this.pickups.push({ kind: 'item', amount: qty, itemId, dropUid, x, z, mesh: g, t: Math.random() * 6, delay: dropUid ? 2.5 : 0.6 });
  }

  // ---------------- Кадр ----------------

  update(dt: number): void {
    const eng = this.eng;
    const now = eng.now;
    const p = eng.player;
    const g = G();
    const d = derived();
    this.inCombatT = Math.max(0, this.inCombatT - dt);

    // регенерация и поддержание щита
    if (g.player.hp > 0) {
      this.pendHp += d.hpRegen * (this.inCombatT > 0 ? 1 : 5) * dt;
      if (p.hotUntil > now) this.pendHp += p.hotRate * dt;
      this.pendMana += d.manaRegen * (p.shielding ? 0 : 1) * dt;
      if (p.shielding) {
        this.pendMana -= 7 * dt;
        if (g.player.mana + this.pendMana <= 0) { p.shielding = false; toast('warn', 'Щит рассеялся', 'Мана иссякла'); }
      }
    }
    this.flushT -= dt;
    if (this.flushT <= 0) { this.flushT = 0.12; this.flush(); }

    // снаряды
    const grid = eng.zone!.grid;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      const stepX = pr.vx * dt, stepZ = pr.vz * dt;
      pr.x += stepX; pr.z += stepZ;
      pr.travelled += Math.hypot(stepX, stepZ);
      pr.life -= dt;
      pr.mesh.position.set(pr.x, pr.y, pr.z);
      if (Math.random() < 0.8) eng.particles.emit({ x: pr.x, y: pr.y, z: pr.z, count: 1, spread: 0.08, speed: 0.4, life: pr.kind === 'flame' ? 0.5 : 0.3, color: pr.color, size: pr.kind === 'flame' ? 0.7 : 0.4 });
      if (pr.kind === 'flame' || pr.kind === 'fire') eng.addDynLight(pr.x, pr.y, pr.z, 0xff8030, 1.6, 8, 0.05);
      let hit = false;
      const c = Math.floor(pr.x / TS), r = Math.floor(pr.z / TS);
      if (pr.spell === 'frost' && grid.water[r * grid.w + c]) this.freezeWater(pr.x, pr.z, 1.6);
      if (pr.owner === 'player') {
        for (const e of eng.enemies) {
          if (e.dead) continue;
          if (Math.hypot(e.x - pr.x, e.z - pr.z) < e.radius + pr.radius + 0.15) {
            this.playerProjectileHit(pr, e);
            hit = true;
            break;
          }
        }
        if (!hit && pr.spell && eng.interact.projectileHit(pr.spell, pr.x, pr.z)) hit = true;
      } else {
        if (Math.hypot(p.x - pr.x, p.z - pr.z) < 0.5 + pr.radius) {
          if (p.shielding && now - p.shieldStart < 0.3 && pr.kind !== 'rock') {
            // идеальный щит отражает снаряд
            const target = pr.src && !pr.src.dead ? pr.src : eng.enemies.find((e) => !e.dead);
            let dx = -pr.vx, dz = -pr.vz;
            if (target) { dx = target.x - pr.x; dz = target.z - pr.z; }
            const l = Math.hypot(dx, dz) || 1;
            pr.vx = (dx / l) * 18; pr.vz = (dz / l) * 18;
            pr.owner = 'player';
            pr.damage *= 1.5;
            pr.life = 1.5;
            eng.floaters.text(p.x, 2.4, p.z, 'Отражено!', 'parry');
            bus.emit('sfx', { id: 'parry' });
            mutate((s) => { s.counters.parries = (s.counters.parries ?? 0) + 1; });
            continue;
          }
          if (now >= p.iframesUntil) {
            this.damagePlayer(pr.damage, pr.element, pr.x, pr.z, pr.src);
            if (pr.kind === 'web') p.slowUntil = now + 2.5;
            if (pr.kind === 'ice') p.slowUntil = now + 1.2;
            hit = true;
          }
        }
      }
      if (!hit && shotBlocked(grid, c, r)) hit = true;
      if (hit || pr.life <= 0) {
        this.impact(pr);
        pr.mesh.removeFromParent();
        this.projectiles.splice(i, 1);
      }
    }

    // отложенные эффекты
    for (let i = this.timed.length - 1; i >= 0; i--) {
      const t = this.timed[i];
      if (now >= t.until) { this.timed.splice(i, 1); t.done?.(); t.dispose?.(); continue; }
      t.update?.(now);
    }

    // добыча
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.t += dt;
      pk.delay -= dt;
      const dx = p.x - pk.x, dz = p.z - pk.z;
      const dist = Math.hypot(dx, dz);
      if (pk.delay <= 0 && dist < 3.5) {
        const sp = (4 - dist) * 4 * dt;
        pk.x += (dx / (dist || 1)) * sp; pk.z += (dz / (dist || 1)) * sp;
      }
      pk.mesh.position.set(pk.x, 0.6 + Math.sin(pk.t * 3) * 0.12, pk.z);
      pk.mesh.rotation.y = pk.t * 2;
      if (pk.delay <= 0 && dist < 0.8) {
        if (pk.kind === 'gold') {
          mutate((s) => { s.player.gold += pk.amount; s.counters.goldEarned = (s.counters.goldEarned ?? 0) + pk.amount; });
          eng.floaters.text(p.x, 2.6, p.z, `+${pk.amount} ◈`, 'gold');
          bus.emit('sfx', { id: 'coins' });
          bus.emit('itemChanged', { id: 'gold', qty: G().player.gold });
        } else if (pk.itemId) {
          addItem(pk.itemId, pk.amount);
          if (pk.dropUid) mutate((s) => { const z = eng.zone!.def.id; s.drops[z] = (s.drops[z] ?? []).filter((d2) => d2.uid !== pk.dropUid); });
        }
        pk.mesh.removeFromParent();
        this.pickups.splice(i, 1);
      }
    }

    // визуал щита и светоча
    this.shieldMesh.visible = p.shielding;
    if (p.shielding) {
      this.shieldMesh.position.set(p.x, 1, p.z);
      const pulse = now - p.shieldStart < 0.3 ? 1.6 : 1;
      (this.shieldMesh.material as THREE.MeshBasicMaterial).opacity = 0.16 * pulse + Math.sin(now * 8) * 0.03;
      this.shieldMesh.scale.setScalar(1 + Math.sin(now * 6) * 0.03);
    }
    this.lightOrb.visible = p.lightUntil > now;
    if (this.lightOrb.visible) this.lightOrb.position.set(p.x + Math.sin(now * 1.5) * 0.7, 2.9 + Math.sin(now * 2.3) * 0.15, p.z + Math.cos(now * 1.5) * 0.7);

    // лёд
    this.iceT -= dt;
    if (this.iceT <= 0) {
      this.iceT = 0.25;
      const m = new THREE.Matrix4();
      let k = 0;
      for (let i = 0; i < grid.ice.length && k < 400; i++) {
        if (grid.ice[i] <= now) continue;
        const [x, z] = cellCenter(i % grid.w, Math.floor(i / grid.w));
        const left = grid.ice[i] - now;
        const s = left < 3 ? 0.6 + 0.4 * Math.abs(Math.sin(now * 8)) : 1;
        m.makeScale(s, 1, s).setPosition(x, -0.04, z);
        this.iceMesh.setMatrixAt(k++, m);
      }
      this.iceMesh.count = k;
      this.iceMesh.instanceMatrix.needsUpdate = true;
      // если герой стоит на растаявшем льду — выталкиваем на берег
      const pc = Math.floor(p.x / TS), prr = Math.floor(p.z / TS);
      const pi = prr * grid.w + pc;
      if (grid.water[pi] === 1 && grid.ice[pi] <= now) {
        p.pushBack();
        eng.particles.emit({ x: p.x, y: 0.2, z: p.z, count: 20, speed: 2, up: 2, gravity: 6, life: 0.5, color: 0x9ad0ff, size: 0.3 });
        bus.emit('sfx', { id: 'splash' });
      }
    }
  }

  private playerProjectileHit(pr: Projectile, e: EnemyEntity): void {
    const spell = pr.spell;
    if (spell) {
      this.applySpellEffects(e, spell, pr.vx, pr.vz);
      if (e.dead) return;
    }
    const l = Math.hypot(pr.vx, pr.vz) || 1;
    this.damageEnemy(e, pr.damage, pr.element, { spell, knock: spell === 'spark' ? { x: pr.vx / l, z: pr.vz / l, force: 1.5 } : undefined });
  }

  private impact(pr: Projectile): void {
    const eng = this.eng;
    eng.particles.emit({ x: pr.x, y: pr.y, z: pr.z, count: pr.kind === 'flame' ? 40 : 14, speed: pr.kind === 'flame' ? 5 : 2.5, life: 0.5, color: pr.color, color2: 0x000000, size: pr.kind === 'flame' ? 0.8 : 0.4 });
    if (pr.kind === 'flame' && pr.owner === 'player') {
      bus.emit('sfx', { id: 'explosion', x: pr.x, z: pr.z, volume: 0.7 });
      eng.addDynLight(pr.x, 1.4, pr.z, 0xff7a2a, 3, 10, 0.3);
      const r = SPELLS.flame.radius ?? 2.6;
      for (const e of eng.enemies) {
        if (e.dead) continue;
        const dd = Math.hypot(e.x - pr.x, e.z - pr.z);
        if (dd < r && dd > e.radius + pr.radius + 0.2) { this.damageEnemy(e, pr.damage * 0.5, 'fire', { noCrit: true }); if (!e.dead) { e.st.burning = eng.now + 3; e.st.burnDps = Math.max(e.st.burnDps, 4); } }
      }
      eng.interact.spellAt('flame', pr.x, pr.z, r);
    }
    if (pr.kind === 'frost' && pr.owner === 'player') { this.freezeWater(pr.x, pr.z, 2.4); eng.interact.spellAt('frost', pr.x, pr.z, 2); }
    if (pr.kind === 'spark' && pr.owner === 'player') eng.interact.spellAt('spark', pr.x, pr.z, 1.2);
  }

  flush(): void {
    if (this.pendHp === 0 && this.pendMana === 0) return;
    const d = derived();
    const dh = this.pendHp, dm = this.pendMana;
    this.pendHp = 0; this.pendMana = 0;
    const g = G();
    const hp = g.player.hp <= 0 ? 0 : Math.min(d.maxHp, Math.max(0, g.player.hp + dh));
    const mana = Math.min(d.maxMana, Math.max(0, g.player.mana + dm));
    if (hp !== g.player.hp || mana !== g.player.mana) mutate((s) => { s.player.hp = hp; s.player.mana = mana; });
  }

  clear(): void {
    for (const pr of this.projectiles) pr.mesh.removeFromParent();
    this.projectiles = [];
    for (const t of this.timed) t.dispose?.();
    this.timed = [];
    for (const pk of this.pickups) pk.mesh.removeFromParent();
    this.pickups = [];
    this.iceMesh.count = 0;
    this.inCombatT = 0;
  }
}
