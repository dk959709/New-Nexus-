import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
  type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowStepStatus,
  WorkflowOutput,
} from '@/types';
import { storage } from '@/lib/storage';
import { getOutputSummary } from '@/lib/workflowEngine';
import {
  Terminal,
  Search,
  Globe,
  GraduationCap,
  Sparkles,
  Image as ImageIcon,
  CloudSun,
  Rocket,
  GitFork,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MinusCircle,
  Ban,
  Play,
  Copy,
  Check,
  Trash2,
  Eye,
  Code2,
  Layers,
  BarChart2,
  X,
  Maximize2,
} from 'lucide-react';

export interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  stepStatuses: Record<string, WorkflowStepStatus>;
  stepOutputs: Record<string, WorkflowOutput>;
  stepStartTimes?: Record<string, number>;
  stepDurations?: Record<string, number>;
  stepOutputSummaries?: Record<string, string>;
  stepErrors?: Record<string, string>;
  isRunning: boolean;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onUpdateNodesPosition: (updated: Array<{ id: string; x: number; y: number }>) => void;
  onConnect: (connection: Connection) => void;
  onDeleteEdge: (edgeId: string) => void;
  onTidy: () => void;
  onRunFromNode?: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  onToggleDisableNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onOpenInspectorOutput?: (nodeId: string) => void;
}

export const NODE_CONFIG: Record<
  WorkflowNodeType,
  {
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    color: string;
    desc: string;
  }
> = {
  input: {
    label: 'Input',
    icon: Terminal,
    color: 'text-cyan-400 bg-cyan-500/10',
    desc: 'Starting payload text',
  },
  webSearch: {
    label: 'Web Search',
    icon: Search,
    color: 'text-sky-400 bg-sky-500/10',
    desc: 'Live web search results',
  },
  webFetch: {
    label: 'Web Fetch',
    icon: Globe,
    color: 'text-teal-400 bg-teal-500/10',
    desc: 'Read webpage article content',
  },
  scholar: {
    label: 'Scholar',
    icon: GraduationCap,
    color: 'text-indigo-400 bg-indigo-500/10',
    desc: 'Academic papers & abstracts',
  },
  ai: {
    label: 'AI Agent',
    icon: Sparkles,
    color: 'text-violet-400 bg-violet-500/10',
    desc: 'LLM reasoning & synthesis',
  },
  image: {
    label: 'Generate Image',
    icon: ImageIcon,
    color: 'text-pink-400 bg-pink-500/10',
    desc: 'AI studio image creation',
  },
  weather: {
    label: 'Weather',
    icon: CloudSun,
    color: 'text-amber-400 bg-amber-500/10',
    desc: 'Realtime city weather telemetry',
  },
  nasa: {
    label: 'NASA APOD',
    icon: Rocket,
    color: 'text-rose-400 bg-rose-500/10',
    desc: 'Astronomy picture of the day',
  },
  if: {
    label: 'Condition (If)',
    icon: GitFork,
    color: 'text-emerald-400 bg-emerald-500/10',
    desc: 'Branch execution based on rule',
  },
};

/**
 * Shared 200ms ticker singleton so only the running node's timer re-renders,
 * never re-rendering the entire canvas or idle/finished nodes.
 */
type TickListener = (now: number) => void;
const tickListeners = new Set<TickListener>();
let sharedTickerInterval: ReturnType<typeof setInterval> | null = null;

function subscribeSharedTicker(listener: TickListener): () => void {
  tickListeners.add(listener);
  if (tickListeners.size === 1 && !sharedTickerInterval) {
    sharedTickerInterval = setInterval(() => {
      const now = Date.now();
      tickListeners.forEach((fn) => fn(now));
    }, 200);
  }
  return () => {
    tickListeners.delete(listener);
    if (tickListeners.size === 0 && sharedTickerInterval) {
      clearInterval(sharedTickerInterval);
      sharedTickerInterval = null;
    }
  };
}

