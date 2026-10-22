import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  Volume2,
  Radio,
  Sparkles,
  Clock,
  Cpu,
  X,
} from 'lucide-react';
import { AGENT_QUADRANTS } from '@/data/parallaxQuadrants';
import type { ParallaxAgentConfig, ParallaxMessage } from '@/types';

export interface ParallaxAgentMatrixProps {
  agents: Record<string, ParallaxAgentConfig>;
  messages: ParallaxMessage[];
  selectedAgentId?: string | null;
  activeSpeakingAgentId?: string | null;
  onSelectAgent?: (agentId: string | null) => void;
  dynamicPersonas?: ParallaxAgentConfig[];
  onPlayVoice?: (msg: ParallaxMessage) => void;
}

export const ParallaxAgentMatrix: React.FC<ParallaxAgentMatrixProps> = ({
  agents,
  messages,
  selectedAgentId,
  activeSpeakingAgentId,
  onSelectAgent,
  dynamicPersonas = [],
  onPlayVoice,
}) => {
  const [clusterFilter, setClusterFilter] = useState<
    'all' | 'optimists' | 'realists' | 'ethicists' | 'visionaries' | 'anchors' | 'specialists'
  >('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Map messages per agent
  const agentRepliesMap = useMemo(() => {
    const map = new Map<string, ParallaxMessage[]>();
    messages.forEach((m) => {
      const arr = map.get(m.agentId) || [];
      arr.push(m);
      map.set(m.agentId, arr);
    });
    return map;
  }, [messages]);

  // Combined agent list
  const combinedAgents = useMemo(() => {
    const list: Array<ParallaxAgentConfig & { quadrantKey?: string }> = [];

    // Core 20 agents
    Object.keys(agents).forEach((key) => {
      const a = agents[key];
      const q = AGENT_QUADRANTS[key];
      if (a) {
        list.push({
          ...a,
          quadrantKey: q?.quadrant || 'anchors',
        });
      }
    });

    // Dynamic specialists
    dynamicPersonas.forEach((spec) => {
      if (!list.some((a) => a.id === spec.id)) {
        list.push({
          ...spec,
          quadrantKey: 'specialists',
        });
      }
    });

    return list;
  }, [agents, dynamicPersonas]);

  // Filtered agent list
  const filteredAgents = useMemo(() => {
    return combinedAgents.filter((agent) => {
      if (clusterFilter !== 'all') {
        if (clusterFilter === 'specialists') {
          if (!agent.isDynamic && agent.quadrantKey !== 'specialists') return false;
        } else {
          if (agent.quadrantKey !== clusterFilter) return false;
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          agent.name.toLowerCase().includes(q) ||
          agent.role.toLowerCase().includes(q) ||
          (agent.systemInstruction && agent.systemInstruction.toLowerCase().includes(q))
        );
      }

      return true;
    });
  }, [combinedAgents, clusterFilter, searchQuery]);

  const completedAgentsCount = useMemo(() => {
    return combinedAgents.filter((a) => (agentRepliesMap.get(a.id)?.length || 0) > 0).length;
  }, [combinedAgents, agentRepliesMap]);

  return (
    <div id="parallax-agent-matrix" className="relative space-y-3.5">
      {/* Matrix Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/[0.07]">
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Users size={14} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-white">
              <span>20-Persona Swarm Matrix</span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span className="font-mono text-[11px] text-cyan-300 tabular-nums">
                {filteredAgents.length} / {combinedAgents.length} Nodes
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-2">
              <span>{completedAgentsCount} responded</span>
              <span aria-hidden="true">·</span>
              <span>{combinedAgents.length - completedAgentsCount} standby</span>
              {selectedAgentId && (
                <>
                  <span aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => onSelectAgent?.(null)}
                    className="text-cyan-400 hover:underline font-medium cursor-pointer"
                  >
                    Clear selection
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Search input with clear button */}
        <div className="relative w-full sm:w-60 shrink-0">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search persona, role, or skill..."
            className="w-full min-h-[38px] pl-8 pr-8 py-1.5 text-xs bg-[#0b101b] border border-white/[0.09] rounded-xl text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400/60 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear agent search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Horizontal Scrollable Cluster Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {[
          { id: 'all', label: `All (${combinedAgents.length})` },
          { id: 'anchors', label: 'Core Anchors (4)' },
          { id: 'optimists', label: 'Optimists (4)' },
          { id: 'realists', label: 'Realists (4)' },
          { id: 'ethicists', label: 'Ethicists (4)' },
          { id: 'visionaries', label: 'Visionaries (4)' },
          ...(dynamicPersonas.length > 0
            ? [{ id: 'specialists', label: `Specialists (${dynamicPersonas.length})` }]
            : []),
        ].map((f) => {
          const active = clusterFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setClusterFilter(f.id as typeof clusterFilter)}
              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all cursor-pointer border ${
                active
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 font-semibold'
                  : 'bg-[#0b101b]/80 border-white/[0.06] text-slate-300 hover:text-white hover:border-white/15'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* Agent Matrix Grid */}
      {filteredAgents.length === 0 ? (
        <div className="py-8 text-center text-xs text-slate-400 bg-[#0b101b]/50 rounded-xl border border-white/[0.06]">
          No swarm personas match &ldquo;{searchQuery}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {filteredAgents.map((agent) => {
            const isSpeaking = activeSpeakingAgentId === agent.id;
            const isSelected = selectedAgentId === agent.id;
            const replies = agentRepliesMap.get(agent.id) || [];
            const hasCompleted = replies.length > 0;
            const lastReply = replies[replies.length - 1];
            const accentColor = agent.accentColor || '#22d3ee';
            const latestConviction =
              typeof lastReply?.convictionScore === 'number'
                ? `${lastReply.convictionScore}%`
                : null;

            return (
              <div
                key={agent.id}
                onClick={() => onSelectAgent?.(isSelected ? null : agent.id)}
                className={`p-3.5 rounded-xl cursor-pointer transition-all duration-150 flex flex-col justify-between border ${
                  isSelected
                    ? 'bg-cyan-950/35 border-cyan-400/60 shadow-[0_0_20px_rgba(34,211,238,0.12)]'
                    : isSpeaking
                    ? 'bg-cyan-950/25 border-cyan-400/50'
                    : hasCompleted
                    ? 'bg-[#0b101b]/90 border-white/[0.09] hover:border-white/20'
                    : 'bg-[#090d16]/75 border-white/[0.05] hover:border-white/15'
                }`}
              >
                {/* Top Row: Avatar + Name & Role + Explicit State Indicator */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 border"
                        style={{
                          backgroundColor: `${accentColor}18`,
                          borderColor: `${accentColor}45`,
                          color: accentColor,
                        }}
                      >
                        {agent.initials || agent.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs sm:text-[13px] font-semibold truncate text-white">
                          {agent.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {agent.role}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right font-mono">
                      {isSpeaking ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-cyan-300">
                          <Radio size={11} className="animate-pulse" />
                          <span>Speaking</span>
                        </span>
                      ) : hasCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-300 tabular-nums">
                          <CheckCircle2 size={11} />
                          <span>{latestConviction || `${replies.length}R`}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10.5px] text-slate-400">
                          <Clock size={10} />
                          <span>Standby</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Metadata line: Model ID · Capability */}
                  <div className="flex items-center gap-1.5 mt-2 text-[10.5px] font-mono text-slate-400 truncate">
                    <Cpu size={10} className="text-slate-400 shrink-0" />
                    <span className="truncate" title={agent.modelId || 'Built-in Default'}>
                      {agent.modelId || 'Built-in Default'}
                    </span>
                    {agent.hasToolAccess && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-cyan-300 font-semibold shrink-0 flex items-center gap-0.5">
                          <Search size={9} />
                          Web Grounded
                        </span>
                      </>
                    )}
                    {agent.isDynamic && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-violet-300 font-semibold shrink-0 flex items-center gap-0.5">
                          <Sparkles size={9} />
                          Specialist
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Latest Deliberation Snippet or System Role + Voice Action */}
                <div className="mt-2.5 pt-2 border-t border-white/[0.06] text-[11.5px]">
                  {lastReply ? (
                    <p className="m-0 text-slate-200 line-clamp-2 leading-relaxed">
                      &ldquo;{lastReply.text.replace(/[#*_`]/g, '')}&rdquo;
                    </p>
                  ) : (
                    <p className="m-0 text-slate-400 line-clamp-2 leading-relaxed text-[11px]">
                      {agent.systemInstruction}
                    </p>
                  )}

                  {onPlayVoice && (
                    <div className="mt-2 pt-1.5 border-t border-white/[0.05] flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400 truncate">
                        {lastReply ? `Round 0${lastReply.round} Turn` : 'Voice Profile Ready'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (lastReply) {
                            onPlayVoice(lastReply);
                          } else {
                            onPlayVoice({
                              id: `matrix-preview-${agent.id}`,
                              agentId: agent.id,
                              agentName: agent.name,
                              initials: agent.initials || agent.name.slice(0, 2),
                              accentColor: agent.accentColor,
                              round: 1,
                              text: `I am ${agent.name}, specializing in ${agent.role}. ${agent.systemInstruction}`,
                              timestamp: Date.now(),
                              voice: agent.voice,
                            });
                          }
                        }}
                        className="min-h-[30px] px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-cyan-500/20 text-cyan-300 hover:text-cyan-200 flex items-center gap-1.5 cursor-pointer font-semibold transition-colors"
                      >
                        <Volume2 size={11} />
                        <span>{lastReply ? 'Play Turn' : 'Sample Voice'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
