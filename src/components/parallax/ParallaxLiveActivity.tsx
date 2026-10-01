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
      className="nexus-corner-bracket relative rounded-2xl overflow-hidden mb-5"
      style={{
        background: 'linear-gradient(135deg, rgba(6, 16, 26, 0.94) 0%, rgba(3, 10, 18, 0.98) 100%)',
        border: '1px solid rgba(0, 240, 255, 0.25)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 24px rgba(0, 240, 255, 0.04)',
      }}
    >
      {/* Header bar */}
      <div className="px-5 py-3.5 bg-black/60 backdrop-blur-md border-b border-cyan-500/15 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
          <h2 className="m-0 text-xs font-mono font-black uppercase text-white tracking-wider">
            LIVE SWARM ACTIVITY
          </h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 font-bold">
            {messages.length} EVENTS
          </span>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
          <div className="flex items-center gap-1.5">
            <Clock size={12} className="text-slate-400" />
            <span>REAL-TIME TELEMETRY</span>
          </div>
        </div>
      </div>

      {/* Activity Table Container */}
      <div className="p-4 overflow-x-auto">
        {messages.length === 0 && !isRunning ? (
          <div className="py-8 text-center text-slate-400 font-mono text-xs">
            <Radio size={24} className="mx-auto mb-2 text-cyan-400/40" />
            <p className="m-0 text-slate-300 font-bold">SWARM IDLE • READY FOR DEPLOYMENT</p>
            <p className="m-0 text-slate-500 text-[11px] mt-1">
              Select or type a topic above to initiate real-time multi-agent activity tracking.
            </p>
          </div>
        ) : (
          <div className="space-y-2 min-w-[580px]">
            {/* Header Columns */}
            <div className="grid grid-cols-12 gap-2.5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-white/10">
              <div className="col-span-3">AGENT / ROLE</div>
              <div className="col-span-2">STATUS</div>
              <div className="col-span-2">ROUND / MODEL</div>
              <div className="col-span-4">CURRENT ACTIVITY</div>
              <div className="col-span-1 text-right">TIME</div>
            </div>

            {/* Currently Active Row (if running) */}
            {isRunning && activeAgentConfig && (
              <div
                className="grid grid-cols-12 gap-2.5 items-center px-3 py-2.5 rounded-xl border border-cyan-400/60 bg-cyan-500/10 animate-pulse"
                style={{
                  boxShadow: '0 0 16px rgba(0, 240, 255, 0.15)',
                }}
              >
                <div className="col-span-3 flex items-center gap-2 min-w-0">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0"
                    style={{
                      background: `${activeAgentConfig.accentColor || '#00f0ff'}25`,
                      border: `1px solid ${activeAgentConfig.accentColor || '#00f0ff'}`,
                      color: activeAgentConfig.accentColor || '#00f0ff',
                    }}
                  >
                    {activeAgentConfig.initials || activeAgentConfig.name.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-bold text-white truncate">
                      {activeAgentConfig.name}
                    </div>
                    <div className="text-[10px] text-cyan-300 truncate">
                      {activeAgentConfig.role}
                    </div>
                  </div>
                </div>

                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-400/20 text-cyan-200 border border-cyan-400/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    ACTIVE
                  </span>
                </div>

                <div className="col-span-2 text-[10px] font-mono font-bold text-slate-200">
                  <div>ROUND {currentRound ? `0${currentRound}` : '01'}</div>
                  <div className="text-[9px] text-slate-400 font-normal truncate">
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

                <div className="col-span-1 text-right text-[10px] font-mono text-cyan-400 font-bold">
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
                  className="grid grid-cols-12 gap-2.5 items-center px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 hover:border-cyan-500/30 transition-all font-mono"
                >
                  {/* Agent & Role */}
                  <div className="col-span-3 flex items-center gap-2 min-w-0">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        background: `${msg.accentColor}25`,
                        border: `1px solid ${msg.accentColor}`,
                        color: msg.accentColor,
                      }}
                    >
                      {msg.agentName.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-200 truncate">
                        {msg.agentName}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {msg.role}
                      </div>
                    </div>
                  </div>

                  {/* Status badge */}
                  <div className="col-span-2">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      <CheckCircle2 size={10} />
                      COMPLETED
                    </span>
                  </div>

                  {/* Round & Model */}
                  <div className="col-span-2 text-[10px] text-slate-300 font-bold">
                    <div>ROUND 0{msg.round}</div>
                    <div className="text-[9px] text-slate-400 font-normal truncate">
                      {msg.model || 'Llama 3.3 70B'}
                    </div>
                  </div>

                  {/* Activity Summary */}
                  <div className="col-span-4 text-[11px] text-slate-300 font-sans truncate flex items-center gap-2">
                    {msg.toolUsed ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shrink-0">
                        <Search size={9} />
                        VERITAS
                      </span>
                    ) : null}
                    <span className="truncate">&ldquo;{msg.text.slice(0, 90)}&rdquo;</span>
                  </div>

                  {/* Timestamp & Play Voice */}
                  <div className="col-span-1 text-right flex items-center justify-end gap-1.5">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                    {onPlayVoice && (
                      <button
                        type="button"
                        onClick={() => onPlayVoice(msg)}
                        className={`p-1 rounded cursor-pointer transition-colors ${
                          isVoicePlaying
                            ? 'text-cyan-300 bg-cyan-500/20'
                            : 'text-slate-500 hover:text-cyan-300 hover:bg-white/5'
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
