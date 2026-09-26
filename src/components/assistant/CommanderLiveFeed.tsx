import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Square,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  ExternalLink,
  Sparkles,
  Zap,
} from 'lucide-react';
import { storage } from '@/lib/storage';
import { copyToClipboard } from '@/lib/clipboard';
import { FormattedText } from '@/components/jarvis/FormattedText';
import { runCommanderPipeline } from '@/services/commanderOrchestrator';
import type {
  CommanderConfig,
  CommanderExecutionStep,
  CommanderResult,
  AISource,
} from '@/types';

export interface CommanderFeedSavedState {
  steps: CommanderExecutionStep[];
  status: 'running' | 'completed' | 'aborted' | 'error';
  result?: CommanderResult | null;
  errorMessage?: string | null;
  sources?: AISource[];
}

interface CommanderLiveFeedProps {
  topic: string;
  config?: CommanderConfig;
  savedState?: CommanderFeedSavedState;
  onStateChange?: (state: CommanderFeedSavedState) => void;
  onClose?: () => void;
}

export const CommanderLiveFeed: React.FC<CommanderLiveFeedProps> = ({
  topic,
  config: propConfig,
  savedState,
  onStateChange,
}) => {
  const [config] = useState<CommanderConfig>(() => propConfig || storage.getCommanderConfig());
  const [steps, setSteps] = useState<CommanderExecutionStep[]>(() => savedState?.steps || []);
  const [status, setStatus] = useState<'running' | 'completed' | 'aborted' | 'error'>(
    () => savedState?.status || 'running',
  );
  const [result, setResult] = useState<CommanderResult | null>(() => savedState?.result || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    () => savedState?.errorMessage || null,
  );
  const [sources, setSources] = useState<AISource[]>(() => savedState?.sources || []);
  const [copied, setCopied] = useState<boolean>(false);

  // Collapsible sections
  const [detailsOpen, setDetailsOpen] = useState<boolean>(true);
  const [alphaOpen, setAlphaOpen] = useState<boolean>(false);
  const [betaOpen, setBetaOpen] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const onStateChangeRef = useRef(onStateChange);
  onStateChangeRef.current = onStateChange;

  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;

  const configRef = useRef(config);
  configRef.current = config;

  const emitStateChange = useCallback(
    (
      newStatus: 'running' | 'completed' | 'aborted' | 'error',
      newSteps: CommanderExecutionStep[],
      newResult?: CommanderResult | null,
      newError?: string | null,
      newSources?: AISource[],
    ) => {
      onStateChangeRef.current?.({
        status: newStatus,
        steps: newSteps,
        result: newResult ?? null,
        errorMessage: newError ?? null,
        sources: newSources || [],
      });
    },
    [],
  );

  useEffect(() => {
    // If we already have a terminal saved state, don't re-run
    if (savedState && savedState.status !== 'running') {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus('running');

    runCommanderPipeline({
      query: topic,
      config: configRef.current,
      signal: controller.signal,
      onStepUpdate: (updatedStep) => {
        setSteps((prev) => {
          const next = [...prev];
          const idx = next.findIndex((s) => s.id === updatedStep.id);
          if (idx >= 0) {
            next[idx] = updatedStep;
          } else {
            next.push(updatedStep);
          }
          if (updatedStep.sources && updatedStep.sources.length > 0) {
            setSources((sPrev) => {
              const merged = [...sPrev];
              for (const s of updatedStep.sources || []) {
                if (!merged.some((m) => m.url === s.url)) {
                  merged.push(s);
                }
              }
              return merged;
            });
          }
          return next;
        });
      },
    })
      .then((res) => {
        setStatus('completed');
        setResult(res);
        setSources(res.sources || []);
        emitStateChange('completed', res.steps, res, null, res.sources || []);
      })
      .catch((err) => {
        if (controller.signal.aborted) {
          setStatus('aborted');
          emitStateChange('aborted', stepsRef.current, null, 'Mission aborted by user.', sourcesRef.current);
        } else {
          const msg = err instanceof Error ? err.message : 'Execution failed';
          setStatus('error');
          setErrorMessage(msg);
          emitStateChange('error', stepsRef.current, null, msg, sourcesRef.current);
        }
      });

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatus('aborted');
      emitStateChange('aborted', steps, result, 'Mission stopped by user.', sources);
    }
  };

  const planStep = steps.find((s) => s.agentId === 'commander');
  const alphaStep = steps.find((s) => s.agentId === 'alpha');
  const betaStep = steps.find((s) => s.agentId === 'beta');
  const synthStep = steps.find((s) => s.agentId === 'synthesizer');

  const handleCopyTranscript = async () => {
    const divider = '═══════════════════════════════════════════════';
    const subDivider = '───────────────────────────────────────────────';
    const timestamp = new Date().toLocaleString();

    let text = `COMMANDER SPECIALIST DELIBERATION TRANSCRIPT\n${divider}\n`;
    text += `Date / Time: ${timestamp}\n`;
    text += `Inquiry: "${topic}"\n`;
    text += `Operational Mode: ${config.mode.toUpperCase()}\n${divider}\n\n`;

    if (planStep?.content) {
      text += `[COMMANDER STRATEGIC PLAN]\n${subDivider}\n${planStep.content}\n\n`;
    }

    if (alphaStep) {
      text += `[AGENT ALPHA: ${alphaStep.role || 'Investigator'}]\n${subDivider}\n`;
      if (alphaStep.searchQuery) {
        text += `Search Query: "${alphaStep.searchQuery}"\n`;
      }
      text += `${alphaStep.content || 'Pending...'}\n\n`;
    }

    if (betaStep) {
      text += `[AGENT BETA: ${betaStep.role || 'Validator'}]\n${subDivider}\n`;
      if (betaStep.searchQuery) {
        text += `Search Query: "${betaStep.searchQuery}"\n`;
      }
      text += `${betaStep.content || 'Pending...'}\n\n`;
    }

    if (sources && sources.length > 0) {
      text += `[GROUNDING SOURCES (${sources.length})]\n${subDivider}\n`;
      sources.slice(0, 10).forEach((s, idx) => {
        text += `${idx + 1}. ${s.title} (${s.domain})\n   ${s.url}\n`;
      });
      text += `\n`;
    }

    if (result?.synthesis || synthStep?.content) {
      text += `[FINAL COMMANDER SYNTHESIS]\n${divider}\n`;
      text += `${result?.synthesis || synthStep?.content}\n\n${divider}\nEnd of Commander Report`;
    }

    await copyToClipboard(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full my-3 rounded-2xl border border-indigo-500/30 bg-[#12131f]/90 text-zinc-100 shadow-[0_8px_32px_rgba(99,102,241,0.12)] overflow-hidden font-sans">
      {/* Header bar */}
      <div className="px-4 py-3 border-b border-indigo-500/20 bg-gradient-to-r from-indigo-950/60 via-slate-900/60 to-purple-950/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 grid place-items-center shrink-0 shadow-[0_0_10px_rgba(99,102,241,0.3)]">
            <Shield size={14} className="text-indigo-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-200">
                Commander Intelligence Pipeline
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-900/60 text-indigo-300 border border-indigo-500/40 uppercase">
                {config.mode} Mode
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 truncate max-w-md mt-0.5">
              {topic}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {status === 'running' && (
            <button
              type="button"
              onClick={handleStop}
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-rose-300 bg-rose-950/70 hover:bg-rose-900/80 border border-rose-500/40 flex items-center gap-1.5 transition-colors shadow-sm"
              title="Stop Execution"
            >
              <Square size={11} className="fill-current" />
              <span>Stop</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyTranscript}
            className="p-1.5 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-800/80 hover:bg-zinc-700 hover:text-white border border-zinc-700/60 flex items-center gap-1 transition-colors"
            title="Copy Deliberation Transcript"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          </button>
        </div>
      </div>

      {/* Progressive Step Feed Tracker */}
      <div className="p-3.5 sm:p-4 space-y-3">
        {/* Status progress bar / indicators */}
        <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-medium">
          <div
            className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
              planStep?.status === 'completed'
                ? 'bg-indigo-950/40 border-indigo-500/40 text-indigo-300'
                : planStep?.status === 'running'
                ? 'bg-indigo-900/30 border-indigo-400 text-indigo-200 animate-pulse'
                : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'
            }`}
          >
            <div className="flex items-center gap-1">
              {planStep?.status === 'running' ? (
                <Loader2 size={12} className="animate-spin text-indigo-400" />
              ) : planStep?.status === 'completed' ? (
                <CheckCircle2 size={12} className="text-indigo-400" />
              ) : (
                <Zap size={12} />
              )}
              <span>1. Mission Plan</span>
            </div>
          </div>

          <div
            className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
              alphaStep?.status === 'completed'
                ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                : alphaStep?.status === 'running'
                ? 'bg-cyan-900/30 border-cyan-400 text-cyan-200 animate-pulse'
                : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'
            }`}
          >
            <div className="flex items-center gap-1">
              {alphaStep?.status === 'running' ? (
                <Loader2 size={12} className="animate-spin text-cyan-400" />
              ) : alphaStep?.status === 'completed' ? (
                <CheckCircle2 size={12} className="text-cyan-400" />
              ) : (
                <Shield size={12} />
              )}
              <span>2. Agent Alpha</span>
            </div>
          </div>

          <div
            className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
              betaStep?.status === 'completed'
                ? 'bg-purple-950/40 border-purple-500/40 text-purple-300'
                : betaStep?.status === 'running'
                ? 'bg-purple-900/30 border-purple-400 text-purple-200 animate-pulse'
                : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'
            }`}
          >
            <div className="flex items-center gap-1">
              {betaStep?.status === 'running' ? (
                <Loader2 size={12} className="animate-spin text-purple-400" />
              ) : betaStep?.status === 'completed' ? (
                <CheckCircle2 size={12} className="text-purple-400" />
              ) : (
                <Sparkles size={12} />
              )}
              <span>3. Agent Beta</span>
            </div>
          </div>

          <div
            className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${
              synthStep?.status === 'completed' || result?.synthesis
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : synthStep?.status === 'running'
                ? 'bg-emerald-900/30 border-emerald-400 text-emerald-200 animate-pulse'
                : 'bg-zinc-900/40 border-zinc-800 text-zinc-500'
            }`}
          >
            <div className="flex items-center gap-1">
              {synthStep?.status === 'running' ? (
                <Loader2 size={12} className="animate-spin text-emerald-400" />
              ) : synthStep?.status === 'completed' || result?.synthesis ? (
                <CheckCircle2 size={12} className="text-emerald-400" />
              ) : (
                <Check size={12} />
              )}
              <span>4. Synthesis</span>
            </div>
          </div>
        </div>

        {/* Status notice */}
        {status === 'running' && (
          <div className="text-xs text-indigo-300 flex items-center gap-2 py-1 px-2.5 rounded-lg bg-indigo-950/30 border border-indigo-500/20">
            <Loader2 size={13} className="animate-spin text-indigo-400 shrink-0" />
            <span>
              {synthStep?.status === 'running'
                ? 'Commander synthesizing master response...'
                : betaStep?.status === 'running'
                ? `Agent Beta (${betaStep.role || 'Validator'}) stress-testing and counter-analyzing...`
                : alphaStep?.status === 'running'
                ? `Agent Alpha (${alphaStep.role || 'Investigator'}) researching core vectors...`
                : 'Commander formulating strategic operational plan...'}
            </span>
          </div>
        )}

        {status === 'aborted' && (
          <div className="text-xs text-amber-300 flex items-center gap-2 py-1.5 px-3 rounded-lg bg-amber-950/40 border border-amber-500/30">
            <AlertCircle size={14} className="text-amber-400 shrink-0" />
            <span>Mission was stopped before completion. Partial deliberation shown below.</span>
          </div>
        )}

        {status === 'error' && (
          <div className="text-xs text-rose-300 flex items-center gap-2 py-1.5 px-3 rounded-lg bg-rose-950/40 border border-rose-500/30">
            <AlertCircle size={14} className="text-rose-400 shrink-0" />
            <span>{errorMessage || 'Pipeline error encountered.'}</span>
          </div>
        )}

        {/* Collapsible Intelligence Details (Commander plan, Alpha & Beta findings) */}
        <div className="rounded-xl border border-zinc-800 bg-black/30 overflow-hidden">
          <button
            type="button"
            onClick={() => setDetailsOpen((prev) => !prev)}
            className="w-full px-3 py-2 text-xs font-medium text-zinc-300 hover:text-zinc-100 bg-zinc-900/60 hover:bg-zinc-850 flex items-center justify-between transition-colors"
          >
            <div className="flex items-center gap-2">
              <Shield size={13} className="text-indigo-400" />
              <span>Deliberation Intelligence & Agent Directives</span>
              <span className="text-[10px] font-mono text-zinc-500">
                (Alpha & Beta details)
              </span>
            </div>
            {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          <AnimatePresence>
            {detailsOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="p-3 space-y-2.5 text-xs text-zinc-300 border-t border-zinc-800/80"
              >
                {/* 1. Commander Plan */}
                {planStep?.content && (
                  <div className="p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-500/20">
                    <div className="font-semibold text-indigo-300 mb-1 flex items-center gap-1.5">
                      <span>✦ Commander Tactical Directive</span>
                    </div>
                    <div className="text-[12px] leading-relaxed text-zinc-300 whitespace-pre-line">
                      {planStep.content}
                    </div>
                  </div>
                )}

                {/* 2. Agent Alpha Findings */}
                {alphaStep && (
                  <div className="rounded-lg bg-cyan-950/15 border border-cyan-500/20 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setAlphaOpen((prev) => !prev)}
                      className="w-full p-2.5 text-left flex items-center justify-between hover:bg-cyan-950/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-cyan-300">
                          Agent Alpha: {alphaStep.role || 'Investigator'}
                        </span>
                        {alphaStep.searchQuery && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-900/60 text-cyan-200 border border-cyan-500/40 flex items-center gap-1">
                            <Search size={9} />
                            Search active
                          </span>
                        )}
                      </div>
                      {alphaOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {alphaOpen && (
                      <div className="p-2.5 pt-0 text-[12px] text-zinc-300 border-t border-cyan-500/10 leading-relaxed whitespace-pre-line">
                        {alphaStep.content || 'Awaiting findings...'}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Agent Beta Findings */}
                {betaStep && (
                  <div className="rounded-lg bg-purple-950/15 border border-purple-500/20 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setBetaOpen((prev) => !prev)}
                      className="w-full p-2.5 text-left flex items-center justify-between hover:bg-purple-950/30 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-purple-300">
                          Agent Beta: {betaStep.role || 'Counter-Perspective / Validator'}
                        </span>
                        {betaStep.searchQuery && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-purple-900/60 text-purple-200 border border-purple-500/40 flex items-center gap-1">
                            <Search size={9} />
                            Search active
                          </span>
                        )}
                      </div>
                      {betaOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {betaOpen && (
                      <div className="p-2.5 pt-0 text-[12px] text-zinc-300 border-t border-purple-500/10 leading-relaxed whitespace-pre-line">
                        {betaStep.content || 'Awaiting findings...'}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Sources */}
                {sources && sources.length > 0 && (
                  <div className="pt-1">
                    <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Search size={11} className="text-indigo-400" />
                      <span>Verified Sources ({sources.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {sources.slice(0, 8).map((src, idx) => (
                        <a
                          key={idx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] px-2 py-0.8 rounded-md bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700/60 flex items-center gap-1 transition-colors"
                        >
                          <span className="truncate max-w-[160px]">{src.title}</span>
                          <ExternalLink size={10} className="text-zinc-500 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Master Final Synthesis Output */}
        {(result?.synthesis || synthStep?.content) && (
          <div className="p-3.5 rounded-xl border border-indigo-500/30 bg-slate-900/80 shadow-md">
            <div className="flex items-center gap-2 mb-2 pb-1.5 border-b border-indigo-500/20">
              <Shield size={14} className="text-indigo-400" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">
                Master Commander Synthesis
              </h4>
            </div>
            <div className="text-[13px] leading-relaxed text-zinc-200">
              <FormattedText text={result?.synthesis || synthStep?.content || ''} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
