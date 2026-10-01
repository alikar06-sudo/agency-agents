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

createRoot(document.getElementById('root')!).render(<App />);
