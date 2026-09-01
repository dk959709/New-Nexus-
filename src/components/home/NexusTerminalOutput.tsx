import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  RefreshCw,
  Thermometer,
  Zap,
  Trash2,
  Check,
} from 'lucide-react';
import { NexusWorldMapTelemetry } from './NexusWorldMapTelemetry';
import { formatTemp } from '@/lib/format';
import { api } from '@/services/api';
import type { WeatherData, Settings } from '@/types';
import { JARVIS_TERMINAL_STORAGE_KEY, JARVIS_TERMINAL_EVENT } from '@/lib/jarvisTerminalLogger';

interface NexusTerminalOutputProps {
  weather?: WeatherData | null;
  settings?: Settings;
  activeQuery?: string;
  isSearching?: boolean;
  onExecuteSearch?: (query: string) => void;
  title?: string;
  storageKey?: string;
}

interface LogLine {
  id: string;
  timestamp: string;
  sender?: 'you' | 'jarvis' | 'system' | 'search';
  text: string;
  type: 'system' | 'telemetry' | 'network' | 'warning' | 'user' | 'assistant';
}

const DEFAULT_CHAT_STORAGE_KEY = 'nexus-terminal-inline-chat-v1';
const MAX_STORED_MESSAGES = 60;

function getWeatherEmoji(condition?: string, isDay: boolean = true): string {
  if (!condition) return '☀️';
  const c = condition.toLowerCase();
  if (c.includes('rain') || c.includes('drizzle')) return '🌧️';
  if (c.includes('storm') || c.includes('thunder')) return '⛈️';
  if (c.includes('snow') || c.includes('ice') || c.includes('flurr')) return '❄️';
  if (c.includes('fog') || c.includes('mist') || c.includes('haze')) return '🌫️';
  if (c.includes('partly')) return isDay ? '⛅' : '☁️';
  if (c.includes('cloud') || c.includes('overcast')) return '☁️';
  if (c.includes('clear') || c.includes('sun')) return isDay ? '☀️' : '🌙';
  return '☀️';
}

function getCurrentTimestamp(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

function getStaticBootLogs(): LogLine[] {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timeAt = (offsetSecondsAgo: number) => {
    const d = new Date(now.getTime() - offsetSecondsAgo * 1000);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  return [
    {
      id: 'log-sys-1',
      timestamp: timeAt(180),
      text: 'neural index online • AI core calibrated',
      type: 'system',
    },
    {
      id: 'log-sys-2',
      timestamp: timeAt(145),
      text: 'quantum satellite telemetry array synchronized',
      type: 'telemetry',
    },
    {
      id: 'log-sys-3',
      timestamp: timeAt(110),
      text: 'global mesh data links: 128 nodes active [latency: 14ms]',
      type: 'network',
    },
    {
      id: 'log-sys-4',
      timestamp: timeAt(75),
      text: 'sources verified: wiki • web • live news wire • media',
      type: 'telemetry',
    },
    {
      id: 'log-sys-5',
      timestamp: timeAt(30),
      text: 'cognitive reasoning assistant ready for inline interaction',
      type: 'system',
    },
  ];
}

function loadStoredChat(key: string): LogLine[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .slice(-MAX_STORED_MESSAGES)
        .filter((l): l is LogLine =>
          Boolean(
            l &&
              typeof l.id === 'string' &&
              typeof l.text === 'string'
          )
        );
    }
  } catch (err) {
    console.warn('Failed to parse terminal chat history from localStorage', err);
  }
  return [];
}

function saveStoredChat(key: string, logsToSave: LogLine[]) {
  try {
    const chatOnly = logsToSave
      .filter((l) => l.type === 'user' || l.type === 'assistant' || l.type === 'warning' || l.sender === 'search')
      .slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(key, JSON.stringify(chatOnly));
  } catch (err) {
    console.warn('Failed to save terminal chat history to localStorage', err);
  }
}

