// Проверка целостности контента: карты, связность, ссылки между данными.
// Запуск: npm run validate
import { ZONES } from '../src/data/zones';
import { NPCS } from '../src/data/npcs';
import { DIALOGUES } from '../src/data/dialogues';
import { QUESTS } from '../src/data/quests';
import { ITEMS } from '../src/data/items';
import { SPELLS } from '../src/data/spells';
import { ENEMIES } from '../src/data/enemies';
import { RECIPES, SHOPS, SUBJECTS, LORE, ACHIEVEMENTS } from '../src/data/world';
import type { Cond, Effect, ZoneId } from '../src/data/types';

const errors: string[] = [];
const warns: string[] = [];
const err = (s: string) => errors.push(s);
const warn = (s: string) => warns.push(s);

const TERRAIN = new Set(['.', '=', '-', ',', ':', ';', 's', '~', 'w', '_']);
const WALLS = new Set(['#', 'H', '!', '|', 'o']);
const PROPS = new Set(['T', 'Y', 'B', 't', 'b', 'P', 'r', 'x', 'h', 'S', 'F', 'k', 'c', 'l', '*', '"', 'n', 'G', 'f', 'R', 'u', 'Q']);
const SOLID = new Set(['T', 'Y', 'B', 't', 'b', 'P', 'r', 'x', 'h', 'S', 'F', 'k', 'c', 'l', 'n', 'G', 'f', 'R', 'u', 'Q']);
const BLOCKING_KINDS = new Set(['chest', 'station', 'bed', 'board', 'waystone', 'crystal', 'brazier']);

// ---------- карты ----------
const markerKeys: Record<string, Set<string>> = {};
for (const [zid, z] of Object.entries(ZONES)) {
  const w = z.map[0].length;
  z.map.forEach((row, r) => { if (row.length !== w) err(`${zid}: строка ${r} длиной ${row.length}, ожидалось ${w}`); });
  const keys = new Set<string>();
  const counts: Record<string, number> = {};
  z.map.forEach((row) => {
    for (const ch of row) {
      if (TERRAIN.has(ch) || WALLS.has(ch)) continue;
      const m = z.markers[ch];
      if (m) {
        const n = counts[ch] ?? 0;
        counts[ch] = n + 1;
        keys.add(n === 0 ? m.id : `${m.id}_${n}`);
        keys.add(m.id);
        continue;
      }
      if (!PROPS.has(ch)) err(`${zid}: неизвестный символ '${ch}'`);
    }
  });
  for (const ch of Object.keys(z.markers)) if (!counts[ch]) warn(`${zid}: маркер '${ch}' (${z.markers[ch].id}) не встречается на карте`);
  markerKeys[zid] = keys;
}

// выходы и точки появления
for (const [zid, z] of Object.entries(ZONES)) {
  for (const m of Object.values(z.markers)) {
    if (m.kind !== 'exit') continue;
    if (!m.to || !ZONES[m.to]) { err(`${zid}: выход ${m.id} ведёт в несуществующую зону ${m.to}`); continue; }
    if (!m.spawn || !markerKeys[m.to].has(m.spawn)) err(`${zid}: выход ${m.id} → ${m.to}: нет точки ${m.spawn}`);
    const back = Object.values(ZONES[m.to].markers).some((x) => x.kind === 'exit' && x.to === zid);
    if (!back) warn(`${zid} → ${m.to}: нет обратного выхода`);
  }
  for (const m of Object.values(z.markers)) {
    if (m.kind === 'enemy' && (!m.enemy || !ENEMIES[m.enemy])) err(`${zid}: враг ${m.enemy} не существует`);
    if ((m.kind === 'herb' || m.kind === 'ore' || m.kind === 'pickup') && (!m.item || !ITEMS[m.item])) err(`${zid}: предмет ${m.item} у ${m.id} не существует`);
    for (const l of m.loot ?? []) if (!ITEMS[l.id]) err(`${zid}: лут ${l.id} не существует`);
    if (m.key && !ITEMS[m.key]) err(`${zid}: ключ ${m.key} не существует`);
    if (m.lore && !LORE[m.lore]) err(`${zid}: lore ${m.lore} не существует`);
    if (m.dialogue && !DIALOGUES[m.dialogue]) err(`${zid}: диалог ${m.dialogue} не существует`);
    checkEffects(m.effects, `${zid}:${m.id}`);
    checkConds(m.if, `${zid}:${m.id}`);
    checkConds(m.locked, `${zid}:${m.id}`);
  }
}

