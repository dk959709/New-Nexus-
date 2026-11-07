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
} from '@/lib/workflowEngine';
import {
  WorkflowCanvas,
  NODE_CONFIG,
} from '@/components/workflows/WorkflowCanvas';
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
    if (list && list.length > 0) return list[0].id;
    return 'workflow-default';
  });

  // Current active workflow object
  const activeWorkflow = useMemo(() => {
    return workflows.find((w) => w.id === activeWorkflowId) || workflows[0] || null;
  }, [workflows, activeWorkflowId]);

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'canvas'>('list');

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
  const [collapsedSettings, setCollapsedSettings] = useState<Record<string, boolean>>({});
  const [collapsedOutputs, setCollapsedOutputs] = useState<Record<string, boolean>>({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isRenaming, setIsRenaming] = useState<boolean>(false);
  const [renameDraft, setRenameDraft] = useState<string>('');
  const [confirmDeleteWorkflow, setConfirmDeleteWorkflow] = useState<boolean>(false);
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const inspectorOutputRef = useRef<HTMLDivElement | null>(null);

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

  // Update current workflow helper
  const updateCurrentWorkflow = useCallback(
    (updater: (prev: Workflow) => Workflow) => {
      if (!activeWorkflow) return;
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

  // Core execution runner (supports full run or starting from a specific node)
  const executeWorkflowRun = async (startFromNodeId?: string) => {
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

            if (status === 'running') {
              const now = Date.now();
              stepStartTimesRef.current[nodeId] = now;
              setStepStartTimes((prev) => ({ ...prev, [nodeId]: now }));
            }

            if (output) {
              setStepOutputs((prev) => ({ ...prev, [nodeId]: output }));
              setStepOutputSummaries((prev) => ({
                ...prev,
                [nodeId]: getOutputSummary(output),
              }));
              if (status === 'done') {
                setLastExecutedNodeId(nodeId);
              }
            }

            if (errorText) {
              setStepErrors((prev) => ({ ...prev, [nodeId]: errorText }));
            }

            if (status === 'done' || status === 'error') {
              const startT = stepStartTimesRef.current[nodeId] || Date.now();
              const duration = Math.max(0, Date.now() - startT);
              setStepDurations((prev) => ({ ...prev, [nodeId]: duration }));
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
          ? { startFromNodeId, previousOutputs: stepOutputs }
          : undefined,
      );
    } catch (err: unknown) {
      console.error('Workflow execution error:', err);
      showToast(`Workflow error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRunning(false);
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
      settings: type === 'if' ? { operator: 'contains' } : {},
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
        const result = await executeSingleNodeStep(target, activeWorkflow.nodes, stepOutputs);
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
    [activeWorkflow, isRunning, stepOutputs, showToast],
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

      {/* ================= ROW 1: TOP STUDIO HEADER BAR ================= */}
      <div className="relative px-3 sm:px-4 py-2.5 border-b border-cyan-500/25 bg-[#050911]/95 backdrop-blur-xl flex items-center justify-between gap-2 z-10">
        <div className="mc-laser-line opacity-85" />

        <div className="flex items-center gap-2 min-w-0">
          {/* Animated SVG Pipeline Studio Badge */}
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 flex items-center justify-center shrink-0 overflow-hidden">
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
            <div className="flex items-center gap-2">
              <h1 className="text-xs sm:text-sm font-bold tracking-tight wf-gradient-title truncate">
                Workflows Orchestrator
              </h1>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-zinc-400 font-mono">
              <span>{workflows.length} Pipelines</span>
              <span>·</span>
              <span className="text-cyan-400">
                v{activeWorkflow.nodes.length}/{ Math.max(1, activeWorkflow.nodes.length) }
              </span>
              <span className="hidden sm:inline">·</span>
              <span className="hidden sm:inline">
                {activeWorkflow.nodes.length} {activeWorkflow.nodes.length === 1 ? 'step' : 'steps'}
              </span>
              {isRunning && (
                <>
                  <span>·</span>
                  <span className="text-[#49effd] font-bold inline-flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#49effd] animate-ping" />
                    Running
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right Studio Controls (Matching Live AI Canvas Studio Header Buttons) */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 flex-wrap justify-end">
          <button
            type="button"
            onClick={() => setShowTemplatesModal(true)}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 hover:border-fuchsia-400/50 text-fuchsia-300 transition-colors flex items-center gap-1"
            title="Load pre-configured Pipeline Templates"
          >
            <Sparkles size={13} className="text-[#49effd]" />
            <span className="hidden md:inline font-mono text-[11px]">Templates</span>
          </button>

          <button
            type="button"
            onClick={handleClearResults}
            disabled={isRunning}
            className="p-1.5 sm:px-2.5 sm:py-1 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 hover:border-amber-400/50 text-amber-300 disabled:opacity-40 transition-colors flex items-center gap-1"
            title="Clear previous outputs & step statuses"
          >
            <RotateCcw size={13} className="text-amber-400" />
            <span className="hidden lg:inline font-mono text-[11px]">Reset</span>
          </button>

          {isRunning ? (
            <button
              type="button"
              onClick={handleStop}
              className="wf-run-btn-busy relative overflow-hidden px-2.5 sm:px-3.5 py-1 rounded-lg bg-[#ffb4ab]/15 hover:bg-[#ffb4ab]/25 border border-[#ffb4ab]/55 text-[#ffb4ab] font-mono text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Square size={11} className="fill-[#ffb4ab] text-[#ffb4ab]" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRun}
              className="wf-run-btn-idle relative overflow-hidden px-2.5 sm:px-3.5 py-1 rounded-lg bg-gradient-to-r from-[#49effd] via-[#22d3ee] to-[#818cf8] hover:brightness-110 text-[#041318] font-mono text-[11px] font-extrabold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-[0_0_20px_rgba(73,239,253,0.38)] active:scale-[0.98] whitespace-nowrap shrink-0"
            >
              <Play size={12} className="fill-[#041318]" />
              <span>Run</span>
            </button>
          )}
        </div>
      </div>

      {/* ================= ROW 2: WORKFLOW SELECTOR & QUICK ACTIONS SUB-TOOLBAR ================= */}
      <div className="px-3 sm:px-4 py-2 border-b border-cyan-500/20 bg-slate-900/60 flex items-center justify-between gap-2 flex-wrap shrink-0 z-20">
        <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
          <Layers size={13} className="text-cyan-400 shrink-0" />
          <select
            value={activeWorkflow.id}
            onChange={(e) => {
              setActiveWorkflowId(e.target.value);
              setSelectedNodeId(null);
              handleClearResults();
            }}
            className="min-w-0 flex-1 max-w-[180px] sm:max-w-xs rounded-lg bg-zinc-950 border border-zinc-700/80 px-2.5 py-1 text-xs text-zinc-100 font-mono outline-none focus:border-cyan-500 cursor-pointer truncate"
          >
            {workflows.map((w, idx) => (
              <option key={w.id} value={w.id} className="bg-[#0b0d14] text-cyan-200">
                {idx + 1}. [DAG] {w.name} ({w.nodes.length})
              </option>
            ))}
          </select>

          {/* Delete Workflow (with inline confirmation) */}
          {confirmDeleteWorkflow ? (
            <div className="flex items-center gap-1 bg-[#ffb4ab]/15 border border-[#ffb4ab]/45 rounded-lg px-2 py-0.5">
              <span className="text-[10px] font-mono text-[#ffb4ab] font-bold uppercase">Del?</span>
              <button
                type="button"
                onClick={handleDeleteCurrent}
                className="px-1.5 py-0.5 rounded bg-[#ffb4ab] text-[#131317] font-mono font-bold text-[10px] uppercase"
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteWorkflow(false)}
                className="p-0.5 rounded text-[#94a3b8] hover:text-white"
              >
                <X size={11} />
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
              className="p-1.5 rounded-lg bg-zinc-900 hover:bg-rose-950/70 border border-zinc-700/80 hover:border-rose-500/40 text-zinc-400 hover:text-rose-300 transition-colors shrink-0"
              title="Delete current workflow"
            >
              <Trash2 size={12} />
            </button>
          )}

          {/* + New Workflow (like + Vault in Live AI Canvas Studio) */}
          <button
            type="button"
            onClick={handleCreateNew}
            className="px-2 py-1 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-200 flex items-center gap-1 transition-colors shrink-0"
            title="Create new blank workflow"
          >
            <Plus size={12} className="text-cyan-400" />
            <span>New ({workflows.length})</span>
          </button>

          {/* Rename Workflow */}
          {isRenaming ? (
            <div className="flex items-center gap-1 bg-[#0b0d14] border border-[#49effd]/60 rounded-lg px-2 py-0.5">
              <input
                type="text"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                className="bg-transparent text-cyan-200 font-mono text-xs px-1 py-0.5 focus:outline-none w-28 sm:w-36"
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
                className="p-1 rounded bg-[#49effd] text-[#00363b]"
              >
                <Check size={11} />
              </button>
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="p-1 rounded text-[#94a3b8] hover:text-white"
              >
                <X size={11} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRenameDraft(activeWorkflow.name);
                setIsRenaming(true);
              }}
              className="px-2 py-1 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-violet-300 flex items-center gap-1 transition-colors shrink-0"
              title="Rename workflow"
            >
              <Edit2 size={11} className="text-violet-400" />
              <span className="hidden sm:inline">Rename</span>
            </button>
          )}

          {/* Duplicate Workflow */}
          <button
            type="button"
            onClick={handleDuplicate}
            className="px-2 py-1 rounded-lg text-xs font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-emerald-300 flex items-center gap-1 transition-colors shrink-0"
            title="Duplicate workflow"
          >
            <Copy size={11} className="text-emerald-400" />
            <span className="hidden sm:inline">Clone</span>
          </button>
        </div>

        {/* Right: Step Count & Quick Add Step Pill */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setShowAddMenu((v) => !v)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/50 text-purple-200 flex items-center gap-1 transition-colors shrink-0"
            title="Add a new step to this pipeline"
          >
            <Plus size={12} className="text-purple-300" />
            <span>Step</span>
          </button>
          <span className="px-2 py-0.5 rounded-md text-[11px] font-mono bg-cyan-500/15 text-cyan-200 border border-cyan-400/40 font-semibold">
            {activeWorkflow.nodes.length}N
          </span>
        </div>
      </div>

      {/* ================= ROW 3: SEGMENTED STUDIO TABS BAR (LIKE PREVIEW | SPLIT | CODE | DATA) ================= */}
      <div className="px-3 sm:px-4 py-1.5 border-b border-zinc-800/80 bg-[#070a10]/90 flex items-center justify-between gap-2 overflow-x-auto no-scrollbar shrink-0 z-20">
        <div className="flex items-center gap-1 bg-zinc-900/90 p-1 rounded-xl border border-zinc-800">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap ${
              viewMode === 'list'
                ? 'bg-zinc-800 text-white shadow-sm border border-cyan-500/35'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers size={12} className={viewMode === 'list' ? 'text-cyan-400' : ''} />
            <span>Pipeline</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('canvas')}
            className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all whitespace-nowrap ${
              viewMode === 'canvas'
                ? 'bg-zinc-800 text-white shadow-sm border border-cyan-500/35'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <GitBranch size={12} className={viewMode === 'canvas' ? 'text-cyan-400' : ''} />
            <span>Canvas</span>
          </button>

          <button
            type="button"
            onClick={() => {
              finalOutputSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="px-3 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            <Sparkles size={12} className="text-emerald-400" />
            <span>Output</span>
            {lastExecutedOutput && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              traceSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className="px-3 py-1 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 flex items-center gap-1.5 transition-all whitespace-nowrap"
          >
            <CheckCircle2 size={12} className="text-amber-400" />
            <span>Trace</span>
            <span className="text-[10px] font-mono text-emerald-400">{runLogs.length}</span>
          </button>
        </div>

        {/* Right Contextual Studio Action */}
        <div className="flex items-center gap-1.5 shrink-0">
          {viewMode === 'canvas' ? (
            <button
              type="button"
              onClick={handleTidyLayout}
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-cyan-300 font-mono text-[11px] flex items-center gap-1 whitespace-nowrap"
            >
              <Sparkles size={11} />
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
              className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-300 hover:text-white font-mono text-[11px] flex items-center gap-1 whitespace-nowrap"
            >
              <ChevronDown size={12} />
              <span>
                {activeWorkflow.nodes.every((n) => collapsedSettings[n.id])
                  ? 'Expand Steps'
                  : 'Compact Steps'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ================= MAIN STUDIO WORKSPACE ================= */}
      <div className="wf-studio-shell relative px-3 sm:px-6 pt-3 pb-12 border-0 rounded-none">
        {/* Static Background Grid + Dual Radial Plasma Glows (pointer-events: none) */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 wf-cyber-matrix-grid opacity-65 z-0"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none fixed -top-28 left-1/3 -translate-x-1/2 w-[560px] h-[260px] rounded-full bg-[#49effd]/[0.06] blur-[95px] z-0"
        />

        <div className="relative z-10 max-w-[1380px] mx-auto">
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
                      className={`wf-cyber-card wf-step-card-enter group/card rounded-2xl p-4 sm:p-5 transition-all duration-300 ${
                        isDisabled ? 'opacity-60' : ''
                      } ${
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
                          <span className="text-[11px] font-mono font-extrabold tabular-nums text-[#49effd] bg-[#0b0d14] border border-[#49effd]/30 shadow-[0_0_12px_rgba(73,239,253,0.12)] px-2.5 py-1 rounded-lg flex-shrink-0 select-none">
                            {String(index + 1).padStart(2, '0')}
                          </span>

                          {/* Node Type Icon */}
                          <div className={`p-2 rounded-xl border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] flex-shrink-0 ${cfg.color}`}>
                            <IconComp size={16} />
                          </div>

                          {/* Editable Step Title & Unboxed Metadata */}
                          <div className="min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-3 flex-1">
                            <input
                              type="text"
                              value={node.label}
                              onChange={(e) => handleUpdateNode(node.id, 'label', e.target.value)}
                              className={`bg-transparent hover:bg-white/[0.04] focus:bg-[#0b0d14] font-extrabold ${cfg.textColor} tracking-tight text-sm sm:text-base rounded-lg px-2 py-0.5 border border-transparent focus:border-[#49effd]/55 focus:shadow-[0_0_14px_rgba(73,239,253,0.18)] focus:outline-none w-full max-w-[220px] sm:max-w-[290px] truncate transition-all`}
                              title="Click to rename step"
                            />
                            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider pl-2 sm:pl-0 flex-wrap">
                              <span className="wf-label-gradient font-bold">
                                {cfg.label}
                              </span>
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
                        <div className="flex items-center justify-between sm:justify-end gap-2 pl-9 sm:pl-0 flex-wrap">
                          {/* Cyber Status Indicator */}
                          <div className="mr-1 flex items-center">
                            {isDisabled ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-400/35 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
                                <Ban size={12} />
                                <span>Disabled</span>
                              </span>
                            ) : isFrozen ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/15 border border-cyan-400/45 text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-200 shadow-[0_0_12px_rgba(73,239,253,0.2)]">
                                <Snowflake size={12} className="text-cyan-300" />
                                <span>{hasMock ? 'Mocked' : 'Frozen'}</span>
                              </span>
                            ) : status === 'running' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#49effd]/15 border border-[#49effd]/55 text-[10px] font-mono font-bold uppercase tracking-wider text-[#49effd] shadow-[0_0_16px_rgba(73,239,253,0.28)]">
                                <Loader2 size={12} className="animate-spin" />
                                <span>Running</span>
                              </span>
                            ) : status === 'done' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/45 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300 shadow-[0_0_14px_rgba(16,185,129,0.2)]">
                                <CheckCircle2 size={12} className="wf-check-pop" />
                                <span>Completed</span>
                              </span>
                            ) : status === 'error' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#ffb4ab]/15 border border-[#ffb4ab]/45 text-[10px] font-mono font-bold uppercase tracking-wider text-[#ffb4ab]">
                                <AlertCircle size={12} />
                                <span>Failed</span>
                              </span>
                            ) : status === 'skipped' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0b0d14] border border-white/10 text-[10px] font-mono font-bold uppercase tracking-wider text-[#94a3b8]">
                                <MinusCircle size={12} />
                                <span>Skipped</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0b0d14]/90 border border-white/10 text-[10px] font-mono font-semibold uppercase tracking-wider text-cyan-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#49effd]/75 shadow-[0_0_6px_#49effd]" />
                                <span>Ready</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Test Single Step */}
                            <button
                              type="button"
                              disabled={isRunning}
                              onClick={() => handleRunSingleNode(node.id)}
                              className="p-1.5 rounded-lg bg-[#0b0d14]/90 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-400/45 text-emerald-300 hover:text-emerald-200 disabled:opacity-30 transition-all active:scale-95"
                              title="Test this single step only"
                            >
                              <Play size={13} className="fill-emerald-400/30" />
                            </button>

                            {/* Run from this step */}
                            <button
                              type="button"
                              disabled={isRunning}
                              onClick={() => handleRunFromNode(node.id)}
                              className="p-1.5 rounded-lg bg-[#0b0d14]/90 hover:bg-[#49effd]/15 border border-white/10 hover:border-[#49effd]/45 text-cyan-300 hover:text-[#49effd] disabled:opacity-30 transition-all active:scale-95"
                              title="Run workflow starting from this step"
                            >
                              <Play size={13} />
                            </button>

                            {/* Freeze / Unfreeze Step */}
                            <button
                              type="button"
                              onClick={() => handleToggleFreezeNode(node.id)}
                              className={`p-1.5 rounded-lg border transition-all active:scale-95 ${
                                isFrozen
                                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200 shadow-[0_0_10px_rgba(73,239,253,0.25)]'
                                  : 'bg-[#0b0d14]/90 hover:bg-white/[0.06] border-white/10 hover:border-cyan-400/35 text-cyan-400 hover:text-[#f8fafc]'
                              }`}
                              title={isFrozen ? 'Unfreeze step (execute live)' : 'Freeze output (use cached / mock output)'}
                            >
                              <Snowflake size={13} />
                            </button>

                            {/* Move Up / Move Down */}
                            <button
                              type="button"
                              onClick={() => handleMoveNodeUp(index)}
                              disabled={hasBranches || index === 0}
                              className="p-1.5 rounded-lg bg-[#0b0d14]/90 hover:bg-white/[0.06] border border-white/10 hover:border-[#49effd]/35 text-sky-300 hover:text-[#f8fafc] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                              title={hasBranches ? 'Reordering disabled for branching workflows' : 'Move step up'}
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveNodeDown(index)}
                              disabled={hasBranches || index === activeWorkflow.nodes.length - 1}
                              className="p-1.5 rounded-lg bg-[#0b0d14]/90 hover:bg-white/[0.06] border border-white/10 hover:border-[#49effd]/35 text-sky-300 hover:text-[#f8fafc] disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                              title={hasBranches ? 'Reordering disabled for branching workflows' : 'Move step down'}
                            >
                              <ArrowDown size={13} />
                            </button>

                            {/* Duplicate Step */}
                            <button
                              type="button"
                              onClick={() => handleDuplicateNode(node.id)}
                              className="p-1.5 rounded-lg bg-[#0b0d14]/90 hover:bg-white/[0.06] border border-white/10 hover:border-[#49effd]/35 text-violet-300 hover:text-[#f8fafc] transition-all active:scale-95"
                              title="Duplicate step"
                            >
                              <Copy size={13} />
                            </button>

                            {/* Delete Step */}
                            <button
                              type="button"
                              onClick={() => handleDeleteNode(node.id)}
                              className="p-1.5 rounded-lg bg-[#0b0d14]/90 hover:bg-[#ffb4ab]/15 border border-white/10 hover:border-[#ffb4ab]/45 text-rose-300 hover:text-[#ffb4ab] transition-all active:scale-95"
                              title="Delete step"
                            >
                              <Trash2 size={13} />
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
                              className="p-1.5 rounded-lg bg-[#0b0d14]/90 hover:bg-white/[0.06] border border-white/10 hover:border-[#49effd]/35 text-amber-300 hover:text-[#f8fafc] transition-all active:scale-95"
                              title="Toggle step parameters"
                            >
                              {isSettingsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
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
                              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#49effd] shadow-[0_0_8px_#49effd]" />
                                <span className="font-bold wf-label-gradient">Step Telemetry Output</span>
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
                                    className="font-mono text-[10px] font-bold uppercase tracking-wider text-cyan-300 hover:text-[#49effd] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#141722] hover:bg-[#1c2030] border border-white/10 hover:border-[#49effd]/40 transition-all"
                                  >
                                    {copiedKey === `out-${node.id}` ? (
                                      <>
                                        <Check size={11} className="text-emerald-400" />
                                        <span className="text-emerald-300">Copied</span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy size={11} />
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
                                  className="p-1 text-cyan-300 hover:text-[#f8fafc] rounded-lg bg-[#141722] hover:bg-[#1c2030] border border-white/10"
                                >
                                  {isOutputOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>
                              </div>
                            </div>

                            {isOutputOpen && (
                              <div>
                                {errorText && (
                                  <div className="py-2.5 px-3 rounded-lg bg-[#ffb4ab]/10 border border-[#ffb4ab]/40 text-[#ffb4ab] text-xs font-mono">
                                    {errorText}
                                  </div>
                                )}
                                {output?.type === 'text' && (
                                  <pre className="text-xs text-cyan-200 font-mono whitespace-pre-wrap break-words max-h-60 overflow-y-auto pt-1 leading-relaxed">
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
                                        className="px-3.5 py-1.5 bg-gradient-to-r from-[#49effd] to-[#22d3ee] hover:brightness-110 text-[#00363b] font-mono text-[11px] font-extrabold uppercase tracking-wider rounded-lg inline-flex items-center gap-1.5 shadow-[0_0_16px_rgba(73,239,253,0.35)]"
                                      >
                                        <Download size={12} />
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
                className="relative overflow-hidden w-full py-3.5 px-4 rounded-2xl border border-dashed border-[#49effd]/50 hover:border-[#49effd] bg-gradient-to-r from-[#49effd]/[0.05] via-indigo-500/[0.06] to-[#49effd]/[0.05] hover:from-[#49effd]/[0.12] hover:to-indigo-500/[0.12] text-[#49effd] font-mono text-xs font-extrabold uppercase tracking-[0.16em] flex items-center justify-center gap-2 transition-all group shadow-[0_0_24px_rgba(73,239,253,0.08)] active:scale-[0.99]"
              >
                <div className="mc-laser-line opacity-0 group-hover:opacity-100 transition-opacity" />
                <Plus size={15} className="text-[#49effd] group-hover:rotate-90 transition-transform duration-200" />
                <span>Add Pipeline Step</span>
              </button>

              {/* Step Type Selection Popover */}
              {showAddMenu && (
                <div className="wf-popover-enter mt-2.5 z-30 bg-[#131317]/98 border border-[#49effd]/40 rounded-xl p-3 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_20px_rgba(73,239,253,0.12)] backdrop-blur-2xl grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {(Object.keys(NODE_CONFIG) as WorkflowNodeType[]).map((type) => {
                    const item = NODE_CONFIG[type];
                    const Icon = item.icon;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => handleAddStep(type)}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-[#1b1b1f]/80 hover:bg-[#2a292e] border border-[#2a292e] hover:border-[#49effd]/45 text-left transition-all active:scale-[0.98]"
                      >
                        <div className={`p-2 rounded-lg border border-[#3b494b]/40 ${item.color}`}>
                          <Icon size={16} />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-xs font-extrabold truncate ${item.textColor}`}>{item.label}</div>
                          <div className="text-[10px] font-mono text-indigo-200/80 truncate">{item.desc}</div>
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
                className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#49effd] to-[#00f0ff] hover:brightness-110 text-[#00363b] font-mono text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_24px_rgba(73,239,253,0.4)] transition-all active:scale-95 whitespace-nowrap shrink-0"
              >
                <Plus size={14} />
                <span>Add Node</span>
              </button>

              {showAddMenu && (
                <div className="wf-popover-enter absolute left-0 bottom-full mb-3 w-[min(20rem,calc(100vw-2.5rem))] bg-[#131317]/98 border border-[#49effd]/40 rounded-xl p-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_20px_rgba(73,239,253,0.14)] backdrop-blur-2xl grid grid-cols-1 gap-1.5 max-h-96 overflow-y-auto">
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider wf-label-gradient px-2.5 py-1 border-b border-[#2a292e]">
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
                        className="flex items-center gap-3 p-2 rounded-lg bg-[#1b1b1f]/80 hover:bg-[#2a292e] border border-[#2a292e] hover:border-[#49effd]/45 text-left transition-all active:scale-[0.98]"
                      >
                        <div className={`p-1.5 rounded-lg border border-[#3b494b]/40 ${item.color}`}>
                          <Icon size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className={`text-xs font-extrabold truncate ${item.textColor}`}>{item.label}</div>
                          <div className="text-[10px] font-mono text-indigo-200/80 truncate">{item.desc}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Phone Connect Mode Prompt Banner */}
            {connectSourceNodeId && (
              <div className="wf-popover-enter absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-gradient-to-r from-[#49effd] to-[#00f0ff] text-[#00363b] font-mono font-extrabold text-[11px] uppercase tracking-wider px-4 py-2 rounded-lg shadow-[0_0_24px_rgba(73,239,253,0.45)] flex items-center gap-3">
                <span>Tap a target node to connect</span>
                <button
                  type="button"
                  onClick={() => setConnectSourceNodeId(null)}
                  className="bg-[#00363b]/15 hover:bg-[#00363b]/30 p-1 rounded"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {/* Branch choice modal if source is IF in connect mode */}
            {connectBranchPrompt && (
              <div className="wf-modal-backdrop absolute inset-0 z-50 bg-[#0e0e12]/85 backdrop-blur-md flex items-center justify-center p-4">
                <div className="wf-cyber-card wf-modal-panel rounded-xl p-5 max-w-xs w-full shadow-[0_20px_50px_rgba(0,0,0,0.85)] text-center space-y-4 backdrop-blur-2xl">
                  <h4 className="text-sm font-extrabold text-[#e4e1e7] font-mono uppercase tracking-wider">
                    Choose Condition Branch
                  </h4>
                  <p className="text-xs text-[#b9cacb]">
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
                      className="flex-1 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-[#00363b] font-mono font-extrabold text-xs uppercase tracking-wider active:scale-95 transition-all"
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
                      className="flex-1 py-2 rounded-lg bg-[#ffb4ab] hover:brightness-110 text-[#131317] font-mono font-extrabold text-xs uppercase tracking-wider active:scale-95 transition-all"
                    >
                      NO Branch
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConnectBranchPrompt(null)}
                    className="text-xs font-mono uppercase tracking-wider text-[#b9cacb] hover:text-[#e4e1e7]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Cyber Glassmorphic Inspector Drawer */}
            {selectedNode && (
              <aside className="wf-drawer-enter absolute right-0 top-0 bottom-0 w-full sm:w-96 z-30 bg-[#131317]/95 border-l border-[#2a292e] shadow-[0_0_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl p-5 sm:p-6 flex flex-col justify-between overflow-y-auto">
                <div className="space-y-5">
                  <div className="flex items-center justify-between pb-4 border-b border-[#2a292e]">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`p-2 rounded-lg border border-[#3b494b]/40 flex-shrink-0 ${
                          NODE_CONFIG[selectedNode.type]?.color
                        }`}
                      >
                        {React.createElement(NODE_CONFIG[selectedNode.type]?.icon || Sparkles, {
                          size: 15,
                        })}
                      </div>
                      <div className="min-w-0">
                        <span className={`text-xs font-extrabold block truncate ${NODE_CONFIG[selectedNode.type]?.textColor || 'text-cyan-300'}`}>
                          {selectedNode.label}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-wider wf-label-gradient block">
                          {NODE_CONFIG[selectedNode.type]?.label}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId(null)}
                      className="p-1.5 rounded-lg bg-[#0e0e12] hover:bg-[#2a292e] border border-[#2a292e] text-[#b9cacb] hover:text-[#e4e1e7]"
                    >
                      <X size={15} />
                    </button>
                  </div>

                  {/* Step Label */}
                  <div>
                    <label className="text-[10px] font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
                      Step Name
                    </label>
                    <input
                      type="text"
                      value={selectedNode.label}
                      onChange={(e) =>
                        handleUpdateNode(selectedNode.id, 'label', e.target.value)
                      }
                      className="wf-field-box w-full rounded-xl px-3 py-2 text-cyan-200 font-mono text-xs focus:outline-none"
                    />
                  </div>

                  {/* Step Form */}
                  <StepSettingsForm
                    node={selectedNode}
                    allNodes={activeWorkflow.nodes}
                    edges={activeWorkflow.edges}
                    stepOutputs={stepOutputs}
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
                      className="w-full py-2 rounded-lg bg-[#49effd]/12 hover:bg-[#49effd]/22 border border-[#49effd]/40 text-[#49effd] font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                    >
                      <GitBranch size={13} />
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
                        <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider wf-label-gradient">
                          Recent Output
                        </span>
                        {stepOutputs[selectedNode.id].type === 'text' && (
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyText(
                                stepOutputs[selectedNode.id].value,
                                `insp-out-${selectedNode.id}`,
                              )
                            }
                            className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300 hover:text-[#49effd] px-2 py-0.5 rounded bg-[#0e0e12] border border-[#2a292e] flex items-center gap-1"
                          >
                            {copiedKey === `insp-out-${selectedNode.id}` ? (
                              <>
                                <Check size={11} className="text-emerald-400" />
                                <span className="text-emerald-300">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy size={11} />
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
                        <pre className="text-[11px] font-mono text-cyan-200 bg-[#0e0e12] border border-[#2a292e] p-3 rounded-lg max-h-64 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
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
                    className="w-full py-2 rounded-lg bg-[#ffb4ab]/15 hover:bg-[#ffb4ab]/25 border border-[#ffb4ab]/40 text-[#ffb4ab] font-mono text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors active:scale-[0.98]"
                  >
                    <Trash2 size={13} />
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
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-[#49effd] shadow-[0_0_10px_#49effd]" />
              <h2 className="text-sm sm:text-base font-extrabold wf-gradient-title font-mono uppercase tracking-wider">
                Final Pipeline Synthesis
              </h2>
              {lastExecutedNode && (
                <span className="text-[11px] font-mono text-indigo-200 bg-[#0b0d14] border border-[#49effd]/30 px-2.5 py-0.5 rounded-lg shadow-[0_0_12px_rgba(73,239,253,0.1)]">
                  source: <span className="text-[#49effd] font-bold">{lastExecutedNode.label}</span>
                </span>
              )}
            </div>
            {lastExecutedOutput?.type === 'text' && (
              <button
                type="button"
                onClick={() => handleCopyText(lastExecutedOutput.value, 'final-result')}
                className="px-3.5 py-1.5 rounded-xl bg-[#141722] hover:bg-[#1c2030] border border-white/10 hover:border-[#49effd]/45 text-cyan-300 font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95"
              >
                {copiedKey === 'final-result' ? (
                  <>
                    <Check size={13} className="text-emerald-400" />
                    <span className="text-emerald-300">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={13} className="text-[#49effd]" />
                    <span>Copy Output</span>
                  </>
                )}
              </button>
            )}
          </div>

          {lastExecutedOutput ? (
            <div className="mc-glow-input-wrap wf-final-output-enter rounded-2xl p-[1px]">
              <div className="wf-cyber-card rounded-2xl p-4 sm:p-5 relative overflow-hidden">
                <div className="mc-laser-line opacity-85" />
                <div className="mc-laser-line-bottom opacity-55" />
                {lastExecutedOutput.type === 'text' && (
                  <pre className="text-xs sm:text-sm text-cyan-200 font-mono whitespace-pre-wrap break-words max-h-96 overflow-y-auto leading-relaxed bg-[#090b10]/95 border border-white/10 rounded-xl p-4 shadow-inner">
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
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-[#49effd] to-[#22d3ee] hover:brightness-110 text-[#00363b] font-mono text-[11px] font-extrabold uppercase tracking-wider shadow-[0_0_22px_rgba(73,239,253,0.4)] transition-all active:scale-95"
                    >
                      <Download size={14} />
                      <span>Download Image</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="wf-cyber-card rounded-2xl py-5 px-5 text-xs font-mono wf-rainbow-subtext">
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
            <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider">
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
                className="font-mono text-[11px] font-bold uppercase tracking-wider text-rose-300 hover:text-[#49effd] px-2.5 py-1 rounded-lg bg-[#0b0d14] hover:bg-[#141722] border border-white/10 transition-colors"
              >
                Clear Trace
              </button>
            )}
          </div>

          {runLogs.length > 0 ? (
            <div className="wf-cyber-card rounded-2xl overflow-hidden divide-y divide-white/[0.06] max-h-60 overflow-y-auto">
              {runLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2.5 px-4 hover:bg-white/[0.03] text-xs font-mono tabular-nums transition-colors gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {log.status === 'done' ? (
                      <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle size={13} className="text-[#ffb4ab] flex-shrink-0" />
                    )}
                    <span className="font-bold text-cyan-200 truncate">
                      {log.label}
                    </span>
                    <span aria-hidden="true" className="text-[#3b494b] hidden sm:inline">·</span>
                    <span className="text-[10px] uppercase tracking-wider text-fuchsia-300 bg-[#0e0e12] border border-[#2a292e] px-1.5 py-0.5 rounded hidden sm:inline">
                      {log.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-emerald-300 font-bold">{log.durationMs}ms</span>
                    <span className="text-[11px] text-amber-300/80">{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="wf-cyber-card rounded-xl py-3.5 px-4 text-xs font-mono text-zinc-400">
              No trace events logged yet.
            </div>
          )}
        </section>
        </div>
      </div>

      {/* ================= CYBER TEMPLATES MODAL ================= */}
      {showTemplatesModal && (
        <div className="wf-modal-backdrop fixed inset-0 z-[1300] bg-[#0e0e12]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="wf-cyber-card wf-modal-panel rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-[0_24px_64px_rgba(0,0,0,0.85),0_0_24px_rgba(73,239,253,0.14)] space-y-5 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-[#2a292e] pb-4">
              <div>
                <h3 className="text-base font-extrabold wf-gradient-title font-mono uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={15} className="text-[#49effd]" />
                  <span>Pipeline Templates</span>
                </h3>
                <p className="text-xs wf-rainbow-subtext mt-0.5">
                  Load pre-configured multi-step workflows.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplatesModal(false)}
                className="p-1.5 rounded-lg bg-[#0e0e12] hover:bg-[#2a292e] border border-[#2a292e] text-[#b9cacb] hover:text-[#e4e1e7]"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {DEFAULT_WORKFLOW_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.name}
                  className="p-3.5 rounded-xl bg-[#0e0e12] hover:bg-[#1b1b1f] border border-[#2a292e] hover:border-[#49effd]/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1 min-w-0">
                    <h4 className="text-sm font-bold wf-step-title-gradient">{tmpl.name}</h4>
                    <p className="text-xs text-indigo-200/85 leading-relaxed">{tmpl.description}</p>
                    <div className="flex items-center gap-2 pt-1 text-[10px] font-mono uppercase tracking-wider tabular-nums text-[#49effd]">
                      <span className="bg-[#1b1b1f] border border-[#2a292e] px-2 py-0.5 rounded text-cyan-300">
                        {tmpl.nodes.length} steps
                      </span>
                      <span className="bg-[#1b1b1f] border border-[#2a292e] px-2 py-0.5 rounded text-fuchsia-300">
                        {tmpl.edges.length} links
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#49effd] to-[#00f0ff] hover:brightness-110 text-[#00363b] font-mono font-extrabold text-[11px] uppercase tracking-wider flex-shrink-0 transition-all shadow-[0_0_16px_rgba(73,239,253,0.3)] active:scale-95 whitespace-nowrap"
                  >
                    Use Template
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
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
}

/**
 * Reusable text/textarea field with:
 * 1) "{ } Insert variable" button & popover showing earlier steps + 40-char output snippet
 * 2) "{{" autocomplete dropdown filtered by label (Escape to close)
 * 3) Live preview line under the field replacing placeholders with 60-char output,
 *    "Label (not run yet)" indicator, or "unknown step" indicator.
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

  const handleInsertVariableAtCursor = (step: WorkflowNode) => {
    const tag = `{{${step.label}.output}}`;
    const el = fieldRef.current;
    const start =
      el && typeof el.selectionStart === 'number' ? el.selectionStart : value.length;
    const end =
      el && typeof el.selectionEnd === 'number' ? el.selectionEnd : value.length;

    const nextValue = value.slice(0, start) + tag + value.slice(end);
    onChange(nextValue);
    setShowInsertMenu(false);
    setAutocompleteState(null);

    const nextCursor = start + tag.length;
    requestAnimationFrame(() => {
      if (fieldRef.current) {
        fieldRef.current.focus();
        fieldRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const handleSelectAutocomplete = (step: WorkflowNode) => {
    if (!autocompleteState) {
      handleInsertVariableAtCursor(step);
      return;
    }
    const tag = `{{${step.label}.output}}`;
    const nextValue =
      value.slice(0, autocompleteState.startIndex) +
      tag +
      value.slice(autocompleteState.endIndex);
    onChange(nextValue);
    const nextCursor = autocompleteState.startIndex + tag.length;
    setAutocompleteState(null);
    setShowInsertMenu(false);

    requestAnimationFrame(() => {
      if (fieldRef.current) {
        fieldRef.current.focus();
        fieldRef.current.setSelectionRange(nextCursor, nextCursor);
      }
    });
  };

  const filteredAutocompleteSteps = useMemo(() => {
    if (!autocompleteState) return [];
    const q = autocompleteState.query.trim().toLowerCase();
    if (!q) return earlierSteps;
    return earlierSteps.filter((s) => s.label.toLowerCase().includes(q));
  }, [autocompleteState, earlierSteps]);

  const previewSegments = useMemo(() => {
    if (!value) return [];
    const segments: Array<
      | { kind: 'text'; text: string }
      | { kind: 'resolved'; label: string; text: string }
      | { kind: 'unrun'; label: string }
      | { kind: 'unknown'; rawName: string }
    > = [];

    const regex = /\{\{\s*([^}]+?)\.output\s*\}\}/gi;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(value)) !== null) {
      if (match.index > lastIndex) {
        segments.push({
          kind: 'text',
          text: value.slice(lastIndex, match.index),
        });
      }
      const rawKey = match[1].trim();
      const matchedNode = allNodes.find(
        (n) =>
          n.id !== currentNodeId &&
          (n.id.trim().toLowerCase() === rawKey.toLowerCase() ||
            n.label.trim().toLowerCase() === rawKey.toLowerCase()),
      );

      if (!matchedNode) {
        segments.push({ kind: 'unknown', rawName: rawKey });
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

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < value.length) {
      segments.push({ kind: 'text', text: value.slice(lastIndex) });
    }

    return segments;
  }, [value, allNodes, currentNodeId, stepOutputs]);

  const hasAnyPlaceholder = useMemo(
    () => /\{\{\s*([^}]+?)\.output\s*\}\}/i.test(value || ''),
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
        className="w-full flex items-center justify-between gap-2.5 p-2 rounded-lg hover:bg-[#49effd]/15 active:bg-[#49effd]/25 text-left transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-md border border-[#3b494b]/40 flex-shrink-0 ${cfg.color}`}>
            <StepIcon size={13} />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[#e4e1e7] truncate">{step.label}</div>
            <div className="text-[10px] font-mono text-[#b9cacb] truncate">
              {snippet ? snippet : 'No output yet'}
            </div>
          </div>
        </div>
        <span className="text-[10px] font-mono text-[#49effd] bg-[#0e0e12] border border-[#2a292e] px-1.5 py-0.5 rounded flex-shrink-0">
          {`{{${step.label}.output}}`}
        </span>
      </button>
    );
  };

  return (
    <div className="relative space-y-1.5">
      {/* Header row with label and "{ } Insert variable" button */}
      <div className="flex items-center justify-between gap-2">
        <label className="text-[10px] font-mono font-extrabold uppercase tracking-wider wf-label-gradient">
          {label}
        </label>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setShowInsertMenu((prev) => !prev);
            setAutocompleteState(null);
          }}
          className="px-2.5 py-1 rounded-md bg-gradient-to-r from-[#49effd]/15 to-fuchsia-500/15 hover:from-[#49effd]/25 hover:to-fuchsia-500/25 border border-[#49effd]/40 text-[#49effd] text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 transition-all active:scale-95"
          title="Insert output variable from an earlier step"
        >
          <span>{'{ } Insert variable'}</span>
        </button>
      </div>

      {/* "{ } Insert variable" Dropdown List */}
      {showInsertMenu && (
        <div className="wf-popover-enter z-30 rounded-xl bg-[#131317]/98 border border-[#49effd]/40 p-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl space-y-1.5">
          <div className="flex items-center justify-between px-1 pb-1.5 border-b border-[#2a292e]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider wf-label-gradient">
              Earlier steps ({earlierSteps.length})
            </span>
            <button
              type="button"
              onClick={() => setShowInsertMenu(false)}
              className="text-[#b9cacb] hover:text-[#e4e1e7] p-0.5"
            >
              <X size={12} />
            </button>
          </div>
          {earlierSteps.length > 0 ? (
            <div className="space-y-0.5 max-h-48 overflow-y-auto pr-0.5">
              {earlierSteps.map((step) =>
                renderStepPickerRow(step, handleInsertVariableAtCursor),
              )}
            </div>
          ) : (
            <div className="text-[11px] font-mono text-amber-300/90 py-2 px-1">
              No earlier connected steps can reach this step yet.
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
          className="wf-field-box w-full rounded-xl p-3 text-cyan-200 placeholder-indigo-300/40 text-xs focus:outline-none font-mono resize-y"
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
          className="wf-field-box w-full rounded-xl px-3.5 py-2.5 text-cyan-200 placeholder-indigo-300/40 text-xs focus:outline-none font-mono"
        />
      )}

      {/* "{{" Autocomplete Dropdown under the field */}
      {autocompleteState && (
        <div className="wf-popover-enter z-30 rounded-xl bg-[#131317]/98 border border-[#49effd]/40 p-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl space-y-1.5">
          <div className="flex items-center justify-between px-1 pb-1.5 border-b border-[#2a292e]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#49effd]">
              Autocomplete variable {autocompleteState.query ? `“${autocompleteState.query}”` : ''}
            </span>
            <button
              type="button"
              onClick={() => setAutocompleteState(null)}
              className="text-[10px] text-[#b9cacb] hover:text-[#e4e1e7] font-mono uppercase"
            >
              Esc
            </button>
          </div>
          {filteredAutocompleteSteps.length > 0 ? (
            <div className="space-y-0.5 max-h-44 overflow-y-auto pr-0.5">
              {filteredAutocompleteSteps.map((step) =>
                renderStepPickerRow(step, handleSelectAutocomplete),
              )}
            </div>
          ) : (
            <div className="text-[11px] font-mono text-[#b9cacb] py-1.5 px-1">
              No matching earlier steps found.
            </div>
          )}
        </div>
      )}

      {/* Live Preview line under the field */}
      {(hasAnyPlaceholder || value.includes('{{')) && (
        <div className="py-1.5 px-2.5 rounded-lg bg-[#0e0e12] border border-[#2a292e] text-[11px] font-mono text-[#e4e1e7] leading-relaxed break-words">
          <span className="text-[10px] uppercase tracking-wider text-[#49effd] font-bold mr-1.5 select-none">
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
                [{seg.rawName}: unknown step]
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
  viewMode = 'list',
  isWorkflowRunning = false,
  onRunSingleNode,
  onUpdateSettings,
}: StepSettingsFormProps) {
  const settings = node.settings || {};
  const isFrozen = settings.frozen === 'true';

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

  const resolvedSettings = useMemo(() => {
    return resolveNodeSettings(node, allNodes, stepOutputs);
  }, [node, allNodes, stepOutputs]);

  const hasAnyVariables = useMemo(() => {
    return Object.values(settings).some((val) =>
      /\{\{\s*([^}]+?)\.output\s*\}\}/i.test(val || ''),
    );
  }, [settings]);

  const resolvedPreviewList = useMemo(() => {
    return Object.entries(settings)
      .filter(([, v]) => /\{\{\s*([^}]+?)\.output\s*\}\}/i.test(v || ''))
      .map(([k]) => ({
        field:
          k === 'query'
            ? 'Search Query'
            : k === 'prompt'
            ? 'AI Prompt'
            : k === 'url'
            ? 'Target URL'
            : k,
        resolved: resolvedSettings[k] || '',
      }));
  }, [settings, resolvedSettings]);

  return (
    <div className="space-y-4">
      {/* Interactive Step Debugger & Runner Card */}
      <div className="p-3.5 rounded-xl bg-[#0b0d14] border border-[#49effd]/25 shadow-[0_4px_20px_rgba(0,0,0,0.5)] space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded-md bg-[#49effd]/15 border border-[#49effd]/40 text-[#49effd]">
              <Sparkles size={13} />
            </span>
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-200 block">
                Step Debugger
              </span>
              <span className="text-[10px] text-cyan-300/70 block">
                Test and inspect this step in isolation
              </span>
            </div>
          </div>

          {onRunSingleNode && (
            <button
              type="button"
              disabled={isWorkflowRunning}
              onClick={() => onRunSingleNode(node.id)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-300 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all disabled:opacity-40 active:scale-95 shadow-[0_0_12px_rgba(16,185,129,0.25)]"
              title="Execute only this step with current inputs"
            >
              <Play size={11} className="fill-emerald-400 text-emerald-400" />
              <span>Test This Step</span>
            </button>
          )}
        </div>

        {/* Live Resolved Inputs Preview */}
        {hasAnyVariables && (
          <div className="pt-2 border-t border-[#2a292e] space-y-2">
            <span className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-[#49effd] block select-none">
              Live Resolved Inputs:
            </span>
            <div className="space-y-1.5">
              {resolvedPreviewList.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#131317] rounded-lg p-2 border border-[#2a292e] text-[11px] font-mono"
                >
                  <div className="text-[10px] text-[#49effd] font-bold uppercase tracking-wider mb-0.5">
                    {item.field}
                  </div>
                  <div className="text-cyan-100 whitespace-pre-wrap break-words max-h-24 overflow-y-auto leading-relaxed">
                    {item.resolved || <span className="text-[#94a3b8] italic">(empty)</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Freeze / Mock Output Toggle Card */}
      <div className="p-3.5 rounded-xl bg-[#0b0d14] border border-cyan-400/30 shadow-[0_4px_20px_rgba(0,0,0,0.5)] space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`p-1 rounded-md border ${
                isFrozen
                  ? 'bg-cyan-500/20 border-cyan-400/50 text-cyan-200'
                  : 'bg-[#1b1b1f] border-white/10 text-[#b9cacb]'
              }`}
            >
              <Snowflake size={13} className={isFrozen ? 'text-cyan-300 animate-pulse' : ''} />
            </span>
            <div>
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-cyan-200 block">
                Freeze Output (Mock / Cache)
              </span>
              <span className="text-[10px] text-cyan-300/70 block">
                Lock step output so downstream nodes run instantly without API calls
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
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none ${
              isFrozen
                ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_12px_rgba(73,239,253,0.35)]'
                : 'bg-[#2a292e] border-[#3b494b]'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-3.5 w-3.5 mt-0.5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
                isFrozen
                  ? 'translate-x-4 bg-[#131317]'
                  : 'translate-x-0.5 bg-[#b9cacb]'
              }`}
            />
          </button>
        </div>

        {/* When Frozen: Mock Output Value Editor */}
        {isFrozen && (
          <div className="pt-2 border-t border-[#2a292e] space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <label className="text-[10px] font-mono font-extrabold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <span>Mock Output Payload</span>
                <span className="text-[9px] text-[#94a3b8] font-normal lowercase">
                  ({(settings.mockValue || '').length} chars)
                </span>
              </label>

              <div className="flex items-center gap-1">
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
                    className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300 hover:text-[#49effd] px-2 py-0.5 rounded bg-[#131317] border border-cyan-500/35 flex items-center gap-1 transition-colors"
                    title="Copy last execution output into mock payload"
                  >
                    <Copy size={10} />
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
                    className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#ffb4ab] hover:bg-[#ffb4ab]/15 px-2 py-0.5 rounded bg-[#131317] border border-[#ffb4ab]/30 flex items-center gap-1 transition-colors"
                    title="Clear mock payload"
                  >
                    <X size={10} />
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
              className="wf-field-box w-full rounded-xl p-2.5 text-cyan-200 placeholder-indigo-300/40 text-xs focus:outline-none font-mono resize-y"
            />
            <p className="text-[10px] font-mono text-cyan-300/75">
              ⚡ Downstream nodes will use this mocked payload without executing real API calls.
            </p>
          </div>
        )}
      </div>

      {/* Disable this step toggle */}
      <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-[#0e0e12] border border-[#2a292e]">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider wf-label-gradient block">
            Disable this step
          </span>
          <span className="text-[11px] text-indigo-200/80 block">
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
          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border transition-colors duration-200 ease-in-out focus:outline-none ${
            settings.disabled === 'true'
              ? 'bg-amber-400 border-amber-300'
              : 'bg-[#2a292e] border-[#3b494b]'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-3.5 w-3.5 mt-0.5 transform rounded-full shadow ring-0 transition duration-200 ease-in-out ${
              settings.disabled === 'true'
                ? 'translate-x-4 bg-[#131317]'
                : 'translate-x-0.5 bg-[#b9cacb]'
            }`}
          />
        </button>
      </div>

      {/* Node Type Specific Inputs */}
      {node.type === 'input' && (
        <div>
          <label className="text-[10px] font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
            Input Text Payload
          </label>
          <textarea
            rows={3}
            value={settings.text || ''}
            onChange={(e) => handleChange('text', e.target.value)}
            placeholder="Type your initial input text or prompt..."
            className="wf-field-box w-full rounded-xl p-3 text-cyan-200 placeholder-indigo-300/40 text-xs focus:outline-none font-mono resize-y"
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
        />
      )}

      {node.type === 'ai' && (
        <div className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
                AI provider
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
                className="wf-field-box w-full rounded-xl px-3 py-2 text-violet-200 text-xs font-mono focus:outline-none"
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
                <label className="text-[10px] font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
                  Model
                </label>
                <select
                  value={settings.modelId || (selectedProviderModels[0]?.id || '')}
                  onChange={(e) => handleChange('modelId', e.target.value)}
                  className="wf-field-box w-full rounded-xl px-3 py-2 text-cyan-200 text-xs font-mono focus:outline-none"
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
              <label className="text-[10px] font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
                AI Persona Role
              </label>
              <select
                value={settings.role || 'general'}
                onChange={(e) => handleChange('role', e.target.value)}
                className="wf-field-box w-full rounded-xl px-3 py-2 text-fuchsia-200 text-xs font-mono focus:outline-none"
              >
                <option value="general" className="bg-[#0b0d14]">General Assistant (Comprehensive)</option>
                <option value="coder" className="bg-[#0b0d14]">Coder (Clean code & explanations)</option>
                <option value="architect" className="bg-[#0b0d14]">Architect (System structure & trade-offs)</option>
                <option value="dataAnalyst" className="bg-[#0b0d14]">Data Analyst (Steps & quantitative analysis)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
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
                      className="wf-field-box w-full rounded-xl px-3 py-2 text-emerald-200 text-xs font-mono focus:outline-none"
                    >
                      <option value="" className="bg-[#0b0d14]">None</option>
                      {savedSkills.map((skill) => (
                        <option key={skill.id} value={skill.id} className="bg-[#0b0d14]">
                          {skill.name} ({formatSkillSize(skill.sizeChars || skill.text.length)})
                        </option>
                      ))}
                      {isSkillMissing && (
                        <option value={rawSkillId} className="bg-[#0b0d14]">
                          Skill not found (will run without a skill)
                        </option>
                      )}
                    </select>
                    {isSkillMissing ? (
                      <p className="text-[10px] font-mono text-amber-300 mt-1">
                        Skill not found (will run without a skill)
                      </p>
                    ) : matchedSkill ? (
                      <p className="text-[10px] font-mono text-emerald-300/90 mt-1">
                        ~{Math.max(0.1, Number((estimateTokens(matchedSkill.text.length) / 1000).toFixed(1)))}k tokens added to this step
                      </p>
                    ) : savedSkills.length === 0 ? (
                      <p className="text-[10px] font-mono text-indigo-300/80 mt-1">
                        No skills yet. Add one in Settings → Skills.
                      </p>
                    ) : null}
                  </>
                );
              })()}
            </div>

            <div>
              <label className="text-[10px] font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
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
                className="wf-field-box w-full rounded-xl px-3 py-2 text-amber-200 text-xs focus:outline-none font-mono tabular-nums"
              />
              <p className="text-[10px] font-mono text-indigo-300/80 mt-1">
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
        />
      )}

      {node.type === 'nasa' && (
        <div className="py-2.5 px-3 rounded-lg bg-[#49effd]/10 border border-[#49effd]/35 text-[#e4e1e7] font-mono text-xs flex items-center gap-2.5">
          <Rocket size={15} className="text-[#49effd] flex-shrink-0" />
          <span>
            Fetches the latest Astronomy Picture of the Day (APOD) directly from NASA telemetry. No fields required.
          </span>
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
          />

          <div>
            <label className="text-[10px] font-mono font-extrabold uppercase tracking-wider wf-label-gradient block mb-1.5">
              Operator Rule
            </label>
            <select
              value={settings.operator || 'contains'}
              onChange={(e) => handleChange('operator', e.target.value)}
              className="wf-field-box w-full rounded-xl px-3 py-2 text-emerald-200 text-xs font-mono focus:outline-none"
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
            />
          )}
        </div>
      )}
    </div>
  );
}


