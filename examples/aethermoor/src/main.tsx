import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/cyrillic-500.css';
import '@fontsource/cormorant-garamond/cyrillic-600.css';
import '@fontsource/cormorant-garamond/cyrillic-700.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/alegreya/cyrillic-400.css';
import '@fontsource/alegreya/cyrillic-400-italic.css';
import '@fontsource/alegreya/cyrillic-500.css';
import '@fontsource/alegreya/latin-400.css';
import './styles/main.css';
import { App } from './ui/App';
import { saveLocalNow } from './systems/save';

// Если страница открыта в просмотрщике, который умеет горячо обновлять её,
// перед обновлением сохраняем партию — после перезапуска её можно продолжить.
interface HotHost { snapshot?: (fn: () => unknown) => void; ready?: (fn: (data: unknown) => void) => void; data?: unknown }
const hot = (window as unknown as { claude?: { hot?: HotHost } }).claude?.hot;
hot?.snapshot?.(() => { saveLocalNow(); return {}; });
window.addEventListener('pagehide', saveLocalNow);

const start = () => createRoot(document.getElementById('root')!).render(<App />);
if (hot?.ready) hot.ready(start); else start();
