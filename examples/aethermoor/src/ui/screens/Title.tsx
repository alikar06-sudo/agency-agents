import { useEffect, useState } from 'react';
import { setUI, useUI } from '@/state/store';
import { latestSave } from '@/systems/save';
import type { SaveMeta } from '@/systems/save';
import { continueGame } from '@/game/game';
import { SaveLoad } from '../overlays/SaveLoad';
import { SettingsPanel } from '../overlays/SettingsPanel';
import { audio } from '@/core/audio';
import { bus } from '@/core/bus';

export function Title() {
  const [latest, setLatest] = useState<SaveMeta | null>(null);
  const [modal, setModal] = useState<'load' | 'settings' | 'about' | null>(null);
  const cloud = useUI((s) => s.cloud);

  useEffect(() => {
    void latestSave().then(setLatest);
    if (audio.ctx) audio.setMusic('title');
  }, [cloud]);

  const click = () => bus.emit('sfx', { id: 'ui_click' });

  return (
    <div className="title-screen">
      <div className="title-col">
        <h1 className="logo"><span className="small">Академия</span><span className="big">Этермур</span></h1>
        <div className="tagline">Тысячелетняя школа магии. Пятый Основатель. Сердце, которое нельзя будить.</div>
        <button className="btn menu-btn" disabled={!latest} onClick={() => { click(); if (latest) void continueGame(latest.slot); }}>
          Продолжить
          <span className="sub">{latest ? `${latest.name} · ур. ${latest.level} · ${latest.zoneName}` : 'Сохранений пока нет'}</span>
        </button>
        <button className="btn menu-btn" onClick={() => { click(); audio.init(); setUI({ screen: 'intro' }); }}>
          Новая игра<span className="sub">Поступить в Академию</span>
        </button>
        <button className="btn menu-btn" onClick={() => { click(); setModal('load'); }}>Загрузить<span className="sub">Выбрать ячейку сохранения</span></button>
        <button className="btn menu-btn" onClick={() => { click(); setModal('settings'); }}>Настройки<span className="sub">Звук, графика, управление</span></button>
        <button className="btn menu-btn" onClick={() => { click(); setModal('about'); }}>Об игре</button>
      </div>
      <div className="title-footer">
        <span className={'cloud ' + cloud}><span className="dot" />{cloud === 'online' ? 'Сервер Академии на связи — облачные сохранения включены' : cloud === 'offline' ? 'Офлайн — сохранения только в браузере' : 'Проверяю сервер…'}</span>
        <span>Оригинальная вселенная · вся графика и музыка генерируются в браузере</span>
      </div>
      {modal === 'load' && <SaveLoad mode="load" onClose={() => setModal(null)} />}
      {modal === 'settings' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal panel panel-frame" style={{ width: 'min(760px, calc(100vw - 32px))', height: 'min(640px, calc(100vh - 40px))' }} onClick={(e) => e.stopPropagation()}>
            <h2>Настройки</h2>
            <SettingsPanel />
            <div className="actions"><button className="btn" onClick={() => setModal(null)}>Готово</button></div>
          </div>
        </div>
      )}
      {modal === 'about' && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div className="modal panel panel-frame" onClick={(e) => e.stopPropagation()}>
            <h2>Об игре</h2>
            <div className="scroll" style={{ lineHeight: 1.6 }}>
              <p>«Академия Этермур» — браузерная RPG о первом годе в древней школе магии: уроки и экзамены, тайны замка, дуэли, зелья, лес, деревня, озеро, руины — и выбор, от которого зависит судьба Сердца Эфира.</p>
              <p className="dim">Мир, персонажи, музыка и графика оригинальные: модели собраны из примитивов, текстуры и звук синтезируются процедурно. Собственные аудиофайлы можно подключить через <code>public/audio/manifest.json</code>.</p>
              <p className="dim">Пять актов · четыре финала · 30+ заданий · 15 заклинаний и 5 резонансов · 11 областей · 7 учебных предметов.</p>
            </div>
            <div className="actions"><button className="btn" onClick={() => setModal(null)}>Закрыть</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
