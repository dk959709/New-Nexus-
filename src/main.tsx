import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import 'katex/dist/katex.min.css';
import { startDeviceAgent } from './lib/deviceAgent';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}

function getInitialAppearance(): { wallpaper: string | null; theme?: string } {
  try {
    const raw = localStorage.getItem('nexus-settings');
    if (!raw) return { wallpaper: null, theme: 'dark' };
    const parsed = JSON.parse(raw);
    return {
      wallpaper: parsed?.wallpaper?.url ?? null,
      theme: parsed?.theme ?? 'dark',
    };
  } catch {
    return { wallpaper: null, theme: 'dark' };
  }
}

const initialAppearance = getInitialAppearance();
const initialWallpaper = initialAppearance.wallpaper;
if (typeof document !== 'undefined') {
  const effectiveTheme =
    initialAppearance.theme === 'system'
      ? window.matchMedia?.('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : initialAppearance.theme || 'dark';
  document.documentElement.dataset.theme = effectiveTheme;
  document.documentElement.style.colorScheme = effectiveTheme === 'light' ? 'light' : 'dark';
}
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
