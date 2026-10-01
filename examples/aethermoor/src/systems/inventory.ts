// Инвентарь, экипировка, торговля.
import { G, mutate, toast } from '@/state/store';
import { uid } from '@/state/gameState';
import type { GameState, InvItem } from '@/state/gameState';
import { ITEMS, itemDef } from '@/data/items';
import { SHOPS } from '@/data/world';
import { bus } from '@/core/bus';
import { addBuff, derived, clampVitals } from './player';
import { apply } from './logic';
import type { EquipSlot } from '@/data/types';

export const INVENTORY_LIMIT = 60;

export function countItem(id: string, g: GameState = G()): number {
  let n = 0;
  for (const it of g.inventory) if (it.id === id) n += it.qty;
  return n;
}

function isStackable(id: string): boolean {
  const d = ITEMS[id];
  return !!d && !d.slot && (d.stack ?? 1) > 1;
}

export function addItem(id: string, qty = 1, silent = false): void {
  const def = itemDef(id);
  mutate((g) => {
    let left = qty;
    if (isStackable(id)) {
      const max = def.stack ?? 99;
      for (const it of g.inventory) {
        if (it.id !== id || it.qty >= max) continue;
        const add = Math.min(left, max - it.qty);
        it.qty += add;
        left -= add;
        if (!left) break;
      }
      while (left > 0) {
        const add = Math.min(left, max);
        g.inventory.push({ uid: uid('i'), id, qty: add });
        left -= add;
      }
    } else {
      for (let i = 0; i < left; i++) g.inventory.push({ uid: uid('i'), id, qty: 1 });
    }
  });
  if (!silent) toast('item', `${def.name}${qty > 1 ? ' ×' + qty : ''}`, 'Получен предмет');
  bus.emit('itemChanged', { id, qty: countItem(id) });
  bus.emit('sfx', { id: 'pickup' });
}

export function removeItem(id: string, qty = 1): boolean {
  if (countItem(id) < qty) return false;
  mutate((g) => {
    let left = qty;
    for (let i = g.inventory.length - 1; i >= 0 && left > 0; i--) {
      const it = g.inventory[i];
      if (it.id !== id) continue;
      const eqSlot = (Object.keys(g.equipment) as EquipSlot[]).find((s) => g.equipment[s] === it.uid);
      if (eqSlot) g.equipment[eqSlot] = null;
      const take = Math.min(left, it.qty);
      it.qty -= take;
      left -= take;
      if (it.qty <= 0) g.inventory.splice(i, 1);
    }
    if (g.quickItem === id && !g.inventory.some((i) => i.id === id)) g.quickItem = null;
  });
  bus.emit('itemChanged', { id, qty: countItem(id) });
  return true;
}

export function findInv(uidv: string): InvItem | undefined {
  return G().inventory.find((i) => i.uid === uidv);
}

export function isEquipped(uidv: string): boolean {
  const eq = G().equipment;
  return Object.values(eq).includes(uidv);
}

export function equip(uidv: string): void {
  const inv = findInv(uidv);
  if (!inv) return;
  const def = ITEMS[inv.id];
  if (!def?.slot) return;
  mutate((g) => { g.equipment[def.slot!] = uidv; });
  clampVitals();
  bus.emit('sfx', { id: 'equip' });
  bus.emit('itemChanged', { id: inv.id, qty: countItem(inv.id) });
}

export function unequip(slot: EquipSlot): void {
  mutate((g) => { g.equipment[slot] = null; });
  clampVitals();
  bus.emit('sfx', { id: 'equip' });
}

let potionLock = 0;
export function useItem(uidv: string): boolean {
  const inv = findInv(uidv);
  if (!inv) return false;
  const def = ITEMS[inv.id];
  if (!def?.use) return false;
  const now = performance.now();
  if (def.category === 'potion' && now - potionLock < 900) return false;
  potionLock = now;
  const u = def.use;
  const d = derived();
  const g = G();
  const healMult = g.player.circle === 'root' ? 1.3 : 1;
  if (u.heal && g.player.hp >= d.maxHp && !u.mana && !u.buff && !u.cure && !u.effects) {
    toast('warn', 'Здоровье и так полное');
    return false;
  }
  mutate((s) => {
    if (u.heal) s.player.hp = Math.min(d.maxHp, s.player.hp + u.heal * healMult);
    if (u.mana) s.player.mana = Math.min(d.maxMana, s.player.mana + u.mana);
    if (u.corruption) s.player.corruption = Math.min(100, s.player.corruption + u.corruption);
    s.counters.itemsUsed = (s.counters.itemsUsed ?? 0) + 1;
  });
  if (u.buff) addBuff(def.id, u.buff.stat, u.buff.amount, u.buff.minutes, u.buff.label);
  if (u.cure) bus.emit('sfx', { id: 'cure' });
  removeItem(def.id, 1);
  if (u.effects) apply(u.effects);
  bus.emit('sfx', { id: def.category === 'potion' ? 'drink' : 'page' });
  toast('item', `Использовано: ${def.name}`);
  return true;
}

