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
      step: '01',
      title: 'THESIS & GROUNDING',
      subtitle: 'VERITAS Tool Grounding & Initial Takes',
      icon: Search,
      count: roundCounts[1],
      target: 20,
      roundNumber: 1 as const,
      isCompleted: (currentRound && currentRound > 1) || isComplete,
      isActive: isRunning && currentRound === 1,
    },
    {
      step: '02',
      title: 'CROSS-EXAMINATION',
      subtitle: 'Peer Pushback & Multi-Agent Dialectics',
      icon: Zap,
      count: roundCounts[2],
      target: 20,
      roundNumber: 2 as const,
      isCompleted: (currentRound && currentRound > 2) || isComplete,
      isActive: isRunning && currentRound === 2,
    },
    {
      step: '03',
      title: 'DELIBERATION & CONVERGENCE',
      subtitle: 'Consensus Resolution & Hard Stop',
      icon: CheckCircle2,
      count: roundCounts[3],
      target: 20,
      roundNumber: 3 as const,
      isCompleted: isComplete,
      isActive: isRunning && currentRound === 3,
    },
    {
      step: '04',
      title: 'FINAL INTELLIGENCE REPORT',
      subtitle: 'Consensus Synthesis & Grounded Verdict',
      icon: Sparkles,
      count: isComplete ? 1 : 0,
      target: 1,
      roundNumber: null,
      isCompleted: isComplete,
      isActive: isRunning && currentRound === 3 && roundCounts[3] >= 15,
    },
  ];

  return (
    <div
      id="parallax-mission-timeline"
      className="nexus-corner-bracket relative rounded-2xl overflow-hidden mb-6"
      style={{
        background: 'linear-gradient(135deg, rgba(6, 16, 26, 0.94) 0%, rgba(3, 10, 18, 0.98) 100%)',
        border: '1px solid rgba(0, 240, 255, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 24px rgba(0, 240, 255, 0.04)',
      }}
    >
      {/* Top Header */}
      <div className="px-5 py-3.5 bg-black/60 backdrop-blur-md border-b border-cyan-500/15 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-black uppercase text-white tracking-wider">
            MISSION CHRONOLOGY PROTOCOL
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/25 font-bold">
            3-ROUND HARD CAP
          </span>
          {wasStoppedEarly && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/15 text-rose-300 border border-rose-500/30 font-bold flex items-center gap-1">
              <AlertTriangle size={10} />
              STOPPED EARLY
            </span>
          )}
        </div>

        <div className="text-[11px] font-mono text-slate-400">
          <span>COMPLETED: </span>
          <strong className="text-cyan-300">{messages.length}</strong>
          <span className="text-slate-500"> / 60 MAX REPLIES</span>
        </div>
      </div>

      {/* Timeline Steps (Horizontal on Desktop, Vertical on Mobile) */}
      <div className="p-4 sm:p-5">
        <div className="flex flex-col lg:flex-row items-stretch gap-3">
          {stages.map((stg) => {
            const Icon = stg.icon;
            const progressPct = Math.min(100, Math.round((stg.count / stg.target) * 100));

            return (
              <div
                key={stg.step}
                className={`flex-1 rounded-xl p-3.5 relative transition-all duration-300 font-mono ${
                  stg.isActive
                    ? 'border-2 border-cyan-400 bg-cyan-500/10 shadow-[0_0_24px_rgba(0,240,255,0.25)]'
                    : stg.isCompleted
                    ? 'border border-emerald-500/40 bg-emerald-950/20'
                    : 'border border-white/10 bg-white/[0.02] opacity-75'
                }`}
              >
                {/* Step number badge & icon */}
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded shrink-0 ${
                        stg.isActive
                          ? 'bg-cyan-400 text-black shadow-[0_0_8px_#00f0ff]'
                          : stg.isCompleted
                          ? 'bg-emerald-500 text-black'
                          : 'bg-white/10 text-slate-400'
                      }`}
                    >
                      {stg.step}
                    </span>
                    <Icon size={13} className={stg.isActive ? 'text-cyan-300 shrink-0' : stg.isCompleted ? 'text-emerald-400 shrink-0' : 'text-slate-500 shrink-0'} />
                    <span
                      className={`text-xs font-bold truncate ${
                        stg.isActive ? 'text-white' : stg.isCompleted ? 'text-emerald-300' : 'text-slate-300'
                      }`}
                    >
                      {stg.title}
                    </span>
                  </div>

                  <div className="shrink-0">
                    {stg.isCompleted ? (
                      <span className="text-emerald-400 inline-flex items-center gap-1 text-[10px] font-bold">
                        <Lock size={11} />
                        LOCKED
                      </span>
                    ) : stg.isActive ? (
                      <span className="text-cyan-400 inline-flex items-center gap-1 text-[10px] font-bold animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                        RUNNING
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[10px]">STANDBY</span>
                    )}
                  </div>
                </div>

                {/* Subtitle description */}
                <p className="m-0 text-[11px] text-slate-400 font-sans line-clamp-1 mb-2.5">
                  {stg.subtitle}
                </p>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-slate-400">
                      {stg.roundNumber ? `${stg.count} / ${stg.target} Replies` : stg.isCompleted ? 'Report Generated' : 'Awaiting Deliberation'}
                    </span>
                    <span className={stg.isActive ? 'text-cyan-300 font-bold' : 'text-slate-400'}>
                      {stg.roundNumber ? `${progressPct}%` : stg.isCompleted ? '100%' : '0%'}
                    </span>
                  </div>

                  <div className="h-1.5 w-full rounded-full bg-black/60 overflow-hidden border border-white/5">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        stg.isActive
                          ? 'bg-gradient-to-r from-cyan-500 to-sky-400 animate-pulse'
                          : stg.isCompleted
                          ? 'bg-emerald-400'
                          : 'bg-slate-700'
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
    </div>
  );
};
