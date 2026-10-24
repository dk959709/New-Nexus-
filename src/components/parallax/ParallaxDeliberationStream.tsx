import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  User,
  ShieldAlert,
  Flame,
  ArrowDown,
  CornerDownRight,
  Radio,
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
  expandedRounds?: Record<number, boolean>;
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
  onToggleRoundExpand?: (r: number) => void;
  onPlayMessageAudio: (msg: ParallaxMessage) => void;
  onListenToFullSwarm: () => void;
  onDownloadSwarmMp3: () => void;
  onCopyFullSwarm: () => void;
  onStopSwarm: () => void;
  onToggleRawJsonView: (msgId: string) => void;
  onCopyRawJson: (json: string, msgId: string, e: React.MouseEvent) => void;
  feedEndRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Deterministic fallback palette covering distinct, accessible color families:
 * Cyan, Pink/Rose, Violet, Emerald, Amber/Gold, Sky Blue, Coral, Teal.
 * Used only when an agent has no configured accentColor.
 */
const DETERMINISTIC_AGENT_PALETTE = [
  '#22d3ee', // Cyan
  '#f472b6', // Pink
  '#a78bfa', // Violet
  '#34d399', // Emerald
  '#fbbf24', // Amber
  '#60a5fa', // Blue
  '#fb923c', // Coral
  '#2dd4bf', // Teal
  '#e879f9', // Fuchsia
  '#818cf8', // Indigo
];

function getDeterministicFallbackColor(agentKey: string): string {
  let hash = 0;
  const clean = (agentKey || 'agent').toLowerCase().trim();
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  return DETERMINISTIC_AGENT_PALETTE[hash % DETERMINISTIC_AGENT_PALETTE.length];
}

function parseHexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length === 3) {
    const r = parseInt(cleaned[0] + cleaned[0], 16);
    const g = parseInt(cleaned[1] + cleaned[1], 16);
    const b = parseInt(cleaned[2] + cleaned[2], 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return { r, g, b };
  }
  if (cleaned.length >= 6) {
    const r = parseInt(cleaned.slice(0, 2), 16);
    const g = parseInt(cleaned.slice(2, 4), 16);
    const b = parseInt(cleaned.slice(4, 6), 16);
    if (!Number.isNaN(r) && !Number.isNaN(g) && !Number.isNaN(b)) return { r, g, b };
  }
  return null;
}

/**
 * Computes consistent, high-contrast color tokens for an agent across all 3 dark themes:
 * - `avatarHex`: The base hex color for ParallaxAgentAvatar
 * - `nameColor`: Vibrant, high-legibility accent color for the agent's name
 * - `bodyColor`: Softened, readable tint of the agent's color for the full message text
 * - `chipBg` / `chipBorder`: Subtle translucent surfaces for inline @mentions and badges
 */
