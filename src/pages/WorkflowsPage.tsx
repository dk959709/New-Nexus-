import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowStepStatus,
  WorkflowOutput,
  AIProviderConfig,
  Skill,
  WorkflowRunRecord,
  WorkflowRunStepRecord,
  WorkflowRunStatus,
  WorkflowVariable,
} from '@/types';
import { storage } from '@/lib/storage';
import { estimateTokens } from '@/lib/skills';
import {
  runWorkflow,
  hasWorkflowCycle,
  getOutputSummary,
  getAncestorNodeIds,
  getDownstreamNodeIds,
  executeSingleNodeStep,
  resolveNodeSettings,
  buildWorkflowVariableMap,
  analyzeWorkflowHealth,
} from '@/lib/workflowEngine';
import {
  WorkflowCanvas,
  NODE_CONFIG,
} from '@/components/workflows/WorkflowCanvas';
import { WorkflowTelemetryGraphics } from '@/components/workflows/WorkflowTelemetryGraphics';
import { WorkflowAiGeneratorModal } from '@/components/workflows/WorkflowAiGeneratorModal';
import { WorkflowVariablesModal } from '@/components/workflows/WorkflowVariablesModal';
import { WorkflowValidatorPanel } from '@/components/workflows/WorkflowValidatorPanel';
import { WorkflowBatchRunnerModal } from '@/components/workflows/WorkflowBatchRunnerModal';
import { WorkflowRunDiffModal } from '@/components/workflows/WorkflowRunDiffModal';
import { WorkflowLibraryDrawer } from '@/components/workflows/WorkflowLibraryDrawer';
import { WorkflowQuickJumpModal } from '@/components/workflows/WorkflowQuickJumpModal';
import {
  Play,
  Square,
  RotateCcw,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Check,
  AlertTriangle,
  Download,
  Upload,
  Layers,
  Sparkles,
  GitBranch,
  X,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  MinusCircle,
  Ban,
  Snowflake,
  Clock,
  History,
  Rocket,
  FileText,
  Mail,
  Webhook,
  Wand2,
  Sliders,
  ShieldCheck,
  Undo2,
  Redo2,
  ListChecks,
  GitCompare,
  Command,
  Star,
  Type,
  ShieldAlert,
  GitMerge,
} from 'lucide-react';
import { Connection } from '@xyflow/react';

export const DEFAULT_WORKFLOW_TEMPLATES: Array<{
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}> = [
  {
    name: 'Space News Summary',
    description: 'Search latest astronomy news and summarize with AI bullets',
    nodes: [
      {
        id: 'node-1',
        type: 'input',
        label: 'Input',
        x: 60,
        y: 160,
        settings: { text: 'black holes' },
      },
      {
        id: 'node-2',
        type: 'webSearch',
        label: 'Web Search',
        x: 320,
        y: 160,
        settings: { query: '{{Input.output}} latest news' },
      },
      {
        id: 'node-3',
        type: 'ai',
        label: 'AI Summary',
        x: 580,
        y: 160,
        settings: {
          role: 'general',
          prompt: 'Summarize in simple English with bullet points:\n\n{{Web Search.output}}',
        },
      },
    ],
    edges: [
      { id: 'e-1-2', from: 'node-1', to: 'node-2' },
      { id: 'e-2-3', from: 'node-2', to: 'node-3' },
    ],
  },
  {
    name: 'Paper Summary',
    description: 'Fetch peer-reviewed academic papers and generate rigorous summary',
    nodes: [
      {
        id: 'node-1',
        type: 'input',
        label: 'Input',
        x: 60,
        y: 160,
        settings: { text: 'solar corona heating' },
      },
      {
        id: 'node-2',
        type: 'scholar',
        label: 'Scholar',
        x: 320,
        y: 160,
        settings: { query: '{{Input.output}}' },
      },
      {
        id: 'node-3',
        type: 'ai',
        label: 'AI Explanation',
        x: 580,
        y: 160,
        settings: {
          role: 'general',
          prompt:
            'Explain in simple English using only these papers and cite [1], [2]:\n\n{{Scholar.output}}',
        },
      },
    ],
    edges: [
      { id: 'e-1-2', from: 'node-1', to: 'node-2' },
      { id: 'e-2-3', from: 'node-2', to: 'node-3' },
    ],
  },
  {
    name: 'Image from Idea',
    description: 'Turn a simple topic into a rich prompt and synthesize an image',
    nodes: [
      {
        id: 'node-1',
        type: 'input',
        label: 'Input',
        x: 60,
        y: 160,
        settings: { text: 'a black hole' },
      },
      {
        id: 'node-2',
        type: 'ai',
        label: 'AI',
        x: 320,
        y: 160,
        settings: {
          role: 'general',
          prompt: 'Write one detailed image prompt for:\n\n{{Input.output}}',
        },
      },
      {
        id: 'node-3',
        type: 'image',
        label: 'Image',
        x: 580,
        y: 160,
        settings: { prompt: '{{AI.output}}' },
      },
    ],
    edges: [
      { id: 'e-1-2', from: 'node-1', to: 'node-2' },
      { id: 'e-2-3', from: 'node-2', to: 'node-3' },
    ],
  },
  {
    name: 'Smart Report',
    description: 'Conditional branching workflow checking summary length',
    nodes: [
      {
        id: 'node-1',
        type: 'input',
        label: 'Input',
        x: 50,
        y: 180,
        settings: { text: 'Mars' },
      },
      {
        id: 'node-2',
        type: 'scholar',
        label: 'Scholar',
        x: 290,
        y: 180,
        settings: { query: '{{Input.output}}' },
      },
      {
        id: 'node-3',
        type: 'ai',
        label: 'AI',
        x: 530,
        y: 180,
        settings: {
          role: 'general',
          prompt: 'Summarize in 5 lines:\n\n{{Scholar.output}}',
        },
      },
      {
        id: 'node-4',
        type: 'if',
        label: 'If',
        x: 770,
        y: 180,
        settings: {
          value1: '{{AI.output}}',
          operator: 'lengthGreaterThan',
          value2: '20',
        },
      },
      {
        id: 'node-5',
        type: 'ai',
        label: 'AI Shorten',
        x: 1020,
        y: 90,
        settings: {
          role: 'general',
          prompt: 'Make it shorter and simpler:\n\n{{AI.output}}',
        },
      },
      {
        id: 'node-6',
        type: 'ai',
        label: 'AI Retry',
        x: 1020,
        y: 280,
        settings: {
          role: 'general',
          prompt: 'Try again: explain {{Input.output}} in simple words',
        },
      },
    ],
    edges: [
      { id: 'e-1-2', from: 'node-1', to: 'node-2' },
      { id: 'e-2-3', from: 'node-2', to: 'node-3' },
      { id: 'e-3-4', from: 'node-3', to: 'node-4' },
      { id: 'e-4-5', from: 'node-4', to: 'node-5', branch: 'yes' },
      { id: 'e-4-6', from: 'node-4', to: 'node-6', branch: 'no' },
    ],
  },
];

interface LogEntry {
  id: string;
  nodeId: string;
  label: string;
  type: WorkflowNodeType;
  durationMs: number;
  status: WorkflowStepStatus;
  warning?: string;
  timestamp: string;
}

