// Отладочные хуки: ими пользуется автоматический прогон (scripts/qa.mjs).
import { engine } from '@/engine/Engine';
import { G, ui, setUI, mutate, useUI } from '@/state/store';
import { apply } from '@/systems/logic';
import { talkTo, choose, advance, currentNode, choicesFor, endDialogue } from '@/systems/dialogue';
import { startQuest, completeObjective, activeObjectives } from '@/systems/quests';
import { advanceTime } from '@/systems/time';
import { addItem } from '@/systems/inventory';
import { saveGame, listSaves } from '@/systems/save';
import { continueGame, newGame } from './game';
import { finishMinigame } from '@/ui/minigames/MinigameHost';
import type { ZoneId } from '@/data/types';
import { npcLocation } from '@/systems/schedule';

export function exposeDebug(): void {
  (window as unknown as Record<string, unknown>).__aether = {
    engine, G, ui, setUI, mutate, apply, talkTo, choose, advance, currentNode, choicesFor, endDialogue,
    startQuest, completeObjective, activeObjectives, advanceTime, addItem, saveGame, listSaves, continueGame, newGame,
    useUI,
    winMinigame: (score = 1) => { const r = ui().minigame; if (r) finishMinigame(r, score); },
    goto: (zone: ZoneId, spawn = 'start') => engine.enterZone(zone, spawn),
    tp: (x: number, z: number) => { engine.player.x = x; engine.player.z = z; engine.snapCamera(); },
    near: (npc: string) => { const n = engine.npcs.find(npc); if (n) { engine.player.x = n.x + 1.2; engine.player.z = n.z + 0.6; return true; } return false; },
    // Встать рядом с маркером зоны (по ключу или id).
    toMarker: (key: string) => {
      const m = engine.zone?.markers.find((mk) => mk.key === key || mk.def.id === key);
      if (!m) return false;
      const sp = engine.findSpawn(m.key);
      engine.player.x = sp.x; engine.player.z = sp.z;
      engine.snapCamera();
      return true;
    },
    // Использовать интерактивный объект так же, как по клавише E.
    use: (key: string) => {
      const it = engine.interact.items.find((i) => i.key === key || i.m.def.id === key);
      if (!it) return 'нет объекта';
      if (!it.condOk() || !it.obj.visible) return `недоступен (условие ${it.condOk()}, видим ${it.obj.visible}, раскрыт ${it.revealed}, открыт ${it.isOpened()})`;
      engine.player.x = it.x; engine.player.z = it.z + 1.1;
      it.use();
      return 'ok';
    },
    reveal: (key: string) => { const it = engine.interact.items.find((i) => i.key === key || i.m.def.id === key); return it ? it.reveal() : false; },
    enemies: () => engine.enemies.filter((e) => !e.dead).map((e) => ({ type: e.def.id, hp: e.hp, x: e.x, z: e.z })),
    // Нанести урон через настоящую боевую систему (события, награды, квесты).
    killAll: (type?: string) => {
      let n = 0;
      for (const e of [...engine.enemies]) {
        if (e.dead || (type && e.def.id !== type)) continue;
        for (let i = 0; i < 12 && !e.dead; i++) {
          e.invulnerable = false;
          engine.combat.damageEnemy(e, e.hp + 99999, 'arcane', { noCrit: true });
        }
        n++;
      }
      return n;
    },
    sleep: () => apply([{ sleep: true }]),
    where: (npc: string) => npcLocation(npc),
    setHour: (h: number) => { const m = G().time.min; const target = h * 60; advanceTime(target > m ? target - m : 1440 - m + target); },
  };
}
