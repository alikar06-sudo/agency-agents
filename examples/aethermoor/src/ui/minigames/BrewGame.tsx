import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameProps } from './MinigameHost';
import { Result } from './MinigameHost';
import { RECIPES } from '@/data/world';
import { ITEMS } from '@/data/items';
import { Icon } from '../icons';
import { bus } from '@/core/bus';

type Step = { kind: 'add'; item: string } | { kind: 'heat'; secs: number } | { kind: 'stir'; turns: number };

const DISTRACTORS = ['ember_cap', 'marsh_mint', 'ironstone', 'wisp_light', 'moonpetal', 'sunleaf', 'spring_water', 'star_dust'];

export function BrewGame({ req, onFinish, onCancel }: GameProps) {
  const recipe = RECIPES[req.recipe ?? 'healing'];
  const diff = req.difficulty ?? 1;
  const steps = useMemo<Step[]>(() => {
    const ing: string[] = [];
    for (const i of recipe.ingredients) for (let k = 0; k < i.count; k++) ing.push(i.id);
    const s: Step[] = [{ kind: 'add', item: ing[0] }, { kind: 'heat', secs: 2 + diff * 0.5 }];
    for (const it of ing.slice(1)) s.push({ kind: 'add', item: it });
    s.push({ kind: 'stir', turns: 1 + Math.ceil(diff / 2) });
    return s;
  }, [recipe, diff]);
  const shelf = useMemo(() => {
    const set = new Set(recipe.ingredients.map((i) => i.id));
    for (const d of DISTRACTORS) { if (set.size >= 6) break; set.add(d); }
    return [...set].sort(() => Math.random() - 0.5);
  }, [recipe]);
  const [idx, setIdx] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [temp, setTemp] = useState(0.2);
  const [inZone, setInZone] = useState(0);
  const [heatPenalty, setHeatPenalty] = useState(0);
  const [stirPos, setStirPos] = useState(0);
  const [turns, setTurns] = useState(0);
  const [done, setDone] = useState<number | null>(null);
  const [bubbles, setBubbles] = useState(0);
  const bellows = useRef(false);
  const cur = steps[idx];
  const zone = [0.45, 0.62];

  useEffect(() => {
    if (cur?.kind !== 'heat') return;
    let last = performance.now();
    let raf = 0;
    let t = temp, zoneT = inZone, pen = heatPenalty;
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      t += (bellows.current ? 0.55 : -0.32) * dt + Math.sin(now / 300) * 0.05 * dt;
      t = Math.max(0, Math.min(1, t));
      if (t >= zone[0] && t <= zone[1]) zoneT += dt; else if (t > zone[1] + 0.1) pen += dt * 0.08;
      setTemp(t); setInZone(zoneT); setHeatPenalty(pen);
      if (zoneT >= cur.secs) { bus.emit('sfx', { id: 'brew' }); setIdx((i) => i + 1); return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const down = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); bellows.current = true; } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') bellows.current = false; };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx]);

  useEffect(() => {
    if (idx >= steps.length && done === null) {
      const score = Math.max(0.1, 1 - mistakes * 0.14 - heatPenalty);
      setDone(score);
      bus.emit('sfx', { id: score > 0.6 ? 'quest_done' : 'ui_error' });
    }
  }, [idx, steps.length, done, mistakes, heatPenalty]);

  const add = (item: string) => {
    if (!cur || cur.kind !== 'add') { setMistakes((m) => m + 1); bus.emit('sfx', { id: 'ui_error' }); return; }
    if (cur.item === item) { bus.emit('sfx', { id: 'splash' }); setBubbles((b) => b + 1); setIdx((i) => i + 1); }
    else { setMistakes((m) => m + 1); bus.emit('sfx', { id: 'ui_error' }); }
  };
  const stir = (q: number) => {
    if (!cur || cur.kind !== 'stir') return;
    if (q === stirPos) {
      bus.emit('sfx', { id: 'stir' });
      const next = (stirPos + 1) % 4;
      setStirPos(next);
      if (next === 0) {
        const t = turns + 1;
        setTurns(t);
        if (t >= cur.turns) setIdx((i) => i + 1);
      }
    } else { setMistakes((m) => m + 0.5); bus.emit('sfx', { id: 'ui_error' }); }
  };

  if (done !== null) return <div className="mg panel panel-frame"><Result score={done} title={req.title ?? recipe.name} onDone={() => onFinish(done)} extra={mistakes ? `ошибок: ${mistakes}` : 'без ошибок'} /></div>;

  const stepName = (s: Step) => s.kind === 'add' ? `Добавить: ${ITEMS[s.item].name}` : s.kind === 'heat' ? 'Подогреть' : `Помешать ×${s.turns}`;
  return (
    <div className="mg panel panel-frame">
      <div className="mg-head"><div className="t">{req.title ?? recipe.name}</div><button className="btn small ghost" onClick={onCancel}>Отложить</button></div>
      <div className="mg-help">Следуйте рецепту: порядок важнее состава. Жар держите в белой рамке (удерживайте «Мехи» или Пробел). Помешивайте по часовой стрелке, начиная сверху.</div>
      <div className="step-list">
        {steps.map((s, i) => <span key={i} className={'s' + (i < idx ? ' done' : i === idx ? ' cur' : '')}>{i + 1}. {stepName(s)}</span>)}
      </div>
      <div className="cauldron-view">
        <div>
          <div className="dim" style={{ marginBottom: 6 }}>Полка с ингредиентами</div>
          <div className="shelf">
            {shelf.map((id) => (
              <button key={id} className="ing" onClick={() => add(id)}>
                <Icon name={ITEMS[id].icon} color={ITEMS[id].color} size={28} />{ITEMS[id].name}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 14 }}>
            <div className="dim" style={{ marginBottom: 6 }}>Жар котла {cur?.kind === 'heat' ? `· держите ${Math.max(0, (cur.secs - inZone)).toFixed(1)} с` : ''}</div>
            <div className="gauge">
              <div className="zone" style={{ left: `${zone[0] * 100}%`, width: `${(zone[1] - zone[0]) * 100}%` }} />
              <div className="needle" style={{ left: `${temp * 100}%` }} />
            </div>
            <button className="btn" style={{ marginTop: 10 }} disabled={cur?.kind !== 'heat'}
              onPointerDown={() => { bellows.current = true; }} onPointerUp={() => { bellows.current = false; }} onPointerLeave={() => { bellows.current = false; }}>
              Мехи (удерживать)
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <svg viewBox="0 0 200 200" width="230" height="230">
            <defs><radialGradient id="brew" cx="50%" cy="40%"><stop offset="0%" stopColor="#8affa8" /><stop offset="100%" stopColor="#1a5a2a" /></radialGradient></defs>
            <ellipse cx="100" cy="120" rx="80" ry="64" fill="#1a1a1e" stroke="#4a4a52" strokeWidth="4" />
            <ellipse cx="100" cy="92" rx="70" ry="22" fill="url(#brew)" opacity={0.6 + bubbles * 0.08} />
            {[0, 1, 2, 3].map((q) => {
              const a = (q / 4) * Math.PI * 2 - Math.PI / 2;
              const x = 100 + Math.cos(a) * 52, y = 92 + Math.sin(a) * 15;
              const active = cur?.kind === 'stir';
              return <circle key={q} cx={x} cy={y} r={14} fill={active && q === stirPos ? '#e3c46b' : 'rgba(255,255,255,0.12)'} stroke="#e3c46b" strokeWidth={active ? 2 : 0.5} style={{ cursor: 'pointer' }} onClick={() => stir(q)} />;
            })}
            {Array.from({ length: 5 }).map((_, i) => <circle key={i} cx={70 + i * 15} cy={88 + (i % 2) * 6} r={3 + (i % 3)} fill="#c8ffd8" opacity={0.5}><animate attributeName="cy" values={`${92};${70};${92}`} dur={`${1 + i * 0.3}s`} repeatCount="indefinite" /></circle>)}
          </svg>
          <div className="dim">{cur?.kind === 'stir' ? `Помешано кругов: ${turns} / ${cur.turns}` : 'Котёл'}</div>
          <div className="faint">Ошибок: {mistakes}</div>
        </div>
      </div>
    </div>
  );
}
