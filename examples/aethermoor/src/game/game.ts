// Связывает системы, движок и интерфейс: новая игра, загрузка, выход в меню.
import { hooks, apply, hasScript } from '@/systems/logic';
import { startQuest, completeObjective, completeQuest, failQuest, initQuestSystem, reevaluate } from '@/systems/quests';
import { addItem, removeItem, countItem, equip } from '@/systems/inventory';
import { gainXp, healFull, derived } from '@/systems/player';
import { startDialogue } from '@/systems/dialogue';
import { advanceTime, hour, minutesUntil, resetTimeAcc } from '@/systems/time';
import { startLesson } from '@/systems/lessons';
import { unlockAchievement, initAchievements } from '@/systems/achievements';
import { initSaves, loadSave, saveGame, autosave } from '@/systems/save';
import { createGameState } from '@/state/gameState';
import type { GameState, NewCharacter } from '@/state/gameState';
import { G, hasGame, mutate, setGame, setUI, toast, ui, useSettings } from '@/state/store';
import { engine } from '@/engine/Engine';
import { audio } from '@/core/audio';
import { bus } from '@/core/bus';
import { SPELLS } from '@/data/spells';
import { setRecipeNameFn } from '@/systems/logic';
import { RECIPES } from '@/data/world';
import { registerStoryScripts } from '@/content/story';
import { initWorldEvents } from '@/systems/events';
import type { ZoneId } from '@/data/types';

let booted = false;

export function learnSpell(id: string): void {
  const sp = SPELLS[id];
  if (!sp || G().spells.known.includes(id)) return;
  mutate((g) => {
    g.spells.known.push(id);
    if (id !== 'spark') {
      const i = g.spells.slots.findIndex((s) => s === null);
      if (i >= 0 && !g.spells.slots.includes(id)) g.spells.slots[i] = id;
    }
  });
  toast('spell', `Новое заклинание: ${sp.name}`, `«${sp.incantation}» — ${sp.desc}`);
  bus.emit('sfx', { id: 'levelup' });
}

export function sleepUntilMorning(): void {
  const h = hour();
  const minutes = h >= 7 && h < 19 ? 180 : minutesUntil(7);
  setUI({ fade: true, waitMenu: false });
  setTimeout(() => {
    advanceTime(minutes);
    healFull();
    apply([{ setFlag: 'slept_first_night' }]);
    mutate((g) => { g.counters.nightsSlept = (g.counters.nightsSlept ?? 0) + 1; });
    bus.emit('sfx', { id: 'bell' });
    engine.refreshAmbient();
    autosave(true);
    setTimeout(() => {
      setUI({ fade: false });
      toast('info', h >= 7 && h < 19 ? 'Вы отдохнули' : 'Новый день', 'Здоровье и мана восстановлены. Игра сохранена.');
      bus.emit('flagSet', { flag: 'slept' });
      if (hasScript('afterSleep')) apply([{ script: 'afterSleep' }]);
    }, 500);
  }, 450);
}

export function bootGame(): void {
  if (booted) return;
  booted = true;
  Object.assign(hooks, {
    startQuest, completeObjective, completeQuest, failQuest,
    addItem: (id: string, qty: number, silent?: boolean) => addItem(id, qty, silent),
    removeItem, countItem: (id: string) => countItem(id), gainXp, learnSpell,
    startDialogue: (id: string, npc?: string) => startDialogue(id, npc),
    advanceTime: (m: number) => { advanceTime(m); engine.refreshAmbient(); },
    sleep: sleepUntilMorning,
    teleport: (zone: string, spawn: string) => engine.teleport(zone as ZoneId, spawn),
    startLesson: (s: string) => startLesson(s as never),
    unlockAchievement,
    heal: () => healFull(),
    setEnding: (id: string) => { mutate((g) => { g.ending = id; g.flags.game_ended = true; }); setUI({ ending: id, screen: 'ending' }); },
  });
  setRecipeNameFn((id) => RECIPES[id]?.name ?? id);
  initQuestSystem();
  initAchievements();
  registerStoryScripts();
  initWorldEvents();
  void initSaves();
  const syncVol = () => audio.setVolumes(useSettings.getState());
  useSettings.subscribe(syncVol);
  syncVol();
  bus.on('sfx', (e) => audio.play(e.id, { x: e.x, z: e.z, volume: e.volume, pitch: e.pitch }));
  bus.on('hourChanged', (e) => {
    if (e.hour === 22) toast('warn', 'Десятый удар колокола', 'Отбой. Ученикам пора в спальни.');
    if (e.hour % 3 === 0) bus.emit('sfx', { id: 'bell', volume: 0.5 });
    engine.refreshAmbient();
    engine.refreshSpawns();
  });
  bus.on('questUpdated', () => { engine.refreshSpawns(); engine.resetReached(); });
  bus.on('flagSet', () => engine.refreshSpawns());
}

export function newGame(c: NewCharacter): void {
  const g = createGameState(c);
  setGame(g);
  const d = derived();
  mutate((s) => { s.player.hp = d.maxHp; s.player.mana = d.maxMana; });
  addItem('acceptance_letter', 1, true);
  addItem('potion_heal', 2, true);
  resetTimeAcc();
  startQuest('mq_arrival');
  engine.leaveTitle();
  setUI({ screen: 'game', menu: null, dialogue: null });
  void engine.enterZone('gates', 'start', { fade: true });
  setTimeout(() => toast('info', 'Управление', 'WASD — движение, E — говорить/взаимодействовать, Esc — меню. Цель задания отмечена золотом на мини-карте.'), 2500);
}

export async function continueGame(slot: string): Promise<boolean> {
  const s = await loadSave(slot);
  if (!s) { toast('warn', 'Сохранение не найдено'); return false; }
  startFromState(s);
  return true;
}

export function startFromState(s: GameState): void {
  setGame(s);
  resetTimeAcc();
  reevaluate();
  engine.leaveTitle();
  setUI({ screen: s.ending ? 'game' : 'game', menu: null, dialogue: null, dead: false, ending: null });
  void engine.enterZone(s.pos.zone, 'start', { fade: true, x: s.pos.x, z: s.pos.z, facing: s.pos.facing });
}

export async function exitToTitle(): Promise<void> {
  if (hasGame() && !G().ending) await saveGame('auto', true);
  setUI({ screen: 'title', menu: null, pauseMenu: false, dialogue: null, shop: null, craft: null, minigame: null, dead: false, boss: null, challenge: null, ending: null });
  setGame(null);
  await engine.showTitleScene();
  audio.setMusic('title');
}

export function equipStarter(): void {
  const g = G();
  for (const id of ['student_robe', 'apprentice_wand']) {
    const it = g.inventory.find((i) => i.id === id);
    if (it) equip(it.uid);
  }
}

export function isPlaying(): boolean { return hasGame() && ui().screen === 'game'; }
