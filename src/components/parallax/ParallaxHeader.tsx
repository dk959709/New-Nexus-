import React from 'react';
import {
  Radio,
  Cpu,
  Search,
  CheckCircle2,
  Sparkles,
  Zap,
  Globe2,
  Gavel,
  Landmark,
  Rocket,
  Newspaper,
} from 'lucide-react';
import { getDebateModeConfig } from '@/data/parallaxDebateModes';
import type { ParallaxDebateMode } from '@/types';

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
  debateMode?: ParallaxDebateMode;
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
  debateMode = 'default',
}) => {
  const modeConfig = getDebateModeConfig(debateMode);

  // Determine overall status text
  const swarmStatus = isRunning
    ? 'SWARM ACTIVE'
    : isComplete
    ? 'SYNTHESIS COMPLETE'
    : wasStoppedEarly
    ? 'SWARM HALTED'
    : `${modeConfig.label} ONLINE`;

  const statusColor = isRunning
    ? (modeConfig.accentColor || 'var(--nexus-cyan)')
    : isComplete
    ? 'var(--nexus-green)'
    : wasStoppedEarly
    ? 'var(--nexus-warning)'
    : (modeConfig.accentColor || 'var(--nexus-cyan)');

  // Dynamic Mode Icon
  const ModeIcon =
    debateMode === 'courtroom'
      ? Gavel
      : debateMode === 'senate'
      ? Landmark
      : debateMode === 'scifi'
      ? Rocket
      : debateMode === 'news'
      ? Newspaper
      : Cpu;

  // Status strip state resolution
  // Stages: CORE ONLINE, RESEARCH ACTIVE, FACT CHECKING, DELIBERATION, SYNTHESIS
  const isResearchActive = isRunning && currentRound === 1;
  const isFactChecking = isRunning && factsCount > 0;
  const isDeliberationActive = isRunning && (currentRound === 2 || currentRound === 3);
  const isSynthesisComplete = isComplete;

  return (
    <header
      id="parallax-command-header"
      className="relative overflow-hidden border-b border-white/[0.06] pb-4 mb-6"
    >
      {/* Main Header Row */}
      <div className="relative z-10 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-4">
        {/* Left Branding & Identity */}
        <div className="flex items-center gap-4 min-w-0">
          <div
            className="w-11 h-11 rounded-2xl bg-slate-900/40 backdrop-blur-xl flex items-center justify-center shrink-0"
            style={{
              boxShadow: `0 0 24px ${modeConfig.accentColor}25`,
            }}
          >
            <div className="relative">
              <ModeIcon size={22} style={{ color: modeConfig.accentColor }} />
              {isRunning && (
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              )}
            </div>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="m-0 text-xl sm:text-2xl font-black tracking-tight text-slate-100 font-mono flex items-center gap-2.5">
                <span>PARALLAX</span>
                <span
                  className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-slate-900/40 backdrop-blur-xl"
                  style={{
                    color: modeConfig.accentColor,
                  }}
                >
                  {modeConfig.label}
                </span>
              </h1>
            </div>

            <p className="m-0 text-xs text-slate-300 font-mono tracking-wide flex items-center gap-1.5 mt-1">
              <span>MULTI-AGENT SWARM INTELLIGENCE</span>
              <span className="text-slate-500">•</span>
              <span className="text-cyan-300 font-semibold">20 PERSONAS + DYNAMIC SPECIALISTS</span>
            </p>

            {/* Borderless floating glassmorphic status pills */}
            <div className="flex items-center gap-2 mt-2.5 flex-wrap text-[11px] font-mono">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold bg-slate-900/40 backdrop-blur-xl text-slate-100"
                style={{
                  color: statusColor,
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

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/40 backdrop-blur-xl text-slate-100">
                <strong className="text-cyan-300 font-bold">{totalAgentsCount}</strong> PERSONAS
                {dynamicSpecialistsCount > 0 && (
                  <span className="text-purple-300 ml-1">
                    (+{dynamicSpecialistsCount} TOPIC SPEC)
                  </span>
                )}
              </span>

              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900/40 backdrop-blur-xl text-slate-300">
                <strong className="text-sky-300 font-bold">3</strong> ROUNDS HARD CAP
              </span>
            </div>
          </div>
        </div>

        {/* Right Telemetry & Provider Status */}
        <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap self-center">
          {/* Live indicator floating glass pill */}
          <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-slate-900/40 backdrop-blur-xl">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isRunning ? 'bg-cyan-400 animate-pulse' : 'bg-emerald-400'
                }`}
                style={{
                  boxShadow: isRunning ? '0 0 8px #00f0ff' : '0 0 8px #10b981',
                }}
              />
              <span className="text-[11px] font-mono font-bold uppercase text-slate-100 tracking-wider">
                LIVE
              </span>
            </div>
            <span className="text-white/10 text-xs">|</span>
            <div className="text-left font-mono">
              <div className="text-[9px] uppercase tracking-wider text-slate-300 leading-none">
                SYSTEM HEALTH
              </div>
              <div className="text-[11px] font-bold text-emerald-300 leading-tight">
                OPTIMAL • VERITAS READY
              </div>
            </div>
          </div>

          {/* Model / Provider Floating Glass Pill */}
          <div className="hidden md:flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-slate-900/40 backdrop-blur-xl">
            <Globe2 size={14} className="text-cyan-300" />
            <div className="font-mono text-left">
              <div className="text-[9px] uppercase tracking-wider text-slate-300 leading-none">
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
        className="pt-3 mt-1 border-t border-white/[0.06] flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono"
      >
        <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
          {/* CORE ONLINE */}
          <div className="flex items-center gap-1.5 text-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#10b981]" />
            <span className="font-semibold text-emerald-300">CORE ONLINE</span>
          </div>

          {/* RESEARCH ACTIVE */}
          <div className="flex items-center gap-1.5">
            {isResearchActive ? (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
            ) : (
              <span className={`w-1.5 h-1.5 rounded-full ${currentRound && currentRound > 1 ? 'bg-cyan-400' : 'bg-slate-600'}`} />
            )}
            <span className={isResearchActive ? 'font-bold text-cyan-300 animate-pulse' : currentRound && currentRound > 1 ? 'text-slate-200' : 'text-slate-400'}>
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
            <span className={isFactChecking ? 'font-bold text-amber-300' : factsCount > 0 ? 'text-amber-300' : 'text-slate-400'}>
              FACT CHECKING {factsCount > 0 ? `(${factsCount})` : ''}
            </span>
          </div>

          {/* DELIBERATION */}
          <div className="flex items-center gap-1.5">
            {isDeliberationActive ? (
              <Zap size={11} className="text-purple-400 animate-bounce" />
            ) : (
              <span className={`w-1.5 h-1.5 rounded-full ${isComplete ? 'bg-purple-400' : 'bg-slate-600'}`} />
            )}
            <span className={isDeliberationActive ? 'font-bold text-purple-300 animate-pulse' : isComplete ? 'text-slate-200' : 'text-slate-400'}>
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
            <span className={isSynthesisComplete ? 'font-bold text-emerald-300' : isRunning && currentRound === 3 ? 'text-cyan-300 animate-pulse' : 'text-slate-400'}>
              SYNTHESIS
            </span>
          </div>
        </div>

        {/* Live Audio / Speaking status indicator */}
        <div className="text-[10px] text-slate-300 hidden sm:flex items-center gap-2">
          <Radio size={11} className={isRunning ? 'text-cyan-400 animate-pulse' : 'text-slate-400'} />
          <span>NEURAL MESH • EDGE TTS AUDIO READY</span>
        </div>
      </div>
    </header>
  );
};
