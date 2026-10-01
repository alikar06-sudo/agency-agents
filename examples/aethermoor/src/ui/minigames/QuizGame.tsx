import { useEffect, useMemo, useState } from 'react';
import type { GameProps } from './MinigameHost';
import { Result } from './MinigameHost';
import { bus } from '@/core/bus';

// Вопросы учат игрока миру и механикам — теория здесь действительно полезна.
const BANK: { q: string; a: string[]; ok: number }[] = [
  { q: 'Что такое Эфир по учению магистра Лоу?', a: ['Чистая энергия, которую маг создаёт', 'Связь между всем живым', 'Особый вид огня', 'Газ из подземелий'], ok: 1 },
  { q: 'Сколько Основателей у Академии по официальным хроникам?', a: ['Три', 'Четыре', 'Пять', 'Семь'], ok: 1 },
  { q: 'Какое заклинание отпугивает тени и освещает тёмные залы?', a: ['Порыв', 'Светоч', 'Оковы', 'Иней'], ok: 1 },
  { q: 'Что произойдёт, если ударить Пламенем по замороженной цели?', a: ['Ничего', 'Паровой взрыв', 'Цель исцелится', 'Лёд станет крепче'], ok: 1 },
  { q: 'Какой Круг славится защитной магией?', a: ['Круг Пламени', 'Круг Корня', 'Круг Бастиона', 'Круг Звезды'], ok: 2 },
  { q: 'Чем опасна вода озера и как её пересечь?', a: ['Ничем, она мелкая', 'Её можно заморозить Инеем', 'Нужно сжечь её Пламенем', 'Только вплавь'], ok: 1 },
  { q: 'Что проявляет «Откровение»?', a: ['Скрытые знаки и тайные проходы', 'Слабости врагов', 'Время суток', 'Будущее'], ok: 0 },
  { q: 'После какого удара колокола ученики должны быть в спальнях?', a: ['Восьмого', 'Девятого', 'Десятого', 'Двенадцатого'], ok: 2 },
  { q: 'Как называется резонанс Молнии по скованной цели?', a: ['Громовые оковы', 'Огненный вихрь', 'Ледяной раскол', 'Звездопад'], ok: 0 },
  { q: 'Кто из Основателей связан со звездой и вопросом?', a: ['Аэла', 'Торвальд', 'Сильвия', 'Орин'], ok: 3 },
  { q: 'Что делает идеально выставленный щит?', a: ['Лечит', 'Отражает снаряды обратно', 'Ускоряет', 'Ничего особенного'], ok: 1 },
  { q: 'Где хранилась печать Камня?', a: ['В подземельях', 'В Старых руинах', 'На озере', 'В башне'], ok: 1 },
  { q: 'Почему порядок ингредиентов в зелье важнее состава?', a: ['Так написано в уставе', 'Эфир связывает вещества по очереди', 'Иначе котёл взорвётся', 'Это суеверие'], ok: 1 },
  { q: 'Что такое печать, по словам магистра Корвина?', a: ['Замок из стали', 'Руна, убеждающая дверь быть стеной', 'Проклятие', 'Карта'], ok: 1 },
  { q: 'Чем слабы Теневые гончие?', a: ['Холодом', 'Огнём', 'Молнией', 'Ничем'], ok: 1 },
  { q: 'Что значит «Маг не создаёт, а просит»?', a: ['Магия — договор с миром', 'Магия покупается', 'Магия опасна', 'Магия только у избранных'], ok: 0 },
];

export function QuizGame({ req, onFinish, onCancel }: GameProps) {
  const diff = req.difficulty ?? 1;
  const total = 4 + diff;
  const qs = useMemo(() => [...BANK].sort(() => Math.random() - 0.5).slice(0, total), [total]);
  const [i, setI] = useState(0);
  const [right, setRight] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [left, setLeft] = useState(15);
  const [done, setDone] = useState<number | null>(null);
  const q = qs[i];
  useEffect(() => {
    if (pick !== null || done !== null) return;
    const t = setInterval(() => setLeft((l) => { if (l <= 0.1) { clearInterval(t); answer(-1); return 0; } return l - 0.1; }), 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, pick, done]);
  const answer = (k: number) => {
    if (pick !== null) return;
    setPick(k);
    const ok = k === q.ok;
    if (ok) setRight((r) => r + 1);
    bus.emit('sfx', { id: ok ? 'objective' : 'ui_error' });
    setTimeout(() => {
      if (i + 1 >= qs.length) setDone((right + (ok ? 1 : 0)) / qs.length);
      else { setI(i + 1); setPick(null); setLeft(15); }
    }, 1100);
  };
  if (done !== null) return <div className="mg panel panel-frame"><Result score={done} title={req.title ?? 'Магическая теория'} onDone={() => onFinish(done)} extra={`верно ${right} из ${qs.length}`} /></div>;
  return (
    <div className="mg panel panel-frame">
      <div className="mg-head"><div className="t">{req.title ?? 'Магическая теория'}</div><div className="dim">Вопрос {i + 1} из {qs.length}</div></div>
      <div className="timer-bar"><div style={{ width: `${(left / 15) * 100}%` }} /></div>
      <div className="quiz-q">{q.q}</div>
      <div className="quiz-opts">
        {q.a.map((a, k) => (
          <button key={k} className={'quiz-opt' + (pick !== null && k === q.ok ? ' right' : '') + (pick === k && k !== q.ok ? ' wrong' : '')} disabled={pick !== null} onClick={() => answer(k)}>
            <span className="gold">{k + 1}.</span> {a}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}><button className="btn small ghost" onClick={onCancel}>Уйти с урока</button></div>
    </div>
  );
}