export function WorkflowsPage() {
  // Saved workflows list
  const [workflows, setWorkflows] = useState<Workflow[]>(() => {
    const saved = storage.getWorkflows();
    if (saved && saved.length > 0) return saved;
    // Initialize default templates if storage is empty
    const initialList: Workflow[] = DEFAULT_WORKFLOW_TEMPLATES.map((tmpl, idx) => ({
      id: `workflow-${Date.now()}-${idx}`,
      name: tmpl.name,
      nodes: tmpl.nodes,
      edges: tmpl.edges,
      updatedAt: Date.now(),
    }));
    storage.saveWorkflows(initialList);
    return initialList;
  });

  const [activeWorkflowId, setActiveWorkflowId] = useState<string>(() => {
    const list = storage.getWorkflows();
    let requestedId = '';
    try {
      requestedId = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('workflow') || ''
        : '';
    } catch {
      requestedId = '';
    }
    if (requestedId && list.some((workflow) => workflow.id === requestedId)) return requestedId;
    if (list && list.length > 0) return list[0].id;
    return 'workflow-default';
  });

  // Current active workflow object
  const activeWorkflow = useMemo(() => {
    return workflows.find((w) => w.id === activeWorkflowId) || workflows[0] || null;
  }, [workflows, activeWorkflowId]);

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'canvas'>(() => {
    try {
      return typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('workflow')
        ? 'canvas'
        : 'list';
    } catch {
      return 'list';
    }
  });

  // Execution state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [stepStatuses, setStepStatuses] = useState<Record<string, WorkflowStepStatus>>({});
  const [stepOutputs, setStepOutputs] = useState<Record<string, WorkflowOutput>>({});
  const [stepStartTimes, setStepStartTimes] = useState<Record<string, number>>({});
  const [stepDurations, setStepDurations] = useState<Record<string, number>>({});
  const [stepOutputSummaries, setStepOutputSummaries] = useState<Record<string, string>>({});
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [lastExecutedNodeId, setLastExecutedNodeId] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<LogEntry[]>([]);
  const stopRequestedRef = useRef<boolean>(false);
  const stepStartTimesRef = useRef<Record<string, number>>({});

  // UI state
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [runCelebration, setRunCelebration] = useState<{ status: WorkflowRunStatus; durationMs: number } | null>(null);
  const [collapsedSettings, setCollapsedSettings] = useState<Record<string, boolean>>({});
  const [collapsedOutputs, setCollapsedOutputs] = useState<Record<string, boolean>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [renameDraft, setRenameDraft] = useState<string>('');
  const [confirmDeleteWorkflow, setConfirmDeleteWorkflow] = useState<boolean>(false);
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [showAiGeneratorModal, setShowAiGeneratorModal] = useState<boolean>(false);
  const [showVariablesModal, setShowVariablesModal] = useState<boolean>(false);
  const [showValidatorPanel, setShowValidatorPanel] = useState<boolean>(false);
  const [showBatchRunnerModal, setShowBatchRunnerModal] = useState<boolean>(false);
  const [showRunDiffModal, setShowRunDiffModal] = useState<boolean>(false);
  const [showLibraryDrawer, setShowLibraryDrawer] = useState<boolean>(false);
  const [showQuickJumpModal, setShowQuickJumpModal] = useState<boolean>(false);
  const [textComfortMode, setTextComfortMode] = useState<'normal' | 'large'>(() => {
    try {
      return localStorage.getItem('nexus_wf_text_scale') === 'large' ? 'large' : 'normal';
    } catch {
      return 'normal';
    }
  });
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [runHistory, setRunHistory] = useState<WorkflowRunRecord[]>([]);
  const [selectedRunDetail, setSelectedRunDetail] = useState<WorkflowRunRecord | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const inspectorOutputRef = useRef<HTMLDivElement | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const stepCardRefs = useRef<Record<string, HTMLElement | null>>({});

  // Undo / Redo snapshot stacks for active workflow (max 30 snapshots)
  const [undoStack, setUndoStack] = useState<Workflow[]>([]);
  const [redoStack, setRedoStack] = useState<Workflow[]>([]);

  // Phone Connect Mode in Canvas
  const [connectSourceNodeId, setConnectSourceNodeId] = useState<string | null>(null);
  const [connectBranchPrompt, setConnectBranchPrompt] = useState<{
    sourceId: string;
    targetId: string;
  } | null>(null);

  const finalOutputSectionRef = useRef<HTMLElement | null>(null);
  const traceSectionRef = useRef<HTMLElement | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3200);
  }, []);

  // Active workflow variables & pre-flight validation diagnostics
  const activeWorkflowVariables = useMemo<WorkflowVariable[]>(() => {
    if (!activeWorkflow) return [];
    const seen = new Set<string>();
    const merged: WorkflowVariable[] = [];
    for (const v of [
      ...(activeWorkflow.variables || []),
      ...(activeWorkflow.automation?.variables || []),
    ]) {
      const k = (v.key || '').trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      merged.push(v);
    }
    return merged;
  }, [activeWorkflow]);

  const activeVariableMap = useMemo(
    () => buildWorkflowVariableMap(activeWorkflow),
    [activeWorkflow],
  );

  const validationIssues = useMemo(
    () => analyzeWorkflowHealth(activeWorkflow),
    [activeWorkflow],
  );

  const validationErrorCount = useMemo(
    () => validationIssues.filter((i) => i.severity === 'error').length,
    [validationIssues],
  );

  // Persist mobile text comfort preference
  useEffect(() => {
    try {
      localStorage.setItem('nexus_wf_text_scale', textComfortMode);
    } catch {
      // ignore storage errors
    }
  }, [textComfortMode]);

  // Load workflow run history & reset undo/redo when active workflow changes
  useEffect(() => {
    if (activeWorkflow?.id) {
      setRunHistory(storage.getWorkflowRunHistory(activeWorkflow.id));
    } else {
      setRunHistory([]);
    }
    setSelectedRunDetail(null);
    setUndoStack([]);
    setRedoStack([]);
  }, [activeWorkflow?.id]);

  // Debounced auto-save to localStorage (400ms)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      storage.saveWorkflows(workflows);
    }, 400);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [workflows]);

  // Update current workflow helper (records snapshot for Undo/Redo)
  const updateCurrentWorkflow = useCallback(
    (updater: (prev: Workflow) => Workflow, options?: { skipHistory?: boolean }) => {
      if (!activeWorkflow) return;
      if (!options?.skipHistory) {
        const snapshot: Workflow = JSON.parse(JSON.stringify(activeWorkflow));
        setUndoStack((prev) => [...prev.slice(-29), snapshot]);
        setRedoStack([]);
      }
      setWorkflows((prevList) =>
        prevList.map((w) => {
          if (w.id === activeWorkflow.id) {
            const updated = updater(w);
            return { ...updated, updatedAt: Date.now() };
          }
          return w;
        }),
      );
    },
    [activeWorkflow],
  );

  const handleUndo = useCallback(() => {
    if (!activeWorkflow || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    const currentSnapshot: Workflow = JSON.parse(JSON.stringify(activeWorkflow));
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev.slice(-29), currentSnapshot]);
    setWorkflows((prevList) =>
      prevList.map((w) => (w.id === activeWorkflow.id ? { ...previous, updatedAt: Date.now() } : w)),
    );
    showToast('Undid last change');
  }, [activeWorkflow, undoStack, showToast]);

  const handleRedo = useCallback(() => {
    if (!activeWorkflow || redoStack.length === 0) return;
    const nextSnapshot = redoStack[redoStack.length - 1];
    const currentSnapshot: Workflow = JSON.parse(JSON.stringify(activeWorkflow));
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev.slice(-29), currentSnapshot]);
    setWorkflows((prevList) =>
      prevList.map((w) => (w.id === activeWorkflow.id ? { ...nextSnapshot, updatedAt: Date.now() } : w)),
    );
    showToast('Redid change');
  }, [activeWorkflow, redoStack, showToast]);

  // Keyboard shortcuts: Ctrl/Cmd+Z (Undo), Ctrl/Cmd+Shift+Z / Ctrl+Y (Redo), Ctrl/Cmd+K (Quick Jump)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowQuickJumpModal((prev) => !prev);
        return;
      }

      if (isEditable) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if (
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && e.shiftKey) ||
        ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleUndo, handleRedo]);

  // Jump / focus a specific node from validator or quick jump palette
  const handleJumpToNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setCollapsedSettings((prev) => ({ ...prev, [nodeId]: false }));
      setHighlightedNodeId(nodeId);
      setTimeout(() => {
        setHighlightedNodeId((cur) => (cur === nodeId ? null : cur));
      }, 2200);
      if (viewMode === 'list') {
        requestAnimationFrame(() => {
          stepCardRefs.current[nodeId]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
      }
    },
    [viewMode],
  );

  // Pin/unpin, clone-by-id, delete-by-id, and update metadata for Workflow Library
  const handleTogglePinWorkflow = useCallback(
    (id: string) => {
      setWorkflows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, pinned: !w.pinned, updatedAt: Date.now() } : w)),
      );
    },
    [],
  );

  const handleUpdateWorkflowMeta = useCallback(
    (id: string, patch: { description?: string; tags?: string[] }) => {
      setWorkflows((prev) =>
        prev.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: Date.now() } : w)),
      );
      showToast('Pipeline notes & tags saved');
    },
    [showToast],
  );

  const handleDuplicateWorkflowById = useCallback(
    (id: string) => {
      const target = workflows.find((w) => w.id === id);
      if (!target) return;
      const now = Date.now();
      const idMap = new Map<string, string>();
      const newNodes = target.nodes.map((n, i) => {
        const newId = `node-${now}-${i + 1}`;
        idMap.set(n.id, newId);
        return { ...n, id: newId, settings: { ...n.settings } };
      });
      const newEdges = target.edges.map((e, i) => ({
        ...e,
        id: `e-${now}-${i}`,
        from: idMap.get(e.from) || e.from,
        to: idMap.get(e.to) || e.to,
      }));
      const clone: Workflow = {
        ...target,
        id: `workflow-${now}`,
        name: `${target.name} (Copy)`,
        pinned: false,
        nodes: newNodes,
        edges: newEdges,
        updatedAt: now,
      };
      setWorkflows((prev) => [clone, ...prev]);
      setActiveWorkflowId(clone.id);
      showToast(`Duplicated as "${clone.name}"`);
    },
    [workflows, showToast],
  );

  const handleDeleteWorkflowById = useCallback(
    (id: string) => {
      if (workflows.length <= 1) {
        showToast('You cannot delete the only workflow. Create another one first.');
        return;
      }
      const remaining = workflows.filter((w) => w.id !== id);
      setWorkflows(remaining);
      if (activeWorkflowId === id && remaining[0]) {
        setActiveWorkflowId(remaining[0].id);
        setSelectedNodeId(null);
      }
      showToast('Workflow deleted');
    },
    [workflows, activeWorkflowId, showToast],
  );

  // Export final output & full trace as Markdown / TXT / JSON report
  const handleExportReport = useCallback(
    (format: 'md' | 'txt' | 'json') => {
      if (!activeWorkflow) return;
      const safeName = (activeWorkflow.name || 'workflow').replace(/[^a-z0-9]/gi, '_');
      const finalOut = lastExecutedNodeId ? stepOutputs[lastExecutedNodeId] : null;
      const finalVal = finalOut
        ? finalOut.type === 'image'
          ? '[Generated Image]'
          : finalOut.value
        : '(No final output recorded)';

      let content = '';
      let mime = 'text/plain;charset=utf-8';

      if (format === 'json') {
        mime = 'application/json;charset=utf-8';
        content = JSON.stringify(
          {
            workflowName: activeWorkflow.name,
            exportedAt: new Date().toISOString(),
            variables: activeVariableMap,
            finalOutput: finalOut || null,
            steps: activeWorkflow.nodes.map((n) => ({
              label: n.label,
              type: n.type,
              status: stepStatuses[n.id] || 'idle',
              durationMs: stepDurations[n.id] || 0,
              output: stepOutputs[n.id] || null,
              error: stepErrors[n.id] || null,
            })),
          },
          null,
          2,
        );
      } else if (format === 'md') {
        mime = 'text/markdown;charset=utf-8';
        content = [
          `# ${activeWorkflow.name} — Run Report`,
          `Generated: ${new Date().toLocaleString()}`,
          activeWorkflow.description ? `\n> ${activeWorkflow.description}` : '',
          '\n## Final Output\n',
          finalVal,
          '\n## Step-by-Step Breakdown\n',
          ...activeWorkflow.nodes.map((n, i) => {
            const st = stepStatuses[n.id] || 'idle';
            const dur = stepDurations[n.id] ? `${(stepDurations[n.id] / 1000).toFixed(2)}s` : '—';
            const out = stepOutputs[n.id];
            const outText = out ? (out.type === 'image' ? '[Generated Image]' : out.value) : '—';
            return `### ${i + 1}. ${n.label} (${n.type})\n- **Status:** ${st} | **Duration:** ${dur}\n\n${outText}\n`;
          }),
        ].join('\n');
      } else {
        content = [
          `${activeWorkflow.name.toUpperCase()} — RUN REPORT`,
          `Generated: ${new Date().toLocaleString()}`,
          '========================================',
          '',
          'FINAL OUTPUT:',
          finalVal,
          '',
          'STEPS:',
          ...activeWorkflow.nodes.map((n, i) => {
            const st = stepStatuses[n.id] || 'idle';
            const dur = stepDurations[n.id] ? `${stepDurations[n.id]}ms` : '0ms';
            return `${i + 1}. ${n.label} [${n.type}] — ${st} (${dur})`;
          }),
        ].join('\n');
      }

      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}_report.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Exported report (.${format})`);
    },
    [
      activeWorkflow,
      activeVariableMap,
      lastExecutedNodeId,
      stepOutputs,
      stepStatuses,
      stepDurations,
      stepErrors,
      showToast,
    ],
  );

  // Check if current workflow has branching
  const hasBranches = useMemo(() => {
    if (!activeWorkflow) return false;
    const hasIf = activeWorkflow.nodes.some((n) => n.type === 'if');
    const hasMultiEdge = activeWorkflow.edges.some(
      (e, _, arr) => arr.filter((x) => x.from === e.from).length > 1,
    );
    return hasIf || hasMultiEdge;
  }, [activeWorkflow]);

  // Create new workflow
  const handleCreateNew = () => {
    const newWf: Workflow = {
      id: `workflow-${Date.now()}`,
      name: `New Workflow ${workflows.length + 1}`,
      nodes: [
        {
          id: `node-${Date.now()}-1`,
          type: 'input',
          label: 'Input',
          x: 100,
          y: 150,
          settings: { text: '' },
        },
      ],
      edges: [],
      updatedAt: Date.now(),
    };
    setWorkflows((prev) => [newWf, ...prev]);
    setActiveWorkflowId(newWf.id);
    setSelectedNodeId(null);
    handleClearResults();
  };

  // Duplicate current workflow
  const handleDuplicate = () => {
    if (!activeWorkflow) return;
    const idMap = new Map<string, string>();
    const newNodes = activeWorkflow.nodes.map((n, i) => {
      const newId = `node-${Date.now()}-${i + 1}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        settings: { ...n.settings },
      };
    });
    const newEdges = activeWorkflow.edges.map((e, i) => ({
      ...e,
      id: `e-${Date.now()}-${i}`,
      from: idMap.get(e.from) || e.from,
      to: idMap.get(e.to) || e.to,
    }));

    const clone: Workflow = {
      id: `workflow-${Date.now()}`,
      name: `${activeWorkflow.name} (Copy)`,
      nodes: newNodes,
      edges: newEdges,
      updatedAt: Date.now(),
    };
    setWorkflows((prev) => [clone, ...prev]);
    setActiveWorkflowId(clone.id);
    showToast(`Duplicated as "${clone.name}"`);
  };

  // Export current workflow as JSON
  const handleExportWorkflow = () => {
    if (!activeWorkflow) return;
    const blob = new Blob([JSON.stringify(activeWorkflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(activeWorkflow.name || 'workflow').replace(/[^a-z0-9]/gi, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Workflow exported as JSON');
  };

  // Import workflow from JSON file
  const handleImportWorkflow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? ''));
        if (!parsed || !Array.isArray(parsed.nodes)) throw new Error('invalid');
        const idMap = new Map<string, string>();
        const newNodes = (parsed.nodes as WorkflowNode[]).map((n, i) => {
          const newId = `node-${Date.now()}-${i + 1}`;
          idMap.set(n.id, newId);
          return {
            ...n,
            id: newId,
            settings: { ...(n.settings || {}) },
          };
        });
        const newEdges = ((parsed.edges || []) as WorkflowEdge[]).map((ed, i) => ({
          ...ed,
          id: `e-${Date.now()}-${i}`,
          from: idMap.get(ed.from) || ed.from,
          to: idMap.get(ed.to) || ed.to,
        }));
        const wf: Workflow = {
          id: `workflow-${Date.now()}`,
          name: parsed.name ? `${parsed.name} (Imported)` : 'Imported Workflow',
          nodes: newNodes,
          edges: newEdges,
          updatedAt: Date.now(),
        };
        setWorkflows((prev) => [wf, ...prev]);
        setActiveWorkflowId(wf.id);
        setSelectedNodeId(null);
        handleClearResults();
        showToast(`Imported "${wf.name}"`);
      } catch {
        showToast('Invalid workflow file');
      } finally {
        if (importFileRef.current) importFileRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Delete current workflow (without native alert/confirm)
  const handleDeleteCurrent = () => {
    if (!activeWorkflow) return;
    if (workflows.length <= 1) {
      showToast('You cannot delete the only workflow. Create another one first.');
      setConfirmDeleteWorkflow(false);
      return;
    }

    const remaining = workflows.filter((w) => w.id !== activeWorkflow.id);
    setWorkflows(remaining);
    setActiveWorkflowId(remaining[0].id);
    setSelectedNodeId(null);
    setConfirmDeleteWorkflow(false);
    showToast('Workflow deleted');
  };

  // Apply template
  const handleApplyTemplate = (tmpl: (typeof DEFAULT_WORKFLOW_TEMPLATES)[0]) => {
    const idMap = new Map<string, string>();
    const newNodes = tmpl.nodes.map((n, i) => {
      const newId = `node-${Date.now()}-${i + 1}`;
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        settings: { ...n.settings },
      };
    });
    const newEdges = tmpl.edges.map((e, i) => ({
      ...e,
      id: `e-${Date.now()}-${i}`,
      from: idMap.get(e.from) || e.from,
      to: idMap.get(e.to) || e.to,
    }));

    const wf: Workflow = {
      id: `workflow-${Date.now()}`,
      name: tmpl.name,
      nodes: newNodes,
      edges: newEdges,
      updatedAt: Date.now(),
    };

    setWorkflows((prev) => [wf, ...prev]);
    setActiveWorkflowId(wf.id);
    setShowTemplatesModal(false);
    handleClearResults();
    showToast(`Created workflow from "${tmpl.name}"`);
  };

  // Clear results
  const handleClearResults = () => {
    // Retain mock / frozen node outputs
    const retainedOutputs: Record<string, WorkflowOutput> = {};
    const retainedSummaries: Record<string, string> = {};
    if (activeWorkflow) {
      for (const n of activeWorkflow.nodes) {
        if (n.settings?.frozen === 'true' || n.frozen) {
          if (n.mockOutput) {
            retainedOutputs[n.id] = n.mockOutput;
            retainedSummaries[n.id] = getOutputSummary(n.mockOutput);
          } else if (n.settings?.mockValue !== undefined && n.settings.mockValue !== '') {
            const out: WorkflowOutput = {
              type: (n.settings.mockType as 'text' | 'json' | 'image') || 'text',
              value: n.settings.mockValue,
            };
            retainedOutputs[n.id] = out;
            retainedSummaries[n.id] = getOutputSummary(out);
          } else if (stepOutputs[n.id]) {
            retainedOutputs[n.id] = stepOutputs[n.id];
            retainedSummaries[n.id] = stepOutputSummaries[n.id] || getOutputSummary(stepOutputs[n.id]);
          }
        }
      }
    }
    setStepStatuses({});
    setStepOutputs(retainedOutputs);
    setStepStartTimes({});
    setStepDurations({});
    setStepOutputSummaries(retainedSummaries);
    setStepErrors({});
    setLastExecutedNodeId(null);
    setRunLogs([]);
  };

  // Core execution runner (supports full run, partial run, and runtime variable overrides)
  const executeWorkflowRun = async (
    startFromNodeId?: string,
    overrideVariables?: Record<string, string>,
  ) => {
    if (!activeWorkflow || isRunning) return;

    const nodeMap = new Map<string, WorkflowNode>();
    for (const n of activeWorkflow.nodes) nodeMap.set(n.id, n);

    if (startFromNodeId) {
      const preservedAncestors = getAncestorNodeIds(startFromNodeId, activeWorkflow.edges || []);
      // Verify all needed ancestors have saved outputs or are frozen mocks
      for (const ancId of preservedAncestors) {
        const ancNode = nodeMap.get(ancId);
        if (!ancNode) continue;
        if (ancNode.settings?.disabled === 'true') continue;
        if (stepStatuses[ancId] === 'skipped') continue;
        const isAncFrozen = ancNode.settings?.frozen === 'true' || Boolean(ancNode.frozen);
        const hasMockOrOutput =
          Boolean(stepOutputs[ancId]) ||
          (isAncFrozen && (Boolean(ancNode.mockOutput) || Boolean(ancNode.settings?.mockValue)));
        if (!hasMockOrOutput) {
          showToast('Run the whole workflow once first');
          return;
        }
      }
    }

    setIsRunning(true);
    stopRequestedRef.current = false;
    const runStartTime = Date.now();
    let localFinalNodeId: string | null = null;
    const localOutputs: Record<string, WorkflowOutput> = { ...(startFromNodeId ? stepOutputs : {}) };
    const localStatuses: Record<string, WorkflowStepStatus> = { ...(startFromNodeId ? stepStatuses : {}) };
    const localSummaries: Record<string, string> = { ...(startFromNodeId ? stepOutputSummaries : {}) };
    const localErrors: Record<string, string> = { ...(startFromNodeId ? stepErrors : {}) };
    const localDurations: Record<string, number> = { ...(startFromNodeId ? stepDurations : {}) };
    let executionErrorOccurred = false;

    if (!startFromNodeId) {
      handleClearResults();
      stepStartTimesRef.current = {};
    } else {
      // Only clear target and downstream nodes; preserve ancestors, parallel branches, and frozen nodes
      const downstreamIds = getDownstreamNodeIds(startFromNodeId, activeWorkflow.edges || []);
      const frozenNodeIds = new Set(
        activeWorkflow.nodes
          .filter((n) => n.settings?.frozen === 'true' || n.frozen)
          .map((n) => n.id),
      );
      setStepStatuses((prev) => {
        const next = { ...prev };
        for (const id of downstreamIds) {
          if (!frozenNodeIds.has(id)) delete next[id];
        }
        return next;
      });
      setStepOutputs((prev) => {
        const next = { ...prev };
        for (const id of downstreamIds) {
          if (!frozenNodeIds.has(id)) delete next[id];
        }
        return next;
      });
      setStepStartTimes((prev) => {
        const next = { ...prev };
        for (const id of downstreamIds) {
          if (!frozenNodeIds.has(id)) delete next[id];
        }
        return next;
      });
      setStepDurations((prev) => {
        const next = { ...prev };
        for (const id of downstreamIds) {
          if (!frozenNodeIds.has(id)) delete next[id];
        }
        return next;
      });
      setStepOutputSummaries((prev) => {
        const next = { ...prev };
        for (const id of downstreamIds) {
          if (!frozenNodeIds.has(id)) delete next[id];
        }
        return next;
      });
      setStepErrors((prev) => {
        const next = { ...prev };
        for (const id of downstreamIds) {
          if (!frozenNodeIds.has(id)) delete next[id];
        }
        return next;
      });
    }

    try {
      await runWorkflow(
        activeWorkflow,
        {
          shouldStop: () => stopRequestedRef.current,
          onStatus: (nodeId, status, output, errorText) => {
            setStepStatuses((prev) => ({ ...prev, [nodeId]: status }));
            localStatuses[nodeId] = status;

            if (status === 'running') {
              const now = Date.now();
              stepStartTimesRef.current[nodeId] = now;
              setStepStartTimes((prev) => ({ ...prev, [nodeId]: now }));
            }

            if (output) {
              setStepOutputs((prev) => ({ ...prev, [nodeId]: output }));
              localOutputs[nodeId] = output;
              const summary = getOutputSummary(output);
              setStepOutputSummaries((prev) => ({
                ...prev,
                [nodeId]: summary,
              }));
              localSummaries[nodeId] = summary;
              if (status === 'done') {
                setLastExecutedNodeId(nodeId);
                localFinalNodeId = nodeId;
              }
            }

            if (errorText) {
              setStepErrors((prev) => ({ ...prev, [nodeId]: errorText }));
              localErrors[nodeId] = errorText;
              executionErrorOccurred = true;
            }

            if (status === 'done' || status === 'error') {
              const startT = stepStartTimesRef.current[nodeId] || Date.now();
              const duration = Math.max(0, Date.now() - startT);
              setStepDurations((prev) => ({ ...prev, [nodeId]: duration }));
              localDurations[nodeId] = duration;
              if (status === 'error') {
                executionErrorOccurred = true;
              }
              const targetNode = nodeMap.get(nodeId);
              if (targetNode) {
                setRunLogs((prev) => [
                  ...prev,
                  {
                    id: `log-${Date.now()}-${nodeId}`,
                    nodeId,
                    label: targetNode.label,
                    type: targetNode.type,
                    durationMs: duration,
                    status,
                    timestamp: new Date().toLocaleTimeString(),
                  },
                ]);
              }
            }
          },
          onWarning: (warn) => {
            showToast(`Warning: ${warn}`);
          },
          onLog: (msg) => {
            console.log('[Workflow Engine]', msg);
          },
        },
        startFromNodeId
          ? {
              startFromNodeId,
              previousOutputs: stepOutputs,
              variables: overrideVariables || activeVariableMap,
            }
          : { variables: overrideVariables || activeVariableMap },
      );
    } catch (err: unknown) {
      executionErrorOccurred = true;
      console.error('Workflow execution error:', err);
      showToast(`Workflow error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRunning(false);

      // Determine final run status
      const runStatus: WorkflowRunStatus = stopRequestedRef.current
        ? 'stopped'
        : executionErrorOccurred
        ? 'error'
        : 'success';

      const durationMs = Math.max(0, Date.now() - runStartTime);

      const formatHistoryText = (out?: WorkflowOutput | null, fallbackText?: string): string => {
        if (out?.type === 'image') return '[1 image]';
        const raw = (fallbackText ?? out?.value ?? '').trim();
        if (!raw) return '';
        if (raw.startsWith('data:image/') || /^data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+;base64,/i.test(raw)) {
          return '[1 image]';
        }
        return raw.length > 500 ? `${raw.slice(0, 500)}…` : raw;
      };

      // Collect step records
      const stepRecords: WorkflowRunStepRecord[] = activeWorkflow.nodes.map((node) => {
        const nodeOut = localOutputs[node.id];
        const rawSummary = localSummaries[node.id] || (nodeOut ? getOutputSummary(nodeOut) : '');
        const rawErr = localErrors[node.id];
        return {
          nodeId: node.id,
          label: node.label,
          type: node.type,
          status: localStatuses[node.id] || 'idle',
          outputSummary: formatHistoryText(nodeOut, rawSummary),
          error: rawErr ? (rawErr.length > 500 ? `${rawErr.slice(0, 500)}…` : rawErr) : undefined,
          durationMs: localDurations[node.id] || 0,
        };
      });

      const finalOutObj = localFinalNodeId ? localOutputs[localFinalNodeId] : null;
      const finalOutputFormatted = finalOutObj ? formatHistoryText(finalOutObj) : undefined;
      const finalOutputVal = finalOutputFormatted || undefined;

      const record: WorkflowRunRecord = {
        id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        workflowId: activeWorkflow.id,
        workflowName: activeWorkflow.name,
        status: runStatus,
        startedAt: runStartTime,
        durationMs,
        steps: stepRecords,
        finalOutput: finalOutputVal,
      };

      storage.saveWorkflowRun(record);
      setRunHistory(storage.getWorkflowRunHistory(activeWorkflow.id));

      if (runStatus === 'success') {
        setRunCelebration({ status: 'success', durationMs });
        setTimeout(() => setRunCelebration(null), 4500);
      }
    }
  };

  // Run workflow
  const handleRun = async () => {
    await executeWorkflowRun();
  };

  // Run from specific step
  const handleRunFromNode = async (nodeId: string) => {
    await executeWorkflowRun(nodeId);
  };

  // Stop workflow
  const handleStop = () => {
    stopRequestedRef.current = true;
    showToast('Stopping workflow...');
  };

  // Add step to workflow
  const handleAddStep = (type: WorkflowNodeType) => {
    if (!activeWorkflow) return;
    setShowAddMenu(false);

    if (type === 'input') {
      const existingInput = activeWorkflow.nodes.find((n) => n.type === 'input');
      if (existingInput) {
        setSelectedNodeId(existingInput.id);
        showToast('A workflow can only have one Input start step');
        return;
      }
    }

    const cfg = NODE_CONFIG[type];
    const existingCount = activeWorkflow.nodes.filter((n) => n.type === type).length;
    const newLabel = `${cfg.label}${existingCount > 0 ? ` ${existingCount + 1}` : ''}`;

    const lastNode = activeWorkflow.nodes[activeWorkflow.nodes.length - 1];
    const newX = lastNode ? lastNode.x + 240 : 100;
    const newY = lastNode ? lastNode.y : 150;

    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      label: newLabel,
      x: newX,
      y: newY,
      settings:
        type === 'if'
          ? { operator: 'contains' }
          : type === 'transform'
          ? {
              mode: 'template',
              input: lastNode ? `{{${lastNode.label}.output}}` : '{{Input.output}}',
            }
          : type === 'merge'
          ? { mode: 'sections', separator: '\\n\\n---\\n\\n' }
          : {},
    };

    updateCurrentWorkflow((wf) => {
      const nextNodes = [...wf.nodes, newNode];
      // In list view, if there are no branches, auto-create edge from previous last node
      let nextEdges = wf.edges;
      if (!hasBranches && lastNode && type !== 'input') {
        const newEdge: WorkflowEdge = {
          id: `e-${lastNode.id}-${newNode.id}`,
          from: lastNode.id,
          to: newNode.id,
        };
        nextEdges = [...wf.edges, newEdge];
      }
      return {
        ...wf,
        nodes: nextNodes,
        edges: nextEdges,
      };
    });

    setSelectedNodeId(newNode.id);
  };

  // Delete node
  const handleDeleteNode = (nodeId: string) => {
    if (!activeWorkflow) return;
    updateCurrentWorkflow((wf) => {
      const nextNodes = wf.nodes.filter((n) => n.id !== nodeId);
      const nextEdges = wf.edges.filter((e) => e.from !== nodeId && e.to !== nodeId);
      // If linear list view without branches, re-link edges
      let finalEdges = nextEdges;
      if (!hasBranches) {
        finalEdges = [];
        for (let i = 0; i < nextNodes.length - 1; i++) {
          finalEdges.push({
            id: `e-${nextNodes[i].id}-${nextNodes[i + 1].id}`,
            from: nextNodes[i].id,
            to: nextNodes[i + 1].id,
          });
        }
      }
      return {
        ...wf,
        nodes: nextNodes,
        edges: finalEdges,
      };
    });
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  // Duplicate single node (offset by 40px, label "<label> copy", no edges)
  const handleDuplicateNode = useCallback(
    (nodeId: string) => {
      if (!activeWorkflow) return;
      const target = activeWorkflow.nodes.find((n) => n.id === nodeId);
      if (!target) return;
      const copyType: WorkflowNodeType = target.type === 'input' ? 'ai' : target.type;
      const copyNode: WorkflowNode = {
        id: `node-${Date.now()}`,
        type: copyType,
        label: `${target.label} copy`,
        x: target.x + 40,
        y: target.y + 40,
        settings: { ...target.settings },
      };
      updateCurrentWorkflow((wf) => ({
        ...wf,
        nodes: [...wf.nodes, copyNode],
      }));
      setSelectedNodeId(copyNode.id);
      showToast(`Duplicated "${target.label}"`);
    },
    [activeWorkflow, updateCurrentWorkflow, showToast],
  );

  // Toggle disable/enable on a single node
  const handleToggleDisableNode = useCallback(
    (nodeId: string) => {
      if (!activeWorkflow) return;
      const target = activeWorkflow.nodes.find((n) => n.id === nodeId);
      if (!target) return;
      const nextDisabled = target.settings?.disabled === 'true' ? 'false' : 'true';
      handleUpdateNode(nodeId, 'settings', {
        ...target.settings,
        disabled: nextDisabled,
      });
      showToast(
        nextDisabled === 'true'
          ? `Disabled "${target.label}"`
          : `Enabled "${target.label}"`,
      );
    },
    [activeWorkflow],
  );

  // Toggle freeze/unfreeze on a single node (Mock / Cached output mode)
  const handleToggleFreezeNode = useCallback(
    (nodeId: string) => {
      if (!activeWorkflow) return;
      const target = activeWorkflow.nodes.find((n) => n.id === nodeId);
      if (!target) return;
      const isCurrentlyFrozen = target.settings?.frozen === 'true' || Boolean(target.frozen);
      const nextFrozen = isCurrentlyFrozen ? 'false' : 'true';

      const newSettings: Record<string, string> = {
        ...target.settings,
        frozen: nextFrozen,
      };

      // If turning on freeze and mockValue is empty, capture existing step output if available
      if (nextFrozen === 'true' && !target.settings?.mockValue && stepOutputs[nodeId]) {
        newSettings.mockValue = stepOutputs[nodeId].value || '';
        newSettings.mockType = stepOutputs[nodeId].type || 'text';
      }

      handleUpdateNode(nodeId, 'settings', newSettings);
      showToast(
        nextFrozen === 'true'
          ? `Frozen "${target.label}" (using cached/mock output)`
          : `Unfrozen "${target.label}" (will execute live)`,
      );
    },
    [activeWorkflow, stepOutputs, showToast],
  );

  // Run a single node in isolation (Step Debugger test)
  const handleRunSingleNode = useCallback(
    async (nodeId: string) => {
      if (!activeWorkflow || isRunning) return;
      const target = activeWorkflow.nodes.find((n) => n.id === nodeId);
      if (!target) return;

      setIsRunning(true);
      setStepStatuses((prev) => ({ ...prev, [nodeId]: 'running' }));
      const now = Date.now();
      stepStartTimesRef.current[nodeId] = now;
      setStepStartTimes((prev) => ({ ...prev, [nodeId]: now }));

      try {
        const result = await executeSingleNodeStep(
          target,
          activeWorkflow.nodes,
          stepOutputs,
          activeWorkflow.edges || [],
          activeVariableMap,
        );
        const duration = Math.max(0, Date.now() - now);
        setStepDurations((prev) => ({ ...prev, [nodeId]: duration }));
        setStepOutputs((prev) => ({ ...prev, [nodeId]: result.output }));
        setStepOutputSummaries((prev) => ({
          ...prev,
          [nodeId]: getOutputSummary(result.output),
        }));
        setStepStatuses((prev) => ({ ...prev, [nodeId]: 'done' }));
        setLastExecutedNodeId(nodeId);
        setRunLogs((prev) => [
          ...prev,
          {
            id: `log-${Date.now()}-${nodeId}`,
            nodeId,
            label: target.label,
            type: target.type,
            durationMs: duration,
            status: 'done',
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        showToast(`Tested step "${target.label}" successfully`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setStepStatuses((prev) => ({ ...prev, [nodeId]: 'error' }));
        setStepErrors((prev) => ({ ...prev, [nodeId]: msg }));
        showToast(`Error in step "${target.label}": ${msg}`);
      } finally {
        setIsRunning(false);
      }
    },
    [activeWorkflow, isRunning, stepOutputs, showToast, activeVariableMap],
  );

  // Move node up (in list view)
  const handleMoveNodeUp = (index: number) => {
    if (hasBranches || !activeWorkflow || index <= 0) return;
    updateCurrentWorkflow((wf) => {
      const newNodes = [...wf.nodes];
      const temp = newNodes[index];
      newNodes[index] = newNodes[index - 1];
      newNodes[index - 1] = temp;

      // Re-create linear edges
      const newEdges: WorkflowEdge[] = [];
      for (let i = 0; i < newNodes.length - 1; i++) {
        newEdges.push({
          id: `e-${newNodes[i].id}-${newNodes[i + 1].id}`,
          from: newNodes[i].id,
          to: newNodes[i + 1].id,
        });
      }
      return { ...wf, nodes: newNodes, edges: newEdges };
    });
  };

  // Move node down (in list view)
  const handleMoveNodeDown = (index: number) => {
    if (hasBranches || !activeWorkflow || index >= activeWorkflow.nodes.length - 1) return;
    updateCurrentWorkflow((wf) => {
      const newNodes = [...wf.nodes];
      const temp = newNodes[index];
      newNodes[index] = newNodes[index + 1];
      newNodes[index + 1] = temp;

      // Re-create linear edges
      const newEdges: WorkflowEdge[] = [];
      for (let i = 0; i < newNodes.length - 1; i++) {
        newEdges.push({
          id: `e-${newNodes[i].id}-${newNodes[i + 1].id}`,
          from: newNodes[i].id,
          to: newNodes[i + 1].id,
        });
      }
      return { ...wf, nodes: newNodes, edges: newEdges };
    });
  };

  // Update node settings / label (and automatically sync {{OldLabel.output}} placeholders in other steps)
  const handleUpdateNode = (
    nodeId: string,
    field: 'label' | 'settings',
    value: string | Record<string, string>,
  ) => {
    updateCurrentWorkflow((wf) => {
      const targetNode = wf.nodes.find((n) => n.id === nodeId);
      const oldLabel = targetNode?.label?.trim() || '';
      const newLabel = field === 'label' ? (value as string).trim() : oldLabel;
      const shouldSyncPlaceholders =
        field === 'label' &&
        Boolean(oldLabel) &&
        Boolean(newLabel) &&
        oldLabel.toLowerCase() !== newLabel.toLowerCase();

      return {
        ...wf,
        nodes: wf.nodes.map((n) => {
          if (n.id === nodeId) {
            if (field === 'label') return { ...n, label: value as string };
            if (field === 'settings') return { ...n, settings: value as Record<string, string> };
          }
          if (shouldSyncPlaceholders && n.settings) {
            const updatedSettings: Record<string, string> = {};
            let changed = false;
            for (const [k, v] of Object.entries(n.settings)) {
              if (typeof v === 'string' && v.includes('{{')) {
                const replaced = v.replace(
                  /\{\{\s*([^}]+?)\.output\s*\}\}/gi,
                  (match, rawKey) => {
                    if (rawKey.trim().toLowerCase() === oldLabel.toLowerCase()) {
                      return `{{${newLabel}.output}}`;
                    }
                    return match;
                  },
                );
                if (replaced !== v) changed = true;
                updatedSettings[k] = replaced;
              } else {
                updatedSettings[k] = v;
              }
            }
            if (changed) {
              return { ...n, settings: updatedSettings };
            }
          }
          return n;
        }),
      };
    });
  };

  // Connect edge in Canvas view
  const handleConnectEdge = (source: string, target: string, branch?: 'yes' | 'no') => {
    if (!activeWorkflow) return;
    // 1. Block invalid: target is 'input'
    const targetNode = activeWorkflow.nodes.find((n) => n.id === target);
    if (targetNode?.type === 'input') {
      showToast('Cannot connect into an Input node');
      return;
    }
    // 2. Block self-link
    if (source === target) {
      showToast('Cannot connect a node to itself');
      return;
    }
    // 3. Block duplicate
    const exists = activeWorkflow.edges.some(
      (e) => e.from === source && e.to === target && e.branch === branch,
    );
    if (exists) {
      showToast('Connection already exists');
      return;
    }
    // 4. Cycle check
    const candidateEdge: WorkflowEdge = {
      id: `e-${Date.now()}`,
      from: source,
      to: target,
      branch,
    };
    if (hasWorkflowCycle(activeWorkflow.nodes, [...activeWorkflow.edges, candidateEdge])) {
      showToast('This would create a loop');
      return;
    }

    updateCurrentWorkflow((wf) => ({
      ...wf,
      edges: [...wf.edges, candidateEdge],
    }));
  };

  // React Flow connect handler
  const handleRfConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const branch =
      connection.sourceHandle === 'yes' || connection.sourceHandle === 'no'
        ? (connection.sourceHandle as 'yes' | 'no')
        : undefined;
    handleConnectEdge(connection.source, connection.target, branch);
  };

  // Delete edge
  const handleDeleteEdge = (edgeId: string) => {
    updateCurrentWorkflow((wf) => ({
      ...wf,
      edges: wf.edges.filter((e) => e.id !== edgeId),
    }));
    showToast('Connection removed');
  };

  // Update node positions from Canvas drag
  const handleUpdateNodesPosition = (
    updates: Array<{ id: string; x: number; y: number }>,
  ) => {
    const posMap = new Map(updates.map((u) => [u.id, u]));
    updateCurrentWorkflow((wf) => ({
      ...wf,
      nodes: wf.nodes.map((n) => {
        const u = posMap.get(n.id);
        if (u) return { ...n, x: u.x, y: u.y };
        return n;
      }),
    }));
  };

  // Auto tidy layout
  const handleTidyLayout = () => {
    if (!activeWorkflow) return;
    // Calculate topological depth from start node
    const startNode = activeWorkflow.nodes.find((n) => n.type === 'input') || activeWorkflow.nodes[0];
    if (!startNode) return;

    const depthMap = new Map<string, number>();
    depthMap.set(startNode.id, 0);

    const queue: string[] = [startNode.id];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      const curDepth = depthMap.get(cur) || 0;
      const outgoing = activeWorkflow.edges.filter((e) => e.from === cur);
      for (const edge of outgoing) {
        if (!depthMap.has(edge.to)) {
          depthMap.set(edge.to, curDepth + 1);
          queue.push(edge.to);
        }
      }
    }

    // Nodes grouped by depth
    const levels = new Map<number, WorkflowNode[]>();
    for (const n of activeWorkflow.nodes) {
      const d = depthMap.get(n.id) ?? 0;
      if (!levels.has(d)) levels.set(d, []);
      levels.get(d)!.push(n);
    }

    const updatedNodes = activeWorkflow.nodes.map((n) => {
      const d = depthMap.get(n.id) ?? 0;
      const nodesAtDepth = levels.get(d) || [n];
      const indexInLevel = nodesAtDepth.findIndex((x) => x.id === n.id);
      return {
        ...n,
        x: 80 + d * 270,
        y: 120 + indexInLevel * 140,
      };
    });

    updateCurrentWorkflow((wf) => ({
      ...wf,
      nodes: updatedNodes,
    }));
    showToast('Canvas layout tidied');
  };

  // Copy helper
  const handleCopyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((curr) => (curr === key ? null : curr));
    }, 2000);
  };

  // Selected node for settings drawer
  const selectedNode = useMemo(() => {
    if (!activeWorkflow || !selectedNodeId) return null;
    return activeWorkflow.nodes.find((n) => n.id === selectedNodeId) || null;
  }, [activeWorkflow, selectedNodeId]);

  // Last executed node result
  const lastExecutedOutput = lastExecutedNodeId ? stepOutputs[lastExecutedNodeId] : null;
  const lastExecutedNode = lastExecutedNodeId
    ? activeWorkflow?.nodes.find((n) => n.id === lastExecutedNodeId)
    : null;

  if (!activeWorkflow) {
    return (
      <div
        data-wf-theme="cyber"
        className="flex flex-col items-center justify-center min-h-[50vh] text-[#b9cacb] font-mono text-xs uppercase tracking-widest"
      >
        <Loader2 className="animate-spin text-[#49effd] mb-2.5" size={20} />
        <p>Initializing workflows...</p>
      </div>
    );
  }

  return (
    <div
      data-wf-theme="cyber"
      role="region"
      aria-label="Workflows Orchestrator"
      className="relative min-h-screen -mx-4 sm:-mx-6 md:-mx-8 -mt-4 sm:-mt-6 bg-[#080b12] text-[#e4e1e7] pb-16 overflow-x-hidden"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-14 right-3 sm:right-6 z-[1300] bg-[#141722]/95 border border-[#49effd]/45 text-[#e4e1e7] font-mono text-xs px-3.5 py-2 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.65),0_0_16px_rgba(73,239,253,0.22)] backdrop-blur-2xl flex items-center gap-2 animate-in slide-in-from-top-2">
          <Sparkles size={13} className="text-[#49effd] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ================= ROW 1: TOP STUDIO HEADER BAR (Mobile-friendly sizing & >= 40px touch targets) ================= */}
      <div className="relative px-3.5 sm:px-5 py-3 border-b border-cyan-500/25 bg-[#050911]/95 backdrop-blur-xl flex flex-wrap items-center justify-between gap-2.5 z-10">
        <div className="mc-laser-line opacity-85" />

        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0 overflow-hidden">
            <svg className="w-5 h-5" viewBox="0 0 48 48" fill="none">
              <circle
                cx="24"
                cy="24"
                r="18"
                stroke="rgba(73,239,253,0.35)"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                className="mc-orbit-cw"
                style={{ transformOrigin: '24px 24px' }}
              />
              <path
                d="M14 24H21M27 24H34M24 14V21M24 27V34"
                stroke="rgba(73,239,253,0.75)"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
              <circle
                cx="24"
                cy="24"
                r="4"
                fill="#49effd"
                className={isRunning ? 'animate-ping' : ''}
              />
              <circle cx="24" cy="24" r="3.5" fill="#49effd" />
            </svg>
          </div>

          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight wf-gradient-title truncate">
              Workflows Studio
            </h1>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-400 font-mono flex-wrap">
              <span>{workflows.length} pipelines</span>
              <span>·</span>
              <span className="text-cyan-300">
                {activeWorkflow.nodes.length} {activeWorkflow.nodes.length === 1 ? 'step' : 'steps'}
              </span>
              {isRunning && (
                <>
                  <span>·</span>
                  <span className="text-[#49effd] font-bold inline-flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#49effd] animate-ping" />
                    Running
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Primary Studio Controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* AI Build Button */}
          <button
            type="button"
            onClick={() => setShowAiGeneratorModal(true)}
            className="min-h-[42px] px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-violet-500/20 to-cyan-500/20 hover:from-violet-500/30 hover:to-cyan-500/30 border border-violet-400/50 text-violet-100 transition-all flex items-center gap-1.5 whitespace-nowrap"
            title="Generate a complete workflow from plain English using AI"
          >
            <Wand2 size={15} className="text-cyan-300" />
            <span>AI Build</span>
          </button>

          {/* Quick Jump / Command Palette */}
          <button
            type="button"
            onClick={() => setShowQuickJumpModal(true)}
            className="min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 transition-colors flex items-center gap-1.5 whitespace-nowrap"
            title="Quick command & jump to step (Ctrl+K)"
          >
            <Command size={15} className="text-cyan-400" />
            <span className="hidden sm:inline">Jump</span>
          </button>

          {/* Mobile Readable Text Comfort Toggle */}
          <button
            type="button"
            onClick={() => setTextComfortMode((m) => (m === 'large' ? 'normal' : 'large'))}
            aria-pressed={textComfortMode === 'large'}
            className={`min-h-[42px] px-3 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              textComfortMode === 'large'
                ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700/80 text-zinc-300'
            }`}
            title="Toggle Larger Mobile-Friendly Text Size"
          >
            <Type size={15} />
            <span>{textComfortMode === 'large' ? 'Text: Large' : 'Text: Auto'}</span>
          </button>

          {/* Primary Dispatch / Stop CTA */}
          {isRunning ? (
            <button
              type="button"
              onClick={handleStop}
              className="wf-run-btn-busy min-h-[42px] relative overflow-hidden px-4 py-2 rounded-xl bg-[#ffb4ab]/15 hover:bg-[#ffb4ab]/25 border border-[#ffb4ab]/55 text-[#ffb4ab] font-mono text-xs sm:text-sm font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <Square size={13} className="fill-[#ffb4ab] text-[#ffb4ab]" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRun}
              className="wf-run-btn-idle min-h-[42px] relative overflow-hidden px-4 sm:px-5 py-2 rounded-xl bg-gradient-to-r from-[#49effd] via-[#00f0ff] to-[#818cf8] hover:brightness-110 text-[#041318] font-mono text-xs sm:text-sm font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 shadow-[0_0_24px_rgba(73,239,253,0.45)] active:scale-[0.98] whitespace-nowrap shrink-0"
              title="Execute Pipeline (Dispatch Run)"
            >
              <Play size={14} className="fill-[#041318]" />
              <span>Run Pipeline</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= ROW 2: WORKFLOW SELECTOR, LIBRARY, UNDO/REDO & POWER TOOLS ================= */}
      <div className="px-3.5 sm:px-5 py-2.5 border-b border-cyan-500/20 bg-slate-900/60 flex items-center justify-between gap-2.5 flex-wrap shrink-0 z-20">
        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
          {/* Library Drawer Trigger */}
          <button
            type="button"
            onClick={() => setShowLibraryDrawer(true)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 border border-cyan-500/35 text-cyan-200 flex items-center gap-1.5 transition-colors shrink-0"
            title="Browse, search, tag & pin workflows"
          >
            <Layers size={15} className="text-cyan-400" />
            <span>Library</span>
          </button>

          {/* Workflow Picker */}
          <select
            value={activeWorkflow.id}
            onChange={(e) => {
              setActiveWorkflowId(e.target.value);
              setSelectedNodeId(null);
              handleClearResults();
            }}
            className="min-h-[40px] min-w-[160px] flex-1 max-w-xs rounded-xl bg-zinc-950 border border-zinc-700/80 px-3 py-1.5 text-base sm:text-sm text-zinc-100 font-semibold outline-none focus:border-cyan-500 cursor-pointer truncate"
          >
            {[...workflows]
              .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
              .map((w) => (
                <option key={w.id} value={w.id} className="bg-[#0b0d14] text-cyan-200">
                  {w.pinned ? '★ ' : ''}{w.name} ({w.nodes.length})
                </option>
              ))}
          </select>

          {/* Pin Star */}
          <button
            type="button"
            onClick={() => handleTogglePinWorkflow(activeWorkflow.id)}
            className={`min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border transition-colors shrink-0 ${
              activeWorkflow.pinned
                ? 'bg-amber-500/20 border-amber-400/50 text-amber-300'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700/80 text-zinc-400 hover:text-amber-300'
            }`}
            title={activeWorkflow.pinned ? 'Unpin favorite workflow' : 'Pin workflow to top'}
          >
            <Star size={15} className={activeWorkflow.pinned ? 'fill-amber-300' : ''} />
          </button>

          {/* Rename Workflow */}
          {isRenaming ? (
            <div className="flex items-center gap-1.5 bg-[#0b0d14] border border-[#49effd]/60 rounded-xl px-2.5 py-1">
              <input
                type="text"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && renameDraft.trim()) {
                    updateCurrentWorkflow((wf) => ({ ...wf, name: renameDraft.trim() }));
                    setIsRenaming(false);
                  }
                }}
                className="bg-transparent text-cyan-200 text-base sm:text-sm px-1 py-0.5 focus:outline-none w-36 sm:w-44"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  if (renameDraft.trim()) {
                    updateCurrentWorkflow((wf) => ({ ...wf, name: renameDraft.trim() }));
                  }
                  setIsRenaming(false);
                }}
                className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg bg-[#49effd] text-[#00363b]"
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="min-h-[34px] min-w-[34px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRenameDraft(activeWorkflow.name);
                setIsRenaming(true);
              }}
              className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-violet-300 flex items-center gap-1.5 transition-colors shrink-0"
              title="Rename workflow"
            >
              <Edit2 size={14} className="text-violet-400" />
              <span className="hidden sm:inline">Rename</span>
            </button>
          )}

          {/* New / Clone / Delete */}
          <button
            type="button"
            onClick={handleCreateNew}
            className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 flex items-center gap-1.5 transition-colors shrink-0"
            title="Create new blank workflow"
          >
            <Plus size={14} className="text-cyan-400" />
            <span>New</span>
          </button>

          <button
            type="button"
            onClick={handleDuplicate}
            className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-emerald-300 flex items-center gap-1.5 transition-colors shrink-0"
            title="Duplicate workflow"
          >
            <Copy size={14} className="text-emerald-400" />
            <span className="hidden md:inline">Clone</span>
          </button>

          {confirmDeleteWorkflow ? (
            <div className="flex items-center gap-1.5 bg-[#ffb4ab]/15 border border-[#ffb4ab]/45 rounded-xl px-2.5 py-1">
              <span className="text-xs font-mono text-[#ffb4ab] font-bold">Delete?</span>
              <button
                type="button"
                onClick={handleDeleteCurrent}
                className="min-h-[32px] px-2.5 py-1 rounded-lg bg-[#ffb4ab] text-[#131317] font-bold text-xs"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteWorkflow(false)}
                className="min-h-[32px] min-w-[32px] flex items-center justify-center rounded-lg text-zinc-300 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                if (workflows.length <= 1) {
                  showToast('You cannot delete the only workflow. Create another one first.');
                  return;
                }
                setConfirmDeleteWorkflow(true);
              }}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-rose-950/70 border border-zinc-700/80 hover:border-rose-500/40 text-zinc-400 hover:text-rose-300 transition-colors shrink-0"
              title="Delete current workflow"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {/* Right: Undo/Redo + Power Tools Strip */}
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          <button
            type="button"
            disabled={undoStack.length === 0}
            onClick={handleUndo}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 disabled:opacity-35 transition-colors"
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            disabled={redoStack.length === 0}
            onClick={handleRedo}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 disabled:opacity-35 transition-colors"
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
          >
            <Redo2 size={15} />
          </button>

          <button
            type="button"
            onClick={() => setShowVariablesModal(true)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 hover:border-sky-400/50 text-sky-200 flex items-center gap-1.5 transition-colors"
            title="Manage global {{vars.key}} variables"
          >
            <Sliders size={14} className="text-sky-400" />
            <span>Vars</span>
            {activeWorkflowVariables.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-md text-xs font-mono bg-sky-500/20 text-sky-200">
                {activeWorkflowVariables.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowBatchRunnerModal(true)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 hover:border-fuchsia-400/50 text-fuchsia-200 flex items-center gap-1.5 transition-colors"
            title="Run this workflow on a list of multiple inputs"
          >
            <ListChecks size={14} className="text-fuchsia-400" />
            <span>Batch</span>
          </button>

          <button
            type="button"
            onClick={() => setShowValidatorPanel(true)}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold border flex items-center gap-1.5 transition-colors ${
              validationErrorCount > 0
                ? 'bg-rose-500/15 border-rose-400/50 text-rose-200'
                : validationIssues.length > 0
                ? 'bg-amber-500/15 border-amber-400/50 text-amber-200'
                : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-700/80 text-emerald-300'
            }`}
            title="Pre-flight pipeline health check"
          >
            <ShieldCheck size={14} />
            <span className="hidden sm:inline">Check</span>
            {validationIssues.length > 0 && (
              <span className="px-1.5 rounded-md text-xs font-mono font-bold bg-black/30">
                {validationIssues.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-cyan-200 flex items-center gap-1.5 transition-colors"
            title="View Run History & Compare Runs"
          >
            <History size={14} className="text-cyan-400" />
            <span className="hidden md:inline">History</span>
            {runHistory.length > 0 && (
              <span className="px-1.5 rounded-md text-xs font-mono bg-cyan-500/20 text-cyan-200">
                {runHistory.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowTemplatesModal(true)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-amber-200 flex items-center gap-1.5 transition-colors"
            title="Load pre-configured Pipeline Templates"
          >
            <Sparkles size={14} className="text-amber-300" />
            <span className="hidden lg:inline">Templates</span>
          </button>

          <button
            type="button"
            onClick={handleExportWorkflow}
            disabled={!activeWorkflow}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-emerald-300 disabled:opacity-40 transition-colors"
            title="Export workflow JSON"
          >
            <Download size={15} />
          </button>

          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-sky-300 transition-colors"
            title="Import workflow JSON"
          >
            <Upload size={15} />
          </button>

          <input
            ref={importFileRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportWorkflow}
            className="hidden"
          />
        </div>
      </div>

      {/* ================= ROW 3: SEGMENTED STUDIO TABS BAR ================= */}
      <div className="px-3.5 sm:px-5 py-2 border-b border-zinc-800/80 bg-[#070a10]/90 flex items-center justify-between gap-2.5 overflow-x-auto no-scrollbar shrink-0 z-20">
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              viewMode === 'list'
                ? 'bg-zinc-800 text-white shadow-sm border border-cyan-500/35'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers size={14} className={viewMode === 'list' ? 'text-cyan-400' : ''} />
            <span>Pipeline</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('canvas')}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap ${
              viewMode === 'canvas'
                ? 'bg-zinc-800 text-white shadow-sm border border-cyan-500/35'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <GitBranch size={14} className={viewMode === 'canvas' ? 'text-cyan-400' : ''} />
            <span>Canvas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              finalOutputSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            <Sparkles size={14} className="text-emerald-400" />
            <span>Output</span>
            {lastExecutedOutput && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              traceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold text-zinc-300 hover:text-white flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            <CheckCircle2 size={14} className="text-amber-400" />
            <span>Trace</span>
            <span className="text-xs font-mono text-emerald-400">{runLogs.length}</span>
          </button>
        </div>

        {/* Right Contextual Studio Action */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleClearResults}
            disabled={isRunning}
            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-amber-300 disabled:opacity-40 text-xs sm:text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap"
            title="Clear outputs & step statuses"
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          {viewMode === 'canvas' ? (
            <button
              type="button"
              onClick={handleTidyLayout}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-cyan-300 text-xs sm:text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap"
            >
              <Sparkles size={14} />
              <span>Tidy Graph</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                const allCollapsed = activeWorkflow.nodes.every((n) => collapsedSettings[n.id]);
                const next: Record<string, boolean> = {};
                for (const n of activeWorkflow.nodes) {
                  next[n.id] = !allCollapsed;
                }
                setCollapsedSettings(next);
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 hover:text-white text-xs sm:text-sm font-semibold flex items-center gap-1.5 whitespace-nowrap"
            >
              <ChevronDown size={15} />
              <span>
                {activeWorkflow.nodes.every((n) => collapsedSettings[n.id])
                  ? 'Expand All'
                  : 'Compact All'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ================= MAIN STUDIO WORKSPACE ================= */}
      <div
        className={`wf-studio-shell relative px-3.5 sm:px-6 pt-4 pb-16 border-0 rounded-none ${
          textComfortMode === 'large' ? 'text-base leading-relaxed' : 'text-sm'
        }`}
      >
        {/* Static Background Grid + Dual Radial Plasma Glows */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 wf-cyber-matrix-grid opacity-65 z-0"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -top-28 left-1/3 -translate-x-1/2 w-[560px] h-[260px] rounded-full bg-[#49effd]/[0.06] blur-[95px] z-0"
        />

        <div className="relative z-10 max-w-[1380px] mx-auto">
          {/* Active Workflow Description & Tags Banner (when set) */}
          {(activeWorkflow.description || (activeWorkflow.tags && activeWorkflow.tags.length > 0)) && (
            <div className="mb-3 px-4 py-3 rounded-2xl bg-[#0a101d]/90 border border-white/10 flex flex-wrap items-center justify-between gap-2">
              {activeWorkflow.description && (
                <p className="text-sm text-zinc-300 leading-relaxed">{activeWorkflow.description}</p>
              )}
              {activeWorkflow.tags && activeWorkflow.tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {activeWorkflow.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2.5 py-0.5 rounded-md bg-violet-500/15 border border-violet-400/30 text-violet-200 text-xs font-mono"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Real Pipeline Insights & Health Strip */}
          <WorkflowTelemetryGraphics
            isRunning={isRunning}
            workflow={activeWorkflow}
            runHistory={runHistory}
            stepStatuses={stepStatuses}
            stepDurations={stepDurations}
            validationIssues={validationIssues}
            onOpenValidator={() => setShowValidatorPanel(true)}
          />

          {/* Main Workspace Area */}
        {viewMode === 'list' ? (
          /* ================= CYBER PIPELINE LIST VIEW ================= */
          <div className="pt-5">
            {/* Subtle Branching Notice */}
            {hasBranches && (
              <div className="py-3 px-4 mb-5 rounded-xl bg-amber-500/10 border border-amber-400/35 text-amber-200 font-mono text-xs flex items-center gap-2.5">
                <AlertTriangle size={15} className="text-amber-300 flex-shrink-0" />
                <span>
                  This pipeline contains conditional branches. Step sequence connections are managed in <b className="text-amber-100">Graph Canvas</b> mode, while step parameters remain editable below.
                </span>
              </div>
            )}

            {/* Empty Steps Notice */}
            {activeWorkflow.nodes.length === 0 && (
              <div className="wf-cyber-card rounded-xl p-8 text-center my-4">
                <Layers size={24} className="text-[#49effd] mx-auto mb-2 opacity-80" />
                <p className="text-sm font-bold text-[#e4e1e7]">No steps in this pipeline yet</p>
                <p className="text-xs text-[#b9cacb] font-mono mt-1">
                  Add a step below or load a pre-configured template to begin.
                </p>
              </div>
            )}

            {/* Cyber Step Cards Connected by Vertical Glowing Connectors */}
            <div className="flex flex-col">
              {activeWorkflow.nodes.map((node, index) => {
                const cfg = NODE_CONFIG[node.type] || NODE_CONFIG.input;
                const IconComp = cfg.icon;
                const status = stepStatuses[node.id] || 'idle';
                const output = stepOutputs[node.id];
                const errorText = stepErrors[node.id];
                const durationMs = stepDurations[node.id];
                const summaryText = stepOutputSummaries[node.id] || (output ? getOutputSummary(output) : '');
                const isDisabled = node.settings?.disabled === 'true';
                const isFrozen = node.settings?.frozen === 'true' || Boolean(node.frozen);
                const hasMock = Boolean(node.settings?.mockValue && node.settings.mockValue.trim() !== '');
                const isSettingsOpen = !collapsedSettings[node.id];
                const isOutputOpen = !collapsedOutputs[node.id];
                const nextNode = activeWorkflow.nodes[index + 1];
                const nextStatus = nextNode ? stepStatuses[nextNode.id] || 'idle' : 'idle';
                const isConnectorFlowing = status === 'running' || nextStatus === 'running';

                return (
                  <React.Fragment key={node.id}>
                    <section
                      ref={(el) => {
                        stepCardRefs.current[node.id] = el;
                      }}
                      className={`wf-cyber-card wf-step-card-enter group/card rounded-2xl p-4 sm:p-5 transition-all duration-300 ${
                        isDisabled ? 'opacity-60' : ''
                      } ${
                        highlightedNodeId === node.id
                          ? 'ring-2 ring-cyan-400 shadow-[0_0_28px_rgba(73,239,253,0.35)] '
                          : ''
                      }${
                        isFrozen ? 'ring-1 ring-cyan-400/40 border-cyan-400/40 shadow-[0_0_18px_rgba(73,239,253,0.15)] ' : ''
                      }${
                        status === 'running'
                          ? 'wf-cyber-card-active wf-step-running'
                          : status === 'done'
                          ? 'wf-step-done border-emerald-500/40'
                          : status === 'error'
                          ? 'wf-step-error border-[#ffb4ab]/60'
                          : status === 'skipped'
                          ? 'wf-step-skipped opacity-55'
                          : ''
                      }`}
                    >
                      {/* Top Laser Sweep when running or on card hover/focus */}
                      <div
                        className={`mc-laser-line transition-opacity duration-300 ${
                          status === 'running'
                            ? 'opacity-100'
                            : 'opacity-0 group-hover/card:opacity-75 group-focus-within/card:opacity-90'
                        }`}
                      />

                      {/* Subtle Ambient Corner Glow */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 rounded-full bg-[#49effd]/[0.05] blur-2xl group-hover/card:bg-[#49effd]/[0.09] transition-colors"
                      />

                      {/* Step Header Line */}
                      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-white/[0.08]">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Cyber Step Index Badge */}
                          <span className="text-xs font-mono font-extrabold tabular-nums text-[#49effd] bg-[#0b0d14] border border-[#49effd]/30 shadow-[0_0_12px_rgba(73,239,253,0.12)] px-2.5 py-1 rounded-lg flex-shrink-0 select-none">
                            {String(index + 1).padStart(2, '0')}
                          </span>

                          {/* Node Type Icon */}
                          <div className={`p-2 rounded-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] flex-shrink-0 ${cfg.color}`}>
                            <IconComp size={17} />
                          </div>

                          {/* Editable Step Title & Unboxed Metadata */}
                          <div className="min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-3 flex-1">
                            <input
                              type="text"
                              value={node.label}
                              onChange={(e) => handleUpdateNode(node.id, 'label', e.target.value)}
                              className={`bg-transparent hover:bg-white/[0.04] focus:bg-[#0b0d14] font-extrabold ${cfg.textColor} tracking-tight text-base sm:text-lg rounded-lg px-2 py-1 border border-transparent focus:border-[#49effd]/55 focus:shadow-[0_0_14px_rgba(73,239,253,0.18)] focus:outline-none w-full max-w-[260px] sm:max-w-[320px] truncate transition-all`}
                              title="Click to rename step"
                            />
                            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider pl-2 sm:pl-0 flex-wrap">
                              <span className="wf-label-gradient font-bold">
                                {cfg.label}
                              </span>
                              {Number(node.settings?.retries || '0') > 0 && (
                                <span className="text-xs font-mono text-amber-300 bg-amber-500/10 border border-amber-400/30 px-1.5 py-0.2 rounded normal-case">
                                  {node.settings.retries}x retry
                                </span>
                              )}
                              {node.settings?.continueOnError === 'true' && (
                                <span className="text-xs font-mono text-sky-300 bg-sky-500/10 border border-sky-400/30 px-1.5 py-0.2 rounded normal-case">
                                  fallback
                                </span>
                              )}
                              {durationMs !== undefined && status === 'done' && (
                                <>
                                  <span aria-hidden="true" className="text-white/25">·</span>
                                  <span className="tabular-nums text-emerald-300 font-bold">
                                    {(durationMs / 1000).toFixed(1)}s
                                  </span>
                                </>
                              )}
                              {summaryText && status === 'done' && (
                                <>
                                  <span aria-hidden="true" className="text-white/25">·</span>
                                  <span className="tabular-nums text-amber-300 font-semibold normal-case">
                                    {summaryText}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Side Status Badge + Action Controls */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 pl-1 sm:pl-0 flex-wrap">
                          {/* Cyber Status Indicator */}
                          <div className="mr-1 flex items-center">
                            {isDisabled ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-400/35 text-xs font-mono font-bold uppercase tracking-wider text-amber-300">
                                <Ban size={13} />
                                <span>Disabled</span>
                              </span>
                            ) : isFrozen ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/45 text-xs font-mono font-bold uppercase tracking-wider text-cyan-200 shadow-[0_0_12px_rgba(73,239,253,0.2)]">
                                <Snowflake size={13} className="text-cyan-300" />
                                <span>{hasMock ? 'Mocked' : 'Frozen'}</span>
                              </span>
                            ) : status === 'running' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#49effd]/15 border border-[#49effd]/55 text-xs font-mono font-bold uppercase tracking-wider text-[#49effd] shadow-[0_0_16px_rgba(73,239,253,0.28)]">
                                <Loader2 size={13} className="animate-spin" />
                                <span>Running</span>
                              </span>
                            ) : status === 'done' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/45 text-xs font-mono font-bold uppercase tracking-wider text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.2)]">
                                <CheckCircle2 size={13} className="wf-check-pop" />
                                <span>Done</span>
                              </span>
                            ) : status === 'error' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#ffb4ab]/15 border border-[#ffb4ab]/45 text-xs font-mono font-bold uppercase tracking-wider text-[#ffb4ab]">
                                <AlertCircle size={13} />
                                <span>Failed</span>
                              </span>
                            ) : status === 'skipped' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0b0d14] border border-white/10 text-xs font-mono font-bold uppercase tracking-wider text-[#94a3b8]">
                                <MinusCircle size={13} />
                                <span>Skipped</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0b0d14]/90 border border-white/10 text-xs font-mono font-semibold uppercase tracking-wider text-cyan-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#49effd]/75 shadow-[0_0_6px_#49effd]" />
                                <span>Ready</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Test Single Step */}
                            <button
                              type="button"
                              disabled={isRunning}
                              onClick={() => handleRunSingleNode(node.id)}
                              className="min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center rounded-lg bg-[#0b0d14]/90 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-400/45 text-emerald-300 hover:text-emerald-200 disabled:opacity-30 transition-all active:scale-95"
                              title="Test this single step only"
                              aria-label="Test this single step"
                            >
                              <Play size={14} className="fill-emerald-400/30" />
                            </button>

                            {/* Run from this step */}
                            <button
                              type="button"
                              disabled={isRunning}
                              onClick={() => handleRunFromNode(node.id)}
                              className="min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center rounded-lg bg-[#0b0d14]/90 hover:bg-[#49effd]/15 border border-white/10 hover:border-[#49effd]/45 text-cyan-300 hover:text-[#49effd] disabled:opacity-30 transition-all active:scale-95"
                              title="Run workflow starting from this step"
                              aria-label="Run from this step"
                            >
                              <Play size={14} />
                            </button>

                            {/* Freeze / Unfreeze Step */}
                            <button
                              type="button"
                              onClick={() => handleToggleFreezeNode(node.id)}
                              className={`min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center rounded-lg border transition-all active:scale-95 ${
                                isFrozen
                                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 shadow-[0_0_10px_rgba(73,239,253,0.25)]'
                                  : 'bg-[#0b0d14]/90 hover:bg-white/[0.06] border-white/10 hover:border-cyan-400/35 text-cyan-400 hover:text-[#f8fafc]'
                              }`}
                              title={isFrozen ? 'Unfreeze step (execute live)' : 'Freeze output (use cached / mock output)'}
                              aria-label="Toggle freeze output"
                            >
                              <Snowflake size={14} />
                            </button>

                            {/* Move Up / Move Down */}
                            <button
                              type="button"
                              onClick={() => handleMoveNodeUp(index)}
                              disabled={hasBranches || index === 0}
                              className="min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center rounded-lg bg-[#0b0d14]/90 hover:bg-white/[0.06] border border-white/10 hover:border-[#49effd]/35 text-sky-300 hover:text-[#f8fafc] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                              title={hasBranches ? 'Reordering disabled for branching workflows' : 'Move step up'}
                              aria-label="Move step up"
                            >
                              <ArrowUp size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveNodeDown(index)}
                              disabled={hasBranches || index === activeWorkflow.nodes.length - 1}
                              className="min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center rounded-lg bg-[#0b0d14]/90 hover:bg-white/[0.06] border border-white/10 hover:border-[#49effd]/35 text-sky-300 hover:text-[#f8fafc] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                              title={hasBranches ? 'Reordering disabled for branching workflows' : 'Move step down'}
                              aria-label="Move step down"
                            >
                              <ArrowDown size={14} />
                            </button>

                            {/* Duplicate Step */}
                            <button
                              type="button"
                              onClick={() => handleDuplicateNode(node.id)}
                              className="min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center rounded-lg bg-[#0b0d14]/90 hover:bg-white/[0.06] border border-white/10 hover:border-[#49effd]/35 text-violet-300 hover:text-[#f8fafc] transition-all active:scale-95"
                              title="Duplicate step"
                              aria-label="Duplicate step"
                            >
                              <Copy size={14} />
                            </button>

                            {/* Delete Step */}
                            <button
                              type="button"
                              onClick={() => handleDeleteNode(node.id)}
                              className="min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center rounded-lg bg-[#0b0d14]/90 hover:bg-[#ffb4ab]/15 border border-white/10 hover:border-[#ffb4ab]/45 text-rose-300 hover:text-[#ffb4ab] transition-all active:scale-95"
                              title="Delete step"
                              aria-label="Delete step"
                            >
                              <Trash2 size={14} />
                            </button>

                            {/* Toggle Settings Collapse */}
                            <button
                              type="button"
                              onClick={() =>
                                setCollapsedSettings((prev) => ({
                                  ...prev,
                                  [node.id]: !prev[node.id],
                                }))
                              }
                              className="min-h-[38px] min-w-[38px] sm:min-h-[34px] sm:min-w-[34px] flex items-center justify-center rounded-lg bg-[#0b0d14]/90 hover:bg-white/[0.06] border border-white/10 hover:border-[#49effd]/35 text-amber-300 hover:text-[#f8fafc] transition-all active:scale-95"
                              title="Toggle step parameters"
                              aria-label="Toggle step parameters"
                            >
                              {isSettingsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Step Parameters Area */}
                      {isSettingsOpen && (
                        <div className="relative z-10 mt-4 max-w-3xl">
                          <StepSettingsForm
                            node={node}
                            allNodes={activeWorkflow.nodes}
                            edges={activeWorkflow.edges}
                            stepOutputs={stepOutputs}
                            workflowVariables={activeWorkflowVariables}
                            textComfortMode={textComfortMode}
                            viewMode={viewMode}
                            isWorkflowRunning={isRunning}
                            onRunSingleNode={handleRunSingleNode}
                            onUpdateSettings={(newSettings) =>
                              handleUpdateNode(node.id, 'settings', newSettings)
                            }
                          />
                        </div>
                      )}

                      {/* Step Output Stream */}
                      {(output || errorText) && (
                        <div className="relative z-10 mt-4 max-w-4xl">
                          <div className="relative overflow-hidden rounded-xl bg-[#090b10]/95 border border-[#49effd]/25 shadow-[0_8px_24px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)] px-4 py-3.5 space-y-2.5">
                            <div className="mc-laser-line opacity-65" />
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#49effd] shadow-[0_0_8px_#49effd]" />
                                <span className="font-bold wf-label-gradient">Step Output</span>
                                {output?.type && (
                                  <>
                                    <span aria-hidden="true" className="text-white/20">·</span>
                                    <span className="text-[#49effd] font-bold">{output.type}</span>
                                  </>
                                )}
                                {summaryText && (
                                  <>
                                    <span aria-hidden="true" className="text-white/20">·</span>
                                    <span className="tabular-nums text-amber-300 font-semibold normal-case">
                                      {summaryText}
                                    </span>
                                  </>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                {output?.type === 'text' && (
                                  <button
                                    type="button"
                                    onClick={() => handleCopyText(output.value, `out-${node.id}`)}
                                    className="min-h-[36px] font-mono text-xs font-bold text-cyan-300 hover:text-[#49effd] flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#141722] hover:bg-[#1c2030] border border-white/10 hover:border-[#49effd]/40 transition-all"
                                  >
                                    {copiedKey === `out-${node.id}` ? (
                                      <>
                                        <Check size={13} className="text-emerald-400" />
                                        <span className="text-emerald-300">Copied</span>
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
                                  onClick={() =>
                                    setCollapsedOutputs((prev) => ({
                                      ...prev,
                                      [node.id]: !prev[node.id],
                                    }))
                                  }
                                  className="min-h-[36px] min-w-[36px] flex items-center justify-center text-cyan-300 hover:text-[#f8fafc] rounded-lg bg-[#141722] hover:bg-[#1c2030] border border-white/10"
                                  aria-label="Toggle step output"
                                >
                                  {isOutputOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </button>
                              </div>
                            </div>

                            {isOutputOpen && (
                              <div>
                                {errorText && (
                                  <div className="py-2.5 px-3 rounded-lg bg-[#ffb4ab]/10 border border-[#ffb4ab]/40 text-[#ffb4ab] text-sm font-mono">
                                    {errorText}
                                  </div>
                                )}
                                {output?.type === 'text' && (
                                  <pre
                                    className={`${
                                      textComfortMode === 'large' ? 'text-base' : 'text-sm'
                                    } text-cyan-200 font-mono whitespace-pre-wrap break-words max-h-72 overflow-y-auto pt-1 leading-relaxed`}
                                  >
                                    {output.value}
                                  </pre>
                                )}
                                {output?.type === 'json' && (
                                  <pre
                                    className={`${
                                      textComfortMode === 'large' ? 'text-base' : 'text-sm'
                                    } text-emerald-200 font-mono whitespace-pre-wrap break-words max-h-72 overflow-y-auto pt-1 leading-relaxed`}
                                  >
                                    {output.value}
                                  </pre>
                                )}
                                {output?.type === 'image' && (
                                  <div className="pt-2 space-y-2.5 max-w-sm">
                                    <img
                                      src={output.value}
                                      alt="Workflow output"
                                      referrerPolicy="no-referrer"
                                      className="w-full rounded-xl border border-white/10 object-cover max-h-64 shadow-lg"
                                    />
                                    <div className="flex justify-end">
                                      <a
                                        href={output.value}
                                        download="workflow-image.png"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="min-h-[40px] px-4 py-2 bg-gradient-to-r from-[#49effd] to-[#22d3ee] hover:brightness-110 text-[#00363b] font-mono text-xs font-extrabold uppercase tracking-wider rounded-lg inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(73,239,253,0.35)]"
                                      >
                                        <Download size={14} />
                                        <span>Download Image</span>
                                      </a>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </section>

                    {/* Vertical Cyber Data Conduit with Animated SVG Pulse between Step Cards */}
                    {index < activeWorkflow.nodes.length - 1 && (
                      <div
                        aria-hidden="true"
                        className="h-9 relative my-0.5 flex items-center justify-center select-none"
                      >
                        <div
                          className={`w-[2px] h-full bg-gradient-to-b from-[#49effd]/30 via-[#49effd] to-indigo-400/40 rounded-full ${
                            isConnectorFlowing ? 'wf-connector-line-flowing' : ''
                          }`}
                        />
                        <div
                          className={`absolute w-3 h-3 rounded-full bg-[#0b0d14] border-2 border-[#49effd] shadow-[0_0_12px_#49effd] flex items-center justify-center ${
                            isConnectorFlowing ? 'wf-connector-dot-flowing' : ''
                          }`}
                        >
                          <div className="w-1 h-1 rounded-full bg-[#49effd]" />
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Glowing Cyan-Outline Add Step Trigger */}
            <div className="relative pt-5 pb-2">
              <button
                type="button"
                onClick={() => setShowAddMenu((v) => !v)}
                className="relative overflow-hidden w-full min-h-[48px] py-3.5 px-4 rounded-2xl border border-dashed border-[#49effd]/50 hover:border-[#49effd] bg-gradient-to-r from-[#49effd]/[0.05] via-indigo-500/[0.06] to-[#49effd]/[0.05] hover:from-[#49effd]/[0.12] hover:to-indigo-500/[0.12] text-[#49effd] font-mono text-sm font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 transition-all group shadow-[0_0_24px_rgba(73,239,253,0.08)] active:scale-[0.99]"
              >
                <div className="mc-laser-line opacity-0 group-hover:opacity-100 transition-opacity" />
                <Plus size={16} className="text-[#49effd] group-hover:rotate-90 transition-transform duration-200" />
                <span>Add Pipeline Step</span>
              </button>

              {/* Step Type Selection Popover */}
              {showAddMenu && (
                <div className="wf-popover-enter mt-2.5 z-30 bg-[#131317]/98 border border-[#49effd]/40 rounded-2xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_20px_rgba(73,239,253,0.12)] backdrop-blur-2xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {(Object.keys(NODE_CONFIG) as WorkflowNodeType[]).map((type) => {
                    const item = NODE_CONFIG[type];
                    const Icon = item.icon;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleAddStep(type)}
                        className="min-h-[54px] flex items-center gap-3 p-3 rounded-xl bg-[#1b1b1f]/80 hover:bg-[#2a292e] border border-[#2a292e] hover:border-[#49effd]/45 text-left transition-all active:scale-[0.98]"
                      >
                        <div className={`p-2 rounded-lg border border-[#3b494b]/40 shrink-0 ${item.color}`}>
                          <Icon size={17} />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-sm font-extrabold truncate ${item.textColor}`}>{item.label}</div>
                          <div className="text-xs text-zinc-300 truncate">{item.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ================= CYBER GRAPH CANVAS VIEW ================= */
          <div className="relative w-full h-[calc(100dvh-185px)] min-h-[460px] overflow-hidden bg-[#0e0e12] border border-[#2a292e] rounded-2xl mt-2 shadow-[0_20px_50px_rgba(0,0,0,0.65)]">
            {/* Pipeline Synchronized Celebration Banner */}
            {runCelebration && runCelebration.status === 'success' && (
              <div className="wf-celebration-banner absolute top-4 left-1/2 z-50 pointer-events-none flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-[#0b0d14]/95 border border-emerald-500/60 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(16,185,129,0.35)] backdrop-blur-2xl">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black uppercase tracking-widest text-emerald-300">
                    PIPELINE SYNCHRONIZED
                  </span>
                  <span className="text-zinc-600">·</span>
                  <span className="font-mono text-[11px] text-zinc-300">
                    Completed in <strong className="text-emerald-400">{(runCelebration.durationMs / 1000).toFixed(1)}s</strong>
                  </span>
                </div>
                <Sparkles size={14} className="text-[#00f0ff] animate-pulse" />
              </div>
            )}

            <WorkflowCanvas
              nodes={activeWorkflow.nodes}
              edges={activeWorkflow.edges}
              stepStatuses={stepStatuses}
              stepOutputs={stepOutputs}
              stepStartTimes={stepStartTimes}
              stepDurations={stepDurations}
              stepOutputSummaries={stepOutputSummaries}
              stepErrors={stepErrors}
              isRunning={isRunning}
              selectedNodeId={selectedNodeId}
              onSelectNode={(nodeId) => {
                if (connectSourceNodeId && nodeId && connectSourceNodeId !== nodeId) {
                  const srcNode = activeWorkflow.nodes.find((n) => n.id === connectSourceNodeId);
                  if (srcNode?.type === 'if') {
                    setConnectBranchPrompt({
                      sourceId: connectSourceNodeId,
                      targetId: nodeId,
                    });
                  } else {
                    handleConnectEdge(connectSourceNodeId, nodeId);
                    setConnectSourceNodeId(null);
                  }
                } else {
                  setSelectedNodeId(nodeId);
                }
              }}
              onUpdateNodesPosition={handleUpdateNodesPosition}
              onConnect={handleRfConnect}
              onDeleteEdge={handleDeleteEdge}
              onTidy={handleTidyLayout}
              onRunFromNode={handleRunFromNode}
              onRunSingleNode={handleRunSingleNode}
              onDuplicateNode={handleDuplicateNode}
              onToggleDisableNode={handleToggleDisableNode}
              onToggleFreezeNode={handleToggleFreezeNode}
              onDeleteNode={handleDeleteNode}
              onOpenInspectorOutput={(nodeId) => {
                setSelectedNodeId(nodeId);
                setTimeout(() => {
                  inspectorOutputRef.current?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest',
                  });
                }, 80);
              }}
            />

            {/* Floating Add Node Control */}
            <div className="absolute bottom-5 left-5 z-20">
              <button
                type="button"
                onClick={() => setShowAddMenu((v) => !v)}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#49effd] to-[#00f0ff] hover:brightness-110 text-[#00363b] font-mono text-xs sm:text-sm font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_24px_rgba(73,239,253,0.4)] transition-all active:scale-95 whitespace-nowrap shrink-0"
              >
                <Plus size={16} />
                <span>Add Node</span>
              </button>

              {showAddMenu && (
                <div className="wf-popover-enter absolute left-0 bottom-full mb-3 w-[min(21rem,calc(100vw-2.5rem))] bg-[#131317]/98 border border-[#49effd]/40 rounded-2xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_20px_rgba(73,239,253,0.14)] backdrop-blur-2xl grid grid-cols-1 gap-1.5 max-h-96 overflow-y-auto">
                  <div className="text-xs font-mono font-bold uppercase tracking-wider wf-label-gradient px-2.5 py-1.5 border-b border-[#2a292e]">
                    Select Step Type
                  </div>
                  {(Object.keys(NODE_CONFIG) as WorkflowNodeType[]).map((type) => {
                    const item = NODE_CONFIG[type];
                    const Icon = item.icon;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleAddStep(type)}
                        className="min-h-[48px] flex items-center gap-3 p-2.5 rounded-xl bg-[#1b1b1f]/80 hover:bg-[#2a292e] border border-[#2a292e] hover:border-[#49effd]/45 text-left transition-all active:scale-[0.98]"
                      >
                        <div className={`p-2 rounded-lg border border-[#3b494b]/40 shrink-0 ${item.color}`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-sm font-extrabold truncate ${item.textColor}`}>{item.label}</div>
                          <div className="text-xs text-zinc-300 truncate">{item.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Phone Connect Mode Prompt Banner */}
            {connectSourceNodeId && (
              <div className="wf-popover-enter absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-gradient-to-r from-[#49effd] to-[#00f0ff] text-[#00363b] font-mono font-extrabold text-xs uppercase tracking-wider px-4 py-2.5 rounded-xl shadow-[0_0_24px_rgba(73,239,253,0.45)] flex items-center gap-3">
                <span>Tap a target node to connect</span>
                <button
                  type="button"
                  onClick={() => setConnectSourceNodeId(null)}
                  className="bg-[#00363b]/15 hover:bg-[#00363b]/30 p-1.5 rounded-lg"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Branch choice modal if source is IF in connect mode */}
            {connectBranchPrompt && (
              <div className="wf-modal-backdrop absolute inset-0 z-50 bg-[#0e0e12]/85 backdrop-blur-md flex items-center justify-center p-4">
                <div className="wf-cyber-card wf-modal-panel rounded-2xl p-5 max-w-xs w-full shadow-[0_20px_50px_rgba(0,0,0,0.85)] text-center space-y-4 backdrop-blur-2xl">
                  <h4 className="text-base font-extrabold text-[#e4e1e7] font-mono uppercase tracking-wider">
                    Choose Condition Branch
                  </h4>
                  <p className="text-sm text-[#b9cacb]">
                    Connect on condition match (Yes) or condition fail (No)?
                  </p>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        handleConnectEdge(
                          connectBranchPrompt.sourceId,
                          connectBranchPrompt.targetId,
                          'yes',
                        );
                        setConnectBranchPrompt(null);
                        setConnectSourceNodeId(null);
                      }}
                      className="flex-1 min-h-[42px] py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-[#00363b] font-mono font-extrabold text-xs uppercase tracking-wider active:scale-95 transition-all"
                    >
                      YES Branch
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleConnectEdge(
                          connectBranchPrompt.sourceId,
                          connectBranchPrompt.targetId,
                          'no',
                        );
                        setConnectBranchPrompt(null);
                        setConnectSourceNodeId(null);
                      }}
                      className="flex-1 min-h-[42px] py-2 rounded-xl bg-[#ffb4ab] hover:brightness-110 text-[#131317] font-mono font-extrabold text-xs uppercase tracking-wider active:scale-95 transition-all"
                    >
                      NO Branch
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConnectBranchPrompt(null)}
                    className="min-h-[38px] px-4 text-xs font-mono uppercase tracking-wider text-[#b9cacb] hover:text-[#e4e1e7]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Cyber Glassmorphic Inspector Drawer */}
            {selectedNode && (
              <aside className="wf-drawer-enter absolute right-0 top-0 bottom-0 w-full sm:w-[420px] z-30 bg-[#131317]/95 border-l border-[#2a292e] shadow-[0_0_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl p-5 sm:p-6 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-[#2a292e]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`p-2 rounded-xl border border-[#3b494b]/40 flex-shrink-0 ${
                          NODE_CONFIG[selectedNode.type]?.color
                        }`}
                      >
                        {React.createElement(NODE_CONFIG[selectedNode.type]?.icon || Sparkles, {
                          size: 16,
                        })}
                      </div>
                      <div className="min-w-0">
                        <span className={`text-sm font-extrabold block truncate ${NODE_CONFIG[selectedNode.type]?.textColor || 'text-cyan-300'}`}>
                          {selectedNode.label}
                        </span>
                        <span className="text-xs font-mono uppercase tracking-wider wf-label-gradient block">
                          {NODE_CONFIG[selectedNode.type]?.label}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId(null)}
                      className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[#0e0e12] hover:bg-[#2a292e] border border-[#2a292e] text-[#b9cacb] hover:text-[#e4e1e7]"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  {/* Step Label */}
                  <div>
                    <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
                      Step Name
                    </label>
                    <input
                      type="text"
                      value={selectedNode.label}
                      onChange={(e) =>
                        handleUpdateNode(selectedNode.id, 'label', e.target.value)
                      }
                      className="wf-field-box w-full min-h-[42px] rounded-xl px-3.5 py-2 text-cyan-200 font-mono text-base sm:text-sm focus:outline-none"
                    />
                  </div>

                  {/* Step Form */}
                  <StepSettingsForm
                    node={selectedNode}
                    allNodes={activeWorkflow.nodes}
                    edges={activeWorkflow.edges}
                    stepOutputs={stepOutputs}
                    workflowVariables={activeWorkflowVariables}
                    textComfortMode={textComfortMode}
                    viewMode={viewMode}
                    isWorkflowRunning={isRunning}
                    onRunSingleNode={handleRunSingleNode}
                    onUpdateSettings={(newSettings) =>
                      handleUpdateNode(selectedNode.id, 'settings', newSettings)
                    }
                  />

                  {/* Connect mode for touch / mobile */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setConnectSourceNodeId(selectedNode.id);
                        showToast('Connect mode active: Tap target node');
                      }}
                      className="w-full min-h-[42px] py-2 rounded-xl bg-[#49effd]/12 hover:bg-[#49effd]/22 border border-[#49effd]/40 text-[#49effd] font-mono text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                    >
                      <GitBranch size={15} />
                      <span>Connect to another node</span>
                    </button>
                  </div>

                  {/* Recent Output in Inspector */}
                  {stepOutputs[selectedNode.id] && (
                    <div
                      ref={inspectorOutputRef}
                      className="pt-4 border-t border-[#2a292e] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient">
                          Recent Output
                        </span>
                        {stepOutputs[selectedNode.id].type !== 'image' && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                stepOutputs[selectedNode.id].value,
                                `insp-out-${selectedNode.id}`,
                              )
                            }
                            className="min-h-[34px] text-xs font-mono font-bold text-cyan-300 hover:text-[#49effd] px-2.5 py-1 rounded-lg bg-[#0e0e12] border border-[#2a292e] flex items-center gap-1.5"
                          >
                            {copiedKey === `insp-out-${selectedNode.id}` ? (
                              <>
                                <Check size={13} className="text-emerald-400" />
                                <span className="text-emerald-300">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={13} />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                      {stepOutputs[selectedNode.id].type === 'image' ? (
                        <img
                          src={stepOutputs[selectedNode.id].value}
                          alt="Output"
                          referrerPolicy="no-referrer"
                          className="rounded-lg max-h-60 object-contain w-full bg-[#0e0e12] border border-[#2a292e]"
                        />
                      ) : (
                        <pre
                          className={`${
                            textComfortMode === 'large' ? 'text-base' : 'text-xs sm:text-sm'
                          } font-mono text-cyan-200 bg-[#0e0e12] border border-[#2a292e] p-3 rounded-xl max-h-64 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed`}
                        >
                          {stepOutputs[selectedNode.id].value}
                        </pre>
                      )}
                    </div>
                  )}
                </div>

                {/* Delete Node in Drawer */}
                <div className="pt-6 border-t border-[#2a292e]">
                  <button
                    type="button"
                    onClick={() => handleDeleteNode(selectedNode.id)}
                    className="w-full min-h-[42px] py-2 rounded-xl bg-[#ffb4ab]/15 hover:bg-[#ffb4ab]/25 border border-[#ffb4ab]/40 text-[#ffb4ab] font-mono text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                  >
                    <Trash2 size={15} />
                    <span>Delete Step</span>
                  </button>
                </div>
              </aside>
            )}
          </div>
        )}

        {/* ================= CYBER FINAL PIPELINE OUTPUT SECTION ================= */}
        <section
          ref={finalOutputSectionRef}
          className="pt-8 pb-6 border-t border-white/[0.08] mt-8 space-y-4"
        >
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-[#49effd] shadow-[0_0_10px_#49effd]" />
              <h2 className="text-base sm:text-lg font-extrabold wf-gradient-title font-mono uppercase tracking-wider">
                Final Pipeline Synthesis
              </h2>
              {lastExecutedNode && (
                <span className="text-xs font-mono text-indigo-200 bg-[#0b0d14] border border-[#49effd]/30 px-2.5 py-1 rounded-lg shadow-[0_0_12px_rgba(73,239,253,0.1)]">
                  source: <span className="text-[#49effd] font-bold">{lastExecutedNode.label}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {runHistory.length >= 2 && (
                <button
                  type="button"
                  onClick={() => setShowRunDiffModal(true)}
                  className="min-h-[40px] px-3 py-1.5 rounded-xl bg-violet-500/15 hover:bg-violet-500/25 border border-violet-400/40 text-violet-200 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                  title="Compare outputs and timing across two runs"
                >
                  <GitCompare size={14} className="text-violet-300" />
                  <span>Compare Runs</span>
                </button>
              )}
              {lastExecutedOutput && (
                <>
                  <button
                    type="button"
                    onClick={() => handleExportReport('md')}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#141722] hover:bg-[#1c2030] border border-white/10 hover:border-emerald-400/45 text-emerald-300 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                    title="Export full run report as Markdown"
                  >
                    <Download size={14} />
                    <span>.md</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportReport('txt')}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#141722] hover:bg-[#1c2030] border border-white/10 hover:border-sky-400/45 text-sky-300 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                    title="Export final output as plain text"
                  >
                    <FileText size={14} />
                    <span>.txt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportReport('json')}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#141722] hover:bg-[#1c2030] border border-white/10 hover:border-amber-400/45 text-amber-300 text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-all active:scale-95"
                    title="Export full run trace as JSON"
                  >
                    <Download size={14} />
                    <span>.json</span>
                  </button>
                </>
              )}
              {lastExecutedOutput && lastExecutedOutput.type !== 'image' && (
                <button
                  type="button"
                  onClick={() => handleCopyText(lastExecutedOutput.value, 'final-result')}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#141722] hover:bg-[#1c2030] border border-white/10 hover:border-[#49effd]/45 text-cyan-300 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all active:scale-95"
                >
                  {copiedKey === 'final-result' ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span className="text-emerald-300">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} className="text-[#49effd]" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {lastExecutedOutput ? (
            <div className="mc-glow-input-wrap wf-final-output-enter rounded-2xl p-[1px]">
              <div className="wf-cyber-card rounded-2xl p-4 sm:p-5 relative overflow-hidden">
                <div className="mc-laser-line opacity-85" />
                <div className="mc-laser-line-bottom opacity-55" />
                {lastExecutedOutput.type !== 'image' && (
                  <pre
                    className={`${
                      textComfortMode === 'large' ? 'text-base sm:text-lg' : 'text-sm sm:text-[15px]'
                    } text-cyan-100 font-mono whitespace-pre-wrap break-words max-h-[28rem] overflow-y-auto leading-relaxed bg-[#090b10]/95 border border-white/10 rounded-xl p-4 shadow-inner`}
                  >
                    {lastExecutedOutput.value}
                  </pre>
                )}
                {lastExecutedOutput.type === 'image' && (
                  <div className="space-y-4">
                    <div className="rounded-xl overflow-hidden max-w-md bg-[#090b10] border border-white/10 shadow-lg">
                      <img
                        src={lastExecutedOutput.value}
                        alt="Final synthesis"
                        referrerPolicy="no-referrer"
                        className="w-full object-cover max-h-96"
                      />
                    </div>
                    <a
                      href={lastExecutedOutput.value}
                      download="nexus-workflow-result.png"
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[42px] inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#49effd] to-[#22d3ee] hover:brightness-110 text-[#00363b] font-mono text-xs sm:text-sm font-extrabold uppercase tracking-wider shadow-[0_0_22px_rgba(73,239,253,0.4)] transition-all active:scale-95"
                    >
                      <Download size={15} />
                      <span>Download Image</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="wf-cyber-card rounded-2xl py-5 px-5 text-sm font-mono wf-rainbow-subtext">
              No pipeline output recorded in this session yet. Click{' '}
              <span className="text-[#49effd] font-bold uppercase">Run</span> to execute steps.
            </div>
          )}
        </section>

        {/* ================= CYBER EXECUTION LOG STREAM ================= */}
        <section
          ref={traceSectionRef}
          className="pt-6 border-t border-white/[0.08] space-y-3"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-[#49effd] shadow-[0_0_8px_#49effd]" />
              <span className="font-bold wf-gradient-title">Execution Trace</span>
              <span aria-hidden="true" className="text-white/20">·</span>
              <span className="tabular-nums text-amber-300 font-bold">
                {runLogs.length} events
              </span>
            </div>
            {runLogs.length > 0 && (
              <button
                type="button"
                onClick={() => setRunLogs([])}
                className="min-h-[38px] font-mono text-xs font-bold uppercase tracking-wider text-rose-300 hover:text-[#49effd] px-3 py-1.5 rounded-lg bg-[#0b0d14] hover:bg-[#141722] border border-white/10 transition-colors"
              >
                Clear Trace
              </button>
            )}
          </div>

          {runLogs.length > 0 ? (
            <div className="wf-cyber-card rounded-2xl overflow-hidden divide-y divide-white/[0.06] max-h-64 overflow-y-auto">
              {runLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-3 px-4 hover:bg-white/[0.03] text-xs sm:text-sm font-mono tabular-nums transition-colors gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {log.status === 'done' ? (
                      <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle size={15} className="text-[#ffb4ab] flex-shrink-0" />
                    )}
                    <span className="font-bold text-cyan-200 truncate">
                      {log.label}
                    </span>
                    <span aria-hidden="true" className="text-[#3b494b] hidden sm:inline">·</span>
                    <span className="text-xs uppercase tracking-wider text-fuchsia-300 bg-[#0e0e12] border border-[#2a292e] px-2 py-0.5 rounded hidden sm:inline">
                      {log.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-emerald-300 font-bold">{log.durationMs}ms</span>
                    <span className="text-xs text-amber-300/80">{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="wf-cyber-card rounded-xl py-4 px-4 text-sm font-mono text-zinc-400">
              No trace events logged yet.
            </div>
          )}
        </section>
        </div>
      </div>

      {/* ================= CYBER RUN HISTORY MODAL ================= */}
      {showHistoryModal && (
        <div className="wf-modal-backdrop fixed inset-0 z-[1300] bg-[#0e0e12]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="wf-cyber-card wf-modal-panel rounded-t-3xl sm:rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-[0_24px_64px_rgba(0,0,0,0.85),0_0_24px_rgba(73,239,253,0.14)] space-y-4 backdrop-blur-2xl max-h-[88dvh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-[#2a292e] pb-3 shrink-0">
              <div className="min-w-0 flex-1 pr-2">
                <h3 className="text-base font-extrabold wf-gradient-title font-mono uppercase tracking-wider flex items-center gap-2 min-w-0">
                  <History size={17} className="text-[#49effd] shrink-0" />
                  <span className="truncate">
                    History · {activeWorkflow.name.length > 24 ? `${activeWorkflow.name.slice(0, 24)}…` : activeWorkflow.name}
                  </span>
                </h3>
                <p className="text-xs sm:text-sm wf-rainbow-subtext mt-0.5 truncate">
                  Last 20 runs recorded for this workflow pipeline.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {runHistory.length >= 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowHistoryModal(false);
                      setSelectedRunDetail(null);
                      setShowRunDiffModal(true);
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-violet-500/15 hover:bg-violet-500/25 text-violet-200 border border-violet-400/40 transition-colors flex items-center gap-1.5"
                    title="Compare two runs side-by-side"
                  >
                    <GitCompare size={14} />
                    <span>Compare</span>
                  </button>
                )}
                {runHistory.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      storage.clearWorkflowRunHistory(activeWorkflow.id);
                      setRunHistory([]);
                      setSelectedRunDetail(null);
                      showToast('Run history cleared');
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-mono font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors flex items-center gap-1.5"
                    title="Clear history for this workflow"
                  >
                    <Trash2 size={14} />
                    <span className="hidden sm:inline">Clear</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowHistoryModal(false);
                    setSelectedRunDetail(null);
                  }}
                  className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[#0e0e12] hover:bg-[#2a292e] border border-[#2a292e] text-[#b9cacb] hover:text-[#e4e1e7] transition-colors"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {runHistory.length === 0 ? (
                <div className="py-12 text-center text-zinc-400 font-mono text-sm">
                  <Clock size={30} className="mx-auto mb-2.5 text-zinc-600 opacity-60" />
                  <p>No runs recorded for this workflow yet.</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Execute the pipeline to record your first run history.
                  </p>
                </div>
              ) : selectedRunDetail ? (
                /* Detail View of a Single Run */
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-2 flex-wrap p-3 rounded-xl bg-[#0b0d14] border border-[#2a292e]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setSelectedRunDetail(null)}
                        className="min-h-[38px] px-3 py-1 rounded-xl text-xs font-mono bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border border-zinc-700 transition-colors"
                      >
                        ← Back to List
                      </button>
                      <span className="text-xs font-mono text-zinc-400">
                        {new Date(selectedRunDetail.startedAt).toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase tracking-wider ${
                          selectedRunDetail.status === 'success'
                            ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                            : selectedRunDetail.status === 'error'
                            ? 'bg-[#ffb4ab]/15 border border-[#ffb4ab]/40 text-[#ffb4ab]'
                            : 'bg-amber-500/15 border border-amber-500/40 text-amber-300'
                        }`}
                      >
                        {selectedRunDetail.status === 'success' && <CheckCircle2 size={12} />}
                        {selectedRunDetail.status === 'error' && <AlertCircle size={12} />}
                        {selectedRunDetail.status === 'stopped' && <Square size={12} />}
                        <span>{selectedRunDetail.status}</span>
                      </span>

                      <span className="text-sm font-mono font-bold text-emerald-300">
                        {(selectedRunDetail.durationMs / 1000).toFixed(1)}s
                      </span>
                    </div>
                  </div>

                  {/* Step Breakdown */}
                  <div>
                    <h4 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider mb-2">
                      Step Breakdown ({selectedRunDetail.steps.length} steps)
                    </h4>
                    <div className="space-y-2">
                      {selectedRunDetail.steps.map((st, idx) => (
                        <div
                          key={`${st.nodeId}-${idx}`}
                          className="p-3.5 rounded-xl bg-[#0e0e12] border border-[#2a292e] flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-xs font-mono text-zinc-500">#{idx + 1}</span>
                              <span className="text-sm font-bold text-cyan-200 truncate">{st.label}</span>
                              <span className="text-xs uppercase font-mono px-2 py-0.5 rounded bg-zinc-800 text-fuchsia-300 border border-zinc-700">
                                {st.type}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span
                                className={`text-xs font-mono uppercase px-2 py-0.5 rounded ${
                                  st.status === 'done'
                                    ? 'text-emerald-300 bg-emerald-500/10'
                                    : st.status === 'error'
                                    ? 'text-[#ffb4ab] bg-rose-500/10'
                                    : st.status === 'skipped'
                                    ? 'text-zinc-400 bg-zinc-800'
                                    : 'text-zinc-500'
                                }`}
                              >
                                {st.status}
                              </span>
                              <span className="text-xs font-mono text-emerald-400">
                                {st.durationMs > 0 ? `${st.durationMs}ms` : '—'}
                              </span>
                            </div>
                          </div>

                          {st.outputSummary && (
                            <p className="text-xs font-mono text-zinc-300 bg-[#080b12] rounded-lg px-2.5 py-1.5 border border-zinc-800/80 truncate">
                              Summary:{' '}
                              {st.outputSummary === '[1 image]' || st.outputSummary.startsWith('data:image/')
                                ? '🖼️ 1 image'
                                : st.outputSummary}
                            </p>
                          )}

                          {st.error && (
                            <p className="text-xs font-mono text-rose-300 bg-rose-950/20 rounded-lg px-2.5 py-1.5 border border-rose-900/40">
                              Error: {st.error}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Final Output if available */}
                  {selectedRunDetail.finalOutput && (
                    <div className="space-y-1.5">
                      <h4 className="text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider">
                        Final Output
                      </h4>
                      <pre className="p-3.5 rounded-xl bg-[#080b12] border border-cyan-500/25 text-cyan-100 font-mono text-sm whitespace-pre-wrap break-words max-h-52 overflow-y-auto leading-relaxed">
                        {selectedRunDetail.finalOutput === '[1 image]' ||
                        selectedRunDetail.finalOutput.startsWith('data:image/')
                          ? '🖼️ 1 image'
                          : selectedRunDetail.finalOutput}
                      </pre>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-800">
                    <button
                      type="button"
                      disabled={isRunning}
                      onClick={() => {
                        setShowHistoryModal(false);
                        setSelectedRunDetail(null);
                        handleRun();
                      }}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#49effd] to-[#00f0ff] hover:brightness-110 text-[#00363b] font-mono font-extrabold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_0_12px_rgba(73,239,253,0.3)] disabled:opacity-40"
                    >
                      <Play size={14} className="fill-[#00363b]" />
                      <span>Re-run Workflow</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* Run List (Newest first) */
                <div className="space-y-2.5">
                  {runHistory.map((run, idx) => (
                    <div
                      key={run.id || idx}
                      onClick={() => setSelectedRunDetail(run)}
                      className="p-4 rounded-xl bg-[#0e0e12] hover:bg-[#1b1b1f] border border-[#2a292e] hover:border-[#49effd]/40 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="min-w-0 space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-mono font-bold uppercase tracking-wider ${
                              run.status === 'success'
                                ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                                : run.status === 'error'
                                ? 'bg-[#ffb4ab]/15 border border-[#ffb4ab]/40 text-[#ffb4ab]'
                                : 'bg-amber-500/15 border border-amber-500/40 text-amber-300'
                            }`}
                          >
                            {run.status === 'success' && <CheckCircle2 size={12} />}
                            {run.status === 'error' && <AlertCircle size={12} />}
                            {run.status === 'stopped' && <Square size={12} />}
                            <span>{run.status}</span>
                          </span>

                          <span className="text-xs sm:text-sm font-mono text-zinc-300">
                            {new Date(run.startedAt).toLocaleString()}
                          </span>

                          <span className="text-xs sm:text-sm font-mono font-bold text-emerald-300 ml-auto sm:ml-0">
                            {(run.durationMs / 1000).toFixed(1)}s
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                          <span>{run.steps?.length || 0} steps</span>
                          {run.finalOutput && (
                            <>
                              <span>·</span>
                              <span className="truncate max-w-[280px] text-zinc-400">
                                {run.finalOutput === '[1 image]' || run.finalOutput.startsWith('data:image/')
                                  ? '🖼️ 1 image'
                                  : run.finalOutput.length > 60
                                  ? `${run.finalOutput.slice(0, 60)}...`
                                  : run.finalOutput}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          disabled={isRunning}
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowHistoryModal(false);
                            handleRun();
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-cyan-300 border border-zinc-700 font-mono text-xs flex items-center gap-1.5 transition-colors disabled:opacity-40"
                          title="Run this workflow again"
                        >
                          <Play size={12} className="fill-cyan-300" />
                          <span>Re-run</span>
                        </button>

                        <span className="text-zinc-400 group-hover:text-cyan-300 transition-colors text-xs sm:text-sm font-mono">
                          Details →
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= CYBER TEMPLATES MODAL ================= */}
      {showTemplatesModal && (
        <div className="wf-modal-backdrop fixed inset-0 z-[1300] bg-[#0e0e12]/85 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="wf-cyber-card wf-modal-panel rounded-t-3xl sm:rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-[0_24px_64px_rgba(0,0,0,0.85),0_0_24px_rgba(73,239,253,0.14)] space-y-5 backdrop-blur-2xl max-h-[88dvh] flex flex-col">
            <div className="flex items-center justify-between border-b border-[#2a292e] pb-4 shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-extrabold wf-gradient-title font-mono uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={16} className="text-[#49effd]" />
                  <span>Pipeline Templates</span>
                </h3>
                <p className="text-xs sm:text-sm wf-rainbow-subtext mt-0.5">
                  Load pre-configured multi-step workflows.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplatesModal(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-[#0e0e12] hover:bg-[#2a292e] border border-[#2a292e] text-[#b9cacb] hover:text-[#e4e1e7]"
              >
                <X size={17} />
              </button>
            </div>

            <div className="space-y-3 overflow-y-auto pr-1 flex-1">
              {DEFAULT_WORKFLOW_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.name}
                  className="p-4 rounded-xl bg-[#0e0e12] hover:bg-[#1b1b1f] border border-[#2a292e] hover:border-[#49effd]/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <h4 className="text-sm sm:text-base font-bold wf-step-title-gradient">{tmpl.name}</h4>
                    <p className="text-xs sm:text-sm text-indigo-200/85 leading-relaxed">{tmpl.description}</p>
                    <div className="flex items-center gap-2 pt-1 text-xs font-mono uppercase tracking-wider tabular-nums text-[#49effd]">
                      <span className="bg-[#1b1b1f] border border-[#2a292e] px-2.5 py-0.5 rounded-md text-cyan-300">
                        {tmpl.nodes.length} steps
                      </span>
                      <span className="bg-[#1b1b1f] border border-[#2a292e] px-2.5 py-0.5 rounded-md text-fuchsia-300">
                        {tmpl.edges.length} links
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#49effd] to-[#00f0ff] hover:brightness-110 text-[#00363b] font-mono font-extrabold text-xs sm:text-sm uppercase tracking-wider flex-shrink-0 transition-all shadow-[0_0_16px_rgba(73,239,253,0.3)] active:scale-95 whitespace-nowrap"
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= 10 POWER FEATURES: MODALS & DRAWERS ================= */}
      <WorkflowAiGeneratorModal
        isOpen={showAiGeneratorModal}
        onClose={() => setShowAiGeneratorModal(false)}
        onApplyWorkflow={(wf) => {
          setWorkflows((prev) => [wf, ...prev]);
          setActiveWorkflowId(wf.id);
          setSelectedNodeId(null);
          handleClearResults();
          showToast(`AI generated "${wf.name}"`);
        }}
      />

      <WorkflowVariablesModal
        isOpen={showVariablesModal}
        onClose={() => setShowVariablesModal(false)}
        variables={activeWorkflowVariables}
        onSaveVariables={(nextVars) => {
          updateCurrentWorkflow((wf) => ({ ...wf, variables: nextVars }));
          showToast(`Saved ${nextVars.length} workflow variable${nextVars.length === 1 ? '' : 's'}`);
        }}
        onRunWithVariables={(vals) => executeWorkflowRun(undefined, vals)}
        isRunning={isRunning}
      />

      <WorkflowValidatorPanel
        isOpen={showValidatorPanel}
        onClose={() => setShowValidatorPanel(false)}
        issues={validationIssues}
        onFocusNode={handleJumpToNode}
      />

      <WorkflowBatchRunnerModal
        isOpen={showBatchRunnerModal}
        onClose={() => setShowBatchRunnerModal(false)}
        workflow={activeWorkflow}
      />

      <WorkflowRunDiffModal
        isOpen={showRunDiffModal}
        onClose={() => setShowRunDiffModal(false)}
        runs={runHistory}
      />

      <WorkflowLibraryDrawer
        isOpen={showLibraryDrawer}
        onClose={() => setShowLibraryDrawer(false)}
        workflows={workflows}
        activeWorkflowId={activeWorkflow.id}
        onSelectWorkflow={(id) => {
          setActiveWorkflowId(id);
          setSelectedNodeId(null);
          handleClearResults();
        }}
        onCreateNew={handleCreateNew}
        onTogglePin={handleTogglePinWorkflow}
        onDuplicateWorkflow={handleDuplicateWorkflowById}
        onDeleteWorkflow={handleDeleteWorkflowById}
        onUpdateMeta={handleUpdateWorkflowMeta}
      />

      <WorkflowQuickJumpModal
        isOpen={showQuickJumpModal}
        onClose={() => setShowQuickJumpModal(false)}
        nodes={activeWorkflow.nodes}
        onJumpToNode={handleJumpToNode}
        onRun={handleRun}
        onOpenAiGenerator={() => setShowAiGeneratorModal(true)}
        onOpenBatchRunner={() => setShowBatchRunnerModal(true)}
        onOpenVariables={() => setShowVariablesModal(true)}
        onOpenValidator={() => setShowValidatorPanel(true)}
        onOpenLibrary={() => setShowLibraryDrawer(true)}
        onOpenHistory={() => setShowHistoryModal(true)}
        onToggleViewMode={() => setViewMode((m) => (m === 'list' ? 'canvas' : 'list'))}
        viewMode={viewMode}
      />
    </div>
  );
}

function getProviderModels(provider: AIProviderConfig): Array<{ id: string; name: string }> {
  if (Array.isArray(provider.models) && provider.models.length > 0) {
    return provider.models.map((m) => ({ id: m.id, name: m.name || m.id }));
  }
  if (provider.model && provider.model.trim()) {
    return [{ id: provider.model.trim(), name: provider.model.trim() }];
  }
  return [];
}

interface VariableFieldProps {
  label: string;
  value: string;
  onChange: (nextVal: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  currentNodeId: string;
  earlierSteps: WorkflowNode[];
  allNodes: WorkflowNode[];
  stepOutputs: Record<string, WorkflowOutput>;
  workflowVariables?: WorkflowVariable[];
  textComfortMode?: 'normal' | 'large';
}

/**
 * Reusable text/textarea field with:
 * 1) "{ } Insert variable" button & popover showing earlier steps + global {{vars.key}} variables
 * 2) "{{" autocomplete dropdown filtered by step label or variable key (Escape to close)
 * 3) Live preview line under the field resolving both {{Step.output}} and {{vars.key}}
 */
function VariableField({
  label,
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
  currentNodeId,
  earlierSteps,
  allNodes,
  stepOutputs,
  workflowVariables = [],
  textComfortMode = 'normal',
}: VariableFieldProps) {
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [autocompleteState, setAutocompleteState] = useState<{
    startIndex: number;
    endIndex: number;
    query: string;
  } | null>(null);

  const checkAutocomplete = (textVal: string, cursorPos: number | null) => {
    if (cursorPos === null || cursorPos < 2) {
      setAutocompleteState(null);
      return;
    }
    const beforeCursor = textVal.slice(0, cursorPos);
    const match = beforeCursor.match(/\{\{([^}\n]*)$/);
    if (match && match.index !== undefined) {
      setAutocompleteState({
        startIndex: match.index,
        endIndex: cursorPos,
        query: match[1],
      });
    } else {
      setAutocompleteState(null);
    }
  };

  const handleFieldChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const nextVal = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(nextVal);
    checkAutocomplete(nextVal, cursorPos);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    if (e.key === 'Escape') {
      if (autocompleteState || showInsertMenu) {
        e.stopPropagation();
        setAutocompleteState(null);
        setShowInsertMenu(false);
      }
    }
  };

  const insertRawTagAtCursor = (tag: string, replaceAutocomplete = false) => {
    let nextValue: string;
    let nextCursor: number;

    if (replaceAutocomplete && autocompleteState) {
      nextValue =
        value.slice(0, autocompleteState.startIndex) +
        tag +
        value.slice(autocompleteState.endIndex);
      nextCursor = autocompleteState.startIndex + tag.length;
    } else {
      const el = fieldRef.current;
      const start =
        el && typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
      const end =
        el && typeof el.selectionEnd === 'number' ? el.selectionEnd : value.length;
      nextValue = value.slice(0, start) + tag + value.slice(end);
      nextCursor = start + tag.length;
    }

    onChange(nextValue);
    setShowInsertMenu(false);
    setAutocompleteState(null);

    requestAnimationFrame(() => {
      if (fieldRef.current) {
        fieldRef.current.focus();
        fieldRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const handleInsertVariableAtCursor = (step: WorkflowNode) => {
    insertRawTagAtCursor(`{{${step.label}.output}}`, false);
  };

  const handleSelectAutocomplete = (step: WorkflowNode) => {
    insertRawTagAtCursor(`{{${step.label}.output}}`, Boolean(autocompleteState));
  };

  const handleInsertWorkflowVar = (variable: WorkflowVariable, replaceAutocomplete = false) => {
    insertRawTagAtCursor(`{{vars.${variable.key}}}`, replaceAutocomplete);
  };

  const filteredAutocompleteSteps = useMemo(() => {
    if (!autocompleteState) return [];
    const q = autocompleteState.query.trim().toLowerCase();
    if (!q) return earlierSteps;
    return earlierSteps.filter((s) => s.label.toLowerCase().includes(q));
  }, [autocompleteState, earlierSteps]);

  const filteredAutocompleteVars = useMemo(() => {
    if (!autocompleteState) return [];
    const q = autocompleteState.query.trim().toLowerCase();
    if (!q) return workflowVariables;
    return workflowVariables.filter(
      (v) =>
        v.key.toLowerCase().includes(q) ||
        `vars.${v.key}`.toLowerCase().includes(q) ||
        (v.label || '').toLowerCase().includes(q),
    );
  }, [autocompleteState, workflowVariables]);

  const previewSegments = useMemo(() => {
    if (!value) return [];
    const segments: Array<
      | { kind: 'text'; text: string }
      | { kind: 'resolved'; label: string; text: string }
      | { kind: 'unrun'; label: string }
      | { kind: 'unknown'; rawName: string }
    > = [];

    const regex = /\{\{\s*(vars\.([a-zA-Z0-9_-]+)|([^}]+?)\.output)\s*\}\}/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(value)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          kind: 'text',
          text: value.slice(lastIndex, match.index),
        });
      }

      const varKey = match[2]?.trim();
      const stepKey = match[3]?.trim();

      if (varKey) {
        const matchedVar = workflowVariables.find(
          (v) => v.key.trim().toLowerCase() === varKey.toLowerCase(),
        );
        if (!matchedVar) {
          segments.push({ kind: 'unknown', rawName: `vars.${varKey}` });
        } else {
          const val = matchedVar.defaultValue ?? matchedVar.example ?? '';
          if (val !== '') {
            segments.push({
              kind: 'resolved',
              label: `vars.${matchedVar.key}`,
              text: val.length > 60 ? `${val.slice(0, 60)}…` : val,
            });
          } else {
            segments.push({ kind: 'unrun', label: `vars.${matchedVar.key} (empty)` });
          }
        }
      } else if (stepKey) {
        const matchedNode = allNodes.find(
          (n) =>
            n.id !== currentNodeId &&
            (n.id.trim().toLowerCase() === stepKey.toLowerCase() ||
              n.label.trim().toLowerCase() === stepKey.toLowerCase()),
        );

        if (!matchedNode) {
          segments.push({ kind: 'unknown', rawName: stepKey });
        } else {
          const isFrozen = matchedNode.settings?.frozen === 'true' || Boolean(matchedNode.frozen);
          const out =
            stepOutputs[matchedNode.id] ||
            (isFrozen && matchedNode.mockOutput) ||
            (isFrozen && matchedNode.settings?.mockValue
              ? {
                  type: (matchedNode.settings.mockType as 'text' | 'json' | 'image') || 'text',
                  value: matchedNode.settings.mockValue,
                }
              : undefined);
          if (out && out.value !== undefined && out.value !== '') {
            const displayVal =
              out.type === 'image'
                ? '[1 image]'
                : out.value.length > 60
                ? out.value.slice(0, 60) + '…'
                : out.value;
            segments.push({
              kind: 'resolved',
              label: matchedNode.label,
              text: isFrozen ? `❄️ ${displayVal}` : displayVal,
            });
          } else {
            segments.push({ kind: 'unrun', label: matchedNode.label });
          }
        }
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < value.length) {
      segments.push({ kind: 'text', text: value.slice(lastIndex) });
    }

    return segments;
  }, [value, allNodes, currentNodeId, stepOutputs, workflowVariables]);

  const hasAnyPlaceholder = useMemo(
    () => /\{\{\s*(vars\.[a-zA-Z0-9_-]+|[^}]+?\.output)\s*\}\}/i.test(value || ''),
    [value],
  );

  const renderStepPickerRow = (
    step: WorkflowNode,
    onPick: (step: WorkflowNode) => void,
  ) => {
    const cfg = NODE_CONFIG[step.type] || NODE_CONFIG.input;
    const StepIcon = cfg.icon;
    const isFrozen = step.settings?.frozen === 'true' || Boolean(step.frozen);
    const out =
      stepOutputs[step.id] ||
      (isFrozen && step.mockOutput) ||
      (isFrozen && step.settings?.mockValue
        ? {
            type: (step.settings.mockType as 'text' | 'json' | 'image') || 'text',
            value: step.settings.mockValue,
          }
        : undefined);
    const snippet = out
      ? out.type === 'image'
        ? '[Generated image]'
        : (isFrozen ? '❄️ ' : '') + (out.value || '').slice(0, 40) + ((out.value || '').length > 40 ? '…' : '')
      : isFrozen
      ? '❄️ Frozen mock output'
      : '';

    return (
      <button
        key={step.id}
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onPick(step)}
        className="w-full min-h-[44px] flex items-center justify-between gap-2.5 p-2.5 rounded-xl hover:bg-[#49effd]/15 active:bg-[#49effd]/25 text-left transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg border border-[#3b494b]/40 flex-shrink-0 ${cfg.color}`}>
            <StepIcon size={14} />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-bold text-[#e4e1e7] truncate">{step.label}</div>
            <div className="text-xs font-mono text-[#b9cacb] truncate">
              {snippet ? snippet : 'No output yet'}
            </div>
          </div>
        </div>
        <span className="text-xs font-mono text-[#49effd] bg-[#0e0e12] border border-[#2a292e] px-2 py-0.5 rounded-md flex-shrink-0">
          {`{{${step.label}.output}}`}
        </span>
      </button>
    );
  };

  const renderVarPickerRow = (
    variable: WorkflowVariable,
    onPick: (v: WorkflowVariable) => void,
  ) => (
    <button
      key={variable.key}
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(variable)}
      className="w-full min-h-[44px] flex items-center justify-between gap-2.5 p-2.5 rounded-xl hover:bg-sky-500/15 active:bg-sky-500/25 text-left transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <div className="p-1.5 rounded-lg border border-sky-400/35 bg-sky-500/15 text-sky-300 flex-shrink-0">
          <Sliders size={14} />
        </div>
        <div className="min-w-0">
          <div className="text-xs sm:text-sm font-bold text-sky-100 truncate">
            {variable.label || variable.key}
          </div>
          <div className="text-xs font-mono text-zinc-400 truncate">
            {variable.defaultValue || variable.example || 'No default value'}
          </div>
        </div>
      </div>
      <span className="text-xs font-mono text-sky-300 bg-[#0e0e12] border border-sky-500/30 px-2 py-0.5 rounded-md flex-shrink-0">
        {`{{vars.${variable.key}}}`}
      </span>
    </button>
  );

  const inputTextClass =
    textComfortMode === 'large'
      ? 'text-base sm:text-base'
      : 'text-base sm:text-sm';

  return (
    <div className="relative space-y-1.5">
      {/* Header row with label and "{ } Insert variable" button */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient">
          {label}
        </label>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setShowInsertMenu((prev) => !prev);
            setAutocompleteState(null);
          }}
          className="min-h-[36px] px-3 py-1 rounded-lg bg-gradient-to-r from-[#49effd]/15 to-fuchsia-500/15 hover:from-[#49effd]/25 hover:to-fuchsia-500/25 border border-[#49effd]/40 text-[#49effd] text-xs font-mono font-bold flex items-center gap-1 transition-all active:scale-95"
          title="Insert output variable from an earlier step or global variable"
        >
          <span>{'{ } Insert variable'}</span>
        </button>
      </div>

      {/* "{ } Insert variable" Dropdown List */}
      {showInsertMenu && (
        <div className="wf-popover-enter z-30 rounded-xl bg-[#131317]/98 border border-[#49effd]/40 p-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl space-y-2">
          <div className="flex items-center justify-between px-1 pb-1.5 border-b border-[#2a292e]">
            <span className="text-xs font-mono font-bold uppercase tracking-wider wf-label-gradient">
              Steps ({earlierSteps.length}) & Global Vars ({workflowVariables.length})
            </span>
            <button
              type="button"
              onClick={() => setShowInsertMenu(false)}
              className="text-[#b9cacb] hover:text-[#e4e1e7] p-1"
            >
              <X size={14} />
            </button>
          </div>
          {earlierSteps.length > 0 || workflowVariables.length > 0 ? (
            <div className="space-y-1 max-h-56 overflow-y-auto pr-0.5">
              {workflowVariables.map((v) =>
                renderVarPickerRow(v, (picked) => handleInsertWorkflowVar(picked, false)),
              )}
              {earlierSteps.map((step) =>
                renderStepPickerRow(step, handleInsertVariableAtCursor),
              )}
            </div>
          ) : (
            <div className="text-xs font-mono text-amber-300/90 py-2 px-1">
              No earlier steps or global variables available yet. Add a global variable via the Vars button.
            </div>
          )}
        </div>
      )}

      {/* Input or Textarea with Glowing Studio Field Box */}
      {multiline ? (
        <textarea
          ref={fieldRef}
          rows={rows}
          value={value}
          onChange={handleFieldChange}
          onKeyDown={handleKeyDown}
          onClick={(e) =>
            checkAutocomplete(
              (e.target as HTMLTextAreaElement).value,
              (e.target as HTMLTextAreaElement).selectionStart,
            )
          }
          placeholder={placeholder}
          className={`wf-field-box w-full rounded-xl p-3.5 text-cyan-100 placeholder-indigo-300/45 ${inputTextClass} leading-relaxed focus:outline-none font-mono resize-y`}
        />
      ) : (
        <input
          ref={fieldRef}
          type="text"
          value={value}
          onChange={handleFieldChange}
          onKeyDown={handleKeyDown}
          onClick={(e) =>
            checkAutocomplete(
              (e.target as HTMLInputElement).value,
              (e.target as HTMLInputElement).selectionStart,
            )
          }
          placeholder={placeholder}
          className={`wf-field-box w-full min-h-[44px] rounded-xl px-3.5 py-2.5 text-cyan-100 placeholder-indigo-300/45 ${inputTextClass} focus:outline-none font-mono`}
        />
      )}

      {/* "{{" Autocomplete Dropdown under the field */}
      {autocompleteState && (
        <div className="wf-popover-enter z-30 rounded-xl bg-[#131317]/98 border border-[#49effd]/40 p-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl space-y-1.5">
          <div className="flex items-center justify-between px-1 pb-1.5 border-b border-[#2a292e]">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-[#49effd]">
              Autocomplete {autocompleteState.query ? `“${autocompleteState.query}”` : ''}
            </span>
            <button
              type="button"
              onClick={() => setAutocompleteState(null)}
              className="text-xs text-[#b9cacb] hover:text-[#e4e1e7] font-mono uppercase px-1.5 py-0.5"
            >
              Esc
            </button>
          </div>
          {filteredAutocompleteSteps.length > 0 || filteredAutocompleteVars.length > 0 ? (
            <div className="space-y-1 max-h-48 overflow-y-auto pr-0.5">
              {filteredAutocompleteVars.map((v) =>
                renderVarPickerRow(v, (picked) => handleInsertWorkflowVar(picked, true)),
              )}
              {filteredAutocompleteSteps.map((step) =>
                renderStepPickerRow(step, handleSelectAutocomplete),
              )}
            </div>
          ) : (
            <div className="text-xs font-mono text-[#b9cacb] py-1.5 px-1">
              No matching steps or global variables found.
            </div>
          )}
        </div>
      )}

      {/* Live Preview line under the field */}
      {(hasAnyPlaceholder || value.includes('{{')) && (
        <div className="py-2 px-3 rounded-xl bg-[#0e0e12] border border-[#2a292e] text-xs font-mono text-[#e4e1e7] leading-relaxed break-words">
          <span className="text-xs uppercase tracking-wider text-[#49effd] font-bold mr-1.5 select-none">
            Preview:
          </span>
          {previewSegments.map((seg, idx) => {
            if (seg.kind === 'text') {
              return <span key={idx}>{seg.text}</span>;
            }
            if (seg.kind === 'resolved') {
              return (
                <span
                  key={idx}
                  className="text-emerald-300 underline decoration-emerald-500/40 underline-offset-2 mx-0.5"
                  title={`Resolved from ${seg.label}`}
                >
                  {seg.text}
                </span>
              );
            }
            if (seg.kind === 'unrun') {
              return (
                <span
                  key={idx}
                  className="text-amber-300 mx-0.5"
                >
                  [{seg.label}: not run yet]
                </span>
              );
            }
            return (
              <span
                key={idx}
                className="text-[#ffb4ab] mx-0.5"
              >
                [{seg.rawName}: unknown]
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Shared StepSettingsForm component for configuring node properties
 */
interface StepSettingsFormProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  edges?: WorkflowEdge[];
  stepOutputs?: Record<string, WorkflowOutput>;
  workflowVariables?: WorkflowVariable[];
  textComfortMode?: 'normal' | 'large';
  viewMode?: 'list' | 'canvas';
  isWorkflowRunning?: boolean;
  onRunSingleNode?: (nodeId: string) => void;
  onUpdateSettings: (newSettings: Record<string, string>) => void;
}

export function StepSettingsForm({
  node,
  allNodes,
  edges = [],
  stepOutputs = {},
  workflowVariables = [],
  textComfortMode = 'normal',
  viewMode = 'list',
  isWorkflowRunning = false,
  onRunSingleNode,
  onUpdateSettings,
}: StepSettingsFormProps) {
  const settings = node.settings || {};
  const isFrozen = settings.frozen === 'true';
  const continueOnError = settings.continueOnError === 'true';
  const retryCount = settings.retries || '0';
  const controlTextClass =
    textComfortMode === 'large' ? 'text-base' : 'text-base sm:text-sm';

  const [configuredProviders, setConfiguredProviders] = useState<AIProviderConfig[]>(() => {
    try {
      return storage.getAIProvidersState().providers || [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const syncProviders = () => {
      try {
        setConfiguredProviders(storage.getAIProvidersState().providers || []);
      } catch {
        setConfiguredProviders([]);
      }
    };
    window.addEventListener('storage', syncProviders);
    window.addEventListener('nexus-ai-providers-updated', syncProviders);
    return () => {
      window.removeEventListener('storage', syncProviders);
      window.removeEventListener('nexus-ai-providers-updated', syncProviders);
    };
  }, []);

  const [savedSkills, setSavedSkills] = useState<Skill[]>(() => {
    try {
      return storage.getSkills();
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const syncSkills = () => {
      try {
        setSavedSkills(storage.getSkills());
      } catch {
        setSavedSkills([]);
      }
    };
    window.addEventListener('nexus-skills-changed', syncSkills);
    window.addEventListener('storage', syncSkills);
    return () => {
      window.removeEventListener('nexus-skills-changed', syncSkills);
      window.removeEventListener('storage', syncSkills);
    };
  }, []);

  const selectedProvider = useMemo(() => {
    if (!settings.providerId || settings.providerId === 'existing') return null;
    return configuredProviders.find((p) => p.id === settings.providerId) || null;
  }, [settings.providerId, configuredProviders]);

  const selectedProviderModels = useMemo(() => {
    if (!selectedProvider) return [];
    return getProviderModels(selectedProvider);
  }, [selectedProvider]);

  const handleChange = (field: string, val: string) => {
    onUpdateSettings({ ...settings, [field]: val });
  };

  const earlierSteps = useMemo(() => {
    if (viewMode === 'list' && edges.length === 0) {
      const idx = allNodes.findIndex((n) => n.id === node.id);
      return idx > 0 ? allNodes.slice(0, idx) : [];
    }
    const ancestorIds = getAncestorNodeIds(node.id, edges);
    if (ancestorIds.size > 0 || viewMode === 'canvas') {
      return allNodes.filter((n) => ancestorIds.has(n.id));
    }
    const idx = allNodes.findIndex((n) => n.id === node.id);
    return idx > 0 ? allNodes.slice(0, idx) : [];
  }, [allNodes, edges, node.id, viewMode]);

  const variableMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of workflowVariables) {
      if (v.key.trim()) map[v.key.trim()] = v.defaultValue ?? v.example ?? '';
    }
    return map;
  }, [workflowVariables]);

  const resolvedSettings = useMemo(() => {
    return resolveNodeSettings(node, allNodes, stepOutputs, variableMap);
  }, [node, allNodes, stepOutputs, variableMap]);

  const hasAnyVariables = useMemo(() => {
    return Object.values(settings).some((val) =>
      /\{\{\s*(vars\.[a-zA-Z0-9_-]+|[^}]+?\.output)\s*\}\}/i.test(val || ''),
    );
  }, [settings]);

  const resolvedPreviewList = useMemo(() => {
    return Object.entries(settings)
      .filter(([, v]) => /\{\{\s*(vars\.[a-zA-Z0-9_-]+|[^}]+?\.output)\s*\}\}/i.test(v || ''))
      .map(([k]) => ({
        field:
          k === 'query'
            ? 'Search Query'
            : k === 'prompt'
            ? 'AI Prompt'
            : k === 'url'
            ? 'Target URL'
            : k === 'input'
            ? 'Transform Input'
            : k === 'template'
            ? 'Merge Template'
            : k,
        resolved: resolvedSettings[k] || '',
      }));
  }, [settings, resolvedSettings]);

  return (
    <div className="space-y-4">
      {/* Interactive Step Debugger & Runner Card */}
      <div className="p-4 rounded-xl bg-[#0b0d14] border border-[#49effd]/25 shadow-[0_4px_20px_rgba(0,0,0,0.5)] space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <span className="p-1.5 rounded-lg bg-[#49effd]/15 border border-[#49effd]/40 text-[#49effd]">
              <Sparkles size={14} />
            </span>
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-200 block">
                Step Debugger
              </span>
              <span className="text-xs text-cyan-300/75 block">
                Test and inspect this step in isolation
              </span>
            </div>
          </div>

          {onRunSingleNode && (
            <button
              type="button"
              disabled={isWorkflowRunning}
              onClick={() => onRunSingleNode(node.id)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-mono text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-40 active:scale-95 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
              title="Execute only this step with current inputs"
            >
              <Play size={13} className="fill-emerald-400 text-emerald-400" />
              <span>Test Step</span>
            </button>
          )}
        </div>

        {/* Live Resolved Inputs Preview */}
        {hasAnyVariables && (
          <div className="pt-2.5 border-t border-[#2a292e] space-y-2">
            <span className="text-xs font-mono font-extrabold uppercase tracking-wider text-[#49effd] block select-none">
              Live Resolved Inputs:
            </span>
            <div className="space-y-2">
              {resolvedPreviewList.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#131317] rounded-xl p-2.5 border border-[#2a292e] text-xs font-mono"
                >
                  <div className="text-xs text-[#49effd] font-bold uppercase tracking-wider mb-1">
                    {item.field}
                  </div>
                  <div className="text-cyan-100 whitespace-pre-wrap break-words max-h-28 overflow-y-auto leading-relaxed">
                    {item.resolved || <span className="text-[#94a3b8] italic">(empty)</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Freeze / Mock Output Toggle Card */}
      <div className="p-4 rounded-xl bg-[#0b0d14] border border-cyan-400/30 shadow-[0_4px_20px_rgba(0,0,0,0.5)] space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={`p-1.5 rounded-lg border shrink-0 ${
                isFrozen
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                  : 'bg-[#1b1b1f] border-white/10 text-[#b9cacb]'
              }`}
            >
              <Snowflake size={14} className={isFrozen ? 'text-cyan-300 animate-pulse' : ''} />
            </span>
            <div>
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-cyan-200 block">
                Freeze Output (Mock / Cache)
              </span>
              <span className="text-xs text-cyan-300/75 block">
                Lock output so downstream steps run instantly without API calls
              </span>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isFrozen}
            onClick={() => {
              const nextFrozen = isFrozen ? 'false' : 'true';
              const nextSettings: Record<string, string> = { ...settings, frozen: nextFrozen };
              if (nextFrozen === 'true' && !settings.mockValue && stepOutputs[node.id]) {
                nextSettings.mockValue = stepOutputs[node.id].value || '';
                nextSettings.mockType = stepOutputs[node.id].type || 'text';
              }
              onUpdateSettings(nextSettings);
            }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none ${
              isFrozen
                ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_12px_rgba(73,239,253,0.35)]'
                : 'bg-[#2a292e] border-[#3b494b]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 mt-0.5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                isFrozen
                  ? 'translate-x-5 bg-[#131317]'
                  : 'translate-x-0.5 bg-[#b9cacb]'
              }`}
            />
          </button>
        </div>

        {/* When Frozen: Mock Output Value Editor */}
        {isFrozen && (
          <div className="pt-2.5 border-t border-[#2a292e] space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1.5">
              <label className="text-xs font-mono font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <span>Mock Output Payload</span>
                <span className="text-xs text-[#94a3b8] font-normal lowercase">
                  ({(settings.mockValue || '').length} chars)
                </span>
              </label>

              <div className="flex items-center gap-1.5">
                {stepOutputs[node.id]?.value && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSettings({
                        ...settings,
                        frozen: 'true',
                        mockValue: stepOutputs[node.id].value,
                        mockType: stepOutputs[node.id].type || 'text',
                      });
                    }}
                    className="min-h-[34px] text-xs font-mono font-bold text-cyan-300 hover:text-[#49effd] px-2.5 py-1 rounded-lg bg-[#131317] border border-cyan-500/35 flex items-center gap-1 transition-colors"
                    title="Copy last execution output into mock payload"
                  >
                    <Copy size={12} />
                    <span>Use Last Output</span>
                  </button>
                )}
                {settings.mockValue && (
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSettings({
                        ...settings,
                        mockValue: '',
                      });
                    }}
                    className="min-h-[34px] text-xs font-mono font-bold text-[#ffb4ab] hover:bg-[#ffb4ab]/15 px-2.5 py-1 rounded-lg bg-[#131317] border border-[#ffb4ab]/30 flex items-center gap-1 transition-colors"
                    title="Clear mock payload"
                  >
                    <X size={12} />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            <textarea
              rows={4}
              value={settings.mockValue || ''}
              onChange={(e) => handleChange('mockValue', e.target.value)}
              placeholder="Paste or edit the mock text to feed downstream steps..."
              className={`wf-field-box w-full rounded-xl p-3 text-cyan-200 placeholder-indigo-300/45 ${controlTextClass} focus:outline-none font-mono resize-y`}
            />
            <p className="text-xs font-mono text-cyan-300/80">
              Downstream nodes will use this mocked payload without executing real API calls.
            </p>
          </div>
        )}
      </div>

      {/* Error Resilience: Retries & Fallback Card (non-input nodes) */}
      {node.type !== 'input' && (
        <div className="p-4 rounded-xl bg-[#0b0d14] border border-amber-400/25 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded-lg bg-amber-500/15 border border-amber-400/35 text-amber-300 shrink-0">
                <ShieldAlert size={14} />
              </span>
              <div>
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-amber-200 block">
                  Error Resilience
                </span>
                <span className="text-xs text-zinc-400 block">
                  Auto-retry flaky APIs or continue with fallback text
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-mono text-zinc-400">Retries:</label>
              <select
                value={retryCount}
                onChange={(e) => handleChange('retries', e.target.value)}
                className="wf-field-box min-h-[38px] rounded-lg px-2.5 py-1 text-amber-200 text-sm font-mono focus:outline-none"
              >
                <option value="0" className="bg-[#0b0d14]">0 (None)</option>
                <option value="1" className="bg-[#0b0d14]">1 extra</option>
                <option value="2" className="bg-[#0b0d14]">2 extra</option>
                <option value="3" className="bg-[#0b0d14]">3 extra</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/[0.06]">
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">
                Continue workflow on error
              </span>
              <span className="text-xs text-zinc-400 block">
                Keep downstream steps running using fallback value if this step fails
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={continueOnError}
              onClick={() =>
                handleChange('continueOnError', continueOnError ? 'false' : 'true')
              }
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none ${
                continueOnError
                  ? 'bg-emerald-400 border-emerald-300'
                  : 'bg-[#2a292e] border-[#3b494b]'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 mt-0.5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                  continueOnError
                    ? 'translate-x-5 bg-[#131317]'
                    : 'translate-x-0.5 bg-[#b9cacb]'
                }`}
              />
            </button>
          </div>

          {continueOnError && (
            <div>
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-zinc-300 block mb-1.5">
                Fallback Output Value
              </label>
              <input
                type="text"
                value={settings.fallbackValue || ''}
                onChange={(e) => handleChange('fallbackValue', e.target.value)}
                placeholder="e.g. Data unavailable — proceeding with remaining context."
                className={`wf-field-box w-full min-h-[42px] rounded-xl px-3.5 py-2 text-amber-100 placeholder-zinc-500 ${controlTextClass} font-mono focus:outline-none`}
              />
            </div>
          )}
        </div>
      )}

      {/* Disable this step toggle */}
      <div className="flex items-center justify-between gap-3 py-3 px-3.5 rounded-xl bg-[#0e0e12] border border-[#2a292e]">
        <div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider wf-label-gradient block">
            Disable this step
          </span>
          <span className="text-xs text-indigo-200/80 block">
            Skip execution and pass through parent output
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.disabled === 'true'}
          onClick={() =>
            handleChange('disabled', settings.disabled === 'true' ? 'false' : 'true')
          }
          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none ${
            settings.disabled === 'true'
              ? 'bg-amber-400 border-amber-300'
              : 'bg-[#2a292e] border-[#3b494b]'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-4 w-4 mt-0.5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
              settings.disabled === 'true'
                ? 'translate-x-5 bg-[#131317]'
                : 'translate-x-0.5 bg-[#b9cacb]'
            }`}
          />
        </button>
      </div>

      {/* Node Type Specific Inputs */}
      {node.type === 'input' && (
        <div>
          <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
            Input Text Payload
          </label>
          <textarea
            rows={3}
            value={settings.text || ''}
            onChange={(e) => handleChange('text', e.target.value)}
            placeholder="Type your initial input text or prompt..."
            className={`wf-field-box w-full rounded-xl p-3.5 text-cyan-100 placeholder-indigo-300/45 ${controlTextClass} leading-relaxed focus:outline-none font-mono resize-y`}
          />
        </div>
      )}

      {node.type === 'webSearch' && (
        <VariableField
          label="Search Query"
          value={settings.query || ''}
          onChange={(val) => handleChange('query', val)}
          placeholder="e.g. {{Input.output}} latest discoveries"
          currentNodeId={node.id}
          earlierSteps={earlierSteps}
          allNodes={allNodes}
          stepOutputs={stepOutputs}
          workflowVariables={workflowVariables}
          textComfortMode={textComfortMode}
        />
      )}

      {node.type === 'webFetch' && (
        <VariableField
          label="Webpage Target URL"
          value={settings.url || ''}
          onChange={(val) => handleChange('url', val)}
          placeholder="https://en.wikipedia.org/wiki/James_Webb_Space_Telescope"
          currentNodeId={node.id}
          earlierSteps={earlierSteps}
          allNodes={allNodes}
          stepOutputs={stepOutputs}
          workflowVariables={workflowVariables}
          textComfortMode={textComfortMode}
        />
      )}

      {node.type === 'scholar' && (
        <VariableField
          label="Academic Topic Query"
          value={settings.query || ''}
          onChange={(val) => handleChange('query', val)}
          placeholder="e.g. {{Input.output}}"
          currentNodeId={node.id}
          earlierSteps={earlierSteps}
          allNodes={allNodes}
          stepOutputs={stepOutputs}
          workflowVariables={workflowVariables}
          textComfortMode={textComfortMode}
        />
      )}

      {node.type === 'ai' && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
                AI Provider
              </label>
              <select
                value={settings.providerId || ''}
                onChange={(e) => {
                  const nextProviderId = e.target.value;
                  handleChange('providerId', nextProviderId);
                  if (!nextProviderId || nextProviderId === 'existing') {
                    handleChange('modelId', '');
                  } else {
                    const targetProvider = configuredProviders.find((p) => p.id === nextProviderId);
                    const firstModel = targetProvider
                      ? getProviderModels(targetProvider)[0]?.id || targetProvider.model || ''
                      : '';
                    handleChange('modelId', firstModel);
                  }
                }}
                className={`wf-field-box w-full min-h-[44px] rounded-xl px-3.5 py-2 text-violet-200 ${controlTextClass} font-mono focus:outline-none`}
              >
                <option value="" className="bg-[#0b0d14]">Use my active AI</option>
                <option value="existing" className="bg-[#0b0d14]">Default Built-in AI</option>
                {configuredProviders.map((provider) => (
                  <option key={provider.id} value={provider.id} className="bg-[#0b0d14]">
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            {Boolean(settings.providerId) && settings.providerId !== 'existing' && (
              <div>
                <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
                  Model
                </label>
                <select
                  value={settings.modelId || (selectedProviderModels[0]?.id || '')}
                  onChange={(e) => handleChange('modelId', e.target.value)}
                  className={`wf-field-box w-full min-h-[44px] rounded-xl px-3.5 py-2 text-cyan-200 ${controlTextClass} font-mono focus:outline-none`}
                >
                  {selectedProviderModels.length > 0 ? (
                    selectedProviderModels.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#0b0d14]">
                        {m.name || m.id}
                      </option>
                    ))
                  ) : (
                    <option value={settings.modelId || ''} className="bg-[#0b0d14]">
                      {settings.modelId || 'Default Model'}
                    </option>
                  )}
                </select>
              </div>
            )}

            <div>
              <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
                AI Persona Role
              </label>
              <select
                value={settings.role || 'general'}
                onChange={(e) => handleChange('role', e.target.value)}
                className={`wf-field-box w-full min-h-[44px] rounded-xl px-3.5 py-2 text-fuchsia-200 ${controlTextClass} font-mono focus:outline-none`}
              >
                <option value="general" className="bg-[#0b0d14]">General Assistant (Comprehensive)</option>
                <option value="coder" className="bg-[#0b0d14]">Coder (Clean code & explanations)</option>
                <option value="architect" className="bg-[#0b0d14]">Architect (System structure & trade-offs)</option>
                <option value="dataAnalyst" className="bg-[#0b0d14]">Data Analyst (Steps & quantitative analysis)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
                Skill (optional)
              </label>
              {(() => {
                const rawSkillId = (settings.skillId || '').trim();
                const matchedSkill = rawSkillId
                  ? savedSkills.find((s) => s.id === rawSkillId) || null
                  : null;
                const isSkillMissing = Boolean(rawSkillId && !matchedSkill);
                const formatSkillSize = (chars: number) =>
                  chars >= 1000 ? `${(chars / 1000).toFixed(1)}k chars` : `${chars} chars`;

                return (
                  <>
                    <select
                      value={rawSkillId}
                      onChange={(e) => handleChange('skillId', e.target.value)}
                      className={`wf-field-box w-full min-h-[44px] rounded-xl px-3.5 py-2 text-emerald-200 ${controlTextClass} font-mono focus:outline-none`}
                    >
                      <option value="" className="bg-[#0b0d14]">None</option>
                      {savedSkills.map((skill) => (
                        <option key={skill.id} value={skill.id} className="bg-[#0b0d14]">
                          {skill.name} ({formatSkillSize(skill.text.length)})
                        </option>
                      ))}
                      {isSkillMissing && (
                        <option value={rawSkillId} className="bg-[#0b0d14]">
                          Skill not found (will run without a skill)
                        </option>
                      )}
                    </select>
                    {isSkillMissing ? (
                      <p className="text-xs font-mono text-amber-300 mt-1">
                        Skill not found (will run without a skill)
                      </p>
                    ) : matchedSkill ? (
                      <p className="text-xs font-mono text-emerald-300/90 mt-1">
                        ~{Math.max(0.1, Number((estimateTokens(matchedSkill.text.length) / 1000).toFixed(1)))}k tokens added to this step
                      </p>
                    ) : savedSkills.length === 0 ? (
                      <p className="text-xs font-mono text-indigo-300/80 mt-1">
                        No skills yet. Add one in Settings → Skills.
                      </p>
                    ) : null}
                  </>
                );
              })()}
            </div>

            <div>
              <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
                Max answer length (tokens)
              </label>
              <input
                type="number"
                min={200}
                max={4000}
                step={100}
                value={settings.maxTokens ?? '1500'}
                onChange={(e) => handleChange('maxTokens', e.target.value)}
                placeholder="1500"
                className={`wf-field-box w-full min-h-[44px] rounded-xl px-3.5 py-2 text-amber-200 ${controlTextClass} focus:outline-none font-mono tabular-nums`}
              />
              <p className="text-xs font-mono text-indigo-300/80 mt-1">
                Longer answers need a higher number.
              </p>
            </div>
          </div>

          <VariableField
            label="Prompt Instructions"
            value={settings.prompt || ''}
            onChange={(val) => handleChange('prompt', val)}
            placeholder="e.g. Summarize in simple English with bullet points: {{Web Search.output}}"
            multiline
            rows={4}
            currentNodeId={node.id}
            earlierSteps={earlierSteps}
            allNodes={allNodes}
            stepOutputs={stepOutputs}
            workflowVariables={workflowVariables}
            textComfortMode={textComfortMode}
          />
        </div>
      )}

      {node.type === 'image' && (
        <VariableField
          label="Image Prompt"
          value={settings.prompt || ''}
          onChange={(val) => handleChange('prompt', val)}
          placeholder="e.g. {{AI.output}}"
          multiline
          rows={3}
          currentNodeId={node.id}
          earlierSteps={earlierSteps}
          allNodes={allNodes}
          stepOutputs={stepOutputs}
          workflowVariables={workflowVariables}
          textComfortMode={textComfortMode}
        />
      )}

      {node.type === 'weather' && (
        <VariableField
          label="City Name"
          value={settings.city || ''}
          onChange={(val) => handleChange('city', val)}
          placeholder="e.g. London, Tokyo, San Francisco"
          currentNodeId={node.id}
          earlierSteps={earlierSteps}
          allNodes={allNodes}
          stepOutputs={stepOutputs}
          workflowVariables={workflowVariables}
          textComfortMode={textComfortMode}
        />
      )}

      {node.type === 'nasa' && (
        <div className="py-3 px-3.5 rounded-xl bg-[#49effd]/10 border border-[#49effd]/35 text-[#e4e1e7] font-mono text-xs sm:text-sm flex items-center gap-2.5">
          <Rocket size={16} className="text-[#49effd] flex-shrink-0" />
          <span>
            Fetches the latest Astronomy Picture of the Day (APOD) directly from NASA telemetry. No fields required.
          </span>
        </div>
      )}

      {node.type === 'document' && (
        <div className="space-y-3">
          <VariableField
            label="Document URL"
            value={settings.url || ''}
            onChange={(val) => handleChange('url', val)}
            placeholder="https://example.com/report.pdf"
            currentNodeId={node.id}
            earlierSteps={earlierSteps}
            allNodes={allNodes}
            stepOutputs={stepOutputs}
            workflowVariables={workflowVariables}
            textComfortMode={textComfortMode}
          />
          <div className="py-3 px-3.5 rounded-xl bg-orange-500/10 border border-orange-400/35 text-[#e4e1e7] font-mono text-xs sm:text-sm flex items-center gap-2.5">
            <FileText size={16} className="text-orange-300 flex-shrink-0" />
            <span>Extracts text from PDF, DOCX, TXT, MD, CSV, JSON, or HTML. 8 MB / 24k character limit.</span>
          </div>
        </div>
      )}

      {node.type === 'email' && (
        <div className="space-y-3">
          <VariableField
            label="Recipients"
            value={settings.to || ''}
            onChange={(val) => handleChange('to', val)}
            placeholder="person@example.com, team@example.com"
            currentNodeId={node.id}
            earlierSteps={earlierSteps}
            allNodes={allNodes}
            stepOutputs={stepOutputs}
            workflowVariables={workflowVariables}
            textComfortMode={textComfortMode}
          />
          <VariableField
            label="Subject"
            value={settings.subject || ''}
            onChange={(val) => handleChange('subject', val)}
            placeholder="NEXUS Automation result"
            currentNodeId={node.id}
            earlierSteps={earlierSteps}
            allNodes={allNodes}
            stepOutputs={stepOutputs}
            workflowVariables={workflowVariables}
            textComfortMode={textComfortMode}
          />
          <VariableField
            label="Email Body"
            value={settings.body || ''}
            onChange={(val) => handleChange('body', val)}
            placeholder="e.g. {{AI.output}}"
            multiline
            rows={5}
            currentNodeId={node.id}
            earlierSteps={earlierSteps}
            allNodes={allNodes}
            stepOutputs={stepOutputs}
            workflowVariables={workflowVariables}
            textComfortMode={textComfortMode}
          />
          <div className="py-3 px-3.5 rounded-xl bg-cyan-500/10 border border-cyan-400/35 text-[#e4e1e7] font-mono text-xs sm:text-sm flex items-center gap-2.5">
            <Mail size={16} className="text-cyan-300 flex-shrink-0" />
            <span>Sent server-side through Resend. Requires RESEND_API_KEY and EMAIL_FROM on the server.</span>
          </div>
        </div>
      )}

      {node.type === 'webhook' && (
        <div className="space-y-3">
          <VariableField
            label="Webhook URL (HTTPS)"
            value={settings.url || ''}
            onChange={(val) => handleChange('url', val)}
            placeholder="https://hooks.example.com/incoming/..."
            currentNodeId={node.id}
            earlierSteps={earlierSteps}
            allNodes={allNodes}
            stepOutputs={stepOutputs}
            workflowVariables={workflowVariables}
            textComfortMode={textComfortMode}
          />
          <VariableField
            label="Payload"
            value={settings.body || ''}
            onChange={(val) => handleChange('body', val)}
            placeholder='e.g. {"result": "{{AI.output}}"}'
            multiline
            rows={5}
            currentNodeId={node.id}
            earlierSteps={earlierSteps}
            allNodes={allNodes}
            stepOutputs={stepOutputs}
            workflowVariables={workflowVariables}
            textComfortMode={textComfortMode}
          />
          <div className="py-3 px-3.5 rounded-xl bg-lime-500/10 border border-lime-400/35 text-[#e4e1e7] font-mono text-xs sm:text-sm flex items-center gap-2.5">
            <Webhook size={16} className="text-lime-300 flex-shrink-0" />
            <span>POSTs to a public HTTPS endpoint. Private and local addresses are blocked.</span>
          </div>
        </div>
      )}

      {node.type === 'transform' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
              Transform Mode (Instant & Zero-Cost)
            </label>
            <select
              value={settings.mode || 'template'}
              onChange={(e) => handleChange('mode', e.target.value)}
              className={`wf-field-box w-full min-h-[44px] rounded-xl px-3.5 py-2 text-fuchsia-200 ${controlTextClass} font-mono focus:outline-none`}
            >
              <option value="template" className="bg-[#0b0d14]">Template Formatter (Interpolate variables)</option>
              <option value="jsonPath" className="bg-[#0b0d14]">Extract JSON Path (e.g. data.items.0.title)</option>
              <option value="regexExtract" className="bg-[#0b0d14]">Regex Extract Matches</option>
              <option value="regexReplace" className="bg-[#0b0d14]">Regex Find & Replace</option>
              <option value="bullets" className="bg-[#0b0d14]">Clean Bullet List</option>
              <option value="trim" className="bg-[#0b0d14]">Clean Whitespace & Blank Lines</option>
              <option value="truncate" className="bg-[#0b0d14]">Truncate to Max Words</option>
              <option value="uppercase" className="bg-[#0b0d14]">UPPERCASE</option>
              <option value="lowercase" className="bg-[#0b0d14]">lowercase</option>
              <option value="stats" className="bg-[#0b0d14]">Text Statistics (Words / Lines / Reading Time)</option>
            </select>
          </div>

          <VariableField
            label="Source Input (leave blank to auto-use upstream)"
            value={settings.input || ''}
            onChange={(val) => handleChange('input', val)}
            placeholder="e.g. {{AI.output}} or custom template with {{vars.topic}}"
            multiline
            rows={4}
            currentNodeId={node.id}
            earlierSteps={earlierSteps}
            allNodes={allNodes}
            stepOutputs={stepOutputs}
            workflowVariables={workflowVariables}
            textComfortMode={textComfortMode}
          />

          {(settings.mode === 'jsonPath' ||
            settings.mode === 'regexExtract' ||
            settings.mode === 'regexReplace') && (
            <div>
              <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
                {settings.mode === 'jsonPath' ? 'JSON Dot Path' : 'Regex Pattern'}
              </label>
              <input
                type="text"
                value={settings.pattern || ''}
                onChange={(e) => handleChange('pattern', e.target.value)}
                placeholder={
                  settings.mode === 'jsonPath'
                    ? 'e.g. results.0.summary'
                    : 'e.g. https?://\\S+'
                }
                className={`wf-field-box w-full min-h-[44px] rounded-xl px-3.5 py-2 text-cyan-100 placeholder-zinc-500 ${controlTextClass} font-mono focus:outline-none`}
              />
            </div>
          )}

          {settings.mode === 'regexReplace' && (
            <div>
              <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
                Replacement Text
              </label>
              <input
                type="text"
                value={settings.replacement || ''}
                onChange={(e) => handleChange('replacement', e.target.value)}
                placeholder="Replacement string (supports $1 capture groups)"
                className={`wf-field-box w-full min-h-[44px] rounded-xl px-3.5 py-2 text-cyan-100 placeholder-zinc-500 ${controlTextClass} font-mono focus:outline-none`}
              />
            </div>
          )}

          {settings.mode === 'truncate' && (
            <div>
              <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
                Max Word Count
              </label>
              <input
                type="number"
                min={5}
                max={5000}
                value={settings.maxWords || '120'}
                onChange={(e) => handleChange('maxWords', e.target.value)}
                className={`wf-field-box w-full min-h-[44px] rounded-xl px-3.5 py-2 text-amber-200 ${controlTextClass} font-mono focus:outline-none`}
              />
            </div>
          )}

          <div className="py-3 px-3.5 rounded-xl bg-fuchsia-500/10 border border-fuchsia-400/30 text-[#e4e1e7] font-mono text-xs sm:text-sm flex items-center gap-2.5">
            <Wand2 size={16} className="text-fuchsia-300 flex-shrink-0" />
            <span>Runs locally in milliseconds with zero API cost. Great for cleaning or extracting structured data.</span>
          </div>
        </div>
      )}

      {node.type === 'merge' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
              Merge Strategy
            </label>
            <select
              value={settings.mode || 'sections'}
              onChange={(e) => handleChange('mode', e.target.value)}
              className={`wf-field-box w-full min-h-[44px] rounded-xl px-3.5 py-2 text-teal-200 ${controlTextClass} font-mono focus:outline-none`}
            >
              <option value="sections" className="bg-[#0b0d14]">Markdown Sections (### Step Label)</option>
              <option value="join" className="bg-[#0b0d14]">Join Raw Outputs</option>
              <option value="numbered" className="bg-[#0b0d14]">Numbered List</option>
              <option value="json" className="bg-[#0b0d14]">Combined JSON Object</option>
              <option value="template" className="bg-[#0b0d14]">Custom Merge Template</option>
            </select>
          </div>

          {settings.mode !== 'json' && settings.mode !== 'template' && (
            <div>
              <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
                Separator (supports \n)
              </label>
              <input
                type="text"
                value={settings.separator ?? '\\n\\n---\\n\\n'}
                onChange={(e) => handleChange('separator', e.target.value)}
                placeholder="\\n\\n---\\n\\n"
                className={`wf-field-box w-full min-h-[44px] rounded-xl px-3.5 py-2 text-teal-100 placeholder-zinc-500 ${controlTextClass} font-mono focus:outline-none`}
              />
            </div>
          )}

          {settings.mode === 'template' && (
            <VariableField
              label="Custom Merge Template"
              value={settings.template || ''}
              onChange={(val) => handleChange('template', val)}
              placeholder="e.g. Web: {{Web Search.output}}\n\nAcademic: {{Scholar.output}}"
              multiline
              rows={4}
              currentNodeId={node.id}
              earlierSteps={earlierSteps}
              allNodes={allNodes}
              stepOutputs={stepOutputs}
              workflowVariables={workflowVariables}
              textComfortMode={textComfortMode}
            />
          )}

          <div className="py-3 px-3.5 rounded-xl bg-teal-500/10 border border-teal-400/30 text-[#e4e1e7] font-mono text-xs sm:text-sm flex items-center gap-2.5">
            <GitMerge size={16} className="text-teal-300 flex-shrink-0" />
            <span>Automatically combines outputs from all incoming connected branches into a single unified payload.</span>
          </div>
        </div>
      )}

      {node.type === 'if' && (
        <div className="space-y-3">
          <VariableField
            label="Test Value (Value 1)"
            value={settings.value1 || ''}
            onChange={(val) => handleChange('value1', val)}
            placeholder="e.g. {{AI.output}}"
            currentNodeId={node.id}
            earlierSteps={earlierSteps}
            allNodes={allNodes}
            stepOutputs={stepOutputs}
            workflowVariables={workflowVariables}
            textComfortMode={textComfortMode}
          />

          <div>
            <label className="text-xs font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
              Operator Rule
            </label>
            <select
              value={settings.operator || 'contains'}
              onChange={(e) => handleChange('operator', e.target.value)}
              className={`wf-field-box w-full min-h-[44px] rounded-xl px-3.5 py-2 text-emerald-200 ${controlTextClass} font-mono focus:outline-none`}
            >
              <option value="contains" className="bg-[#0e0e12]">Contains</option>
              <option value="notContains" className="bg-[#0e0e12]">Does not contain</option>
              <option value="equals" className="bg-[#0e0e12]">Equals</option>
              <option value="isEmpty" className="bg-[#0e0e12]">Is empty</option>
              <option value="isNotEmpty" className="bg-[#0e0e12]">Is not empty</option>
              <option value="lengthGreaterThan" className="bg-[#0e0e12]">Length greater than</option>
              <option value="lengthLessThan" className="bg-[#0e0e12]">Length less than</option>
            </select>
          </div>

          {settings.operator !== 'isEmpty' && settings.operator !== 'isNotEmpty' && (
            <VariableField
              label="Comparison Target (Value 2)"
              value={settings.value2 || ''}
              onChange={(val) => handleChange('value2', val)}
              placeholder="Target value or number..."
              currentNodeId={node.id}
              earlierSteps={earlierSteps}
              allNodes={allNodes}
              stepOutputs={stepOutputs}
              workflowVariables={workflowVariables}
              textComfortMode={textComfortMode}
            />
          )}
        </div>
      )}
    </div>
  );
}


