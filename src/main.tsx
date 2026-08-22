import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { startDeviceAgent } from './lib/deviceAgent';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

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
startDeviceAgent();

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
