// Каталог магазина: 203 позиции с готовыми карточками на русском и узбекском.
// Источник — `знания/каталог.json` (выгрузка из работающего магазина) или живой
// API, если он доступен. В промпт кладём компактный индекс, полные карточки
// агент достаёт инструментом.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const num = (v) => {
  const n = Number(String(v ?? '').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const money = (v) => num(v).toLocaleString('ru-RU').replace(/ /g, ' ');

export class Catalog {
  constructor(items = [], source = 'нет данных') {
    this.items = items;
    this.source = source;
    this.at = new Date().toISOString();
  }

  static fromFile(dir) {
    const path = join(dir, 'каталог.json');
    if (!existsSync(path)) return new Catalog([], 'файл каталога не найден');
    try {
      const raw = JSON.parse(readFileSync(path, 'utf8'));
      const items = Array.isArray(raw) ? raw : (raw.товары || raw.items || Object.values(raw)[0]);
      return new Catalog(Array.isArray(items) ? items : [], 'знания/каталог.json');
    } catch (err) {
      console.error('[catalog] не разобрал каталог.json:', err.message);
      return new Catalog([], 'каталог.json повреждён');
    }
  }

  get size() { return this.items.length; }

  stats() {
    const inStock = this.items.filter((x) => num(x.остаток) > 0);
    const prices = inStock.map((x) => num(x.цена_сум)).filter(Boolean);
    const cats = new Map();
    const brands = new Map();
    for (const x of this.items) {
      cats.set(x.категория || 'без категории', (cats.get(x.категория || 'без категории') || 0) + 1);
      const b = (x.бренд || '').trim();
      if (b) brands.set(b, (brands.get(b) || 0) + 1);
    }
    return {
      total: this.items.length,
      inStock: inStock.length,
      outOfStock: this.items.length - inStock.length,
      noBrand: this.items.filter((x) => !(x.бренд || '').trim()).length,
      withCost: this.items.filter((x) => num(x.себестоимость_сум) > 0).length,
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      categories: [...cats.entries()].sort((a, b) => b[1] - a[1]),
      brands: [...brands.entries()].sort((a, b) => b[1] - a[1]),
      hits: this.items.filter((x) => x.хит === true || x.хит === 'True').length,
      novelties: this.items.filter((x) => x.новинка === true || x.новинка === 'True').length,
    };
  }

  /** Компактный список для системного промпта: агент видит весь ассортимент. */
  index() {
    const byCat = new Map();
    for (const x of this.items) {
      const c = x.категория || 'без категории';
      if (!byCat.has(c)) byCat.set(c, []);
      byCat.get(c).push(x);
    }
    const lines = [];
    for (const [cat, list] of [...byCat.entries()].sort((a, b) => b[1].length - a[1].length)) {
      lines.push(`\n### ${cat} (${list.length})`);
      for (const x of list.sort((a, b) => num(b.остаток) - num(a.остаток))) {
        const stock = num(x.остаток);
        const brand = (x.бренд || '—').trim();
        const dose = [x.вещество, x.дозировка].filter(Boolean).join(' ');
        lines.push(
          `${x.id} · ${dose || x.название} · ${brand} · ${money(x.цена_сум)} сум` +
          ` · ${x.штук_в_банке || '?'} шт · остаток ${stock}${stock === 0 ? ' ← НЕ ПРЕДЛАГАТЬ' : ''}`,
        );
      }
    }
    return lines.join('\n');
  }

  get(id) {
    return this.items.find((x) => String(x.id) === String(id)) || null;
  }

  search({ запрос = '', категория = '', бренд = '', только_в_наличии = true, сколько = 8 } = {}) {
    const q = запрос.toLowerCase().trim();
    const words = q.split(/\s+/).filter(Boolean);
    const scored = [];
    for (const x of this.items) {
      if (только_в_наличии && num(x.остаток) <= 0) continue;
      if (категория && !(x.категория || '').toLowerCase().includes(категория.toLowerCase())) continue;
      if (бренд && !(x.бренд || '').toLowerCase().includes(бренд.toLowerCase())) continue;

      const hay = [
        x.название, x.вещество, x.категория, x.бренд, x.польза,
        x.карточка_ru?.title, x.карточка_ru?.short,
        ...(x.карточка_ru?.bullets || []),
      ].filter(Boolean).join(' ').toLowerCase();

      let score = 0;
      for (const w of words) if (hay.includes(w)) score += 1;
      if (!words.length) score = 1;
      if (score) scored.push({ x, score });
    }
    scored.sort((a, b) => b.score - a.score || num(b.x.остаток) - num(a.x.остаток));
    return scored.slice(0, сколько).map((s) => s.x);
  }

  /** Полная карточка в виде текста — то, что агент получает из инструмента. */
  card(x, язык = 'оба') {
    if (!x) return 'Товар не найден.';
    const lines = [
      `ID ${x.id} · ${x.название}`,
      `Бренд: ${(x.бренд || 'не проставлен').trim()} · Категория: ${x.категория}`,
      `Вещество: ${x.вещество || '—'} · Дозировка: ${x.дозировка || '—'} · Форма: ${x.форма || '—'}`,
      `В упаковке: ${x.штук_в_банке || '?'} шт · Цена: ${money(x.цена_сум)} сум · Кэшбэк: ${x.кэшбэк_процент || 0}%`,
      `Остаток: ${num(x.остаток)}${num(x.остаток) === 0 ? ' — НЕТ В НАЛИЧИИ, не предлагать' : ''}`,
      `Польза: ${x.польза || '—'}`,
    ];
    const render = (card, label) => {
      if (!card) return;
      lines.push(`\n--- Готовая карточка (${label}) ---`);
      if (card.title) lines.push(`Заголовок: ${card.title}`);
      if (card.short) lines.push(`Коротко: ${card.short}`);
      for (const b of card.bullets || []) lines.push(`• ${b}`);
      for (const b of card.blocks || []) lines.push(`${b.title}: ${b.text}`);
    };
    if (язык !== 'uz') render(x.карточка_ru, 'рус');
    if (язык !== 'ru') render(x.карточка_uz, 'узб');
    return lines.join('\n');
  }
}
