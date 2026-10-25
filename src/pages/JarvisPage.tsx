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
      ? 'theme-classic bg-[#060911] text-[#f1f5f9] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b192e] via-[#060911] to-[#04060b]'
      : parallaxTheme === 'minimal'
      ? 'theme-minimal bg-[#0c0d10] text-[#e7e9ea]'
      : 'theme-fulldark bg-black text-[#e7e9ea]';

  const floatingPillClass =
    parallaxTheme === 'classic'
      ? 'bg-[#0b1220]/90 backdrop-blur-xl border border-cyan-500/25 text-slate-100 shadow-[0_4px_20px_rgba(6,182,212,0.12)]'
      : parallaxTheme === 'minimal'
      ? 'bg-[#16171d] border border-zinc-800 text-zinc-100 shadow-[0_2px_12px_rgba(0,0,0,0.45)]'
      : 'bg-[#101216] border border-[#24272c] text-[#e7e9ea] shadow-[0_2px_14px_rgba(0,0,0,0.75)]';

  const floatingPillHoverClass =
    parallaxTheme === 'classic'
      ? 'hover:bg-slate-800/90 hover:border-cyan-400/40'
      : parallaxTheme === 'minimal'
      ? 'hover:bg-zinc-800'
      : 'hover:bg-[#1a1c20]';

  const hairlineCardClass =
    parallaxTheme === 'classic'
      ? 'rounded-2xl border border-cyan-500/20 bg-[#0a101d]/90 backdrop-blur-xl'
      : parallaxTheme === 'minimal'
      ? 'rounded-2xl border border-zinc-800/90 bg-[#121318]'
      : 'rounded-2xl border border-[#22252a] bg-[#07080a]';

  const activeAgentsCount = config?.agents
    ? Object.values(config.agents).filter((a) => a?.enabled).length
    : 10;

  return (
    <div
      id="jarvis-page-wrapper"
      data-theme={parallaxTheme}
      className={`jarvis-page-wrapper min-h-screen relative -mx-4 sm:-mx-8 md:-mx-12 -my-8 px-3 sm:px-6 lg:px-8 py-2 overflow-x-hidden font-sans transition-colors duration-200 ${wrapperThemeClass}`}
    >
      <div className="main-content-flow w-full max-w-[1060px] mx-auto min-h-[calc(100vh-1.5rem)] flex flex-col pt-1 pb-6">
        {/* Top Floating Command Header (Parallax style) */}
        <header className="jarvis-page-header sticky top-1.5 z-30 flex items-center justify-between gap-2 py-1.5 mb-2 backdrop-blur-md">
          {/* Left: Brand Pill + Info Toggle */}
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'chat' ? 'settings' : 'chat')}
              title={FULL_PIPELINE_DESCRIPTION}
              className={`h-8 sm:h-9 px-3 sm:px-3.5 rounded-full flex items-center gap-1.5 text-xs sm:text-[13px] transition-all cursor-pointer truncate ${floatingPillClass} ${floatingPillHoverClass}`}
            >
              <span className="font-semibold tracking-tight text-white">JARVIS</span>
              <span className="text-[#71767b]" aria-hidden="true">·</span>
              <span className="text-[10.5px] sm:text-[11px] text-[#8b9097] font-mono tabular-nums truncate">
                {activeAgentsCount}/10 Agents · Cognitive Mesh
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowPipelineInfo((prev) => !prev)}
              title={FULL_PIPELINE_DESCRIPTION}
              aria-label="Toggle pipeline description"
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                showPipelineInfo ? 'bg-white text-black' : `${floatingPillClass} ${floatingPillHoverClass}`
              }`}
            >
              <Info size={14} strokeWidth={2} />
            </button>
          </div>

          {/* Right: Palette Theme Cycle + 2 Page Tabs */}
          <div className={`jarvis-page-tabs flex items-center gap-0.5 rounded-full p-0.5 shrink-0 ${floatingPillClass}`}>
            <button
              type="button"
              onClick={handleCycleTheme}
              title={`Current Theme: ${parallaxTheme} (Tap to switch)`}
              aria-label={`Switch visual theme (current: ${parallaxTheme})`}
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${floatingPillHoverClass}`}
            >
              <Palette size={14} strokeWidth={2} />
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={`jarvis-tab-btn inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-white text-black'
                  : `text-[#8b9097] hover:text-white ${floatingPillHoverClass}`
              }`}
            >
              <MessageSquare size={12} strokeWidth={2} />
              <span className="hidden xs:inline sm:inline">JARVIS Console &amp; HUD</span>
              <span className="xs:hidden sm:hidden">Console</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`jarvis-tab-btn inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-white text-black'
                  : `text-[#8b9097] hover:text-white ${floatingPillHoverClass}`
              }`}
            >
              <Sliders size={12} strokeWidth={2} />
              <span className="hidden xs:inline sm:inline">Agent Configurations</span>
              <span className="xs:hidden sm:hidden">Agents</span>
            </button>
          </div>
        </header>

        {/* Collapsible Pipeline Architecture Info Strip */}
        {showPipelineInfo && (
          <div className={`px-3.5 py-2 mb-2.5 text-[11px] text-[#a1a1aa] font-mono leading-relaxed flex items-center justify-between gap-2 ${hairlineCardClass}`}>
            <span>{FULL_PIPELINE_DESCRIPTION}</span>
            <button
              type="button"
              onClick={() => setShowPipelineInfo(false)}
              className="text-[#71767b] hover:text-white text-xs px-1.5 py-0.5 rounded cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>
        )}

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

