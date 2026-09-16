// Вызов модели. Агент может пользоваться инструментами — искать товары в каталоге
// и доставать готовые карточки на двух языках. Без ключа работает демо-режим.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.AO_MODEL || 'claude-opus-5';
const MAX_TOKENS = Number(process.env.AO_MAX_TOKENS || 16000);
const EFFORT = process.env.AO_EFFORT || 'high';
const MAX_STEPS = Number(process.env.AO_MAX_STEPS || 8);

let client = null;
export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const textOf = (message) =>
  message.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

/* ---------------- инструменты ---------------- */

export const TOOLS = [
  {
    name: 'catalog_search',
    description:
      'Поиск товаров в каталоге магазина. Возвращает готовые карточки с ценой, остатком, ' +
      'составом и текстами на русском и узбекском. Пользуйся этим всегда, когда нужны ' +
      'конкретные товары, цены или дозировки — не вспоминай их по памяти.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['запрос'],
      properties: {
        запрос: {
          type: 'string',
          description: 'Что ищем: вещество, задача покупателя, бренд. Например «магний сон» или «витамин D детям».',
        },
        категория: { type: 'string', description: 'Ограничить категорией каталога. Пусто — не ограничивать.' },
        бренд: { type: 'string', description: 'Ограничить брендом. Пусто — не ограничивать.' },
        только_в_наличии: { type: 'boolean', description: 'По умолчанию true — товары с нулевым остатком не предлагаем.' },
        сколько: { type: 'integer', description: 'Сколько позиций вернуть, 1–12.' },
      },
    },
  },
  {
    name: 'catalog_get',
    description: 'Полная карточка одного товара по его id из каталога.',
    strict: true,
    input_schema: {
      type: 'object',
      additionalProperties: false,
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Идентификатор товара, как в индексе каталога.' },
        язык: { type: 'string', description: '«ru», «uz» или «оба» (по умолчанию).' },
      },
    },
  },
];

/** Выполняет вызов инструмента. Ошибку возвращаем текстом — модель её прочитает. */
export function runTool(catalog, name, input) {
  try {
    if (name === 'catalog_search') {
      const found = catalog.search({
        запрос: input.запрос || '',
        категория: input.категория || '',
        бренд: input.бренд || '',
        только_в_наличии: input.только_в_наличии !== false,
        сколько: Math.min(Math.max(Number(input.сколько) || 6, 1), 12),
      });
      if (!found.length) return 'Ничего не найдено. Не придумывай товар — скажи, что подходящего в каталоге нет.';
      return found.map((x) => catalog.card(x)).join('\n\n═══\n\n');
    }
    if (name === 'catalog_get') {
      const item = catalog.get(input.id);
      if (!item) return `Товара с id ${input.id} в каталоге нет.`;
      return catalog.card(item, input.язык || 'оба');
    }
    return `Неизвестный инструмент: ${name}`;
  } catch (err) {
    return `Инструмент упал: ${err.message}`;
  }
}

/* ---------------- демо-режим ---------------- */

async function mockRun(agent, task, onText) {
  const text =
    `[ДЕМО-РЕЖИМ — модель не подключена]\n\n` +
    `Агент «${agent.name}» получил задачу: ${task.title}\n\n` +
    `Здесь будет настоящий ответ, как только в .env появится ANTHROPIC_API_KEY.\n` +
    `Каталог на 203 позиции и правила магазина уже загружены — агенту есть с чем работать.\n\n` +
    `Что он сделал бы:\n${agent.description}`;
  for (let i = 0; i < text.length; i += 14) {
    await sleep(45);
    onText?.(text.slice(i, i + 14));
  }
  return { mock: true, usage: null, text, steps: 1 };
}

/* ---------------- основной вызов ---------------- */

export async function runAgent({ agent, task, context, catalog, onText, onTool }) {
  if (!hasApiKey()) return mockRun(agent, task, onText);

  const system = buildSystem(agent, context);
  const messages = [{
    role: 'user',
    content: task.input?.trim() ? `Задача: ${task.title}\n\n${task.input}` : `Задача: ${task.title}`,
  }];

  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 };
  let steps = 0;

  for (steps = 1; steps <= MAX_STEPS; steps++) {
    const stream = getClient().messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'adaptive' },
      output_config: { effort: EFFORT },
      system,
      tools: catalog?.size ? TOOLS : undefined,
      messages,
    });
    if (onText) stream.on('text', (delta) => onText(delta));

    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      throw new Error(`Запрос отклонён: ${message.stop_details?.explanation || 'политика модели'}`);
    }
    for (const k of Object.keys(usage)) usage[k] += message.usage?.[k] || 0;

    // Блоки возвращаем в историю как есть — включая блоки размышления.
    messages.push({ role: 'assistant', content: message.content });

    const calls = message.content.filter((b) => b.type === 'tool_use');
    if (!calls.length) {
      return { mock: false, text: textOf(message), usage, steps };
    }
    if (message.stop_reason === 'max_tokens') {
      throw new Error('Ответ обрезан по лимиту токенов — вызов инструмента мог прийти неполным.');
    }

    const results = [];
    for (const call of calls) {
      const label = call.name === 'catalog_search'
        ? `поиск в каталоге: ${call.input?.запрос || ''}`
        : `карточка товара ${call.input?.id || ''}`;
      onTool?.(label);
      onText?.(`\n[${label}]\n`);
      results.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content: runTool(catalog, call.name, call.input || {}),
      });
    }
    messages.push({ role: 'user', content: results });
  }

  throw new Error(`Агент не уложился в ${MAX_STEPS} шагов с инструментами.`);
}

