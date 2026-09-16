/* Заказы магазина — только на чтение.
   Тот же приём, что и с каталогом: адрес в AO_ORDERS_URL, поля принимаем
   русские и английские. Офис в магазин ничего не пишет: статус заказа меняете
   вы в своей админке, иначе две системы начнут спорить о правде. */

const num = (v) => {
  const n = Number(String(v ?? '').replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
};
const money = (v) => num(v).toLocaleString('ru-RU').replace(/ /g, ' ');

/* Телефоны и имена покупателей — живые персональные данные. В промпт агенту
   уходит только то, без чего он не соберёт ответ: что заказали, на сколько,
   куда и в каком статусе. Телефон держим отдельно и наружу не отдаём. */
const PRIVATE = new Set(['телефон', 'phone', 'адрес_полный']);

export class Orders {
  constructor(items = [], source = 'нет данных') {
    this.items = items;
    this.source = source;
    this.at = new Date().toISOString();
  }

  static async fromUrl(url, token = '', timeoutMs = 10000) {
    const headers = { accept: 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { headers, signal: ctrl.signal });
      if (!res.ok) throw new Error(`ответ ${res.status}`);
      const raw = await res.json();
      const list = Array.isArray(raw) ? raw : (raw.заказы || raw.orders || raw.items || raw.data);
      if (!Array.isArray(list)) throw new Error('в ответе нет массива заказов');
      return new Orders(list.map((x) => Orders.normalize(x)), url.replace(/\?.*$/, ''));
    } finally {
      clearTimeout(timer);
    }
  }

  static normalize(raw) {
    if (!raw || typeof raw !== 'object') return {};
    const pick = (...keys) => {
      for (const k of keys) {
        const v = raw[k];
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return undefined;
    };
    const items = pick('позиции', 'товары', 'items', 'products', 'lines') || [];
    return {
      id: pick('id', 'номер', 'number', 'order_id', 'ID'),
      создан: pick('создан', 'дата', 'created_at', 'date', 'createdAt'),
      статус: pick('статус', 'status', 'state') || 'без статуса',
      сумма_сум: num(pick('сумма_сум', 'сумма', 'total', 'amount', 'total_sum')),
      город: pick('город', 'city', 'регион') || '',
      доставка: pick('доставка', 'delivery', 'shipping_method') || '',
      оплата: pick('оплата', 'payment', 'payment_method') || '',
      покупатель: pick('имя', 'покупатель', 'customer', 'name') || '',
      чат_id: pick('чат_id', 'chat_id', 'telegram_id', 'tg_id') || '',
      комментарий: pick('комментарий', 'comment', 'note') || '',
      позиции: (Array.isArray(items) ? items : []).map((it) => ({
        название: it.название || it.name || it.title || '',
        количество: num(it.количество ?? it.qty ?? it.quantity ?? 1),
        цена_сум: num(it.цена_сум ?? it.цена ?? it.price),
      })),
      телефон: pick('телефон', 'phone', 'tel') || '',
    };
  }

  get size() { return this.items.length; }

  fingerprint() {
    return this.items.map((x) => `${x.id}:${x.статус}:${num(x.сумма_сум)}`).sort().join('|');
  }

  stats() {
    const byStatus = new Map();
    for (const x of this.items) byStatus.set(x.статус, (byStatus.get(x.статус) || 0) + 1);
    const sums = this.items.map((x) => num(x.сумма_сум)).filter(Boolean);
    return {
      total: this.items.length,
      revenue: sums.reduce((a, b) => a + b, 0),
      average: sums.length ? Math.round(sums.reduce((a, b) => a + b, 0) / sums.length) : 0,
      byStatus: [...byStatus.entries()].sort((a, b) => b[1] - a[1]),
      withChat: this.items.filter((x) => x.чат_id).length,
    };
  }

  get(id) {
    return this.items.find((x) => String(x.id) === String(id)) || null;
  }

  search({ статус = '', город = '', покупатель = '', сколько = 10 } = {}) {
    const hit = (hay, needle) => !needle || String(hay || '').toLowerCase().includes(needle.toLowerCase());
    return this.items
      .filter((x) => hit(x.статус, статус) && hit(x.город, город) && hit(x.покупатель, покупатель))
      .slice(0, Math.min(Math.max(сколько, 1), 30));
  }

  /** Заказ в виде текста для агента. Телефон сюда не попадает. */
  card(x) {
    if (!x) return 'Заказ не найден.';
    const lines = [
      `Заказ ${x.id} · ${x.статус} · ${money(x.сумма_сум)} сум`,
      `Создан: ${x.создан || '—'} · Город: ${x.город || '—'} · Доставка: ${x.доставка || '—'} · Оплата: ${x.оплата || '—'}`,
      `Покупатель: ${x.покупатель || '—'}${x.чат_id ? ' · есть чат в Telegram' : ' · чата нет'}`,
    ];
    if (x.комментарий) lines.push(`Комментарий: ${x.комментарий}`);
    if (x.позиции?.length) {
      lines.push('Позиции:');
      for (const it of x.позиции) {
        lines.push(`• ${it.название} × ${it.количество} — ${money(it.цена_сум)} сум`);
      }
    }
    lines.push('Телефон покупателя в текст ответа не вставлять.');
    return lines.join('\n');
  }
}

export { PRIVATE };
