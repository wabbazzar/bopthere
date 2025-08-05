import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { pwaManager } from './utils/pwa';

// Register service worker
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    pwaManager.registerServiceWorker();
  });
}

createRoot(document.getElementById('root')!).render(<App />);
