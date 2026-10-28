import { useState, useEffect } from 'react';
import { MessageSquare, Sliders, Palette, Info } from 'lucide-react';
import { storage } from '@/lib/storage';
import { JarvisChat } from '@/components/jarvis/JarvisChat';
import { JarvisSettings } from '@/components/jarvis/JarvisSettings';
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
      className={`jarvis-page-wrapper min-h-screen relative -mx-4 sm:-mx-8 md:-mx-12 -my-8 px-3 sm:px-6 lg:px-8 py-2 overflow-x-clip transition-colors duration-200 ${wrapperThemeClass}`}
    >
      <div className="main-content-flow w-full max-w-[960px] mx-auto min-h-[calc(100vh-1.5rem)] flex flex-col pt-1 pb-6">
        {/* Stitch-Style Page Header (No fixed header, no bottom nav) */}
        <header className="jarvis-page-header flex flex-col gap-1.5 pt-1 pb-2 mb-3 border-b border-white/[0.06]">
          {/* Row 1: JARVIS Title + 10-AGENT COGNITIVE MESH Pill | Right: Info + Palette */}
          <div className="flex items-center justify-between gap-2 w-full min-h-[38px]">
            <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
              <span className="jarvis-page-title text-[18px] sm:text-[20px] font-bold tracking-wider uppercase text-[var(--j-text)]">
                JARVIS
              </span>
              <div className="jarvis-page-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[var(--j-high)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--j-accent)] animate-pulse shrink-0" />
                <span className="font-mono text-[9.5px] sm:text-[10px] font-medium text-[var(--j-accent2)] uppercase tracking-widest truncate">
                  {activeAgentsCount}-AGENT COGNITIVE MESH
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
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

