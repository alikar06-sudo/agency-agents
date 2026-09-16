// Реестр агентов: читает markdown-файлы с frontmatter и превращает их в роли.
// Источники: локальная папка agents/ (агенты под этот магазин) и каталог репозитория.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename, resolve } from 'node:path';

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function parseAgentFile(path) {
  const raw = readFileSync(path, 'utf8');
  const match = raw.match(FRONTMATTER);
  if (!match) return null;

  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!m) continue;
    meta[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  if (!meta.name) return null;

  const body = raw.slice(match[0].length).trim();
  const id = meta.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  return {
    id,
    name: meta.name,
    description: meta.description || '',
    emoji: meta.emoji || '🤖',
    color: meta.color && meta.color.startsWith('#') ? meta.color : '#6366F1',
    vibe: meta.vibe || '',
    systemPrompt: body,
    file: basename(path),
    path,
  };
}

// Роли этого магазина: какой агент в каком блоке и в какой волне запуска.
// Пути к каталогу указаны относительно корня репозитория.
export const ROSTER = [
  // Допуск и тексты — всё, что уходит наружу, проходит здесь
  { file: '../../support/support-legal-compliance-checker.md', block: 'Допуск и тексты', wave: 1 },
  { file: '../../marketing/marketing-content-creator.md',      block: 'Допуск и тексты', wave: 1 },
  { file: 'agents/uzbek-editor.md',                            block: 'Допуск и тексты', wave: 1 },
  { file: 'agents/catalog-keeper.md',                          block: 'Допуск и тексты', wave: 2 },

  // Бот и витрина — путь покупателя внутри Telegram
  { file: 'agents/product-matcher.md',                         block: 'Бот и витрина', wave: 1 },
  { file: 'agents/telegram-bot-funnel-designer.md',            block: 'Бот и витрина', wave: 1 },
  { file: 'agents/merchandiser.md',                            block: 'Бот и витрина', wave: 2 },

  // Заказы
  { file: 'agents/order-desk.md',                              block: 'Заказы', wave: 2 },
  { file: 'agents/delivery-coordinator.md',                    block: 'Заказы', wave: 2 },
  { file: 'agents/returns-policy.md',                          block: 'Заказы', wave: 1 },

  // Удержание — повторные покупки и своя аудитория
  { file: 'agents/loyalty-manager.md',                         block: 'Удержание', wave: 2 },
  { file: 'agents/broadcast-manager.md',                       block: 'Удержание', wave: 3 },
  { file: 'agents/telegram-channel-editor.md',                 block: 'Удержание', wave: 3 },
  { file: '../../marketing/marketing-private-domain-operator.md', block: 'Удержание', wave: 3 },

  // Поддержка
  { file: '../../support/support-support-responder.md',        block: 'Поддержка', wave: 2 },
  { file: 'agents/direct-responder.md',                        block: 'Поддержка', wave: 2 },
  { file: 'agents/review-collector.md',                        block: 'Поддержка', wave: 3 },
  { file: '../../specialized/retail-customer-returns.md',      block: 'Поддержка', wave: 4 },
  { file: '../../product/product-feedback-synthesizer.md',     block: 'Поддержка', wave: 3 },

  // Товар и деньги
  { file: 'agents/margin-analyst.md',                          block: 'Товар и деньги', wave: 2 },
  { file: 'agents/restock-planner.md',                         block: 'Товар и деньги', wave: 2 },
  { file: '../../specialized/specialized-pricing-analyst.md',  block: 'Товар и деньги', wave: 3 },
  { file: '../../support/support-finance-tracker.md',          block: 'Товар и деньги', wave: 4 },

  // Трафик и визуал
  { file: '../../marketing/marketing-growth-hacker.md',        block: 'Трафик', wave: 2 },
  { file: '../../marketing/marketing-instagram-curator.md',    block: 'Трафик', wave: 3 },
  { file: '../../design/design-image-prompt-engineer.md',      block: 'Трафик', wave: 4 },

  // Цифры
  { file: '../../support/support-analytics-reporter.md',       block: 'Цифры', wave: 3 },
];

export function loadAgents(rootDir) {
  const agents = [];
  const missing = [];
  for (const entry of ROSTER) {
    const path = resolve(rootDir, entry.file);
    if (!existsSync(path)) { missing.push(entry.file); continue; }
    const agent = parseAgentFile(path);
    if (!agent) { missing.push(entry.file + ' (нет frontmatter)'); continue; }
    const tune = TUNING[agent.id] || {};
    agents.push({
      ...agent, ...tune,
      block: entry.block, wave: entry.wave, custom: entry.file.startsWith('agents/'),
    });
  }
  if (missing.length) console.warn('[registry] не найдены:', missing.join(', '));
  return agents;
}

/**
 * Пакет знаний магазина: папка `знания/` — выгрузка из работающего магазина.
 * Каталог живёт отдельно (см. catalog.js), сюда попадают текстовые разделы.
 */
