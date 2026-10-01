// Испытания на тренировочном поле: урок практической магии проходит прямо в мире.
import type { SubjectId } from '@/data/types';
import { engine } from './Engine';
import { bus } from '@/core/bus';
import { G, setUI, toast } from '@/state/store';
import { apply } from '@/systems/logic';
import { finishLesson } from '@/systems/lessons';
import { derived } from '@/systems/player';
import { TS } from './world';
import { blockedCell } from './physics';

interface Wave { enemy: string; count: number }

const PLANS: { title: string; learn: string[]; waves: Wave[][]; time: number }[] = [
  { title: 'Искра и щит', learn: ['spark', 'ward'], waves: [[{ enemy: 'practice_wisp', count: 3 }]], time: 120 },
  { title: 'Порыв', learn: ['gust'], waves: [[{ enemy: 'practice_wisp', count: 3 }], [{ enemy: 'practice_wisp', count: 3 }]], time: 120 },
  { title: 'Пламя', learn: ['flame'], waves: [[{ enemy: 'practice_wisp', count: 2 }, { enemy: 'shade', count: 1 }], [{ enemy: 'practice_wisp', count: 3 }]], time: 120 },
];
const EXAM = { title: 'Испытание на поле', learn: [] as string[], waves: [[{ enemy: 'practice_wisp', count: 3 }], [{ enemy: 'shade', count: 2 }], [{ enemy: 'hound', count: 1 }, { enemy: 'practice_wisp', count: 2 }]], time: 150 };

let active = false;

export function startArena(subject: SubjectId, index: number, exam: boolean): void {
  if (active || subject !== 'practical') return;
  const plan = exam ? EXAM : PLANS[Math.min(index, PLANS.length - 1)];
  active = true;
  for (const s of plan.learn) if (!G().spells.known.includes(s)) apply([{ learnSpell: s }]);
  const g0 = G();
  const startHp = g0.player.hp;
  let damage = 0;
  let wave = 0;
  let left = plan.time;
  let alive: string[] = [];
  const center = engine.marker('practice_desk') ?? { x: engine.player.x, z: engine.player.z };
  const spawnWave = () => {
    alive = [];
    for (const w of plan.waves[wave]) {
      for (let i = 0; i < w.count; i++) {
        for (let tries = 0; tries < 20; tries++) {
          const x = center.x + (Math.random() - 0.5) * 12, z = center.z + (Math.random() - 0.5) * 8 - 2;
          if (blockedCell(engine.zone!.grid, Math.floor(x / TS), Math.floor(z / TS), engine.now)) continue;
          const e = engine.spawnEnemy(w.enemy, x, z, { aggro: true, uniqueId: 'arena' });
          if (e) { alive.push(e.uid); engine.particles.emit({ x, y: 1, z, count: 20, speed: 2, life: 0.6, color: 0x9ad0ff, size: 0.5 }); }
          break;
        }
      }
    }
    setUI({ challenge: { title: plan.title, goal: `Волна ${wave + 1}/${plan.waves.length}: противников ${alive.length}`, left } });
  };
  toast('quest', plan.title, exam ? 'Продержитесь против всех волн.' : 'Победите учебных противников. ЛКМ — Искра, ПКМ — щит, Пробел — кувырок.');
  spawnWave();
  const offKill = bus.on('enemyKilled', () => {
    alive = alive.filter((uid) => engine.enemies.some((e) => e.uid === uid && !e.dead));
    if (alive.length === 0) {
      wave++;
      if (wave >= plan.waves.length) finish(true);
      else { bus.emit('sfx', { id: 'objective' }); spawnWave(); }
    } else setUI({ challenge: { title: plan.title, goal: `Волна ${wave + 1}/${plan.waves.length}: противников ${alive.length}`, left } });
  });
  const offDmg = bus.on('playerDamaged', (e) => { damage += e.amount; });
  const offFrame = engine.onFrame((dt) => {
    left -= dt;
    const c = setUI;
    if (Math.floor(left * 4) % 2 === 0) c({ challenge: { title: plan.title, goal: `Волна ${wave + 1}/${plan.waves.length}: противников ${alive.length}`, left } });
    if (left <= 0 || G().player.hp <= 0) finish(false);
  });
  function finish(win: boolean) {
    if (!active) return;
    active = false;
    offKill(); offDmg(); offFrame();
    setUI({ challenge: null });
    for (const e of engine.enemies) if (e.uniqueId === 'arena' && !e.dead) { e.dead = true; e.removed = true; }
    const maxHp = derived().maxHp;
    const timeScore = Math.max(0, left) / plan.time;
    const hpScore = 1 - Math.min(1, damage / Math.max(1, maxHp));
    const score = win ? Math.min(1, 0.45 + timeScore * 0.3 + hpScore * 0.35) : 0.2;
    if (G().player.hp <= 0) return;
    void startHp;
    finishLesson(score);
  }
}

export function arenaActive(): boolean { return active; }
