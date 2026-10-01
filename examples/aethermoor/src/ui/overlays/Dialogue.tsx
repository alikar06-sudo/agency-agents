import { useEffect, useMemo, useState } from 'react';
import { useUI, useSettings, G } from '@/state/store';
import { currentNode, choicesFor, choose, advance, endDialogue, speakerName } from '@/systems/dialogue';
import { fmt } from '@/systems/logic';
import { NPCS } from '@/data/npcs';
import { CIRCLES } from '@/data/world';
import { portrait } from '../portraits';
import { bus } from '@/core/bus';

export function Dialogue() {
  const d = useUI((s) => s.dialogue);
  const speed = useSettings((s) => s.textSpeed);
  const cur = d ? currentNode() : null;
  const text = cur ? fmt(cur.node.text) : '';
  const [shown, setShown] = useState(0);
  const done = speed === 0 || shown >= text.length;

  useEffect(() => { setShown(speed === 0 ? text.length : 0); }, [d?.key, text, speed]);
  useEffect(() => {
    if (done) return;
    const step = Math.max(1, Math.round(speed / 30));
    const t = setInterval(() => {
      setShown((n) => {
        const nn = Math.min(text.length, n + step);
        if (nn % 6 === 0) bus.emit('sfx', { id: 'blip', volume: 0.4 });
        return nn;
      });
    }, 33);
    return () => clearInterval(t);
  }, [done, text, speed]);

  const choices = useMemo(() => (cur ? choicesFor(cur.node) : []), [cur?.id, d?.key]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!d) return;
      if (e.code === 'Escape') { e.stopPropagation(); endDialogue(); return; }
      if (!done && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) { setShown(text.length); return; }
      if (done && !choices.length && (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE')) { advance(); return; }
      const n = Number(e.key);
      if (done && n >= 1 && n <= choices.length) {
        const c = choices[n - 1];
        if (c.enabled) choose(c.index);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [d, done, choices, text]);

  if (!d || !cur) return null;
  const sp = cur.node.speaker ?? d.npc;
  const npc = sp ? NPCS[sp] : undefined;
  const isPlayer = sp === 'player';
  const g = G();
  const face = npc ? portrait('npc_' + npc.id, npc.appearance) : isPlayer ? portrait('player_' + JSON.stringify(g.player.appearance) + g.player.circle, { ...g.player.appearance, trim: CIRCLES[g.player.circle].trim }) : '';
  const name = speakerName(sp);
  const narr = !name;

  return (
    <div className="dialogue">
      <div className="box panel panel-frame">
        <div className="face">{face ? <img src={face} alt="" /> : sp === 'hollow' ? '◉' : sp === 'mirror' ? '✦' : '❧'}</div>
        <div>
          {!narr && <div className="who">{name}{npc && <small>{npc.title}</small>}</div>}
          <div className={'text' + (narr ? ' narr' : '')} onClick={() => setShown(text.length)}>{text.slice(0, shown)}</div>
          {done && choices.length > 0 && (
            <div className="choices">
              {choices.map((c, i) => (
                <button key={c.index} className="choice" disabled={!c.enabled} onClick={() => choose(c.index)} onMouseEnter={() => bus.emit('sfx', { id: 'ui_hover' })}>
                  <span className="n">{i + 1}.</span>
                  {c.tag && <span className="tag">{c.tag}</span>}
                  <span>{c.text}</span>
                  {!c.enabled && c.reason && <span className="why">{c.reason}</span>}
                </button>
              ))}
            </div>
          )}
          {(!done || !choices.length) && (
            <div className="continue" onClick={() => (done ? advance() : setShown(text.length))}>
              {done ? (cur.node.next ? 'Далее' : 'Завершить') : 'Пропустить'} <span className="kbd">Пробел</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
