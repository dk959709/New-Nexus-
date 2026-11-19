import React, { useMemo, useState, useEffect } from 'react';
import { GitCompare, X, ArrowRight, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import type { WorkflowRunRecord } from '@/types';

interface WorkflowRunDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  runs: WorkflowRunRecord[];
  initialRunAId?: string;
  initialRunBId?: string;
}

interface DiffLine {
  kind: 'same' | 'added' | 'removed';
  text: string;
}

function computeLineDiff(leftText: string, rightText: string): DiffLine[] {
  const a = (leftText || '').split(/\r?\n/);
  const b = (rightText || '').split(/\r?\n/);
  // Simple LCS diff capped cleanly for responsive UI
  const maxLines = 250;
  const aSlice = a.slice(0, maxLines);
  const bSlice = b.slice(0, maxLines);
  const m = aSlice.length;
  const n = bSlice.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));

  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (aSlice[i] === bSlice[j]) {
        dp[i][j] = dp[i + 1][j + 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (aSlice[i] === bSlice[j]) {
      lines.push({ kind: 'same', text: aSlice[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      lines.push({ kind: 'removed', text: aSlice[i] });
      i++;
    } else {
      lines.push({ kind: 'added', text: bSlice[j] });
      j++;
    }
  }
  while (i < m) {
    lines.push({ kind: 'removed', text: aSlice[i++] });
  }
  while (j < n) {
    lines.push({ kind: 'added', text: bSlice[j++] });
  }
  return lines;
}

export const WorkflowRunDiffModal: React.FC<WorkflowRunDiffModalProps> = ({
  isOpen,
  onClose,
  runs,
  initialRunAId,
  initialRunBId,
}) => {
  const [runAId, setRunAId] = useState<string>('');
  const [runBId, setRunBId] = useState<string>('');
  const [showOnlyChanges, setShowOnlyChanges] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setRunAId(initialRunAId || runs[1]?.id || runs[0]?.id || '');
    setRunBId(initialRunBId || runs[0]?.id || '');
  }, [isOpen, runs, initialRunAId, initialRunBId]);

  const runA = useMemo(() => runs.find((r) => r.id === runAId) || runs[1] || runs[0] || null, [runs, runAId]);
  const runB = useMemo(() => runs.find((r) => r.id === runBId) || runs[0] || null, [runs, runBId]);

  const diffLines = useMemo(() => {
    if (!runA || !runB) return [];
    const all = computeLineDiff(runA.finalOutput || '', runB.finalOutput || '');
    return showOnlyChanges ? all.filter((l) => l.kind !== 'same') : all;
  }, [runA, runB, showOnlyChanges]);

  if (!isOpen) return null;

  const durationDeltaMs = runA && runB ? runB.durationMs - runA.durationMs : 0;

  return (
    <div className="wf-modal-backdrop fixed inset-0 z-[1310] bg-[#080b12]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="wf-cyber-card wf-modal-panel rounded-t-3xl sm:rounded-2xl max-w-4xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <GitCompare size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-white truncate">
                Compare Runs & Output Diff
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 truncate">
                Inspect timing deltas, step statuses, and line-by-line output changes
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300"
            aria-label="Close Run Diff"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          {runs.length < 2 ? (
            <div className="p-8 rounded-2xl bg-[#0a0f18] border border-white/10 text-center space-y-2">
              <Clock size={30} className="mx-auto text-zinc-500" />
              <h4 className="text-base font-bold text-white">Need at least 2 saved runs</h4>
              <p className="text-sm text-zinc-400">
                Run this workflow twice to compare outputs, latency changes, and step results.
              </p>
            </div>
          ) : (
            <>
              {/* Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold uppercase text-rose-300 block">
                    Baseline Run (A)
                  </label>
                  <select
                    value={runA?.id || ''}
                    onChange={(e) => setRunAId(e.target.value)}
                    className="wf-field-box w-full rounded-xl px-3 py-2.5 text-base sm:text-sm text-white font-mono focus:outline-none"
                  >
                    {runs.map((r, i) => (
                      <option key={r.id} value={r.id} className="bg-[#0b0d14]">
                        #{runs.length - i} · {new Date(r.startedAt).toLocaleString()} ({(r.durationMs / 1000).toFixed(1)}s · {r.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-bold uppercase text-emerald-300 block">
                    Target Run (B)
                  </label>
                  <select
                    value={runB?.id || ''}
                    onChange={(e) => setRunBId(e.target.value)}
                    className="wf-field-box w-full rounded-xl px-3 py-2.5 text-base sm:text-sm text-white font-mono focus:outline-none"
                  >
                    {runs.map((r, i) => (
                      <option key={r.id} value={r.id} className="bg-[#0b0d14]">
                        #{runs.length - i} · {new Date(r.startedAt).toLocaleString()} ({(r.durationMs / 1000).toFixed(1)}s · {r.status})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Summary Strip */}
              {runA && runB && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl bg-[#0b101b] border border-white/10">
                    <div className="text-xs font-mono uppercase text-zinc-400">Baseline Duration</div>
                    <div className="text-lg font-mono font-bold text-white tabular-nums mt-0.5">
                      {(runA.durationMs / 1000).toFixed(2)}s
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0b101b] border border-white/10">
                    <div className="text-xs font-mono uppercase text-zinc-400">Target Duration</div>
                    <div className="text-lg font-mono font-bold text-cyan-300 tabular-nums mt-0.5">
                      {(runB.durationMs / 1000).toFixed(2)}s
                    </div>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#0b101b] border border-white/10">
                    <div className="text-xs font-mono uppercase text-zinc-400">Latency Delta</div>
                    <div
                      className={`text-lg font-mono font-bold tabular-nums mt-0.5 ${
                        durationDeltaMs <= 0 ? 'text-emerald-300' : 'text-amber-300'
                      }`}
                    >
                      {durationDeltaMs > 0 ? '+' : ''}
                      {(durationDeltaMs / 1000).toFixed(2)}s
                    </div>
                  </div>
                </div>
              )}

              {/* Step Timing Comparison */}
              {runA && runB && (
                <div className="space-y-2">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                    Step-by-Step Timing Comparison
                  </h4>
                  <div className="space-y-2">
                    {runB.steps.map((stepB, idx) => {
                      const stepA = runA.steps.find((s) => s.nodeId === stepB.nodeId) || runA.steps[idx];
                      return (
                        <div
                          key={`${stepB.nodeId}-${idx}`}
                          className="p-3 rounded-xl bg-[#0b101b] border border-white/10 flex flex-wrap items-center justify-between gap-2 text-sm"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {stepB.status === 'done' ? (
                              <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                            ) : (
                              <AlertCircle size={15} className="text-amber-400 shrink-0" />
                            )}
                            <span className="font-semibold text-white truncate">{stepB.label}</span>
                          </div>
                          <div className="flex items-center gap-2 font-mono text-xs sm:text-sm tabular-nums">
                            <span className="text-zinc-400">
                              {stepA ? `${stepA.durationMs}ms` : '—'}
                            </span>
                            <ArrowRight size={13} className="text-zinc-500" />
                            <span className="text-cyan-300 font-bold">{stepB.durationMs}ms</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Final Output Diff */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                    Final Output Diff
                  </h4>
                  <label className="inline-flex items-center gap-2 text-xs sm:text-sm text-zinc-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showOnlyChanges}
                      onChange={(e) => setShowOnlyChanges(e.target.checked)}
                      className="rounded border-white/20 bg-zinc-900 text-cyan-400 w-4 h-4"
                    />
                    <span>Show changed lines only</span>
                  </label>
                </div>

                <div className="rounded-xl bg-[#070a12] border border-white/10 overflow-hidden max-h-80 overflow-y-auto font-mono text-xs sm:text-sm leading-relaxed">
                  {diffLines.length === 0 ? (
                    <div className="p-4 text-center text-emerald-300">
                      Outputs are identical between both runs.
                    </div>
                  ) : (
                    diffLines.map((line, idx) => (
                      <div
                        key={idx}
                        className={`px-3.5 py-1 whitespace-pre-wrap break-words border-b border-white/[0.03] ${
                          line.kind === 'added'
                            ? 'bg-emerald-500/15 text-emerald-200'
                            : line.kind === 'removed'
                            ? 'bg-rose-500/15 text-rose-200'
                            : 'text-zinc-300'
                        }`}
                      >
                        <span className="inline-block w-5 opacity-70 select-none">
                          {line.kind === 'added' ? '+' : line.kind === 'removed' ? '-' : ' '}
                        </span>
                        {line.text || ' '}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
