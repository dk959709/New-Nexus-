import React from 'react';
import { Radio, Search, CheckCircle2, AlertCircle, Clock, Volume2 } from 'lucide-react';
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
      className="nexus-corner-bracket relative rounded-2xl overflow-hidden mb-6"
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
            {messages.length} EVENTS RECORDED
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
          <div className="space-y-2 min-w-[620px]">
            {/* Header Columns */}
            <div className="grid grid-cols-12 gap-3 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 border-b border-white/10">
              <div className="col-span-3">AGENT / ROLE</div>
              <div className="col-span-2">STATUS</div>
              <div className="col-span-2">ROUND</div>
              <div className="col-span-4">ACTIVITY</div>
              <div className="col-span-1 text-right">TIME</div>
            </div>

            {/* Currently Active Row (if running) */}
            {isRunning && activeAgentConfig && (
              <div
                className="grid grid-cols-12 gap-3 items-center px-3 py-2.5 rounded-xl border border-cyan-400/60 bg-cyan-500/10 animate-pulse"
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

                <div className="col-span-2 text-xs font-mono font-bold text-slate-200">
                  ROUND {currentRound ? `0${currentRound}` : '01'}
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
                  className="grid grid-cols-12 gap-3 items-center px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 hover:border-cyan-500/30 transition-all font-mono"
                >
                  {/* Agent & Role */}
                  <div className="col-span-3 flex items-center gap-2 min-w-0">
                    <div
                      className="w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        background: `${msg.accentColor}20`,
                        border: `1px solid ${msg.accentColor}60`,
                        color: msg.accentColor,
                      }}
                    >
                      {msg.initials}
                    </div>
                    <div className="min-w-0">
                      <div
                        className="text-xs font-bold truncate"
                        style={{ color: msg.accentColor }}
                      >
                        {msg.agentName}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {msg.role || agents[msg.agentId]?.role || 'Persona'}
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    {msg.toolUsed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        {msg.toolUsed.failed ? <AlertCircle size={10} /> : <Search size={10} />}
                        <span>VERIFIED</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                        <CheckCircle2 size={10} />
                        <span>COMPLETED</span>
                      </span>
                    )}
                  </div>

                  {/* Round */}
                  <div className="col-span-2 text-xs font-bold text-slate-300">
                    ROUND 0{msg.round}
                  </div>

                  {/* Activity snippet */}
                  <div className="col-span-4 text-xs text-slate-300 truncate font-sans flex items-center gap-2">
                    {onPlayVoice && (
                      <button
                        type="button"
                        onClick={() => onPlayVoice(msg)}
                        title={isVoicePlaying ? 'Stop Voice' : 'Listen to Agent'}
                        className="p-1 rounded bg-white/5 hover:bg-white/10 text-slate-300 hover:text-cyan-300 transition-colors shrink-0 cursor-pointer"
                      >
                        <Volume2 size={12} className={isVoicePlaying ? 'text-emerald-400 animate-pulse' : ''} />
                      </button>
                    )}
                    <span className="truncate">
                      {msg.toolUsed?.fact ? `🔍 Grounding: "${msg.toolUsed.fact}"` : msg.text}
                    </span>
                  </div>

                  {/* Time */}
                  <div className="col-span-1 text-right text-[10px] text-slate-400">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      minute: '2-digit',
                      second: '2-digit',
                    })}
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
