// NPC в мире: следуют расписанию, ходят по зонам, реагируют на героя, показывают значки заданий.
import type { Engine } from './Engine';
import { buildCharacter, animateCharacter } from './models';
import { voice } from '@/core/voice';
import { VOICE_PROFILES } from '@/data/voices';
import type { CharacterRig } from './models';
import { NPCS } from '@/data/npcs';
import type { NpcDef } from '@/data/types';
import { npcLocation } from '@/systems/schedule';
import type { NpcLocation } from '@/systems/schedule';
import { findPath, moveCircle } from './physics';
import { bus } from '@/core/bus';
import { G, toast, ui, useSettings } from '@/state/store';
import { talkTo, pickDialogue } from '@/systems/dialogue';
import { activeObjectives } from '@/systems/quests';
import { checkAll, fmt } from '@/systems/logic';

export class NpcEntity {
  rig: CharacterRig;
  x: number; z: number; facing = 0;
  home: { x: number; z: number };
  path: [number, number][] = [];
  leaving = false;
  removed = false;
  wanderT = 2 + Math.random() * 4;
  barkUntil = 0;
  barkNext = 0;
  bark = '';
  dist = 99;
  t = Math.random() * 10;
  moving = 0;
  talkK = 0;
  mark: '' | '!' | '?' = '';
  markT = 0;
  readonly radius = 0.4;

  constructor(private eng: Engine, public def: NpcDef, public loc: NpcLocation, x: number, z: number) {
    const vp = VOICE_PROFILES[def.id];
    this.rig = buildCharacter({ ...def.appearance, gender: def.appearance.gender ?? vp?.gender, age: def.appearance.age ?? vp?.age });
    this.rig.wand.visible = !!def.circle || def.title.includes('Магистр') || def.title.includes('Профессор');
    this.x = x; this.z = z;
    this.home = { x, z };
    this.rig.root.position.set(x, 0, z);
    eng.scene.add(this.rig.root);
  }

  // Спит только тот, кто уже лёг на своё место: по дороге к кровати и после пробуждения NPC идёт стоя.
  get sleeping(): boolean {
    return this.loc.activity === 'sleep' && !this.leaving && this.path.length === 0 && Math.hypot(this.x - this.home.x, this.z - this.home.z) < 0.8;
  }

  talk(): void {
    if (this.sleeping) { toast('info', `${this.def.name.split(' ')[0]} спит`, 'Будить не стоит.'); return; }
    this.facing = Math.atan2(this.eng.player.x - this.x, this.eng.player.z - this.z);
    this.eng.focus = { x: this.x, z: this.z };
    this.path = [];
    talkTo(this.def.id);
  }

  goTo(x: number, z: number): void {
    const p = findPath(this.eng.zone!.grid, this.x, this.z, x, z, this.eng.now, 1800);
    this.path = p ?? [];
    if (!p) { this.x = x; this.z = z; }
  }

  update(dt: number): void {
    this.t += dt;
    const p = this.eng.player;
    this.dist = Math.hypot(p.x - this.x, p.z - this.z);
    let speed = 0;
    if (this.path.length) {
      const [tx, tz] = this.path[0];
      const dx = tx - this.x, dz = tz - this.z;
      const l = Math.hypot(dx, dz);
      if (l < 0.25) {
        this.path.shift();
        if (!this.path.length && this.leaving) { this.removed = true; return; }
      } else {
        const sp = 2.4;
        const [nx, nz] = moveCircle(this.eng.zone!.grid, this.x, this.z, (dx / l) * sp * dt, (dz / l) * sp * dt, this.radius, this.eng.now);
        this.x = nx; this.z = nz;
        this.facing = turn(this.facing, Math.atan2(dx, dz), dt * 8);
        speed = sp;
      }
    } else if (!this.sleeping) {
      // лицом к герою, если он рядом
      if (this.dist < 4) this.facing = turn(this.facing, Math.atan2(p.x - this.x, p.z - this.z), dt * 5);
      else {
        this.wanderT -= dt;
        const r = this.loc.wander ?? 0;
        if (this.wanderT <= 0 && r > 0) {
          this.wanderT = 4 + Math.random() * 6;
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * r * 2;
          this.goTo(this.home.x + Math.cos(a) * d, this.home.z + Math.sin(a) * d);
        }
      }
      // реплики мимоходом
      if (this.dist < 5 && this.eng.now > this.barkNext && this.def.barks?.length) {
        this.barkNext = this.eng.now + 25 + Math.random() * 20;
        this.bark = this.def.barks[Math.floor(Math.random() * this.def.barks.length)];
        this.barkUntil = this.eng.now + 4;
        const st = useSettings.getState();
        if (st.voice && st.voiceBarks && voice.available && !voice.speaking && !ui().dialogue) {
          voice.speak(fmt(this.bark), VOICE_PROFILES[this.def.id] ?? VOICE_PROFILES.narrator, this.def.id, { volume: st.voiceVolume * (this.dist < 3 ? 0.75 : 0.5), rate: st.voiceRate });
        }
      }
    }
    this.moving += ((speed > 0 ? 1 : 0) - this.moving) * Math.min(1, dt * 8);
    this.animate(dt);
  }

