import { useEffect, useRef } from 'react';
import { useUI, setUI } from '@/state/store';
import { engine } from '@/engine/Engine';
import { bootGame } from '@/game/game';
import { audio } from '@/core/audio';
import { Title } from './screens/Title';
import { Intro } from './screens/Intro';
import { Creation } from './screens/Creation';
import { GameUI } from './GameUI';
import { Ending } from './overlays/Ending';

export function App() {
  const host = useRef<HTMLDivElement>(null);
  const screen = useUI((s) => s.screen);
  const fade = useUI((s) => s.fade);

  useEffect(() => {
    if (!host.current) return;
    let alive = true;
    try {
      engine.mount(host.current);
      bootGame();
      engine.start();
      void engine.showTitleScene().then(() => { if (alive) setUI({ screen: 'title' }); });
    } catch (err) {
      console.error(err);
      setUI({ screen: 'title' });
    }
    const unlock = () => {
      audio.init();
      if (audio.getMood() === 'silence') audio.setMusic(useUI.getState().screen === 'game' ? 'castle' : 'title');
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    (window as unknown as { __aether: unknown }).__aether = { engine };
    return () => {
      alive = false;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return (
    <div className="app">
      <div className="game-host" ref={host} />
      <div className="vignette" />
      {screen === 'title' && <Title />}
      {screen === 'intro' && <Intro />}
      {screen === 'create' && <Creation />}
      {screen === 'game' && <GameUI />}
      {screen === 'ending' && <Ending />}
      <div className={'fade' + (fade ? ' on' : '')} />
      {screen === 'boot' && (
        <div className="loading">
          <div className="ring" />
          <div className="title-font gold" style={{ fontSize: 22 }}>Академия Этермур</div>
          <div className="faint">Свечи зажигаются…</div>
        </div>
      )}
    </div>
  );
}
