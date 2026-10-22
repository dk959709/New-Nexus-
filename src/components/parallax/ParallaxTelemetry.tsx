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
  configuredAgentsCount: number;
  enabledAgentsCount: number;
  dynamicSpecialistsCount?: number;
  respondedAgentsCount: number;
  currentRoundRespondedCount?: number;
  speakingAgentsCount: number;
  completedRepliesCount: number;
  expectedMaxReplies: number;
  currentRound: 1 | 2 | 3 | null;
  sourcesCount: number | null;
  sourcesSubtext?: string;
  avgConviction: string | null;
  avgConvictionSubtext?: string;
  isRunning: boolean;
  isComplete: boolean;
  wasStoppedEarly?: boolean;
  activeModel?: string;
}

export const ParallaxTelemetry: React.FC<ParallaxTelemetryProps> = ({
  configuredAgentsCount,
  enabledAgentsCount,
  dynamicSpecialistsCount = 0,
  respondedAgentsCount,
  currentRoundRespondedCount = 0,
  speakingAgentsCount,
  completedRepliesCount,
  expectedMaxReplies,
  currentRound,
  sourcesCount,
  sourcesSubtext,
  avgConviction,
  avgConvictionSubtext,
  isRunning,
  isComplete,
  wasStoppedEarly = false,
  activeModel = 'Built-in Default',
}) => {
  const totalActivePool = enabledAgentsCount + dynamicSpecialistsCount;
  const disabledCount = Math.max(0, configuredAgentsCount - enabledAgentsCount);
  const progressPct =
    expectedMaxReplies > 0
      ? Math.min(100, Math.round((completedRepliesCount / expectedMaxReplies) * 100))
      : 0;

  const phaseValue = isRunning
    ? currentRound
      ? `Round 0${currentRound} / 03`
      : 'Round 00'
    : isComplete
    ? 'Complete (3/3)'
    : wasStoppedEarly
    ? 'Stopped Early'
    : completedRepliesCount > 0 && currentRound
    ? `Round 0${currentRound} / 03`
    : 'Standby';

  const phaseSubtext = isRunning
    ? !currentRound
      ? 'Entity & Web Grounding'
      : currentRound === 1
      ? 'Thesis & Grounding'
      : currentRound === 2
      ? 'Cross-Examination'
      : 'Final Convergence'
    : isComplete
    ? 'Synthesis Verified'
    : wasStoppedEarly
    ? currentRound
      ? `Halted in Round 0${currentRound}`
      : 'Halted by Operator'
    : 'Awaiting Prompt';

  const cards = [
    {
      label: 'Configured Pool',
      value: `${enabledAgentsCount} / ${configuredAgentsCount} Enabled`,
      subtext:
        dynamicSpecialistsCount > 0
          ? `+${dynamicSpecialistsCount} Specialists (${totalActivePool} active)`
          : `${disabledCount} Disabled · 0 Specialists`,
      icon: Users,
      accentClass: 'text-cyan-400',
    },
    {
      label: 'Agent Activity',
      value: `${respondedAgentsCount} / ${totalActivePool} Responded`,
      subtext:
        speakingAgentsCount > 0
          ? `${speakingAgentsCount} Speaking (Voice)${
              isRunning && currentRound ? ` · ${currentRoundRespondedCount}/${totalActivePool} in R${currentRound}` : ''
            }`
          : isRunning
          ? `0 Speaking · ${currentRoundRespondedCount}/${totalActivePool} in R${currentRound || 1}`
          : isComplete
          ? '0 Speaking · All turns logged'
          : wasStoppedEarly
          ? '0 Speaking · Halted early'
          : '0 Speaking · Standby',
      icon: Activity,
      accentClass:
        speakingAgentsCount > 0 || isRunning
          ? 'text-cyan-400'
          : isComplete
          ? 'text-emerald-400'
          : 'text-slate-400',
    },
    {
      label: 'Reply Progress',
      value: `${completedRepliesCount} / ${expectedMaxReplies}`,
      subtext:
        expectedMaxReplies > 0
          ? `${progressPct}% of ${totalActivePool}×3 round cap`
          : 'No enabled agents',
      icon: CheckCircle2,
      accentClass: 'text-sky-400',
      progress: progressPct,
    },
    {
      label: 'Deliberation Phase',
      value: phaseValue,
      subtext: phaseSubtext,
      icon: Clock,
      accentClass: 'text-violet-400',
    },
    {
      label: 'Grounded Sources',
      value: sourcesCount !== null ? `${sourcesCount}` : '—',
      subtext:
        sourcesSubtext ||
        (sourcesCount !== null
          ? 'VERITAS Web Grounding'
          : isRunning
          ? 'Scanning live sources...'
          : 'Awaiting Round 00 search'),
      icon: Search,
      accentClass: sourcesCount !== null && sourcesCount > 0 ? 'text-emerald-400' : 'text-slate-400',
    },
    {
      label: 'Avg Conviction',
      value: avgConviction !== null ? avgConviction : '—',
      subtext:
        avgConvictionSubtext ||
        (avgConviction !== null
          ? 'Mean of scored turns'
          : isRunning
          ? 'Awaiting scored turns...'
          : 'No scored turns yet'),
      icon: Zap,
      accentClass: avgConviction !== null ? 'text-amber-400' : 'text-slate-400',
    },
    {
      label: 'Core Engine',
      value: activeModel,
      subtext: 'Primary Node Model',
      icon: Cpu,
      accentClass: 'text-cyan-400',
    },
  ];

  return (
    <div
      id="parallax-telemetry-hud"
      className="grid grid-cols-1 min-[350px]:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2 sm:gap-2.5"
    >
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className={`p-2.5 sm:p-3 rounded-xl bg-[#0b101b]/90 border border-white/[0.07] hover:border-cyan-500/25 flex flex-col justify-between transition-colors min-w-0 ${
              i === cards.length - 1 ? 'min-[350px]:col-span-2 sm:col-span-1' : ''
            }`}
          >
            <div className="flex items-center justify-between gap-1.5 mb-1">
              <span className="text-[10.5px] sm:text-[11px] font-medium text-slate-400 truncate">
                {c.label}
              </span>
              <Icon size={13} className={`${c.accentClass} shrink-0`} />
            </div>

            <div className="my-0.5 min-w-0">
              <div
                className="text-xs sm:text-[14px] font-bold font-mono tabular-nums text-white truncate"
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
                    style={{ width: `${c.progress > 0 ? Math.max(4, c.progress) : 0}%` }}
                  />
                </div>
                <div className="text-[10px] sm:text-[10.5px] text-slate-400 truncate" title={c.subtext}>
                  {c.subtext}
                </div>
              </div>
            ) : (
              <div className="mt-1 text-[10px] sm:text-[10.5px] text-slate-400 truncate" title={c.subtext}>
                {c.subtext}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