  animate(dt: number): void {
    if (this.sleeping) {
      this.rig.root.position.set(this.x, 0.7, this.z);
      this.rig.root.rotation.set(-Math.PI / 2, 0, 0);
      return;
    }
    // смотрит на героя, когда тот рядом; во время речи шевелит губами и жестикулирует
    const p = this.eng.player;
    let lookYaw: number | undefined;
    let lookPitch: number | undefined;
    if (this.dist < 5 && this.moving < 0.3) {
      let d = Math.atan2(p.x - this.x, p.z - this.z) - this.facing;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      if (Math.abs(d) < 1.9) {
        lookYaw = d;
        const eyeDiff = (this.eng.mode === 'first' ? p.rig.height * 0.93 : p.rig.height * 0.9) - this.rig.height * 0.92;
        lookPitch = -Math.atan2(eyeDiff, Math.max(0.6, this.dist)) * 0.8;
      }
    }
    const mouth = voice.mouth(this.def.id, this.t);
    this.talkK += ((mouth > 0 ? 1 : 0) - this.talkK) * Math.min(1, dt * 3);
    animateCharacter(this.rig, this.t, this.moving * 0.6, 0, 0, dt, { mouth, lookYaw, lookPitch, talk: this.talkK });
    this.rig.root.position.set(this.x, 0, this.z);
    this.rig.root.rotation.set(0, this.facing, 0);
  }

  dispose(): void { this.rig.dispose(); }
}

function turn(a: number, b: number, k: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, k);
}

export class NpcManager {
  list: NpcEntity[] = [];
  private markT = 0;

  constructor(private eng: Engine) {
    bus.on('hourChanged', () => { if (this.eng.zone) this.syncZone(false); });
    // Сюжетные флаги и задания меняют расписания (переопределения) — пересобираем состав NPC.
    bus.on('questUpdated', () => { this.markT = 0; this.queueSync(); });
    bus.on('flagSet', () => { this.markT = 0; this.queueSync(); });
    bus.on('dialogueEnded', () => { this.eng.focus = null; this.markT = 0; });
  }

  private syncQueued = false;
  private queueSync(): void {
    if (this.syncQueued) return;
    this.syncQueued = true;
    setTimeout(() => {
      this.syncQueued = false;
      if (this.eng.zone && !this.eng.loading) this.syncZone(false);
    }, 120);
  }

  anchorPos(key: string): { x: number; z: number } | null {
    const m = this.eng.zone?.markers.find((mk) => mk.key === key || mk.def.id === key);
    return m ? { x: m.x, z: m.z } : null;
  }

  syncZone(initial: boolean): void {
    const zone = this.eng.zone!;
    const zid = zone.def.id;
    const wanted = new Map<string, NpcLocation>();
    for (const id of Object.keys(NPCS)) {
      const loc = npcLocation(id);
      if (loc && loc.zone === zid) wanted.set(id, loc);
    }
    // уходящие
    for (const n of this.list) {
      const loc = wanted.get(n.def.id);
      if (!loc) {
        if (initial) { n.removed = true; continue; }
        const next = npcLocation(n.def.id);
        const exit = zone.markers.find((m) => m.def.kind === 'exit' && next && m.def.to === next.zone)
          ?? zone.markers.filter((m) => m.def.kind === 'exit').sort((a, b) => Math.hypot(a.x - n.x, a.z - n.z) - Math.hypot(b.x - n.x, b.z - n.z))[0];
        if (exit) { n.leaving = true; n.goTo(exit.x, exit.z); if (!n.path.length) n.removed = true; } else n.removed = true;
      } else if (n.leaving || loc.at !== n.loc.at || loc.activity !== n.loc.activity) {
        // расписание снова привело NPC сюда, пока он шёл к выходу — разворачивается, а не раздваивается
        n.leaving = false;
        n.loc = loc;
        const pos = this.anchorPos(loc.at);
        if (pos) { n.home = pos; n.goTo(pos.x, pos.z); }
      }
    }
    // приходящие
    for (const [id, loc] of wanted) {
      if (this.list.some((n) => n.def.id === id && !n.removed && !n.leaving)) continue;
      const pos = this.anchorPos(loc.at);
      if (!pos) { console.warn(`Нет якоря ${loc.at} для ${id} в зоне ${zid}`); continue; }
      let sx = pos.x, sz = pos.z;
      if (!initial) {
        const prev = npcLocation(id, Math.max(0, G().time.min / 60 - 1));
        const entry = zone.markers.find((m) => m.def.kind === 'exit' && prev && m.def.to === prev.zone);
        if (entry) { sx = entry.x; sz = entry.z; }
      }
      const n = new NpcEntity(this.eng, NPCS[id], loc, sx, sz);
      n.home = pos;
      if (sx !== pos.x || sz !== pos.z) n.goTo(pos.x, pos.z);
      this.list.push(n);
    }
    this.cleanup();
    this.markT = 0;
  }

