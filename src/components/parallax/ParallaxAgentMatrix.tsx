import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  Volume2,
  Radio,
  Sparkles,
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
  const [clusterFilter, setClusterFilter] = useState<'all' | 'optimists' | 'realists' | 'ethicists' | 'visionaries' | 'anchors' | 'specialists'>('all');
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
      className="nexus-corner-bracket relative rounded-2xl overflow-hidden mb-6"
      style={{
        background: 'linear-gradient(135deg, rgba(6, 16, 26, 0.94) 0%, rgba(3, 10, 18, 0.98) 100%)',
        border: '1px solid rgba(0, 240, 255, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 24px rgba(0, 240, 255, 0.04)',
      }}
    >
      {/* Matrix Header & Filters */}
      <div className="px-5 py-3.5 bg-black/60 backdrop-blur-md border-b border-cyan-500/15 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <Users size={16} className="text-cyan-400" />
          <h2 className="m-0 text-xs font-mono font-black uppercase text-white tracking-wider">
            AGENT MATRIX
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
            {filteredAgents.length} / {combinedAgents.length} ACTIVE
          </span>
        </div>

        {/* Search input */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agent or role..."
              className="pl-7 pr-3 py-1 text-xs font-mono bg-black/60 border border-white/10 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400/50 w-36 sm:w-48 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Cluster Pill Filters */}
      <div className="px-5 py-2.5 bg-black/30 border-b border-white/5 flex items-center gap-1.5 flex-wrap text-xs font-mono">
        <span className="text-slate-400 text-[11px] mr-1 flex items-center gap-1">
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
            className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
              clusterFilter === f.id
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50 shadow-[0_0_8px_rgba(0,240,255,0.2)]'
                : 'bg-white/[0.03] text-slate-400 border border-white/5 hover:text-white hover:bg-white/10'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Agent Cards Grid */}
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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
                className={`p-3 rounded-xl cursor-pointer transition-all duration-200 font-mono relative flex flex-col justify-between ${
                  isSelected
                    ? 'border-2 border-cyan-400 bg-cyan-950/30 shadow-[0_0_20px_rgba(0,240,255,0.3)]'
                    : isSpeaking
                    ? 'border border-cyan-400 bg-cyan-950/20 animate-pulse shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                    : hasCompleted
                    ? 'border border-emerald-500/30 bg-white/[0.02] hover:border-cyan-400/40 hover:bg-white/[0.04]'
                    : 'border border-white/10 bg-white/[0.01] hover:border-white/20'
                }`}
                style={{
                  borderLeft: `3px solid ${accentColor}`,
                }}
              >
                {/* Top Row: Icon + Name + Status */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0"
                        style={{
                          background: `${accentColor}25`,
                          border: `1.5px solid ${accentColor}`,
                          color: accentColor,
                        }}
                      >
                        {agent.initials || agent.name.slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-black truncate text-white">
                          {agent.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
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
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <CheckCircle2 size={10} />
                          {replies.length} R
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">STANDBY</span>
                      )}
                    </div>
                  </div>

                  {/* Model Engine Tag */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 border border-white/10 truncate max-w-[140px]">
                      {agent.modelId || 'LLAMA 3.3 70B'}
                    </span>
                    {agent.hasToolAccess && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold flex items-center gap-0.5">
                        <Search size={9} />
                        VERITAS
                      </span>
                    )}
                    {agent.isDynamic && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold flex items-center gap-0.5">
                        <Sparkles size={9} />
                        SPEC
                      </span>
                    )}
                  </div>
                </div>

                {/* Bottom Row: Current Task / Latest Argument snippet */}
                <div className="mt-2.5 pt-2 border-t border-white/5 text-[11px]">
                  {lastReply ? (
                    <div className="text-slate-300 font-sans line-clamp-2 leading-relaxed">
                      &ldquo;{lastReply.text}&rdquo;
                    </div>
                  ) : (
                    <div className="text-slate-500 italic font-mono text-[10px]">
                      Awaiting deliberation round mobilization
                    </div>
                  )}

                  {/* Audio voice preview if replied */}
                  {lastReply && onPlayVoice && (
                    <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono">
                      <span className="text-slate-400">
                        {lastReply.mood ? `Mood: ${lastReply.mood}` : 'Voice ready'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onPlayVoice(lastReply);
                        }}
                        className="text-cyan-400 hover:text-cyan-200 flex items-center gap-1 cursor-pointer"
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
