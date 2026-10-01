import { useRef, useState } from 'react';
import { input } from '@/core/input';
import type { Action } from '@/core/input';
import { useGame, setUI } from '@/state/store';
import { SPELLS } from '@/data/spells';
import { SpellGlyph, hex } from '../icons';
import { engine } from '@/engine/Engine';

export function TouchControls() {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const slots = useGame((s) => s.g!.spells.slots);
  const onMove = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    setKnob({ x, y });
    input.touch.active = true;
    input.touch.moveX = Math.abs(x) > 0.15 ? x : 0;
    input.touch.moveY = Math.abs(y) > 0.15 ? y : 0;
  };
  const end = () => { setKnob({ x: 0, y: 0 }); input.touch.moveX = 0; input.touch.moveY = 0; };
  const hold = (a: Action) => ({
    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); input.touch.active = true; input.hold(a, true); input.press(a); },
    onPointerUp: () => input.hold(a, false),
    onPointerLeave: () => input.hold(a, false),
  });
  return (
    <div className="touch">
      <div className="joy" ref={base} onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); onMove(e); }} onPointerMove={(e) => { if (e.buttons || e.pointerType === 'touch') onMove(e); }} onPointerUp={end} onPointerCancel={end}>
        <div className="knob" style={{ transform: `translate(${knob.x * 40}px, ${knob.y * 40}px)` }} />
      </div>
      <div className="tbtns">
        {slots.slice(0, 3).map((s, i) => (
          <button key={i} className="tbtn" onPointerDown={(e) => { e.preventDefault(); input.touch.active = true; if (s) engine.combat.castSpell(s); }}>
            {s ? <SpellGlyph id={s} color={hex(SPELLS[s].color)} size={24} /> : i + 1}
          </button>
        ))}
        <button className="tbtn" {...hold('shield')}>Щит</button>
        <button className="tbtn big" {...hold('attack')}>Искра</button>
        <button className="tbtn" {...hold('dodge')}>Кувырок</button>
        <button className="tbtn" onPointerDown={() => engine.useNearest()}>E</button>
        <button className="tbtn" onPointerDown={() => input.press('potion')}>Зелье</button>
        <button className="tbtn" onPointerDown={() => setUI({ menu: 'inventory' })}>Сумка</button>
      </div>
    </div>
  );
}
