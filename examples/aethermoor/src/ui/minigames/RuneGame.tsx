import { useEffect, useMemo, useState } from 'react';
import type { GameProps } from './MinigameHost';
import { Result } from './MinigameHost';
import { bus } from '@/core/bus';

// Плитки — биты соединений: 1=север, 2=восток, 4=юг, 8=запад
const rot = (m: number) => ((m << 1) | (m >> 3)) & 15;

function generate(n: number): { masks: number[]; src: number } {
  const masks = new Array(n * n).fill(0);
  const src = Math.floor(n / 2) * n + Math.floor(n / 2);
  const seen = new Set([src]);
  const stack = [src];
  while (stack.length) {
    const c = stack[stack.length - 1];
    const x = c % n, y = Math.floor(c / n);
    const nb: [number, number, number][] = [];
    if (y > 0 && !seen.has(c - n)) nb.push([c - n, 1, 4]);
    if (x < n - 1 && !seen.has(c + 1)) nb.push([c + 1, 2, 8]);
    if (y < n - 1 && !seen.has(c + n)) nb.push([c + n, 4, 1]);
    if (x > 0 && !seen.has(c - 1)) nb.push([c - 1, 8, 2]);
    if (!nb.length) { stack.pop(); continue; }
    const [to, a, b] = nb[Math.floor(Math.random() * nb.length)];
    masks[c] |= a; masks[to] |= b;
    seen.add(to); stack.push(to);
  }
  return { masks, src };
}

function powered(masks: number[], n: number, src: number): Set<number> {
  const on = new Set([src]);
  const q = [src];
  while (q.length) {
    const c = q.shift()!;
    const x = c % n, y = Math.floor(c / n), m = masks[c];
    const tryGo = (to: number, need: number, back: number) => { if (!on.has(to) && (m & need) && (masks[to] & back)) { on.add(to); q.push(to); } };
    if (y > 0) tryGo(c - n, 1, 4);
    if (x < n - 1) tryGo(c + 1, 2, 8);
    if (y < n - 1) tryGo(c + n, 4, 1);
    if (x > 0) tryGo(c - 1, 8, 2);
  }
  return on;
}

export function RuneGame({ req, onFinish, onCancel }: GameProps) {
  const diff = req.difficulty ?? 1;
  const n = Math.min(7, 3 + Math.ceil(diff / 1.5));
  const limit = 50 + n * n * 3;
  const puzzle = useMemo(() => generate(n), [n]);
  const [masks, setMasks] = useState(() => puzzle.masks.map((m, i) => { if (i === puzzle.src) return m; let r = m; const k = 1 + Math.floor(Math.random() * 3); for (let j = 0; j < k; j++) r = rot(r); return r; }));
  const [clicks, setClicks] = useState(0);
  const [left, setLeft] = useState(limit);
  const [done, setDone] = useState<number | null>(null);
  const on = powered(masks, n, puzzle.src);
  const leaves = puzzle.masks.map((m, i) => (i !== puzzle.src && [1, 2, 4, 8].includes(m) ? i : -1)).filter((i) => i >= 0);
  const solved = on.size === n * n;

  useEffect(() => {
    if (done !== null) return;
    if (solved) {
      bus.emit('sfx', { id: 'rune_ok' });
      setDone(Math.min(1, 0.5 + (left / limit) * 0.5));
      return;
    }
    const t = setInterval(() => setLeft((l) => { if (l <= 1) { clearInterval(t); setDone(0.25); return 0; } return l - 1; }), 1000);
    return () => clearInterval(t);
  }, [solved, done, left, limit]);

  if (done !== null) return <div className="mg panel panel-frame"><Result score={done} title={req.title ?? 'Руническая печать'} onDone={() => onFinish(done)} extra={`поворотов: ${clicks}`} /></div>;
  const size = n > 5 ? 52 : 64;
  return (
    <div className="mg panel panel-frame" style={{ width: 'min(720px, calc(100vw - 24px))' }}>
      <div className="mg-head"><div className="t">{req.title ?? 'Руническая печать'}</div><div className="dim">⏳ {left} с · {on.size}/{n * n}</div></div>
      <div className="mg-help">Поворачивайте плитки (клик), чтобы Эфир из центрального узла дошёл до каждой руны. Узел в центре неподвижен. Горящие линии — уже под напряжением.</div>
      <div className="mg-stage">
        <div className="rune-grid" style={{ gridTemplateColumns: `repeat(${n}, ${size}px)` }}>
          {masks.map((m, i) => {
            const lit = on.has(i);
            const color = lit ? '#ffd86a' : '#5a5068';
            const isLeaf = leaves.includes(i);
            return (
              <div key={i} className="rune-cell" style={{ width: size, height: size }} onClick={() => {
                if (i === puzzle.src) return;
                setMasks((ms) => ms.map((x, j) => (j === i ? rot(x) : x)));
                setClicks((c) => c + 1);
                bus.emit('sfx', { id: 'rune', pitch: 0.8 + Math.random() * 0.4 });
              }}>
                <svg viewBox="0 0 64 64">
                  {m & 1 ? <line x1="32" y1="32" x2="32" y2="0" stroke={color} strokeWidth="7" strokeLinecap="round" /> : null}
                  {m & 2 ? <line x1="32" y1="32" x2="64" y2="32" stroke={color} strokeWidth="7" strokeLinecap="round" /> : null}
                  {m & 4 ? <line x1="32" y1="32" x2="32" y2="64" stroke={color} strokeWidth="7" strokeLinecap="round" /> : null}
                  {m & 8 ? <line x1="32" y1="32" x2="0" y2="32" stroke={color} strokeWidth="7" strokeLinecap="round" /> : null}
                  {i === puzzle.src && <circle cx="32" cy="32" r="14" fill="#ffd86a" style={{ filter: 'drop-shadow(0 0 8px #ffb000)' }} />}
                  {isLeaf && <circle cx="32" cy="32" r="10" fill={lit ? '#9ad8ff' : '#2a2438'} stroke={lit ? '#e8f8ff' : '#6a5a7a'} strokeWidth="2" style={lit ? { filter: 'drop-shadow(0 0 6px #6ab8ff)' } : undefined} />}
                  {!isLeaf && i !== puzzle.src && <circle cx="32" cy="32" r="5" fill={color} />}
                </svg>
              </div>
            );
          })}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn small ghost" onClick={onCancel}>Сдаться</button></div>
    </div>
  );
}
