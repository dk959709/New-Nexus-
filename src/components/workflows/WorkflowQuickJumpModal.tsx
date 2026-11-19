import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Play,
  Wand2,
  ListChecks,
  Sliders,
  ShieldCheck,
  Layers,
  GitBranch,
  History,
  ArrowRight,
  Command,
} from 'lucide-react';
import type { WorkflowNode } from '@/types';
import { NODE_CONFIG } from './WorkflowCanvas';

interface QuickActionItem {
  id: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
  onSelect: () => void;
}

interface WorkflowQuickJumpModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: WorkflowNode[];
  onJumpToNode: (nodeId: string) => void;
  onRun: () => void;
  onOpenAiGenerator: () => void;
  onOpenBatchRunner: () => void;
  onOpenVariables: () => void;
  onOpenValidator: () => void;
  onOpenLibrary: () => void;
  onOpenHistory: () => void;
  onToggleViewMode: () => void;
  viewMode: 'list' | 'canvas';
}

export const WorkflowQuickJumpModal: React.FC<WorkflowQuickJumpModalProps> = ({
  isOpen,
  onClose,
  nodes,
  onJumpToNode,
  onRun,
  onOpenAiGenerator,
  onOpenBatchRunner,
  onOpenVariables,
  onOpenValidator,
  onOpenLibrary,
  onOpenHistory,
  onToggleViewMode,
  viewMode,
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [isOpen]);

  const actions: QuickActionItem[] = useMemo(
    () => [
      {
        id: 'run',
        label: 'Run Pipeline Now',
        hint: 'Execute all steps from start',
        icon: Play,
        accent: 'text-cyan-300',
        onSelect: onRun,
      },
      {
        id: 'ai-gen',
        label: 'Generate Workflow with AI',
        hint: 'Describe a goal to build steps automatically',
        icon: Wand2,
        accent: 'text-violet-300',
        onSelect: onOpenAiGenerator,
      },
      {
        id: 'batch',
        label: 'Open Batch Runner',
        hint: 'Run multiple inputs and export CSV/Markdown',
        icon: ListChecks,
        accent: 'text-fuchsia-300',
        onSelect: onOpenBatchRunner,
      },
      {
        id: 'vars',
        label: 'Edit Workflow Variables',
        hint: 'Manage {{vars.key}} reusable parameters',
        icon: Sliders,
        accent: 'text-sky-300',
        onSelect: onOpenVariables,
      },
      {
        id: 'validate',
        label: 'Run Health Diagnostics',
        hint: 'Check missing fields, broken links & loops',
        icon: ShieldCheck,
        accent: 'text-emerald-300',
        onSelect: onOpenValidator,
      },
      {
        id: 'library',
        label: 'Open Workflow Library',
        hint: 'Search, pin, tag, and organize workflows',
        icon: Layers,
        accent: 'text-amber-300',
        onSelect: onOpenLibrary,
      },
      {
        id: 'history',
        label: 'View Run History & Diff',
        hint: 'Inspect past runs and compare outputs',
        icon: History,
        accent: 'text-cyan-300',
        onSelect: onOpenHistory,
      },
      {
        id: 'toggle-view',
        label: viewMode === 'list' ? 'Switch to Graph Canvas' : 'Switch to Pipeline List',
        hint: 'Toggle visual graph vs linear editor',
        icon: GitBranch,
        accent: 'text-indigo-300',
        onSelect: onToggleViewMode,
      },
    ],
    [
      onRun,
      onOpenAiGenerator,
      onOpenBatchRunner,
      onOpenVariables,
      onOpenValidator,
      onOpenLibrary,
      onOpenHistory,
      onToggleViewMode,
      viewMode,
    ],
  );

  const q = query.trim().toLowerCase();

  const matchedActions = useMemo(
    () =>
      q
        ? actions.filter(
            (a) => a.label.toLowerCase().includes(q) || a.hint.toLowerCase().includes(q),
          )
        : actions,
    [actions, q],
  );

  const matchedNodes = useMemo(
    () =>
      q
        ? nodes.filter(
            (n) =>
              n.label.toLowerCase().includes(q) ||
              n.type.toLowerCase().includes(q) ||
              (NODE_CONFIG[n.type]?.label || '').toLowerCase().includes(q),
          )
        : nodes,
    [nodes, q],
  );

  if (!isOpen) return null;

  return (
    <div
      className="wf-modal-backdrop fixed inset-0 z-[1320] bg-[#080b12]/80 backdrop-blur-md flex items-start justify-center p-3 sm:pt-16"
      onClick={onClose}
    >
      <div
        className="wf-cyber-card wf-modal-panel rounded-2xl max-w-xl w-full max-h-[85dvh] flex flex-col overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.9)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-white/10">
          <Command size={18} className="text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Jump to a step or run a workflow command..."
            className="flex-1 bg-transparent text-base sm:text-sm text-white placeholder-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300"
            aria-label="Close Quick Command"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
          {matchedNodes.length > 0 && (
            <div className="space-y-1.5">
              <div className="px-2 text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
                Pipeline Steps ({matchedNodes.length})
              </div>
              {matchedNodes.map((node, idx) => {
                const cfg = NODE_CONFIG[node.type] || NODE_CONFIG.input;
                const Icon = cfg.icon;
                return (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => {
                      onJumpToNode(node.id);
                      onClose();
                    }}
                    className="w-full min-h-[46px] px-3 py-2 rounded-xl hover:bg-cyan-500/15 active:bg-cyan-500/25 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-xs font-mono text-zinc-500 w-5">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className={`p-1.5 rounded-lg border border-white/10 ${cfg.color}`}>
                        <Icon size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{node.label}</div>
                        <div className="text-xs text-zinc-400 truncate">{cfg.label}</div>
                      </div>
                    </div>
                    <ArrowRight size={15} className="text-cyan-400 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {matchedActions.length > 0 && (
            <div className="space-y-1.5">
              <div className="px-2 text-xs font-mono font-bold uppercase tracking-wider text-zinc-400">
                Studio Actions
              </div>
              {matchedActions.map((act) => {
                const Icon = act.icon;
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => {
                      onClose();
                      act.onSelect();
                    }}
                    className="w-full min-h-[46px] px-3 py-2 rounded-xl hover:bg-white/[0.06] active:bg-white/10 flex items-center justify-between gap-3 text-left transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-zinc-900 border border-white/10 shrink-0">
                        <Icon size={16} className={act.accent} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-white truncate">{act.label}</div>
                        <div className="text-xs text-zinc-400 truncate">{act.hint}</div>
                      </div>
                    </div>
                    <ArrowRight size={15} className="text-zinc-500 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}

          {matchedNodes.length === 0 && matchedActions.length === 0 && (
            <div className="py-8 text-center text-sm text-zinc-400 flex flex-col items-center gap-2">
              <Search size={22} className="text-zinc-600" />
              <span>No matching steps or actions found.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
