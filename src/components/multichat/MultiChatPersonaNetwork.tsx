import React from 'react';
import {
  Brain,
  Smile,
  Compass,
  CheckCircle2,
  Radio,
  Clock,
  Cpu,
  Zap,
} from 'lucide-react';
import type { MultiChatSystemConfig, MultiChatPersonaResponse } from '@/types';

interface MultiChatPersonaNetworkProps {
  config: MultiChatSystemConfig;
  isRunning: boolean;
  activePersonaId?: string | null;
  latestResponses?: MultiChatPersonaResponse[];
  onSelectPersona?: (personaId: string) => void;
}

export const MultiChatPersonaNetwork: React.FC<MultiChatPersonaNetworkProps> = ({
  config,
  isRunning,
  activePersonaId,
  latestResponses = [],
  onSelectPersona,
}) => {
  const personas = [
    {
      id: 'nova',
      defaultName: 'NOVA',
      role: 'Researcher',
      subtitle: 'Professional & Factual',
      accentColor: '#00f0ff',
      glowColor: 'rgba(0, 240, 255, 0.4)',
      icon: Brain,
      step: '01',
    },
    {
      id: 'orbit',
      defaultName: 'ORBIT',
      role: 'Chat Buddy',
      subtitle: 'Friendly & Practical',
      accentColor: '#f59e0b',
      glowColor: 'rgba(245, 158, 11, 0.4)',
      icon: Smile,
      step: '02',
    },
    {
      id: 'cosmos',
      defaultName: 'COSMOS',
      role: 'Mentor',
      subtitle: 'Calm & Reflective',
      accentColor: '#c084fc',
      glowColor: 'rgba(192, 132, 252, 0.4)',
      icon: Compass,
      step: '03',
    },
  ];

  // Resolve real-time status for each persona
  const getPersonaState = (personaId: string) => {
    const pConfig = config.personas[personaId];
    if (!pConfig || !pConfig.enabled) {
      return { status: 'disabled', label: 'DISABLED', color: '#64748b' };
    }

    const latestResp = latestResponses.find((r) => r.personaId === personaId);

    if (isRunning) {
      if (activePersonaId === personaId || latestResp?.status === 'running') {
        return { status: 'running', label: 'DELIBERATING', color: '#00f0ff' };
      }
      if (latestResp?.status === 'completed') {
        return { status: 'completed', label: 'COMPLETED', color: '#10b981' };
      }
      if (latestResp?.status === 'pending') {
        return { status: 'pending', label: 'QUEUED', color: '#38bdf8' };
      }
      // If persona 2 (orbit) and persona 1 (nova) is running
      if (personaId === 'orbit' && activePersonaId === 'nova') {
        return { status: 'pending', label: 'AWAITING NOVA', color: '#38bdf8' };
      }
      if (personaId === 'cosmos' && (activePersonaId === 'nova' || activePersonaId === 'orbit')) {
        return { status: 'pending', label: 'AWAITING PIPELINE', color: '#38bdf8' };
      }
    }

    if (latestResp?.status === 'completed') {
      return { status: 'completed', label: 'SYNTHESIZED', color: '#10b981' };
    }

    return { status: 'standby', label: 'STANDBY', color: '#94a3b8' };
  };

  return (
    <div
      id="nexus-persona-network"
      className="nexus-corner-bracket relative rounded-2xl overflow-hidden mb-5 select-none"
      style={{
        background: 'linear-gradient(135deg, rgba(4, 12, 22, 0.94) 0%, rgba(2, 6, 14, 0.98) 100%)',
        border: '1px solid rgba(0, 240, 255, 0.22)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), inset 0 0 24px rgba(0, 240, 255, 0.03)',
      }}
    >
      {/* Top Header Bar */}
      <div className="px-4 py-3 sm:px-5 bg-black/60 backdrop-blur-md border-b border-cyan-500/15 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-cyan-400" />
          <span className="text-xs font-mono font-black uppercase text-white tracking-wider">
            COGNITIVE PERSONA MESH TOPOLOGY
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
            SEQUENTIAL INFERENCE PIPELINE
          </span>
        </div>

        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
          <span>PROGRESSION: </span>
          <span className="text-cyan-300 font-bold">NOVA</span>
          <span className="text-slate-600">→</span>
          <span className="text-amber-300 font-bold">ORBIT</span>
          <span className="text-slate-600">→</span>
          <span className="text-purple-300 font-bold">COSMOS</span>
        </div>
      </div>

      {/* Interactive Network Stage */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative">
          {personas.map((p, idx) => {
            const pConfig = config.personas[p.id];
            const name = pConfig?.name || p.defaultName;
            const model = pConfig?.modelId || 'deepseek/deepseek-chat';
            const state = getPersonaState(p.id);
            const isCurrentlyActive = state.status === 'running';
            const isDone = state.status === 'completed';
            const Icon = p.icon;

            return (
              <div
                key={p.id}
                onClick={() => onSelectPersona?.(p.id)}
                className={`relative rounded-xl p-4 transition-all duration-300 font-mono flex flex-col justify-between ${
                  isCurrentlyActive
                    ? 'bg-slate-950/90 shadow-[0_0_24px_rgba(0,240,255,0.25)]'
                    : isDone
                    ? 'bg-slate-950/60'
                    : 'bg-white/[0.02]'
                }`}
                style={{
                  border: isCurrentlyActive
                    ? `1.5px solid ${p.accentColor}`
                    : `1px solid ${p.accentColor}35`,
                  borderLeft: `3.5px solid ${p.accentColor}`,
                }}
              >
                {/* Connecting Arrow for Desktop (between cards 1->2 and 2->3) */}
                {idx < 2 && (
                  <div className="hidden md:flex absolute -right-3.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-black/90 border border-cyan-500/30 items-center justify-center text-cyan-400 shadow-md">
                    <span className="text-[10px] font-black">→</span>
                  </div>
                )}

                <div>
                  {/* Top Node Header */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Avatar with Glow and State Indicator */}
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                          isCurrentlyActive ? 'animate-pulse' : ''
                        }`}
                        style={{
                          background: `${p.accentColor}20`,
                          border: `1.5px solid ${p.accentColor}`,
                          color: p.accentColor,
                          boxShadow: isCurrentlyActive ? `0 0 16px ${p.glowColor}` : 'none',
                        }}
                      >
                        <Icon size={18} />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-black text-white truncate">
                            {name}
                          </span>
                          <span
                            className="text-[9px] px-1.5 py-0.2 rounded font-bold uppercase shrink-0"
                            style={{
                              background: `${p.accentColor}20`,
                              color: p.accentColor,
                              border: `1px solid ${p.accentColor}40`,
                            }}
                          >
                            {p.step}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {p.role}
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0 text-right">
                      {isCurrentlyActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-300 animate-pulse bg-cyan-500/20 px-2 py-0.5 rounded-full border border-cyan-400">
                          <Radio size={10} className="animate-ping" />
                          ACTIVE
                        </span>
                      ) : isDone ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          <CheckCircle2 size={10} />
                          READY
                        </span>
                      ) : state.status === 'pending' ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-sky-300 bg-sky-500/10 px-2 py-0.5 rounded-full border border-sky-500/20">
                          <Clock size={10} />
                          QUEUED
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-bold bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
                          STANDBY
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Subtitle / Focus Style */}
                  <p className="m-0 text-[11px] text-slate-300 font-sans line-clamp-1 mb-2">
                    {p.subtitle}
                  </p>
                </div>

                {/* Model & Provider Footnote */}
                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-slate-400">
                  <div className="flex items-center gap-1 min-w-0">
                    <Cpu size={11} className="text-slate-500 shrink-0" />
                    <span className="truncate max-w-[150px]">{model}</span>
                  </div>
                  <span
                    className="font-bold uppercase tracking-wider text-[9px]"
                    style={{ color: p.accentColor }}
                  >
                    {pConfig?.enabled ? 'ENABLED' : 'MUTED'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
