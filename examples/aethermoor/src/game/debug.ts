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

export function exposeDebug(): void {
  (window as unknown as Record<string, unknown>).__aether = {
    engine, G, ui, setUI, mutate, apply, talkTo, choose, advance, currentNode, choicesFor, endDialogue,
    startQuest, completeObjective, activeObjectives, advanceTime, addItem, saveGame, listSaves, continueGame, newGame,
    useUI,
    winMinigame: (score = 1) => { const r = ui().minigame; if (r) finishMinigame(r, score); },
    goto: (zone: ZoneId, spawn = 'start') => engine.enterZone(zone, spawn),
    tp: (x: number, z: number) => { engine.player.x = x; engine.player.z = z; },
    near: (npc: string) => { const n = engine.npcs.find(npc); if (n) { engine.player.x = n.x + 1.2; engine.player.z = n.z + 0.6; return true; } return false; },
    setHour: (h: number) => { const m = G().time.min; const target = h * 60; advanceTime(target > m ? target - m : 1440 - m + target); },
  };
}
