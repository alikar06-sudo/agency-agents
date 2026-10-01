import { useState } from 'react';
import { useUI, setUI, useGame, G, toast } from '@/state/store';
import { SaveLoad } from './SaveLoad';
import { SettingsPanel } from './SettingsPanel';
import { exitToTitle, sleepUntilMorning } from '@/game/game';
import { saveGame } from '@/systems/save';
import { dailyOffers, startQuest, completeQuest, activeObjectives } from '@/systems/quests';
import { QUESTS } from '@/data/quests';
import { countItem, removeItem } from '@/systems/inventory';
import { advanceTime, hour, clockString, minutesUntil } from '@/systems/time';
import { engine } from '@/engine/Engine';
import { ZONES } from '@/data/zones';
import { rewardText } from '@/systems/quests';
import { bus } from '@/core/bus';
import type { ZoneId } from '@/data/types';

export function PauseMenu() {
  const [sub, setSub] = useState<'save' | 'load' | 'settings' | null>(null);
  const close = () => setUI({ pauseMenu: false });
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal panel panel-frame" style={{ width: 'min(420px, calc(100vw - 32px))' }} onClick={(e) => e.stopPropagation()}>
        <h2>Пауза</h2>
        <div className="ornament" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <button className="btn primary" onClick={close}>Продолжить</button>
          <button className="btn" onClick={() => setSub('save')}>Сохранить игру</button>
          <button className="btn" onClick={() => setSub('load')}>Загрузить игру</button>
          <button className="btn" onClick={() => setSub('settings')}>Настройки</button>
          <button className="btn" onClick={() => { setUI({ pauseMenu: false, menu: 'journal' }); }}>Дневник и достижения</button>
          <button className="btn danger" onClick={async () => { await saveGame('auto', true); close(); void exitToTitle(); }}>Сохранить и выйти в меню</button>
        </div>
      </div>
      {sub === 'save' && <SaveLoad mode="save" onClose={() => setSub(null)} />}
      {sub === 'load' && <SaveLoad mode="load" onClose={() => setSub(null)} onLoaded={close} />}
      {sub === 'settings' && (
        <div className="modal-backdrop" onClick={(e) => { e.stopPropagation(); setSub(null); }}>
          <div className="modal panel panel-frame" style={{ width: 'min(760px, calc(100vw - 32px))', height: 'min(640px, calc(100vh - 40px))' }} onClick={(e) => e.stopPropagation()}>
            <h2>Настройки</h2>
            <SettingsPanel />
            <div className="actions"><button className="btn" onClick={() => setSub(null)}>Готово</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ReadOverlay() {
  const doc = useUI((s) => s.read);
  if (!doc) return null;
  const close = () => { setUI({ read: null }); bus.emit('sfx', { id: 'page' }); };
  if (doc.kind === 'board') return <Board onClose={close} />;
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="read-doc" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={close}>✕</button>
        <h2>{doc.title}</h2>
        {doc.body.split('\n').map((p, i) => <p key={i}>{p}</p>)}
      </div>
    </div>
  );
}

function Board({ onClose }: { onClose: () => void }) {
  const quests = useGame((s) => s.g!.quests);
  useGame((s) => s.g!.inventory);
  const offers = dailyOffers();
  const activeDailies = Object.keys(quests).filter((q) => QUESTS[q]?.type === 'daily' && quests[q].state === 'active');
  const handIn = (id: string) => {
    const def = QUESTS[id];
    for (const o of def.objectives) if (o.kind === 'collect' && o.target) removeItem(o.target, o.count ?? 1);
    completeQuest(id);
  };
  const ready = (id: string) => QUESTS[id].objectives.every((o) => o.kind !== 'collect' || countItem(o.target!) >= (o.count ?? 1)) && activeObjectives(id).every((o) => o.kind === 'collect');
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal panel panel-frame" style={{ width: 'min(620px, calc(100vw - 32px))' }} onClick={(e) => e.stopPropagation()}>
        <h2>Доска поручений</h2>
        <div className="dim">Мелкие поручения Академии. Обновляются каждое утро. Награда — кроны, опыт и благодарность.</div>
        <div className="divider">Сегодня</div>
        <div className="scroll" style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          {offers.length === 0 && <div className="faint">Сегодня поручений нет.</div>}
          {offers.map((id) => {
            const q = QUESTS[id];
            const st = quests[id];
            const doneToday = st?.state === 'done' && st.finishedDay === G().time.day;
            const active = st?.state === 'active';
            return (
              <div key={id} className="card" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div className="title-font gold" style={{ fontSize: 18 }}>{q.title.replace('Поручение: ', '')}</div>
                  <div className="dim" style={{ fontSize: 14 }}>{q.objectives[0].text}</div>
                  <div className="faint" style={{ fontSize: 13 }}>Награда: {rewardText(q)}</div>
                </div>
                {doneToday ? <span className="chip">Выполнено</span>
                  : active ? (ready(id) ? <button className="btn small primary" onClick={() => handIn(id)}>Сдать</button> : <span className="chip">В работе</span>)
                    : <button className="btn small" onClick={() => { startQuest(id); bus.emit('sfx', { id: 'ui_confirm' }); }}>Взять</button>}
              </div>
            );
          })}
          {activeDailies.filter((id) => !offers.includes(id)).map((id) => (
            <div key={id} className="card" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ flex: 1 }}><div className="title-font" style={{ fontSize: 17 }}>{QUESTS[id].title}</div><div className="faint" style={{ fontSize: 13 }}>Взято раньше</div></div>
              {ready(id) ? <button className="btn small primary" onClick={() => handIn(id)}>Сдать</button> : <span className="chip">В работе</span>}
            </div>
          ))}
        </div>
        <div className="actions"><button className="btn" onClick={onClose}>Закрыть</button></div>
      </div>
    </div>
  );
}

