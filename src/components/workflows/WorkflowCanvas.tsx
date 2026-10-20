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
    color: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
    desc: 'Starting payload text',
  },
  webSearch: {
    label: 'Web Search',
    icon: Search,
    color: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    desc: 'Live web search results',
  },
  webFetch: {
    label: 'Web Fetch',
    icon: Globe,
    color: 'text-teal-400 bg-teal-500/10 border-teal-500/30',
    desc: 'Read webpage article content',
  },
  scholar: {
    label: 'Scholar',
    icon: GraduationCap,
    color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30',
    desc: 'Academic papers & abstracts',
  },
  ai: {
    label: 'AI Agent',
    icon: Sparkles,
    color: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    desc: 'LLM reasoning & synthesis',
  },
  image: {
    label: 'Generate Image',
    icon: ImageIcon,
    color: 'text-pink-400 bg-pink-500/10 border-pink-500/30',
    desc: 'AI studio image creation',
  },
  weather: {
    label: 'Weather',
    icon: CloudSun,
    color: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    desc: 'Realtime city weather telemetry',
  },
  nasa: {
    label: 'NASA APOD',
    icon: Rocket,
    color: 'text-red-400 bg-red-500/10 border-red-500/30',
    desc: 'Astronomy picture of the day',
  },
  if: {
    label: 'Condition (If)',
    icon: GitFork,
    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
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
  return <span>{elapsedSec.toFixed(1)}s</span>;
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
 * Memoized Rich Canvas Node Component
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

  // Build chips row metadata
  const aiModelChip = type === 'ai' ? resolveAiModelLabel(settings || {}) : null;
  const aiRoleKey = type === 'ai' ? settings?.role || 'general' : null;
  const aiRoleMeta = aiRoleKey ? ROLE_META[aiRoleKey] || ROLE_META.general : null;

  const ifOpChip =
    type === 'if'
      ? `${OPERATOR_LABELS[settings?.operator || 'contains'] || settings?.operator || 'contains'}${
          settings?.operator !== 'isEmpty' &&
          settings?.operator !== 'isNotEmpty' &&
          settings?.value2
            ? ` "${settings.value2.slice(0, 14)}"`
            : ''
        }`
      : null;

  const queryChip =
    type === 'webSearch' || type === 'scholar'
      ? (settings?.query || '').trim()
      : null;

  const weatherChip = type === 'weather' ? (settings?.city || '').trim() : null;

  const hasChips = Boolean(aiModelChip || ifOpChip || queryChip || weatherChip);

  // Summary badge text
  const summaryText = useMemo(() => {
    if (outputSummary) return outputSummary;
    if (output) return getOutputSummary(output);
    return '';
  }, [outputSummary, output]);

  // First 12 lines for Output Peek
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
      className={`relative rounded-2xl bg-slate-900/95 border backdrop-blur-xl shadow-xl transition-all duration-200 select-none min-w-[235px] max-w-[275px] p-3.5 ${
        isDisabled ? 'opacity-65 border-amber-500/30 ' : ''
      }${
        isSelected
          ? 'border-cyan-400 ring-2 ring-cyan-400/40 shadow-cyan-500/20'
          : status === 'running'
          ? 'border-cyan-500/80 ring-2 ring-cyan-500/30 shadow-cyan-500/20'
          : status === 'error'
          ? 'border-rose-500/80 shadow-rose-500/20'
          : status === 'done'
          ? 'border-emerald-500/60 shadow-emerald-500/10'
          : 'border-white/10 hover:border-white/20'
      }`}
    >
      {/* Quick-action Floating Toolbar when node is selected (Touch-friendly >= 40px buttons) */}
      {isSelected && (
        <div
          className="nodrag nopan absolute bottom-full left-1/2 -translate-x-1/2 mb-3 z-50 flex items-center gap-1 p-1.5 rounded-2xl bg-slate-900/95 border border-cyan-500/40 shadow-2xl backdrop-blur-xl whitespace-nowrap"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            disabled={isWorkflowRunning}
            onClick={(e) => {
              e.stopPropagation();
              onRunFromNode?.(id);
            }}
            className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 active:bg-cyan-500/35 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-40"
            title="Run workflow starting from this step"
          >
            <Play size={13} className="fill-cyan-300" />
            <span>Run from here</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDuplicateNode?.(id);
            }}
            className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 active:bg-white/20 text-slate-200 border border-white/10 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
            title="Duplicate this step"
          >
            <Copy size={13} />
            <span>Duplicate</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleDisableNode?.(id);
            }}
            className={`min-h-[40px] px-2.5 py-1.5 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
              isDisabled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                : 'bg-white/5 text-slate-200 border-white/10 hover:bg-white/15'
            }`}
            title={isDisabled ? 'Enable this step' : 'Disable this step'}
          >
            <Ban size={13} />
            <span>{isDisabled ? 'Enable' : 'Disable'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenInspectorOutput?.(id);
            }}
            className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 active:bg-white/20 text-slate-200 border border-white/10 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
            title="View full output in inspector"
          >
            <Eye size={13} />
            <span>View output</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteNode?.(id);
            }}
            className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 text-rose-300 border border-rose-500/30 text-[11px] font-medium flex items-center gap-1.5 transition-colors"
            title="Delete this step"
          >
            <Trash2 size={13} />
            <span>Delete</span>
          </button>
        </div>
      )}

      {/* Target handle on Left (unless input node) */}
      {!isInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-4 !h-4 !-left-2 !bg-cyan-400 hover:!scale-125 !border-2 !border-slate-950 !transition-transform cursor-crosshair"
          title="Connect input to this step"
        />
      )}

      {/* A1) Node Header: icon, label, status badge */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg border flex-shrink-0 ${cfg.color}`}>
            <IconComponent size={15} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-white truncate leading-tight">
              {label}
            </h4>
            <span className="text-[10px] text-slate-400 font-mono block truncate">
              {cfg.label}
            </span>
          </div>
        </div>

        {/* Status badge (idle / running spinner / done / error / skipped / disabled) */}
        <div className="flex-shrink-0">
          {isDisabled ? (
            <div className="flex items-center gap-1 text-[10px] text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30 font-medium">
              <Ban size={10} />
              <span>Disabled</span>
            </div>
          ) : status === 'running' ? (
            <div className="flex items-center gap-1 text-[10px] text-cyan-300 bg-cyan-500/15 px-2 py-0.5 rounded-full border border-cyan-500/30 font-medium">
              <Loader2 size={11} className="animate-spin" />
              <span>Running</span>
            </div>
          ) : status === 'done' ? (
            <div className="flex items-center gap-1 text-[10px] text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30 font-medium">
              <CheckCircle2 size={11} />
              <span>Done</span>
            </div>
          ) : status === 'error' ? (
            <div className="flex items-center gap-1 text-[10px] text-rose-300 bg-rose-500/15 px-2 py-0.5 rounded-full border border-rose-500/30 font-medium">
              <AlertCircle size={11} />
              <span>Error</span>
            </div>
          ) : status === 'skipped' ? (
            <div
              className="flex items-center gap-1 text-[10px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 font-medium"
              title="Skipped"
            >
              <MinusCircle size={11} />
              <span>Skipped</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-slate-500 bg-white/[0.03] px-2 py-0.5 rounded-full border border-white/5 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
              <span>Idle</span>
            </div>
          )}
        </div>
      </div>

      {/* A2) Chips row */}
      {hasChips && (
        <div className="flex flex-wrap items-center gap-1.5 mt-2.5 pt-2 border-t border-white/5">
          {type === 'ai' && aiModelChip && (
            <span className="text-[10px] font-mono text-purple-300 bg-purple-500/10 border border-purple-500/25 px-1.5 py-0.5 rounded-md truncate max-w-[130px]">
              {aiModelChip}
            </span>
          )}
          {type === 'ai' && aiRoleMeta && (
            <span className="text-[10px] font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1">
              {React.createElement(aiRoleMeta.icon, { size: 10 })}
              <span>{aiRoleMeta.label}</span>
            </span>
          )}
          {type === 'if' && ifOpChip && (
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.5 rounded-md truncate max-w-[200px]">
              {ifOpChip}
            </span>
          )}
          {(type === 'webSearch' || type === 'scholar') && queryChip && (
            <span className="text-[10px] font-mono text-blue-300 bg-blue-500/10 border border-blue-500/25 px-1.5 py-0.5 rounded-md truncate max-w-[210px]">
              “{queryChip.length > 28 ? queryChip.slice(0, 28) + '…' : queryChip}”
            </span>
          )}
          {type === 'weather' && weatherChip && (
            <span className="text-[10px] font-mono text-amber-300 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded-md truncate max-w-[180px]">
              📍 {weatherChip}
            </span>
          )}
        </div>
      )}

      {/* A3) Body: 2-line output preview or image thumbnail */}
      {output && (
        <div className="mt-2.5 pt-2 border-t border-white/5">
          {output.type === 'image' && output.value ? (
            <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-950">
              <img
                src={output.value}
                alt={label}
                className="w-full h-24 object-cover block"
              />
            </div>
          ) : output.value ? (
            <p className="text-[11px] text-slate-300 font-mono line-clamp-2 break-words leading-relaxed bg-slate-950/70 px-2 py-1.5 rounded-lg border border-white/5">
              {output.value}
            </p>
          ) : null}
        </div>
      )}

      {/* A4) Footer: live timer while running, duration + summary when done, error text on error */}
      {(status === 'running' ||
        status === 'done' ||
        status === 'error' ||
        (status === 'skipped' && errorText)) && (
        <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between gap-2 text-[10px] font-mono">
          {status === 'running' && (
            <div className="flex items-center gap-1.5 text-cyan-400 font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              <RunningLiveTimer startedAt={startedAt} />
            </div>
          )}

          {status === 'done' && (
            <div className="flex items-center justify-between w-full gap-2 text-slate-400">
              <span className="text-emerald-400 font-semibold">
                {durationMs !== undefined ? `${(durationMs / 1000).toFixed(1)}s` : '0.0s'}
                {summaryText ? ` · ${summaryText}` : ''}
              </span>
              <span className="text-[9px] text-slate-500">Tap to peek</span>
            </div>
          )}

          {status === 'error' && (
            <div className="text-rose-400 truncate w-full" title={errorText}>
              {errorText || 'Execution failed'}
            </div>
          )}

          {status === 'skipped' && errorText && (
            <div className="text-amber-400/90 truncate w-full" title={errorText}>
              {errorText === 'disabled' ? 'Disabled (pass-through)' : errorText}
            </div>
          )}
        </div>
      )}

      {/* C) Output Peek Floating Card (Touch friendly, appears when a DONE node is tapped) */}
      {isPeekOpen && status === 'done' && output && (
        <div
          className="nodrag nopan absolute top-full left-1/2 -translate-x-1/2 mt-3 z-50 w-[300px] sm:w-[340px] rounded-2xl bg-slate-900/98 border border-emerald-500/40 shadow-2xl backdrop-blur-2xl p-3.5 space-y-2.5"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
              <span className="text-xs font-bold text-white truncate">
                {label} — Output
              </span>
              {summaryText && (
                <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 flex-shrink-0">
                  {summaryText}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClosePeek?.();
              }}
              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
            >
              <X size={13} />
            </button>
          </div>

          {output.type === 'image' ? (
            <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-950">
              <img
                src={output.value}
                alt={label}
                className="w-full max-h-56 object-contain block"
              />
            </div>
          ) : (
            <pre className="text-[11px] text-slate-200 font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto p-2.5 rounded-xl bg-slate-950/90 border border-white/10 leading-relaxed">
              {peekLinesText || '(Empty output)'}
            </pre>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            {output.type !== 'image' && (
              <button
                type="button"
                onClick={handleCopyPeek}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                {copiedPeek ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
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
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-md shadow-cyan-500/20"
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
          className="!w-4 !h-4 !-right-2 !bg-cyan-400 hover:!scale-125 !border-2 !border-slate-950 !transition-transform cursor-crosshair"
          title="Connect output to next step"
        />
      ) : (
        <>
          {/* YES branch handle */}
          <div className="absolute -right-2 top-[32%] flex items-center">
            <span className="text-[9px] font-bold text-emerald-400 bg-slate-950/90 px-1 py-0.5 rounded border border-emerald-500/30 mr-1.5 pointer-events-none">
              YES
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="yes"
              className="!w-4 !h-4 !bg-emerald-400 hover:!scale-125 !border-2 !border-slate-950 !transition-transform cursor-crosshair"
              title="Connect 'yes' branch"
            />
          </div>

          {/* NO branch handle */}
          <div className="absolute -right-2 top-[68%] flex items-center">
            <span className="text-[9px] font-bold text-rose-400 bg-slate-950/90 px-1 py-0.5 rounded border border-rose-500/30 mr-1.5 pointer-events-none">
              NO
            </span>
            <Handle
              type="source"
              position={Position.Right}
              id="no"
              className="!w-4 !h-4 !bg-rose-400 hover:!scale-125 !border-2 !border-slate-950 !transition-transform cursor-crosshair"
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
 * B) Custom Edge with live glowing dots (SVG animateMotion) when source is 'done' and target is 'running'
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

  let strokeColor = '#475569'; // calm slate default
  if (isError) {
    strokeColor = '#f43f5e'; // red on error
  } else if (isFlowing) {
    strokeColor = '#22d3ee'; // glowing cyan when flowing
  } else if (branch === 'yes') {
    strokeColor = isFinished ? '#10b981' : '#059669';
  } else if (branch === 'no') {
    strokeColor = isFinished ? '#f43f5e' : '#e11d48';
  } else if (isFinished) {
    strokeColor = '#0ea5e9'; // calm solid color when finished
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: strokeColor,
          strokeWidth: isFlowing ? 2.5 : 2,
          transition: 'stroke 200ms ease',
        }}
      />

      {/* 3 glowing dots moving along the line while source is 'done' and target is 'running' */}
      {isFlowing && (
        <g>
          {[0, 0.45, 0.9].map((delay, index) => (
            <circle
              key={index}
              r={4}
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

      {/* Keep existing YES / NO branch labels */}
      {branch && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'none',
            }}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider border bg-slate-950/90 ${
              branch === 'yes'
                ? 'text-emerald-400 border-emerald-500/40'
                : 'text-rose-400 border-rose-500/40'
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

  // Convert workflow nodes to ReactFlow nodes
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

  // Convert workflow edges to ReactFlow edges
  const rfEdges = useMemo<Edge<CustomEdgeData>[]>(() => {
    return edges.map((e) => {
      const sourceStatus = stepStatuses[e.from] || 'idle';
      const targetStatus = stepStatuses[e.to] || 'idle';
      const isError = sourceStatus === 'error' || targetStatus === 'error';
      const isFlowing = isRunning && sourceStatus === 'done' && targetStatus === 'running';
      const isFinished = sourceStatus === 'done' && targetStatus === 'done';

      let edgeColor = '#475569';
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
          width: 16,
          height: 16,
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
      const shouldDelete = window.confirm(`Delete connection from this edge?`);
      if (shouldDelete) {
        onDeleteEdge(edge.id);
      }
    },
    [onDeleteEdge],
  );

  return (
    <div className="w-full h-full min-h-[520px] relative rounded-2xl overflow-hidden border border-white/10 bg-slate-950/90 shadow-2xl">
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
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#334155" />
        <Controls className="!bg-slate-900 !border-white/10 !fill-white !text-white [&>button]:!bg-slate-800 [&>button]:!border-white/10 [&>button]:!text-white hover:[&>button]:!bg-slate-700" />
        <div className="hidden md:block">
          <MiniMap
            nodeColor={(n) => {
              const nodeData = n.data as NodeDataPayload | undefined;
              if (nodeData?.status === 'running') return '#06b6d4';
              if (nodeData?.status === 'done') return '#10b981';
              if (nodeData?.status === 'error') return '#f43f5e';
              return '#475569';
            }}
            maskColor="rgba(2, 6, 23, 0.75)"
            className="!bg-slate-900/90 !border !border-white/10 !rounded-xl overflow-hidden shadow-lg"
          />
        </div>
      </ReactFlow>

      {/* Floating Tidy Button */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={onTidy}
          className="px-3 py-1.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/10 text-xs font-medium backdrop-blur-md shadow-lg transition-all flex items-center gap-1.5"
          title="Auto-arrange nodes left to right by flow depth"
        >
          <Sparkles size={13} className="text-cyan-400" />
          <span>Tidy Layout</span>
        </button>
      </div>
    </div>
  );
}
