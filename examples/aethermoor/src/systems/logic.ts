// Интерпретатор условий и эффектов. Через него проходят все последствия выборов игрока.
import type { Cond, Effect } from '@/data/types';
import { G, mutate, setUI, toast, hasGame } from '@/state/store';
import type { GameState } from '@/state/gameState';
import { absMinutes } from '@/state/gameState';
import { bus } from '@/core/bus';
import { CIRCLES, FACTIONS, SUBJECTS } from '@/data/world';
import type { SubjectId } from '@/data/types';
import { NPCS } from '@/data/npcs';

// Реестр сценарных обработчиков ({ script: 'имя' }) — регистрируются в content/scripts.
type ScriptFn = (arg?: string | number) => void;
const scripts = new Map<string, ScriptFn>();
export function registerScript(name: string, fn: ScriptFn): void { scripts.set(name, fn); }
export function hasScript(name: string): boolean { return scripts.has(name); }

// Поздняя привязка систем, чтобы избежать циклов импортов при инициализации модулей.
export interface SystemHooks {
  startQuest(id: string): void;
  completeObjective(q: string, o: string): void;
  completeQuest(id: string): void;
  failQuest(id: string): void;
  addItem(id: string, qty: number, silent?: boolean): void;
  removeItem(id: string, qty: number): boolean;
  countItem(id: string): number;
  gainXp(n: number): void;
  learnSpell(id: string): void;
  startDialogue(id: string, npc?: string): void;
  advanceTime(min: number): void;
  sleep(): void;
  teleport(zone: string, spawn: string): void;
  startLesson(subject: string): void;
  unlockAchievement(id: string): void;
  heal(): void;
  setEnding(id: string): void;
}
export const hooks: SystemHooks = {} as SystemHooks;

export function hourNow(g: GameState = G()): number { return g.time.min / 60; }
export function weekdayOf(day: number): number { return (day + 5) % 7; } // день 1 — воскресенье

export function questState(id: string, g: GameState = G()): 'none' | 'active' | 'done' | 'failed' {
  return g.quests[id]?.state ?? 'none';
}

export function relOf(npc: string, g: GameState = G()): number { return g.rel[npc] ?? 0; }

// Урок доступен: день по расписанию, учебные часы, ещё не было сегодня, не все уроки пройдены.
export function lessonReady(s: SubjectId, g: GameState = G()): boolean {
  const sub = SUBJECTS[s];
  const st = g.subjects[s];
  const h = g.time.min / 60;
  if (st.lessons >= sub.lessons.length) return false;
  if (st.lastDay === g.time.day) return false;
  if (h < 8.5 || h >= 18) return false;
  return sub.days.includes(weekdayOf(g.time.day)) || g.time.day === 2;
}

export function examReady(s: SubjectId, g: GameState = G()): boolean {
  const sub = SUBJECTS[s];
  const st = g.subjects[s];
  const h = g.time.min / 60;
  return st.lessons >= sub.lessons.length && !st.exam && st.lastDay !== g.time.day && h >= 8.5 && h < 18;
}

// Союзники в финале: каждый — отдельное последствие решений игрока.
export function alliesCount(g: GameState = G()): number {
  let n = 0;
  if (!g.flags.corvin_arrested && (g.rel.corvin ?? 0) >= 15) n++;
  if (g.flags.cassian_ally) n++;
  if (g.flags.pellinor_spared) n++;
  if ((g.rel.mira ?? 0) >= 40) n++;
  if ((g.rep.forest ?? 0) >= 30) n++;
  return n;
}