export function NexusTerminalOutput({
  weather,
  settings,
  activeQuery,
  isSearching = false,
  title = 'TERMINAL OUTPUT',
  storageKey,
}: NexusTerminalOutputProps) {
  const effectiveStorageKey = storageKey || DEFAULT_CHAT_STORAGE_KEY;
  const [showWeatherDetail, setShowWeatherDetail] = useState(false);
  const [isAiResponding, setIsAiResponding] = useState(false);
  const [showClearToast, setShowClearToast] = useState(false);

  // Initialize chat history context for multi-turn inline dialogue
  const [chatHistory, setChatHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>(() => {
    const saved = loadStoredChat(effectiveStorageKey);
    return saved
      .filter((l) => l.type === 'user' || l.type === 'assistant')
      .map((l) => ({
        role: l.type === 'user' ? ('user' as const) : ('assistant' as const),
        content: l.text,
      }));
  });

  // Terminal log lines (boot diagnostics + loaded persisted chat conversation)
  const [logs, setLogs] = useState<LogLine[]>(() => {
    const bootLogs = getStaticBootLogs();
    const savedChatLogs = loadStoredChat(effectiveStorageKey);
    return [...bootLogs, ...savedChatLogs];
  });

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Real-time listener for live JARVIS pipeline terminal logs
  useEffect(() => {
    if (effectiveStorageKey !== JARVIS_TERMINAL_STORAGE_KEY) return;

    const handleJarvisLog = (event: Event) => {
      const customEvt = event as CustomEvent<LogLine>;
      if (!customEvt.detail) return;
      setLogs((prev) => {
        // Prevent duplicate IDs
        if (prev.some((l) => l.id === customEvt.detail.id)) return prev;
        const updated = [...prev, customEvt.detail];
        saveStoredChat(effectiveStorageKey, updated);
        return updated;
      });
    };

    window.addEventListener(JARVIS_TERMINAL_EVENT, handleJarvisLog);
    return () => {
      window.removeEventListener(JARVIS_TERMINAL_EVENT, handleJarvisLog);
    };
  }, [effectiveStorageKey]);

  // Auto-scroll the log container to the bottom when new logs or thinking indicator appear
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTo({
        top: logContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [logs, isAiResponding]);

  // Fast single-turn AI chat handler (no 8-agent pipeline, no page navigation)
  const handleInlineChat = async (prompt: string) => {
    const cleanPrompt = prompt.trim();
    if (!cleanPrompt || isAiResponding) return;

    const userTimestamp = getCurrentTimestamp();
    const userLog: LogLine = {
      id: `user-${Date.now()}`,
      timestamp: userTimestamp,
      sender: 'you',
      text: cleanPrompt,
      type: 'user',
    };

    setLogs((prev) => {
      const updated = [...prev, userLog];
      saveStoredChat(effectiveStorageKey, updated);
      return updated;
    });
    setIsAiResponding(true);

    try {
      // Send message to the single AI Assistant (fast model response) with recent context
      const res = await api.aiChat(
        cleanPrompt,
        chatHistory.slice(-6),
        '',
      );

      const replyText = res.answer || 'Standby, neural link operational.';
      const aiTimestamp = getCurrentTimestamp();

      const assistantLog: LogLine = {
        id: `jarvis-${Date.now()}`,
        timestamp: aiTimestamp,
        sender: 'jarvis',
        text: replyText,
        type: 'assistant',
      };

      setLogs((prev) => {
        const updated = [...prev, assistantLog];
        saveStoredChat(effectiveStorageKey, updated);
        return updated;
      });

      setChatHistory((prev) => [
        ...prev.slice(-MAX_STORED_MESSAGES + 2),
        { role: 'user', content: cleanPrompt },
        { role: 'assistant', content: replyText },
      ]);
    } catch (err) {
      const errTimestamp = getCurrentTimestamp();
      const errMsg = err instanceof Error ? err.message : 'Telemetry communication error';

      const errorLog: LogLine = {
        id: `err-${Date.now()}`,
        timestamp: errTimestamp,
        sender: 'system',
        text: `error: ${errMsg}`,
        type: 'warning',
      };

      setLogs((prev) => {
        const updated = [...prev, errorLog];
        saveStoredChat(effectiveStorageKey, updated);
        return updated;
      });
    } finally {
      setIsAiResponding(false);
    }
  };

  // Clear only the user/AI chat messages while preserving static system diagnostics
  const handleClearChat = () => {
    try {
      localStorage.removeItem(effectiveStorageKey);
    } catch (err) {
      console.warn('Failed to clear terminal chat storage', err);
    }

    setChatHistory([]);
    setLogs((prev) => prev.filter((l) => l.type !== 'user' && l.type !== 'assistant' && l.type !== 'warning' && l.sender !== 'search'));

    setShowClearToast(true);
    setTimeout(() => {
      setShowClearToast(false);
    }, 2200);
  };

  // Weather variables
  const isDay = weather?.current?.isDay ?? true;
  const conditionStr = weather?.current?.conditionLabel || (weather?.current?.condition as string) || 'Clear';
  const weatherEmoji = getWeatherEmoji(weather?.current?.condition || conditionStr, isDay);
  const tempVal = weather?.current?.temperature;
  const tempUnit = settings?.temperature || 'celsius';
  const formattedTemp = tempVal != null ? formatTemp(tempVal, tempUnit) : '22°C';
  const locName = weather?.current?.location || 'Station Nexus';

  const hasChatMessages = logs.some(
    (l) => l.type === 'user' || l.type === 'assistant' || l.type === 'warning' || l.sender === 'search',
  );

  return (
    <section
      id="terminal-output-panel"
      aria-label="Terminal Output"
      className="relative w-full rounded-2xl sm:rounded-3xl border border-cyan-500/40 bg-[#030712] p-4 sm:p-6 shadow-[0_0_35px_rgba(6,182,212,0.15)] font-mono overflow-hidden my-6 transition-all"
    >
      {/* Ambient background glow */}
      <div className="absolute top-0 right-1/4 w-96 h-48 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Terminal Window Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3 mb-4 flex-wrap gap-2">
        {/* Left: Terminal Label */}
        <div className="flex items-center gap-2.5">
          <Terminal size={17} className="text-cyan-400" />
          <span className="text-xs sm:text-sm font-bold tracking-widest text-cyan-300 uppercase">
            {title}
          </span>
          <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-300">
            <Zap size={10} className="text-emerald-400" />
            INLINE AI CHAT ACTIVE
          </span>
        </div>

        {/* Right Controls: Clear Chat + Weather Popup Widget + Terminal Traffic Dots */}
        <div className="flex items-center gap-2.5 sm:gap-3">
          {/* Quick Clear Chat Confirmation Toast Badge */}
          {showClearToast && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-950/80 border border-emerald-500/50 text-[10px] font-mono text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)] animate-in fade-in zoom-in-95 duration-150">
              <Check size={11} className="text-emerald-400" />
              <span>CHAT CLEARED</span>
            </div>
          )}

          {/* Clear Chat Button */}
          {hasChatMessages && !showClearToast && (
            <button
              type="button"
              onClick={handleClearChat}
              title="Clear inline chat history"
              aria-label="Clear inline chat history"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-slate-700/60 hover:border-rose-500/50 text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 hover:shadow-[0_0_12px_rgba(244,63,94,0.25)] text-[11px] font-mono transition-all select-none active:scale-95 cursor-pointer"
            >
              <Trash2 size={12} />
              <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider">
                CLEAR CHAT
              </span>
            </button>
          )}

          {/* Tiny Weather Popup / Widget */}
          <div
            className="relative cursor-pointer select-none group"
            onClick={() => setShowWeatherDetail((prev) => !prev)}
            onMouseEnter={() => setShowWeatherDetail(true)}
            onMouseLeave={() => setShowWeatherDetail(false)}
            title="Current Weather Telemetry"
          >
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-cyan-500/30 text-[11px] font-mono text-cyan-300 hover:border-cyan-400 hover:shadow-[0_0_12px_rgba(34,211,238,0.3)] transition-all">
              <span className="text-xs leading-none" role="img" aria-label="weather-condition">
                {weatherEmoji}
              </span>
              <span className="text-slate-500 text-[10px]">|</span>
              <span className="flex items-center gap-0.5 text-white font-bold tracking-tight">
                <Thermometer size={11} className="text-cyan-400 hidden sm:inline" />
                {formattedTemp}
              </span>
              {weather?.current?.location && (
                <span className="text-slate-400 text-[10px] hidden md:inline truncate max-w-[90px]">
                  {weather.current.location}
                </span>
              )}
            </div>

            {/* Hover details tooltip popup */}
            {showWeatherDetail && weather && (
              <div className="absolute right-0 top-full mt-2 w-48 p-2.5 rounded-xl bg-slate-950/95 border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.3)] backdrop-blur-md z-50 text-[10px] space-y-1 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between text-cyan-300 font-bold border-b border-cyan-500/20 pb-1">
                  <span>{locName}</span>
                  <span>{weatherEmoji}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300 pt-0.5">
                  <span className="text-slate-400">Condition:</span>
                  <span className="text-emerald-400 capitalize">{conditionStr}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400">Temperature:</span>
                  <span className="text-white font-semibold">{formattedTemp}</span>
                </div>
                {weather.current?.humidity != null && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Humidity:</span>
                    <span className="text-cyan-300">{weather.current.humidity}%</span>
                  </div>
                )}
                {weather.current?.wind != null && (
                  <div className="flex items-center justify-between text-slate-300">
                    <span className="text-slate-400">Wind:</span>
                    <span className="text-cyan-300">{Math.round(weather.current.wind)} km/h</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3 macOS / Terminal dots */}
          <div className="flex items-center gap-1.5 pl-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f56] inline-block shadow-sm" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e] inline-block shadow-sm" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#27c93f] inline-block shadow-sm" />
          </div>
        </div>
      </div>

      {/* Terminal Grid: Left Log Console (Chat & Telemetry) + Right World Map with AI Assistant Input */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Monospace System Telemetry & Inline Chat Stream */}
        <div className="lg:col-span-5 flex flex-col justify-between h-[300px] sm:h-[330px] text-xs sm:text-sm select-text">
          {/* Scrollable Diagnostic & Inline Chat Log Container */}
          <div
            ref={logContainerRef}
            className="overflow-y-auto pr-2 space-y-2.5 flex-1 select-text scroll-smooth"
            style={{
              scrollbarWidth: 'thin',
              scrollbarColor: 'rgba(34,211,238,0.25) transparent',
            }}
          >
            {logs.map((log) => {
              const isUser = log.type === 'user';
              const isAssistant = log.type === 'assistant';
              const isSystem = log.type === 'system';
              const isNetwork = log.type === 'network';
              const isWarning = log.type === 'warning';
              const isSearch = log.sender === 'search' || log.text.startsWith('search:');

              return (
                <div
                  key={log.id}
                  className="flex items-start gap-2 font-mono leading-relaxed break-words"
                >
                  {/* Prompt symbol */}
                  <span
                    className={`font-bold select-none shrink-0 ${
                      isUser
                        ? 'text-sky-400'
                        : isAssistant
                        ? 'text-emerald-400'
                        : isSearch
                        ? 'text-cyan-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    &gt;
                  </span>

                  {/* Timestamp */}
                  <span className="text-cyan-400/70 font-mono text-[11px] sm:text-xs select-none shrink-0 pt-[1px]">
                    [{log.timestamp}]
                  </span>

                  {/* Sender & Content Color-coded */}
                  <div className="flex-1 min-w-0">
                    {isSearch ? (
                      <span className="text-cyan-300 font-medium">
                        {log.text.startsWith('search:') ? log.text : `search: ${log.text}`}
                      </span>
                    ) : isUser ? (
                      <div className="flex items-start gap-1.5 flex-wrap">
                        <span className="text-sky-300 font-bold select-none">you:</span>
                        <span className="text-white font-medium break-all">{log.text}</span>
                      </div>
                    ) : isAssistant ? (
                      <div className="space-y-1">
                        <div className="flex items-start gap-1.5">
                          <span className="text-emerald-400 font-bold select-none">jarvis:</span>
                          <span className="text-emerald-200/90 font-mono leading-relaxed whitespace-pre-wrap break-words">
                            {log.text}
                          </span>
                        </div>
                      </div>
                    ) : isSystem ? (
                      <span className="text-emerald-400 font-medium">{log.text}</span>
                    ) : isNetwork ? (
                      <span className="text-cyan-300 font-medium">{log.text}</span>
                    ) : isWarning ? (
                      <span className="text-amber-400 font-medium">{log.text}</span>
                    ) : (
                      <span className="text-slate-200 font-medium">{log.text}</span>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Thinking placeholder while waiting for AI response */}
            {isAiResponding && (
              <div className="flex items-start gap-2 font-mono leading-relaxed text-emerald-300 animate-pulse">
                <span className="text-emerald-400 font-bold select-none">&gt;</span>
                <span className="text-cyan-400/70 font-mono text-[11px] sm:text-xs select-none pt-[1px]">
                  [{getCurrentTimestamp()}]
                </span>
                <span className="text-emerald-400 font-bold select-none">jarvis:</span>
                <span className="inline-flex items-center gap-1.5 text-emerald-300 text-xs font-mono">
                  <span className="inline-block w-2 h-3.5 bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400/80 italic">...</span>
                </span>
              </div>
            )}

            {/* Active external search stream (if any) */}
            {isSearching && activeQuery && (
              <div className="flex items-start gap-2 text-cyan-300 animate-pulse">
                <span className="text-cyan-400 font-bold select-none">&gt;</span>
                <span className="text-cyan-400/80 font-mono text-[11px] sm:text-xs select-none pt-[1px]">
                  [LIVE]
                </span>
                <span className="font-mono flex items-center gap-2 text-cyan-200 text-xs">
                  <RefreshCw size={11} className="animate-spin text-cyan-400" />
                  <span>querying quantum index for &quot;{activeQuery}&quot;...</span>
                </span>
              </div>
            )}
          </div>

          {/* Final Ready State (Bright Green + Blinking Cursor) */}
          <div className="pt-2.5 border-t border-cyan-500/15 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs sm:text-sm tracking-wider">
              <span className="text-emerald-400 font-bold select-none">&gt;</span>
              <span>JARVIS READY</span>
              <span className="inline-block w-2.5 h-3.5 bg-emerald-400 animate-pulse ml-0.5" />
            </div>
            <span className="text-[10px] text-cyan-400/60 font-mono hidden sm:inline">
              SYS::STANDBY
            </span>
          </div>
        </div>

        {/* Right Column: World Map Graphic with Inline AI Assistant Chat Bar */}
        <div className="lg:col-span-7 w-full">
          <NexusWorldMapTelemetry
            onSendChatMessage={handleInlineChat}
            isAiResponding={isAiResponding}
          />
        </div>
      </div>
    </section>
  );
}

