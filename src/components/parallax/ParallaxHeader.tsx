import React from 'react';
import {
  Radio,
  Cpu,
  Search,
  CheckCircle2,
  Sparkles,
  Zap,
  Globe2,
} from 'lucide-react';

interface ParallaxHeaderProps {
  isRunning: boolean;
  currentRound: 1 | 2 | 3 | null;
  isComplete: boolean;
  wasStoppedEarly: boolean;
  totalAgentsCount: number;
  dynamicSpecialistsCount: number;
  factsCount?: number;
  activeProviderName?: string;
  activeModelName?: string;
}

export const ParallaxHeader: React.FC<ParallaxHeaderProps> = ({
  isRunning,
  currentRound,
  isComplete,
  wasStoppedEarly,
  totalAgentsCount,
  dynamicSpecialistsCount,
  factsCount = 0,
  activeProviderName = 'OpenRouter',
  activeModelName = 'Llama 3.3 70B',
}) => {
  // Determine overall status text
  const swarmStatus = isRunning
    ? 'SWARM ACTIVE'
    : isComplete
    ? 'SYNTHESIS COMPLETE'
    : wasStoppedEarly
    ? 'SWARM HALTED'
    : 'SWARM ONLINE';

  const statusColor = isRunning
    ? 'var(--nexus-cyan)'
    : isComplete
    ? 'var(--nexus-green)'
    : wasStoppedEarly
    ? 'var(--nexus-warning)'
    : 'var(--nexus-cyan)';

  // Status strip state resolution
  // Stages: CORE ONLINE, RESEARCH ACTIVE, FACT CHECKING, DELIBERATION, SYNTHESIS
  const isResearchActive = isRunning && currentRound === 1;
  const isFactChecking = isRunning && factsCount > 0;
  const isDeliberationActive = isRunning && (currentRound === 2 || currentRound === 3);
  const isSynthesisComplete = isComplete;

  return (
    <header
      id="parallax-command-header"
      className="nexus-corner-bracket relative overflow-hidden rounded-2xl mb-5"
      style={{
        background: 'linear-gradient(135deg, rgba(6, 16, 26, 0.94) 0%, rgba(3, 10, 18, 0.98) 100%)',
        border: '1px solid rgba(0, 240, 255, 0.25)',
        boxShadow: '0 12px 40px rgba(0, 0, 0, 0.6), inset 0 0 30px rgba(0, 240, 255, 0.05)',
      }}
    >
      {/* Holographic scanning line */}
      <div className="nexus-header-scanline" />

      {/* Ambient background tactical mesh */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'radial-gradient(rgba(0, 240, 255, 0.15) 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Main Header Row */}
      <div className="relative z-10 px-5 py-4 sm:px-6 sm:py-5 flex flex-wrap items-center justify-between gap-4 border-b border-cyan-500/15">
        {/* Left Branding & Identity */}
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: 'radial-gradient(circle at center, rgba(0, 240, 255, 0.3) 0%, rgba(6, 16, 26, 0.9) 100%)',
              border: '1.5px solid rgba(0, 240, 255, 0.6)',
              boxShadow: '0 0 20px rgba(0, 240, 255, 0.35)',
            }}
          >
            <div className="relative">
              <Cpu size={22} className="text-cyan-300" />
              {isRunning && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="m-0 text-xl sm:text-2xl font-black tracking-tight text-white font-mono flex items-center gap-2">
                <span>PARALLAX</span>
                <span className="text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                  Swarm OS
                </span>
              </h1>
            </div>

            <p className="m-0 text-xs text-slate-400 font-mono tracking-wide flex items-center gap-1.5 mt-0.5">
              <span>MULTI-AGENT SWARM INTELLIGENCE</span>
              <span className="text-slate-600">•</span>
              <span className="text-cyan-400 font-semibold">20 PERSONAS + DYNAMIC SPECIALISTS</span>
            </p>

            {/* Small status pills */}
            <div className="flex items-center gap-2 mt-2 flex-wrap text-[11px] font-mono">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold"
                style={{
                  background: isRunning ? 'rgba(0, 240, 255, 0.15)' : 'rgba(16, 185, 129, 0.12)',
                  color: statusColor,
                  border: `1px solid ${statusColor}40`,
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    background: statusColor,
                    boxShadow: `0 0 6px ${statusColor}`,
                  }}
                />
                {swarmStatus}
              </span>

              <span className="text-slate-500">•</span>

              <span className="text-slate-300">
                <strong className="text-cyan-300 font-bold">{totalAgentsCount}</strong> AGENTS
                {dynamicSpecialistsCount > 0 && (
                  <span className="text-purple-300 ml-1">
                    (+{dynamicSpecialistsCount} TOPIC SPEC)
                  </span>
                )}
              </span>

              <span className="text-slate-500">•</span>

              <span className="text-slate-300">
                <strong className="text-sky-300 font-bold">3</strong> ROUNDS HARD CAP
              </span>
            </div>
          </div>
        </div>

        {/* Right Telemetry & Provider Status */}
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap self-center">
          {/* Live indicator badge */}
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border"
            style={{
              background: 'rgba(3, 10, 18, 0.75)',
              borderColor: isRunning ? 'rgba(0, 240, 255, 0.35)' : 'rgba(255, 255, 255, 0.1)',
            }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRunning ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'
                }`}
                style={{
                  boxShadow: isRunning ? '0 0 8px #00f0ff' : '0 0 8px #10b981',
                }}
              />
              <span className="text-[11px] font-mono font-bold uppercase text-slate-200 tracking-wider">
                LIVE
              </span>
            </div>
            <span className="text-slate-600 text-xs">|</span>
            <div className="text-left font-mono">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 leading-none">
                SYSTEM HEALTH
              </div>
              <div className="text-[11px] font-bold text-emerald-400 leading-tight">
                OPTIMAL • VERITAS READY
              </div>
            </div>
          </div>

          {/* Model / Provider Badge */}
          <div
            className="hidden md:flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-white/10"
            style={{ background: 'rgba(3, 10, 18, 0.75)' }}
          >
            <Globe2 size={14} className="text-cyan-400" />
            <div className="font-mono text-left">
              <div className="text-[9px] uppercase tracking-wider text-slate-400 leading-none">
                AI ENGINE
              </div>
              <div className="text-[11px] font-bold text-cyan-300 truncate max-w-[140px]">
                {activeModelName || activeProviderName}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Under-header Compact System Status Strip */}
      <div
        id="parallax-status-strip"
        className="px-5 py-2 sm:px-6 bg-black/40 flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono border-t border-white/5"
      >
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          {/* CORE ONLINE */}
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            <span className="font-semibold text-emerald-300">CORE ONLINE</span>
          </div>

          {/* RESEARCH ACTIVE */}
          <div className="flex items-center gap-1.5">
            {isResearchActive ? (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
            ) : (
              <span className={`w-1.5 h-1.5 rounded-full ${currentRound && currentRound > 1 ? 'bg-cyan-500' : 'bg-slate-600'}`} />
            )}
            <span className={isResearchActive ? 'font-bold text-cyan-300 animate-pulse' : currentRound && currentRound > 1 ? 'text-slate-300' : 'text-slate-500'}>
              RESEARCH ACTIVE
            </span>
          </div>

          {/* FACT CHECKING */}
          <div className="flex items-center gap-1.5">
            {isFactChecking ? (
              <Search size={11} className="text-amber-400 animate-spin" />
            ) : (
              <span className={`w-1.5 h-1.5 rounded-full ${factsCount > 0 ? 'bg-amber-400 shadow-[0_0_4px_#f59e0b]' : 'bg-slate-600'}`} />
            )}
            <span className={isFactChecking ? 'font-bold text-amber-300' : factsCount > 0 ? 'text-amber-300/80' : 'text-slate-500'}>
              FACT CHECKING {factsCount > 0 ? `(${factsCount})` : ''}
            </span>
          </div>

          {/* DELIBERATION */}
          <div className="flex items-center gap-1.5">
            {isDeliberationActive ? (
              <Zap size={11} className="text-purple-400 animate-bounce" />
            ) : (
              <span className={`w-1.5 h-1.5 rounded-full ${isComplete ? 'bg-purple-500' : 'bg-slate-600'}`} />
            )}
            <span className={isDeliberationActive ? 'font-bold text-purple-300 animate-pulse' : isComplete ? 'text-slate-300' : 'text-slate-500'}>
              DELIBERATION {isRunning && currentRound ? `[R${currentRound}]` : ''}
            </span>
          </div>

          {/* SYNTHESIS */}
          <div className="flex items-center gap-1.5">
            {isSynthesisComplete ? (
              <CheckCircle2 size={12} className="text-emerald-400 shadow-[0_0_6px_#10b981]" />
            ) : isRunning && currentRound === 3 ? (
              <Sparkles size={11} className="text-cyan-400 animate-spin" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
            )}
            <span className={isSynthesisComplete ? 'font-bold text-emerald-300' : isRunning && currentRound === 3 ? 'text-cyan-300 animate-pulse' : 'text-slate-500'}>
              SYNTHESIS
            </span>
          </div>
        </div>

        {/* Live Audio / Speaking status indicator */}
        <div className="text-[10px] text-slate-400 hidden sm:flex items-center gap-2">
          <Radio size={11} className={isRunning ? 'text-cyan-400 animate-pulse' : 'text-slate-600'} />
          <span>NEURAL MESH • EDGE TTS AUDIO READY</span>
        </div>
      </div>
    </header>
  );
};
