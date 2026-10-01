import { useState } from 'react';
import { useGame } from '@/state/store';
import { LORE, ACHIEVEMENTS, SUBJECTS, WEEKDAYS, CIRCLES } from '@/data/world';
import { NPCS } from '@/data/npcs';
import { dateString } from '@/systems/time';
import { weekdayOf } from '@/systems/logic';
import type { CircleId, SubjectId } from '@/data/types';

type Sub = 'log' | 'lore' | 'schedule' | 'ach' | 'stats';

export function JournalTab() {
  const g = useGame((s) => s.g!);
  const [sub, setSub] = useState<Sub>('log');
  const [lore, setLore] = useState<string | null>(g.lore[0] ?? null);
  const today = weekdayOf(g.time.day);
  return (
    <div className="col" style={{ flex: 1, minHeight: 0 }}>
      <div className="filters">
        <button className={sub === 'log' ? 'on' : ''} onClick={() => setSub('log')}>Записи</button>
        <button className={sub === 'lore' ? 'on' : ''} onClick={() => setSub('lore')}>Хроника ({g.lore.length})</button>
        <button className={sub === 'schedule' ? 'on' : ''} onClick={() => setSub('schedule')}>Расписание</button>
        <button className={sub === 'ach' ? 'on' : ''} onClick={() => setSub('ach')}>Достижения ({g.achievements.length}/{Object.keys(ACHIEVEMENTS).length})</button>
        <button className={sub === 'stats' ? 'on' : ''} onClick={() => setSub('stats')}>Статистика</button>
      </div>
      {sub === 'log' && (
        <div className="scroll card" style={{ flex: 1, minHeight: 0, lineHeight: 1.6 }}>
          {g.journal.length === 0 && <div className="faint">Дневник пока пуст. Важные события появятся здесь сами.</div>}
          {[...g.journal].reverse().map((e, i) => (
            <div key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(227,196,107,0.08)' }}>
              <div className="gold title-font" style={{ fontSize: 15 }}>{dateString(e.day)}</div>
              <div>{e.text}</div>
            </div>
          ))}
        </div>
      )}
      {sub === 'lore' && (
        <div className="cols side" style={{ flex: 1 }}>
          <div className="col scroll">
            {Object.keys(LORE).map((id) => (
              <div key={id} className={'list-item' + (lore === id ? ' on' : '')} style={{ opacity: g.lore.includes(id) ? 1 : 0.4 }} onClick={() => g.lore.includes(id) && setLore(id)}>
                <div className="t">{g.lore.includes(id) ? LORE[id].title : '— не найдено —'}</div>
              </div>
            ))}
          </div>
          <div className="col read-doc" style={{ width: 'auto', maxHeight: 'none', animation: 'none' }}>
            {lore && g.lore.includes(lore) ? (<><h2>{LORE[lore].title}</h2><p>{LORE[lore].text}</p></>) : <p>Страницы хроники разбросаны по долине: на кафедрах, в книгах, в руинах.</p>}
          </div>
        </div>
      )}
      {sub === 'schedule' && (
        <div className="scroll card" style={{ flex: 1, minHeight: 0 }}>
          <div className="dim" style={{ marginBottom: 10 }}>Уроки идут с 9:00 до 18:00. Подойдите к наставнику в его классе и выберите «Начать урок». Один урок по предмету в день. После трёх уроков — экзамен.</div>
          <div style={{ display: 'grid', gridTemplateColumns: `200px repeat(7, 1fr)`, gap: 4, fontSize: 14 }}>
            <div />
            {WEEKDAYS.map((d, i) => <div key={d} className="title-font" style={{ textAlign: 'center', color: i === today ? 'var(--gold-2)' : undefined, fontWeight: i === today ? 700 : 400 }}>{d.slice(0, 2)}</div>)}
            {(Object.keys(SUBJECTS) as SubjectId[]).map((s) => (
              <div key={s} style={{ display: 'contents' }}>
                <div><div className="title-font" style={{ fontSize: 16 }}>{SUBJECTS[s].name}</div><div className="faint" style={{ fontSize: 12 }}>{NPCS[SUBJECTS[s].teacher]?.name} · {SUBJECTS[s].room}</div></div>
                {WEEKDAYS.map((_, i) => <div key={i} style={{ textAlign: 'center', alignSelf: 'center', color: SUBJECTS[s].days.includes(i) ? 'var(--gold)' : 'var(--text-faint)' }}>{SUBJECTS[s].days.includes(i) ? '●' : '·'}</div>)}
              </div>
            ))}
          </div>
          <div className="divider">Кубок Кругов</div>
          {(Object.keys(CIRCLES) as CircleId[]).sort((a, b) => g.circlePoints[b] - g.circlePoints[a]).map((c, i) => (
            <div key={c} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: c === g.player.circle ? 'var(--gold-2)' : undefined }}>
              <span>{i + 1}. {CIRCLES[c].name}</span><span>{g.circlePoints[c]}</span>
            </div>
          ))}
        </div>
      )}
      {sub === 'ach' && (
        <div className="scroll" style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8, alignContent: 'start' }}>
          {Object.entries(ACHIEVEMENTS).map(([id, a]) => {
            const got = g.achievements.includes(id);
            if (!got && a.hidden) return <div key={id} className="card" style={{ opacity: 0.4 }}><div className="title-font">Тайное достижение</div></div>;
            return (
              <div key={id} className="card" style={{ opacity: got ? 1 : 0.5, borderColor: got ? 'var(--gold-dim)' : undefined }}>
                <div className="title-font" style={{ fontSize: 18, color: got ? 'var(--gold-2)' : undefined }}>{got ? '★ ' : '☆ '}{a.name}</div>
                <div className="faint" style={{ fontSize: 13 }}>{a.desc}</div>
              </div>
            );
          })}
        </div>
      )}
      {sub === 'stats' && (
        <div className="scroll card" style={{ flex: 1, minHeight: 0 }}>
          <div className="kv" style={{ maxWidth: 520 }}>
            <div className="k">Время в игре</div><div className="v">{Math.floor(g.playTime / 3600)} ч {Math.floor((g.playTime % 3600) / 60)} мин</div>
            <div className="k">День в Академии</div><div className="v">{g.time.day}</div>
            <div className="k">Акт</div><div className="v">{g.act}</div>
            <div className="k">Побеждено противников</div><div className="v">{g.counters.kills ?? 0}</div>
            <div className="k">Сотворено заклинаний</div><div className="v">{g.counters.casts ?? 0}</div>
            <div className="k">Резонансов вызвано</div><div className="v">{g.counters.combos ?? 0}</div>
            <div className="k">Уроков пройдено</div><div className="v">{g.counters.lessons ?? 0}</div>
            <div className="k">Заданий выполнено</div><div className="v">{g.counters.questsDone ?? 0}</div>
            <div className="k">Открыто сундуков</div><div className="v">{g.counters.chests ?? 0}</div>
            <div className="k">Собрано трав и руды</div><div className="v">{g.counters.harvested ?? 0}</div>
            <div className="k">Создано предметов</div><div className="v">{g.counters.crafted ?? 0}</div>
            <div className="k">Знаков Основателей</div><div className="v">{g.counters.founder_marks ?? 0} / 8</div>
            <div className="k">Заработано крон</div><div className="v">{g.counters.goldEarned ?? 0}</div>
            <div className="k">Потеряно сознание</div><div className="v">{g.counters.deaths ?? 0}</div>
            <div className="k">Пойман патрулём</div><div className="v">{Number(g.flags.times_caught ?? 0)}</div>
          </div>
        </div>
      )}
    </div>
  );
}
