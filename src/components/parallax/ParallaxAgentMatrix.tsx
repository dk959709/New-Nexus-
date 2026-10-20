import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  Volume2,
  Radio,
  Sparkles,
  Clock,
  Cpu,
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

  return (
    <div
      id="parallax-agent-matrix"
      className="relative py-5 border-b border-white/[0.06]"
    >
      {/* Matrix Header & Filters */}
      <div className="pb-4 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <Users size={16} className="text-cyan-400" />
          <h2 className="m-0 text-xs font-mono font-black uppercase text-slate-100 tracking-wider">
            AGENT MATRIX & CONFIGURATION
          </h2>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900/40 backdrop-blur-xl text-cyan-300 font-bold">
            {filteredAgents.length} / {combinedAgents.length} ACTIVE
          </span>
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agent or role..."
              className="pl-8 pr-3.5 py-1.5 text-xs font-mono bg-slate-900/40 backdrop-blur-xl rounded-full text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 w-40 sm:w-52 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Cluster Pill Filters */}
      <div className="py-3 border-b border-white/[0.06] flex items-center gap-2 flex-wrap text-xs font-mono">
        <span className="text-slate-300 text-[11px] mr-1 flex items-center gap-1">
          <Filter size={11} /> CLUSTER:
        </span>
        {[
          { id: 'all', label: `All (${combinedAgents.length})` },
          { id: 'anchors', label: 'Core Anchors (4)' },
          { id: 'optimists', label: 'Optimists (4)' },
          { id: 'realists', label: 'Realists (4)' },
          { id: 'ethicists', label: 'Ethicists (4)' },
          { id: 'visionaries', label: 'Visionaries (4)' },
          { id: 'specialists', label: `Specialists (${dynamicPersonas.length || '3–5'})` },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setClusterFilter(f.id as typeof clusterFilter)}
            className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
              clusterFilter === f.id
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'bg-slate-900/40 backdrop-blur-xl text-slate-300 hover:text-slate-100 hover:bg-slate-800/60'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Agent Matrix Grid */}
      <div className="pt-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map((agent) => {
            const isSpeaking = activeSpeakingAgentId === agent.id;
            const isSelected = selectedAgentId === agent.id;
            const replies = agentRepliesMap.get(agent.id) || [];
            const hasCompleted = replies.length > 0;
            const lastReply = replies[replies.length - 1];
            const accentColor = agent.accentColor || '#00f0ff';

            return (
              <div
                key={agent.id}
                onClick={() => onSelectAgent?.(isSelected ? null : agent.id)}
                className={`p-4 rounded-xl cursor-pointer transition-colors duration-200 font-mono relative flex flex-col justify-between hover:bg-slate-900/40 ${
                  isSelected
                    ? 'bg-cyan-950/30 ring-1 ring-cyan-400/50'
                    : isSpeaking
                    ? 'bg-cyan-950/25 animate-pulse'
                    : 'bg-slate-900/25 backdrop-blur-xl'
                }`}
                style={{
                  borderLeft: `2px solid ${accentColor}`,
                }}
              >
                {/* Top Row: Icon + Name + Role + Status */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                        style={{
                          background: `${accentColor}25`,
                          color: accentColor,
                        }}
                      >
                        {agent.initials || agent.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate text-slate-100">
                          {agent.name}
                        </div>
                        <div className="text-[10px] text-slate-300 truncate">
                          {agent.role}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-right">
                      {isSpeaking ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-cyan-300">
                          <Radio size={10} className="animate-ping" />
                          ACTIVE
                        </span>
                      ) : hasCompleted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-300">
                          <CheckCircle2 size={10} />
                          {replies.length} R
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] text-slate-300">
                          <Clock size={10} />
                          STANDBY
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Model & Capability Badges */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-900/40 text-slate-300 truncate max-w-[140px] flex items-center gap-1">
                      <Cpu size={9} className="text-slate-300" />
                      <span>{agent.modelId || 'Llama 3.3 70B'}</span>
                    </span>
                    {agent.hasToolAccess && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center gap-0.5">
                        <Search size={9} />
                        VERITAS
                      </span>
                    )}
                    {agent.isDynamic && (
                      <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold flex items-center gap-0.5">
                        <Sparkles size={9} />
                        SPEC
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Current Activity / Latest Argument snippet */}
                <div className="mt-3 pt-2.5 border-t border-white/[0.06] text-[11px]">
                  <div className="text-[9px] text-slate-300 font-bold uppercase tracking-wider mb-0.5">
                    CURRENT ACTIVITY:
                  </div>
                  {lastReply ? (
                    <div className="text-slate-100 font-sans line-clamp-2 leading-relaxed text-[11px]">
                      &ldquo;{lastReply.text}&rdquo;
                    </div>
                  ) : (
                    <div className="text-slate-300 italic font-mono text-[10px]">
                      Awaiting deliberation round mobilization
                    </div>
                  )}

                  {/* Audio voice preview if replied */}
                  {lastReply && onPlayVoice && (
                    <div className="mt-2 flex items-center justify-between text-[10px] font-mono pt-1.5 border-t border-white/[0.06]">
                      <span className="text-slate-300">
                        {lastReply.mood ? `Mood: ${lastReply.mood}` : 'Voice ready'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayVoice(lastReply);
                        }}
                        className="text-cyan-300 hover:text-cyan-200 flex items-center gap-1 cursor-pointer font-bold"
                      >
                        <Volume2 size={11} />
                        <span>Listen</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
