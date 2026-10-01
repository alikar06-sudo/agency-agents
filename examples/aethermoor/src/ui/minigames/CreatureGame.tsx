import { useEffect, useState } from 'react';
import type { GameProps } from './MinigameHost';
import { Result } from './MinigameHost';
import { bus } from '@/core/bus';

// Магические существа: огоньки отвечают на мелодию. Повторите её — и они успокоятся.
const STONES = [{ c: '#ff8a5a', n: 'note0' }, { c: '#8ad8ff', n: 'note1' }, { c: '#9aff8a', n: 'note2' }, { c: '#e0a0ff', n: 'note3' }];

export function CreatureGame({ req, onFinish, onCancel }: GameProps) {
  const diff = req.difficulty ?? 1;
  const target = 4 + diff;
  const [seq, setSeq] = useState<number[]>(() => [Math.floor(Math.random() * 4), Math.floor(Math.random() * 4)]);
  const [playing, setPlaying] = useState(true);
  const [lit, setLit] = useState<number | null>(null);
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState<number | null>(null);
  const [mood, setMood] = useState('Огонёк настороженно мерцает…');
  useEffect(() => {
    setPlaying(true);
    let i = 0;
    const iv = setInterval(() => {
      if (i >= seq.length) { clearInterval(iv); setLit(null); setPlaying(false); setPos(0); return; }
      const s = seq[i];
      setLit(s);
      bus.emit('sfx', { id: STONES[s].n });
      setTimeout(() => setLit(null), 380);
      i++;
    }, 650 - diff * 40);
    return () => clearInterval(iv);
  }, [seq, diff]);
  const press = (k: number) => {
    if (playing || done !== null) return;
    setLit(k);
    bus.emit('sfx', { id: STONES[k].n });
    setTimeout(() => setLit(null), 200);
    if (seq[pos] !== k) {
      setMood('Огонёк испуганно вспыхнул и отпрянул!');
      bus.emit('sfx', { id: 'ui_error' });
      setDone(Math.max(0.2, (seq.length - 2) / (target - 1)));
      return;
    }
    if (pos + 1 === seq.length) {
      if (seq.length >= target) { setMood('Огонёк мурлычет светом и садится вам на ладонь.'); setDone(1); return; }
      setMood(['Огонёк прислушивается…', 'Он подлетает ближе…', 'Свет становится тёплым…', 'Почти доверился…'][Math.min(3, seq.length - 2)]);
      setTimeout(() => setSeq([...seq, Math.floor(Math.random() * 4)]), 500);
    } else setPos(pos + 1);
  };
  if (done !== null) return <div className="mg panel panel-frame"><Result score={done} title={req.title ?? 'Магические существа'} onDone={() => onFinish(done)} extra={mood} /></div>;
  return (
    <div className="mg panel panel-frame" style={{ width: 'min(520px, calc(100vw - 24px))', alignItems: 'center' }}>
      <div className="mg-head" style={{ width: '100%' }}><div className="t">{req.title ?? 'Песня огоньков'}</div><div className="dim">Мелодия: {seq.length}/{target}</div></div>
      <div className="mg-help">{playing ? 'Слушайте и смотрите…' : 'Повторите мелодию, касаясь камней.'} <i>{mood}</i></div>
      <div className="simon">
        {STONES.map((s, k) => <button key={k} className={lit === k ? 'lit' : ''} style={{ background: s.c, color: s.c }} onClick={() => press(k)} />)}
      </div>
      <button className="btn small ghost" onClick={onCancel}>Уйти</button>
    </div>
  );
}
