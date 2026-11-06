import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Sliders, Palette, Menu, Maximize2, Minimize2, ChevronUp } from 'lucide-react';
import { storage } from '@/lib/storage';
import { MultiChatConsole } from '@/components/multichat/MultiChatConsole';
import { MultiChatSettings } from '@/components/multichat/MultiChatSettings';
import type { MultiChatSystemConfig, MultiChatTheme } from '@/types';

export function MultiChatPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
  const [config, setConfig] = useState<MultiChatSystemConfig>(() => storage.getMultiChatConfig());
  const [theme, setTheme] = useState<MultiChatTheme>(() => storage.getMultiChatTheme());

  // Fullscreen & Smartphone Bottom-Up Navigation Bar state
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [bottomNavVisible, setBottomNavVisible] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const lastScrollTopRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);

  const updateBottomNavVisibility = useCallback((visible: boolean) => {
    setBottomNavVisible(visible);
    window.dispatchEvent(
      new CustomEvent('nexus-workflow-bottom-nav', {
        detail: { visible },
      }),
    );
  }, []);

  useEffect(() => {
    updateBottomNavVisibility(false);
    const onExternalNavEvent = (e: Event) => {
      const custom = e as CustomEvent<{ visible?: boolean }>;
      if (typeof custom.detail?.visible === 'boolean') {
        setBottomNavVisible(custom.detail.visible);
      }
    };
    window.addEventListener('nexus-workflow-bottom-nav', onExternalNavEvent);
    return () => {
      window.removeEventListener('nexus-workflow-bottom-nav', onExternalNavEvent);
      updateBottomNavVisibility(false);
    };
  }, [updateBottomNavVisibility]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
    const isNearBottom = distanceFromBottom <= 90;
    const scrollingDown = scrollTop > lastScrollTopRef.current + 4;
    const scrollingUp = scrollTop < lastScrollTopRef.current - 12;

    if (isNearBottom) {
      updateBottomNavVisibility(true);
    } else if (scrollingUp && distanceFromBottom > 180) {
      updateBottomNavVisibility(false);
    } else if (scrollingDown && distanceFromBottom <= 140) {
      updateBottomNavVisibility(true);
    }

    lastScrollTopRef.current = scrollTop;
  }, [updateBottomNavVisibility]);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length > 0) {
      touchStartYRef.current = e.touches[0].clientY;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (touchStartYRef.current === null || e.touches.length === 0) return;
      const currentY = e.touches[0].clientY;
      const deltaY = touchStartYRef.current - currentY;
      const viewportHeight = window.innerHeight;
      const startedNearBottomEdge = touchStartYRef.current >= viewportHeight - 110;

      const el = scrollContainerRef.current;
      const isAtBottom = el
        ? el.scrollHeight - (el.scrollTop + el.clientHeight) <= 100
        : false;

      if ((startedNearBottomEdge && deltaY > 24) || (isAtBottom && deltaY > 18)) {
        updateBottomNavVisibility(true);
      } else if (deltaY < -35 && !isAtBottom) {
        updateBottomNavVisibility(false);
      }
    },
    [updateBottomNavVisibility],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      const el = scrollContainerRef.current;
      if (!el) return;
      const distanceFromBottom = el.scrollHeight - (el.scrollTop + el.clientHeight);
      if (e.deltaY > 10 && distanceFromBottom <= 120) {
        updateBottomNavVisibility(true);
      } else if (e.deltaY < -18 && distanceFromBottom > 180) {
        updateBottomNavVisibility(false);
      }
    },
    [updateBottomNavVisibility],
  );

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
      ref={scrollContainerRef}
      onScroll={handleScroll}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onWheel={handleWheel}
      data-theme={theme}
      className={`fixed top-0 right-0 bottom-0 h-[100dvh] max-h-[100dvh] flex flex-col font-sans px-2.5 sm:px-6 md:px-8 pt-2.5 sm:pt-3.5 pb-24 transition-all duration-300 z-[950] overflow-y-auto overflow-x-hidden scroll-smooth ${
        isFullscreen
          ? 'left-0 w-full'
          : 'left-0 md:left-[240px] w-full md:w-[calc(100%-240px)]'
      } ${
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
          className={`sticky top-1 z-30 overflow-hidden flex items-center justify-between gap-2 px-3 py-2 rounded-2xl transition-all flex-wrap ${
            theme === 'classic'
              ? 'border border-cyan-500/30 bg-slate-950/85 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.5),0_0_20px_rgba(6,182,212,0.12)]'
              : theme === 'fulldark'
              ? 'border border-white/[0.1] bg-[#09090b]/95 shadow-lg shadow-black'
              : 'border border-indigo-500/25 bg-zinc-900/90 backdrop-blur-xl shadow-lg shadow-black/40'
          }`}
        >
          {/* Animated Top Laser Sweep */}
          <div className="mc-laser-line" />

          {/* Left: Menu Drawer Button + Animated Tri-Core Neural Emblem & Brand Identity */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('nexus-toggle-side-menu'))}
              className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border transition-all cursor-pointer ${
                theme === 'classic'
                  ? 'bg-slate-900/90 hover:bg-slate-800 border-cyan-500/30 text-cyan-200'
                  : theme === 'fulldark'
                  ? 'bg-[#141418] hover:bg-[#1e1e24] border-white/15 text-zinc-200'
                  : 'bg-zinc-950/90 hover:bg-zinc-800 border-indigo-500/30 text-indigo-200'
              }`}
              title="Open NEXUS Navigation Drawer"
              aria-label="Open NEXUS Navigation Drawer"
            >
              <Menu size={15} />
            </button>

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

          {/* Right: 3-Theme Switcher + Console/Settings Tabs + Fullscreen Toggle */}
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

            <button
              type="button"
              onClick={() => setIsFullscreen((prev) => !prev)}
              className={`w-8 h-8 rounded-xl flex items-center justify-center border transition-all cursor-pointer ${
                theme === 'classic'
                  ? 'bg-slate-950/85 border-cyan-500/25 text-cyan-200 hover:bg-slate-800'
                  : theme === 'fulldark'
                  ? 'bg-[#141417] border-white/10 text-zinc-200 hover:bg-[#1e1e24]'
                  : 'bg-zinc-950/80 border-white/10 text-indigo-200 hover:bg-zinc-800'
              }`}
              title={isFullscreen ? 'Dock with Sidebar (Desktop)' : 'Expand Full Screen'}
            >
              {isFullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            </button>
          </div>
        </header>

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

      {/* Single Smartphone Home Indicator Gesture Bar (Fixed at bottom edge when nav bar is hidden) */}
      {!bottomNavVisible && (
        <div
          onClick={() => updateBottomNavVisibility(true)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          className="fixed bottom-0 left-0 right-0 h-7 flex flex-col items-center justify-end pb-1.5 bg-gradient-to-t from-black/90 via-black/40 to-transparent z-[990] cursor-pointer group"
        >
          <div className="flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-slate-950/85 border border-cyan-500/35 group-hover:border-cyan-400/70 transition-all shadow-md">
            <div className="w-10 h-1 rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-400" />
            <ChevronUp size={11} className="text-cyan-300/90" />
          </div>
        </div>
      )}
    </div>
  );
}

export default MultiChatPage;