export function check(c: Cond, g: GameState = G()): boolean {
  if ('flag' in c) {
    const v = g.flags[c.flag];
    return c.eq === undefined ? !!v : v === c.eq;
  }
  if ('notFlag' in c) return !g.flags[c.notFlag];
  if ('quest' in c) {
    const st = questState(c.quest, g);
    switch (c.is) {
      case 'started': return st !== 'none';
      case 'notDone': return st !== 'done';
      default: return st === c.is;
    }
  }
  if ('objDone' in c) return !!g.quests[c.objDone[0]]?.done.includes(c.objDone[1]);
  if ('objActive' in c) {
    const q = g.quests[c.objActive[0]];
    return !!q && q.state === 'active' && !q.done.includes(c.objActive[1]);
  }
  if ('item' in c) return hooks.countItem(c.item) >= (c.count ?? 1);
  if ('noItem' in c) return hooks.countItem(c.noItem) === 0;
  if ('rel' in c) {
    const v = relOf(c.rel, g);
    return (c.gte === undefined || v >= c.gte) && (c.lt === undefined || v < c.lt);
  }
  if ('rep' in c) {
    const v = g.rep[c.rep] ?? 0;
    return (c.gte === undefined || v >= c.gte) && (c.lt === undefined || v < c.lt);
  }
  if ('stat' in c) return (g.player.stats[c.stat] ?? 0) >= c.gte;
  if ('spell' in c) return g.spells.known.includes(c.spell);
  if ('noSpell' in c) return !g.spells.known.includes(c.noSpell);
  if ('hour' in c) {
    const h = hourNow(g);
    const [a, b] = c.hour;
    return a <= b ? h >= a && h < b : h >= a || h < b;
  }
  if ('weekday' in c) return c.weekday.includes(weekdayOf(g.time.day));
  if ('level' in c) return g.player.level >= c.level;
  if ('gold' in c) return g.player.gold >= c.gold;
  if ('gender' in c) return g.player.gender === c.gender;
  if ('origin' in c) return g.player.origin === c.origin;
  if ('circle' in c) return g.player.circle === c.circle;
  if ('act' in c) return g.act >= c.act && (c.lt === undefined || g.act < c.lt);
  if ('corruption' in c) return g.player.corruption >= c.corruption && (c.lt === undefined || g.player.corruption < c.lt);
  if ('lessons' in c) return (g.subjects[c.lessons]?.lessons ?? 0) >= c.gte;
  if ('exam' in c) return !!g.subjects[c.exam]?.exam;
  if ('any' in c) return c.any.some((x) => check(x, g));
  if ('not' in c) return !check(c.not, g);
  if ('day' in c) return g.time.day >= c.day;
  if ('counter' in c) return (g.counters[c.counter] ?? 0) >= c.gte;
  if ('lessonReady' in c) return lessonReady(c.lessonReady, g);
  if ('examReady' in c) return examReady(c.examReady, g);
  if ('whisper' in c) {
    const at = Number(g.flags[`whisper_${c.whisper}`] ?? -1e9);
    return (g.time.day * 1440 + g.time.min) - at < 30;
  }
  if ('allies' in c) return alliesCount(g) >= c.allies;
  return true;
}

export function checkAll(conds?: Cond[], g?: GameState): boolean {
  if (!conds || !conds.length) return true;
  if (!hasGame()) return false;
  const gs = g ?? G();
  return conds.every((c) => check(c, gs));
}

// Текст требования для заблокированного варианта ответа.
export function describeCond(c: Cond): string {
  if ('stat' in c) return `${{ int: 'Интеллект', power: 'Сила магии', defense: 'Защита', speed: 'Скорость' }[c.stat]} ${c.gte}`;
  if ('rel' in c) return `Отношения с ${NPCS[c.rel]?.name.split(' ')[0] ?? c.rel}: ${c.gte ?? 0}+`;
  if ('rep' in c) return `Репутация «${FACTIONS[c.rep].name}»: ${c.gte ?? 0}+`;
  if ('item' in c) return `Нужен предмет`;
  if ('spell' in c) return `Нужно заклинание`;
  if ('gold' in c) return `${c.gold} крон`;
  if ('level' in c) return `Уровень ${c.level}`;
  if ('corruption' in c) return `Порча ${c.corruption}+`;
  if ('lessonReady' in c) return 'Урок не по расписанию или уже был сегодня';
  if ('examReady' in c) return 'Экзамен пока недоступен';
  if ('whisper' in c) return 'Нужен «Шёпот»';
  if ('allies' in c) return `Нужно союзников: ${c.allies}`;
  return 'Условие не выполнено';
}

