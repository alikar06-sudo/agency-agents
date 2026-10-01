// Живой мир: случайные события и ночной патруль.
import { G, hasGame, isModalOpen, mutate, toast, ui } from '@/state/store';
import { engine } from '@/engine/Engine';
import { bus } from '@/core/bus';
import { apply, checkAll } from './logic';
import { isCurfew, isNight, hour } from './time';
import { lineOfSight } from '@/engine/physics';
import type { Cond, ZoneId } from '@/data/types';
import { TS } from '@/engine/world';
import { blockedCell } from '@/engine/physics';

interface WorldEvent { id: string; zones: ZoneId[] | 'any'; if?: Cond[]; night?: boolean; day?: boolean; weight: number; run: () => boolean }

const CASTLE: ZoneId[] = ['hall', 'library', 'towers', 'dungeons'];

function spawnNear(type: string, n: number, minD = 5, maxD = 9): number {
  let spawned = 0;
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < 20; t++) {
      const a = Math.random() * Math.PI * 2, d = minD + Math.random() * (maxD - minD);
      const x = engine.player.x + Math.cos(a) * d, z = engine.player.z + Math.sin(a) * d;
      if (blockedCell(engine.zone!.grid, Math.floor(x / TS), Math.floor(z / TS), engine.now)) continue;
      if (!lineOfSight(engine.zone!.grid, engine.player.x, engine.player.z, x, z)) continue;
      if (engine.spawnEnemy(type, x, z, { aggro: false })) { spawned++; engine.particles.emit({ x, y: 1, z, count: 25, speed: 2, life: 0.8, color: 0x8a6aff, size: 0.5 }); }
      break;
    }
  }
  return spawned;
}

const EVENTS: WorldEvent[] = [
  { id: 'glitch', zones: CASTLE, if: [{ act: 2 }], weight: 3, run: () => {
    bus.emit('sfx', { id: 'glitch' });
    engine.addShake(0.3);
    const n = spawnNear(isNight() ? 'shade' : 'book_swarm', isNight() ? 2 : 3);
    if (!n) return false;
    toast('warn', 'Магический сбой!', isNight() ? 'Свечи гаснут, из теней выползают твари.' : 'Книги срываются с полок и кусаются!');
    return true;
  } },
  { id: 'whisper', zones: 'any', night: true, weight: 2, run: () => {
    const hidden = engine.interact.items.filter((it) => !it.revealed && it.condOk());
    toast('spell', 'Вы слышите шёпот…', hidden.length ? 'Где-то рядом что-то прячется. Попробуйте «Откровение».' : 'Голос зовёт вас вниз, под камень. И стихает.');
    bus.emit('sfx', { id: 'resonance', volume: 0.6 });
    return true;
  } },
  { id: 'argument', zones: ['hall', 'towers', 'gates'], day: true, if: [{ notFlag: 'event_argument' }], weight: 2, run: () => {
    if (!engine.npcs.find('agatha')) return false;
    apply([{ setFlag: 'event_argument' }]);
    toast('info', 'Громкий спор', 'Агата Блэквуд и Нико Фэй ругаются неподалёку. Может, вмешаться?');
    return true;
  } },
  { id: 'zane', zones: ['gates'], day: true, if: [{ act: 2 }, { notFlag: 'event_zane' }], weight: 1, run: () => {
    apply([{ setFlag: 'event_zane' }]);
    toast('info', 'Бродячий торговец', 'Во двор въехала пёстрая повозка Зейна. Он задержится до конца дня.');
    engine.npcs.syncZone(false);
    return true;
  } },
  { id: 'stars', zones: ['gates', 'lake', 'village'], night: true, weight: 2, run: () => {
    for (let i = 0; i < 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const x = engine.player.x + Math.cos(a) * 5, z = engine.player.z + Math.sin(a) * 5;
      if (!blockedCell(engine.zone!.grid, Math.floor(x / TS), Math.floor(z / TS), engine.now)) engine.combat.spawnItemPickup('star_dust', 1, x, z);
    }
    toast('info', 'Звездопад', 'С неба падают искры. Звёздная пыль оседает на траву.');
    return true;
  } },
  { id: 'wisps', zones: ['forest', 'gates'], night: true, if: [{ act: 2 }], weight: 2, run: () => {
    const n = spawnNear('wisp', 2, 7, 11);
    if (n) toast('warn', 'Огоньки', 'Между деревьями замелькали блуждающие огни.');
    return n > 0;
  } },
  { id: 'lost', zones: ['hall', 'towers'], day: true, weight: 1, run: () => {
    apply([{ gold: 5 }]);
    toast('info', 'Заблудившийся первокурсник', 'Вы показали малышу дорогу в библиотеку. Он отдал вам «на счастье» монетку.');
    mutate((g) => { g.rel.quill = (g.rel.quill ?? 0) + 1; });
    return true;
  } },
];

