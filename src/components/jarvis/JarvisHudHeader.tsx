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

  return (
    <div
      data-theme={activeTheme}
      className={`jarvis-hud-card px-3 py-2 rounded-xl bg-[var(--j-lowest)] transition-all ${
        isRunning ? 'ring-1 ring-[var(--j-accent)]/40' : ''
      }`}
    >
      <div className="jarvis-hud-main-row flex flex-wrap items-center justify-between gap-2">
        {/* Left: Compact Telemetry Strip */}
        <div className="jarvis-hud-ticker flex items-center gap-2 flex-wrap text-[10px] font-mono text-[var(--j-faint)] min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isRunning ? 'bg-[var(--j-accent)] animate-ping' : 'bg-[var(--j-accent)]'
              }`}
            />
            <span className="text-[var(--j-accent)] font-semibold tracking-wider">
              {isRunning ? 'PIPELINE ENGAGED' : 'MESH ONLINE'}
            </span>
          </div>

          <span className="opacity-40" aria-hidden="true">·</span>

          <div className="flex items-center gap-1" title="Active Neural Channels">
            <Radio size={11} className="text-[var(--j-muted)]" />
            <span>
              NODES: <strong className="text-[var(--j-text)]">{activeAgentsCount}/10</strong>
            </span>
          </div>

          <span className="hidden md:inline opacity-40" aria-hidden="true">·</span>

          <div className="hidden md:flex items-center gap-1" title="Refresh Rate">
            <Activity size={11} className="text-[var(--j-muted)]" />
            <span>
              <strong className="text-[var(--j-text)]">{fps} Hz</strong>
            </span>
          </div>

          <span className="hidden sm:inline opacity-40" aria-hidden="true">·</span>

          <div className="hidden sm:flex items-center gap-1 text-[var(--j-muted)] tabular-nums">
            <Clock size={11} />
            <span>{timeStr || '00:00:00.00'}</span>
          </div>

          <span className="opacity-40" aria-hidden="true">·</span>

          <span className="text-[10px] text-[var(--j-muted)] font-mono tabular-nums">
            {messageCount} {messageCount === 1 ? 'DIRECTIVE' : 'DIRECTIVES'}
          </span>
        </div>

        {/* Right: Slim Row of 4 View Switcher Pills */}
        <div className="jarvis-hud-switcher flex items-center flex-wrap gap-1 rounded-lg bg-[var(--j-low)] p-0.5">
          <button
            type="button"
            className={`jarvis-hud-switcher-btn flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
              activeView === 'chat'
                ? 'bg-[var(--j-high)] text-[var(--j-accent)]'
                : 'text-[var(--j-muted)] hover:text-[var(--j-text)]'
            }`}
            onClick={() => onSelectView('chat')}
          >
            <Sparkles size={11} />
            <span>Chat Console</span>
          </button>

          <button
            type="button"
            className={`jarvis-hud-switcher-btn flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
              activeView === 'topology'
                ? 'bg-[var(--j-high)] text-[var(--j-accent)]'
                : 'text-[var(--j-muted)] hover:text-[var(--j-text)]'
            }`}
            onClick={() => onSelectView('topology')}
          >
            <Cpu size={11} />
            <span>10-Agent Topology</span>
          </button>

          <button
            type="button"
            className={`jarvis-hud-switcher-btn flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
              activeView === 'categories'
                ? 'bg-[var(--j-high)] text-[var(--j-accent)]'
                : 'text-[var(--j-muted)] hover:text-[var(--j-text)]'
            }`}
            onClick={() => onSelectView('categories')}
          >
            <Shield size={11} />
            <span>Category Matrix</span>
          </button>

          <button
            type="button"
            className={`jarvis-hud-switcher-btn flex items-center gap-1 px-2.5 py-1 rounded-md font-mono text-[10px] uppercase tracking-wider font-semibold transition-colors cursor-pointer ${
              activeView === 'reactor'
                ? 'bg-[var(--j-high)] text-[var(--j-accent)]'
                : 'text-[var(--j-muted)] hover:text-[var(--j-text)]'
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