// связность: BFS от первой точки появления
for (const [zid, z] of Object.entries(ZONES)) {
  const h = z.map.length, w = z.map[0].length;
  // ice=true: вода проходима (замораживание «Инеем» — законный путь к островам)
  const pass = (c: number, r: number, ice = false) => {
    if (c < 0 || r < 0 || c >= w || r >= h) return false;
    const ch = z.map[r][c];
    if (WALLS.has(ch) || ch === '_' || (ch === '~' && !ice)) {
      return false;
    }
    const m = z.markers[ch];
    if (m) return !BLOCKING_KINDS.has(m.kind) && !(m.kind === 'light' && m.prop === 'fireplace');
    return !SOLID.has(ch);
  };
  let start: [number, number] | null = null;
  z.map.forEach((row, r) => { for (let c = 0; c < row.length; c++) { const m = z.markers[row[c]]; if (!start && m?.kind === 'spawn') start = [c, r]; } });
  if (!start) { err(`${zid}: нет ни одной точки появления`); continue; }
  const flood = (ice: boolean) => {
    const seen = new Set<number>();
    const q: [number, number][] = [start!];
    seen.add(start![1] * w + start![0]);
    while (q.length) {
      const [c, r] = q.shift()!;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc, nr = r + dr;
        if (seen.has(nr * w + nc) || !pass(nc, nr, ice)) continue;
        seen.add(nr * w + nc);
        q.push([nc, nr]);
      }
    }
    return seen;
  };
  const seen = flood(true);
  z.map.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      const m = z.markers[row[c]];
      if (!m || m.kind === 'secret' || m.kind === 'enemy' || m.kind === 'light') continue;
      // объект должен быть достижим (сам или соседняя клетка)
      const ok = seen.has(r * w + c) || [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => seen.has((r + dr) * w + (c + dc)));
      if (!ok && m.kind !== 'exit') err(`${zid}: недостижим ${m.kind} ${m.id} (${c},${r})`);
      if (!ok && m.kind === 'exit') err(`${zid}: недостижим выход ${m.id} (${c},${r})`);
    }
  });
}

// ---------- NPC ----------
for (const n of Object.values(NPCS)) {
  const check = (e: { zone: ZoneId; at: string }, ctx: string) => {
    if (!ZONES[e.zone]) err(`${n.id}: зона ${e.zone}`);
    else if (!markerKeys[e.zone].has(e.at)) err(`${n.id} (${ctx}): нет якоря ${e.at} в зоне ${e.zone}`);
  };
  n.schedule.forEach((e) => check(e, 'расписание'));
  n.overrides?.forEach((o, i) => { o.schedule.forEach((e) => check(e, 'override ' + i)); checkConds(o.if, n.id + ' override'); });
  for (const d of n.dialogues) { if (!DIALOGUES[d.id]) warn(`${n.id}: диалог ${d.id} не написан`); checkConds(d.if, `${n.id}:${d.id}`); }
  checkConds(n.presentIf, n.id + ' presentIf');
}

// ---------- диалоги ----------
for (const d of Object.values(DIALOGUES)) {
  if (!d.nodes[d.start]) err(`диалог ${d.id}: нет стартового узла ${d.start}`);
  for (const [nid, node] of Object.entries(d.nodes)) {
    if (node.next && !d.nodes[node.next]) err(`диалог ${d.id}.${nid}: next → ${node.next}`);
    if (node.speaker && !['player', 'narrator', 'hollow', 'mirror'].includes(node.speaker) && !NPCS[node.speaker]) err(`диалог ${d.id}.${nid}: говорящий ${node.speaker}`);
    checkEffects(node.effects, `${d.id}.${nid}`);
    for (const c of node.choices ?? []) {
      if (c.next && !d.nodes[c.next]) err(`диалог ${d.id}.${nid}: вариант → ${c.next}`);
      checkEffects(c.effects, `${d.id}.${nid}`);
      checkConds(c.if, `${d.id}.${nid}`);
      checkConds(c.req, `${d.id}.${nid}`);
    }
  }
}

// ---------- задания ----------
for (const q of Object.values(QUESTS)) {
  for (const o of q.objectives) {
    if (o.kind === 'collect' && (!o.target || !ITEMS[o.target])) err(`задание ${q.id}.${o.id}: предмет ${o.target}`);
    if (o.kind === 'kill' && o.target && !o.target.startsWith('tag:') && !ENEMIES[o.target]) err(`задание ${q.id}.${o.id}: враг ${o.target}`);
    if (o.kind === 'talk' && (!o.target || !NPCS[o.target])) err(`задание ${q.id}.${o.id}: NPC ${o.target}`);
    if (o.where) {
      if (!ZONES[o.where.zone]) err(`задание ${q.id}.${o.id}: зона ${o.where.zone}`);
      else if (o.where.marker && !markerKeys[o.where.zone].has(o.where.marker)) err(`задание ${q.id}.${o.id}: метка ${o.where.marker} в ${o.where.zone}`);
      if (o.where.npc && !NPCS[o.where.npc]) err(`задание ${q.id}.${o.id}: NPC ${o.where.npc}`);
    }
    if (o.kind === 'reach' && o.target && o.where && !markerKeys[o.where.zone]?.has(o.target)) err(`задание ${q.id}.${o.id}: цель reach ${o.target}`);
    checkEffects(o.onComplete, `${q.id}.${o.id}`);
    checkConds(o.if, `${q.id}.${o.id}`);
  }
  checkEffects(q.onStart, q.id); checkEffects(q.onComplete, q.id);
  if (q.next && !QUESTS[q.next]) err(`задание ${q.id}: next ${q.next}`);
  for (const it of q.rewards?.items ?? []) if (!ITEMS[it.id]) err(`задание ${q.id}: награда ${it.id}`);
}

