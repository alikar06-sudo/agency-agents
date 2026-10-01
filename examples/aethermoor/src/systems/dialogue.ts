// Диалоги: выбор ветки по условиям, проверки характеристик, последствия выборов.
import type { DialogueChoice, DialogueDef, DialogueNode } from '@/data/types';
import { G, mutate, setUI, ui } from '@/state/store';
import { DIALOGUES } from '@/data/dialogues';
import { NPCS, VOICES } from '@/data/npcs';
import { apply, checkAll, describeCond, fmt } from './logic';
import { bus } from '@/core/bus';

let seq = 1;

export function dialogueDef(id: string): DialogueDef | undefined { return DIALOGUES[id]; }

// Какой разговор начнёт NPC прямо сейчас — первый подходящий по условиям.
export function pickDialogue(npcId: string): string | null {
  const npc = NPCS[npcId];
  if (!npc) return null;
  for (const d of npc.dialogues) {
    if (checkAll(d.if) && DIALOGUES[d.id]) return d.id;
  }
  return null;
}

export function talkTo(npcId: string): boolean {
  const id = pickDialogue(npcId);
  if (!id) return false;
  mutate((g) => {
    g.flags[`met_${npcId}`] = true;
    g.counters[`talk_${npcId}`] = (g.counters[`talk_${npcId}`] ?? 0) + 1;
  });
  startDialogue(id, npcId);
  return true;
}

export function startDialogue(id: string, npc?: string): void {
  const def = DIALOGUES[id];
  if (!def) { console.warn('Нет диалога', id); return; }
  const speakerNpc = npc ?? def.npc;
  setUI({ dialogue: { dialogue: id, node: def.start, npc: speakerNpc, key: seq++ } });
  enterNode(def, def.start);
  bus.emit('sfx', { id: 'dialogue_open' });
}

function enterNode(def: DialogueDef, nodeId: string): void {
  const node = def.nodes[nodeId];
  if (!node) { console.warn('Нет узла', def.id, nodeId); endDialogue(); return; }
  apply(node.effects);
}

export function currentNode(): { def: DialogueDef; node: DialogueNode; id: string } | null {
  const d = ui().dialogue;
  if (!d) return null;
  const def = DIALOGUES[d.dialogue];
  const node = def?.nodes[d.node];
  return def && node ? { def, node, id: d.node } : null;
}

export interface ChoiceView { index: number; text: string; enabled: boolean; tag?: string; reason?: string }

export function choicesFor(node: DialogueNode): ChoiceView[] {
  const out: ChoiceView[] = [];
  (node.choices ?? []).forEach((c, index) => {
    if (c.once && G().flags[c.once]) return;
    if (!checkAll(c.if)) return;
    const enabled = checkAll(c.req);
    const failed = c.req?.find((r) => !checkAll([r]));
    out.push({ index, text: fmt(c.text), enabled, tag: c.tag, reason: failed ? describeCond(failed) : undefined });
  });
  return out;
}

export function choose(index: number): void {
  const cur = currentNode();
  if (!cur) return;
  const c: DialogueChoice | undefined = cur.node.choices?.[index];
  if (!c) return;
  if (!checkAll(c.req) || !checkAll(c.if)) return;
  if (c.once) mutate((g) => { g.flags[c.once!] = true; });
  bus.emit('sfx', { id: 'ui_click' });
  const before = ui().dialogue;
  apply(c.effects);
  // эффект мог открыть другой диалог или закрыть текущий
  if (ui().dialogue !== before) return;
  if (c.next) goto(cur.def, c.next);
  else endDialogue();
}

export function advance(): void {
  const cur = currentNode();
  if (!cur) return;
  if (cur.node.choices?.length) return;
  if (cur.node.next) goto(cur.def, cur.node.next);
  else endDialogue();
}

function goto(def: DialogueDef, nodeId: string): void {
  const d = ui().dialogue;
  if (!d) return;
  setUI({ dialogue: { ...d, node: nodeId, key: seq++ } });
  enterNode(def, nodeId);
}

export function endDialogue(): void {
  const d = ui().dialogue;
  if (!d) return;
  setUI({ dialogue: null });
  bus.emit('dialogueEnded', { npc: d.npc, dialogue: d.dialogue });
  if (d.npc) bus.emit('talked', { npc: d.npc });
}

export function speakerName(speaker?: string): string {
  if (!speaker || speaker === 'narrator') return '';
  if (speaker === 'player') return G().player.name;
  return NPCS[speaker]?.name ?? VOICES[speaker]?.name ?? speaker;
}