let timer = 50;
let caughtCooldown = 0;
let outTonight = false;
let caughtTonight = false;

export function initWorldEvents(): void {
  engine.onFrame((dt) => {
    if (!hasGame() || isModalOpen() || !engine.zone) return;
    timer -= dt;
    caughtCooldown -= dt;
    const zone = engine.zone.def.id;
    if (timer <= 0) {
      timer = 70 + Math.random() * 70;
      if (engine.combat.inCombat || ui().challenge) return;
      const night = isNight();
      const pool = EVENTS.filter((e) => (e.zones === 'any' || e.zones.includes(zone)) && (!e.night || night) && (!e.day || !night) && checkAll(e.if));
      const total = pool.reduce((s, e) => s + e.weight, 0);
      let r = Math.random() * total;
      for (const e of pool) { r -= e.weight; if (r <= 0) { if (e.run()) mutate((g) => { g.counters.events = (g.counters.events ?? 0) + 1; }); break; } }
    }
    patrol(zone);
  });
  bus.on('dayChanged', () => { apply([{ clearFlag: 'event_zane' }]); });
  bus.on('hourChanged', (e) => {
    if (e.hour === 22) { outTonight = false; caughtTonight = false; }
    if (e.hour === 2 && outTonight && !caughtTonight) apply([{ achievement: 'night_owl' }]);
  });
}

// Ночной патруль: ученик вне спальни после отбоя рискует попасться.
function patrol(zone: ZoneId): void {
  if (!isCurfew() || !CASTLE.includes(zone) || caughtCooldown > 0) return;
  const g = G();
  const exempt = ['mq_whispers', 'mq_sleepwalker', 'mq_night_of_ash'].some((q) => g.quests[q]?.state === 'active' && (q !== 'mq_sleepwalker' || !g.quests[q].done.includes('find')))
    || g.act >= 5;
  if (zone === 'towers') { const d = engine.marker('dorm_entrance'); if (d && Math.hypot(d.x - engine.player.x, d.z - engine.player.z) < 14) return; }
  outTonight = true;
  if (exempt) return;
  for (const id of ['ulrich', 'gravane', 'quill']) {
    const n = engine.npcs.find(id);
    if (!n || n.sleeping) continue;
    const d = Math.hypot(n.x - engine.player.x, n.z - engine.player.z);
    if (d < 7 && lineOfSight(engine.zone!.grid, n.x, n.z, engine.player.x, engine.player.z)) {
      caughtCooldown = 30;
      caughtTonight = true;
      apply([{ circlePoints: -15 }, { setFlag: 'caught_curfew_pending' }, { achievement: 'caught' }, { incFlag: 'times_caught' }]);
      toast('warn', `Вас заметил${id === 'ulrich' ? '' : 'а'} ${n.def.name}!`, 'Ночная прогулка закончилась. −15 очков Кругу. Вас отводят в спальню.');
      if (id === 'quill' && zone === 'library') apply([{ rel: 'quill', delta: -10 }]);
      engine.teleport('towers', 'dorm_entrance');
      return;
    }
  }
  void hour;
}
