import { useState } from 'react';
import { useGame, mutate } from '@/state/store';
import { SPELLS, SPELL_ORDER, COMBOS, SCHOOL_NAMES, ELEMENT_NAMES } from '@/data/spells';
import { SpellGlyph, hex } from '../icons';
import { derived } from '@/systems/player';
import { bus } from '@/core/bus';

export function SpellsTab() {
  const known = useGame((s) => s.g!.spells.known);
  const slots = useGame((s) => s.g!.spells.slots);
  const combos = useGame((s) => s.g!.spells.combos);
  const level = useGame((s) => s.g!.player.level);
  const [sel, setSel] = useState<string | null>(known[0] ?? null);
  const sp = sel ? SPELLS[sel] : null;
  const power = derived().spellPower;
  const assign = (slot: number) => {
    if (!sel || sel === 'spark') return;
    mutate((g) => {
      const prev = g.spells.slots.indexOf(sel);
      if (prev >= 0) g.spells.slots[prev] = g.spells.slots[slot];
      g.spells.slots[slot] = sel;
    });
    bus.emit('sfx', { id: 'ui_confirm' });
  };
  return (
    <div className="cols side-r">
      <div className="col scroll">
        <div className="dim" style={{ fontSize: 14 }}>Выберите заклинание и нажмите на ячейку 1–6, чтобы поставить его на панель. Искра всегда на ЛКМ, Щит — на ПКМ.</div>
        <div className="slots-row">
          {slots.map((s, i) => (
            <div key={i} className={'slot' + (s ? '' : ' empty')} onClick={() => assign(i)} title={s ? SPELLS[s].name : 'Пусто'}>
              <span className="key">{i + 1}</span>
              {s && <SpellGlyph id={s} color={hex(SPELLS[s].color)} size={30} />}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {SPELL_ORDER.map((id) => {
            const s = SPELLS[id];
            const k = known.includes(id);
            if (!k && s.school === 'secret') return (
              <div key={id} className="list-item" style={{ opacity: 0.45 }}>
                <div className="spell-icon" style={{ width: 40, height: 40 }}>?</div>
                <div><div className="t">Тайное заклинание</div><div className="s">{s.acquire}</div></div>
              </div>
            );
            return (
              <div key={id} className={'list-item' + (sel === id ? ' on' : '')} style={{ opacity: k ? 1 : 0.5 }} onClick={() => setSel(id)}>
                <div className="spell-icon" style={{ width: 40, height: 40, borderColor: hex(s.color) + '66' }}><SpellGlyph id={id} color={k ? hex(s.color) : '#6a6058'} size={24} /></div>
                <div style={{ flex: 1 }}>
                  <div className="t">{s.name} <span className="faint" style={{ fontSize: 13, fontStyle: 'italic' }}>«{s.incantation}»</span></div>
                  <div className="s">{SCHOOL_NAMES[s.school]} · {ELEMENT_NAMES[s.element]}{!k ? ' · не изучено' : ''}</div>
                </div>
                {slots.includes(id) && <span className="chip">{slots.indexOf(id) + 1}</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className="col card scroll">
        {sp && (
          <>
            <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <div className="spell-icon" style={{ width: 64, height: 64, borderColor: hex(sp.color) }}><SpellGlyph id={sp.id} color={hex(sp.color)} size={40} /></div>
              <div>
                <div className="h3" style={{ margin: 0 }}>{sp.name}</div>
                <div className="dim" style={{ fontStyle: 'italic' }}>«{sp.incantation}»</div>
              </div>
            </div>
            <p style={{ lineHeight: 1.5 }}>{sp.desc}</p>
            {sp.world && <p className="dim" style={{ lineHeight: 1.5 }}><b className="gold">В мире:</b> {sp.world}</p>}
            <div className="kv">
              <div className="k">Школа</div><div className="v">{SCHOOL_NAMES[sp.school]}</div>
              <div className="k">Стихия</div><div className="v">{ELEMENT_NAMES[sp.element]}</div>
              <div className="k">Стоимость</div><div className="v">{sp.cost} маны</div>
              <div className="k">Перезарядка</div><div className="v">{(sp.cooldown * derived().cdMult).toFixed(1)} с</div>
              {sp.damage ? <><div className="k">{sp.school === 'heal' ? 'Лечение' : 'Урон'}</div><div className="v">≈ {Math.round(sp.damage * power)}</div></> : null}
              <div className="k">Требуемый уровень</div><div className="v" style={{ color: level >= sp.level ? undefined : '#e08a7a' }}>{sp.level}</div>
            </div>
            <div className="faint" style={{ fontSize: 13, marginTop: 10 }}>Как получить: {sp.acquire}</div>
          </>
        )}
        <div className="divider">Резонансы</div>
        {COMBOS.map((c) => {
          const found = combos.includes(c.id);
          return (
            <div key={c.id} style={{ padding: '6px 0', opacity: found ? 1 : 0.55 }}>
              <div className="title-font" style={{ fontSize: 18, color: found ? hex(c.color) : undefined }}>{found ? c.name : 'Неоткрытый резонанс'}</div>
              <div className="faint" style={{ fontSize: 13 }}>{found ? c.desc : 'Подсказка: сочетайте стихии. Наставники на практике и теории расскажут больше.'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
