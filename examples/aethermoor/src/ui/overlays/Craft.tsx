import { useUI, setUI, useGame, toast, mutate } from '@/state/store';
import { RECIPES, RARITY } from '@/data/world';
import { ITEMS } from '@/data/items';
import { countItem, removeItem, addItem } from '@/systems/inventory';
import { Icon } from '../icons';
import { bus } from '@/core/bus';
import { apply } from '@/systems/logic';

export function canCraft(id: string): boolean {
  return RECIPES[id].ingredients.every((i) => countItem(i.id) >= i.count);
}

export function craftResult(id: string, bonus = 0): void {
  const r = RECIPES[id];
  for (const i of r.ingredients) removeItem(i.id, i.count);
  addItem(r.result, r.count + bonus);
  mutate((g) => { g.counters.crafted = (g.counters.crafted ?? 0) + 1; });
  bus.emit('sfx', { id: r.station === 'alchemy' ? 'brew' : 'equip' });
  if (r.station === 'artifice') apply([{ achievement: 'crafter' }]);
}

export function CraftOverlay() {
  const station = useUI((s) => s.craft)!;
  const known = useGame((s) => s.g!.recipes);
  useGame((s) => s.g!.inventory);
  const close = () => setUI({ craft: null });
  const list = Object.values(RECIPES).filter((r) => r.station === station);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="trade panel panel-frame" onClick={(e) => e.stopPropagation()}>
        <div className="trade-head">
          <div><div className="t">{station === 'alchemy' ? 'Алхимический котёл' : 'Верстак артефактора'}</div>
            <div className="faint" style={{ fontStyle: 'italic' }}>{station === 'alchemy' ? 'Варите по рецепту — или за котлом вручную ради лучшего качества.' : 'Соберите артефакт из добытых материалов.'}</div></div>
          <button className="tab-close" onClick={close}>✕</button>
        </div>
        <div className="tab-body">
          <div className="scroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {list.map((r) => {
              const learned = known.includes(r.id) || station === 'artifice';
              const res = ITEMS[r.result];
              const ok = canCraft(r.id);
              return (
                <div key={r.id} className="card" style={{ display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: 12, alignItems: 'center', opacity: learned ? 1 : 0.5 }}>
                  <div className={'inv-cell rar-' + res.rarity} style={{ width: 52, height: 52 }}><Icon name={res.icon} color={res.color} size={28} /></div>
                  <div>
                    <div className="title-font" style={{ fontSize: 19, color: RARITY[res.rarity].color }}>{learned ? r.name : 'Неизвестный рецепт'}{r.count > 1 ? ` ×${r.count}` : ''}</div>
                    <div className="faint" style={{ fontSize: 13 }}>{learned ? r.desc : 'Рецепт можно узнать на уроках зельеварения или от наставников.'}</div>
                    {learned && (
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
                        {r.ingredients.map((i) => {
                          const have = countItem(i.id);
                          return <span key={i.id} style={{ fontSize: 13, color: have >= i.count ? '#9fd89a' : '#e08a7a' }}>{ITEMS[i.id].name} {have}/{i.count}</span>;
                        })}
                      </div>
                    )}
                  </div>
                  {learned && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {station === 'alchemy' && <button className="btn small primary" disabled={!ok} onClick={() => setUI({ craft: null, minigame: { type: 'brew', id: 'craft_' + r.id, recipe: r.id, difficulty: 2, title: r.name } })}>Варить вручную</button>}
                      <button className="btn small" disabled={!ok} onClick={() => { craftResult(r.id); toast('item', `Создано: ${res.name}`); }}>{station === 'alchemy' ? 'Быстро' : 'Создать'}</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