const RunningLiveTimer = React.memo(function RunningLiveTimer({
  startedAt,
}: {
  startedAt?: number;
}) {
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    return subscribeSharedTicker((tickNow) => {
      setNow(tickNow);
    });
  }, [startedAt]);

  const base = startedAt || now;
  const elapsedSec = Math.max(0, (now - base) / 1000);
  return <span className="tabular-nums">{elapsedSec.toFixed(1)}s</span>;
});

const ROLE_META: Record<
  string,
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  general: { label: 'General', icon: Sparkles },
  coder: { label: 'Coder', icon: Code2 },
  architect: { label: 'Architect', icon: Layers },
  dataAnalyst: { label: 'Data Analyst', icon: BarChart2 },
};

const OPERATOR_LABELS: Record<string, string> = {
  contains: 'contains',
  notContains: 'not contains',
  equals: 'equals',
  isEmpty: 'is empty',
  isNotEmpty: 'is not empty',
  lengthGreaterThan: 'length >',
  lengthLessThan: 'length <',
};

function resolveAiModelLabel(settings: Record<string, string>): string {
  const providerId = settings.providerId?.trim();
  const modelId = settings.modelId?.trim();
  if (!providerId) return 'Active AI';
  if (providerId === 'existing') return 'Built-in AI';
  if (modelId) return modelId;
  try {
    const providers = storage.getAIProvidersState().providers || [];
    const found = providers.find((p) => p.id === providerId);
    if (found) {
      return found.model || found.models?.[0]?.name || found.name || 'Custom AI';
    }
  } catch {
    // ignore storage read error
  }
  return 'Active AI';
}

interface NodeDataPayload extends Record<string, unknown> {
  id: string;
  label: string;
  type: WorkflowNodeType;
  settings: Record<string, string>;
  status: WorkflowStepStatus;
  isSelected: boolean;
  isPeekOpen: boolean;
  output?: WorkflowOutput;
  outputSummary?: string;
  startedAt?: number;
  durationMs?: number;
  errorText?: string;
  isWorkflowRunning: boolean;
  onRunFromNode?: (nodeId: string) => void;
  onDuplicateNode?: (nodeId: string) => void;
  onToggleDisableNode?: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onOpenInspectorOutput?: (nodeId: string) => void;
  onClosePeek?: () => void;
}

/**
 * Memoized Sleek Glassmorphic Enterprise Canvas Node
 */
