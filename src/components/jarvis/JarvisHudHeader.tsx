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
import type { JarvisSystemConfig } from '@/types';

interface JarvisHudHeaderProps {
  config: JarvisSystemConfig;
  isRunning: boolean;
  activeView: 'chat' | 'topology' | 'categories' | 'reactor';
  onSelectView: (view: 'chat' | 'topology' | 'categories' | 'reactor') => void;
  messageCount: number;
}

export function JarvisHudHeader({
  config,
  isRunning,
  activeView,
  onSelectView,
  messageCount,
}: JarvisHudHeaderProps) {
  const [timeStr, setTimeStr] = useState('');
  const [fps] = useState('60.0');

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
      className={`jarvis-hud-card rounded-2xl bg-[#0b0d11] px-4 py-3 mb-4 transition-all ${
        isRunning
          ? 'border border-cyan-500/45 shadow-[0_0_24px_rgba(34,211,238,0.12)]'
          : 'border border-[#26292e]'
      }`}
    >
      {/* Top Telemetry Ticker */}
      <div className="jarvis-hud-ticker flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-[#26292e] text-[11px] font-mono text-[#71767b]">
        <div className="flex items-center gap-3.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span
              style={{
                display: 'inline-block',
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: isRunning ? '#38bdf8' : '#22d3ee',
                boxShadow: isRunning
                  ? '0 0 12px #38bdf8, 0 0 20px #22d3ee'
                  : '0 0 6px #22d3ee',
                animation: isRunning ? 'jarvisCorePulse 1.5s ease-in-out infinite' : 'none',
              }}
            />
            <span className="text-cyan-400 font-bold tracking-wider">
              {isRunning ? 'PIPELINE ENGAGED' : 'SYSTEM ONLINE'}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Radio size={12} className="text-cyan-400" />
            <span>
              NEURAL CHANNELS: <strong className="text-[#e7e9ea]">{activeAgentsCount}/10</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Cpu size={12} className="text-cyan-400" />
            <span>
              ORCHESTRATOR: <strong className="text-[#e7e9ea]">v5.2.0-PRO</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Activity size={12} className="text-sky-400" />
            <span>
              REFRESH: <strong className="text-[#e7e9ea]">{fps} Hz</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-cyan-400">
            <Clock size={12} />
            <span>SYS_TIME: {timeStr || '00:00:00.00'}</span>
          </div>
          <span className="bg-[#121418] border border-[#26292e] px-2 py-0.5 rounded-full text-[10px] text-[#e7e9ea] font-semibold">
            {messageCount} {messageCount === 1 ? 'SESSION' : 'SESSIONS'}
          </span>
        </div>
      </div>

      {/* Main Control & Visual Switcher Row */}
      <div className="jarvis-hud-main-row flex flex-wrap items-center justify-between gap-3 pt-2.5">
        <div className="jarvis-hud-title-box flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#121418] border border-[#26292e] flex items-center justify-center shrink-0">
            <Zap size={16} className="text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="m-0 text-sm font-bold text-[#e7e9ea] tracking-tight">
                JARVIS HUD MATRIX
              </h2>
              <span className="text-[10px] font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 px-1.5 py-0.5 rounded font-bold">
                MULTI
              </span>
            </div>
            <p className="m-0 mt-0.5 text-[11px] text-[#71767b]">
              Autonomous 10-Agent Reasoning & Knowledge Synthesis Network
            </p>
          </div>
        </div>

        {/* Visual Mode Navigation */}
        <div className="jarvis-hud-switcher flex items-center flex-wrap gap-1 bg-[#121418] border border-[#26292e] rounded-full p-1">
          <button
            type="button"
            className={`jarvis-hud-switcher-btn flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
              activeView === 'chat'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
                : 'text-[#8b98a5] hover:text-white hover:bg-white/[0.04] border border-transparent'
            }`}
            onClick={() => onSelectView('chat')}
          >
            <Sparkles size={12} />
            <span>Chat Console</span>
          </button>

          <button
            type="button"
            className={`jarvis-hud-switcher-btn flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
              activeView === 'topology'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
                : 'text-[#8b98a5] hover:text-white hover:bg-white/[0.04] border border-transparent'
            }`}
            onClick={() => onSelectView('topology')}
          >
            <Cpu size={12} />
            <span>10-Agent Topology</span>
          </button>

          <button
            type="button"
            className={`jarvis-hud-switcher-btn flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
              activeView === 'categories'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
                : 'text-[#8b98a5] hover:text-white hover:bg-white/[0.04] border border-transparent'
            }`}
            onClick={() => onSelectView('categories')}
          >
            <Shield size={12} />
            <span>Category Matrix</span>
          </button>

          <button
            type="button"
            className={`jarvis-hud-switcher-btn flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
              activeView === 'reactor'
                ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/35'
                : 'text-[#8b98a5] hover:text-white hover:bg-white/[0.04] border border-transparent'
            }`}
            onClick={() => onSelectView('reactor')}
          >
            <Zap size={12} />
            <span>Neural Core</span>
          </button>
        </div>
      </div>
    </div>
  );
}
