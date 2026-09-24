import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import './dashboard-tabs.css';
import './location-filter.css';
import './growth-suite.css';
import './pwa.css';
import './account-deletion.css';
import './banner-studio.css';
import './profile-banner-studio.css';
import './safety-center.css';
import './sponsor-ads.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);


const nativeContainer = Boolean(
  (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } })
    .Capacitor?.isNativePlatform?.()
);

if ('serviceWorker' in navigator && !nativeContainer) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(error => {
      console.warn('GuruLes service worker belum dapat didaftarkan.', error);
    });
  });
}
