import React from 'react';
import {
  Terminal,
  Play,
  Square,
  Copy,
  Check,
  Download,
  Loader2,
  Search,
  AlertCircle,
  FileText,
  Code2,
  Volume2,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { AGENT_QUADRANTS } from '@/data/parallaxQuadrants';
import { ParallaxAgentAvatar } from './ParallaxAgentIcon';
import type {
  ParallaxMessage,
  ParallaxAgentConfig,
  ParallaxSpecialistDeliberation,
} from '@/types';

export interface ParallaxDeliberationStreamProps {
  messages: ParallaxMessage[];
  agents: Record<string, ParallaxAgentConfig>;
  isRunning: boolean;
  currentRound: 1 | 2 | 3 | null;
  wasStoppedEarly: boolean;
  specialistDeliberation: ParallaxSpecialistDeliberation | null;
  roundFilter: 'all' | 1 | 2 | 3;
  groupFilter: 'all' | 'optimists' | 'realists' | 'ethicists' | 'visionaries' | 'anchors' | 'facts';
  selectedAgentFilter: string | null;
  expandedRounds: Record<number, boolean>;
  playingAudioKey: string | null;
  loadingAudioKey: string | null;
  fullSwarmProgress: { current: number; total: number } | null;
  copiedSwarmTranscript: boolean;
  isDownloadingSwarmMp3: boolean;
  rawJsonOpenMap: Record<string, boolean>;
  copiedRawJsonId: string | null;
  currentTopic: string;
  onSetRoundFilter: (r: 'all' | 1 | 2 | 3) => void;
  onSetGroupFilter: (g: 'all' | 'optimists' | 'realists' | 'ethicists' | 'visionaries' | 'anchors' | 'facts') => void;
  onSetSelectedAgentFilter: (id: string | null) => void;
  onToggleRoundExpand: (r: number) => void;
  onPlayMessageAudio: (msg: ParallaxMessage) => void;
  onListenToFullSwarm: () => void;
  onDownloadSwarmMp3: () => void;
  onCopyFullSwarm: () => void;
  onStopSwarm: () => void;
  onToggleRawJsonView: (msgId: string) => void;
  onCopyRawJson: (json: string, msgId: string, e: React.MouseEvent) => void;
  feedEndRef: React.RefObject<HTMLDivElement | null>;
}

export const ParallaxDeliberationStream: React.FC<ParallaxDeliberationStreamProps> = ({
  messages,
  agents,
  isRunning,
  currentRound,
  wasStoppedEarly,
  specialistDeliberation,
  roundFilter,
  groupFilter,
  selectedAgentFilter,
  expandedRounds,
  playingAudioKey,
  loadingAudioKey,
  fullSwarmProgress,
  copiedSwarmTranscript,
  isDownloadingSwarmMp3,
  rawJsonOpenMap,
  copiedRawJsonId,
  currentTopic,
  onSetRoundFilter,
  onSetGroupFilter,
  onSetSelectedAgentFilter,
  onToggleRoundExpand,
  onPlayMessageAudio,
  onListenToFullSwarm,
  onDownloadSwarmMp3,
  onCopyFullSwarm,
  onStopSwarm,
  onToggleRawJsonView,
  onCopyRawJson,
  feedEndRef,
}) => {
  return (
    <div
      id="parallax-live-feed-container"
      className="nexus-corner-bracket relative rounded-2xl overflow-hidden mb-6"
      style={{
        background: 'linear-gradient(145deg, rgba(3, 10, 18, 0.97) 0%, rgba(2, 6, 12, 0.99) 100%)',
        border: '1.5px solid rgba(0, 240, 255, 0.28)',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.7), inset 0 0 32px rgba(0, 240, 255, 0.04)',
        minHeight: '380px',
        maxHeight: '740px',
        overflowY: 'auto',
      }}
    >
      {/* Deliberation Terminal scanline overlay */}
      <div className="nexus-terminal-scanlines absolute inset-0 z-10 pointer-events-none opacity-20" />

      {/* Terminal Title & Sticky Actions Toolbar */}
      <div
        id="parallax-feed-toolbar"
        className="sticky top-0 z-30 bg-black/85 backdrop-blur-xl border-b border-cyan-500/20 px-5 py-3 shadow-xl"
      >
        <div className="flex items-center justify-between flex-wrap gap-2.5">
          {/* Terminal Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
            <h2 className="m-0 text-xs font-mono font-black uppercase text-white tracking-widest flex items-center gap-2 truncate">
              <span>&gt; PARALLAX DELIBERATION STREAM</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                {messages.length} TURNS{currentRound ? ` • ROUND ${currentRound}` : ''}
              </span>
            </h2>

            {wasStoppedEarly && (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                STOPPED EARLY
              </span>
            )}

            {fullSwarmProgress && (
              <span className="text-[10px] font-mono text-cyan-300 flex items-center gap-1">
                <Loader2 size={11} className="animate-spin" />
                Synthesizing {fullSwarmProgress.current} / {fullSwarmProgress.total}
              </span>
            )}
          </div>

          {/* Action Button Cluster */}
          <div
            id="parallax-feed-actions-cluster"
            className="flex items-center gap-2 flex-wrap font-mono text-xs"
          >
            {/* Stop Swarm Button (when running) */}
            {isRunning && (
              <button
                type="button"
                onClick={onStopSwarm}
                className="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-500/70 text-rose-200 font-bold hover:bg-rose-900/80 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 shadow-[0_0_12px_rgba(244,63,94,0.3)]"
              >
                <Square size={11} fill="currentColor" />
                <span>Halt Swarm</span>
              </button>
            )}

            {/* Copy Full Swarm Button */}
            <button
              type="button"
              onClick={onCopyFullSwarm}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                copiedSwarmTranscript
                  ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300'
                  : 'bg-white/5 border-white/10 hover:border-cyan-400 text-slate-300 hover:text-white'
              }`}
            >
              {copiedSwarmTranscript ? <Check size={12} /> : <Copy size={12} />}
              <span>{copiedSwarmTranscript ? 'Copied Full Swarm!' : 'Copy Transcript'}</span>
            </button>

            {/* Listen to Full Swarm Button */}
            <button
              type="button"
              onClick={onListenToFullSwarm}
              disabled={loadingAudioKey === 'full_swarm' && !fullSwarmProgress}
              className={`px-3 py-1.5 rounded-lg border font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                playingAudioKey === 'full_swarm'
                  ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                  : 'bg-cyan-500/20 border-cyan-400 text-cyan-200 hover:bg-cyan-500/30'
              }`}
            >
              {loadingAudioKey === 'full_swarm' ? (
                <Loader2 size={12} className="animate-spin text-cyan-300" />
              ) : playingAudioKey === 'full_swarm' ? (
                <Square size={11} fill="currentColor" />
              ) : (
                <Play size={11} fill="currentColor" />
              )}
              <span>
                {loadingAudioKey === 'full_swarm'
                  ? 'Synthesizing Audio...'
                  : playingAudioKey === 'full_swarm'
                  ? 'Stop Voice'
                  : 'Listen Full Swarm'}
              </span>
            </button>

            {/* Download as MP3 Button */}
            <button
              type="button"
              onClick={onDownloadSwarmMp3}
              disabled={isDownloadingSwarmMp3}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:border-cyan-400 text-slate-300 hover:text-white font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              {isDownloadingSwarmMp3 ? (
                <Loader2 size={12} className="animate-spin text-cyan-300" />
              ) : (
                <Download size={12} />
              )}
              <span>{isDownloadingSwarmMp3 ? 'Exporting MP3...' : 'Download MP3'}</span>
            </button>
          </div>
        </div>

        {/* Filter Pills Bar */}
        <div
          id="parallax-feed-filter-bar"
          className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono"
        >
          {/* Round Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 text-[10px] mr-0.5">ROUND:</span>
            {(['all', 1, 2, 3] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => onSetRoundFilter(r)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                  roundFilter === r
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                    : 'bg-white/5 text-slate-400 border border-white/5 hover:text-white'
                }`}
              >
                {r === 'all' ? 'All (3 Rounds)' : `R0${r}`}
              </button>
            ))}
          </div>

          {/* Cluster Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-500 text-[10px] mr-0.5">CLUSTER:</span>
            {[
              { key: 'all', label: 'All' },
              { key: 'optimists', label: 'Optimists' },
              { key: 'realists', label: 'Realists' },
              { key: 'ethicists', label: 'Ethicists' },
              { key: 'visionaries', label: 'Visionaries' },
              { key: 'anchors', label: 'Anchors' },
              { key: 'facts', label: 'Facts' },
            ].map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => onSetGroupFilter(c.key as typeof groupFilter)}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-all ${
                  groupFilter === c.key
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/50'
                    : 'bg-white/5 text-slate-400 border border-white/5 hover:text-white'
                }`}
              >
                {c.label}
              </button>
            ))}

            {/* Selected Agent Filter pill */}
            {selectedAgentFilter && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-400 text-cyan-200 font-bold text-[10px]">
                <span>{agents[selectedAgentFilter]?.name || selectedAgentFilter}</span>
                <button
                  type="button"
                  onClick={() => onSetSelectedAgentFilter(null)}
                  className="hover:text-white cursor-pointer ml-0.5"
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Stream Content */}
      <div className="relative z-20 p-4 sm:p-6 space-y-6">
        {messages.length === 0 && !isRunning ? (
          <div className="py-16 text-center text-slate-400 font-mono text-xs">
            <Terminal size={32} className="mx-auto mb-3 text-cyan-400/40" />
            <h3 className="m-0 text-sm font-bold text-white uppercase tracking-wider">
              SWARM DELIBERATION STREAM STANDBY
            </h3>
            <p className="m-0 text-slate-500 text-xs mt-1 max-w-md mx-auto">
              Enter a research inquiry above and mobilize the 20-persona swarm to observe real-time peer dialectics, grounded tools, and cross-examinations.
            </p>
          </div>
        ) : (
          <>
            {/* Pre-Round Specialist Deliberation */}
            {(roundFilter === 'all' || roundFilter === 1) && specialistDeliberation && (
              <div
                id="parallax-pre-round-deliberation"
                className="p-4 rounded-xl font-mono text-xs space-y-3"
                style={{
                  background: 'linear-gradient(135deg, rgba(88, 28, 135, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)',
                  border: '1px solid rgba(192, 132, 252, 0.35)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
                }}
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-400" />
                    <span className="font-bold text-white tracking-wider">
                      PRE-ROUND • SPECIALIST TOPIC COMPILATION
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                      3 MANDATORY COMPILED
                    </span>
                  </div>
                </div>

                {/* 5 Core Opinions */}
                {specialistDeliberation.opinions && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {specialistDeliberation.opinions.map((op, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg bg-black/40 border border-purple-500/20"
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold" style={{ color: op.accentColor || '#c084fc' }}>
                            {op.emoji} {op.agentName}
                          </span>
                          <span className="text-[10px] text-slate-400">{op.role}</span>
                        </div>
                        <div className="text-[11px] text-slate-200">
                          <span className="text-cyan-300 font-semibold">Proposes: </span>
                          <span>{op.suggestedSpecialist}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 italic mt-0.5 font-sans">
                          &ldquo;{op.reason}&rdquo;
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Rounds Stream with Inline Curation */}
            {([1, 2, 3] as const).map((roundNum) => {
              if (roundFilter !== 'all' && roundFilter !== roundNum) return null;

              const roundMsgs = messages.filter((m) => {
                if (m.round !== roundNum) return false;
                if (selectedAgentFilter && m.agentId !== selectedAgentFilter) return false;
                if (groupFilter !== 'all') {
                  if (groupFilter === 'facts') {
                    if (!m.toolUsed) return false;
                  } else {
                    const q = AGENT_QUADRANTS[m.agentId]?.quadrant;
                    if (q !== groupFilter) return false;
                  }
                }
                return true;
              });

              if (roundMsgs.length === 0) return null;

              const isExpanded = Boolean(expandedRounds[roundNum]);
              const CURATED_COUNT = 5;
              const visibleMsgs = isExpanded ? roundMsgs : roundMsgs.slice(0, CURATED_COUNT);
              const hiddenCount = Math.max(0, roundMsgs.length - CURATED_COUNT);

              return (
                <div key={roundNum} id={`parallax-round-section-${roundNum}`} className="space-y-3">
                  {/* Round Header Divider */}
                  <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 font-mono">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/40 text-xs font-bold">
                        ROUND 0{roundNum} OF 03
                      </span>
                      <span className="text-xs text-slate-400 hidden sm:inline font-sans">
                        {roundNum === 1
                          ? 'Thesis & Initial Takes (VERITAS Grounding)'
                          : roundNum === 2
                          ? 'Cross-Examination & Peer Pushback'
                          : 'Final Deliberation & Convergence'}
                      </span>
                    </div>

                    <span className="text-xs text-cyan-400 font-bold">
                      {roundMsgs.length} REPLIES
                    </span>
                  </div>

                  {/* Messages list */}
                  <div className="space-y-2">
                    {visibleMsgs.map((msg) => {
                      const isVoicePlaying = playingAudioKey === msg.id;
                      const isVoiceLoading = loadingAudioKey === msg.id;

                      return (
                        <div
                          key={msg.id}
                          className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 transition-all font-mono"
                          style={{
                            borderLeft: `3px solid ${msg.accentColor}`,
                          }}
                        >
                          {/* Top Row: Timestamp, Label, Role, Badges, Audio */}
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Monospace Timestamp */}
                              <span className="text-[10px] text-slate-500">
                                [{new Date(msg.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}]
                              </span>

                              {/* Agent Avatar & Name */}
                              <ParallaxAgentAvatar
                                agentId={msg.agentId}
                                agentName={msg.agentName}
                                accentColor={msg.accentColor}
                                size="sm"
                              />

                              <span
                                className="text-xs font-black tracking-wide"
                                style={{ color: msg.accentColor }}
                              >
                                [{msg.agentName.toUpperCase()}]
                              </span>

                              {msg.mood && (
                                <span className="text-[10px] text-slate-400">
                                  {msg.mood}
                                </span>
                              )}

                              {/* Dynamic badge */}
                              {msg.isDynamic && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                                  SPECIALIST
                                </span>
                              )}

                              {/* Conviction score */}
                              {msg.conviction !== undefined && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10 font-bold">
                                  Conviction: {msg.conviction}/10
                                </span>
                              )}

                              {/* Tool used badge */}
                              {msg.toolUsed && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 font-bold flex items-center gap-1">
                                  <Search size={9} />
                                  <span>{msg.toolUsed.searchSource || 'Live Web'}</span>
                                </span>
                              )}
                            </div>

                            {/* Voice Button */}
                            <div className="flex items-center gap-2">
                              {msg.round === 1 && msg.agentId === 'veritas' && msg.toolUsed && (
                                <button
                                  type="button"
                                  onClick={() => onToggleRawJsonView(msg.id)}
                                  className="px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 bg-white/5 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                                >
                                  {rawJsonOpenMap[msg.id] ? (
                                    <>
                                      <FileText size={10} className="text-cyan-400" />
                                      <span>Formatted</span>
                                    </>
                                  ) : (
                                    <>
                                      <Code2 size={10} className="text-cyan-400" />
                                      <span>Raw JSON</span>
                                    </>
                                  )}
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onPlayMessageAudio(msg)}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold flex items-center gap-1 cursor-pointer transition-all ${
                                  isVoicePlaying
                                    ? 'bg-emerald-500/25 border border-emerald-400 text-emerald-300 shadow-[0_0_8px_#10b981]'
                                    : 'bg-white/5 border border-white/10 text-slate-300 hover:text-cyan-300'
                                }`}
                              >
                                {isVoiceLoading ? (
                                  <Loader2 size={10} className="animate-spin text-cyan-400" />
                                ) : isVoicePlaying ? (
                                  <>
                                    <Square size={9} fill="currentColor" />
                                    <span>Stop</span>
                                  </>
                                ) : (
                                  <>
                                    <Volume2 size={10} />
                                    <span>Voice</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>

                          {/* Message Text */}
                          <p className="m-0 text-xs sm:text-[13px] text-slate-200 font-sans leading-relaxed break-words">
                            {msg.text}
                          </p>

                          {/* Veritas Live Grounding Preview */}
                          {msg.toolUsed && (
                            <div className="mt-2 p-2 rounded-lg bg-cyan-950/20 border border-cyan-500/20 text-xs text-slate-300 font-sans">
                              {msg.toolUsed.failed ? (
                                <div className="text-amber-400 flex items-center gap-1.5">
                                  <AlertCircle size={12} />
                                  <span>Search fallback notice: zero results for &ldquo;{msg.toolUsed.query}&rdquo;</span>
                                </div>
                              ) : (
                                <div className="text-cyan-200">
                                  🔍 <strong className="text-cyan-400">Grounding ({msg.toolUsed.searchSource || 'Live Web'}):</strong>{' '}
                                  <span className="text-slate-300 italic">&ldquo;{msg.toolUsed.fact}&rdquo;</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Raw JSON View for Veritas */}
                          {msg.round === 1 && msg.agentId === 'veritas' && msg.toolUsed && rawJsonOpenMap[msg.id] && (() => {
                            const payload = {
                              query: msg.toolUsed.query || msg.toolUsed.rawPayload?.query || currentTopic,
                              searchSource: msg.toolUsed.searchSource || msg.toolUsed.rawPayload?.searchSource || 'Tavily',
                              committedFact: msg.toolUsed.committedFact || msg.toolUsed.rawPayload?.committedFact || msg.toolUsed.fact || '',
                              resultsCount: msg.toolUsed.rawResults?.length ?? msg.toolUsed.rawPayload?.resultsCount ?? msg.toolUsed.sourcesCount ?? 0,
                              rawResults: msg.toolUsed.rawResults || msg.toolUsed.rawPayload?.rawResults || [],
                            };
                            const jsonStr = JSON.stringify(payload, null, 2);

                            return (
                              <div className="mt-2.5 rounded-xl bg-black/85 border border-cyan-500/30 p-3 overflow-hidden shadow-2xl">
                                <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10 text-[10px] font-mono">
                                  <span className="text-cyan-300 font-bold">
                                    VERITAS GROUNDING TELEMETRY (RAW JSON)
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => onCopyRawJson(jsonStr, msg.id, e)}
                                    className="px-2 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 text-slate-300 hover:text-white cursor-pointer"
                                  >
                                    {copiedRawJsonId === msg.id ? (
                                      <span className="text-emerald-300">✓ Copied</span>
                                    ) : (
                                      <span>Copy JSON</span>
                                    )}
                                  </button>
                                </div>
                                <pre className="font-mono text-xs text-cyan-200 max-h-[300px] overflow-y-auto whitespace-pre-wrap m-0">
                                  {jsonStr}
                                </pre>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>

                  {/* Expand / Collapse Button for Round */}
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => onToggleRoundExpand(roundNum)}
                      className="w-full py-2 px-3 rounded-lg bg-white/5 border border-dashed border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 font-mono text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp size={14} />
                          <span>Collapse Round {roundNum}</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={14} />
                          <span>+{hiddenCount} more agent turns in Round {roundNum} (Click to expand)</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              );
            })}

            <div ref={feedEndRef} />
          </>
        )}
      </div>
    </div>
  );
};
