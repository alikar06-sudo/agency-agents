import { useEffect, useState } from 'react';
import { setUI } from '@/state/store';
import { bus } from '@/core/bus';
import { audio } from '@/core/audio';

const SLIDES = [
  { title: 'Долина Этер', text: 'Тысячу лет назад четверо магов пришли в долину, где из скалы бил свет. Они назвали его Сердцем Эфира.' },
  { title: '', text: 'Вокруг Сердца выросла школа. Её стены помнят Пламя, Бастион, Корень и Звезду — четыре Круга, четыре пути.' },
  { title: '', text: 'Хроники говорят о четырёх Основателях. Хроники лгут. Был пятый. Его имя вычеркнули из всех книг.' },
  { title: 'Осень. Наши дни.', text: 'Под проливным дождём к воротам Академии подъезжает карета. В ней — новый ученик. Письмо о зачислении промокло, но печать цела.' },
  { title: '', text: 'Это вы.' },
];

export function Intro() {
  const [i, setI] = useState(0);
  useEffect(() => {
    audio.init();
    audio.setMusic('title');
    const t = setTimeout(() => next(), i === SLIDES.length - 1 ? 2600 : 6200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);
  function next() {
    bus.emit('sfx', { id: 'page' });
    if (i + 1 >= SLIDES.length) setUI({ screen: 'create' });
    else setI(i + 1);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Escape') setUI({ screen: 'create' }); else if (e.code === 'Space' || e.code === 'Enter') next(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const s = SLIDES[i];
  return (
    <div className="intro" onClick={next}>
      <div className="letterbox top" />
      <div className="intro-text" key={i}>
        {s.title && <h1>{s.title}</h1>}
        <p>{s.text}</p>
      </div>
      <div className="letterbox bottom" />
      <div className="intro-skip">Клик / Пробел — дальше · Esc — пропустить</div>
    </div>
  );
}
