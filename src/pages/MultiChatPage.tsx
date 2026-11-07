import { useState, useEffect } from 'react';
import { MessageSquare, Sliders, Palette, Terminal, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { storage } from '@/lib/storage';
import { MultiChatConsole } from '@/components/multichat/MultiChatConsole';
import { MultiChatSettings } from '@/components/multichat/MultiChatSettings';
import type { MultiChatSystemConfig, MultiChatTheme } from '@/types';

export function MultiChatPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
  const [config, setConfig] = useState<MultiChatSystemConfig>(() => storage.getMultiChatConfig());
  const [theme, setTheme] = useState<MultiChatTheme>(() => storage.getMultiChatTheme());
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Keep state synchronized with storage whenever switching views or when storage updates
  useEffect(() => {
    setConfig(storage.getMultiChatConfig());
    setTheme(storage.getMultiChatTheme());
  }, [activeTab]);

  useEffect(() => {
    const handleStorageChange = () => {
      setConfig(storage.getMultiChatConfig());
      setTheme(storage.getMultiChatTheme());
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleStorageChange);
    window.addEventListener('nexus-multichat-theme-changed', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
      window.removeEventListener('nexus-multichat-theme-changed', handleStorageChange);
    };
  }, []);

  const handleConfigSaved = (updated: MultiChatSystemConfig) => {
    setConfig(updated);
  };

  const handleThemeChange = (nextTheme: MultiChatTheme) => {
    setTheme(nextTheme);
    storage.setMultiChatTheme(nextTheme);
  };

  return (
    <div
      data-theme={theme}
      className={`relative min-h-screen flex flex-col font-sans -mx-4 sm:-mx-6 md:-mx-8 -mt-4 sm:-mt-6 px-2.5 sm:px-6 md:px-8 pt-2.5 sm:pt-3.5 pb-14 transition-colors duration-300 overflow-x-hidden ${
        theme === 'classic'
          ? 'theme-classic bg-[#050a12] text-[#e2e8f0] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b233f] via-[#061222] to-[#03070e]'
          : theme === 'fulldark'
          ? 'theme-fulldark bg-black text-[#ececec]'
          : 'theme-minimal bg-[#0f0f13] text-[#e3e3e7]'
      }`}
    >
      {/* Ambient Animated Neural Graphics & Aurora Orbs Layer */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        {theme === 'classic' && (
          <>
            <div className="absolute -top-24 left-1/4 w-96 h-96 rounded-full bg-cyan-500/12 blur-[100px] animate-pulse" />
            <div
              className="absolute top-1/3 -right-24 w-80 h-80 rounded-full bg-violet-500/10 blur-[95px] animate-pulse"
              style={{ animationDelay: '1.5s' }}
            />
            <div
              className="absolute -bottom-24 left-10 w-80 h-80 rounded-full bg-amber-500/8 blur-[95px] animate-pulse"
              style={{ animationDelay: '3s' }}
            />
            <div
              className="absolute inset-0 opacity-[0.045]"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(56,189,248,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,0.5) 1px, transparent 1px)',
                backgroundSize: '42px 42px',
              }}
            />
          </>
        )}
        {theme === 'minimal' && (
          <>
            <div className="absolute -top-28 left-1/3 w-96 h-96 rounded-full bg-indigo-500/10 blur-[110px] animate-pulse" />
            <div
              className="absolute bottom-10 right-1/4 w-80 h-80 rounded-full bg-purple-500/8 blur-[100px] animate-pulse"
              style={{ animationDelay: '2s' }}
            />
          </>
        )}
        {theme === 'fulldark' && (
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[520px] h-40 rounded-full bg-cyan-500/[0.04] blur-[90px]" />
        )}
      </div>

      <div className="relative z-10 w-full max-w-5xl mx-auto flex flex-col flex-1 gap-2.5 sm:gap-3.5 pb-4">
        {/* Compact Mobile-Friendly Multi Chat Top Header with Animated Laser & Tri-Core Graphic */}
        <header
          className={`relative z-10 overflow-hidden flex items-center justify-between gap-2 px-3 py-2 rounded-2xl transition-all flex-wrap ${
            theme === 'classic'
              ? 'border border-cyan-500/30 bg-slate-950/85 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(6,182,212,0.12)]'
              : theme === 'fulldark'
              ? 'border border-white/[0.1] bg-[#09090b]/95 shadow-lg shadow-black'
              : 'border border-indigo-500/25 bg-zinc-900/90 backdrop-blur-xl shadow-lg shadow-black/40'
          }`}
        >
          {/* Animated Top Laser Sweep */}
          <div className="mc-laser-line" />

          {/* Left: Animated Tri-Core Neural Emblem & Brand Identity */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`relative w-8 h-8 sm:w-9 sm:h-9 rounded-xl shrink-0 grid place-items-center border overflow-hidden ${
                theme === 'classic'
                  ? 'bg-cyan-950/60 border-cyan-400/40 shadow-[0_0_16px_rgba(6,182,212,0.3)]'
                  : theme === 'fulldark'
                  ? 'bg-[#141418] border-white/15 shadow-[0_0_12px_rgba(255,255,255,0.08)]'
                  : 'bg-indigo-950/50 border-indigo-400/40 shadow-[0_0_14px_rgba(99,102,241,0.25)]'
              }`}
            >
              {/* Animated SVG Tri-Core Graphic */}
              <svg viewBox="0 0 36 36" className="w-6 h-6">
                <g className="mc-orbit-cw">
                  <circle
                    cx="18"
                    cy="18"
                    r="13"
                    fill="none"
                    stroke="rgba(56,189,248,0.35)"
                    strokeWidth="1"
                    strokeDasharray="4 3"
                  />
                  <circle cx="18" cy="5" r="2.3" fill="#38bdf8" />
                  <circle cx="29.2" cy="24.5" r="2.3" fill="#f59e0b" />
                  <circle cx="6.8" cy="24.5" r="2.3" fill="#c084fc" />
                </g>
                <polygon
                  points="18,8 26.5,23 9.5,23"
                  fill="none"
                  stroke="rgba(168,85,247,0.45)"
                  strokeWidth="1"
                />
                <circle cx="18" cy="18" r="3" fill="#67e8f9" className="animate-pulse" />
              </svg>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1
                  className={`m-0 text-sm sm:text-base font-extrabold tracking-tight leading-tight truncate ${
                    theme === 'classic'
                      ? 'bg-gradient-to-r from-cyan-200 via-sky-300 to-violet-300 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                      : theme === 'fulldark'
                      ? 'text-white'
                      : 'bg-gradient-to-r from-white via-indigo-200 to-purple-200 bg-clip-text text-transparent'
                  }`}
                >
                  Multi Chat
                </h1>
                <span
                  className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border whitespace-nowrap ${
                    theme === 'classic'
                      ? 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30'
                      : theme === 'fulldark'
                      ? 'bg-[#16161a] text-zinc-300 border-white/10'
                      : 'bg-indigo-950/50 text-indigo-300 border-indigo-500/30'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span>NOVA 🧠 · ORBIT 😎 · COSMOS 🧘</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right: 3-Theme Switcher + Console/Settings Tabs */}
          <div className="flex items-center gap-1.5 sm:gap-2 ml-auto flex-wrap">
            {/* Quick 3-Theme Segmented Pill (Minimal / Classic / Full Dark) */}
            <div
              className={`flex items-center p-0.5 rounded-xl border text-[11px] ${
                theme === 'classic'
                  ? 'bg-slate-950/85 border-cyan-500/25'
                  : theme === 'fulldark'
                  ? 'bg-[#141417] border-white/10'
                  : 'bg-zinc-950/80 border-white/10'
              }`}
              title="Switch Multi Chat Theme (Minimal, Classic, Full Dark)"
            >
              <Palette
                size={11}
                className={`ml-1.5 mr-1 hidden sm:inline ${
                  theme === 'classic' ? 'text-cyan-400' : 'text-indigo-400'
                }`}
              />
              {(['minimal', 'classic', 'fulldark'] as const).map((t) => {
                const isSelected = theme === t;
                const label = t === 'minimal' ? 'Minimal' : t === 'classic' ? 'Classic' : 'Dark';
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleThemeChange(t)}
                    className={`px-2 py-0.5 sm:py-1 rounded-lg font-medium transition-all cursor-pointer border-none ${
                      isSelected
                        ? t === 'classic'
                          ? 'bg-cyan-500/25 text-cyan-200 font-semibold shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                          : t === 'fulldark'
                          ? 'bg-white/15 text-white font-semibold'
                          : 'bg-indigo-500/25 text-indigo-200 font-semibold shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                        : 'bg-transparent text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            {/* Tab Controls (Chat Console vs Agent Configurations) */}
            <div
              className={`flex p-0.5 rounded-xl border text-[11px] sm:text-xs ${
                theme === 'classic'
                  ? 'bg-slate-950/85 border-cyan-500/25'
                  : theme === 'fulldark'
                  ? 'bg-[#141417] border-white/10'
                  : 'bg-zinc-950/80 border-white/10'
              }`}
            >
              <button
                type="button"
                onClick={() => setActiveTab('chat')}
                className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg font-semibold border-none cursor-pointer transition-all ${
                  activeTab === 'chat'
                    ? theme === 'classic'
                      ? 'bg-gradient-to-r from-cyan-400 to-teal-300 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                      : theme === 'fulldark'
                      ? 'bg-white text-black shadow-sm'
                      : 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                    : 'bg-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <MessageSquare size={12} />
                <span>Chat</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg font-semibold border-none cursor-pointer transition-all ${
                  activeTab === 'settings'
                    ? theme === 'classic'
                      ? 'bg-gradient-to-r from-cyan-400 to-teal-300 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.4)]'
                      : theme === 'fulldark'
                      ? 'bg-white text-black shadow-sm'
                      : 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                    : 'bg-transparent text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Sliders size={12} />
                <span>Agents</span>
              </button>
            </div>
          </div>
        </header>

        {/* Google Stitch HUD Stepper & Neural Telemetry Waveform Strip */}
        <div
          className={`relative overflow-hidden flex items-center justify-between gap-2 px-3 sm:px-4 py-1.5 rounded-xl border text-[11px] font-mono transition-all ${
            theme === 'classic'
              ? 'bg-slate-950/75 border-cyan-500/20 text-cyan-200/90 shadow-[0_4px_16px_rgba(0,0,0,0.4)]'
              : theme === 'fulldark'
              ? 'bg-[#09090c] border-white/10 text-zinc-300'
              : 'bg-zinc-900/80 border-indigo-500/20 text-indigo-200'
          }`}
        >
          <div className="stitch-corner-bracket stitch-corner-tl" />
          <div className="stitch-corner-bracket stitch-corner-tr" />
          <div className="stitch-corner-bracket stitch-corner-bl" />
          <div className="stitch-corner-bracket stitch-corner-br" />

          {/* Stepper Steps (Stitch Cognitive Pipeline) */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar">
            <span className="flex items-center gap-1 font-bold text-cyan-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <span>01 INTENT</span>
            </span>
            <span className="text-slate-600">→</span>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
              <span>02 SWARM MESH</span>
            </span>
            <span className="text-slate-600">→</span>
            <span className="flex items-center gap-1 text-slate-400 hidden xs:flex">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <span>03 VALIDATE</span>
            </span>
            <span className="text-slate-600 hidden xs:inline">→</span>
            <span className="flex items-center gap-1 text-slate-400 hidden sm:flex">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
              <span>04 CONSENSUS</span>
            </span>
          </div>

          {/* Stitch Audio Waveform Visualizer & Telemetry Indicator */}
          <div className="flex items-center gap-2 shrink-0 ml-auto">
            <div className="flex items-center gap-0.5 h-4 px-1" title="Stitch Cognitive Waveform Telemetry">
              <span className="stitch-audio-bar" />
              <span className="stitch-audio-bar" />
              <span className="stitch-audio-bar" />
              <span className="stitch-audio-bar" />
              <span className="stitch-audio-bar" />
              <span className="stitch-audio-bar" />
              <span className="stitch-audio-bar" />
              <span className="stitch-audio-bar" />
            </div>

            {/* Diagnostics Toggle Trigger Button */}
            <button
              type="button"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-500/30 transition-all cursor-pointer text-[10px]"
              title="Toggle Cyber Diagnostics Drawer & Token Ticker"
            >
              <Terminal size={11} className="text-cyan-400" />
              <span className="hidden xs:inline">DIAGNOSTICS</span>
              {showDiagnostics ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </button>
          </div>
        </div>

        {/* Cyberpunk HUD Diagnostics Drawer & Live Token Velocity Ticker */}
        {showDiagnostics && (
          <div
            className={`relative overflow-hidden p-3 sm:p-3.5 rounded-xl border text-xs font-mono transition-all space-y-2.5 ${
              theme === 'classic'
                ? 'bg-slate-950/90 border-cyan-500/30 text-cyan-200/90 shadow-[0_8px_24px_rgba(0,0,0,0.6)]'
                : theme === 'fulldark'
                ? 'bg-[#0a0a0d] border-white/15 text-zinc-200 shadow-xl'
                : 'bg-zinc-900/90 border-indigo-500/30 text-indigo-200'
            }`}
          >
            <div className="stitch-corner-bracket stitch-corner-tl" />
            <div className="stitch-corner-bracket stitch-corner-tr" />
            <div className="stitch-corner-bracket stitch-corner-bl" />
            <div className="stitch-corner-bracket stitch-corner-br" />

            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 flex-wrap gap-2">
              <div className="flex items-center gap-1.5 text-cyan-300 font-bold text-[11px]">
                <Activity size={12} className="text-cyan-400 animate-pulse" />
                <span>NEURAL TELEMETRY STREAM &amp; TOKEN VELOCITY</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/30 text-cyan-300">
                  CYCLE #9482-B
                </span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  EPOCH SYNCHRONIZED
                </span>
              </div>
            </div>

            {/* 3 Node Latency Gauges & Live Velocity */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
              <div className="p-2 rounded-lg bg-black/40 border border-cyan-500/20 flex flex-col">
                <span className="text-[10px] text-slate-400">TOKEN VELOCITY</span>
                <span className="cyber-telemetry-number font-extrabold text-sm sm:text-base">
                  4,280 <span className="text-[10px] text-slate-400">tok/s</span>
                </span>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-sky-500/20 flex flex-col">
                <span className="text-[10px] text-sky-300">NOVA (ANALYST)</span>
                <span className="font-bold text-white">12ms · <span className="text-sky-300">0.998 conf</span></span>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-amber-500/20 flex flex-col">
                <span className="text-[10px] text-amber-300">ORBIT (CREATIVE)</span>
                <span className="font-bold text-white">18ms · <span className="text-amber-300">0.985 conf</span></span>
              </div>
              <div className="p-2 rounded-lg bg-black/40 border border-purple-500/20 flex flex-col">
                <span className="text-[10px] text-purple-300">COSMOS (MENTOR)</span>
                <span className="font-bold text-white">15ms · <span className="text-purple-300">0.994 conf</span></span>
              </div>
            </div>
          </div>
        )}

        {/* Main Tab Content */}
        {activeTab === 'chat' ? (
          <MultiChatConsole
            config={config}
            onNavigateToSettings={() => setActiveTab('settings')}
            theme={theme}
            onChangeTheme={handleThemeChange}
          />
        ) : (
          <MultiChatSettings
            onSaved={handleConfigSaved}
            theme={theme}
            onChangeTheme={handleThemeChange}
          />
        )}
      </div>
    </div>
  );
}

export default MultiChatPage;