// ---------- торговля, рецепты, предметы ----------
for (const r of Object.values(RECIPES)) {
  if (!ITEMS[r.result]) err(`рецепт ${r.id}: результат ${r.result}`);
  for (const i of r.ingredients) if (!ITEMS[i.id]) err(`рецепт ${r.id}: ингредиент ${i.id}`);
}
for (const [id, s] of Object.entries(SHOPS)) { for (const it of s.stock) if (!ITEMS[it]) err(`лавка ${id}: ${it}`); if (!NPCS[s.owner]) err(`лавка ${id}: владелец ${s.owner}`); }
for (const s of Object.values(SUBJECTS)) {
  if (!NPCS[s.teacher]) err(`предмет ${s.name}: учитель ${s.teacher}`);
  if (!markerKeys[s.zone]?.has(s.anchor)) err(`предмет ${s.name}: нет якоря ${s.anchor} в ${s.zone}`);
  s.lessons.forEach((l) => checkEffects(l.reward, s.name));
  checkEffects(s.exam.reward, s.name);
}
for (const e of Object.values(ENEMIES)) for (const l of e.loot) if (!ITEMS[l.item]) err(`враг ${e.id}: лут ${l.item}`);

function checkConds(cs: Cond[] | undefined, ctx: string): void {
  for (const c of cs ?? []) {
    if ('quest' in c && !QUESTS[c.quest]) err(`${ctx}: условие на задание ${c.quest}`);
    if ('objDone' in c || 'objActive' in c) {
      const [q, o] = 'objDone' in c ? c.objDone : (c as { objActive: [string, string] }).objActive;
      if (!QUESTS[q]) err(`${ctx}: задание ${q}`);
      else if (!QUESTS[q].objectives.some((x) => x.id === o)) err(`${ctx}: цель ${q}.${o}`);
    }
    if ('item' in c && !ITEMS[c.item]) err(`${ctx}: предмет ${c.item}`);
    if ('spell' in c && !SPELLS[c.spell]) err(`${ctx}: заклинание ${c.spell}`);
    if ('rel' in c && !NPCS[c.rel]) err(`${ctx}: NPC ${c.rel}`);
    if ('any' in c) checkConds(c.any, ctx);
    if ('not' in c) checkConds([c.not], ctx);
  }
}

function checkEffects(es: Effect[] | undefined, ctx: string): void {
  for (const e of es ?? []) {
    if ('give' in e && !ITEMS[e.give]) err(`${ctx}: выдача ${e.give}`);
    if ('take' in e && !ITEMS[e.take]) err(`${ctx}: изъятие ${e.take}`);
    if ('startQuest' in e && !QUESTS[e.startQuest]) err(`${ctx}: задание ${e.startQuest}`);
    if ('completeQuest' in e && !QUESTS[e.completeQuest]) err(`${ctx}: задание ${e.completeQuest}`);
    if ('completeObjective' in e) {
      const [q, o] = e.completeObjective;
      if (!QUESTS[q] || !QUESTS[q].objectives.some((x) => x.id === o)) err(`${ctx}: цель ${q}.${o}`);
    }
    if ('learnSpell' in e && !SPELLS[e.learnSpell]) err(`${ctx}: заклинание ${e.learnSpell}`);
    if ('learnRecipe' in e && !RECIPES[e.learnRecipe]) err(`${ctx}: рецепт ${e.learnRecipe}`);
    if ('rel' in e && !NPCS[e.rel]) err(`${ctx}: NPC ${e.rel}`);
    if ('openShop' in e && !SHOPS[e.openShop]) err(`${ctx}: лавка ${e.openShop}`);
    if ('lore' in e && !LORE[e.lore]) err(`${ctx}: lore ${e.lore}`);
    if ('achievement' in e && !ACHIEVEMENTS[e.achievement]) err(`${ctx}: достижение ${e.achievement}`);
    if ('startDialogue' in e && !DIALOGUES[e.startDialogue]) err(`${ctx}: диалог ${e.startDialogue}`);
    if ('teleport' in e && !markerKeys[e.teleport.zone]?.has(e.teleport.spawn)) err(`${ctx}: телепорт ${e.teleport.zone}:${e.teleport.spawn}`);
    if ('minigame' in e) { checkEffects(e.minigame.onWin, ctx); checkEffects(e.minigame.onLose, ctx); }
  }
}

for (const w of warns) console.log('⚠ ' + w);
for (const e of errors) console.log('✖ ' + e);
console.log(`\nЗоны: ${Object.keys(ZONES).length}, NPC: ${Object.keys(NPCS).length}, диалоги: ${Object.keys(DIALOGUES).length}, задания: ${Object.keys(QUESTS).length}, предметы: ${Object.keys(ITEMS).length}`);
console.log(errors.length ? `Ошибок: ${errors.length}` : 'Ошибок нет.');
process.exit(errors.length ? 1 : 0);
