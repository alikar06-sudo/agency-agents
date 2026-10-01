import type { DialogueDef } from '../types';
import { act1 } from './act1';
import { general } from './general';
import { story } from './story';

const all: DialogueDef[] = [...act1, ...general, ...story];

export const DIALOGUES: Record<string, DialogueDef> = {};
for (const d of all) {
  if (DIALOGUES[d.id]) console.warn('Повтор диалога', d.id);
  DIALOGUES[d.id] = d;
}

export function registerDialogues(list: DialogueDef[]): void {
  for (const d of list) DIALOGUES[d.id] = d;
}
