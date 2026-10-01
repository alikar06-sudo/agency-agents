import { useEffect, useMemo, useState } from 'react';
import type { GameProps } from './MinigameHost';
import { Result } from './MinigameHost';
import { bus } from '@/core/bus';

// Трансформация: запомните глиф и воспроизведите его по точкам.
function makePattern(n: number, len: number): number[] {
  const p: number[] = [Math.floor(Math.random() * n * n)];
  while (p.length < len) {
    const c = p[p.length - 1];
    const x = c % n, y = Math.floor(c / n);
    const opts: number[] = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if ((dx || dy) && nx >= 0 && ny >= 0 && nx < n && ny < n && !p.includes(ny * n + nx)) opts.push(ny * n + nx);
    }
    if (!opts.length) break;
    p.push(opts[Math.floor(Math.random() * opts.length)]);
  }
  return p;
}

export function GlyphGame({ req, onFinish, onCancel }: GameProps) {
  const diff = req.difficulty ?? 1;
  const n = diff >= 3 ? 4 : 3;
  const rounds = 3;
  const [round, setRound] = useState(0);
  const pattern = useMemo(() => makePattern(n, 3 + diff + round), [n, diff, round]);
  const [show, setShow] = useState(true);
  const [input, setInput] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState<number | null>(null);
  const [fail, setFail] = useState(false);
  useEffect(() => { setShow(true); setInput([]); setFail(false); const t = setTimeout(() => setShow(false), 1600 + pattern.length * 350); return () => clearTimeout(t); }, [pattern]);
  const tap = (i: number) => {
    if (show || done !== null || fail) return;
    const next = [...input, i];
    bus.emit('sfx', { id: 'rune', pitch: 0.8 + next.length * 0.1 });
    if (pattern[next.length - 1] !== i) {
      setFail(true);
      bus.emit('sfx', { id: 'ui_error' });
      setTimeout(() => advance(false), 900);
      setInput(next);
      return;
    }
    setInput(next);
    if (next.length === pattern.length) { bus.emit('sfx', { id: 'rune_ok' }); setTimeout(() => advance(true), 600); }
  };
  const advance = (ok: boolean) => {
    const s = score + (ok ? 1 : 0);
    setScore(s);
    if (round + 1 >= rounds) setDone(Math.max(0.15, s / rounds));
    else setRound(round + 1);
  };
  if (done !== null) return <div className="mg panel panel-frame"><Result score={done} title={req.title ?? 'Трансформация'} onDone={() => onFinish(done)} extra={`глифов верно: ${score} из ${rounds}`} /></div>;
  const S = 300, gap = S / (n + 1);
  const pos = (i: number) => [gap * ((i % n) + 1), gap * (Math.floor(i / n) + 1)];
  const seq = show ? pattern : input;
  return (
    <div className="mg panel panel-frame" style={{ width: 'min(560px, calc(100vw - 24px))' }}>
      <div className="mg-head"><div className="t">{req.title ?? 'Трансформация'}</div><div className="dim">Глиф {round + 1} из {rounds}</div></div>
      <div className="mg-help">{show ? 'Запоминайте глиф формы…' : 'Повторите глиф: нажимайте точки в том же порядке.'}</div>
      <div className="mg-stage">
        <svg className="glyph-board" viewBox={`0 0 ${S} ${S}`} width={S} height={S}>
          <rect x="0" y="0" width={S} height={S} rx="16" fill="rgba(0,0,0,0.35)" stroke="rgba(227,196,107,0.3)" />
          {seq.length > 1 && <polyline points={seq.map((i) => pos(i).join(',')).join(' ')} fill="none" stroke={fail ? '#e06a5a' : '#ffd86a'} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 0 6px #ffb000)' }} />}
          {Array.from({ length: n * n }).map((_, i) => {
            const [x, y] = pos(i);
            const on = seq.includes(i);
            return <circle key={i} cx={x} cy={y} r={on ? 16 : 13} fill={on ? '#ffd86a' : '#2a2438'} stroke="#e3c46b" strokeWidth="2" style={{ cursor: 'pointer' }} onClick={() => tap(i)} />;
          })}
        </svg>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn small ghost" onClick={onCancel}>Уйти</button></div>
    </div>
  );
}