export function dropItem(uidv: string, qty = 1): void {
  const inv = findInv(uidv);
  if (!inv) return;
  const def = ITEMS[inv.id];
  if (def.noDrop) { toast('warn', 'Этот предмет нельзя выбросить'); return; }
  const g = G();
  const n = Math.min(qty, inv.qty);
  const zone = g.pos.zone;
  const x = g.pos.x + (Math.random() - 0.5) * 0.8;
  const z = g.pos.z + 0.9;
  removeItemByUid(uidv, n);
  mutate((s) => {
    const list = s.drops[zone] ?? (s.drops[zone] = []);
    list.push({ uid: uid('d'), id: def.id, qty: n, x, z });
  });
  toast('info', `Выброшено: ${def.name}${n > 1 ? ' ×' + n : ''}`, 'Предмет остался лежать на земле');
}

export function removeItemByUid(uidv: string, qty: number): void {
  const inv = findInv(uidv);
  if (!inv) return;
  mutate((g) => {
    const it = g.inventory.find((i) => i.uid === uidv);
    if (!it) return;
    it.qty -= qty;
    if (it.qty <= 0) {
      g.inventory = g.inventory.filter((i) => i.uid !== uidv);
      for (const s of Object.keys(g.equipment) as EquipSlot[]) if (g.equipment[s] === uidv) g.equipment[s] = null;
      if (g.quickItem === it.id && !g.inventory.some((i) => i.id === it.id)) g.quickItem = null;
    }
  });
  bus.emit('itemChanged', { id: inv.id, qty: countItem(inv.id) });
}

// ---------------- Экономика ----------------

export function priceModifier(shopId: string): number {
  const g = G();
  let m = 1;
  if (g.player.origin === 'guild') m -= 0.15;
  const repKey = shopId === 'quartermaster' ? 'academy' : 'village';
  const rep = g.rep[repKey] ?? 0;
  m -= Math.max(-20, Math.min(20, rep / 4)) / 100;
  if (shopId === 'wanderer') m += 0.2;
  return Math.max(0.55, m);
}

export function buyPrice(itemId: string, shopId: string): number {
  return Math.max(1, Math.round(itemDef(itemId).value * priceModifier(shopId)));
}

export function sellPrice(itemId: string): number {
  const g = G();
  const base = itemDef(itemId).value * (g.player.origin === 'guild' ? 0.5 : 0.4);
  return Math.max(1, Math.floor(base));
}

export function canSell(itemId: string, shopId: string): boolean {
  const def = itemDef(itemId);
  if (def.noSell || def.value <= 0) return false;
  return SHOPS[shopId]?.buys.includes(def.category) ?? false;
}

export function buy(shopId: string, itemId: string, qty = 1): boolean {
  const price = buyPrice(itemId, shopId) * qty;
  if (G().player.gold < price) { toast('warn', 'Не хватает крон'); bus.emit('sfx', { id: 'ui_error' }); return false; }
  if (G().inventory.length >= INVENTORY_LIMIT && !isStackable(itemId)) { toast('warn', 'Сумка переполнена'); return false; }
  mutate((g) => { g.player.gold -= price; g.counters.goldSpent = (g.counters.goldSpent ?? 0) + price; });
  addItem(itemId, qty, true);
  toast('item', `Куплено: ${itemDef(itemId).name}${qty > 1 ? ' ×' + qty : ''}`, `−${price} крон`);
  bus.emit('sfx', { id: 'coins' });
  return true;
}

export function sell(uidv: string, qty = 1): boolean {
  const inv = findInv(uidv);
  if (!inv) return false;
  const n = Math.min(qty, inv.qty);
  const price = sellPrice(inv.id) * n;
  const name = itemDef(inv.id).name;
  removeItemByUid(uidv, n);
  mutate((g) => { g.player.gold += price; g.counters.goldEarned = (g.counters.goldEarned ?? 0) + price; });
  toast('item', `Продано: ${name}${n > 1 ? ' ×' + n : ''}`, `+${price} крон`);
  bus.emit('sfx', { id: 'coins' });
  return true;
}

export function setQuickItem(id: string | null): void {
  mutate((g) => { g.quickItem = id; });
}

export function useQuickItem(): boolean {
  const g = G();
  let id = g.quickItem;
  if (!id || countItem(id) === 0) {
    // по умолчанию — любое лечебное зелье
    const hp = g.inventory.find((i) => ITEMS[i.id]?.use?.heal && ITEMS[i.id].category === 'potion');
    id = hp?.id ?? null;
  }
  if (!id) { toast('warn', 'Нет зелья в быстром слоте'); return false; }
  const inv = g.inventory.find((i) => i.id === id);
  return inv ? useItem(inv.uid) : false;
}
