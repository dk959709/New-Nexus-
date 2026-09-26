import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  Shield,
  Loader2,
  AlertCircle,
  AlertTriangle,
  Square,
  Copy,
  Check,
  Search,
  Scale,
  Sparkles,
  Radio,
  Trash2,
  ExternalLink,
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
  mode?: 'auto' | 'manual';
}

interface CommanderLiveFeedProps {
  topic: string;
  config?: CommanderConfig;
  savedState?: CommanderFeedSavedState;
  onStateChange?: (state: CommanderFeedSavedState) => void;
  onClose?: () => void;
  theme?: string;
  messageIndex?: number;
  onPlayAudio?: (text: string, idKey: string, stageId: string) => void;
  isAudioPlayingKey?: string | null;
  isAudioLoadingKey?: string | null;
}

export const CommanderLiveFeed: React.FC<CommanderLiveFeedProps> = ({
  topic,
  config: propConfig,
  savedState,
  onStateChange,
  onClose,
  theme = 'minimal',
  messageIndex,
  onPlayAudio,
  isAudioPlayingKey,
  isAudioLoadingKey,
}) => {
  const [config] = useState<CommanderConfig>(() => {
    const base = propConfig || storage.getCommanderConfig();
    if (savedState?.mode) {
      return { ...base, mode: savedState.mode };
    }
    return base;
  });
  const [steps, setSteps] = useState<CommanderExecutionStep[]>(() => {
    if (savedState?.steps && savedState.steps.length > 0) {
      return savedState.steps;
    }
    if (savedState?.result) {
      const res = savedState.result;
      const synthSteps: CommanderExecutionStep[] = [];
      if (res.plan) {
        synthSteps.push({
          id: 'commander',
          name: 'Commander',
          agentId: 'commander',
          role: 'Commander',
          status: 'completed',
          content: res.plan,
          timestamp: Date.now(),
        });
      }
      if (res.alphaFindings) {
        synthSteps.push({
          id: 'alpha',
          name: 'Agent Alpha',
          agentId: 'alpha',
          role: 'Specialist 1',
          status: 'completed',
          content: res.alphaFindings,
          timestamp: Date.now(),
        });
      }
      if (res.betaFindings) {
        synthSteps.push({
          id: 'beta',
          name: 'Agent Beta',
          agentId: 'beta',
          role: 'Counter-Perspective',
          status: 'completed',
          content: res.betaFindings,
          timestamp: Date.now(),
        });
      }
      if (res.synthesis) {
        synthSteps.push({
          id: 'synthesizer',
          name: 'Synthesis',
          agentId: 'synthesizer',
          status: 'completed',
          content: res.synthesis,
          timestamp: Date.now(),
        });
      }
      return synthSteps;
    }
    return [];
  });
  const [status, setStatus] = useState<'running' | 'completed' | 'aborted' | 'error'>(
    () => savedState?.status || 'running',
  );
  const [result, setResult] = useState<CommanderResult | null>(() => savedState?.result || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    () => savedState?.errorMessage || null,
  );
  const [sources, setSources] = useState<AISource[]>(
    () => savedState?.sources || savedState?.result?.sources || [],
  );

  const [copiedStageId, setCopiedStageId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [deletedStageIds, setDeletedStageIds] = useState<Set<string>>(new Set());

  // Internal audio player fallback if onPlayAudio prop not provided
  const [internalAudioLoadingKey, setInternalAudioLoadingKey] = useState<string | null>(null);
  const [internalAudioPlayingKey, setInternalAudioPlayingKey] = useState<string | null>(null);
  const internalAudioRef = useRef<HTMLAudioElement | null>(null);

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
        mode: configRef.current.mode,
      });
    },
    [],
  );

  // Guard against auto-running on page reload if restored
  const wasRestored = useRef(savedState?.status === 'running');

  // Execute commander pipeline on mount (ONLY when savedState is NOT provided and not restored)
  useEffect(() => {
    // Only auto-run if NOT restored from localStorage
    if (wasRestored.current) {
      wasRestored.current = false; // consume the flag
      return; // don't auto-run on reload
    }

    if (savedState || status === 'completed' || status === 'aborted' || status === 'error') {
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus('running');
    setErrorMessage(null);
    setResult(null);

    // Initial state emit for new live execution
    emitStateChange('running', [], null, null, []);

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
          let currentSources = sourcesRef.current;
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
            const mergedSources = [...sourcesRef.current];
            for (const s of updatedStep.sources || []) {
              if (!mergedSources.some((m) => m.url === s.url)) {
                mergedSources.push(s);
              }
            }
            currentSources = mergedSources;
          }
          emitStateChange('running', next, null, null, currentSources);
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
          emitStateChange('aborted', stepsRef.current, null, 'Mission stopped by user.', sourcesRef.current);
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

  useEffect(() => {
    return () => {
      if (internalAudioRef.current) {
        internalAudioRef.current.pause();
        internalAudioRef.current = null;
      }
    };
  }, []);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setStatus('aborted');
      emitStateChange('aborted', steps, result, 'Mission stopped by user.', sources);
    }
  };

  const handleCopyStage = async (text: string, stageId: string) => {
    await copyToClipboard(text);
    setCopiedStageId(stageId);
    setTimeout(() => {
      setCopiedStageId(null);
    }, 2000);
  };

  const handleDeleteStage = (stageId: string) => {
    setDeletedStageIds((prev) => {
      const next = new Set(prev);
      next.add(stageId);
      return next;
    });

    const isAlphaEnabled = config.alphaEnabled !== false;
    const isBetaEnabled = config.betaEnabled !== false;
    const isSynthEnabled = (config.synthesizerEnabled !== false) && (isAlphaEnabled || isBetaEnabled);
    const validStageIds = ['commander', ...(isAlphaEnabled ? ['alpha'] : []), ...(isBetaEnabled ? ['beta'] : []), ...(isSynthEnabled ? ['synthesizer'] : [])];

    const remaining = validStageIds.filter(
      (id) => id !== stageId && !next.has(id),
    );
    if (remaining.length === 0) {
      onClose?.();
    }
  };

  const handlePlayAudio = (text: string, stageKey: string, voiceId: string) => {
    if (onPlayAudio) {
      onPlayAudio(text, stageKey, voiceId);
      return;
    }

    if (internalAudioPlayingKey === stageKey) {
      if (internalAudioRef.current) {
        internalAudioRef.current.pause();
        internalAudioRef.current = null;
      }
      setInternalAudioPlayingKey(null);
      return;
    }

    if (internalAudioRef.current) {
      internalAudioRef.current.pause();
      internalAudioRef.current = null;
    }

    setInternalAudioLoadingKey(stageKey);
    const voice =
      voiceId === 'commander'
        ? 'en-US-GuyNeural'
        : voiceId === 'alpha'
        ? 'en-US-JennyNeural'
        : voiceId === 'beta'
        ? 'en-US-EricNeural'
        : 'en-US-AriaNeural';

    const clean = text.replace(/[*_#`~[\]()]/g, '').trim().slice(0, 4000);
    fetch('/api/edge-tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clean, voice }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('Audio generation failed');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        internalAudioRef.current = audio;
        audio.onended = () => {
          setInternalAudioPlayingKey(null);
          internalAudioRef.current = null;
        };
        audio.onerror = () => {
          setInternalAudioPlayingKey(null);
          setInternalAudioLoadingKey(null);
          internalAudioRef.current = null;
        };
        setInternalAudioLoadingKey(null);
        setInternalAudioPlayingKey(stageKey);
        audio.play().catch(() => setInternalAudioPlayingKey(null));
      })
      .catch((err) => {
        console.warn('[Commander Audio] Failed:', err);
        setInternalAudioLoadingKey(null);
        setInternalAudioPlayingKey(null);
      });
  };

  const isAlphaEnabled = config.alphaEnabled !== false;
  const isBetaEnabled = config.betaEnabled !== false;
  const isSynthEnabled = (config.synthesizerEnabled !== false) && (isAlphaEnabled || isBetaEnabled);
  const bothSubAgentsDisabled = !isAlphaEnabled && !isBetaEnabled;

  const planStep = steps.find((s) => s.agentId === 'commander');
  const alphaStep = steps.find((s) => s.agentId === 'alpha');
  const betaStep = steps.find((s) => s.agentId === 'beta');
  const synthStep = steps.find((s) => s.agentId === 'synthesizer');

  // Dynamically-assigned role names from Commander (Auto mode) or manual configuration
  const alphaRoleName = alphaStep?.role || config.manualConfig?.alphaRole;
  const alphaDisplayName = alphaRoleName
    ? `Agent Alpha — ${alphaRoleName}`
    : !isBetaEnabled && config.mode !== 'manual'
    ? 'Agent Alpha (Combined Specialist)'
    : 'Agent Alpha (Specialist 1)';

  const betaRoleName = betaStep?.role || config.manualConfig?.betaRole;
  const betaDisplayName = betaRoleName
    ? `Agent Beta — ${betaRoleName}`
    : !isAlphaEnabled && config.mode !== 'manual'
    ? 'Agent Beta (Combined Specialist)'
    : 'Agent Beta (Counter-Perspective)';

  const stages = [
    {
      id: 'commander',
      name: 'Commander',
      icon: <Shield size={14} className="text-indigo-400 shrink-0" />,
      accentColor: '#818cf8',
      content: planStep?.content || '',
      status: planStep?.status || (status === 'running' ? 'running' : 'completed'),
      voiceId: 'commander',
      runningLabel: 'Formulating tactical plan...',
    },
    ...(isAlphaEnabled
      ? [
          {
            id: 'alpha',
            name: alphaDisplayName,
            icon: <Search size={14} className="text-cyan-400 shrink-0" />,
            accentColor: '#22d3ee',
            content: alphaStep?.content || '',
            status:
              alphaStep?.status ||
              (planStep?.status === 'completed' && status === 'running'
                ? 'running'
                : planStep?.status === 'completed'
                ? 'completed'
                : 'pending'),
            voiceId: 'alpha',
            runningLabel:
              !isBetaEnabled && config.mode !== 'manual'
                ? 'Investigating & auditing risks...'
                : 'Researching core vectors...',
          },
        ]
      : []),
    ...(isBetaEnabled
      ? [
          {
            id: 'beta',
            name: betaDisplayName,
            icon: <Scale size={14} className="text-purple-400 shrink-0" />,
            accentColor: '#c084fc',
            content: betaStep?.content || '',
            status:
              betaStep?.status ||
              ((isAlphaEnabled ? alphaStep?.status === 'completed' : planStep?.status === 'completed') && status === 'running'
                ? 'running'
                : (isAlphaEnabled ? alphaStep?.status === 'completed' : planStep?.status === 'completed')
                ? 'completed'
                : 'pending'),
            voiceId: 'beta',
            runningLabel:
              !isAlphaEnabled && config.mode !== 'manual'
                ? 'Investigating & auditing risks...'
                : 'Analyzing counter-perspectives...',
          },
        ]
      : []),
    ...(isSynthEnabled
      ? [
          {
            id: 'synthesizer',
            name: 'Synthesis',
            icon: <Sparkles size={14} className="text-emerald-400 shrink-0" />,
            accentColor: '#34d399',
            content: result?.synthesis || synthStep?.content || '',
            status:
              result?.synthesis || synthStep?.status === 'completed'
                ? 'completed'
                : ((isBetaEnabled ? betaStep?.status === 'completed' : isAlphaEnabled ? alphaStep?.status === 'completed' : planStep?.status === 'completed') && status === 'running')
                ? 'running'
                : 'pending',
            voiceId: 'synthesizer',
            runningLabel: 'Synthesizing master response...',
          },
        ]
      : []),
  ];

  const visibleStages = stages.filter((s) => !deletedStageIds.has(s.id));

  const hasAnyStageContent = visibleStages.some(
    (s) => (s.content || '').trim().length > 0,
  );

  const handleCopyAllStages = async () => {
    const completedStages = visibleStages
      .map((s) => {
        const text = (s.content || '').trim();
        return { stage: s, text };
      })
      .filter((item) => item.text.length > 0);

    if (completedStages.length === 0) return;

    const modeLabel = config.mode === 'manual' ? 'Manual Mode' : 'Auto Mode';
    const headerLines = [
      `=== COMMANDER PIPELINE ===`,
      `Mode: ${modeLabel}`,
      topic?.trim() ? `Topic: ${topic.trim()}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const stagesBlock = completedStages
      .map((item) => `=== ${item.stage.name.toUpperCase()} ===\n${item.text}`)
      .join('\n\n');

    const allSources =
      sources && sources.length > 0
        ? sources
        : result?.sources || savedState?.sources || [];

    let sourcesBlock = '';
    if (allSources.length > 0) {
      const sourceList = allSources
        .map((s, idx) => {
          const lines = [`[${idx + 1}] ${s.title || 'Source'}`];
          if (s.url) lines.push(`URL: ${s.url}`);
          if (s.domain && s.domain !== 'web') lines.push(`Domain: ${s.domain}`);
          if (s.snippet) lines.push(`Snippet: ${s.snippet.trim()}`);
          return lines.join('\n');
        })
        .join('\n\n');
      sourcesBlock = `\n\n=== SOURCES ===\n${sourceList}`;
    }

    const formattedBlock = `${headerLines}\n\n${stagesBlock}${sourcesBlock}`;

    await copyToClipboard(formattedBlock);
    setCopiedAll(true);
    setTimeout(() => {
      setCopiedAll(false);
    }, 2000);
  };

  return (
    <div className="space-y-4 pt-1 font-sans">
      {/* Sequence Header Line matching Multi Chat style */}
      <div className="flex items-center justify-between gap-2 text-xs text-zinc-400 pb-1 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[11px] tracking-wide uppercase text-zinc-300">
              Commander Pipeline
            </span>
            <button
              type="button"
              onClick={handleCopyAllStages}
              disabled={!hasAnyStageContent}
              className={`p-1 rounded-md transition-all flex items-center gap-1 text-xs ${
                copiedAll
                  ? 'text-emerald-400 bg-emerald-500/10'
                  : !hasAnyStageContent
                  ? 'text-zinc-600 opacity-40 cursor-not-allowed'
                  : theme === 'fulldark'
                  ? 'text-zinc-400 hover:text-white hover:bg-[#282828] active:scale-95'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 active:scale-95'
              }`}
              title={
                copiedAll
                  ? 'Copied all agent answers!'
                  : hasAnyStageContent
                  ? 'Copy all agent answers to clipboard'
                  : 'Waiting for agent answers...'
              }
              aria-label="Copy all agent answers"
            >
              {copiedAll ? (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-[10px] text-emerald-400 font-medium font-mono">Copied All</span>
                </>
              ) : (
                <Copy size={12} />
              )}
            </button>
          </div>
          <span className="text-zinc-600">·</span>
          <div className="flex items-center gap-1.5 text-[11px] font-mono flex-wrap">
            <span className="text-indigo-400 font-medium">Commander 🛡️</span>
            {isAlphaEnabled && (
              <>
                <span className="text-zinc-600">→</span>
                <span className="text-cyan-400 font-medium">Agent Alpha 🔍</span>
              </>
            )}
            {isBetaEnabled && (
              <>
                <span className="text-zinc-600">→</span>
                <span className="text-purple-400 font-medium">Agent Beta ⚖️</span>
              </>
            )}
            {isSynthEnabled && (
              <>
                <span className="text-zinc-600">→</span>
                <span className="text-emerald-400 font-medium">Synthesis ✨</span>
              </>
            )}
          </div>
        </div>

        {status === 'running' && (
          <button
            type="button"
            onClick={handleStop}
            className="px-2 py-0.5 rounded text-[11px] font-medium text-rose-300 bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/40 flex items-center gap-1 transition-colors"
            title="Stop Execution"
          >
            <Square size={10} className="fill-current" />
            <span>Stop</span>
          </button>
        )}
      </div>

      {bothSubAgentsDisabled && (
        <div className="text-[11.5px] text-amber-300/90 bg-amber-950/20 border border-amber-500/20 rounded-md px-2 py-1 flex items-center gap-1.5">
          <AlertCircle size={12} className="shrink-0 text-amber-400" />
          <span>Agent Alpha and Agent Beta are disabled — showing Commander's plan directly.</span>
        </div>
      )}

      {status === 'aborted' && (
        <div className="text-xs text-amber-400 flex items-center gap-1.5 py-1">
          <AlertCircle size={13} className="shrink-0" />
          <span>Mission stopped by user. Partial deliberation shown below.</span>
        </div>
      )}

      {status === 'error' && (
        <div className="text-xs text-rose-400 flex items-center gap-1.5 py-1">
          <AlertCircle size={13} className="shrink-0" />
          <span>{errorMessage || 'Pipeline error encountered.'}</span>
        </div>
      )}

      {/* Stacked Flowing Stage Blocks matching Multi Chat */}
      {visibleStages.map((stage) => {
        const isRunning = stage.status === 'running';
        const isPending = stage.status === 'pending';
        const isFailed = stage.status === 'failed';
        const cleanText = (stage.content || '').trim();
        const stageKey = `${messageIndex ?? 'cmd'}_${stage.id}`;
        const isAudioPlaying = (isAudioPlayingKey ?? internalAudioPlayingKey) === stageKey;
        const isAudioLoading = (isAudioLoadingKey ?? internalAudioLoadingKey) === stageKey;

        // If not running and has no content and is pending, don't show blank block when finished
        if (!cleanText && !isRunning && isPending && status !== 'running') {
          return null;
        }

        return (
          <div key={stage.id} className="space-y-1.5 pt-2 first:pt-0">
            {/* Minimal Stage Label: Icon + Colored Name */}
            <div className="flex items-center gap-2 flex-wrap">
              {stage.icon}
              <span
                className="text-xs font-semibold font-mono tracking-tight"
                style={{ color: stage.accentColor }}
              >
                {stage.name}
              </span>

              {isRunning && (
                <span
                  className="inline-flex items-center gap-1 text-[11px] font-normal"
                  style={{ color: stage.accentColor }}
                >
                  <Loader2 size={11} className="animate-spin" />
                  <span>{stage.runningLabel}</span>
                </span>
              )}

              {isPending && isRunning && (
                <span className="text-[11px] text-zinc-500 italic font-normal">
                  Waiting in sequence...
                </span>
              )}

              {isFailed && (
                <span className="inline-flex items-center gap-1 text-[11px] text-red-400 font-normal">
                  <AlertTriangle size={11} />
                  <span>Failed</span>
                </span>
              )}
            </div>

            {/* Plain Flowing Paragraph Text - No boxes, no borders, no background cards */}
            {cleanText ? (
              <div
                className={`text-[15px] leading-relaxed break-words ${
                  theme === 'classic'
                    ? 'text-slate-100'
                    : theme === 'fulldark'
                    ? 'text-[#ececec] font-normal tracking-normal'
                    : 'text-zinc-200'
                }`}
              >
                <FormattedText content={cleanText} />
              </div>
            ) : isRunning ? (
              <div className="text-xs text-zinc-400 py-0.5 flex items-center gap-2">
                <Loader2 size={12} className="animate-spin text-zinc-400" />
                <span>Thinking...</span>
              </div>
            ) : isPending ? (
              <div className="text-xs text-zinc-500 italic py-0.5">
                Waiting for previous stage...
              </div>
            ) : isFailed ? (
              <div className="text-xs text-red-400 py-0.5">
                Failed to generate response for this stage.
              </div>
            ) : null}

            {/* Action Toolbar: Copy, Speak, Delete (identical to Multi Chat) */}
            {(stage.status === 'completed' || cleanText) && cleanText && (
              <div
                className={`flex items-center gap-1.5 pt-1 opacity-70 group-hover:opacity-100 transition-opacity ${
                  theme === 'fulldark' ? 'text-[#888]' : 'text-zinc-400'
                }`}
              >
                {/* Universal Copy */}
                <button
                  type="button"
                  onClick={() => handleCopyStage(cleanText, stage.id)}
                  className={`p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs ${
                    theme === 'fulldark'
                      ? 'hover:text-white hover:bg-[#282828]'
                      : 'hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                  title={`Copy ${stage.name}'s response`}
                >
                  {copiedStageId === stage.id ? (
                    <>
                      <Check size={13} className="text-emerald-400" />
                      <span className="text-[11px] text-emerald-400 font-medium">Copied</span>
                    </>
                  ) : (
                    <Copy size={13} />
                  )}
                </button>

                {/* Universal Edge TTS Voice */}
                <button
                  type="button"
                  onClick={() => handlePlayAudio(cleanText, stageKey, stage.voiceId)}
                  disabled={isAudioLoading}
                  className={`p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs ${
                    isAudioPlaying
                      ? 'text-cyan-400 bg-cyan-500/15'
                      : theme === 'fulldark'
                      ? 'hover:text-white hover:bg-[#282828]'
                      : 'hover:text-zinc-200 hover:bg-zinc-800'
                  }`}
                  title={
                    isAudioLoading
                      ? `Synthesizing ${stage.name}'s Neural Edge TTS voice...`
                      : isAudioPlaying
                      ? `Stop voice`
                      : `Play Neural Voice (Edge TTS)`
                  }
                >
                  {isAudioLoading ? (
                    <Loader2 size={13} className="animate-spin text-cyan-400" />
                  ) : isAudioPlaying ? (
                    <Radio size={13} className="animate-pulse text-cyan-400" />
                  ) : (
                    <Radio size={13} />
                  )}
                </button>

                {/* Delete Stage Response */}
                <button
                  type="button"
                  onClick={() => handleDeleteStage(stage.id)}
                  className={`p-1.5 rounded-md transition-colors flex items-center gap-1 text-xs ${
                    theme === 'fulldark'
                      ? 'hover:text-red-400 hover:bg-red-500/10'
                      : 'hover:text-red-400 hover:bg-red-500/10'
                  }`}
                  title={`Delete ${stage.name}'s answer`}
                  aria-label="Delete answer"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Minimal Plain Sources at bottom if search occurred */}
      {sources && sources.length > 0 && (
        <div className="pt-2 text-xs text-zinc-400 flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-mono text-zinc-500">Sources:</span>
          {sources.slice(0, 6).map((src, idx) => (
            <a
              key={idx}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-zinc-400 hover:text-zinc-200 underline decoration-zinc-700 hover:decoration-zinc-400 transition-colors flex items-center gap-1"
            >
              <span>{src.domain || src.title}</span>
              <ExternalLink size={9} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
};
