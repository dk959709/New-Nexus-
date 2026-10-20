import React from 'react';
import {
  Search,
  Zap,
  CheckCircle2,
  Sparkles,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import type { ParallaxMessage } from '@/types';

export interface ParallaxTimelineProps {
  currentRound: 1 | 2 | 3 | null;
  isRunning: boolean;
  isComplete: boolean;
  wasStoppedEarly: boolean;
  messages: ParallaxMessage[];
}

export const ParallaxTimeline: React.FC<ParallaxTimelineProps> = ({
  currentRound,
  isRunning,
  isComplete,
  wasStoppedEarly,
  messages,
}) => {
  const roundCounts = {
    1: messages.filter((m) => m.round === 1).length,
    2: messages.filter((m) => m.round === 2).length,
    3: messages.filter((m) => m.round === 3).length,
  };

  const stages = [
    {
      step: 'ROUND 01',
      tag: 'SWARM ROUND',
      title: 'THESIS & GROUNDING',
      subtitle: 'VERITAS Tool Grounding & Initial Takes',
      icon: Search,
      count: roundCounts[1],
      target: 20,
      roundNumber: 1 as const,
      isCompleted: (currentRound && currentRound > 1) || isComplete,
      isActive: isRunning && currentRound === 1,
      isOutput: false,
    },
    {
      step: 'ROUND 02',
      tag: 'SWARM ROUND',
      title: 'CROSS-EXAMINATION',
      subtitle: 'Peer Pushback & Multi-Agent Dialectics',
      icon: Zap,
      count: roundCounts[2],
      target: 20,
      roundNumber: 2 as const,
      isCompleted: (currentRound && currentRound > 2) || isComplete,
      isActive: isRunning && currentRound === 2,
      isOutput: false,
    },
    {
      step: 'ROUND 03',
      tag: 'SWARM ROUND',
      title: 'DELIBERATION & CONVERGENCE',
      subtitle: 'Consensus Resolution & Hard Stop',
      icon: CheckCircle2,
      count: roundCounts[3],
      target: 20,
      roundNumber: 3 as const,
      isCompleted: isComplete,
      isActive: isRunning && currentRound === 3,
      isOutput: false,
    },
    {
      step: 'OUTPUT',
      tag: 'SYNTHESIS ARTIFACT',
      title: 'FINAL INTELLIGENCE SYNTHESIS',
      subtitle: 'Synthesized Findings & Research Conclusion',
      icon: Sparkles,
      count: isComplete ? 1 : 0,
      target: 1,
      roundNumber: null,
      isCompleted: isComplete,
      isActive: isRunning && currentRound === 3 && roundCounts[3] >= 15,
      isOutput: true,
    },
  ];

  return (
    <div
      id="parallax-mission-timeline"
      className="relative py-5 border-b border-white/[0.06] select-none"
    >
      {/* Top Header */}
      <div className="pb-4 mb-4 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
          <span className="text-xs font-mono font-black uppercase text-slate-100 tracking-wider">
            MISSION CHRONOLOGY PROTOCOL
          </span>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900/40 backdrop-blur-xl text-cyan-300 font-bold">
            3 SWARM ROUNDS + SYNTHESIS
          </span>
          {wasStoppedEarly && (
            <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 font-bold flex items-center gap-1">
              <AlertTriangle size={10} />
              STOPPED EARLY
            </span>
          )}
        </div>

        <div className="text-[11px] font-mono text-slate-300 flex items-center gap-3">
          <div>
            <span>LOGGED: </span>
            <strong className="text-cyan-300 font-bold">{messages.length}</strong>
            <span className="text-slate-300"> / 60 MAX REPLIES</span>
          </div>
          <span className="text-white/20 hidden sm:inline">•</span>
          <div className="text-slate-300 hidden sm:inline">
            <span>STATE: </span>
            <strong className={isRunning ? 'text-cyan-300' : isComplete ? 'text-emerald-300' : 'text-slate-200'}>
              {isRunning ? 'DELIBERATING' : isComplete ? 'SYNTHESIZED' : 'STANDBY'}
            </strong>
          </div>
        </div>
      </div>

      {/* Open Timeline Thread with subtle left-line connectors */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stages.map((stg) => {
          const Icon = stg.icon;
          const progressPct = Math.min(100, Math.round((stg.count / stg.target) * 100));

          const leftConnectorClass = stg.isActive
            ? 'border-l-2 border-cyan-400 bg-slate-900/40 backdrop-blur-xl'
            : stg.isCompleted
            ? 'border-l-2 border-emerald-400/70 hover:bg-slate-900/40'
            : stg.isOutput
            ? 'border-l-2 border-purple-400/50 hover:bg-slate-900/40'
            : 'border-l border-white/15 hover:bg-slate-900/40';

          return (
            <div
              key={stg.step}
              className={`pl-4 pr-3 py-2.5 rounded-r-xl relative transition-colors duration-200 font-mono flex flex-col justify-between ${leftConnectorClass}`}
            >
              {/* Step number badge & icon */}
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ${
                        stg.isActive
                          ? 'bg-cyan-400 text-slate-950 shadow-[0_0_8px_#00f0ff]'
                          : stg.isCompleted
                          ? 'bg-emerald-400/20 text-emerald-300'
                          : stg.isOutput
                          ? 'bg-purple-500/20 text-purple-200'
                          : 'bg-slate-900/40 text-slate-300'
                      }`}
                    >
                      {stg.step}
                    </span>
                    <span className="text-[9px] text-slate-300 font-bold uppercase tracking-wider">
                      [{stg.tag}]
                    </span>
                  </div>

                  <div className="shrink-0">
                    {stg.isCompleted ? (
                      <span className="text-emerald-300 inline-flex items-center gap-1 text-[10px] font-bold">
                        <Lock size={11} />
                        LOCKED
                      </span>
                    ) : stg.isActive ? (
                      <span className="text-cyan-300 inline-flex items-center gap-1 text-[10px] font-bold animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                        RUNNING
                      </span>
                    ) : (
                      <span className="text-slate-300 text-[10px]">STANDBY</span>
                    )}
                  </div>
                </div>

                {/* Title */}
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon
                    size={13}
                    className={
                      stg.isActive
                        ? 'text-cyan-300 shrink-0'
                        : stg.isCompleted
                        ? 'text-emerald-300 shrink-0'
                        : stg.isOutput
                        ? 'text-purple-300 shrink-0'
                        : 'text-slate-300 shrink-0'
                    }
                  />
                  <span
                    className={`text-xs font-bold truncate ${
                      stg.isActive
                        ? 'text-slate-100'
                        : stg.isCompleted
                        ? 'text-emerald-200'
                        : stg.isOutput
                        ? 'text-purple-200'
                        : 'text-slate-100'
                    }`}
                  >
                    {stg.title}
                  </span>
                </div>

                {/* Subtitle description */}
                <p className="m-0 text-[11px] text-slate-300 font-sans line-clamp-1 mb-3">
                  {stg.subtitle}
                </p>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-300">
                    {stg.roundNumber
                      ? `${stg.count} / ${stg.target} Replies`
                      : stg.isCompleted
                      ? 'Report Generated'
                      : 'Awaiting Deliberation'}
                  </span>
                  <span className={stg.isActive ? 'text-cyan-300 font-bold' : 'text-slate-300'}>
                    {stg.roundNumber ? `${progressPct}%` : stg.isCompleted ? '100%' : '0%'}
                  </span>
                </div>

                <div className="h-1 w-full rounded-full bg-white/[0.08] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      stg.isActive
                        ? 'bg-gradient-to-r from-cyan-400 to-sky-400 animate-pulse'
                        : stg.isCompleted
                        ? 'bg-emerald-400'
                        : stg.isOutput
                        ? 'bg-purple-400'
                        : 'bg-slate-600'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
