import { useState, useEffect } from 'react';
import {
  Activity,
  Cpu,
  Radio,
  Zap,
  Shield,
  Clock,
  Sparkles,
} from 'lucide-react';
import { getSavedParallaxTheme, type ParallaxTheme } from '@/components/parallax/ParallaxSettings';
import type { JarvisSystemConfig } from '@/types';

interface JarvisHudHeaderProps {
  config: JarvisSystemConfig;
  isRunning: boolean;
  activeView: 'chat' | 'topology' | 'categories' | 'reactor';
  onSelectView: (view: 'chat' | 'topology' | 'categories' | 'reactor') => void;
  messageCount: number;
  theme?: ParallaxTheme;
}

export function JarvisHudHeader({
  config,
  isRunning,
  activeView,
  onSelectView,
  messageCount,
  theme: propTheme,
}: JarvisHudHeaderProps) {
  const [timeStr, setTimeStr] = useState('');
  const [fps] = useState('60.0');
  const activeTheme: ParallaxTheme = propTheme || getSavedParallaxTheme();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString('en-US', {
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + `.${Math.floor(now.getMilliseconds() / 10).toString().padStart(2, '0')}`,
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 100);
    return () => clearInterval(interval);
  }, []);

  const activeAgentsCount = config?.agents
    ? Object.values(config.agents).filter((a) => a?.enabled).length
    : 10;

  const hairlineBarClass =
    activeTheme === 'classic'
      ? 'rounded-2xl border border-cyan-500/20 bg-[#0a101d]/90 backdrop-blur-xl'
      : activeTheme === 'minimal'
      ? 'rounded-2xl border border-zinc-800/90 bg-[#121318]'
      : 'rounded-2xl border border-[#22252a] bg-[#07080a]';

  const pillGroupClass =
    activeTheme === 'classic'
      ? 'bg-[#0b1220]/90 border border-cyan-500/20'
      : activeTheme === 'minimal'
      ? 'bg-[#16171d] border border-zinc-800'
      : 'bg-[#121418] border border-[#26292e]';

  return (
    <div
      className={`jarvis-hud-card px-3 py-2 transition-all ${hairlineBarClass} ${
        isRunning ? 'ring-1 ring-cyan-400/50' : ''
      }`}
    >
      <div className="jarvis-hud-main-row flex flex-wrap items-center justify-between gap-2">
        {/* Left: Compact Telemetry Strip */}
        <div className="jarvis-hud-ticker flex items-center gap-2 sm:gap-2.5 flex-wrap text-[10px] sm:text-[11px] font-mono text-[#71767b] min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isRunning ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400'
              }`}
            />
            <span className={isRunning ? 'text-cyan-300 font-semibold' : 'text-[#e7e9ea] font-semibold'}>
              {isRunning ? 'PIPELINE ENGAGED' : 'SYSTEM ONLINE'}
            </span>
          </div>

          <span className="text-[#3f444c]" aria-hidden="true">·</span>

          <div className="flex items-center gap-1" title="Active Neural Channels">
            <Radio size={11} className="text-[#8b9097]" />
            <span>
              CHANNELS: <strong className="text-[#e7e9ea]">{activeAgentsCount}/10</strong>
            </span>
          </div>

          <span className="hidden md:inline text-[#3f444c]" aria-hidden="true">·</span>

          <div className="hidden md:flex items-center gap-1" title="Orchestrator Version">
            <Cpu size={11} className="text-[#8b9097]" />
            <span>
              ORCHESTRATOR: <strong className="text-[#e7e9ea]">v5.2.0-PRO</strong>
            </span>
          </div>

          <span className="hidden lg:inline text-[#3f444c]" aria-hidden="true">·</span>

          <div className="hidden lg:flex items-center gap-1" title="Refresh Rate">
            <Activity size={11} className="text-[#8b9097]" />
            <span>
              REFRESH: <strong className="text-[#e7e9ea]">{fps} Hz</strong>
            </span>
          </div>

          <span className="hidden sm:inline text-[#3f444c]" aria-hidden="true">·</span>

          <div className="hidden sm:flex items-center gap-1 text-[#8b9097] tabular-nums">
            <Clock size={11} />
            <span>{timeStr || '00:00:00.00'}</span>
          </div>

          <span className="text-[#3f444c]" aria-hidden="true">·</span>

          <span className="text-[10px] text-[#8b9097] font-mono tabular-nums">
            {messageCount} {messageCount === 1 ? 'SESSION' : 'SESSIONS'}
          </span>
        </div>

        {/* Right: 4 View Switcher Pills (Parallax Tab Style) */}
        <div className={`jarvis-hud-switcher flex items-center flex-wrap gap-0.5 rounded-full p-0.5 ${pillGroupClass}`}>
          <button
            type="button"
            className={`jarvis-hud-switcher-btn flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] sm:text-[11px] font-semibold transition-colors cursor-pointer ${
              activeView === 'chat'
                ? 'bg-white text-black'
                : 'text-[#8b9097] hover:text-white hover:bg-white/[0.06]'
            }`}
            onClick={() => onSelectView('chat')}
          >
            <Sparkles size={11} />
            <span>Chat Console</span>
          </button>

          <button
            type="button"
            className={`jarvis-hud-switcher-btn flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] sm:text-[11px] font-semibold transition-colors cursor-pointer ${
              activeView === 'topology'
                ? 'bg-white text-black'
                : 'text-[#8b9097] hover:text-white hover:bg-white/[0.06]'
            }`}
            onClick={() => onSelectView('topology')}
          >
            <Cpu size={11} />
            <span>10-Agent Topology</span>
          </button>

          <button
            type="button"
            className={`jarvis-hud-switcher-btn flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] sm:text-[11px] font-semibold transition-colors cursor-pointer ${
              activeView === 'categories'
                ? 'bg-white text-black'
                : 'text-[#8b9097] hover:text-white hover:bg-white/[0.06]'
            }`}
            onClick={() => onSelectView('categories')}
          >
            <Shield size={11} />
            <span>Category Matrix</span>
          </button>

          <button
            type="button"
            className={`jarvis-hud-switcher-btn flex items-center gap-1 px-2.5 py-1 rounded-full text-[10.5px] sm:text-[11px] font-semibold transition-colors cursor-pointer ${
              activeView === 'reactor'
                ? 'bg-white text-black'
                : 'text-[#8b9097] hover:text-white hover:bg-white/[0.06]'
            }`}
            onClick={() => onSelectView('reactor')}
          >
            <Zap size={11} />
            <span>Neural Core</span>
          </button>
        </div>
      </div>
    </div>
  );
}
