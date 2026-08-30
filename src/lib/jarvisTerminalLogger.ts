export const JARVIS_TERMINAL_STORAGE_KEY = 'nexus-terminal-inline-chat-v1';
export const JARVIS_TERMINAL_EVENT = 'nexus-terminal-log';

export interface JarvisTerminalLogItem {
  id: string;
  timestamp: string;
  sender?: 'you' | 'jarvis' | 'system' | 'search';
  text: string;
  type: 'system' | 'telemetry' | 'network' | 'warning' | 'user' | 'assistant';
}

export function getCurrentTerminalTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export function logToJarvisTerminal(
  text: string,
  type: 'network' | 'system' | 'telemetry' | 'warning' = 'network',
) {
  if (typeof window === 'undefined') return;

  const timestamp = getCurrentTerminalTimestamp();
  const rawText = text.trim();
  const formattedText = rawText.startsWith('search:') ? rawText : `search: ${rawText}`;

  const logItem: JarvisTerminalLogItem = {
    id: `jarvis-search-log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp,
    sender: 'search',
    text: formattedText,
    type,
  };

  try {
    const raw = localStorage.getItem(JARVIS_TERMINAL_STORAGE_KEY);
    const existing: JarvisTerminalLogItem[] = raw ? JSON.parse(raw) : [];
    const updated = [...existing, logItem].slice(-60);
    localStorage.setItem(JARVIS_TERMINAL_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.warn('[JARVIS Terminal Logger] Storage save error:', err);
  }

  try {
    window.dispatchEvent(new CustomEvent(JARVIS_TERMINAL_EVENT, { detail: logItem }));
  } catch (err) {
    console.warn('[JARVIS Terminal Logger] Event dispatch error:', err);
  }
}