  private cleanup(): void {
    this.list = this.list.filter((n) => {
      if (n.removed) { n.dispose(); this.eng.floaters.removeLabel('npc_' + n.def.id); this.eng.floaters.removeLabel('bark_' + n.def.id); return false; }
      return true;
    });
  }

  update(dt: number): void {
    for (const n of this.list) n.update(dt);
    if (this.list.some((n) => n.removed)) this.cleanup();
    this.markT -= dt;
    if (this.markT <= 0) {
      this.markT = 0.6;
      for (const n of this.list) n.mark = computeMark(n.def.id);
    }
  }

  animateIdle(dt: number): void { for (const n of this.list) { n.t += dt; n.animate(dt); } }

  // dir — направление взгляда (в режимах обзора выбираем того, на кого смотрим)
  nearest(x: number, z: number, r: number, dir?: { x: number; z: number }): NpcEntity | null {
    let best: NpcEntity | null = null;
    let bd = r;
    for (const n of this.list) {
      if (n.leaving) continue;
      let d = Math.hypot(n.x - x, n.z - z);
      if (dir && d > 0.6) {
        const cos = ((n.x - x) * dir.x + (n.z - z) * dir.z) / d;
        if (cos < 0.35) continue;
        d *= 1 + (1 - cos) * 1.2;
      }
      if (d < bd) { bd = d; best = n; }
    }
    if (best) best.dist = bd;
    return best;
  }

  separate(px: number, pz: number, r: number): [number, number] {
    for (const n of this.list) {
      if (n.sleeping) continue;
      const dx = px - n.x, dz = pz - n.z;
      const d = Math.hypot(dx, dz), min = r + n.radius;
      if (d < min && d > 1e-4) { px += (dx / d) * (min - d); pz += (dz / d) * (min - d); }
    }
    return [px, pz];
  }

  find(id: string): NpcEntity | undefined { return this.list.find((n) => n.def.id === id && !n.removed); }

  updateLabels(): void {
    const { w, h } = this.eng.size;
    const cam = this.eng.camera;
    for (const n of this.list) {
      const show = n.dist < 11 && !n.leaving;
      const markHtml = n.mark ? `<span class="qmark ${n.mark === '!' ? 'new' : 'turn'}">${n.mark}</span>` : '';
      const html = `${markHtml}<span class="npc-name">${n.def.name}</span>${n.dist < 6 ? `<span class="npc-title">${n.def.title}</span>` : ''}`;
      this.eng.floaters.label('npc_' + n.def.id, html, 'npc-label');
      this.eng.floaters.placeLabel('npc_' + n.def.id, n.x, (n.sleeping ? 1.4 : n.rig.height + 0.55), n.z, cam, w, h, show || (!!n.mark && n.dist < 26));
      const barkOn = n.barkUntil > this.eng.now && n.dist < 9;
      this.eng.floaters.label('bark_' + n.def.id, `<span>${n.bark}</span>`, 'bubble');
      this.eng.floaters.placeLabel('bark_' + n.def.id, n.x, n.rig.height + 1.25, n.z, cam, w, h, barkOn);
    }
  }

  clear(): void {
    for (const n of this.list) n.dispose();
    this.list = [];
  }
}

function computeMark(npc: string): '' | '!' | '?' {
  const g = G();
  for (const q of Object.keys(g.quests)) {
    if (g.quests[q].state !== 'active') continue;
    for (const o of activeObjectives(q)) {
      if ((o.kind === 'talk' && o.target === npc) || (o.where?.npc === npc)) return '?';
    }
  }
  const def = NPCS[npc];
  const entry = def?.dialogues.find((d) => checkAll(d.if));
  if (entry?.mark && pickDialogue(npc) === entry.id) return '!';
  return '';
}