export function clampRel(v: number): number { return Math.max(-100, Math.min(100, v)); }

export function apply(effects?: Effect[]): void {
  if (!effects) return;
  for (const e of effects) applyOne(e);
}

export function applyOne(e: Effect): void {
  if ('setFlag' in e) {
    mutate((g) => { g.flags[e.setFlag] = e.value ?? true; });
    bus.emit('flagSet', { flag: e.setFlag });
    return;
  }
  if ('clearFlag' in e) { mutate((g) => { delete g.flags[e.clearFlag]; }); return; }
  if ('incFlag' in e) {
    mutate((g) => { g.flags[e.incFlag] = (Number(g.flags[e.incFlag]) || 0) + (e.by ?? 1); });
    bus.emit('flagSet', { flag: e.incFlag });
    return;
  }
  if ('rel' in e) {
    const npc = NPCS[e.rel];
    mutate((g) => { g.rel[e.rel] = clampRel((g.rel[e.rel] ?? 0) + e.delta); });
    if (npc) toast('rep', `${npc.name.split(' ')[0]}: ${e.delta > 0 ? 'отношение улучшилось' : 'отношение ухудшилось'}`, `${e.delta > 0 ? '+' : ''}${e.delta}`);
    return;
  }
  if ('rep' in e) {
    mutate((g) => { g.rep[e.rep] = Math.max(-100, Math.min(100, (g.rep[e.rep] ?? 0) + e.delta)); });
    const name = e.rep === 'circle' ? CIRCLES[G().player.circle].name : FACTIONS[e.rep].name;
    toast('rep', `Репутация: ${name}`, `${e.delta > 0 ? '+' : ''}${e.delta}`);
    if (e.rep === 'circle') applyOne({ circlePoints: Math.round(e.delta * 1.5) });
    return;
  }
  if ('circlePoints' in e) {
    mutate((g) => { g.circlePoints[g.player.circle] = Math.max(0, g.circlePoints[g.player.circle] + e.circlePoints); });
    toast('rep', `${e.circlePoints > 0 ? '+' : ''}${e.circlePoints} очков Кругу`, CIRCLES[G().player.circle].name);
    return;
  }
  if ('give' in e) { hooks.addItem(e.give, e.count ?? 1, e.silent); return; }
  if ('take' in e) { hooks.removeItem(e.take, e.count ?? 1); return; }
  if ('gold' in e) {
    mutate((g) => { g.player.gold = Math.max(0, g.player.gold + e.gold); });
    if (e.gold > 0) mutate((g) => { g.counters.goldEarned = (g.counters.goldEarned ?? 0) + e.gold; });
    toast('item', e.gold > 0 ? `+${e.gold} крон` : `${e.gold} крон`);
    bus.emit('sfx', { id: 'coins' });
    return;
  }
  if ('xp' in e) { hooks.gainXp(e.xp); return; }
  if ('startQuest' in e) { hooks.startQuest(e.startQuest); return; }
  if ('completeObjective' in e) { hooks.completeObjective(e.completeObjective[0], e.completeObjective[1]); return; }
  if ('completeQuest' in e) { hooks.completeQuest(e.completeQuest); return; }
  if ('failQuest' in e) { hooks.failQuest(e.failQuest); return; }
  if ('learnSpell' in e) { hooks.learnSpell(e.learnSpell); return; }
  if ('learnRecipe' in e) {
    if (!G().recipes.includes(e.learnRecipe)) {
      mutate((g) => { g.recipes.push(e.learnRecipe); });
      toast('info', 'Новый рецепт', recipeName(e.learnRecipe));
    }
    return;
  }
  if ('openShop' in e) { setUI({ shop: e.openShop }); return; }
  if ('openCraft' in e) { setUI({ craft: e.openCraft }); return; }
  if ('minigame' in e) { setUI({ minigame: e.minigame }); return; }
  if ('teleport' in e) { hooks.teleport(e.teleport.zone, e.teleport.spawn); return; }
  if ('setAct' in e) {
    if (G().act < e.setAct) mutate((g) => { g.act = e.setAct; });
    return;
  }
  if ('corruption' in e) {
    mutate((g) => { g.player.corruption = Math.max(0, Math.min(100, g.player.corruption + e.corruption)); });
    toast('warn', e.corruption > 0 ? 'Тьма шепчет громче' : 'Тьма отступает', `Порча ${e.corruption > 0 ? '+' : ''}${e.corruption}`);
    return;
  }
  if ('heal' in e) { hooks.heal(); return; }
  if ('journal' in e) {
    const text = fmt(e.journal);
    mutate((g) => { g.journal.push({ day: g.time.day, text }); });
    toast('info', 'Запись в дневнике', text.length > 60 ? text.slice(0, 57) + '…' : text);
    return;
  }
  if ('toast' in e) { toast('info', fmt(e.toast)); return; }
  if ('advanceTime' in e) { hooks.advanceTime(e.advanceTime); return; }
  if ('sleep' in e) { hooks.sleep(); return; }
  if ('script' in e) {
    const fn = scripts.get(e.script);
    if (fn) fn(e.arg); else console.warn('Неизвестный сценарий', e.script);
    return;
  }
  if ('statPoints' in e) {
    mutate((g) => { g.player.statPoints += e.statPoints; });
    toast('level', `+${e.statPoints} очк. характеристик`, 'Распределите во вкладке «Персонаж»');
    return;
  }
  if ('stat' in e) {
    mutate((g) => { g.player.stats[e.stat] += e.delta; });
    toast('level', 'Характеристика выросла', `${{ int: 'Интеллект', power: 'Сила магии', defense: 'Защита', speed: 'Скорость' }[e.stat]} +${e.delta}`);
    return;
  }
  if ('ending' in e) { hooks.setEnding(e.ending); return; }
  if ('lesson' in e) { hooks.startLesson(e.lesson); return; }
  if ('achievement' in e) { hooks.unlockAchievement(e.achievement); return; }
  if ('lore' in e) {
    if (!G().lore.includes(e.lore)) {
      mutate((g) => { g.lore.push(e.lore); });
      toast('info', 'Страница хроники найдена', 'Откройте «Дневник», чтобы прочитать');
    }
    return;
  }
  if ('startDialogue' in e) { hooks.startDialogue(e.startDialogue, e.npc); return; }
}

