import { useEffect, useState } from 'react';
import { listSaves, saveGame, deleteSave, SLOTS, SLOT_NAMES } from '@/systems/save';
import type { SaveMeta } from '@/systems/save';
import { continueGame } from '@/game/game';
import { hasGame } from '@/state/store';
import { MONTHS, WEEKDAYS_SHORT } from '@/data/world';

function fmtPlay(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h ? `${h} ч ${m} мин` : `${m} мин`;
}
function fmtDay(day: number, min: number): string {
  const wd = (day + 5) % 7;
  return `${WEEKDAYS_SHORT[wd]}, ${((day - 1) % 30) + 1} ${MONTHS[Math.floor((day - 1) / 30) % MONTHS.length]}, ${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`;
}

export function SaveLoad({ mode, onClose, onLoaded }: { mode: 'save' | 'load'; onClose: () => void; onLoaded?: () => void }) {
  const [saves, setSaves] = useState<SaveMeta[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const refresh = () => { void listSaves().then(setSaves); };
  useEffect(refresh, []);
  const bySlot = new Map((saves ?? []).map((s) => [s.slot, s]));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal panel panel-frame" onClick={(e) => e.stopPropagation()}>
        <h2>{mode === 'save' ? 'Сохранить игру' : 'Загрузить игру'}</h2>
        <div className="dim" style={{ marginBottom: 12 }}>{mode === 'save' ? 'Выберите ячейку. Автосохранение происходит при смене области и сне.' : 'Выберите сохранение.'}</div>
        <div className="scroll" style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          {saves === null && <div className="faint">Читаю летописи…</div>}
          {saves !== null && SLOTS.filter((s) => mode === 'load' || s !== 'auto').map((slot) => {
            const m = bySlot.get(slot);
            return (
              <div key={slot} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div className="title-font gold" style={{ fontSize: 19 }}>{SLOT_NAMES[slot]}</div>
                  {m ? (
                    <div className="dim" style={{ fontSize: 14 }}>
                      {m.name} · ур. {m.level} · {m.circle} · Акт {m.act}<br />
                      {m.zoneName} · {fmtDay(m.day, m.min)} · в игре {fmtPlay(m.playTime)}
                      {m.source === 'cloud' && <span className="chip" style={{ marginLeft: 6 }}>облако</span>}
                    </div>
                  ) : <div className="faint" style={{ fontSize: 14 }}>Пусто</div>}
                </div>
                {mode === 'save' && hasGame() && (
                  <button className="btn small primary" disabled={busy} onClick={async () => { setBusy(true); await saveGame(slot); setBusy(false); refresh(); }}>Сохранить</button>
                )}
                {mode === 'load' && m && (
                  <button className="btn small primary" disabled={busy} onClick={async () => { setBusy(true); const ok = await continueGame(slot); setBusy(false); if (ok) onLoaded?.(); }}>Загрузить</button>
                )}
                {m && slot !== 'auto' && (
                  confirmDel === slot
                    ? <button className="btn small danger" onClick={async () => { setConfirmDel(null); await deleteSave(slot); refresh(); }}>Удалить?</button>
                    : <button className="btn small ghost danger" title="Удалить сохранение" onClick={() => setConfirmDel(slot)}>✕</button>
                )}
              </div>
            );
          })}
        </div>
        <div className="actions"><button className="btn" onClick={onClose}>Закрыть</button></div>
      </div>
    </div>
  );
}
