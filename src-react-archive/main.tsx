import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { pwaManager } from './utils/pwa';
import { API_BASE_URL } from './utils/apiBase';

// Register service worker
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    const registration = await pwaManager.registerServiceWorker();
    try {
      const sw = registration?.active || registration?.waiting || registration?.installing;
      if (sw && API_BASE_URL) {
        sw.postMessage({ type: 'SET_API_BASE', base: API_BASE_URL });
      }
    } catch (err) {
      console.warn('Failed to send API base to service worker', err);
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);
