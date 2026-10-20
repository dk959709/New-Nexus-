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
  Code2,
  Volume2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  User,
  ShieldAlert,
  Flame,
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
      className="relative py-4 border-b border-white/[0.06]"
    >
      {/* Terminal Title & Sticky Actions Toolbar */}
      <div
        id="parallax-feed-toolbar"
        className="sticky top-0 z-30 bg-slate-950/70 backdrop-blur-xl border-b border-white/[0.06] py-3.5 mb-6"
      >
        <div className="flex items-center justify-between flex-wrap gap-2.5">
          {/* Terminal Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#00f0ff]" />
            <h2 className="m-0 text-xs font-mono font-black uppercase text-slate-100 tracking-widest flex items-center gap-2 truncate">
              <span>PARALLAX DELIBERATION STREAM</span>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-slate-900/40 backdrop-blur-xl text-cyan-300">
                {messages.length} TURNS{currentRound ? ` • ROUND 0${currentRound}` : ''}
              </span>
            </h2>

            {wasStoppedEarly && (
              <span className="text-[10px] font-mono px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-bold">
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
                className="px-3.5 py-1.5 rounded-full bg-rose-500/20 backdrop-blur-xl text-rose-200 font-bold hover:bg-rose-500/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Square size={11} fill="currentColor" />
                <span>Stop Swarm</span>
              </button>
            )}

            {/* Listen to Full Swarm button */}
            {messages.length > 0 && (
              <button
                id="parallax-listen-full-swarm-btn"
                type="button"
                onClick={onListenToFullSwarm}
                disabled={loadingAudioKey === 'full_swarm'}
                className="px-3.5 py-1.5 rounded-full bg-cyan-500/20 backdrop-blur-xl text-cyan-200 hover:bg-cyan-500/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5 font-bold"
              >
                {loadingAudioKey === 'full_swarm' ? (
                  <Loader2 size={12} className="animate-spin text-cyan-300" />
                ) : playingAudioKey === 'full_swarm' ? (
                  <Square size={11} fill="currentColor" className="text-cyan-300" />
                ) : (
                  <Play size={11} fill="currentColor" className="text-cyan-300" />
                )}
                <span>
                  {loadingAudioKey === 'full_swarm'
                    ? 'Synthesizing Audio...'
                    : playingAudioKey === 'full_swarm'
                    ? 'Stop Full Audio'
                    : 'Listen Full Swarm'}
                </span>
              </button>
            )}

            {/* Download Swarm MP3 */}
            {messages.length > 0 && (
              <button
                id="parallax-download-mp3-btn"
                type="button"
                onClick={onDownloadSwarmMp3}
                disabled={isDownloadingSwarmMp3}
                className="px-3 py-1.5 rounded-full bg-slate-900/40 backdrop-blur-xl hover:bg-slate-800/60 text-slate-200 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                title="Download full multi-voice MP3 stitched discussion"
              >
                {isDownloadingSwarmMp3 ? (
                  <Loader2 size={12} className="animate-spin text-cyan-300" />
                ) : (
                  <Download size={12} />
                )}
                <span className="hidden sm:inline">
                  {isDownloadingSwarmMp3 ? 'Building MP3...' : 'Download MP3'}
                </span>
              </button>
            )}

            {/* Copy full transcript */}
            {messages.length > 0 && (
              <button
                id="parallax-copy-transcript-btn"
                type="button"
                onClick={onCopyFullSwarm}
                className="px-3 py-1.5 rounded-full bg-slate-900/40 backdrop-blur-xl hover:bg-slate-800/60 text-slate-200 hover:text-white transition-all cursor-pointer flex items-center gap-1.5"
                title="Copy entire discussion transcript formatted with headers"
              >
                {copiedSwarmTranscript ? (
                  <Check size={12} className="text-emerald-400" />
                ) : (
                  <Copy size={12} />
                )}
                <span className="hidden sm:inline">
                  {copiedSwarmTranscript ? 'Copied' : 'Copy Text'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Curation & Filter Strip */}
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
          {/* Round Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-300 text-[11px]">ROUND:</span>
            {[
              { key: 'all', label: 'All Rounds' },
              { key: 1, label: 'Round 01' },
              { key: 2, label: 'Round 02' },
              { key: 3, label: 'Round 03' },
            ].map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => onSetRoundFilter(r.key as typeof roundFilter)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                  roundFilter === r.key
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'bg-slate-900/40 backdrop-blur-xl text-slate-300 hover:text-slate-100'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Cluster Filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-300 text-[11px]">FILTER:</span>
            {[
              { key: 'all', label: 'All Agents' },
              { key: 'facts', label: 'Tool Grounded' },
              { key: 'anchors', label: 'Anchors' },
              { key: 'optimists', label: 'Optimists' },
              { key: 'realists', label: 'Realists' },
              { key: 'ethicists', label: 'Ethicists' },
              { key: 'visionaries', label: 'Visionaries' },
            ].map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => onSetGroupFilter(c.key as typeof groupFilter)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all ${
                  groupFilter === c.key
                    ? 'bg-cyan-500/20 text-cyan-300'
                    : 'bg-slate-900/40 backdrop-blur-xl text-slate-300 hover:text-slate-100'
                }`}
              >
                {c.label}
              </button>
            ))}

            {/* Selected Agent Filter pill */}
            {selectedAgentFilter && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-cyan-500/20 text-cyan-200 font-bold text-[10px]">
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
      <div className="relative z-20 space-y-8">
        {messages.length === 0 && !isRunning ? (
          <div className="py-16 text-center text-slate-300 font-mono text-xs">
            <Terminal size={32} className="mx-auto mb-3 text-cyan-400/50" />
            <h3 className="m-0 text-sm font-bold text-slate-100 uppercase tracking-wider">
              SWARM DELIBERATION STREAM STANDBY
            </h3>
            <p className="m-0 text-slate-300 text-xs mt-1.5 max-w-md mx-auto">
              Enter a research inquiry above and mobilize the 20-persona swarm to observe real-time peer dialectics, grounded tools, and cross-examinations.
            </p>
          </div>
        ) : (
          <>
            {/* Pre-Round Specialist Deliberation */}
            {(roundFilter === 'all' || roundFilter === 1) && specialistDeliberation && (
              <div
                id="parallax-pre-round-deliberation"
                className="pl-4 border-l-2 border-purple-400/60 py-2 font-mono text-xs space-y-3"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-purple-400" />
                    <span className="font-bold text-slate-100 tracking-wider">
                      PRE-ROUND • SPECIALIST TOPIC COMPILATION
                    </span>
                    <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                      3 COMPILED SPECIALISTS
                    </span>
                  </div>
                </div>

                {/* 5 Core Opinions */}
                {specialistDeliberation.opinions && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {specialistDeliberation.opinions.map((op, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-900/40 backdrop-blur-xl hover:bg-slate-900/60 transition-colors"
                      >
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold" style={{ color: op.accentColor || '#c084fc' }}>
                            {op.emoji} {op.agentName}
                          </span>
                          <span className="text-[10px] text-slate-300">{op.role}</span>
                        </div>
                        <div className="text-[11px] text-slate-100">
                          <span className="text-cyan-300 font-semibold">Proposes: </span>
                          <span>{op.suggestedSpecialist}</span>
                        </div>
                        <div className="text-[10px] text-slate-300 italic mt-0.5 font-sans">
                          &ldquo;{op.reason}&rdquo;
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Rounds Stream as Open Timeline Thread with Left-Line Connectors */}
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
              const CURATED_COUNT = 6;
              const visibleMsgs = isExpanded ? roundMsgs : roundMsgs.slice(0, CURATED_COUNT);
              const hiddenCount = Math.max(0, roundMsgs.length - CURATED_COUNT);

              return (
                <div
                  key={roundNum}
                  id={`parallax-round-section-${roundNum}`}
                  className="relative pl-4 sm:pl-6 border-l border-white/10 space-y-4"
                >
                  {/* Timeline Node Dot on Left Connector */}
                  <div className="absolute -left-[5px] top-1.5 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#00f0ff]" />

                  {/* Round Header Divider */}
                  <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5 font-mono">
                    <div className="flex items-center gap-2.5">
                      <span className="px-3 py-0.5 rounded-full bg-slate-900/40 backdrop-blur-xl text-cyan-300 text-xs font-bold">
                        ROUND 0{roundNum} OF 03
                      </span>
                      <span className="text-xs text-slate-300 hidden sm:inline font-sans">
                        {roundNum === 1
                          ? 'Thesis & Initial Takes (VERITAS Grounding)'
                          : roundNum === 2
                          ? 'Cross-Examination & Peer Pushback'
                          : 'Final Deliberation & Convergence'}
                      </span>
                    </div>

                    <span className="text-xs text-cyan-300 font-bold">
                      {roundMsgs.length} REPLIES
                    </span>
                  </div>

                  {/* Open Thread Messages list with hairline dividers */}
                  <div className="divide-y divide-white/[0.06]">
                    {visibleMsgs.map((msg) => {
                      const isVoicePlaying = playingAudioKey === msg.id;
                      const isVoiceLoading = loadingAudioKey === msg.id;
                      const isHuman = msg.isHuman || msg.agentId === 'human';
                      const isDevilsAdvocate = msg.isDevilsAdvocate || msg.agentId === 'devils_advocate';

                      // Event type label based on tool use or rebuttal
                      const eventType = isHuman
                        ? 'HUMAN OPERATOR INTERVENTION'
                        : isDevilsAdvocate
                        ? 'CONTRARIAN CROSS-EXAMINATION'
                        : msg.toolUsed
                        ? 'SOURCE VERIFICATION / GROUNDING'
                        : msg.replyToAgentName
                        ? `CROSS-EXAMINATION / VS @${msg.replyToAgentName.toUpperCase()}`
                        : roundNum === 1
                        ? 'INITIAL THESIS PROPOSAL'
                        : roundNum === 2
                        ? 'DIALECTICAL REBUTTAL'
                        : 'CONVERGENCE DELIBERATION';

                      const borderLeftColor = isHuman
                        ? '#f59e0b'
                        : isDevilsAdvocate
                        ? '#f43f5e'
                        : msg.accentColor;

                      return (
                        <div
                          key={msg.id}
                          id={`parallax-msg-${msg.id}`}
                          className={`py-4 px-4 rounded-xl transition-colors font-mono scroll-mt-24 hover:bg-slate-900/40 ${
                            isHuman
                              ? 'bg-amber-950/20'
                              : isDevilsAdvocate
                              ? 'bg-rose-950/20'
                              : 'bg-transparent'
                          }`}
                          style={{
                            borderLeft: `2px solid ${borderLeftColor}`,
                          }}
                        >
                          {/* Top Feed Header: TIMESTAMP • AGENT • EVENT • ROUND */}
                          <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Monospace Timestamp */}
                              <span className="text-[10px] text-slate-300 font-bold bg-slate-900/40 backdrop-blur-xl px-2 py-0.5 rounded-full">
                                {new Date(msg.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </span>

                              {/* Agent Avatar & Name */}
                              {isHuman ? (
                                <div className="w-6 h-6 rounded-lg bg-amber-500/20 grid place-items-center text-amber-300 font-black text-xs shrink-0">
                                  <User size={13} />
                                </div>
                              ) : isDevilsAdvocate ? (
                                <div className="w-6 h-6 rounded-lg bg-rose-500/20 grid place-items-center text-rose-300 font-black text-xs shrink-0">
                                  <Flame size={13} />
                                </div>
                              ) : (
                                <ParallaxAgentAvatar
                                  agentId={msg.agentId}
                                  agentName={msg.agentName}
                                  accentColor={msg.accentColor}
                                  size="sm"
                                />
                              )}

                              <span
                                className="text-xs font-black tracking-wide"
                                style={{ color: borderLeftColor }}
                              >
                                {msg.agentName.toUpperCase()}
                              </span>

                              {/* Role */}
                              <span className="text-[11px] text-slate-300 font-sans">
                                ({msg.role || (isHuman ? 'Human Directive' : 'AI Specialist')})
                              </span>

                              {/* Event tag */}
                              <span
                                className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${
                                  isHuman
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : isDevilsAdvocate
                                    ? 'bg-rose-500/20 text-rose-300'
                                    : 'bg-slate-900/40 backdrop-blur-xl text-cyan-300'
                                }`}
                              >
                                {eventType}
                              </span>

                              {/* Round tag */}
                              <span className="text-[9px] px-2 py-0.5 rounded-full bg-slate-900/40 text-slate-300">
                                ROUND 0{msg.round}
                              </span>

                              {/* Dynamic / Devil's Advocate / Human badge */}
                              {isHuman ? (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/25 text-amber-200 font-bold">
                                  DIRECTIVE
                                </span>
                              ) : isDevilsAdvocate ? (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-rose-500/25 text-rose-200 font-bold flex items-center gap-1">
                                  <ShieldAlert size={10} />
                                  <span>CONTRARIAN</span>
                                </span>
                              ) : msg.isDynamic ? (
                                <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-bold">
                                  SPECIALIST
                                </span>
                              ) : null}
                            </div>

                            {/* Audio Action & JSON toggles */}
                            <div className="flex items-center gap-1.5">
                              {msg.conviction !== undefined && !isHuman && (
                                <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-slate-900/40 backdrop-blur-xl text-slate-100 font-bold mr-1">
                                  Conviction: {msg.conviction}/10
                                </span>
                              )}

                              {!isHuman && (
                                <button
                                  type="button"
                                  onClick={() => onPlayMessageAudio(msg)}
                                  disabled={isVoiceLoading}
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition-all flex items-center gap-1 ${
                                    isVoicePlaying
                                      ? 'bg-cyan-500/30 text-cyan-200'
                                      : 'bg-slate-900/40 hover:bg-slate-800/60 text-slate-200'
                                  }`}
                                  title="Listen to this agent's synthesized speech"
                                >
                                  {isVoiceLoading ? (
                                    <Loader2 size={10} className="animate-spin text-cyan-300" />
                                  ) : isVoicePlaying ? (
                                    <Square size={9} fill="currentColor" />
                                  ) : (
                                    <Volume2 size={10} />
                                  )}
                                  <span>{isVoicePlaying ? 'Stop' : 'Voice'}</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => onToggleRawJsonView(msg.id)}
                                className="p-1.5 rounded-full bg-slate-900/40 hover:bg-slate-800/60 text-slate-300 hover:text-white cursor-pointer"
                                title="Toggle Raw JSON Data"
                              >
                                <Code2 size={11} />
                              </button>
                            </div>
                          </div>

                          {/* Rebuttal Target Indicator (if Round 2 peer pushback) */}
                          {msg.replyToAgentName && (
                            <div className="mb-2 px-3 py-1.5 rounded-lg bg-slate-900/40 backdrop-blur-xl text-[11px] text-cyan-200 font-sans flex items-center justify-between gap-1.5">
                              <div className="flex items-center gap-1.5">
                                <Zap size={11} className="text-cyan-400" />
                                <span>
                                  Cross-examining ideological opponent{' '}
                                  <strong className="font-mono text-cyan-300">@{msg.replyToAgentName}</strong>
                                </span>
                              </div>
                              {msg.replyToMessageId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const el = document.getElementById(`parallax-msg-${msg.replyToMessageId}`);
                                    if (el) {
                                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      el.classList.add('ring-2', 'ring-cyan-400');
                                      setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-400'), 2500);
                                    }
                                  }}
                                  className="text-[10px] text-cyan-300 hover:underline font-mono cursor-pointer"
                                >
                                  View quoted statement ➔
                                </button>
                              )}
                            </div>
                          )}

                          {/* VERITAS Grounding Preview (if web/wiki tool used) */}
                          {msg.toolUsed && (
                            <div className="mb-2.5 p-3 rounded-xl bg-slate-900/40 backdrop-blur-xl text-[11px] space-y-1 font-sans">
                              <div className="flex items-center gap-1.5 text-cyan-300 font-mono text-[10px] font-bold">
                                <Search size={11} />
                                <span>VERITAS GROUNDING ENGINE</span>
                                <span className="text-slate-500">•</span>
                                <span className="text-slate-300">
                                  Query: &ldquo;{msg.toolUsed.query}&rdquo;
                                </span>
                              </div>
                              {msg.toolUsed.committedFact && (
                                <p className="m-0 text-slate-200 text-[11px] italic">
                                  &ldquo;{msg.toolUsed.committedFact}&rdquo;
                                </p>
                              )}
                            </div>
                          )}

                          {/* Message Text Body with high-contrast typography and interactive @mention chips */}
                          <div className="text-xs sm:text-[13px] text-slate-100 font-sans leading-relaxed whitespace-pre-wrap">
                            {msg.text.split(/(@[a-zA-Z0-9_-]+)/g).map((part, pIdx) => {
                              if (part.startsWith('@')) {
                                const targetName = part.slice(1);
                                const targetMsg =
                                  (msg.replyToMessageId
                                    ? messages.find((m) => m.id === msg.replyToMessageId)
                                    : null) ||
                                  messages.find(
                                    (m) =>
                                      m.agentName.toLowerCase() === targetName.toLowerCase() ||
                                      m.agentId.toLowerCase() === targetName.toLowerCase(),
                                  );

                                return (
                                  <span
                                    key={pIdx}
                                    onClick={() => {
                                      if (targetMsg) {
                                        const el = document.getElementById(`parallax-msg-${targetMsg.id}`);
                                        if (el) {
                                          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                          el.classList.add('ring-2', 'ring-cyan-400');
                                          setTimeout(() => el.classList.remove('ring-2', 'ring-cyan-400'), 2500);
                                        }
                                      }
                                    }}
                                    className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold cursor-pointer hover:bg-cyan-500/35 transition-all mx-0.5"
                                    title={
                                      targetMsg
                                        ? `Jump to @${targetName}'s prior argument in Round ${targetMsg.round}`
                                        : `Referencing @${targetName}`
                                    }
                                  >
                                    <span>{part}</span>
                                  </span>
                                );
                              }
                              return <span key={pIdx}>{part}</span>;
                            })}
                          </div>

                          {/* Raw JSON inspection view */}
                          {rawJsonOpenMap[msg.id] && (
                            <div className="mt-3 p-3 rounded-xl bg-slate-950/80 backdrop-blur-xl font-mono text-[10px] space-y-2">
                              <div className="flex items-center justify-between text-slate-300">
                                <span>RAW JSON PAYLOAD ({msg.id})</span>
                                <button
                                  type="button"
                                  onClick={(e) => onCopyRawJson(JSON.stringify(msg, null, 2), msg.id, e)}
                                  className="text-cyan-300 hover:text-cyan-200 flex items-center gap-1 cursor-pointer"
                                >
                                  {copiedRawJsonId === msg.id ? (
                                    <Check size={10} className="text-emerald-400" />
                                  ) : (
                                    <Copy size={10} />
                                  )}
                                  <span>{copiedRawJsonId === msg.id ? 'Copied' : 'Copy'}</span>
                                </button>
                              </div>
                              <pre className="m-0 overflow-x-auto text-cyan-200/90 max-h-48">
                                {JSON.stringify(msg, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Expand / Collapse Curated Turns Toggle */}
                  {roundMsgs.length > CURATED_COUNT && (
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => onToggleRoundExpand(roundNum)}
                        className="px-4 py-1.5 rounded-full bg-slate-900/40 backdrop-blur-xl hover:bg-slate-800/60 text-slate-200 hover:text-white font-mono text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp size={13} />
                            <span>Collapse to 6 Curated Turns</span>
                          </>
                        ) : (
                          <>
                            <ChevronDown size={13} />
                            <span>View All {roundMsgs.length} Turns (+{hiddenCount} more)</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        <div ref={feedEndRef} />
      </div>
    </div>
  );
};