// Подстановки в тексте: {name}, {circle}, {g:пришёл|пришла}
let recipeNameFn: (id: string) => string = (id) => id;
export function setRecipeNameFn(fn: (id: string) => string): void { recipeNameFn = fn; }
function recipeName(id: string): string { return recipeNameFn(id); }

export function fmt(text: string, g?: GameState | null): string {
  const gs = g ?? (hasGame() ? G() : null);
  return text.replace(/\{(\w+)(?::([^}]*))?\}/g, (_m, key: string, arg?: string) => {
    if (!gs) return '';
    switch (key) {
      case 'name': return gs.player.name;
      case 'circle': return CIRCLES[gs.player.circle].name;
      case 'circleShort': return CIRCLES[gs.player.circle].short;
      case 'spec': return CIRCLES[gs.player.circle].spec;
      case 'motto': return CIRCLES[gs.player.circle].motto;
      case 'g': {
        const [m, f] = (arg ?? '').split('|');
        return gs.player.gender === 'f' ? (f ?? m) : m;
      }
      case 'time': {
        const h = Math.floor(gs.time.min / 60);
        return h < 12 ? 'утро' : h < 18 ? 'день' : 'вечер';
      }
      default: return _m;
    }
  });
}

export function nowAbs(): number { return absMinutes(G().time); }
