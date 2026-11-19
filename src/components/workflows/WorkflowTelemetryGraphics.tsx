import React, { useMemo, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
  Timer,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import type {
  Workflow,
  WorkflowRunRecord,
  WorkflowStepStatus,
  WorkflowValidationIssue,
} from '@/types';

export interface WorkflowTelemetryGraphicsProps {
  className?: string;
  isRunning?: boolean;
  workflow?: Workflow | null;
  runHistory?: WorkflowRunRecord[];
  stepStatuses?: Record<string, WorkflowStepStatus>;
  stepDurations?: Record<string, number>;
  validationIssues?: WorkflowValidationIssue[];
  onOpenValidator?: () => void;
}

export const WorkflowTelemetryGraphics: React.FC<WorkflowTelemetryGraphicsProps> = ({
  className = '',
  isRunning = false,
  workflow,
  runHistory = [],
  stepStatuses = {},
  stepDurations = {},
  validationIssues = [],
  onOpenValidator,
}) => {
  const [expanded, setExpanded] = useState(false);

  const metrics = useMemo(() => {
    const totalNodes = workflow?.nodes?.length || 0;
    const totalEdges = workflow?.edges?.length || 0;
    const doneNodes = Object.values(stepStatuses).filter((s) => s === 'done').length;
    const errorNodes = Object.values(stepStatuses).filter((s) => s === 'error').length;
    const runningNodes = Object.values(stepStatuses).filter((s) => s === 'running').length;

    const totalRuns = runHistory.length;
    const successRuns = runHistory.filter((r) => r.status === 'success').length;
    const successRate = totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : null;

    const avgDurationMs =
      totalRuns > 0
        ? Math.round(runHistory.reduce((acc, r) => acc + (r.durationMs || 0), 0) / totalRuns)
        : Object.values(stepDurations).reduce((acc, ms) => acc + ms, 0);

    const recentBars = runHistory.slice(0, 12).reverse();
    const maxBarMs = Math.max(...recentBars.map((r) => r.durationMs || 100), 100);

    const errorCount = validationIssues.filter((i) => i.severity === 'error').length;
    const warningCount = validationIssues.filter((i) => i.severity === 'warning').length;

    return {
      totalNodes,
      totalEdges,
      doneNodes,
      errorNodes,
      runningNodes,
      totalRuns,
      successRate,
      avgDurationMs,
      recentBars,
      maxBarMs,
      errorCount,
      warningCount,
    };
  }, [workflow, runHistory, stepStatuses, stepDurations, validationIssues]);

  return (
    <section
      aria-label="Pipeline Overview & Health"
      className={`w-full max-w-full overflow-hidden rounded-2xl bg-[#080d16]/95 border border-cyan-500/25 shadow-[0_10px_30px_rgba(0,0,0,0.45)] backdrop-blur-xl mb-4 ${className}`}
    >
      {/* Compact Always-Readable Header Row */}
      <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0">
            <Activity size={17} className={isRunning ? 'animate-pulse text-cyan-300' : 'text-cyan-400'} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                Pipeline Insights
              </h3>
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-mono font-semibold border ${
                  isRunning
                    ? 'bg-cyan-500/15 text-cyan-200 border-cyan-400/40'
                    : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isRunning ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400'
                  }`}
                />
                {isRunning ? 'Running' : 'Ready'}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400 tabular-nums mt-0.5">
              {metrics.totalNodes} steps ·{' '}
              {metrics.totalRuns > 0
                ? `${metrics.successRate}% pass (${metrics.totalRuns} runs)`
                : 'No runs yet'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {onOpenValidator && (
            <button
              type="button"
              onClick={onOpenValidator}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors ${
                metrics.errorCount > 0
                  ? 'bg-rose-500/15 border-rose-400/45 text-rose-200 hover:bg-rose-500/25'
                  : metrics.warningCount > 0
                  ? 'bg-amber-500/15 border-amber-400/45 text-amber-200 hover:bg-amber-500/25'
                  : 'bg-emerald-500/10 border-emerald-500/35 text-emerald-300 hover:bg-emerald-500/20'
              }`}
            >
              {metrics.errorCount > 0 || metrics.warningCount > 0 ? (
                <AlertTriangle size={14} />
              ) : (
                <ShieldCheck size={14} />
              )}
              <span>
                {metrics.errorCount > 0
                  ? `${metrics.errorCount} ${metrics.errorCount === 1 ? 'Error' : 'Errors'}`
                  : metrics.warningCount > 0
                  ? `${metrics.warningCount} ${metrics.warningCount === 1 ? 'Warn' : 'Warnings'}`
                  : 'Healthy'}
              </span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-xs sm:text-sm font-semibold text-zinc-200 flex items-center gap-1.5 transition-colors"
            aria-expanded={expanded}
          >
            <span>{expanded ? 'Hide Stats' : 'Metrics'}</span>
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Expandable Real Metrics Cards */}
      {expanded && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4 pb-4 pt-1 border-t border-white/10">
          {/* Card 1: Current Session Step Progress */}
          <div className="rounded-xl border border-white/10 bg-[#0b101c] p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Layers size={14} className="text-cyan-400" />
                Graph Structure
              </span>
              <span className="text-cyan-300 font-bold tabular-nums">
                {metrics.totalNodes}N / {metrics.totalEdges}E
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-mono font-bold text-white tabular-nums">
                {metrics.doneNodes}/{metrics.totalNodes}
              </span>
              <span className="text-xs sm:text-sm text-zinc-400">steps completed</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-900 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                style={{
                  width: `${
                    metrics.totalNodes > 0
                      ? Math.round((metrics.doneNodes / metrics.totalNodes) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono text-zinc-400">
              <span className="text-emerald-300">Done: {metrics.doneNodes}</span>
              <span className="text-cyan-300">Active: {metrics.runningNodes}</span>
              <span className="text-rose-300">Failed: {metrics.errorNodes}</span>
            </div>
          </div>

          {/* Card 2: Real Reliability & Latency */}
          <div className="rounded-xl border border-white/10 bg-[#0b101c] p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-zinc-400">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={14} className="text-emerald-400" />
                Run Reliability
              </span>
              <span className="text-zinc-300 tabular-nums">{metrics.totalRuns} recorded</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="rounded-xl bg-[#070b14] border border-white/10 p-2.5">
                <div className="text-xs text-zinc-400">Success Rate</div>
                <div className="text-xl font-mono font-bold text-emerald-300 tabular-nums mt-0.5">
                  {metrics.successRate !== null ? `${metrics.successRate}%` : '—'}
                </div>
              </div>
              <div className="rounded-xl bg-[#070b14] border border-white/10 p-2.5">
                <div className="text-xs text-zinc-400">Avg Duration</div>
                <div className="text-xl font-mono font-bold text-cyan-300 tabular-nums mt-0.5">
                  {metrics.avgDurationMs > 0
                    ? `${(metrics.avgDurationMs / 1000).toFixed(1)}s`
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Real Recent Run Timeline */}
          <div className="rounded-xl border border-white/10 bg-[#0b101c] p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Timer size={14} className="text-violet-400" />
                Recent Runs
              </span>
              <span className="text-zinc-400">Last {metrics.recentBars.length}</span>
            </div>
            {metrics.recentBars.length === 0 ? (
              <div className="h-16 flex items-center justify-center text-xs sm:text-sm text-zinc-400 bg-[#070b14] rounded-xl border border-white/5">
                Run this workflow to chart real latency
              </div>
            ) : (
              <div className="h-16 flex items-end gap-1.5 pt-1">
                {metrics.recentBars.map((run) => {
                  const pct = Math.max(16, Math.round(((run.durationMs || 100) / metrics.maxBarMs) * 100));
                  return (
                    <div
                      key={run.id}
                      title={`${new Date(run.startedAt).toLocaleTimeString()} · ${run.status} · ${(run.durationMs / 1000).toFixed(1)}s`}
                      className={`flex-1 rounded-t-md transition-all ${
                        run.status === 'success'
                          ? 'bg-emerald-400/75 hover:bg-emerald-300'
                          : run.status === 'error'
                          ? 'bg-rose-400/80 hover:bg-rose-300'
                          : 'bg-amber-400/75 hover:bg-amber-300'
                      }`}
                      style={{ height: `${pct}%` }}
                    />
                  );
                })}
              </div>
            )}
            <p className="text-xs text-zinc-400">
              Bar height reflects actual run execution duration.
            </p>
          </div>
        </div>
      )}
    </section>
  );
};