export function WaitMenu() {
  const time = useGame((s) => s.g!.time);
  const zone = useGame((s) => s.g!.pos.zone);
  const nearBed = engine.interact.items.some((it) => it.kind === 'bed' && Math.hypot(it.x - engine.player.x, it.z - engine.player.z) < 3.5);
  const close = () => setUI({ waitMenu: false });
  const waitFor = (min: number) => {
    if (engine.combat.inCombat) { toast('warn', 'Нельзя ждать во время боя'); return; }
    setUI({ fade: true, waitMenu: false });
    setTimeout(() => { advanceTime(min); engine.refreshAmbient(); setUI({ fade: false }); toast('info', 'Время прошло', `Сейчас ${clockString(G().time.min)}`); }, 400);
  };
  const h = hour();
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal panel panel-frame" style={{ width: 'min(440px, calc(100vw - 32px))' }} onClick={(e) => e.stopPropagation()}>
        <h2>{nearBed ? 'Отдых' : 'Ожидание'}</h2>
        <div className="dim">Сейчас {clockString(time.min)}. {nearBed ? 'Сон восстанавливает силы и сохраняет игру.' : 'Ждать можно где угодно, кроме боя. Спать — только в кровати или в таверне.'}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          <button className="btn" onClick={() => waitFor(60)}>Подождать 1 час</button>
          <button className="btn" onClick={() => waitFor(180)}>Подождать 3 часа</button>
          {h < 9 && <button className="btn" onClick={() => waitFor(minutesUntil(9))}>До начала уроков (09:00)</button>}
          {h >= 6 && h < 18 && <button className="btn" onClick={() => waitFor(minutesUntil(18))}>До вечера (18:00)</button>}
          {h >= 6 && h < 21 && <button className="btn" onClick={() => waitFor(minutesUntil(21))}>До ночи (21:00)</button>}
          {nearBed && <button className="btn primary" onClick={() => sleepUntilMorning()}>{h >= 7 && h < 19 ? 'Вздремнуть (3 часа)' : 'Спать до утра'}</button>}
        </div>
        <div className="faint" style={{ fontSize: 13, marginTop: 10 }}>{ZONES[zone].name}</div>
        <div className="actions"><button className="btn" onClick={close}>Отмена</button></div>
      </div>
    </div>
  );
}

export function FastTravel() {
  const flags = useGame((s) => s.g!.flags);
  const close = () => setUI({ fastTravel: false });
  const stones = (Object.keys(ZONES) as ZoneId[]).filter((z) => ZONES[z].waystone && flags[`waystone_${z}`]);
  return (
    <div className="modal-backdrop" onClick={close}>
      <div className="modal panel panel-frame" style={{ width: 'min(460px, calc(100vw - 32px))' }} onClick={(e) => e.stopPropagation()}>
        <h2>Камни перехода</h2>
        <div className="dim">Пробуждённые камни связаны между собой. Переход занимает полчаса.</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
          {stones.map((z) => (
            <button key={z} className="btn" disabled={z === G().pos.zone} onClick={() => { close(); advanceTime(30); bus.emit('sfx', { id: 'teleport' }); void engine.enterZone(z, ZONES[z].waystone!); }}>{ZONES[z].name}</button>
          ))}
          {stones.length < 2 && <div className="faint">Найдите и коснитесь других камней перехода, чтобы путешествовать между ними.</div>}
        </div>
        <div className="actions"><button className="btn" onClick={close}>Закрыть</button></div>
      </div>
    </div>
  );
}

export function DeadScreen() {
  return (
    <div className="dead">
      <h1>Вы потеряли сознание</h1>
      <div className="dim" style={{ maxWidth: 520, lineHeight: 1.6 }}>Тьма отступает. Где-то далеко звучит ворчливый голос сестры Мэйбел: «Опять этот ребёнок…»</div>
      <button className="btn primary" onClick={() => engine.combat.revive()}>Очнуться в лазарете</button>
    </div>
  );
}