const CustomWorkflowNodeComponent = React.memo(function CustomWorkflowNodeComponent({
  data,
}: NodeProps<Node<NodeDataPayload>>) {
  const {
    id,
    label,
    type,
    settings,
    status,
    isSelected,
    isPeekOpen,
    output,
    outputSummary,
    startedAt,
    durationMs,
    errorText,
    isWorkflowRunning,
    onRunFromNode,
    onDuplicateNode,
    onToggleDisableNode,
    onDeleteNode,
    onOpenInspectorOutput,
    onClosePeek,
  } = data;

  const [copiedPeek, setCopiedPeek] = useState(false);

  const cfg = NODE_CONFIG[type] || NODE_CONFIG.input;
  const IconComponent = cfg.icon;

  const isInput = type === 'input';
  const isIf = type === 'if';
  const isDisabled = settings?.disabled === 'true';

  // Metadata items rendered cleanly with unboxed typographic discipline
  const aiModelLabel = type === 'ai' ? resolveAiModelLabel(settings || {}) : null;
  const aiRoleKey = type === 'ai' ? settings?.role || 'general' : null;
  const aiRoleMeta = aiRoleKey ? ROLE_META[aiRoleKey] || ROLE_META.general : null;

  const ifOpLabel =
    type === 'if'
      ? `${OPERATOR_LABELS[settings?.operator || 'contains'] || settings?.operator || 'contains'}${
          settings?.operator !== 'isEmpty' &&
          settings?.operator !== 'isNotEmpty' &&
          settings?.value2
            ? ` "${settings.value2.slice(0, 14)}"`
            : ''
        }`
      : null;

  const queryLabel =
    type === 'webSearch' || type === 'scholar'
      ? (settings?.query || '').trim()
      : null;

  const weatherLabel = type === 'weather' ? (settings?.city || '').trim() : null;

  const hasMeta = Boolean(aiModelLabel || ifOpLabel || queryLabel || weatherLabel);

  const summaryText = useMemo(() => {
    if (outputSummary) return outputSummary;
    if (output) return getOutputSummary(output);
    return '';
  }, [outputSummary, output]);

  const peekLinesText = useMemo(() => {
    if (!output || output.type === 'image') return '';
    return (output.value || '').split(/\r?\n/).slice(0, 12).join('\n');
  }, [output]);

  const handleCopyPeek = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!output?.value) return;
    navigator.clipboard.writeText(output.value);
    setCopiedPeek(true);
    setTimeout(() => setCopiedPeek(false), 1800);
  };

  return (
    <div
      className={`relative rounded-xl backdrop-blur-2xl transition-all duration-200 select-none min-w-[240px] max-w-[280px] px-4 py-3.5 ${
        isDisabled ? 'opacity-55 ' : ''
      }${
        isSelected
          ? 'bg-slate-900/95 ring-1 ring-cyan-400/70 shadow-[0_16px_40px_-12px_rgba(6,182,212,0.28)]'
          : status === 'running'
          ? 'bg-slate-900/95 ring-1 ring-cyan-400/60 shadow-[0_16px_40px_-12px_rgba(6,182,212,0.22)]'
          : status === 'error'
          ? 'bg-slate-900/95 ring-1 ring-rose-500/60 shadow-[0_16px_36px_-12px_rgba(244,63,94,0.2)]'
          : status === 'done'
          ? 'bg-slate-900/90 ring-1 ring-emerald-500/40 shadow-[0_12px_32px_-12px_rgba(16,185,129,0.14)]'
          : 'bg-slate-900/80 ring-1 ring-white/[0.07] hover:bg-slate-900/95 hover:ring-white/[0.15] shadow-[0_12px_32px_-12px_rgba(0,0,0,0.6)]'
      }`}
    >
      {/* Quick-action Floating Bar when node is selected (Touch-friendly >= 40px targets) */}
      {isSelected && (
        <div
          className="nodrag nopan absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 flex items-center gap-0.5 p-1 rounded-xl bg-slate-950/90 ring-1 ring-white/10 shadow-2xl backdrop-blur-2xl whitespace-nowrap"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={isWorkflowRunning}
            onClick={(e) => {
              e.stopPropagation();
              onRunFromNode?.(id);
            }}
            className="min-h-[40px] px-3 py-1.5 rounded-lg text-cyan-300 hover:bg-cyan-500/15 active:bg-cyan-500/25 text-[11px] font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40 whitespace-nowrap shrink-0"
            title="Run workflow starting from this step"
          >
            <Play size={12} className="fill-cyan-300" />
            <span>Run from here</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicateNode?.(id);
            }}
            className="min-h-[40px] px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.06] active:bg-white/10 text-[11px] font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            title="Duplicate this step"
          >
            <Copy size={12} />
            <span>Duplicate</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleDisableNode?.(id);
            }}
            className={`min-h-[40px] px-2.5 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              isDisabled
                ? 'text-amber-300 bg-amber-500/15 hover:bg-amber-500/25'
                : 'text-slate-300 hover:text-white hover:bg-white/[0.06]'
            }`}
            title={isDisabled ? 'Enable this step' : 'Disable this step'}
          >
            <Ban size={12} />
            <span>{isDisabled ? 'Enable' : 'Disable'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenInspectorOutput?.(id);
            }}
            className="min-h-[40px] px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/[0.06] active:bg-white/10 text-[11px] font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            title="View full output in inspector"
          >
            <Eye size={12} />
            <span>View output</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNode?.(id);
            }}
            className="min-h-[40px] px-2.5 py-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 active:bg-rose-500/25 text-[11px] font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            title="Delete this step"
          >
            <Trash2 size={12} />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Target handle on Left (unless input node) */}
      {!isInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3.5 !h-3.5 !-left-[7px] !bg-cyan-400 hover:!scale-125 !border-2 !border-slate-950 !transition-transform cursor-crosshair"
          title="Connect input to this step"
        />
      )}

      {/* Header: icon, label, unboxed status indicator */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`p-2 rounded-lg flex-shrink-0 ${cfg.color}`}>
            <IconComponent size={15} />
          </div>
          <div className="min-w-0">
            <h4 className="text-[13px] font-semibold text-slate-100 truncate leading-snug">
              {label}
            </h4>
            <span className="text-[11px] text-slate-400 block truncate">
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Unboxed semantic status indicator */}
        <div className="flex-shrink-0 pt-0.5">
          {isDisabled ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-400/90 font-medium">
              <Ban size={11} />
              <span>Disabled</span>
            </span>
          ) : status === 'running' ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-cyan-400 font-medium">
              <Loader2 size={11} className="animate-spin" />
              <span>Running</span>
            </span>
          ) : status === 'done' ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
              <CheckCircle2 size={11} />
              <span>Done</span>
            </span>
          ) : status === 'error' ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-medium">
              <AlertCircle size={11} />
              <span>Error</span>
            </span>
          ) : status === 'skipped' ? (
            <span
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 font-medium"
              title="Skipped"
            >
              <MinusCircle size={11} />
              <span>Skipped</span>
            </span>
          ) : (
            <span className="text-[11px] text-slate-500 font-mono">
              Idle
            </span>
          )}
        </div>
      </div>

      {/* Metadata Row (Unboxed typography with subtle · separators) */}
      {hasMeta && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-white/[0.05] text-[11px] text-slate-400">
          {type === 'ai' && aiModelLabel && (
            <span className="font-mono text-violet-300 truncate max-w-[130px]">
              {aiModelLabel}
            </span>
          )}
          {type === 'ai' && aiModelLabel && aiRoleMeta && (
            <span aria-hidden="true" className="text-slate-600">·</span>
          )}
          {type === 'ai' && aiRoleMeta && (
            <span className="text-cyan-300/90 inline-flex items-center gap-1">
              {React.createElement(aiRoleMeta.icon, { size: 11 })}
              <span>{aiRoleMeta.label}</span>
            </span>
          )}
          {type === 'if' && ifOpLabel && (
            <span className="font-mono text-emerald-300/90 truncate max-w-[210px]">
              {ifOpLabel}
            </span>
          )}
          {(type === 'webSearch' || type === 'scholar') && queryLabel && (
            <span className="font-mono text-sky-300/90 truncate max-w-[220px]">
              “{queryLabel.length > 28 ? queryLabel.slice(0, 28) + '…' : queryLabel}”
            </span>
          )}
          {type === 'weather' && weatherLabel && (
            <span className="font-mono text-amber-300/90 truncate max-w-[190px]">
              {weatherLabel}
            </span>
          )}
        </div>
      )}

      {/* Body: 2-line output preview or image thumbnail */}
      {output && (
        <div className="mt-2.5 pt-2 border-t border-white/[0.05]">
          {output.type === 'image' && output.value ? (
            <div className="rounded-lg overflow-hidden bg-slate-950/60">
              <img
                src={output.value}
                alt={label}
                referrerPolicy="no-referrer"
                className="w-full h-24 object-cover block"
              />
            </div>
          ) : output.value ? (
            <p className="text-[11px] text-slate-300/90 font-mono line-clamp-2 break-words leading-relaxed">
              {output.value}
            </p>
          ) : null}
        </div>
      )}

      {/* Footer: live timer while running, duration + summary when done, error text on error */}
      {(status === 'running' ||
        status === 'done' ||
        status === 'error' ||
        (status === 'skipped' && errorText)) && (
        <div className="mt-2.5 pt-2 border-t border-white/[0.05] flex items-center justify-between gap-2 text-[11px] font-mono tabular-nums">
          {status === 'running' && (
            <div className="flex items-center gap-1.5 text-cyan-400 font-medium">
              <Loader2 size={10} className="animate-spin" />
              <RunningLiveTimer startedAt={startedAt} />
            </div>
          )}

          {status === 'done' && (
            <div className="flex items-center justify-between w-full gap-2 text-slate-400">
              <span className="text-emerald-400/90">
                {durationMs !== undefined ? `${(durationMs / 1000).toFixed(1)}s` : '0.0s'}
                {summaryText ? ` · ${summaryText}` : ''}
              </span>
              <span className="text-[10px] text-slate-500 font-sans">Inspect</span>
            </div>
          )}

          {status === 'error' && (
            <div className="text-rose-400 truncate w-full" title={errorText}>
              {errorText || 'Execution failed'}
            </div>
          )}

          {status === 'skipped' && errorText && (
            <div className="text-amber-400/80 truncate w-full" title={errorText}>
              {errorText === 'disabled' ? 'Disabled · pass-through' : errorText}
            </div>
          )}
        </div>
      )}

      {/* Output Peek Floating Glass Surface */}
      {isPeekOpen && status === 'done' && output && (
        <div
          className="nodrag nopan absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 w-[300px] sm:w-[340px] rounded-xl bg-slate-950/95 ring-1 ring-white/10 shadow-2xl backdrop-blur-2xl p-4 space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
              <span className="text-xs font-semibold text-white truncate">
                {label}
              </span>
              {summaryText && (
                <>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-[11px] font-mono text-slate-400 flex-shrink-0 tabular-nums">
                    {summaryText}
                  </span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClosePeek?.();
              }}
              className="p-1 rounded-lg hover:bg-white/[0.06] text-slate-400 hover:text-white transition-colors"
            >
              <X size={13} />
            </button>
          </div>

          {output.type === 'image' ? (
            <div className="rounded-lg overflow-hidden bg-slate-900/50">
              <img
                src={output.value}
                alt={label}
                referrerPolicy="no-referrer"
                className="w-full max-h-56 object-contain block"
              />
            </div>
          ) : (
            <pre className="text-[11px] text-slate-200 font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto p-3 rounded-lg bg-white/[0.02] leading-relaxed">
              {peekLinesText || '(Empty output)'}
            </pre>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            {output.type !== 'image' && (
              <button
                type="button"
                onClick={handleCopyPeek}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                {copiedPeek ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={12} />
                    <span>Copy</span>
                  </>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenInspectorOutput?.(id);
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
            >
              <Maximize2 size={12} />
              <span>Full output</span>
            </button>
          </div>
        </div>
      )}

      {/* Source handles on Right */}
      {!isIf ? (
        <Handle
          type="source"
          position={Position.Right}
          id="default"
          className="!w-3.5 !h-3.5 !-right-[7px] !bg-cyan-400 hover:!scale-125 !border-2 !border-slate-950 !transition-transform cursor-crosshair"
          title="Connect output to next step"
        />
      ) : (
        <>
          {/* YES branch handle */}
          <div className="absolute -right-2 top-[32%] flex items-center">
            <span className="text-[9px] font-mono font-semibold text-emerald-400 bg-slate-950/90 px-1 py-0.5 rounded mr-1.5 pointer-events-none">
              YES
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="yes"
              className="!w-3.5 !h-3.5 !bg-emerald-400 hover:!scale-125 !border-2 !border-slate-950 !transition-transform cursor-crosshair"
              title="Connect 'yes' branch"
            />
          </div>

          {/* NO branch handle */}
          <div className="absolute -right-2 top-[68%] flex items-center">
            <span className="text-[9px] font-mono font-semibold text-rose-400 bg-slate-950/90 px-1 py-0.5 rounded mr-1.5 pointer-events-none">
              NO
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="no"
              className="!w-3.5 !h-3.5 !bg-rose-400 hover:!scale-125 !border-2 !border-slate-950 !transition-transform cursor-crosshair"
              title="Connect 'no' branch"
            />
          </div>
        </>
      )}
    </div>
  );
});

interface CustomEdgeData extends Record<string, unknown> {
  sourceStatus: WorkflowStepStatus;
  targetStatus: WorkflowStepStatus;
  isRunning: boolean;
  branch?: 'yes' | 'no';
}

/**
 * Custom Edge with live glowing dots (SVG animateMotion) when source is 'done' and target is 'running'
 */
const CustomWorkflowEdge = React.memo(function CustomWorkflowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
}: EdgeProps<Edge<CustomEdgeData>>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const sourceStatus = data?.sourceStatus || 'idle';
  const targetStatus = data?.targetStatus || 'idle';
  const isRunning = Boolean(data?.isRunning);
  const branch = data?.branch;

  const isFlowing = isRunning && sourceStatus === 'done' && targetStatus === 'running';
  const isError = sourceStatus === 'error' || targetStatus === 'error';
  const isFinished = sourceStatus === 'done' && targetStatus === 'done';

  let strokeColor = '#334155';
  if (isError) {
    strokeColor = '#f43f5e';
  } else if (isFlowing) {
    strokeColor = '#22d3ee';
  } else if (branch === 'yes') {
    strokeColor = isFinished ? '#10b981' : '#059669';
  } else if (branch === 'no') {
    strokeColor = isFinished ? '#f43f5e' : '#e11d48';
  } else if (isFinished) {
    strokeColor = '#0ea5e9';
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth: isFlowing ? 2.2 : 1.75,
          transition: 'stroke 200ms ease',
        }}
      />

      {isFlowing && (
        <g>
          {[0, 0.45, 0.9].map((delay, index) => (
            <circle
              key={index}
              r={3.5}
              fill="#22d3ee"
              style={{ filter: 'drop-shadow(0 0 6px #22d3ee)' }}
            >
              <animateMotion
                dur="1.35s"
                begin={`${delay}s`}
                repeatCount="indefinite"
                path={edgePath}
              />
            </circle>
          ))}
        </g>
      )}

      {branch && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wider bg-slate-950/90 backdrop-blur-md ${
              branch === 'yes' ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {branch.toUpperCase()}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
});

const nodeTypes = {
  workflowNode: CustomWorkflowNodeComponent,
};

const edgeTypes = {
  workflowEdge: CustomWorkflowEdge,
};

export function WorkflowCanvas({
  nodes,
  edges,
  stepStatuses,
  stepOutputs,
  stepStartTimes = {},
  stepDurations = {},
  stepOutputSummaries = {},
  stepErrors = {},
  isRunning,
  selectedNodeId,
  onSelectNode,
  onUpdateNodesPosition,
  onConnect,
  onDeleteEdge,
  onTidy,
  onRunFromNode,
  onDuplicateNode,
  onToggleDisableNode,
  onDeleteNode,
  onOpenInspectorOutput,
}: WorkflowCanvasProps) {
  const [peekNodeId, setPeekNodeId] = useState<string | null>(null);

  const handleClosePeek = useCallback(() => {
    setPeekNodeId(null);
  }, []);

  const rfNodes = useMemo<Node<NodeDataPayload>[]>(() => {
    return nodes.map((n) => {
      const status = stepStatuses[n.id] || 'idle';
      const isSelected = selectedNodeId === n.id;
      const isPeekOpen = peekNodeId === n.id && status === 'done';

      return {
        id: n.id,
        type: 'workflowNode',
        position: { x: n.x, y: n.y },
        zIndex: isSelected || isPeekOpen ? 50 : 1,
        data: {
          id: n.id,
          label: n.label,
          type: n.type,
          settings: n.settings || {},
          status,
          isSelected,
          isPeekOpen,
          output: stepOutputs[n.id],
          outputSummary: stepOutputSummaries[n.id],
          startedAt: stepStartTimes[n.id],
          durationMs: stepDurations[n.id],
          errorText: stepErrors[n.id],
          isWorkflowRunning: isRunning,
          onRunFromNode,
          onDuplicateNode,
          onToggleDisableNode,
          onDeleteNode,
          onOpenInspectorOutput,
          onClosePeek: handleClosePeek,
        },
      };
    });
  }, [
    nodes,
    stepStatuses,
    stepOutputs,
    stepOutputSummaries,
    stepStartTimes,
    stepDurations,
    stepErrors,
    isRunning,
    selectedNodeId,
    peekNodeId,
    onRunFromNode,
    onDuplicateNode,
    onToggleDisableNode,
    onDeleteNode,
    onOpenInspectorOutput,
    handleClosePeek,
  ]);

  const rfEdges = useMemo<Edge<CustomEdgeData>[]>(() => {
    return edges.map((e) => {
      const sourceStatus = stepStatuses[e.from] || 'idle';
      const targetStatus = stepStatuses[e.to] || 'idle';
      const isError = sourceStatus === 'error' || targetStatus === 'error';
      const isFlowing = isRunning && sourceStatus === 'done' && targetStatus === 'running';
      const isFinished = sourceStatus === 'done' && targetStatus === 'done';

      let edgeColor = '#334155';
      if (isError) edgeColor = '#f43f5e';
      else if (isFlowing) edgeColor = '#22d3ee';
      else if (e.branch === 'yes') edgeColor = isFinished ? '#10b981' : '#059669';
      else if (e.branch === 'no') edgeColor = isFinished ? '#f43f5e' : '#e11d48';
      else if (isFinished) edgeColor = '#0ea5e9';

      return {
        id: e.id,
        source: e.from,
        target: e.to,
        type: 'workflowEdge',
        sourceHandle: e.branch || 'default',
        data: {
          sourceStatus,
          targetStatus,
          isRunning,
          branch: e.branch,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 15,
          height: 15,
        },
      };
    });
  }, [edges, stepStatuses, isRunning]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectNode(node.id);
      if (stepStatuses[node.id] === 'done' && stepOutputs[node.id]) {
        setPeekNodeId((prev) => (prev === node.id ? null : node.id));
      } else {
        setPeekNodeId(null);
      }
    },
    [onSelectNode, stepStatuses, stepOutputs],
  );

  const handlePaneClick = useCallback(() => {
    onSelectNode(null);
    setPeekNodeId(null);
  }, [onSelectNode]);

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, __: Node, currentNodes: Node[]) => {
      const updates = currentNodes.map((n) => ({
        id: n.id,
        x: Math.round(n.position.x),
        y: Math.round(n.position.y),
      }));
      onUpdateNodesPosition(updates);
    },
    [onUpdateNodesPosition],
  );

  const handleEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      onDeleteEdge(edge.id);
    },
    [onDeleteEdge],
  );

  return (
    <div className="w-full h-full min-h-[540px] relative overflow-hidden bg-slate-950/50 backdrop-blur-xl">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodeDragStop={handleNodeDragStop}
        onConnect={onConnect}
        onEdgeClick={handleEdgeClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1e293b" />
        <Controls className="!bg-slate-900/80 !border-0 !shadow-xl !backdrop-blur-xl [&>button]:!bg-transparent [&>button]:!border-b [&>button]:!border-white/[0.06] [&>button]:!text-slate-300 hover:[&>button]:!bg-white/[0.06] hover:[&>button]:!text-white" />
        <div className="hidden md:block">
          <MiniMap
            nodeColor={(n) => {
              const nodeData = n.data as NodeDataPayload | undefined;
              if (nodeData?.status === 'running') return '#06b6d4';
              if (nodeData?.status === 'done') return '#10b981';
              if (nodeData?.status === 'error') return '#f43f5e';
              return '#334155';
            }}
            maskColor="rgba(2, 6, 23, 0.78)"
            className="!bg-slate-900/70 !border-0 !ring-1 !ring-white/[0.06] !rounded-xl overflow-hidden backdrop-blur-xl"
          />
        </div>
      </ReactFlow>

      {/* Floating Tidy Action */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={onTidy}
          className="px-3.5 py-2 rounded-lg bg-slate-900/75 hover:bg-slate-800/90 text-slate-300 hover:text-white ring-1 ring-white/[0.07] text-xs font-medium backdrop-blur-xl transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          title="Auto-arrange nodes left to right by flow depth"
        >
          <Sparkles size={13} className="text-cyan-400" />
          <span>Tidy Layout</span>
        </button>
      </div>
    </div>
  );
}
