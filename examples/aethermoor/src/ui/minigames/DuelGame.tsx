import { useEffect, useRef, useState } from 'react';
import type { GameProps } from './MinigameHost';
import { Result } from './MinigameHost';
import { NPCS } from '@/data/npcs';
import { portrait } from '../portraits';
import { G } from '@/state/store';
import { CIRCLES } from '@/data/world';
import { bus } from '@/core/bus';

// Дуэль на тайминге: противник плетёт заклинание — отвечаете нужной контрмагией в нужный миг, затем ваш удар.
const ATTACKS = [
  { id: 'fire', name: 'Огненный шар', color: '#ff7a3a', counter: 'Q', counterName: 'Иней' },
  { id: 'frost', name: 'Ледяной шип', color: '#8ad8ff', counter: 'W', counterName: 'Пламя' },
  { id: 'storm', name: 'Молния', color: '#c8c0ff', counter: 'E', counterName: 'Щит' },
];

type Phase = 'enemy' | 'player' | 'gap';

export function DuelGame({ req, onFinish, onCancel }: GameProps) {
  const diff = req.difficulty ?? 2;
  const opp = req.opponent && NPCS[req.opponent] ? NPCS[req.opponent] : null;
  const oppName = opp?.name ?? 'Тренировочный голем';
  const [php, setPhp] = useState(100);
  const [ohp, setOhp] = useState(80 + diff * 15);
  const omax = useRef(80 + diff * 15);
  const [phase, setPhase] = useState<Phase>('gap');
  const [atk, setAtk] = useState(ATTACKS[0]);
  const [ring, setRing] = useState(1);
  const [needle, setNeedle] = useState(0);
  const [msg, setMsg] = useState('Приготовьтесь…');
  const [done, setDone] = useState<number | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const resolved = useRef(false);
  const t0 = useRef(0);
  const dur = 1.6 - diff * 0.18;

  const startEnemy = () => {
    const a = ATTACKS[Math.floor(Math.random() * ATTACKS.length)];
    setAtk(a); setPhase('enemy'); resolved.current = false; t0.current = performance.now();
    setMsg(`${oppName.split(' ')[0]} плетёт «${a.name}»!`);
    bus.emit('sfx', { id: 'enemy_cast' });
  };
  useEffect(() => { const t = setTimeout(startEnemy, 900); return () => clearTimeout(t); }, []);

  useEffect(() => {
    if (done !== null) return;
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const el = (performance.now() - t0.current) / 1000;
      if (phase === 'enemy') {
        const r = Math.max(0, 1 - el / dur);
        setRing(r);
        if (r <= 0 && !resolved.current) { resolved.current = true; hit(false, 'Не успели!'); }
      } else if (phase === 'player') {
        setNeedle((Math.sin(el * (2.4 + diff * 0.4)) + 1) / 2);
        if (el > 6 && !resolved.current) { resolved.current = true; strike(0.3); }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  const hit = (blocked: boolean, text: string, reflect = false) => {
    if (blocked) {
      if (reflect) { setOhp((h) => Math.max(0, h - 12)); setFlash('reflect'); bus.emit('sfx', { id: 'parry' }); }
      else { bus.emit('sfx', { id: 'shield_block' }); setFlash('block'); }
    } else {
      const dmg = 14 + diff * 3;
      setPhp((h) => Math.max(0, h - dmg));
      setFlash('hurt'); bus.emit('sfx', { id: 'player_hurt' });
    }
    setMsg(text);
    setTimeout(() => setFlash(null), 300);
    setTimeout(() => { setPhase('player'); resolved.current = false; t0.current = performance.now(); setMsg('Ваш ход! Пробел — когда стрелка в золотой зоне.'); }, 700);
  };

  const strike = (q: number) => {
    const dmg = Math.round(8 + q * 22);
    setOhp((h) => Math.max(0, h - dmg));
    bus.emit('sfx', { id: q > 0.8 ? 'hit_crit' : 'spark' });
    setMsg(q > 0.8 ? `Точный удар! −${dmg}` : `Удар: −${dmg}`);
    setPhase('gap');
    setTimeout(() => startEnemy(), 900);
  };

  const counter = (key: string) => {
    if (phase !== 'enemy' || resolved.current) return;
    resolved.current = true;
    const el = (performance.now() - t0.current) / 1000;
    const r = 1 - el / dur;
    if (key !== atk.counter) { hit(false, `Не та контрмагия! Против «${atk.name}» — ${atk.counterName}.`); return; }
    if (r < 0.18) hit(true, 'Идеально! Заклинание отражено!', true);
    else if (r < 0.45) hit(true, 'Блок!');
    else hit(false, 'Слишком рано!');
  };

  useEffect(() => {
    if (done !== null) return;
    if (ohp <= 0) { setDone(Math.min(1, 0.55 + php / 220)); bus.emit('sfx', { id: 'quest_done' }); }
    else if (php <= 0) { setDone(0.2); bus.emit('sfx', { id: 'death' }); }
  }, [ohp, php, done]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['KeyQ', 'KeyW', 'KeyE'].includes(e.code)) { e.preventDefault(); counter(e.code.slice(3)); }
      if (e.code === 'Space') {
        e.preventDefault();
        if (phase === 'player' && !resolved.current) {
          resolved.current = true;
          const dist = Math.abs(needle - 0.5);
          strike(Math.max(0, 1 - dist * 4));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (done !== null) return <div className="mg panel panel-frame"><Result score={done} title={(done > 0.4 ? 'Победа над: ' : 'Поражение от: ') + oppName} onDone={() => onFinish(done)} /></div>;
  const g = G();
  const me = portrait('player_' + JSON.stringify(g.player.appearance) + g.player.circle, { ...g.player.appearance, trim: CIRCLES[g.player.circle].trim });
  return (
    <div className="mg panel panel-frame">
      <div className="mg-head"><div className="t">{req.title ?? 'Дуэль'}</div><button className="btn small ghost" onClick={onCancel}>Отказаться</button></div>
      <div className="mg-help">Когда противник плетёт заклинание, нажмите контрмагию, пока сжимающееся кольцо почти коснулось руны: <span className="kbd">Q</span> Иней против огня, <span className="kbd">W</span> Пламя против льда, <span className="kbd">E</span> Щит против молнии. В свой ход жмите <span className="kbd">Пробел</span> в золотой зоне.</div>
      <div className="duel-arena" style={{ boxShadow: flash === 'hurt' ? 'inset 0 0 60px rgba(255,60,40,0.6)' : flash === 'reflect' ? 'inset 0 0 60px rgba(255,220,120,0.6)' : undefined }}>
        <div className="duel-fighter" style={{ left: 40 }}>
          <div className="rel-face" style={{ width: 90, height: 90, margin: '0 auto' }}>{me && <img src={me} alt="" />}</div>
          <div>{g.player.name}</div>
          <div className="hpb"><div style={{ width: `${php}%` }} /></div>
        </div>
        <div className="duel-fighter" style={{ right: 40 }}>
          <div className="rel-face" style={{ width: 90, height: 90, margin: '0 auto', position: 'relative' }}>{opp ? <img src={portrait('npc_' + opp.id, opp.appearance)} alt="" /> : '◆'}</div>
          <div>{oppName}</div>
          <div className="hpb"><div style={{ width: `${(ohp / omax.current) * 100}%` }} /></div>
        </div>
        {phase === 'enemy' && (
          <div style={{ position: 'absolute', left: '50%', top: '42%', transform: 'translate(-50%, -50%)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: atk.color, boxShadow: `0 0 24px ${atk.color}` }} />
            <div className="duel-ring" style={{ width: 40 + ring * 160, height: 40 + ring * 160, left: 20 - (40 + ring * 160) / 2, top: 20 - (40 + ring * 160) / 2, borderColor: ring < 0.18 ? '#ffd86a' : atk.color }} />
          </div>
        )}
        {phase === 'player' && (
          <div style={{ position: 'absolute', left: '20%', right: '20%', top: '45%', height: 18, borderRadius: 9, background: 'linear-gradient(90deg,#2a2438 0%,#2a2438 38%,#e3c46b 45%,#ffe9a0 50%,#e3c46b 55%,#2a2438 62%,#2a2438 100%)', border: '1px solid rgba(227,196,107,0.5)' }}>
            <div style={{ position: 'absolute', top: -6, bottom: -6, width: 4, background: '#fff', left: `${needle * 100}%`, boxShadow: '0 0 8px #fff' }} />
          </div>
        )}
        <div style={{ position: 'absolute', top: 14, left: 0, right: 0, textAlign: 'center' }} className="title-font gold">{msg}</div>
      </div>
      <div className="duel-keys">
        {ATTACKS.map((a) => <button key={a.id} className="btn" style={{ borderColor: a.color }} onClick={() => counter(a.counter)}><span className="kbd">{a.counter}</span> {a.counterName}</button>)}
        <button className="btn primary" onClick={() => { if (phase === 'player' && !resolved.current) { resolved.current = true; strike(Math.max(0, 1 - Math.abs(needle - 0.5) * 4)); } }}><span className="kbd">Пробел</span> Удар</button>
      </div>
    </div>
  );
}
