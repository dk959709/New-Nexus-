import React from 'react';
import { Radio, Search, CheckCircle2, Clock, Volume2 } from 'lucide-react';
import type { ParallaxMessage, ParallaxAgentConfig } from '@/types';

export interface ParallaxLiveActivityProps {
  messages: ParallaxMessage[];
  activeSpeakingAgentId?: string | null;
  isRunning: boolean;
  currentRound: 1 | 2 | 3 | null;
  agents: Record<string, ParallaxAgentConfig>;
  onPlayVoice?: (msg: ParallaxMessage) => void;
  playingAudioKey?: string | null;
}

export const ParallaxLiveActivity: React.FC<ParallaxLiveActivityProps> = ({
  messages,
  activeSpeakingAgentId,
  isRunning,
  currentRound,
  agents,
  onPlayVoice,
  playingAudioKey,
}) => {
  // Find current active speaking message or agent config
  const activeSpeakingMessage = activeSpeakingAgentId
    ? [...messages].reverse().find((m) => m.agentId === activeSpeakingAgentId)
    : messages.length > 0 && isRunning
    ? messages[messages.length - 1]
    : null;

  const activeAgentConfig = activeSpeakingAgentId
    ? agents[activeSpeakingAgentId]
    : activeSpeakingMessage
    ? agents[activeSpeakingMessage.agentId]
    : null;

  // Recent 6 activities
  const recentActivities = [...messages].slice(-6).reverse();

  return (
    <div
      id="parallax-live-swarm-activity"
      className="relative py-4"
    >
      {/* Header bar */}
      <div className="pb-3.5 mb-2 border-b border-white/[0.06] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
          <h2 className="m-0 text-xs font-mono font-black uppercase text-slate-100 tracking-wider">
            LIVE SWARM ACTIVITY
          </h2>
          <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-slate-900/40 backdrop-blur-xl text-cyan-300 font-bold">
            {messages.length} EVENTS
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-300">
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-slate-300" />
            <span>REAL-TIME TELEMETRY</span>
          </div>
        </div>
      </div>

      {/* Activity Table Container */}
      <div className="pt-2 overflow-x-auto">
        {messages.length === 0 && !isRunning ? (
          <div className="py-10 text-center text-slate-300 font-mono text-xs">
            <Radio size={24} className="mx-auto mb-2 text-cyan-400/50" />
            <p className="m-0 text-slate-100 font-bold">SWARM IDLE • READY FOR DEPLOYMENT</p>
            <p className="m-0 text-slate-300 text-[11px] mt-1">
              Select or type a topic above to initiate real-time multi-agent activity tracking.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06] min-w-[540px]">
            {/* Header Columns */}
            <div className="grid grid-cols-12 gap-2.5 px-3 py-2 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300">
              <div className="col-span-3">AGENT / ROLE</div>
              <div className="col-span-2">STATUS</div>
              <div className="col-span-2">ROUND / MODEL</div>
              <div className="col-span-4">CURRENT ACTIVITY</div>
              <div className="col-span-1 text-right">TIME</div>
            </div>

            {/* Currently Active Row (if running) */}
            {isRunning && activeAgentConfig && (
              <div
                className="grid grid-cols-12 gap-2.5 items-center px-3 py-3 rounded-xl bg-cyan-500/10 border-l-2 border-cyan-400 animate-pulse"
              >
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0"
                    style={{
                      background: `${activeAgentConfig.accentColor || '#00f0ff'}25`,
                      color: activeAgentConfig.accentColor || '#00f0ff',
                    }}
                  >
                    {activeAgentConfig.initials || activeAgentConfig.name.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-bold text-slate-100 truncate">
                      {activeAgentConfig.name}
                    </div>
                    <div className="text-[10px] text-cyan-300 truncate">
                      {activeAgentConfig.role}
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-400/20 text-cyan-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    ACTIVE
                  </span>
                </div>

                <div className="col-span-2 text-[10px] font-mono font-bold text-slate-100">
                  <div>ROUND {currentRound ? `0${currentRound}` : '01'}</div>
                  <div className="text-[9px] text-slate-300 font-normal truncate">
                    {activeAgentConfig.modelId || 'LLAMA 3.3 70B'}
                  </div>
                </div>

                <div className="col-span-4 text-xs text-cyan-100 font-sans truncate flex items-center gap-1.5">
                  {activeAgentConfig.hasToolAccess ? (
                    <span className="flex items-center gap-1 text-cyan-300 font-mono text-[11px]">
                      <Search size={12} className="animate-spin" />
                      <span>Grounded web intelligence gathering...</span>
                    </span>
                  ) : (
                    <span>Deliberating swarm consensus argument...</span>
                  )}
                </div>

                <div className="col-span-1 text-right text-[10px] font-mono text-cyan-300 font-bold">
                  NOW
                </div>
              </div>
            )}

            {/* List of Recent Real Activities */}
            {recentActivities.map((msg) => {
              const isVoicePlaying = playingAudioKey === msg.id;

              return (
                <div
                  key={msg.id}
                  className="grid grid-cols-12 gap-2.5 items-center px-3 py-2.5 rounded-xl hover:bg-slate-900/40 transition-colors font-mono"
                >
                  {/* Agent & Role */}
                  <div className="col-span-3 flex items-center gap-2 min-w-0">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        background: `${msg.accentColor}25`,
                        color: msg.accentColor,
                      }}
                    >
                      {msg.agentName.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-100 truncate">
                        {msg.agentName}
                      </div>
                      <div className="text-[10px] text-slate-300 truncate">
                        {msg.role}
                      </div>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="col-span-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300">
                      <CheckCircle2 size={10} />
                      COMPLETED
                    </span>
                  </div>

                  {/* Round & Model */}
                  <div className="col-span-2 text-[10px] text-slate-100 font-bold">
                    <div>ROUND 0{msg.round}</div>
                    <div className="text-[9px] text-slate-300 font-normal truncate">
                      {msg.model || 'Llama 3.3 70B'}
                    </div>
                  </div>

                  {/* Activity Summary */}
                  <div className="col-span-4 text-[11px] text-slate-200 font-sans truncate flex items-center gap-2">
                    {msg.toolUsed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 shrink-0">
                        <Search size={9} />
                        VERITAS
                      </span>
                    ) : null}
                    <span className="truncate">&ldquo;{msg.text.slice(0, 90)}&rdquo;</span>
                  </div>

                  {/* Timestamp & Play Voice */}
                  <div className="col-span-1 text-right flex items-center justify-end gap-1.5">
                    <span className="text-[10px] text-slate-300 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    {onPlayVoice && (
                      <button
                        type="button"
                        onClick={() => onPlayVoice(msg)}
                        className={`p-1 rounded-full cursor-pointer transition-colors ${
                          isVoicePlaying
                            ? 'text-cyan-300 bg-cyan-500/20'
                            : 'text-slate-300 hover:text-cyan-300 hover:bg-slate-800/60'
                        }`}
                        title="Listen to agent audio"
                      >
                        <Volume2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
