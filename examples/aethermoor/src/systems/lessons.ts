// Учёба: уроки и экзамены как мини-игры с оценками, наградами и прогрессом по предметам.
import type { MinigameRequest, SubjectId } from '@/data/types';
import { SUBJECTS } from '@/data/world';
import { G, mutate, setUI, toast } from '@/state/store';
import { apply } from './logic';
import { bus } from '@/core/bus';
import { advanceTime } from './time';
import { gainXp } from './player';

export const GRADES = [
  { min: 0.85, name: 'Превосходно', short: 'П', points: 15, gold: 25 },
  { min: 0.65, name: 'Хорошо', short: 'Х', points: 10, gold: 15 },
  { min: 0.4, name: 'Удовлетворительно', short: 'У', points: 5, gold: 5 },
  { min: 0, name: 'Неудовлетворительно', short: 'Н', points: 0, gold: 0 },
];

export function gradeFor(score: number) { return GRADES.find((g) => score >= g.min)!; }

let pending: { subject: SubjectId; exam: boolean; index: number } | null = null;

export function startLesson(subject: SubjectId): void {
  const sub = SUBJECTS[subject];
  const st = G().subjects[subject];
  const exam = st.lessons >= sub.lessons.length;
  if (exam && st.exam) { toast('info', 'Экзамен уже сдан'); return; }
  const index = st.lessons;
  pending = { subject, exam, index };
  const title = exam ? sub.exam.title : `${sub.name}: ${sub.lessons[index].title}`;
  const difficulty = exam ? 4 : index + 1;
  const type = sub.minigame;
  // вступление учителя
  setUI({ read: null });
  if (!exam) toast('info', title, sub.lessons[index].text);
  if (type === 'arena') {
    bus.emit('sfx', { id: 'quest_start' });
    import('@/engine/challenge').then((m) => m.startArena(subject, index, exam));
    return;
  }
  const req: MinigameRequest = {
    type: type as MinigameRequest['type'], id: `lesson_${subject}`, difficulty, title,
    recipe: subject === 'potions' ? (['healing', 'mana', 'stoneskin', 'elixir_power'][Math.min(3, index)]) : undefined,
    opponent: subject === 'defense' ? (exam ? 'corvin' : 'dummy') : undefined,
  };
  setUI({ minigame: req });
}

// Вызывается мини-игрой урока по завершении.
export function finishLesson(score: number): void {
  if (!pending) return;
  const { subject, exam, index } = pending;
  pending = null;
  const sub = SUBJECTS[subject];
  const grade = gradeFor(score);
  advanceTime(60);
  if (grade.points === 0) {
    toast('warn', `Оценка: ${grade.name}`, 'Попробуйте снова завтра — наставник верит в вас.');
    mutate((g) => { g.subjects[subject].lastDay = g.time.day; });
    return;
  }
  mutate((g) => {
    const s = g.subjects[subject];
    s.lastDay = g.time.day;
    s.best = Math.max(s.best, score);
    if (exam) s.exam = grade.short;
    else s.lessons = Math.min(sub.lessons.length, s.lessons + 1);
    g.counters.lessons = (g.counters.lessons ?? 0) + 1;
  });
  toast('quest', `${exam ? 'Экзамен' : 'Урок'}: ${grade.name}`, `${sub.name}`);
  apply([{ circlePoints: grade.points }, { gold: grade.gold }]);
  gainXp(exam ? 260 : 90 + index * 20);
  if (exam) apply(sub.exam.reward);
  else apply(sub.lessons[index].reward);
  if (exam) apply([{ journal: `Сдан экзамен «${sub.name}» — оценка «${grade.name}».` }]);
  bus.emit('lessonDone', { subject, score });
  if (Object.values(G().subjects).every((s) => s.exam)) apply([{ achievement: 'scholar' }]);
}

export function cancelLesson(): void { pending = null; }
export function lessonPending(): boolean { return pending !== null; }
