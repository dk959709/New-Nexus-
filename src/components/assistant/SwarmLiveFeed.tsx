import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Square, X, Radio, Loader2, AlertCircle, CheckCircle2, Users, Copy, Check } from 'lucide-react';
import { storage, DEFAULT_PARALLAX_AGENTS } from '@/lib/storage';
import { AGENT_QUADRANTS } from '@/data/parallaxQuadrants';
import { runParallaxSwarm } from '@/services/parallaxOrchestrator';
import { ParallaxAgentAvatar } from '@/components/parallax/ParallaxAgentIcon';
import type { ParallaxMessage, ParallaxSummary, ParallaxAgentConfig, ParallaxEvidenceItem } from '@/types';

interface SwarmLiveFeedProps {
  topic: string;
  onClose?: () => void;
  evidenceItems?: ParallaxEvidenceItem[];
  savedState?: {
    messages: ParallaxMessage[];
    status: 'completed' | 'aborted' | 'error';
    summary?: ParallaxSummary | null;
    errorMessage?: string | null;
    evidenceItems?: ParallaxEvidenceItem[];
  };
  onStateChange?: (state: {
    messages: ParallaxMessage[];
    status: 'running' | 'completed' | 'aborted' | 'error';
    summary?: ParallaxSummary | null;
    errorMessage?: string | null;
    evidenceItems?: ParallaxEvidenceItem[];
  }) => void;
}

function getAgentQuadrantColor(agentId: string): string {
  const rawId = (agentId || '').toLowerCase();
  const stripped = rawId.replace(/[-_]/g, '');
  const info = AGENT_QUADRANTS[stripped] || AGENT_QUADRANTS[rawId];

  if (!info) {
    return '#38bdf8'; // Sky/Cyan for dynamic/unmapped
  }

  switch (info.quadrant) {
    case 'optimists':
      return '#22d3ee'; // cyan-400
    case 'realists':
      return '#fbbf24'; // amber-400
    case 'ethicists':
      return '#a78bfa'; // violet-400
    case 'visionaries':
      return '#f472b6'; // pink-400
    case 'anchors':
      return '#f4f4f5'; // white/zinc-100
    default:
      return '#38bdf8';
  }
}

