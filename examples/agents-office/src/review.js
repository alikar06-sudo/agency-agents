// Управляющий: проверяет работу специалиста до того, как она дойдёт до владельца.
// Работает на дешёвой модели — это чек-лист, а не творчество.
import { getClient, smallModelName, costOf } from './llm.js';

const ENABLED = process.env.AO_REVIEW !== 'off';
const ROUNDS = Number(process.env.AO_REVIEW_ROUNDS || 1);

const CHECKLIST = `Ты — управляющий магазина витаминов Vitaflow в Ташкенте. Ты не пишешь тексты,
ты решаешь, можно ли выпускать работу сотрудника. Проверь по списку и вынеси вердикт.

Отклоняй, если находишь хоть одно:
1. Обещание лечения: «лечит», «вылечит», «избавит от болезни», «заменяет лекарство»,
   название болезни как обещание, гарантия результата или срока.
2. Обращение к здоровью читателя на «вы» («вы страдаете от…», «если вас мучает…»).
   Про проблему пишут в третьем лице.
3. Товар назван, но нет оговорки «Не является лекарственным средством»
   (в узбекском тексте — «Dori vositasi emas»).
4. Нет честного ограничения — не сказано, чего добавка НЕ делает.
5. Текст про товар или для покупателя сделан только на одном языке,
   хотя должен быть на русском и узбекском.
6. Выдуманы условия возврата. Правил возврата у магазина НЕТ — допустим только
   ответ «уточню у менеджера».
7. Обещано то, чего нет: оплата картой в боте, самовывоз, доставка за пределы Ташкента.
8. Названы реквизиты карты.
9. Наружу вынесены себестоимость или наценка.
10. Цена или остаток выглядят выдуманными: круглые числа без источника,
    противоречие внутри текста.

НЕ отклоняй за: стиль, длину, вкусовщину, отсутствие эмодзи, порядок абзацев.
Если работа — внутренний расчёт или черновик для владельца, пункты 3 и 5 не применяются.

Ответь строго в этом формате и ничего больше:
ВЕРДИКТ: принято
или
ВЕРДИКТ: на доработку
ЗАМЕЧАНИЯ:
- <что именно нарушено и как исправить, одной строкой>`;

const textOf = (m) => m.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();

export function reviewEnabled() { return ENABLED; }
export function reviewRounds() { return ROUNDS; }

/**
 * @returns {{verdict:'ok'|'rework', notes:string[], usage:object, model:string, cost:number}}
 */
export async function review({ agent, task, text }) {
  if (!ENABLED || !text?.trim()) {
    return { verdict: 'ok', notes: [], usage: null, model: null, cost: 0 };
  }

  const response = await getClient().messages.create({
    model: smallModelName,
    max_tokens: 700,
    system: [{ type: 'text', text: CHECKLIST, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content:
        `Сотрудник: ${agent.name} (${agent.block})\n` +
        `Задача: ${task.title}\n\n` +
        `Что он сделал:\n${text.slice(0, 12000)}`,
    }],
  });

  const out = textOf(response);
  const rework = /ВЕРДИКТ:\s*на\s*доработку/i.test(out);
  const notes = out
    .split(/\n/)
    .filter((l) => l.trim().startsWith('-'))
    .map((l) => l.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 6);

  return {
    verdict: rework && notes.length ? 'rework' : 'ok',
    notes,
    usage: response.usage,
    model: smallModelName,
    cost: costOf(smallModelName, response.usage),
  };
}
