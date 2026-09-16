/* Отправка сообщений покупателю через Bot API.
   Только отправка: getUpdates мы не трогаем принципиально — второй читатель
   очереди отбирает апдейты у работающего бота и роняет приём заказов.
   Токен живёт в AO_TELEGRAM_TOKEN и никогда не попадает ни в ответы, ни в лог. */

const API = 'https://api.telegram.org';

export function hasTelegram() {
  return Boolean((process.env.AO_TELEGRAM_TOKEN || '').trim());
}

/** Убираем токен из любого текста, который может уйти в журнал или в панель. */
function scrub(text) {
  const token = (process.env.AO_TELEGRAM_TOKEN || '').trim();
  const s = String(text ?? '');
  return token ? s.split(token).join('***') : s;
}

async function call(method, payload, timeoutMs = 12000) {
  const token = (process.env.AO_TELEGRAM_TOKEN || '').trim();
  if (!token) throw new Error('AO_TELEGRAM_TOKEN не задан — отправлять некуда');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!body.ok) {
      // description Telegram отдаёт человеческим текстом — он и нужен владельцу
      throw new Error(scrub(body.description || `ответ ${res.status}`));
    }
    return body.result;
  } catch (err) {
    throw new Error(scrub(err.message));
  } finally {
    clearTimeout(timer);
  }
}

/** Кто мы. Зовём на старте, чтобы владелец сразу видел, тот ли бот подключён. */
export async function whoAmI() {
  const me = await call('getMe', {});
  return { id: me.id, username: me.username, name: me.first_name };
}

/* Telegram режет сообщения на 4096 символов. Ответ агента бывает длиннее,
   поэтому рвём по абзацам, а не посередине слова. */
function split(text, limit = 3900) {
  const out = [];
  let rest = String(text || '').trim();
  while (rest.length > limit) {
    let cut = rest.lastIndexOf('\n\n', limit);
    if (cut < limit * 0.5) cut = rest.lastIndexOf('\n', limit);
    if (cut < limit * 0.5) cut = rest.lastIndexOf(' ', limit);
    if (cut <= 0) cut = limit;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** Отправить готовый текст покупателю. Возвращает id сообщений. */
export async function sendMessage({ chatId, text }) {
  const to = String(chatId ?? '').trim();
  if (!to) throw new Error('не указан получатель');
  const parts = split(text);
  if (!parts.length) throw new Error('пустой текст — отправлять нечего');
  const ids = [];
  for (const part of parts) {
    const sent = await call('sendMessage', {
      chat_id: to,
      text: part,
      disable_web_page_preview: true,
    });
    ids.push(sent.message_id);
  }
  return { chatId: to, messageIds: ids, parts: parts.length };
}