export const SwarmLiveFeed: React.FC<SwarmLiveFeedProps> = ({
  topic,
  onClose,
  evidenceItems: initialEvidenceItems,
  savedState,
  onStateChange,
}) => {
  const [messages, setMessages] = useState<ParallaxMessage[]>(() => savedState?.messages || []);
  const [evidenceItems, setEvidenceItems] = useState<ParallaxEvidenceItem[]>(
    () => initialEvidenceItems || savedState?.evidenceItems || []
  );
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'aborted' | 'error'>(
    () => (savedState ? savedState.status : 'running'),
  );
  const [currentRound, setCurrentRound] = useState<number>(() => {
    if (savedState?.messages && savedState.messages.length > 0) {
      const maxR = Math.max(...savedState.messages.map((m) => m.round || 1));
      return Math.min(Math.max(maxR, 1), 3);
    }
    return 1;
  });
  const [statusText, setStatusText] = useState<string>(() => {
    if (savedState) {
      if (savedState.status === 'completed') return 'Swarm debate completed.';
      if (savedState.status === 'aborted') return 'Swarm stopped by user.';
      if (savedState.status === 'error')
        return savedState.errorMessage ? `Error: ${savedState.errorMessage}` : 'Error during debate.';
    }
    return 'Initializing Parallax Swarm...';
  });
  const [summary, setSummary] = useState<ParallaxSummary | null>(() => savedState?.summary || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(() => savedState?.errorMessage || null);
  const [copied, setCopied] = useState<boolean>(false);
  const [totalAgentsCount, setTotalAgentsCount] = useState<number>(() => {
    if (savedState?.messages && savedState.messages.length > 0) {
      const unique = new Set(savedState.messages.map((m) => m.agentId));
      if (unique.size > 0) return unique.size;
    }
    try {
      const cfg = storage.getParallaxConfig();
      const enabled = Object.values(cfg.agents || DEFAULT_PARALLAX_AGENTS).filter((a) => a.enabled !== false);
      return enabled.length || 20;
    } catch {
      return 20;
    }
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isNearBottomRef = useRef<boolean>(true);
  const messagesRef = useRef<ParallaxMessage[]>(messages);
  messagesRef.current = messages;

  const evidenceItemsRef = useRef<ParallaxEvidenceItem[]>(evidenceItems);
  evidenceItemsRef.current = evidenceItems;

  const statusRef = useRef(status);
  statusRef.current = status;

  const summaryRef = useRef(summary);
  summaryRef.current = summary;

  const errorMessageRef = useRef(errorMessage);
  errorMessageRef.current = errorMessage;

  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 80;
    const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    isNearBottomRef.current = isBottom;
  }, []);

  const scrollToBottom = useCallback((smooth = true) => {
    if (scrollContainerRef.current && isNearBottomRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto',
      });
    }
  }, []);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, statusText, currentRound, summary, scrollToBottom]);

  // Execute swarm on mount (ONLY when savedState is NOT provided)
  useEffect(() => {
    if (savedState) {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setStatus('running');
    setErrorMessage(null);
    setSummary(null);

    const parallaxConfig = storage.getParallaxConfig();

    runParallaxSwarm({
      topic,
      config: parallaxConfig,
      signal: controller.signal,
      onEvidencePoolReady: (pool) => {
        const items = pool.evidenceItems || [];
        setEvidenceItems(items);
        evidenceItemsRef.current = items;
        if (onStateChangeRef.current) {
          onStateChangeRef.current({
            messages: messagesRef.current,
            status: 'running',
            summary: null,
            errorMessage: null,
            evidenceItems: items,
          });
        }
      },
      onStatusUpdate: (msg) => {
        setStatusText(msg);
      },
      onRoundStart: (round) => {
        setCurrentRound(round);
      },
      onDynamicPersonasCreated: (dynamicSpecialists: ParallaxAgentConfig[]) => {
        const enabledCore = Object.values(parallaxConfig.agents || DEFAULT_PARALLAX_AGENTS).filter(
          (a) => a.enabled !== false,
        );
        setTotalAgentsCount(enabledCore.length + (dynamicSpecialists?.length || 0));
      },
      onMessage: (msg: ParallaxMessage) => {
        setMessages((prev) => {
          const updated = [...prev, msg];
          messagesRef.current = updated;
          if (onStateChangeRef.current) {
            onStateChangeRef.current({
              messages: updated,
              status: 'running',
              summary: null,
              errorMessage: null,
              evidenceItems: evidenceItemsRef.current,
            });
          }
          return updated;
        });
      },
      onComplete: (completedSummary: ParallaxSummary) => {
        setSummary(completedSummary);
        setStatus('completed');
        setStatusText('Swarm debate completed successfully.');
        if (onStateChangeRef.current) {
          onStateChangeRef.current({
            messages: messagesRef.current,
            status: 'completed',
            summary: completedSummary,
            errorMessage: null,
            evidenceItems: evidenceItemsRef.current,
          });
        }
      },
      onError: (errText: string) => {
        if (controller.signal.aborted) {
          setStatus('aborted');
          setStatusText('Swarm stopped by user.');
          if (onStateChangeRef.current) {
            onStateChangeRef.current({
              messages: messagesRef.current,
              status: 'aborted',
              summary: null,
              errorMessage: null,
              evidenceItems: evidenceItemsRef.current,
            });
          }
        } else {
          setErrorMessage(errText);
          setStatus('error');
          setStatusText(`Error: ${errText}`);
          if (onStateChangeRef.current) {
            onStateChangeRef.current({
              messages: messagesRef.current,
              status: 'error',
              summary: null,
              errorMessage: errText,
              evidenceItems: evidenceItemsRef.current,
            });
          }
        }
      },
    }).catch((err: unknown) => {
      if (controller.signal.aborted) {
        setStatus('aborted');
        setStatusText('Swarm stopped by user.');
        if (onStateChangeRef.current) {
          onStateChangeRef.current({
            messages: messagesRef.current,
            status: 'aborted',
            summary: null,
            errorMessage: null,
            evidenceItems: evidenceItemsRef.current,
          });
        }
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
        setStatus('error');
        if (onStateChangeRef.current) {
          onStateChangeRef.current({
            messages: messagesRef.current,
            status: 'error',
            summary: null,
            errorMessage: msg,
            evidenceItems: evidenceItemsRef.current,
          });
        }
      }
    });

    return () => {
      controller.abort();
    };
  }, [topic, savedState]);

  const handleStop = () => {
    if (abortControllerRef.current && status === 'running') {
      abortControllerRef.current.abort();
      setStatus('aborted');
      setStatusText('Swarm stopped by user.');
      if (onStateChangeRef.current) {
        onStateChangeRef.current({
          messages: messagesRef.current,
          status: 'aborted',
          summary: null,
          errorMessage: null,
          evidenceItems: evidenceItemsRef.current,
        });
      }
    }
  };

  const handleCopyAll = async () => {
    if (messages.length === 0 && !summary) return;

    const exportTimestamp = messages[0]?.timestamp
      ? new Date(messages[0].timestamp).toLocaleString()
      : new Date().toLocaleString();

    const sections: string[] = [];

    // 1. Header Metadata with Date/Time and Query
    sections.push(
      `═══════════════════════════════════════════════════\n` +
      `✦ PARALLAX MULTI-AGENT SWARM DELIBERATION\n` +
      `═══════════════════════════════════════════════════\n` +
      `Date & Time  : ${exportTimestamp}\n` +
      `Topic / Query: ${topic}\n` +
      `Status       : ${status.toUpperCase()}\n` +
      `Total Turns  : ${messages.length}\n` +
      `═══════════════════════════════════════════════════`
    );

    // 2. Evidence Sources (up to 10 sources)
    const rawSources =
      evidenceItems && evidenceItems.length > 0
        ? evidenceItems
        : summary?.evidenceSources
        ? summary.evidenceSources.map((s, idx) => ({
            id: `s_${idx}`,
            title: s.title,
            url: s.url,
            domain: s.domain,
          }))
        : [];

    const validSources = rawSources.filter((s) => s && s.title && (s.url || s.domain)).slice(0, 10);
    if (validSources.length > 0) {
      const sourceLines = validSources
        .map((s, idx) => {
          const domainStr = s.domain ? ` (${s.domain})` : '';
          const urlStr = s.url ? ` - ${s.url}` : '';
          return `${idx + 1}. ${s.title}${domainStr}${urlStr}`;
        })
        .join('\n');

      sections.push(
        `--- EVIDENCE SOURCES (${validSources.length}) ---\n\n${sourceLines}`
      );
    }

    // 3. Deliberation Transcript
    if (messages.length > 0) {
      sections.push(
        `--- DELIBERATION TRANSCRIPT ---\n\n` +
        messages
          .map((m) => {
            const roleInfo = m.role ? ` (${m.role})` : '';
            const roundTag = m.round ? `[R${m.round}] ` : '';
            const convictionTag = m.conviction !== undefined ? ` [${m.conviction}/10${m.mood ? ` ${m.mood}` : ''}]` : '';
            return `${roundTag}${m.agentName}${roleInfo}${convictionTag}:\n${m.text}`;
          })
          .join('\n\n')
      );
    }

    // 4. Final Summary & Swarm Consensus
    if (summary) {
      const rawVerdict =
        summary.verdict ||
        (summary as unknown as { synthesisVerdict?: string }).synthesisVerdict ||
        (summary as unknown as { overallVerdict?: string }).overallVerdict ||
        'Debate complete.';
      const highlightsList =
        summary.highlights ||
        (summary as unknown as { keyHighlights?: string[] }).keyHighlights ||
        [];

      let summarySection =
        `═══════════════════════════════════════════════════\n` +
        `✦ FINAL SWARM CONSENSUS\n` +
        `═══════════════════════════════════════════════════\n` +
        (summary.consensusLean ? `Consensus Lean: ${summary.consensusLean}\n\n` : '') +
        `Verdict:\n${rawVerdict}`;

      if (highlightsList.length > 0) {
        summarySection += `\n\nKey Highlights:\n` + highlightsList.map((h) => `• ${h}`).join('\n');
      }

      if (summary.verifiedClaims && summary.verifiedClaims.length > 0) {
        summarySection +=
          `\n\nVerified Empirical Claims:\n` +
          summary.verifiedClaims.map((c) => `• [${c.status}] ${c.claimText}`).join('\n');
      }

      sections.push(summarySection);
    }

    const fullExportText = sections.join('\n\n');

    try {
      await navigator.clipboard.writeText(fullExportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  };

  return (
    <div className="swarm-live-feed shrink-0 min-h-0 w-full my-3 rounded-2xl border border-zinc-800/90 bg-[#0c0d11] text-zinc-100 overflow-hidden shadow-2xl flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-300">
      <style>{`
        @media (max-width: 768px) {
          .swarm-live-feed {
            height: 320px !important;
            max-height: 40vh !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            flex-shrink: 0 !important;
            min-height: 0 !important;
          }
          .swarm-live-message {
            padding: 6px 8px !important;
            margin-bottom: 4px !important;
            font-size: 12px !important;
            line-height: 1.35 !important;
          }
          .swarm-live-avatar {
            width: 24px !important;
            height: 24px !important;
            font-size: 10px !important;
          }
          .swarm-live-agent-name {
            font-size: 11px !important;
          }
          .swarm-live-round-badge {
            font-size: 9px !important;
            padding: 1px 4px !important;
          }
          .swarm-live-conviction {
            font-size: 9px !important;
          }
          .swarm-live-header {
            padding: 8px 10px !important;
            font-size: 12px !important;
          }
          .swarm-live-status {
            font-size: 11px !important;
            padding: 6px 10px !important;
          }
          .swarm-live-summary {
            font-size: 11px !important;
            padding: 8px 10px !important;
          }
        }
      `}</style>

      {/* YouTube Live Chat Style Header Bar */}
      <div className="swarm-live-header px-3.5 py-2.5 bg-zinc-950/90 border-b border-zinc-800/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Live Status Badge */}
          {status === 'running' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold tracking-wider uppercase bg-red-950/80 text-red-400 border border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              LIVE
            </span>
          ) : status === 'completed' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold tracking-wider uppercase bg-emerald-950/80 text-emerald-400 border border-emerald-500/50">
              <CheckCircle2 size={12} />
              DEBATE COMPLETE
            </span>
          ) : status === 'aborted' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold tracking-wider uppercase bg-zinc-800 text-zinc-400 border border-zinc-700">
              STOPPED
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold tracking-wider uppercase bg-amber-950/80 text-amber-400 border border-amber-500/50">
              ERROR
            </span>
          )}

          {/* Topic & Agent Count */}
          <div className="min-w-0">
            <div className="text-xs font-semibold text-zinc-100 truncate max-w-[260px] sm:max-w-[420px]" title={topic}>
              {topic}
            </div>
            <div className="flex items-center gap-2 text-[10.5px] text-zinc-400">
              <span className="flex items-center gap-1 font-mono">
                <Users size={11} className="text-zinc-500" />
                {totalAgentsCount} Agents
              </span>
              <span className="text-zinc-700">•</span>
              <span className="font-mono text-zinc-400">Round {currentRound}/3</span>
              <span className="text-zinc-700">•</span>
              <span className="text-zinc-400">{messages.length} messages</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5">
          {/* Copy All Button */}
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleCopyAll}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex items-center gap-1 text-xs"
              title="Copy all debate messages"
              aria-label="Copy all messages"
            >
              {copied ? (
                <>
                  <Check size={13} className="text-emerald-400" />
                  <span className="text-[11px] text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <Copy size={13} />
              )}
            </button>
          )}

          {status === 'running' && (
            <button
              type="button"
              onClick={handleStop}
              className="px-2.5 py-1 rounded-lg border border-red-500/40 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
              title="Stop live swarm"
            >
              <Square size={11} className="fill-current" />
              <span>Stop</span>
            </button>
          )}

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
              title="Close live feed"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Live Stream Status Ticker */}
      {status === 'running' && (
        <div className="swarm-live-status px-3.5 py-1.5 bg-zinc-900/40 border-b border-zinc-800/40 flex items-center gap-2 text-[11px] text-zinc-400 truncate">
          <Loader2 size={12} className="animate-spin text-red-400 shrink-0" />
          <span className="truncate">{statusText}</span>
        </div>
      )}

      {/* Scrollable Live Chat Feed */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 max-h-[460px] overflow-y-auto p-3.5 space-y-2.5 bg-[#090a0d] scroll-smooth min-h-0"
      >
        {messages.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-500 space-y-2">
            <Radio size={24} className="text-red-500/60 animate-pulse" />
            <p className="text-xs">Connecting to Parallax 20+ Agent Swarm...</p>
            <p className="text-[11px] text-zinc-600">Agents will begin posting live perspectives momentarily.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const nameColor = getAgentQuadrantColor(msg.agentId);
              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="swarm-live-message flex items-start gap-2.5 text-xs group/msg"
                >
                  {/* Avatar with icon/initial */}
                  <div className="swarm-live-avatar shrink-0 pt-0.5">
                    <ParallaxAgentAvatar
                      agentId={msg.agentId}
                      agentName={msg.agentName}
                      accentColor={msg.accentColor || nameColor}
                      size="sm"
                    />
                  </div>

                  {/* Message Bubble */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span
                        className="swarm-live-agent-name font-bold tracking-tight text-[12px]"
                        style={{ color: nameColor }}
                      >
                        {msg.agentName}
                      </span>

                      {msg.role && (
                        <span className="text-[10px] text-zinc-500 font-normal truncate max-w-[150px] hidden sm:inline">
                          {msg.role}
                        </span>
                      )}

                      {/* Round Badge */}
                      <span className="swarm-live-round-badge px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-zinc-800/90 text-zinc-300 border border-zinc-700/60">
                        R{msg.round}
                      </span>

                      {/* Conviction & Mood */}
                      {msg.conviction !== undefined && (
                        <span className="swarm-live-conviction text-[10px] text-zinc-500 font-mono">
                          [{msg.conviction}/10{msg.mood ? ` ${msg.mood}` : ''}]
                        </span>
                      )}
                    </div>

                    <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-[13px] text-zinc-200 leading-relaxed break-words shadow-sm">
                      {msg.text}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}

        {/* Inline Error Message */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 text-red-300 text-xs flex items-center gap-2 mt-2">
            <AlertCircle size={14} className="text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Full Text Swarm Consensus Summary (Matching Chat Assistant Aesthetics) */}
        {summary && (() => {
          const rawVerdict =
            summary.verdict ||
            (summary as unknown as { synthesisVerdict?: string }).synthesisVerdict ||
            (summary as unknown as { overallVerdict?: string }).overallVerdict ||
            'Debate complete.';
          const highlightsList =
            summary.highlights ||
            (summary as unknown as { keyHighlights?: string[] }).keyHighlights ||
            [];

          return (
            <div
              className="swarm-live-summary static z-auto mt-3 p-3.5 rounded-xl bg-zinc-950/95 border border-zinc-800/90 text-[13px] text-zinc-200 leading-relaxed shadow-sm space-y-2.5"
              style={{
                position: 'static',
                zIndex: 'auto',
                borderTop: '2px solid rgba(97, 215, 201, 0.4)',
              }}
            >
              {/* Header Bar with Badges */}
              <div className="flex items-center gap-1.5 font-semibold text-[#61d7c9] text-xs tracking-wide flex-wrap">
                <span className="text-[#61d7c9]">✦</span>
                <span>Swarm Consensus</span>

                {summary.groundingLevel && (
                  <span className={`text-[9.5px] font-mono font-semibold px-1.5 py-0.2 rounded border uppercase ${
                    summary.groundingLevel === 'HIGH'
                      ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                      : summary.groundingLevel === 'REFUTED'
                      ? 'bg-red-950/60 text-red-300 border-red-500/40'
                      : summary.groundingLevel === 'SPECULATIVE'
                      ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                      : 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40'
                  }`}>
                    {summary.groundingLevel} Grounding
                  </span>
                )}

                {summary.consensusLean && (
                  <span className="text-[10px] font-mono font-normal text-zinc-300 px-1.5 py-0.5 rounded bg-zinc-800/90 border border-zinc-700/60 ml-auto">
                    {summary.consensusLean}
                  </span>
                )}
              </div>

              {/* Full Verdict */}
              <p className="text-zinc-100 break-words leading-relaxed text-[13px]">
                {rawVerdict}
              </p>

              {/* Full Key Highlights */}
              {highlightsList.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
                  <div className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Key Highlights & Agent Arguments
                  </div>
                  <div className="space-y-1.5 text-[12.5px] text-zinc-300">
                    {highlightsList.map((highlight, idx) => (
                      <div key={idx} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-[#61d7c9] shrink-0 font-bold">•</span>
                        <span>{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Verified Claims (if available) */}
              {summary.verifiedClaims && summary.verifiedClaims.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/60 space-y-1.5">
                  <div className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider">
                    Verified Empirical Claims
                  </div>
                  <div className="space-y-1 text-[12px]">
                    {summary.verifiedClaims.map((claim, idx) => (
                      <div key={idx} className="flex items-start gap-1.5 leading-snug">
                        <span className={`text-[9px] font-mono px-1 py-0.2 rounded font-semibold uppercase shrink-0 mt-0.5 border ${
                          claim.status === 'VERIFIED'
                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-500/40'
                            : claim.status === 'REFUTED'
                            ? 'bg-red-950/70 text-red-300 border-red-500/40'
                            : claim.status === 'PLAUSIBLE'
                            ? 'bg-cyan-950/70 text-cyan-300 border-cyan-500/40'
                            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                        }`}>
                          {claim.status}
                        </span>
                        <span className="text-zinc-300">{claim.claimText}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
};