/* ---------------- выбор агента под задачу ---------------- */

/** Когда владелец не указал исполнителя — выбираем его моделью. */
export async function routeTask({ agents, task }) {
  const fallback = agents.find((a) => a.id === 'support-responder') || agents[0];

  if (!hasApiKey()) {
    const words = `${task.title} ${task.input || ''}`.toLowerCase();
    const hit = agents.find((a) =>
      a.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && words.includes(w)));
    return { agentId: (hit || fallback).id, reason: 'демо-подбор по ключевым словам' };
  }

  const roster = agents
    .map((a) => `${a.id} — ${a.name} (${a.block}): ${a.description}`)
    .join('\n');

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1000,
    system:
      'Ты распределяешь задачи между сотрудниками магазина витаминов Vitaflow в Ташкенте. ' +
      'Выбери ровно одного исполнителя — того, чья роль ближе всего к сути задачи. ' +
      'Ответь строго в формате:\nID: <id>\nПРИЧИНА: <одна строка>',
    messages: [{
      role: 'user',
      content: `Сотрудники:\n${roster}\n\nЗадача: ${task.title}\n${task.input || ''}`,
    }],
  });

  const text = textOf(response);
  const id = text.match(/ID:\s*([a-z0-9-]+)/i)?.[1];
  const reason = text.match(/ПРИЧИНА:\s*(.+)/i)?.[1]?.trim() || 'выбор модели';
  const known = agents.find((a) => a.id === id);
  return known
    ? { agentId: known.id, reason }
    : { agentId: fallback.id, reason: 'модель не назвала известного сотрудника, взят дежурный' };
}

/* ---------------- системный промпт ---------------- */

function buildSystem(agent, context) {
  return [
    agent.systemPrompt,
    '',
    context,
    '',
    '## Правила Vitaflow — выше твоей роли, нарушать нельзя',
    '1. Ни одной цифры из головы. Цена, остаток, дозировка, количество штук — только из каталога.',
    '   Нужны детали товара — вызови инструмент catalog_search или catalog_get, не вспоминай по памяти.',
    '2. Товар с остатком 0 не предлагаем и не рекламируем — подбираем замену из той же категории.',
    '3. Лечение не обещаем: никаких «лечит», «избавит от болезни», «заменяет лекарство»,',
    '   диагнозов как обещания и гарантий результата.',
    '4. К здоровью читателя не обращаемся на «вы» («вы страдаете от…») — пишем в третьем лице.',
    '5. Где назван товар — стоит «Не является лекарственным средством» (узб. «Dori vositasi emas»).',
    '6. В каждом тексте есть честное ограничение: чего добавка НЕ делает. Это фирменная черта Vitaflow.',
    '7. Два языка: русский и узбекский. Узбекский — живой текст, не перевод слово в слово.',
    '   У всех 203 товаров карточки уже написаны на обоих языках — бери их за основу, не сочиняй заново.',
    '',
    '## Чего в магазине нет — не обещать',
    '- **Правил возврата не существует.** Если спрашивают про возврат — «уточню у менеджера',
    '  и вернусь с ответом». Условия не выдумывать ни при каких обстоятельствах.',
    '- Оплата картой внутри бота (Payme/Click) не подключена, самовывоз выключен.',
    '- Доставка только по Ташкенту. За пределы города условий нет — не обещаем.',
    '',
    '## Что в магазине есть — об этом можно говорить',
    '- Доставка по Ташкенту в течение 24 часов; 35 000 сум, от 400 000 — 25 000,',
    '  от 700 000 — 15 000, от 1 000 000 — бесплатно.',
    '- Оплата: перевод на карту (реквизиты отправляет магазин, агент их не называет) или наличными.',
    '- Кэшбэк VITACASH включён: 2% с покупки, у отдельных товаров процент свой — он в каталоге.',
    '- Магазин работает ежедневно 9:00–22:00.',
    '',
    '## Закрытые данные',
    'Себестоимость и наценка — только для внутренних расчётов. В тексты для покупателя,',
    'в посты и в переписку они не попадают никогда.',
    '',
    '## Как ты работаешь',
    '- Ничего не отправляешь сам: ответ уходит владельцу на проверку.',
    '- Не хватает данных — говоришь об этом прямо, а не заполняешь пробел догадкой.',
  ].join('\n');
}

export const modelName = MODEL;
