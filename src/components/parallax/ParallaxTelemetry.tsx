import React from 'react';
import {
  Users,
  Activity,
  CheckCircle2,
  Clock,
  Search,
  Zap,
  Globe2,
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
  const cards = [
    {
      label: 'TOTAL AGENTS',
      value: totalAgentsCount,
      subtext: 'Swarm Personas',
      icon: Users,
      accent: 'var(--nexus-cyan)',
    },
    {
      label: 'ACTIVE STATUS',
      value: isRunning ? `${activeCount || 1} LIVE` : isComplete ? 'CONSENSUS' : 'STANDBY',
      subtext: isRunning ? 'Deliberating' : 'Ready',
      icon: Activity,
      accent: isRunning ? 'var(--nexus-cyan)' : isComplete ? 'var(--nexus-green)' : 'var(--nexus-muted)',
    },
    {
      label: 'REPLIES LOGGED',
      value: `${completedRepliesCount} / 60`,
      subtext: '3-Round Target',
      icon: CheckCircle2,
      accent: 'var(--nexus-blue)',
    },
    {
      label: 'CHRONOLOGY',
      value: currentRound ? `ROUND 0${currentRound}` : isComplete ? 'ROUND 03' : 'ROUND 01',
      subtext: isComplete ? 'Synthesized' : 'In Progress',
      icon: Clock,
      accent: 'var(--nexus-purple)',
    },
    {
      label: 'GROUNDED SOURCES',
      value: sourcesCount,
      subtext: 'VERITAS Tool Live',
      icon: Search,
      accent: 'var(--nexus-warning)',
    },
    {
      label: 'AVG CONVICTION',
      value: `${avgConviction} / 10`,
      subtext: 'Swarm Confidence',
      icon: Zap,
      accent: 'var(--nexus-magenta)',
    },
    {
      label: 'CORE ENGINE',
      value: activeModel,
      subtext: 'Orchestration Mesh',
      icon: Globe2,
      accent: 'var(--nexus-cyan)',
    },
  ];

  return (
    <div
      id="parallax-telemetry-hud"
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3 mb-6"
    >
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <div
            key={i}
            className="p-3 rounded-xl relative overflow-hidden font-mono flex flex-col justify-between"
            style={{
              background: 'linear-gradient(135deg, rgba(6, 16, 26, 0.88) 0%, rgba(3, 10, 18, 0.94) 100%)',
              border: '1px solid rgba(0, 240, 255, 0.18)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 0 12px rgba(0, 240, 255, 0.02)',
            }}
          >
            <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 font-bold tracking-wider uppercase mb-1">
              <span className="truncate">{c.label}</span>
              <Icon size={12} style={{ color: c.accent }} className="shrink-0" />
            </div>

            <div className="my-1">
              <div
                className="text-base sm:text-lg font-black tracking-tight truncate"
                style={{ color: '#ffffff' }}
              >
                {c.value}
              </div>
            </div>

            <div className="text-[10px] text-slate-400 font-sans truncate">
              {c.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
};
