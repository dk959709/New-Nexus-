import React, { useRef, useState } from 'react';
import {
  Play,
  Square,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ListChecks,
  FileSpreadsheet,
  FileText,
} from 'lucide-react';
import type { Workflow, WorkflowOutput } from '@/types';
import { runWorkflow, buildWorkflowVariableMap } from '@/lib/workflowEngine';

interface WorkflowBatchRunnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflow: Workflow;
}

interface BatchItemResult {
  index: number;
  input: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'stopped';
  durationMs: number;
  output: string;
  error?: string;
}

export const WorkflowBatchRunnerModal: React.FC<WorkflowBatchRunnerModalProps> = ({
  isOpen,
  onClose,
  workflow,
}) => {
  const [rawInputs, setRawInputs] = useState('');
  const [results, setResults] = useState<BatchItemResult[]>([]);
  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const stopBatchRef = useRef(false);

  if (!isOpen) return null;

  const parsedLines = rawInputs
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const handleStartBatch = async () => {
    if (parsedLines.length === 0 || isRunningBatch) return;
    stopBatchRef.current = false;
    setIsRunningBatch(true);

    const initial: BatchItemResult[] = parsedLines.map((input, idx) => ({
      index: idx,
      input,
      status: 'pending',
      durationMs: 0,
      output: '',
    }));
    setResults(initial);

    const baseVars = buildWorkflowVariableMap(workflow);

    for (let i = 0; i < parsedLines.length; i++) {
      if (stopBatchRef.current) {
        setResults((prev) =>
          prev.map((item, idx) =>
            idx >= i && item.status === 'pending' ? { ...item, status: 'stopped' } : item,
          ),
        );
        break;
      }

      const itemInput = parsedLines[i];
      setResults((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'running' } : item)),
      );

      // Clone workflow with the input node overridden for this item
      const inputNode = workflow.nodes.find((n) => n.type === 'input') || workflow.nodes[0];
      const clonedWorkflow: Workflow = {
        ...workflow,
        nodes: workflow.nodes.map((n) =>
          inputNode && n.id === inputNode.id
            ? { ...n, settings: { ...n.settings, text: itemInput } }
            : n,
        ),
      };

      const startMs = Date.now();
      let lastOut: WorkflowOutput | null = null;
      let errMsg: string | undefined;

      try {
        await runWorkflow(
          clonedWorkflow,
          {
            shouldStop: () => stopBatchRef.current,
            onStatus: (_nodeId, status, output, errorText) => {
              if (output && status === 'done') lastOut = output;
              if (errorText && status === 'error') errMsg = errorText;
            },
          },
          { variables: baseVars },
        );
      } catch (err: unknown) {
        errMsg = err instanceof Error ? err.message : String(err);
      }

      const durationMs = Math.max(0, Date.now() - startMs);
      const finalStatus: BatchItemResult['status'] = stopBatchRef.current
        ? 'stopped'
        : errMsg
        ? 'error'
        : 'success';

      const outputStr = lastOut
        ? (lastOut as WorkflowOutput).type === 'image'
          ? '[Generated Image]'
          : (lastOut as WorkflowOutput).value
        : '';

      setResults((prev) =>
        prev.map((item, idx) =>
          idx === i
            ? {
                ...item,
                status: finalStatus,
                durationMs,
                output: outputStr,
                error: errMsg,
              }
            : item,
        ),
      );
    }

    setIsRunningBatch(false);
  };

  const handleStopBatch = () => {
    stopBatchRef.current = true;
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = () => {
    const escapeCsv = (val: string) => `"${(val || '').replace(/"/g, '""')}"`;
    const header = ['Index', 'Input', 'Status', 'DurationMs', 'Output', 'Error'].join(',');
    const rows = results.map((r) =>
      [
        r.index + 1,
        escapeCsv(r.input),
        r.status,
        r.durationMs,
        escapeCsv(r.output),
        escapeCsv(r.error || ''),
      ].join(','),
    );
    const safeName = (workflow.name || 'workflow').replace(/[^a-z0-9]/gi, '_');
    downloadFile([header, ...rows].join('\n'), `${safeName}_batch.csv`, 'text/csv;charset=utf-8');
  };

  const handleExportMarkdown = () => {
    const md = [
      `# Batch Run Report — ${workflow.name}`,
      `Generated: ${new Date().toLocaleString()}`,
      '',
      ...results.map(
        (r) =>
          `## ${r.index + 1}. ${r.input}\n- **Status:** ${r.status} (${(r.durationMs / 1000).toFixed(1)}s)\n\n${
            r.error ? `> Error: ${r.error}` : r.output || '_(No output)_'
          }\n`,
      ),
    ].join('\n');
    const safeName = (workflow.name || 'workflow').replace(/[^a-z0-9]/gi, '_');
    downloadFile(md, `${safeName}_batch.md`, 'text/markdown;charset=utf-8');
  };

  const completedCount = results.filter(
    (r) => r.status === 'success' || r.status === 'error' || r.status === 'stopped',
  ).length;

  return (
    <div className="wf-modal-backdrop fixed inset-0 z-[1300] bg-[#080b12]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="wf-cyber-card wf-modal-panel rounded-t-3xl sm:rounded-2xl max-w-3xl w-full max-h-[92dvh] flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.85)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-400/40 flex items-center justify-center text-violet-300 shrink-0">
              <ListChecks size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-white truncate">
                Batch Pipeline Runner
              </h3>
              <p className="text-xs sm:text-sm text-zinc-400 truncate">
                Run “{workflow.name}” across multiple inputs (one per line)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isRunningBatch}
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-300 disabled:opacity-40"
            aria-label="Close Batch Runner"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-300">
                Batch Inputs (1 item per line)
              </label>
              <span className="text-xs font-mono text-zinc-400 tabular-nums">
                {parsedLines.length} {parsedLines.length === 1 ? 'item' : 'items'} queued
              </span>
            </div>
            <textarea
              rows={5}
              value={rawInputs}
              disabled={isRunningBatch}
              onChange={(e) => setRawInputs(e.target.value)}
              placeholder={'Mars colonization\nEuropa ocean moons\nJames Webb exoplanets'}
              className="wf-field-box w-full rounded-xl p-3.5 text-base sm:text-sm text-white placeholder-zinc-500 font-mono focus:outline-none leading-relaxed resize-y"
            />
          </div>

          {/* Live Progress Bar */}
          {results.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs sm:text-sm font-mono">
                <span className="text-cyan-300 font-bold">
                  Progress: {completedCount} / {results.length}
                </span>
                <span className="text-zinc-400 tabular-nums">
                  {Math.round((completedCount / Math.max(1, results.length)) * 100)}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-zinc-900 border border-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${(completedCount / Math.max(1, results.length)) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Results Cards */}
          {results.length > 0 && (
            <div className="space-y-2.5">
              {results.map((item) => (
                <div
                  key={item.index}
                  className="p-3.5 rounded-2xl bg-[#0b101b] border border-white/10 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-zinc-500">#{item.index + 1}</span>
                      <span className="text-sm font-bold text-white truncate">{item.input}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {item.durationMs > 0 && (
                        <span className="text-xs font-mono text-zinc-400 tabular-nums">
                          {(item.durationMs / 1000).toFixed(1)}s
                        </span>
                      )}
                      {item.status === 'running' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/15 text-cyan-300 text-xs font-mono">
                          <Loader2 size={12} className="animate-spin" /> Running
                        </span>
                      )}
                      {item.status === 'success' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 text-xs font-mono">
                          <CheckCircle2 size={12} /> Done
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 text-xs font-mono">
                          <AlertCircle size={12} /> Error
                        </span>
                      )}
                      {item.status === 'pending' && (
                        <span className="px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 text-xs font-mono">
                          Queued
                        </span>
                      )}
                      {item.status === 'stopped' && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-xs font-mono">
                          Stopped
                        </span>
                      )}
                    </div>
                  </div>
                  {item.error && (
                    <p className="text-xs sm:text-sm font-mono text-rose-300 bg-rose-950/30 p-2.5 rounded-xl border border-rose-500/30">
                      {item.error}
                    </p>
                  )}
                  {item.output && (
                    <pre className="text-xs sm:text-sm font-mono text-cyan-100 bg-[#070a12] p-3 rounded-xl border border-white/10 whitespace-pre-wrap break-words max-h-40 overflow-y-auto leading-relaxed">
                      {item.output}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 bg-[#090d16] flex flex-wrap items-center justify-between gap-2.5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2 flex-wrap">
            {results.some((r) => r.status === 'success' || r.status === 'error') && (
              <>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-1.5"
                >
                  <FileSpreadsheet size={15} />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportMarkdown}
                  className="min-h-[42px] px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/15 text-cyan-300 text-xs sm:text-sm font-semibold flex items-center gap-1.5"
                >
                  <FileText size={15} />
                  <span>Export MD</span>
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {isRunningBatch ? (
              <button
                type="button"
                onClick={handleStopBatch}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-200 font-bold text-sm flex items-center gap-2"
              >
                <Square size={14} className="fill-rose-300" />
                <span>Stop Batch</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={parsedLines.length === 0}
                onClick={handleStartBatch}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-violet-400 hover:brightness-110 disabled:opacity-40 text-slate-950 font-extrabold text-sm flex items-center gap-2"
              >
                <Play size={15} className="fill-slate-950" />
                <span>Run {parsedLines.length} {parsedLines.length === 1 ? 'Item' : 'Items'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
