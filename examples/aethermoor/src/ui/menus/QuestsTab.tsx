import { useState } from 'react';
import { useGame } from '@/state/store';
import { QUESTS, QUEST_TYPE_NAMES } from '@/data/quests';
import { activeObjectives, objectiveProgressText, setTracked, rewardText } from '@/systems/quests';
import { ZONES } from '@/data/zones';
import { NPCS } from '@/data/npcs';
import { checkAll } from '@/systems/logic';

export function QuestsTab() {
  const quests = useGame((s) => s.g!.quests);
  const tracked = useGame((s) => s.g!.tracked);
  useGame((s) => s.g!.inventory);
  const [filter, setFilter] = useState<'active' | 'done' | 'failed'>('active');
  const ids = Object.keys(quests).filter((q) => quests[q].state === filter && QUESTS[q]);
  const order = ['main', 'side', 'relationship', 'combat', 'puzzle', 'exploration', 'hidden', 'daily'];
  ids.sort((a, b) => order.indexOf(QUESTS[a].type) - order.indexOf(QUESTS[b].type));
  const [sel, setSel] = useState<string | null>(tracked ?? ids[0] ?? null);
  const q = sel && QUESTS[sel] ? QUESTS[sel] : null;
  const st = sel ? quests[sel] : null;
  const active = q && st?.state === 'active' ? activeObjectives(q.id).map((o) => o.id) : [];
  return (
    <div className="cols side">
      <div className="col">
        <div className="filters">
          <button className={filter === 'active' ? 'on' : ''} onClick={() => setFilter('active')}>Активные</button>
          <button className={filter === 'done' ? 'on' : ''} onClick={() => setFilter('done')}>Выполненные</button>
          <button className={filter === 'failed' ? 'on' : ''} onClick={() => setFilter('failed')}>Проваленные</button>
        </div>
        <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
          {ids.length === 0 && <div className="faint">Здесь пока пусто.</div>}
          {ids.map((id) => (
            <div key={id} className={'list-item' + (sel === id ? ' on' : '')} onClick={() => setSel(id)}>
              <div style={{ flex: 1 }}>
                <div className="t" style={{ color: QUESTS[id].type === 'main' ? 'var(--gold-2)' : undefined }}>{QUESTS[id].title}</div>
                <div className="s">{QUEST_TYPE_NAMES[QUESTS[id].type]}{QUESTS[id].act ? ` · Акт ${QUESTS[id].act}` : ''}</div>
              </div>
              {tracked === id && <span className="chip">◆</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="col card scroll">
        {!q && <div className="faint">Выберите задание.</div>}
        {q && st && (
          <>
            <div className="faint" style={{ letterSpacing: '0.15em', textTransform: 'uppercase', fontSize: 12 }}>{QUEST_TYPE_NAMES[q.type]}{q.giver && NPCS[q.giver] ? ` · ${NPCS[q.giver].name}` : ''}{q.zone ? ` · ${ZONES[q.zone].name}` : ''}</div>
            <div className="h3" style={{ fontSize: 30 }}>{q.title}</div>
            <p style={{ lineHeight: 1.6 }}>{q.summary}</p>
            <div className="divider">Цели</div>
            {q.objectives.filter((o) => st.done.includes(o.id) || active.includes(o.id) || (!o.if || checkAll(o.if))).map((o) => {
              const done = st.done.includes(o.id);
              const isActive = active.includes(o.id);
              if (!done && !isActive && st.state === 'active') return (
                <div key={o.id} className="quest-obj faint"><span className="mark">○</span><span>???</span></div>
              );
              return (
                <div key={o.id} className={'quest-obj' + (done ? ' done' : '')}>
                  <span className="mark">{done ? '✓' : '◆'}</span>
                  <span>{o.text} <span className="gold">{!done ? objectiveProgressText(q.id, o) : ''}</span>
                    {!done && o.where && <span className="faint" style={{ fontSize: 13 }}> — {ZONES[o.where.zone].name}</span>}
                    {!done && o.hint && <div className="faint" style={{ fontSize: 13, fontStyle: 'italic' }}>{o.hint}</div>}
                  </span>
                </div>
              );
            })}
            <div className="divider">Награда</div>
            <div className="dim">{rewardText(q)}</div>
            {q.consequences && <div className="faint" style={{ marginTop: 8, fontStyle: 'italic' }}>{q.consequences}</div>}
            {st.state === 'active' && (
              <div style={{ marginTop: 16 }}>
                <button className="btn small" onClick={() => setTracked(tracked === q.id ? null : q.id)}>{tracked === q.id ? 'Не отслеживать' : 'Отслеживать на экране'}</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
