import { useState } from 'react';
import { useUI, setUI, useGame } from '@/state/store';
import { SHOPS, RARITY } from '@/data/world';
import { ITEMS, CATEGORY_NAMES } from '@/data/items';
import { buy, sell, buyPrice, sellPrice, canSell, isEquipped } from '@/systems/inventory';
import { NPCS } from '@/data/npcs';
import { Icon } from '../icons';
import { portrait } from '../portraits';

export function ShopOverlay() {
  const id = useUI((s) => s.shop)!;
  const shop = SHOPS[id];
  const gold = useGame((s) => s.g!.player.gold);
  const inv = useGame((s) => s.g!.inventory);
  const [tab, setTab] = useState<'buy' | 'sell'>('buy');
  const close = () => setUI({ shop: null });
  if (!shop) return null;
  const owner = NPCS[shop.owner];
  const sellable = inv.filter((i) => canSell(i.id, id) && !isEquipped(i.uid));
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="trade panel panel-frame" onClick={(e) => e.stopPropagation()}>
        <div className="trade-head">
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {owner && <div className="rel-face"><img src={portrait('npc_' + owner.id, owner.appearance)} alt="" /></div>}
            <div><div className="t">{shop.name}</div><div className="faint" style={{ fontStyle: 'italic' }}>{shop.mood}</div></div>
          </div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <div className="gold-amount">◈ {gold}</div>
            <button className="tab-close" onClick={close}>✕</button>
          </div>
        </div>
        <div className="tab-body">
          <div className="filters">
            <button className={tab === 'buy' ? 'on' : ''} onClick={() => setTab('buy')}>Купить</button>
            <button className={tab === 'sell' ? 'on' : ''} onClick={() => setTab('sell')}>Продать ({sellable.length})</button>
          </div>
          <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
            {tab === 'buy' && shop.stock.map((itemId) => {
              const it = ITEMS[itemId];
              const price = buyPrice(itemId, id);
              return (
                <div key={itemId} className="trade-row">
                  <div className={'inv-cell rar-' + it.rarity} style={{ width: 44, height: 44 }}><Icon name={it.icon} color={it.color} size={24} /></div>
                  <div>
                    <div className="title-font" style={{ fontSize: 18, color: RARITY[it.rarity].color }}>{it.name}</div>
                    <div className="faint" style={{ fontSize: 13 }}>{CATEGORY_NAMES[it.category]} · {it.desc}</div>
                  </div>
                  <div className="price">◈ {price}</div>
                  <button className="btn small" disabled={gold < price} onClick={() => buy(id, itemId, 1)}>Купить</button>
                </div>
              );
            })}
            {tab === 'sell' && sellable.length === 0 && <div className="faint">Этот торговец не купит ничего из вашей сумки.</div>}
            {tab === 'sell' && sellable.map((i) => {
              const it = ITEMS[i.id];
              return (
                <div key={i.uid} className="trade-row">
                  <div className={'inv-cell rar-' + it.rarity} style={{ width: 44, height: 44 }}><Icon name={it.icon} color={it.color} size={24} />{i.qty > 1 && <span className="q">{i.qty}</span>}</div>
                  <div><div className="title-font" style={{ fontSize: 18, color: RARITY[it.rarity].color }}>{it.name}</div><div className="faint" style={{ fontSize: 13 }}>{CATEGORY_NAMES[it.category]}</div></div>
                  <div className="price">◈ {sellPrice(i.id)}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn small" onClick={() => sell(i.uid, 1)}>Продать</button>
                    {i.qty > 1 && <button className="btn small ghost" onClick={() => sell(i.uid, i.qty)}>Все</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
