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

// ---------------------------------------------------------------------------
// Stale-deploy recovery: after a new deploy the old hashed chunks no longer
// exist, so a lazy route import fails. Reload once to pick up the new HTML.
// ---------------------------------------------------------------------------
const CHUNK_RELOAD_AT_KEY = 'nexus-chunk-reload-at';
const CHUNK_ERROR_PATTERN =
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|dynamically imported module/i;

function reloadOnceForChunkError(): boolean {
  try {
    const last = Number(sessionStorage.getItem(CHUNK_RELOAD_AT_KEY) || 0);
    // Avoid a reload loop if the chunk is genuinely missing.
    if (Date.now() - last < 15000) return false;
    sessionStorage.setItem(CHUNK_RELOAD_AT_KEY, String(Date.now()));
  } catch {
    // sessionStorage unavailable (private mode) - still try a single reload.
  }
  window.location.reload();
  return true;
}

window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  reloadOnceForChunkError();
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason as { message?: string } | string | undefined;
  const message = typeof reason === 'string' ? reason : reason?.message || '';
  if (CHUNK_ERROR_PATTERN.test(message) && reloadOnceForChunkError()) {
    event.preventDefault();
  }
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
