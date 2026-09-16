// Вызов модели. Без ключа работает демо-режим, чтобы панель можно было
// посмотреть до подключения API.
import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.AO_MODEL || 'claude-opus-5';
const MAX_TOKENS = Number(process.env.AO_MAX_TOKENS || 16000);

let client = null;
export function hasApiKey() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}
function getClient() {
  if (!client) client = new Anthropic();
  return client;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function textOf(message) {
  return message.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/** Демо-ответ: виден сразу, честно помечен как демонстрационный. */
async function mockRun(agent, task, onText) {
  const text =
    `[ДЕМО-РЕЖИМ — модель не подключена]\n\n` +
    `Агент «${agent.name}» получил задачу: ${task.title}\n\n` +
    `Здесь будет настоящий ответ, как только в .env появится ANTHROPIC_API_KEY.\n` +
    `Сейчас это заглушка, чтобы было видно, как задача идёт по статусам.\n\n` +
    `Что агент сделал бы на самом деле:\n${agent.description}`;
  // печатаем кусками — экран на панели должен оживать
  for (let i = 0; i < text.length; i += 14) {
    await sleep(45);
    onText?.(text.slice(i, i + 14));
  }
  return { mock: true, usage: null, text };
}

async function mockRunUnused(agent, task) {
  await sleep(1200 + Math.random() * 2600);
  return {
    mock: true,
    usage: null,
    text:
      `[ДЕМО-РЕЖИМ — модель не подключена]\n\n` +
      `Агент «${agent.name}» получил задачу: ${task.title}\n\n` +
      `Здесь будет настоящий ответ агента, как только в .env появится ANTHROPIC_API_KEY.\n` +
      `Сейчас показан заглушечный текст, чтобы было видно, как панель проводит задачу ` +
      `по статусам: в работе → на подтверждении → принято.\n\n` +
      `Что агент сделал бы на самом деле:\n${agent.description}`,
  };
}

/** Запуск одного агента на одной задаче. */
export async function runAgent({ agent, task, brain, onText }) {
  if (!hasApiKey()) return mockRun(agent, task, onText);

  const system = [
    agent.systemPrompt,
    '',
    '## Контекст бизнеса (BRAIN.md)',
    brain?.trim()
      ? brain
      : 'BRAIN.md пока не заполнен. Не выдумывай товары, цены, сроки и правила — ' +
        'вместо этого перечисли, каких данных не хватает для ответа.',
    '',
    '## Общие правила',
    '- Отвечай по-русски.',
    '- Ничего не отправляй от своего имени: твой ответ уходит владельцу на проверку.',
    '- Не придумывай цифры, товары и сроки, которых нет в контексте.',
  ].join('\n');

  const userContent = task.input?.trim()
    ? `Задача: ${task.title}\n\n${task.input}`
    : `Задача: ${task.title}`;

  const stream = getClient().messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system,
    messages: [{ role: 'user', content: userContent }],
  });

  // Текст отдаём по мере генерации — панель показывает, что агент пишет сейчас.
  if (onText) stream.on('text', (delta) => onText(delta));

  const message = await stream.finalMessage();

  if (message.stop_reason === 'refusal') {
    const reason = message.stop_details?.explanation || 'модель отклонила запрос';
    throw new Error(`Запрос отклонён: ${reason}`);
  }

  return { mock: false, text: textOf(message), usage: message.usage ?? null };
}

/** Выбор агента под задачу, когда владелец не указал его явно. */
export async function routeTask({ agents, task }) {
  const fallback = agents[0];
  if (!hasApiKey()) {
    // Без модели — грубый подбор по словам из описания роли.
    const words = `${task.title} ${task.input}`.toLowerCase();
    const hit = agents.find((a) =>
      a.name.toLowerCase().split(/\s+/).some((w) => w.length > 3 && words.includes(w)),
    );
    return { agentId: (hit || fallback).id, reason: 'демо-подбор по ключевым словам' };
  }

  const roster = agents.map((a) => `${a.id} — ${a.name}: ${a.description}`).join('\n');
  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1000,
    system:
      'Ты распределяешь задачи между специалистами магазина витаминов. ' +
      'Выбери ровно одного и ответь строго в формате:\nID: <id>\nПРИЧИНА: <одна строка>',
    messages: [
      { role: 'user', content: `Специалисты:\n${roster}\n\nЗадача: ${task.title}\n${task.input || ''}` },
    ],
  });

  const text = textOf(response);
  const id = text.match(/ID:\s*([a-z0-9-]+)/i)?.[1];
  const reason = text.match(/ПРИЧИНА:\s*(.+)/i)?.[1]?.trim() || 'выбор модели';
  const known = agents.find((a) => a.id === id);
  return known
    ? { agentId: known.id, reason }
    : { agentId: fallback.id, reason: 'модель не назвала известного агента, взят первый по списку' };
}

export const modelName = MODEL;