function getAgentLiveChatColors(
  rawColor: string | undefined,
  agentId: string,
  isHuman: boolean,
  isDevilsAdvocate: boolean,
): {
  avatarHex: string;
  nameColor: string;
  bodyColor: string;
  chipBg: string;
  chipBorder: string;
} {
  if (isHuman) {
    return {
      avatarHex: '#f59e0b',
      nameColor: '#fbbf24',
      bodyColor: '#fde68a',
      chipBg: 'rgba(245, 158, 11, 0.14)',
      chipBorder: 'rgba(251, 191, 36, 0.35)',
    };
  }
  if (isDevilsAdvocate) {
    return {
      avatarHex: '#f43f5e',
      nameColor: '#fb7185',
      bodyColor: '#fecdd3',
      chipBg: 'rgba(244, 63, 94, 0.14)',
      chipBorder: 'rgba(251, 113, 133, 0.35)',
    };
  }

  const baseHex =
    rawColor && rawColor.trim().startsWith('#')
      ? rawColor.trim()
      : getDeterministicFallbackColor(agentId);

  const rgb = parseHexToRgb(baseHex);
  if (!rgb) {
    return {
      avatarHex: '#22d3ee',
      nameColor: '#67e8f9',
      bodyColor: '#a5f3fc',
      chipBg: 'rgba(34, 211, 238, 0.12)',
      chipBorder: 'rgba(34, 211, 238, 0.3)',
    };
  }

  // Ensure name color has strong luminance on dark backgrounds by mixing 18% white
  const nameR = Math.round(rgb.r * 0.82 + 255 * 0.18);
  const nameG = Math.round(rgb.g * 0.82 + 255 * 0.18);
  const nameB = Math.round(rgb.b * 0.82 + 255 * 0.18);

  // Softened, readable tint for the full message body (64% agent color + 36% warm white)
  const bodyR = Math.round(rgb.r * 0.64 + 248 * 0.36);
  const bodyG = Math.round(rgb.g * 0.64 + 250 * 0.36);
  const bodyB = Math.round(rgb.b * 0.64 + 252 * 0.36);

  return {
    avatarHex: baseHex,
    nameColor: `rgb(${nameR}, ${nameG}, ${nameB})`,
    bodyColor: `rgb(${bodyR}, ${bodyG}, ${bodyB})`,
    chipBg: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.13)`,
    chipBorder: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.32)`,
  };
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
  onPlayMessageAudio,
  onListenToFullSwarm,
  onDownloadSwarmMp3,
  onCopyFullSwarm,
  onStopSwarm,
  onToggleRawJsonView,
  onCopyRawJson,
  feedEndRef,
}) => {
  const [showSpecialistCompile, setShowSpecialistCompile] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const prevMsgCountRef = useRef(messages.length);
  const streamContainerRef = useRef<HTMLDivElement | null>(null);

  // Track whether the user is near the bottom of the window or stream so we never hijack scroll
  useEffect(() => {
    const checkNearBottom = () => {
      if (!feedEndRef.current) return;
      const rect = feedEndRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const near = rect.top - viewportHeight < 220;
      setIsNearBottom(near);
      if (near) {
        setUnreadCount(0);
      }
    };

    window.addEventListener('scroll', checkNearBottom, { passive: true });
    return () => window.removeEventListener('scroll', checkNearBottom);
  }, [feedEndRef]);

  // Update unread indicator when new messages arrive while user is reading older turns
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current) {
      const added = messages.length - prevMsgCountRef.current;
      if (!isNearBottom) {
        setUnreadCount((prev) => prev + added);
      }
    } else if (messages.length === 0) {
      setUnreadCount(0);
    }
    prevMsgCountRef.current = messages.length;
  }, [messages.length, isNearBottom]);

  const handleJumpToLatest = () => {
    setUnreadCount(0);
    setIsNearBottom(true);
    feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  };

  const scrollToMessageById = (targetId: string) => {
    const el = document.getElementById(`parallax-msg-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-1', 'ring-cyan-400/70', 'bg-cyan-500/[0.08]');
      setTimeout(() => {
        el.classList.remove('ring-1', 'ring-cyan-400/70', 'bg-cyan-500/[0.08]');
      }, 2200);
    }
  };

  // Resolve consistent color map per agent across the session
  const agentColorLookup = useMemo(() => {
    const map = new Map<string, string>();
    Object.values(agents || {}).forEach((ag) => {
      if (ag && ag.id && ag.accentColor) {
        map.set(ag.id.toLowerCase(), ag.accentColor);
      }
    });
    if (specialistDeliberation?.allSpecialists) {
      specialistDeliberation.allSpecialists.forEach((sp) => {
        if (sp && sp.id && sp.accentColor) {
          map.set(sp.id.toLowerCase(), sp.accentColor);
        }
      });
    }
    messages.forEach((m) => {
      const key = m.agentId.toLowerCase();
      if (!map.has(key) && m.accentColor) {
        map.set(key, m.accentColor);
      }
    });
    return map;
  }, [agents, specialistDeliberation, messages]);

  const totalFilteredCount = useMemo(() => {
    return messages.filter((m) => {
      if (roundFilter !== 'all' && m.round !== roundFilter) return false;
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
    }).length;
  }, [messages, roundFilter, selectedAgentFilter, groupFilter]);

  return (
    <div
      id="parallax-live-feed-container"
      ref={streamContainerRef}
      className="relative py-2 min-w-0 select-text"
    >
      {/* Compact Sticky Live Chat Header & Filter Bar */}
      <div
        id="parallax-feed-toolbar"
        className="sticky top-0 z-30 bg-[#080c14]/90 backdrop-blur-xl border-b border-white/[0.07] py-2.5 px-2.5 sm:px-3.5 rounded-t-xl mb-3"
      >
        <div className="flex items-center justify-between flex-wrap gap-2">
          {/* Left: Live Chat Status & Turn Count */}
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-mono font-bold tracking-wide uppercase ${
                isRunning
                  ? 'text-cyan-300'
                  : wasStoppedEarly
                  ? 'text-rose-300'
                  : 'text-emerald-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isRunning
                    ? 'bg-cyan-400 animate-ping'
                    : wasStoppedEarly
                    ? 'bg-rose-400'
                    : 'bg-emerald-400'
                }`}
              />
              <span>{isRunning ? 'Live Swarm Chat' : 'Swarm Chat Stream'}</span>
            </span>

            <span className="text-white/20" aria-hidden="true">·</span>

            <span className="text-[11px] font-mono text-slate-300 tabular-nums">
              {totalFilteredCount === messages.length
                ? `${messages.length} turns`
                : `${totalFilteredCount}/${messages.length} turns`}
              {currentRound ? ` · R${currentRound}/3` : ''}
            </span>

            {wasStoppedEarly && (
              <span className="text-[10px] font-mono text-rose-300 font-semibold">
                · Stopped Early
              </span>
            )}

            {fullSwarmProgress && (
              <span className="text-[10px] font-mono text-cyan-300 flex items-center gap-1 tabular-nums">
                <Loader2 size={11} className="animate-spin" />
                <span>Audio {fullSwarmProgress.current}/{fullSwarmProgress.total}</span>
              </span>
            )}
          </div>

          {/* Right: Compact Action Controls */}
          <div
            id="parallax-feed-actions-cluster"
            className="flex items-center gap-1.5 flex-wrap font-mono text-[11px]"
          >
            {isRunning && (
              <button
                type="button"
                onClick={onStopSwarm}
                className="min-h-[30px] px-2.5 py-1 rounded-lg bg-rose-500/20 border border-rose-500/35 text-rose-200 font-semibold hover:bg-rose-500/30 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
              >
                <Square size={10} fill="currentColor" />
                <span>Stop</span>
              </button>
            )}

            {messages.length > 0 && (
              <button
                id="parallax-listen-full-swarm-btn"
                type="button"
                onClick={onListenToFullSwarm}
                disabled={loadingAudioKey === 'full_swarm'}
                className="min-h-[30px] px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-200 hover:bg-cyan-500/25 active:scale-95 transition-all cursor-pointer flex items-center gap-1 font-semibold"
              >
                {loadingAudioKey === 'full_swarm' ? (
                  <Loader2 size={11} className="animate-spin text-cyan-300" />
                ) : playingAudioKey === 'full_swarm' ? (
                  <Square size={10} fill="currentColor" className="text-cyan-300" />
                ) : (
                  <Play size={10} fill="currentColor" className="text-cyan-300" />
                )}
                <span>
                  {loadingAudioKey === 'full_swarm'
                    ? 'Audio...'
                    : playingAudioKey === 'full_swarm'
                    ? 'Stop Audio'
                    : 'Listen All'}
                </span>
              </button>
            )}

            {messages.length > 0 && (
              <button
                id="parallax-download-mp3-btn"
                type="button"
                onClick={onDownloadSwarmMp3}
                disabled={isDownloadingSwarmMp3}
                className="min-h-[30px] px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                title="Download full multi-voice MP3 stitched discussion"
              >
                {isDownloadingSwarmMp3 ? (
                  <Loader2 size={11} className="animate-spin text-cyan-300" />
                ) : (
                  <Download size={11} />
                )}
                <span className="hidden min-[380px]:inline">
                  {isDownloadingSwarmMp3 ? 'MP3...' : 'MP3'}
                </span>
              </button>
            )}

            {messages.length > 0 && (
              <button
                id="parallax-copy-transcript-btn"
                type="button"
                onClick={onCopyFullSwarm}
                className="min-h-[30px] px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                title="Copy entire discussion transcript"
              >
                {copiedSwarmTranscript ? (
                  <Check size={11} className="text-emerald-400" />
                ) : (
                  <Copy size={11} />
                )}
                <span className="hidden min-[380px]:inline">
                  {copiedSwarmTranscript ? 'Copied' : 'Copy'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Single-Row Scrollable Filter Bar (Rounds + Agent Groups) */}
        <div className="mt-2 pt-2 border-t border-white/[0.05] flex items-center justify-between gap-2 overflow-x-auto no-scrollbar text-[11px] font-mono">
          <div className="flex items-center gap-1 shrink-0">
            {[
              { key: 'all', label: 'All Rounds' },
              { key: 1, label: 'R1' },
              { key: 2, label: 'R2' },
              { key: 3, label: 'R3' },
            ].map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => onSetRoundFilter(r.key as typeof roundFilter)}
                className={`min-h-[26px] px-2 py-0.5 rounded-md text-[10.5px] font-semibold cursor-pointer transition-colors shrink-0 ${
                  roundFilter === r.key
                    ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {r.label}
              </button>
            ))}

            <span className="text-white/15 px-1" aria-hidden="true">|</span>

            {[
              { key: 'all', label: 'All Minds' },
              { key: 'facts', label: 'Grounded' },
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
                className={`min-h-[26px] px-2 py-0.5 rounded-md text-[10.5px] font-semibold cursor-pointer transition-colors shrink-0 ${
                  groupFilter === c.key
                    ? 'bg-violet-500/20 text-violet-200 border border-violet-400/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {selectedAgentFilter && (
            <button
              type="button"
              onClick={() => onSetSelectedAgentFilter(null)}
              className="min-h-[26px] px-2 py-0.5 rounded-md bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 font-semibold text-[10.5px] flex items-center gap-1 shrink-0 cursor-pointer hover:bg-cyan-500/30"
              title="Clear agent filter"
            >
              <span>@{agents[selectedAgentFilter]?.name || selectedAgentFilter}</span>
              <span>✕</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Conversational Live Chat Feed */}
      <div className="relative z-20 space-y-2">
        {messages.length === 0 && !isRunning ? (
          <div className="py-12 px-4 text-center text-slate-400 font-mono text-xs">
            <Terminal size={26} className="mx-auto mb-2.5 text-cyan-400/50" />
            <h3 className="m-0 text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">
              Live Deliberation Chat Standby
            </h3>
            <p className="m-0 text-slate-400 text-xs mt-1 max-w-md mx-auto font-sans">
              Enter a research inquiry below to watch the 20-agent swarm debate in real time with agent-colored live chat turns.
            </p>
          </div>
        ) : (
          <>
            {/* Compact Collapsible Pre-Round Specialist Compilation Notice */}
            {(roundFilter === 'all' || roundFilter === 1) && specialistDeliberation && (
              <div
                id="parallax-pre-round-deliberation"
                className="rounded-xl bg-white/[0.02] border border-white/[0.06] px-3 py-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <Sparkles size={13} className="text-violet-400 shrink-0" />
                    <span className="font-mono text-[11px] font-semibold text-violet-200 truncate">
                      Round 00 · Dynamic Specialists Recruited (
                      {specialistDeliberation.allSpecialists?.map((s) => s.name).join(', ') || '3 Specialists'})
                    </span>
                  </div>
                  {specialistDeliberation.opinions && specialistDeliberation.opinions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowSpecialistCompile((prev) => !prev)}
                      className="text-[10.5px] font-mono text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <span>{showSpecialistCompile ? 'Hide Nominations' : 'View Nominations'}</span>
                      {showSpecialistCompile ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  )}
                </div>

                {showSpecialistCompile && specialistDeliberation.opinions && (
                  <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1.5">
                    {specialistDeliberation.opinions.map((op, idx) => {
                      const opColors = getAgentLiveChatColors(op.accentColor, op.agentId, false, false);
                      return (
                        <div key={idx} className="text-[11.5px] leading-snug flex items-baseline gap-1.5 flex-wrap">
                          <span className="font-bold font-mono text-[11px]" style={{ color: opColors.nameColor }}>
                            {op.emoji} {op.agentName}:
                          </span>
                          <span style={{ color: opColors.bodyColor }}>
                            Nominated <strong>{op.suggestedSpecialist}</strong> — &ldquo;{op.reason}&rdquo;
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Live Chat Stream Grouped by Subtle Round Separators */}
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

              const roundTitle =
                roundNum === 1
                  ? 'Round 01 · Thesis & Initial Grounding'
                  : roundNum === 2
                  ? 'Round 02 · Cross-Examination & Rebuttals'
                  : 'Round 03 · Final Convergence';

              return (
                <div
                  key={roundNum}
                  id={`parallax-round-section-${roundNum}`}
                  className="space-y-0.5"
                >
                  {/* Subtle, Compact Round Transition Separator */}
                  <div className="flex items-center justify-between gap-2 py-2 px-2 my-1 border-y border-white/[0.06] bg-white/[0.015] text-[10.5px] sm:text-[11px] font-mono text-slate-400">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isRunning && currentRound === roundNum
                            ? 'bg-cyan-400 animate-pulse'
                            : 'bg-slate-500'
                        }`}
                      />
                      <span className="font-semibold text-slate-200 truncate">{roundTitle}</span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="tabular-nums text-slate-400">{roundMsgs.length} turns</span>
                    </div>
                  </div>

                  {/* Flowing Live Chat Rows (All turns rendered automatically) */}
                  <div className="space-y-0.5">
                    {roundMsgs.map((msg) => {
                      const isVoicePlaying = playingAudioKey === msg.id;
                      const isVoiceLoading = loadingAudioKey === msg.id;
                      const isHuman = Boolean(msg.isHuman || msg.agentId === 'human');
                      const isDevilsAdvocate = Boolean(
                        msg.isDevilsAdvocate || msg.agentId === 'devils_advocate',
                      );

                      const configuredColor =
                        agentColorLookup.get(msg.agentId.toLowerCase()) || msg.accentColor;

                      const colors = getAgentLiveChatColors(
                        configuredColor,
                        msg.agentId || msg.agentName,
                        isHuman,
                        isDevilsAdvocate,
                      );

                      const cleanRole =
                        msg.role ||
                        agents[msg.agentId]?.role ||
                        (isHuman
                          ? 'Operator Directive'
                          : isDevilsAdvocate
                          ? 'Contrarian Stress-Test'
                          : 'AI Specialist');

                      const rawConv =
                        typeof msg.conviction === 'number'
                          ? msg.conviction
                          : typeof (msg as { convictionScore?: number }).convictionScore === 'number'
                          ? (msg as { convictionScore?: number }).convictionScore!
                          : null;

                      const convictionDisplay =
                        rawConv !== null
                          ? rawConv <= 10
                            ? `${rawConv}/10`
                            : `${Math.round(rawConv)}%`
                          : null;

                      return (
                        <div
                          key={msg.id}
                          id={`parallax-msg-${msg.id}`}
                          className={`group relative py-2 px-2 sm:px-3 rounded-xl transition-colors scroll-mt-24 ${
                            isVoicePlaying
                              ? 'bg-cyan-500/[0.09] ring-1 ring-cyan-400/30'
                              : isHuman
                              ? 'bg-amber-500/[0.07] hover:bg-amber-500/[0.11]'
                              : isDevilsAdvocate
                              ? 'bg-rose-500/[0.07] hover:bg-rose-500/[0.11]'
                              : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            {/* Left: Compact Agent Identity Avatar */}
                            <button
                              type="button"
                              onClick={() =>
                                onSetSelectedAgentFilter(
                                  selectedAgentFilter === msg.agentId ? null : msg.agentId,
                                )
                              }
                              className="mt-0.5 shrink-0 cursor-pointer focus:outline-none"
                              title={`Filter stream by ${msg.agentName}`}
                            >
                              {isHuman ? (
                                <div
                                  className="w-7 h-7 rounded-lg grid place-items-center text-amber-300 shrink-0"
                                  style={{
                                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                                    border: '1px solid rgba(251, 191, 36, 0.5)',
                                  }}
                                >
                                  <User size={14} />
                                </div>
                              ) : isDevilsAdvocate ? (
                                <div
                                  className="w-7 h-7 rounded-lg grid place-items-center text-rose-300 shrink-0"
                                  style={{
                                    backgroundColor: 'rgba(244, 63, 94, 0.2)',
                                    border: '1px solid rgba(251, 113, 133, 0.5)',
                                  }}
                                >
                                  <Flame size={14} />
                                </div>
                              ) : (
                                <ParallaxAgentAvatar
                                  agentId={msg.agentId}
                                  agentName={msg.agentName}
                                  accentColor={colors.avatarHex}
                                  size="sm"
                                />
                              )}
                            </button>

                            {/* Right: Flowing Agent Header + Full Colored Message Body */}
                            <div className="min-w-0 flex-1">
                              {/* Compact Identity & Secondary Metadata Line */}
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                                  {/* Agent Name in Prominent Accent Color */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onSetSelectedAgentFilter(
                                        selectedAgentFilter === msg.agentId ? null : msg.agentId,
                                      )
                                    }
                                    className="font-bold text-[12.5px] sm:text-[13.5px] tracking-tight hover:underline cursor-pointer text-left break-words"
                                    style={{ color: colors.nameColor }}
                                  >
                                    {msg.agentName}
                                  </button>

                                  {msg.mood && (
                                    <span className="text-xs leading-none" aria-hidden="true">
                                      {msg.mood}
                                    </span>
                                  )}

                                  {msg.sideLabel && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-mono font-bold uppercase tracking-wider border leading-none ${
                                        msg.side === 'prosecution' ||
                                        msg.side === 'red' ||
                                        msg.side === 'security' ||
                                        msg.side === 'risk'
                                          ? 'bg-rose-500/15 border-rose-500/35 text-rose-300'
                                          : msg.side === 'defense' ||
                                            msg.side === 'blue' ||
                                            msg.side === 'innovation' ||
                                            msg.side === 'tech'
                                          ? 'bg-sky-500/15 border-sky-500/35 text-sky-300'
                                          : msg.side === 'judge' ||
                                            msg.side === 'economy' ||
                                            msg.side === 'finance'
                                          ? 'bg-amber-500/15 border-amber-500/35 text-amber-300'
                                          : msg.side === 'referee'
                                          ? 'bg-purple-500/15 border-purple-500/35 text-purple-300'
                                          : 'bg-emerald-500/15 border-emerald-500/35 text-emerald-300'
                                      }`}
                                    >
                                      {msg.sideLabel}
                                    </span>
                                  )}

                                  {/* Special Identity Classification */}
                                  {isHuman ? (
                                    <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-amber-300">
                                      · Directive
                                    </span>
                                  ) : isDevilsAdvocate ? (
                                    <span className="text-[9.5px] font-mono font-bold uppercase tracking-wider text-rose-300 inline-flex items-center gap-0.5">
                                      <ShieldAlert size={10} />
                                      <span>Contrarian</span>
                                    </span>
                                  ) : msg.isDynamic ? (
                                    <span className="text-[9.5px] font-mono font-semibold text-violet-300">
                                      · Specialist
                                    </span>
                                  ) : null}

                                  {/* Subtle Role, Round, Conviction & Timestamp */}
                                  <span className="text-[10.5px] text-slate-400 font-sans truncate max-w-[160px] sm:max-w-[240px]">
                                    · {cleanRole}
                                  </span>

                                  {convictionDisplay && !isHuman && (
                                    <span
                                      className="text-[10px] font-mono font-semibold tabular-nums"
                                      style={{ color: colors.nameColor }}
                                      title="Agent conviction score"
                                    >
                                      · {convictionDisplay}
                                    </span>
                                  )}

                                  <span className="text-[10px] font-mono text-slate-500 tabular-nums">
                                    · R{msg.round} ·{' '}
                                    {new Date(msg.timestamp).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                    })}
                                  </span>
                                </div>

                                {/* Compact Unobtrusive Message Actions (Voice + JSON) */}
                                <div className="flex items-center gap-1 shrink-0">
                                  {!isHuman && (
                                    <button
                                      type="button"
                                      onClick={() => onPlayMessageAudio(msg)}
                                      disabled={isVoiceLoading}
                                      className={`min-h-[26px] px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold cursor-pointer transition-colors flex items-center gap-1 ${
                                        isVoicePlaying
                                          ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40'
                                          : 'bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 hover:text-white'
                                      }`}
                                      title={isVoicePlaying ? 'Stop voice playback' : 'Play agent voice'}
                                    >
                                      {isVoiceLoading ? (
                                        <Loader2 size={10} className="animate-spin text-cyan-300" />
                                      ) : isVoicePlaying ? (
                                        <Square size={9} fill="currentColor" />
                                      ) : (
                                        <Volume2 size={11} />
                                      )}
                                      <span>{isVoicePlaying ? 'Speaking' : 'Voice'}</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => onToggleRawJsonView(msg.id)}
                                    className={`min-h-[26px] px-1.5 py-0.5 rounded-lg text-[10px] font-mono cursor-pointer transition-colors flex items-center gap-1 ${
                                      rawJsonOpenMap[msg.id]
                                        ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                                        : 'bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white'
                                    }`}
                                    title="Inspect message metadata & raw JSON"
                                  >
                                    <Code2 size={11} />
                                  </button>
                                </div>
                              </div>

                              {/* Compact Cross-Examination Reference Link (Round 2) */}
                              {msg.replyToAgentName && (
                                <div className="mt-0.5 mb-0.5 flex items-center gap-1.5 flex-wrap text-[11px] font-mono text-slate-400">
                                  <CornerDownRight size={11} style={{ color: colors.nameColor }} className="shrink-0" />
                                  <span>
                                    Rebutting{' '}
                                    <strong style={{ color: colors.nameColor }}>
                                      @{msg.replyToAgentName}
                                    </strong>
                                  </span>
                                  {msg.replyToMessageId && (
                                    <button
                                      type="button"
                                      onClick={() => scrollToMessageById(msg.replyToMessageId!)}
                                      className="text-[10.5px] text-cyan-300 hover:underline cursor-pointer"
                                    >
                                      (jump to turn ↗)
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Compact VERITAS Grounding Citation (when toolUsed is present) */}
                              {msg.toolUsed && (
                                <div
                                  className="my-1 px-2.5 py-1.5 rounded-lg text-[11px] font-sans space-y-0.5"
                                  style={{
                                    backgroundColor: colors.chipBg,
                                    border: `1px solid ${colors.chipBorder}`,
                                  }}
                                >
                                  <div
                                    className="flex items-center gap-1.5 font-mono text-[10px] font-semibold flex-wrap"
                                    style={{ color: colors.nameColor }}
                                  >
                                    <Search size={10} className="shrink-0" />
                                    <span>
                                      Grounded via {msg.toolUsed.searchSource || 'Live Search'}
                                      {typeof msg.toolUsed.sourcesCount === 'number'
                                        ? ` (${msg.toolUsed.sourcesCount} sources)`
                                        : ''}
                                    </span>
                                  </div>
                                  {msg.toolUsed.committedFact && (
                                    <p
                                      className="m-0 text-[11px] italic leading-snug break-words"
                                      style={{ color: colors.bodyColor }}
                                    >
                                      &ldquo;{msg.toolUsed.committedFact}&rdquo;
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* Complete Message Body Rendered in the Agent's Recognizable Color */}
                              <div
                                className="mt-0.5 text-[13px] sm:text-[14px] font-sans leading-[1.56] whitespace-pre-wrap break-words"
                                style={{ color: colors.bodyColor }}
                              >
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

                                    const targetAccent = targetMsg
                                      ? agentColorLookup.get(targetMsg.agentId.toLowerCase()) ||
                                        targetMsg.accentColor
                                      : undefined;
                                    const targetColors = targetAccent
                                      ? getAgentLiveChatColors(
                                          targetAccent,
                                          targetMsg?.agentId || targetName,
                                          false,
                                          false,
                                        )
                                      : colors;

                                    return (
                                      <button
                                        key={pIdx}
                                        type="button"
                                        onClick={() => {
                                          if (targetMsg) {
                                            scrollToMessageById(targetMsg.id);
                                          }
                                        }}
                                        className="inline-flex items-center px-1.5 py-0 rounded-md font-mono text-[12px] font-bold cursor-pointer hover:underline mx-0.5 align-baseline"
                                        style={{
                                          color: targetColors.nameColor,
                                          backgroundColor: targetColors.chipBg,
                                          border: `1px solid ${targetColors.chipBorder}`,
                                        }}
                                        title={
                                          targetMsg
                                            ? `Jump to @${targetName}'s turn in Round ${targetMsg.round}`
                                            : `Referencing @${targetName}`
                                        }
                                      >
                                        {part}
                                      </button>
                                    );
                                  }
                                  return <span key={pIdx}>{part}</span>;
                                })}
                              </div>

                              {/* Expandable Metadata & Raw JSON Inspection Drawer */}
                              {rawJsonOpenMap[msg.id] && (
                                <div className="mt-2 p-2.5 rounded-xl bg-[#050811]/95 border border-white/10 font-mono text-[10px] space-y-1.5">
                                  <div className="flex items-center justify-between gap-2 flex-wrap text-slate-300 border-b border-white/[0.06] pb-1.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-bold text-white">{msg.id}</span>
                                      {msg.model && <span>· Model: {msg.model}</span>}
                                      {msg.providerName && <span>· Provider: {msg.providerName}</span>}
                                      {typeof msg.durationMs === 'number' && (
                                        <span>· {(msg.durationMs / 1000).toFixed(1)}s</span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={(e) =>
                                        onCopyRawJson(JSON.stringify(msg, null, 2), msg.id, e)
                                      }
                                      className="text-cyan-300 hover:text-cyan-200 flex items-center gap-1 cursor-pointer font-semibold"
                                    >
                                      {copiedRawJsonId === msg.id ? (
                                        <Check size={10} className="text-emerald-400" />
                                      ) : (
                                        <Copy size={10} />
                                      )}
                                      <span>{copiedRawJsonId === msg.id ? 'Copied' : 'Copy JSON'}</span>
                                    </button>
                                  </div>
                                  <pre className="m-0 overflow-x-auto text-cyan-200/90 max-h-48 text-[10px] leading-relaxed">
                                    {JSON.stringify(msg, null, 2)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Subtle Live Activity Footer when Swarm is Running */}
            {isRunning && (
              <div className="py-2 px-3 flex items-center gap-2 text-[11px] font-mono text-cyan-300/90">
                <Radio size={12} className="animate-pulse text-cyan-400 shrink-0" />
                <span>
                  Streaming live agent responses in Round 0{currentRound || 1}...
                </span>
              </div>
            )}
          </>
        )}

        {/* Non-Intrusive Jump-to-Latest Pill when user scrolls up */}
        {unreadCount > 0 && (
          <div className="sticky bottom-3 z-30 flex justify-center pointer-events-none">
            <button
              type="button"
              onClick={handleJumpToLatest}
              className="pointer-events-auto px-3.5 py-1.5 rounded-full bg-cyan-500 text-slate-950 font-mono text-xs font-bold shadow-[0_4px_20px_rgba(6,182,212,0.4)] hover:bg-cyan-400 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ArrowDown size={13} />
              <span>
                {unreadCount} new {unreadCount === 1 ? 'message' : 'messages'} · Jump to latest
              </span>
            </button>
          </div>
        )}

        <div ref={feedEndRef} />
      </div>
    </div>
  );
};

