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

export function loadBrain(rootDir) {
  const candidates = [
    join(rootDir, 'BRAIN.md'),
    resolve(rootDir, '../ecommerce-solo/BRAIN.md'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return { path: p, text: readFileSync(p, 'utf8') };
  }
  return { path: join(rootDir, 'BRAIN.md'), text: '' };
}
