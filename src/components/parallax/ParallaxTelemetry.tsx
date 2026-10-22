import React from 'react';
import {
  Users,
  Activity,
  CheckCircle2,
  Clock,
  Search,
  Zap,
  Cpu,
} from 'lucide-react';

export interface ParallaxTelemetryProps {
  totalAgentsCount: number;
  activeCount: number;
  completedRepliesCount: number;
  currentRound: 1 | 2 | 3 | null;
  sourcesCount: number;
  avgConviction?: string;
  isRunning: boolean;
  isComplete: boolean;
  activeModel?: string;
}

export const ParallaxTelemetry: React.FC<ParallaxTelemetryProps> = ({
  totalAgentsCount,
  activeCount,
  completedRepliesCount,
  currentRound,
  sourcesCount,
  avgConviction = '7.5',
  isRunning,
  isComplete,
  activeModel = 'Llama 3.3 70B',
}) => {
  const maxReplies = Math.max(totalAgentsCount * 3, 60);
  const progressPct = Math.min(100, Math.round((completedRepliesCount / maxReplies) * 100));

  const cards = [
    {
      label: 'Swarm Nodes',
      value: `${totalAgentsCount}`,
      subtext: 'Active Personas',
      icon: Users,
      accentClass: 'text-cyan-400',
      badgeClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    },
    {
      label: 'Pipeline State',
      value: isRunning ? `${activeCount || 1} Speaking` : isComplete ? 'Consensus' : 'Standby',
      subtext: isRunning ? 'Live Deliberation' : isComplete ? 'Verified Output' : 'Ready to Launch',
      icon: Activity,
      accentClass: isRunning ? 'text-cyan-400' : isComplete ? 'text-emerald-400' : 'text-slate-400',
      badgeClass: isRunning
        ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
        : isComplete
        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
        : 'bg-white/[0.04] text-slate-300 border-white/[0.08]',
    },
    {
      label: 'Replies Logged',
      value: `${completedRepliesCount} / ${maxReplies}`,
      subtext: `${progressPct}% of 3-Round Cap`,
      icon: CheckCircle2,
      accentClass: 'text-sky-400',
      badgeClass: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
      progress: progressPct,
    },
    {
      label: 'Active Phase',
      value: currentRound ? `Round 0${currentRound}` : isComplete ? 'Round 03' : 'Round 01',
      subtext:
        currentRound === 1
          ? 'Thesis & Grounding'
          : currentRound === 2
          ? 'Cross-Examination'
          : currentRound === 3 || isComplete
          ? 'Final Convergence'
          : 'Awaiting Prompt',
      icon: Clock,
      accentClass: 'text-violet-400',
      badgeClass: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    },
    {
      label: 'Grounded Facts',
      value: `${sourcesCount}`,
      subtext: 'VERITAS Web Search',
      icon: Search,
      accentClass: 'text-emerald-400',
      badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    },
    {
      label: 'Avg Conviction',
      value: `${avgConviction}`,
      subtext: 'Weighted Confidence',
      icon: Zap,
      accentClass: 'text-amber-400',
      badgeClass: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    },
    {
      label: 'Core Engine',
      value: activeModel,
      subtext: 'Orchestration Mesh',
      icon: Cpu,
      accentClass: 'text-cyan-400',
      badgeClass: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
    },
  ];

  return (
    <div
      id="parallax-telemetry-hud"
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5"
    >
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className={`p-3 rounded-xl bg-[#0b101b]/90 border border-white/[0.07] hover:border-cyan-500/25 flex flex-col justify-between transition-colors min-w-0 ${
              i === cards.length - 1 ? 'col-span-2 sm:col-span-1' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-1.5 mb-1.5">
              <span className="text-[11px] font-medium text-slate-400 truncate">
                {c.label}
              </span>
              <Icon size={13} className={`${c.accentClass} shrink-0`} />
            </div>

            <div className="my-0.5 min-w-0">
              <div
                className="text-sm sm:text-[15px] font-bold font-mono tabular-nums text-white truncate"
                title={String(c.value)}
              >
                {c.value}
              </div>
            </div>

            {typeof c.progress === 'number' ? (
              <div className="mt-1.5 space-y-1">
                <div className="h-1 w-full rounded-full bg-white/[0.07] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-all duration-300"
                    style={{ width: `${Math.max(4, c.progress)}%` }}
                  />
                </div>
                <div className="text-[10.5px] text-slate-400 truncate">{c.subtext}</div>
              </div>
            ) : (
              <div className="mt-1 text-[10.5px] text-slate-400 truncate">
                {c.subtext}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
