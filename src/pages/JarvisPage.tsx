import { useState, useEffect, useMemo } from 'react';
import { MessageSquare, Sliders, Palette, Info, Box } from 'lucide-react';
import { storage } from '@/lib/storage';
import { JarvisChat } from '@/components/jarvis/JarvisChat';
import { JarvisSettings } from '@/components/jarvis/JarvisSettings';
import { Jarvis3DCore } from '@/components/jarvis/Jarvis3DCore';
import {
  getSavedParallaxTheme,
  saveParallaxTheme,
  type ParallaxTheme,
} from '@/components/parallax/ParallaxSettings';
import type { JarvisSystemConfig } from '@/types';

const FULL_PIPELINE_DESCRIPTION =
  'Multi-Tier Pipeline: 6 Core Consensus (Planner 🧭 → Researcher 🔎 → Fact Checker 🛡️ → Advisor 💡 → Reviewer 🔬 → Synthesizer ✨) + 4 Specialized (Architect 🏗️ · Data Analyst 📊 · Image Finder 🖼️ · Coder 💻)';

export function JarvisPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
  const [config, setConfig] = useState<JarvisSystemConfig>(() => storage.getJarvisConfig());
  const [parallaxTheme, setParallaxTheme] = useState<ParallaxTheme>(() => getSavedParallaxTheme());
  const [showPipelineInfo, setShowPipelineInfo] = useState(false);
  const [is3D, setIs3D] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('nexus-jarvis-3d');
      return saved === null ? true : saved === 'true';
    } catch {
      return true;
    }
  });
  const [isCoreCollapsed, setIsCoreCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('nexus-jarvis-core-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggle3D = () => {
    setIs3D((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nexus-jarvis-3d', String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const toggleCoreCollapsed = () => {
    setIsCoreCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('nexus-jarvis-core-collapsed', String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const coreAgents = useMemo(() => {
    const configured = config?.agents ? Object.values(config.agents) : [];
    if (configured.length === 0) return [];
    return configured
      .filter((agent) => Boolean(agent?.name))
      .slice(0, 10)
      .map((agent) => ({
        id: agent.id,
        name: agent.name,
        enabled: Boolean(agent.enabled),
      }));
  }, [config]);

  // Keep state synchronized with storage whenever switching views or when storage updates
  useEffect(() => {
    setConfig(storage.getJarvisConfig());
    setParallaxTheme(getSavedParallaxTheme());
  }, [activeTab]);

  useEffect(() => {
    const handleStorageChange = () => {
      setConfig(storage.getJarvisConfig());
      setParallaxTheme(getSavedParallaxTheme());
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleStorageChange);
    };
  }, []);

  const handleConfigSaved = (updated: JarvisSystemConfig) => {
    setConfig(updated);
  };

  const handleThemeChange = (newTheme: ParallaxTheme) => {
    setParallaxTheme(newTheme);
    saveParallaxTheme(newTheme);
  };

  const handleCycleTheme = () => {
    const order: ParallaxTheme[] = ['fulldark', 'minimal', 'classic'];
    const next = order[(order.indexOf(parallaxTheme) + 1) % order.length];
    handleThemeChange(next);
  };

  const wrapperThemeClass =
    parallaxTheme === 'classic'
      ? 'theme-classic bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b192e] via-[#060911] to-[#04060b]'
      : parallaxTheme === 'minimal'
      ? 'theme-minimal'
      : 'theme-fulldark';

  const activeAgentsCount = config?.agents
    ? Object.values(config.agents).filter((a) => a?.enabled).length
    : 10;

  return (
    <div
      id="jarvis-page-wrapper"
      data-theme={parallaxTheme}
      data-3d={is3D ? 'true' : 'false'}
      className={`jarvis-page-wrapper min-h-screen relative -mx-4 sm:-mx-8 md:-mx-12 -my-8 px-3 sm:px-6 lg:px-8 py-2 overflow-x-clip transition-colors duration-200 ${wrapperThemeClass} ${
        is3D ? 'jarvis-3d-on' : ''
      }`}
    >
      {is3D && (
        <div className="j3d-deck" aria-hidden="true">
          <div className="j3d-deck-glow" />
          <div className="j3d-deck-floor" />
          <div className="j3d-deck-horizon" />
          <div className="j3d-deck-dust">
            <span className="j3d-deck-dust-a" />
            <span className="j3d-deck-dust-b" />
            <span className="j3d-deck-dust-c" />
            <span className="j3d-deck-dust-d" />
            <span className="j3d-deck-dust-e" />
          </div>
        </div>
      )}

      <div className="main-content-flow relative z-10 w-full max-w-[960px] mx-auto min-h-[calc(100vh-1.5rem)] flex flex-col pt-1 pb-6">
        {/* Stitch-Style Page Header (No fixed header, no bottom nav) */}
        <header className="jarvis-page-header flex flex-col gap-1.5 pt-1 pb-2 mb-3 border-b border-white/[0.06]">
          {/* Row 1: JARVIS Title + 10-AGENT COGNITIVE MESH Pill | Right: Info + Palette */}
          <div className="flex items-center justify-between gap-2 w-full min-h-[38px]">
            <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
              <div className="flex flex-col">
                <div className="inline-flex items-center gap-2">
                  {/* Animated Dual-Orbit Neural Emblem */}
                  <span className="relative inline-flex items-center justify-center w-5 h-5 shrink-0" aria-hidden="true">
                    <svg className="w-5 h-5 mc-orbit-cw" viewBox="0 0 24 24" fill="none">
                      <circle
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="url(#jarvisTitleGrad1)"
                        strokeWidth="1.6"
                        strokeDasharray="12 6"
                      />
                      <defs>
                        <linearGradient id="jarvisTitleGrad1" x1="0" y1="0" x2="24" y2="24">
                          <stop offset="0%" stopColor="#00f0ff" />
                          <stop offset="50%" stopColor="#a855f7" />
                          <stop offset="100%" stopColor="#ec4899" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <svg className="w-3 h-3 absolute mc-orbit-ccw" viewBox="0 0 16 16" fill="none">
                      <polygon
                        points="8,1 15,8 8,15 1,8"
                        stroke="#34d399"
                        strokeWidth="1.4"
                        fill="rgba(0,240,255,0.2)"
                      />
                    </svg>
                  </span>
                  <span className="jarvis-page-title px-headline-aurora text-[18px] sm:text-[21px] font-extrabold tracking-wider uppercase">
                    JARVIS
                  </span>
                  {/* Mini Harmonic Equalizer Bars */}
                  <span className="hidden sm:inline-flex items-end gap-[2px] h-3.5 px-1" aria-hidden="true">
                    <span className="w-[2px] h-2 rounded-full bg-cyan-400 mc-wave-bar" />
                    <span
                      className="w-[2px] h-3.5 rounded-full bg-fuchsia-400 mc-wave-bar"
                      style={{ animationDelay: '0.18s' }}
                    />
                    <span
                      className="w-[2px] h-2.5 rounded-full bg-amber-300 mc-wave-bar"
                      style={{ animationDelay: '0.35s' }}
                    />
                    <span
                      className="w-[2px] h-3 rounded-full bg-emerald-400 mc-wave-bar"
                      style={{ animationDelay: '0.5s' }}
                    />
                  </span>
                </div>
                <div className="px-headline-laser-track !max-w-[130px] !h-[1.5px] mt-0.5" />
              </div>

              <div className="jarvis-page-badge px-kicker-pill inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--j-high)] border border-cyan-400/25">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--j-accent)] animate-pulse shrink-0" />
                <span className="px-subheadline-spectrum font-mono text-[9.5px] sm:text-[10px] font-bold uppercase tracking-widest truncate">
                  {activeAgentsCount}-AGENT COGNITIVE MESH
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={toggle3D}
                aria-pressed={is3D}
                title={is3D ? 'Switch to flat console' : 'Switch to 3D holographic deck'}
                aria-label="Toggle 3D holographic deck"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  is3D
                    ? 'bg-[var(--j-accent)] text-[#002022] shadow-[0_0_14px_rgba(0,240,255,0.55)]'
                    : 'bg-[var(--j-low)] text-[var(--j-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-high)]'
                }`}
              >
                <Box size={14} strokeWidth={2} />
              </button>

              <button
                type="button"
                onClick={() => setShowPipelineInfo((prev) => !prev)}
                title={FULL_PIPELINE_DESCRIPTION}
                aria-label="Toggle pipeline description"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                  showPipelineInfo
                    ? 'bg-[var(--j-accent)] text-[#002022]'
                    : 'bg-[var(--j-low)] text-[var(--j-muted)] hover:text-[var(--j-text)] hover:bg-[var(--j-high)]'
                }`}
              >
                <Info size={14} strokeWidth={2} />
              </button>

              <button
                type="button"
                onClick={handleCycleTheme}
                title={`Current Theme: ${parallaxTheme} (Tap to switch Minimal / Classic / Full Dark)`}
                aria-label={`Switch visual theme (current: ${parallaxTheme})`}
                className="w-8 h-8 rounded-full bg-[var(--j-low)] hover:bg-[var(--j-high)] text-[var(--j-muted)] hover:text-[var(--j-text)] flex items-center justify-center transition-colors cursor-pointer"
              >
                <Palette size={14} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Collapsible Pipeline Architecture Info Strip */}
          {showPipelineInfo && (
            <div className="jarvis-page-description px-3 py-2 rounded-xl bg-[var(--j-lowest)] text-[11px] text-[var(--j-muted)] font-mono leading-relaxed flex items-center justify-between gap-2">
              <span>{FULL_PIPELINE_DESCRIPTION}</span>
              <button
                type="button"
                onClick={() => setShowPipelineInfo(false)}
                className="text-[var(--j-faint)] hover:text-[var(--j-text)] text-xs px-1.5 py-0.5 rounded cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>
          )}

          {/* Row 2: 2 Tabs in Stitch Style (Mono uppercase text, active tab has cyan underline) */}
          <div className="jarvis-page-tabs flex items-center justify-start gap-5 h-9 w-full">
            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`jarvis-tab-btn relative h-full inline-flex items-center gap-1.5 px-1 font-mono text-[11.5px] font-semibold tracking-wider uppercase transition-colors cursor-pointer ${
                activeTab === 'chat'
                  ? 'text-[var(--j-text)]'
                  : 'text-[var(--j-muted)] hover:text-[var(--j-text)]'
              }`}
            >
              <MessageSquare size={13} className={activeTab === 'chat' ? 'text-[var(--j-accent)]' : ''} />
              <span>Console</span>
              {activeTab === 'chat' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[var(--j-accent)] shadow-[0_0_8px_rgba(0,240,255,0.6)]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`jarvis-tab-btn relative h-full inline-flex items-center gap-1.5 px-1 font-mono text-[11.5px] font-semibold tracking-wider uppercase transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'text-[var(--j-text)]'
                  : 'text-[var(--j-muted)] hover:text-[var(--j-text)]'
              }`}
            >
              <Sliders size={13} className={activeTab === 'settings' ? 'text-[var(--j-accent)]' : ''} />
              <span>Agent Configurations</span>
              {activeTab === 'settings' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-[var(--j-accent)] shadow-[0_0_8px_rgba(0,240,255,0.6)]" />
              )}
            </button>
          </div>
        </header>

        {/* Main Tab Content */}
        {is3D && activeTab === 'chat' && (
          <Jarvis3DCore
            agents={coreAgents}
            compact={isCoreCollapsed}
            onToggleCompact={toggleCoreCollapsed}
          />
        )}

        {activeTab === 'chat' ? (
          <JarvisChat
            config={config}
            onOpenSettings={() => setActiveTab('settings')}
            theme={parallaxTheme}
            onThemeChange={handleThemeChange}
          />
        ) : (
          <JarvisSettings onSaved={handleConfigSaved} />
        )}
      </div>
    </div>
  );
}

export default JarvisPage;

