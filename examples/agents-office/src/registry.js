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
  { file: 'agents/product-matcher.md',               block: 'Бот и подбор',        wave: 1 },
  { file: 'agents/telegram-bot-funnel-designer.md',  block: 'Бот и подбор',        wave: 1 },
  { file: 'agents/order-desk.md',                    block: 'Заказы',              wave: 2 },
  { file: 'agents/delivery-coordinator.md',          block: 'Заказы',              wave: 5 },
  { file: 'agents/broadcast-manager.md',             block: 'Удержание',           wave: 3 },
  { file: 'agents/telegram-channel-editor.md',       block: 'Удержание',           wave: 3 },
  { file: '../../support/support-legal-compliance-checker.md', block: 'Допуск и тексты', wave: 1 },
  { file: '../../marketing/marketing-content-creator.md',      block: 'Допуск и тексты', wave: 1 },
  { file: '../../support/support-support-responder.md',        block: 'Поддержка',       wave: 2 },
  { file: '../../specialized/retail-customer-returns.md',      block: 'Поддержка',       wave: 5 },
  { file: '../../marketing/marketing-growth-hacker.md',        block: 'Первые покупатели', wave: 2 },
  { file: '../../marketing/marketing-private-domain-operator.md', block: 'Удержание',    wave: 3 },
  { file: '../../specialized/specialized-pricing-analyst.md',  block: 'Товар и деньги',  wave: 4 },
  { file: '../../support/support-finance-tracker.md',          block: 'Товар и деньги',  wave: 4 },
  { file: '../../support/support-analytics-reporter.md',       block: 'Цифры',           wave: 4 },
];

export function loadAgents(rootDir) {
  const agents = [];
  const missing = [];
  for (const entry of ROSTER) {
    const path = resolve(rootDir, entry.file);
    if (!existsSync(path)) { missing.push(entry.file); continue; }
    const agent = parseAgentFile(path);
    if (!agent) { missing.push(entry.file + ' (нет frontmatter)'); continue; }
    agents.push({ ...agent, block: entry.block, wave: entry.wave, custom: entry.file.startsWith('agents/') });
  }
  if (missing.length) console.warn('[registry] не найдены:', missing.join(', '));
  return agents;
}

/**
 * Пакет знаний магазина: папка `знания/`, которую собирает скрипт `обновить.py`
 * из рабочей базы. Это единственный источник фактов о товарах и ценах.
 * Если папки нет — откатываемся на простой BRAIN.md, чтобы приложение
 * оставалось рабочим для любого другого магазина.
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
    digest: read('срез.md'),
    catalog: read('товары.csv'),
    topics: read('темы.md'),
    competitors: read('конкуренты.md'),
    files: [],
    brain: '',
  };
  if (pack.present) {
    pack.files = readdirSync(dir).filter((f) => f.endsWith('.md') || f.endsWith('.csv')).sort();
  } else {
    for (const p of [join(rootDir, 'BRAIN.md'), resolve(rootDir, '../ecommerce-solo/BRAIN.md')]) {
      if (existsSync(p)) { pack.brain = readFileSync(p, 'utf8'); pack.files = [p]; break; }
    }
  }
  return pack;
}

// Кому нужны готовые разборы тем — это самый большой файл, грузим не всем.
const NEEDS_TOPICS = new Set([
  'content-creator', 'channel-editor', 'broadcast-manager',
  'product-matcher', 'support-responder', 'private-domain-operator',
]);

/** Собирает контекст под конкретного агента. */
export function composeContext(pack, agent) {
  if (!pack.present) {
    return pack.brain?.trim()
      ? `## Контекст бизнеса\n\n${pack.brain}`
      : 'Контекст бизнеса не заполнен. Не выдумывай товары, цены, сроки и правила — ' +
        'вместо этого перечисли, каких данных не хватает.';
  }
  const parts = [
    '## Бизнес\n' + pack.business,
    '## Как мы разговариваем\n' + pack.tone,
    '## Что нельзя писать про добавки\n' + pack.rules,
    '## Срез магазина\n' + pack.digest,
  ];
  if (NEEDS_TOPICS.has(agent?.id) && pack.topics) {
    parts.push('## Готовые разборы тем здоровья\n' + pack.topics);
  }
  parts.push(
    '## Каталог — единственный источник цен, остатков и названий\n' +
    'Формат CSV. Товар с остатком 0 не рекламируем и не предлагаем.\n\n' +
    '```csv\n' + pack.catalog + '```',
  );
  return parts.join('\n\n');
}
