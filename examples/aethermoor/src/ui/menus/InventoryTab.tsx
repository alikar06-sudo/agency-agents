import { useState } from 'react';
import { useGame } from '@/state/store';
import { ITEMS, CATEGORY_NAMES, SLOT_NAMES } from '@/data/items';
import { RARITY } from '@/data/world';
import { equip, unequip, useItem, dropItem, isEquipped, setQuickItem, INVENTORY_LIMIT } from '@/systems/inventory';
import type { EquipSlot, ItemCategory, StatBlock } from '@/data/types';
import { Icon } from '../icons';

const STAT_LABELS: Record<string, string> = { int: 'Интеллект', power: 'Сила магии', defense: 'Защита', speed: 'Скорость', hp: 'Здоровье', mana: 'Мана', hpRegen: 'Восст. здоровья', manaRegen: 'Восст. маны', spellPower: 'Сила заклинаний %', crit: 'Крит. шанс %' };

function statLines(s?: StatBlock) {
  if (!s) return null;
  return Object.entries(s).map(([k, v]) => <div key={k} className="stat-line">+{v} {STAT_LABELS[k] ?? k}</div>);
}

export function InventoryTab() {
  const inv = useGame((s) => s.g!.inventory);
  const eq = useGame((s) => s.g!.equipment);
  const quick = useGame((s) => s.g!.quickItem);
  const gold = useGame((s) => s.g!.player.gold);
  const [cat, setCat] = useState<ItemCategory | 'all'>('all');
  const [sel, setSel] = useState<string | null>(null);
  const items = inv.filter((i) => cat === 'all' || ITEMS[i.id]?.category === cat);
  const cur = inv.find((i) => i.uid === sel);
  const def = cur ? ITEMS[cur.id] : null;
  const equippedSame = def?.slot ? inv.find((i) => i.uid === eq[def.slot!]) : null;
  const cats = Array.from(new Set(inv.map((i) => ITEMS[i.id]?.category))).filter(Boolean) as ItemCategory[];
  return (
    <div className="cols side-r">
      <div className="col">
        <div className="equip-slots">
          {(Object.keys(SLOT_NAMES) as EquipSlot[]).map((s) => {
            const it = inv.find((i) => i.uid === eq[s]);
            const d = it ? ITEMS[it.id] : null;
            return (
              <div key={s} className={'equip-slot' + (d ? ' filled' : '')} onClick={() => it && setSel(it.uid)} title={d?.name}>
                <div>{SLOT_NAMES[s]}</div>
                {d ? <Icon name={d.icon} color={d.color} size={30} /> : <Icon name={s === 'wand' ? 'wand' : s === 'robe' ? 'robe' : s === 'hat' ? 'hat' : s} color="#4a4038" size={30} />}
                <div style={{ fontSize: 11, color: d ? RARITY[d.rarity].color : undefined }}>{d?.name ?? '—'}</div>
              </div>
            );
          })}
        </div>
        <div className="filters">
          <button className={cat === 'all' ? 'on' : ''} onClick={() => setCat('all')}>Всё ({inv.length}/{INVENTORY_LIMIT})</button>
          {cats.map((c) => <button key={c} className={cat === c ? 'on' : ''} onClick={() => setCat(c)}>{CATEGORY_NAMES[c]}</button>)}
          <span className="gold-amount" style={{ marginLeft: 'auto', fontSize: 18 }}>◈ {gold}</span>
        </div>
        <div className="inv-grid scroll" style={{ flex: 1, minHeight: 0 }}>
          {items.map((i) => {
            const d = ITEMS[i.id];
            if (!d) return null;
            return (
              <div key={i.uid} className={`inv-cell rar-${d.rarity}` + (sel === i.uid ? ' on' : '')} onClick={() => setSel(i.uid)} onDoubleClick={() => (d.slot ? (isEquipped(i.uid) ? unequip(d.slot) : equip(i.uid)) : d.use ? useItem(i.uid) : null)} title={d.name}>
                <Icon name={d.icon} color={d.color} size={30} />
                {i.qty > 1 && <span className="q">{i.qty}</span>}
                {isEquipped(i.uid) && <span className="eq">✦</span>}
                {quick === i.id && <span className="eq" style={{ left: 'auto', right: 4 }}>Q</span>}
              </div>
            );
          })}
          {!items.length && <div className="faint">Пусто.</div>}
        </div>
      </div>
      <div className="col card item-detail scroll">
        {!def && <div className="faint">Выберите предмет, чтобы рассмотреть его. Двойной клик — надеть или использовать.</div>}
        {def && cur && (
          <>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div className={'inv-cell rar-' + def.rarity} style={{ width: 64, height: 64 }}><Icon name={def.icon} color={def.color} size={36} /></div>
              <div>
                <div className="nm" style={{ color: RARITY[def.rarity].color }}>{def.name}</div>
                <div className="rar" style={{ color: RARITY[def.rarity].color }}>{RARITY[def.rarity].name} · {CATEGORY_NAMES[def.category]}{def.slot ? ` · ${SLOT_NAMES[def.slot]}` : ''}</div>
              </div>
            </div>
            <div className="desc">{def.desc}</div>
            {statLines(def.stats)}
            {equippedSame && equippedSame.uid !== cur.uid && (
              <div className="faint" style={{ fontSize: 13, marginTop: 6 }}>Сейчас надето: {ITEMS[equippedSame.id].name}</div>
            )}
            <div className="faint" style={{ fontSize: 13, marginTop: 8 }}>Цена: ◈ {def.value}{cur.qty > 1 ? ` · Количество: ${cur.qty}` : ''}</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {def.slot && (isEquipped(cur.uid)
                ? <button className="btn small" onClick={() => unequip(def.slot!)}>Снять</button>
                : <button className="btn small primary" onClick={() => equip(cur.uid)}>Надеть</button>)}
              {def.use && <button className="btn small primary" onClick={() => useItem(cur.uid)}>Использовать</button>}
              {def.category === 'potion' && <button className="btn small" onClick={() => setQuickItem(quick === def.id ? null : def.id)}>{quick === def.id ? 'Убрать из Q' : 'В быстрый слот (Q)'}</button>}
              {!def.noDrop && <button className="btn small ghost" onClick={() => { dropItem(cur.uid, 1); setSel(null); }}>Выбросить</button>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
