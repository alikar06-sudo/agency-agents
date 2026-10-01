import { useUI, setUI, toast } from '@/state/store';
import type { MinigameRequest } from '@/data/types';
import { lessonPending, finishLesson, cancelLesson } from '@/systems/lessons';
import { apply } from '@/systems/logic';
import { bus } from '@/core/bus';
import { craftResult } from '../overlays/Craft';
import { RECIPES } from '@/data/world';
import { ITEMS } from '@/data/items';
import { BrewGame } from './BrewGame';
import { RuneGame } from './RuneGame';
import { DuelGame } from './DuelGame';
import { QuizGame } from './QuizGame';
import { GlyphGame } from './GlyphGame';
import { CreatureGame } from './CreatureGame';
import { FlightGame } from './FlightGame';

export interface GameProps { req: MinigameRequest; onFinish: (score: number) => void; onCancel: () => void }

export function finishMinigame(req: MinigameRequest, score: number): void {
  setUI({ minigame: null });
  const isLesson = req.id.startsWith('lesson_') && lessonPending();
  if (isLesson) { finishLesson(score); return; }
  if (req.id.startsWith('craft_') && req.recipe) {
    const bonus = score >= 0.85 ? 1 : 0;
    craftResult(req.recipe, bonus);
    const r = RECIPES[req.recipe];
    toast('item', `${ITEMS[r.result].name} ×${r.count + bonus}`, score >= 0.85 ? 'Превосходное качество — бонусная порция!' : score >= 0.6 ? 'Хорошее качество' : 'Сойдёт');
    if (score >= 0.9) apply([{ achievement: 'brewer' }]);
    return;
  }
  const win = score >= (req.minScore ?? 0.5);
  bus.emit('minigameDone', { id: req.id, type: req.type, score, win });
  if (win) { apply(req.onWin); bus.emit('sfx', { id: 'quest_done' }); }
  else { apply(req.onLose); toast('warn', 'Не получилось', 'Можно попробовать ещё раз.'); }
}

export function MinigameHost() {
  const req = useUI((s) => s.minigame);
  if (!req) return null;
  const onFinish = (score: number) => finishMinigame(req, score);
  const onCancel = () => {
    setUI({ minigame: null });
    if (req.id.startsWith('lesson_')) { cancelLesson(); toast('info', 'Урок прерван', 'Вернитесь к наставнику, когда будете готовы.'); }
  };
  const props = { req, onFinish, onCancel };
  return (
    <div className="minigame">
      {req.type === 'brew' && <BrewGame {...props} />}
      {req.type === 'runes' && <RuneGame {...props} />}
      {req.type === 'duel' && <DuelGame {...props} />}
      {req.type === 'quiz' && <QuizGame {...props} />}
      {req.type === 'glyph' && <GlyphGame {...props} />}
      {req.type === 'creature' && <CreatureGame {...props} />}
      {req.type === 'flight' && <FlightGame {...props} />}
    </div>
  );
}

export function Result({ score, title, onDone, extra }: { score: number; title: string; onDone: () => void; extra?: string }) {
  const g = score >= 0.85 ? 'Превосходно' : score >= 0.65 ? 'Хорошо' : score >= 0.4 ? 'Удовлетворительно' : 'Неудачно';
  return (
    <div className="mg-result">
      <div className="faint">{title}</div>
      <div className="g">{g}</div>
      <div className="dim">{Math.round(score * 100)}%{extra ? ` · ${extra}` : ''}</div>
      <button className="btn primary" style={{ marginTop: 16 }} onClick={onDone} autoFocus>Продолжить</button>
    </div>
  );
}