export function loadKnowledge(rootDir) {
  const dir = join(rootDir, 'знания');
  const read = (f) => {
    const full = join(dir, f);
    return existsSync(full) ? readFileSync(full, 'utf8') : '';
  };
  const pack = {
    dir,
    present: existsSync(dir),
    business: read('бизнес.md'),
    tone: read('тон.md'),
    rules: read('правила.md'),
    delivery: read('доставка.md'),
    topics: read('темы.md'),
    questions: read('вопросы.md'),
    products: read('товары.md'),
    competitors: read('конкуренты.md'),
    database: read('база.md'),
    files: [],
    brain: '',
  };
  if (pack.present) {
    pack.files = readdirSync(dir)
      .filter((f) => /\.(md|csv|json)$/.test(f))
      .sort();
  } else {
    for (const p of [join(rootDir, 'BRAIN.md'), resolve(rootDir, '../ecommerce-solo/BRAIN.md')]) {
      if (existsSync(p)) { pack.brain = readFileSync(p, 'utf8'); pack.files = [p]; break; }
    }
  }
  return pack;
}

// Кто что читает: самые крупные разделы грузим только тем, кому они нужны.
const NEEDS_TOPICS = new Set([
  'content-creator', 'channel-editor', 'broadcast-manager', 'product-matcher',
  'merchandiser', 'loyalty-manager', 'uzbek-editor',
]);
const NEEDS_QUESTIONS = new Set([
  'support-responder', 'product-matcher', 'direct-responder', 'order-desk',
  'retail-customer-returns', 'returns-policy', 'review-collector',
]);
const NEEDS_COMPETITORS = new Set([
  'pricing-analyst', 'growth-hacker', 'business-strategist', 'ad-creative-strategist',
  'content-creator', 'merchandiser',
]);
const NEEDS_DATABASE = new Set([
  'analytics-reporter', 'finance-tracker', 'margin-analyst', 'restock-planner',
  'senior-developer', 'devops-automator', 'rapid-prototyper',
]);

// Глубина проработки и потолок ответа под роль. Механическим ролям высокая
// глубина не нужна — она только жжёт токены на рассуждение.
const TUNING = {
  // проверки и разборы по чек-листу
  'legal-compliance-checker': { effort: 'medium', maxTokens: 6000 },
  'catalog-keeper':           { effort: 'medium', maxTokens: 8000 },
  'restock-planner':          { effort: 'medium', maxTokens: 6000 },
  'margin-analyst':           { effort: 'medium', maxTokens: 8000 },
  // короткие ответы покупателю
  'order-desk':               { effort: 'medium', maxTokens: 4000 },
  'delivery-coordinator':     { effort: 'medium', maxTokens: 4000 },
  'support-responder':        { effort: 'medium', maxTokens: 4000 },
  'direct-responder':         { effort: 'medium', maxTokens: 4000 },
  'review-collector':         { effort: 'medium', maxTokens: 5000 },
  // тексты, где качество важнее экономии
  'content-creator':          { effort: 'high', maxTokens: 12000 },
  'channel-editor':           { effort: 'high', maxTokens: 12000 },
  'uzbek-editor':             { effort: 'high', maxTokens: 10000 },
  'product-matcher':          { effort: 'high', maxTokens: 8000 },
  'returns-policy':           { effort: 'high', maxTokens: 10000 },
  'instagram-curator':        { effort: 'high', maxTokens: 10000 },
  'image-prompt-engineer':    { effort: 'medium', maxTokens: 6000 },
  'feedback-synthesizer':     { effort: 'medium', maxTokens: 8000 },
};

/** Собирает контекст под конкретного агента. */
export function composeContext(pack, agent, catalog) {
  if (!pack.present) {
    return pack.brain?.trim()
      ? `## Контекст бизнеса\n\n${pack.brain}`
      : 'Контекст бизнеса не заполнен. Не выдумывай товары, цены, сроки и правила — ' +
        'вместо этого перечисли, каких данных не хватает.';
  }

  const parts = [pack.business, pack.tone, pack.rules, pack.delivery].filter(Boolean);

  if (NEEDS_TOPICS.has(agent?.id) && pack.topics) parts.push(pack.topics);
  if (NEEDS_QUESTIONS.has(agent?.id) && pack.questions) parts.push(pack.questions);
  if (NEEDS_COMPETITORS.has(agent?.id) && pack.competitors) parts.push(pack.competitors);
  if (NEEDS_DATABASE.has(agent?.id) && pack.database) parts.push(pack.database);

  if (catalog?.size) {
    const s = catalog.stats();
    parts.push(
      '# Каталог магазина\n\n' +
      `Всего ${s.total} позиций, в наличии ${s.inStock}. Цены от ${s.minPrice.toLocaleString('ru-RU')} ` +
      `до ${s.maxPrice.toLocaleString('ru-RU')} сум. Себестоимость заполнена у ${s.withCost} — ` +
      `маржу считаем только по ним. У ${s.noBrand} позиций не проставлен бренд.\n\n` +
      'Ниже полный индекс. Подробности любой позиции — инструментом `catalog_get`, ' +
      'подбор под задачу — `catalog_search`. Готовые карточки на русском и узбекском ' +
      'приходят вместе с результатом инструмента.\n' +
      catalog.index(),
    );
  }

  return parts.join('\n\n---\n\n');
}
