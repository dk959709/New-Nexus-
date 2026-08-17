import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => undefined));

function getInitialWallpaper(): string | null {
  try {
    const raw = localStorage.getItem('nexus-settings');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.wallpaper?.url ?? null;
  } catch {
    return null;
  }
}

const initialWallpaper = getInitialWallpaper();

function showErrorOnScreen(message: string) {
  const el = document.getElementById('root');
  if (el) {
    el.innerHTML = '<div style="padding:20px;color:#fff;background:#300;font-family:monospace;white-space:pre-wrap;font-size:14px;">CRASH ERROR:\n\n' + message + '</div>';
  }
}
window.addEventListener('error', (e) => {
  console.error('[NEXUS HARD RELOAD ERROR]', e.message, e.error?.stack || e.error || '');
  
  showErrorOnScreen(e.message + '\n\n' + (e.error?.stack || ''));
});
window.addEventListener('unhandledrejection', (e) => {
  showErrorOnScreen(String(e.reason));
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div
      id="nexus-wallpaper"
      className="nexus-wallpaper"
      aria-hidden="true"
      style={initialWallpaper ? { backgroundImage: `url("${initialWallpaper}")`, opacity: 1 } : undefined}
      data-active={initialWallpaper ? 'true' : undefined}
    />
    <App />
  </StrictMode>
);
