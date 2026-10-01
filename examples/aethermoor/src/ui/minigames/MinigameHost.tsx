import { setUI } from '@/state/store';
export function MinigameHost() {
  return <div className="minigame"><div className="mg panel"><div className="faint">Мини-игра в разработке.</div><button className="btn" onClick={() => setUI({ minigame: null })}>Закрыть</button></div></div>;
}
