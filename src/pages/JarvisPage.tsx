import { useState, useEffect } from 'react';
import { MessageSquare, Sliders, Zap } from 'lucide-react';
import { storage } from '@/lib/storage';
import { JarvisChat } from '@/components/jarvis/JarvisChat';
import { JarvisSettings } from '@/components/jarvis/JarvisSettings';
import { getSavedParallaxTheme, type ParallaxTheme } from '@/components/parallax/ParallaxSettings';
import type { JarvisSystemConfig } from '@/types';

export function JarvisPage() {
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
  const [config, setConfig] = useState<JarvisSystemConfig>(() => storage.getJarvisConfig());
  const [parallaxTheme, setParallaxTheme] = useState<ParallaxTheme>(() => getSavedParallaxTheme());

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

  const wrapperThemeClass =
    parallaxTheme === 'classic'
      ? 'theme-classic bg-[#060911] text-[#f1f5f9] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0b192e] via-[#060911] to-[#04060b]'
      : parallaxTheme === 'minimal'
      ? 'theme-minimal bg-[#0c0d10] text-[#e7e9ea]'
      : 'theme-fulldark bg-black text-[#e7e9ea]';

  return (
    <div className={`jarvis-page-wrapper min-h-screen transition-colors duration-300 ${wrapperThemeClass} -mx-4 sm:-mx-8 md:-mx-12 -my-8 px-3 sm:px-6 lg:px-8 py-3`}>
      <div className="main-content-flow max-w-[1440px] mx-auto pb-8">
        {/* JARVIS Top Header (Parallax style) */}
        <div className="jarvis-page-header flex flex-wrap items-center justify-between gap-3 py-2 mb-3 border-b border-[#26292e]">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-[#121418] border border-[#26292e] shadow-inner">
                <Zap className="w-4 h-4 text-cyan-400" />
              </div>
              <h1 className="jarvis-page-title text-base sm:text-lg font-extrabold tracking-tight text-white m-0">
                JARVIS
              </h1>
              <span className="jarvis-page-badge px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold">
                10-AGENT COGNITIVE MESH
              </span>
            </div>
            <p className="jarvis-page-description mt-1 mb-0 text-[11px] sm:text-xs text-[#71767b] leading-relaxed">
              Multi-Tier Pipeline: 6 Core Consensus (Planner 🧭 → Researcher 🔎 → Fact Checker 🛡️ → Advisor 💡 → Reviewer 🔬 → Synthesizer ✨) + 4 Specialized (Architect 🏗️ · Data Analyst 📊 · Image Finder 🖼️ · Coder 💻)
            </p>
          </div>

          {/* Tab Controls (Parallax pill style) */}
          <div className="jarvis-page-tabs flex items-center gap-1.5 bg-[#121418] border border-[#26292e] rounded-full p-1">
            <button
              type="button"
              className={`jarvis-tab-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 shadow-[0_0_12px_rgba(34,211,238,0.12)]'
                  : 'text-[#8b98a5] hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
              onClick={() => setActiveTab('chat')}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>JARVIS Console & HUD</span>
            </button>

            <button
              type="button"
              className={`jarvis-tab-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35 shadow-[0_0_12px_rgba(34,211,238,0.12)]'
                  : 'text-[#8b98a5] hover:text-white hover:bg-white/[0.04] border border-transparent'
              }`}
              onClick={() => setActiveTab('settings')}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Agent Configurations</span>
            </button>
          </div>
        </div>

        {/* Main Tab Content */}
        {activeTab === 'chat' ? (
          <JarvisChat config={config} onOpenSettings={() => setActiveTab('settings')} />
        ) : (
          <JarvisSettings onSaved={handleConfigSaved} />
        )}
      </div>
    </div>
  );
}

export default JarvisPage;

