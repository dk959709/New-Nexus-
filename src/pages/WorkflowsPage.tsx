import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowStepStatus,
  WorkflowOutput,
  AIProviderConfig,
} from '@/types';
import { storage } from '@/lib/storage';
import {
  runWorkflow,
  hasWorkflowCycle,
  getOutputSummary,
  getAncestorNodeIds,
  getDownstreamNodeIds,
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
    setStepStatuses({});
    setStepOutputs({});
    setStepStartTimes({});
    setStepDurations({});
    setStepOutputSummaries({});
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
      // Verify all needed ancestors have saved outputs
      for (const ancId of preservedAncestors) {
        const ancNode = nodeMap.get(ancId);
        if (!ancNode) continue;
        if (ancNode.settings?.disabled === 'true') continue;
        if (stepStatuses[ancId] === 'skipped') continue;
        if (!stepOutputs[ancId]) {
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
      // Only clear target and downstream nodes; preserve ancestors AND unrelated parallel branches
      const downstreamIds = getDownstreamNodeIds(startFromNodeId, activeWorkflow.edges || []);
      setStepStatuses((prev) => {
        const next = { ...prev };
        for (const id of downstreamIds) delete next[id];
        return next;
      });
      setStepOutputs((prev) => {
        const next = { ...prev };
        for (const id of downstreamIds) delete next[id];
        return next;
      });
      setStepStartTimes((prev) => {
        const next = { ...prev };
        for (const id of downstreamIds) delete next[id];
        return next;
      });
      setStepDurations((prev) => {
        const next = { ...prev };
        for (const id of downstreamIds) delete next[id];
        return next;
      });
      setStepOutputSummaries((prev) => {
        const next = { ...prev };
        for (const id of downstreamIds) delete next[id];
        return next;
      });
      setStepErrors((prev) => {
        const next = { ...prev };
        for (const id of downstreamIds) delete next[id];
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
      className="w-full max-w-[1360px] mx-auto pb-24 text-[#e4e1e7] animate-in fade-in duration-200"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 bg-[#1b1b1f]/95 border border-[#49effd]/40 text-[#e4e1e7] font-mono text-xs px-4 py-2.5 rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.6),0_0_16px_rgba(73,239,253,0.2)] backdrop-blur-2xl flex items-center gap-2.5 animate-in slide-in-from-top-2">
          <Sparkles size={14} className="text-[#49effd] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Cyber Workspace Surface with Static Matrix Grid + Soft Cyan Glow */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[#131317] border border-[#2a292e] px-3.5 sm:px-8 py-5 sm:py-8 shadow-[0_24px_64px_rgba(0,0,0,0.65)]">
        {/* Static Background Grid + Soft Radial Cyan Glow (pointer-events: none) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 wf-cyber-matrix-grid opacity-80"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-[540px] h-[260px] rounded-full bg-[#49effd]/[0.07] blur-[90px]"
        />

        <div className="relative z-10">
          {/* Top Cyber Header */}
          <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 pb-6 border-b border-[#2a292e]">
            <div className="space-y-1.5 min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[#b9cacb] flex-wrap">
                <span>Automation</span>
                <span aria-hidden="true" className="text-[#3b494b]">/</span>
                <span className="text-[#49effd] font-bold">Pipelines</span>
                <span aria-hidden="true" className="text-[#3b494b]">·</span>
                <span className="tabular-nums text-[#e4e1e7] bg-[#1b1b1f] border border-[#2a292e] px-2 py-0.5 rounded">
                  {activeWorkflow.nodes.length} {activeWorkflow.nodes.length === 1 ? 'step' : 'steps'}
                </span>
                {hasBranches && (
                  <>
                    <span aria-hidden="true" className="text-[#3b494b]">·</span>
                    <span className="text-emerald-400 font-bold bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
                      Branching graph
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#e4e1e7] tracking-tight">
                Workflows
              </h1>
              <p className="text-xs sm:text-sm text-[#b9cacb] max-w-2xl leading-relaxed">
                Orchestrate multi-step research, live web telemetry, academic synthesis, and studio generation pipelines.
              </p>
            </div>

            {/* Primary Execution Controls */}
            <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowTemplatesModal(true)}
                className="px-3.5 py-2 rounded-lg bg-[#2a292e] hover:bg-[#35343a] border border-[#3b494b]/60 hover:border-[#49effd]/40 text-[#e4e1e7] font-mono text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap shrink-0 active:scale-[0.98]"
              >
                <Sparkles size={13} className="text-[#49effd]" />
                <span>Templates</span>
              </button>

              <button
                type="button"
                onClick={handleClearResults}
                disabled={isRunning}
                className="px-3.5 py-2 rounded-lg bg-[#2a292e] hover:bg-[#35343a] border border-[#3b494b]/60 hover:border-[#49effd]/30 text-[#b9cacb] hover:text-[#e4e1e7] font-mono text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 disabled:opacity-40 whitespace-nowrap shrink-0 active:scale-[0.98]"
                title="Clear previous outputs & step statuses"
              >
                <RotateCcw size={13} />
                <span>Reset State</span>
              </button>

              {isRunning ? (
                <button
                  type="button"
                  onClick={handleStop}
                  className="wf-run-btn-busy relative overflow-hidden px-4 sm:px-5 py-2 rounded-lg bg-[#ffb4ab]/15 hover:bg-[#ffb4ab]/25 border border-[#ffb4ab]/50 text-[#ffb4ab] font-mono text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 whitespace-nowrap shrink-0 shadow-[0_0_20px_rgba(255,180,171,0.2)] active:scale-[0.98]"
                >
                  <Square size={12} className="fill-[#ffb4ab] text-[#ffb4ab]" />
                  <span>Stop Run</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRun}
                  className="wf-run-btn-idle relative overflow-hidden px-4 sm:px-5 py-2 rounded-lg bg-gradient-to-r from-[#49effd] to-[#00f0ff] hover:brightness-110 text-[#00363b] font-mono text-[11px] font-extrabold uppercase tracking-wider transition-all flex items-center gap-2 shadow-[0_0_24px_rgba(73,239,253,0.38)] active:scale-[0.98] whitespace-nowrap shrink-0"
                >
                  <Play size={13} className="fill-[#00363b]" />
                  <span>Run Pipeline</span>
                </button>
              )}
            </div>
          </header>

          {/* Cyber Workspace Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 py-4 border-b border-[#2a292e]">
            {/* Left: Workflow Selector & Inline Actions */}
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <div className="relative min-w-[180px] sm:min-w-[220px] flex-1 sm:flex-initial">
                <select
                  value={activeWorkflow.id}
                  onChange={(e) => {
                    setActiveWorkflowId(e.target.value);
                    setSelectedNodeId(null);
                    handleClearResults();
                  }}
                  className="w-full appearance-none bg-[#1b1b1f] hover:bg-[#2a292e] border border-[#3b494b]/60 focus:border-[#49effd] text-[#e4e1e7] font-mono font-semibold text-xs rounded-lg pl-3.5 pr-9 py-2 focus:outline-none focus:ring-1 focus:ring-[#49effd]/50 transition-colors cursor-pointer truncate"
                >
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id} className="bg-[#0e0e12] text-[#e4e1e7]">
                      {w.name} ({w.nodes.length} steps)
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#49effd] pointer-events-none"
                />
              </div>

              <div className="h-4 w-[1px] bg-[#2a292e] mx-1 hidden sm:block" />

              {/* New Workflow */}
              <button
                type="button"
                onClick={handleCreateNew}
                className="px-2.5 py-2 rounded-lg bg-[#1b1b1f] hover:bg-[#2a292e] border border-[#2a292e] hover:border-[#49effd]/40 text-[#b9cacb] hover:text-[#e4e1e7] font-mono text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 active:scale-[0.98]"
                title="Create new blank workflow"
              >
                <Plus size={13} className="text-[#49effd]" />
                <span className="hidden md:inline">New</span>
              </button>

              {/* Rename Workflow */}
              {isRenaming ? (
                <div className="flex items-center gap-1 bg-[#0e0e12] border border-[#49effd]/50 rounded-lg px-2 py-1">
                  <input
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    className="bg-transparent text-[#e4e1e7] font-mono text-xs px-1.5 py-0.5 focus:outline-none w-32 sm:w-40"
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
                    className="p-1 rounded bg-[#49effd] text-[#00363b] hover:bg-[#00f0ff]"
                  >
                    <Check size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRenaming(false)}
                    className="p-1 rounded text-[#b9cacb] hover:text-[#e4e1e7]"
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setRenameDraft(activeWorkflow.name);
                    setIsRenaming(true);
                  }}
                  className="px-2.5 py-2 rounded-lg bg-[#1b1b1f] hover:bg-[#2a292e] border border-[#2a292e] hover:border-[#49effd]/40 text-[#b9cacb] hover:text-[#e4e1e7] font-mono text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 active:scale-[0.98]"
                  title="Rename workflow"
                >
                  <Edit2 size={12} />
                  <span className="hidden md:inline">Rename</span>
                </button>
              )}

              {/* Duplicate */}
              <button
                type="button"
                onClick={handleDuplicate}
                className="px-2.5 py-2 rounded-lg bg-[#1b1b1f] hover:bg-[#2a292e] border border-[#2a292e] hover:border-[#49effd]/40 text-[#b9cacb] hover:text-[#e4e1e7] font-mono text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 active:scale-[0.98]"
                title="Duplicate workflow"
              >
                <Copy size={12} />
                <span className="hidden md:inline">Duplicate</span>
              </button>

              {/* Delete (with inline confirmation instead of window.confirm) */}
              {confirmDeleteWorkflow ? (
                <div className="flex items-center gap-1.5 bg-[#ffb4ab]/15 border border-[#ffb4ab]/40 rounded-lg px-2.5 py-1">
                  <span className="text-[11px] font-mono text-[#ffb4ab] font-bold uppercase">Delete?</span>
                  <button
                    type="button"
                    onClick={handleDeleteCurrent}
                    className="px-2 py-0.5 rounded bg-[#ffb4ab] hover:brightness-110 text-[#131317] font-mono font-bold text-[10px] uppercase"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteWorkflow(false)}
                    className="p-1 rounded text-[#b9cacb] hover:text-[#e4e1e7]"
                  >
                    <X size={12} />
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
                  className="px-2.5 py-2 rounded-lg bg-[#1b1b1f] hover:bg-[#ffb4ab]/15 border border-[#2a292e] hover:border-[#ffb4ab]/40 text-[#b9cacb] hover:text-[#ffb4ab] font-mono text-[11px] font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 active:scale-[0.98]"
                  title="Delete current workflow"
                >
                  <Trash2 size={12} />
                  <span className="hidden md:inline">Delete</span>
                </button>
              )}
            </div>

            {/* Right: Segmented Mode Switch (List | Canvas) */}
            <div className="flex items-center self-end sm:self-auto bg-[#0e0e12] border border-[#2a292e] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3.5 py-1.5 rounded-lg font-mono text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  viewMode === 'list'
                    ? 'bg-[#49effd]/15 text-[#49effd] border border-[#49effd]/40 shadow-[0_0_12px_rgba(73,239,253,0.2)]'
                    : 'text-[#b9cacb] hover:text-[#e4e1e7] border border-transparent'
                }`}
              >
                <Layers size={13} />
                <span>Pipeline List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('canvas')}
                className={`px-3.5 py-1.5 rounded-lg font-mono text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                  viewMode === 'canvas'
                    ? 'bg-[#49effd]/15 text-[#49effd] border border-[#49effd]/40 shadow-[0_0_12px_rgba(73,239,253,0.2)]'
                    : 'text-[#b9cacb] hover:text-[#e4e1e7] border border-transparent'
                }`}
              >
                <GitBranch size={13} />
                <span>Graph Canvas</span>
              </button>
            </div>
          </div>

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
                const isSettingsOpen = !collapsedSettings[node.id];
                const isOutputOpen = !collapsedOutputs[node.id];
                const nextNode = activeWorkflow.nodes[index + 1];
                const nextStatus = nextNode ? stepStatuses[nextNode.id] || 'idle' : 'idle';
                const isConnectorFlowing = status === 'running' || nextStatus === 'running';

                return (
                  <React.Fragment key={node.id}>
                    <section
                      className={`wf-cyber-card wf-step-card-enter rounded-xl p-4 sm:p-5 transition-all duration-200 ${
                        isDisabled ? 'opacity-60' : ''
                      } ${
                        status === 'running'
                          ? 'wf-cyber-card-active wf-step-running'
                          : status === 'done'
                          ? 'wf-step-done border-emerald-500/35'
                          : status === 'error'
                          ? 'wf-step-error border-[#ffb4ab]/55'
                          : status === 'skipped'
                          ? 'wf-step-skipped opacity-55'
                          : 'hover:border-[#3b494b]'
                      }`}
                    >
                      {/* Step Header Line */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#2a292e]/80">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Cyber Step Index Badge */}
                          <span className="text-[11px] font-mono font-bold tabular-nums text-[#49effd] bg-[#0e0e12] border border-[#2a292e] px-2 py-1 rounded flex-shrink-0 select-none">
                            {String(index + 1).padStart(2, '0')}
                          </span>

                          {/* Node Type Icon */}
                          <div className={`p-2 rounded-lg border border-[#3b494b]/40 flex-shrink-0 ${cfg.color}`}>
                            <IconComp size={16} />
                          </div>

                          {/* Editable Step Title & Metadata Tags */}
                          <div className="min-w-0 flex flex-col sm:flex-row sm:items-center sm:gap-2.5 flex-1">
                            <input
                              type="text"
                              value={node.label}
                              onChange={(e) => handleUpdateNode(node.id, 'label', e.target.value)}
                              className="bg-transparent hover:bg-[#2a292e]/70 focus:bg-[#0e0e12] font-bold text-[#e4e1e7] text-sm sm:text-base rounded px-2 py-0.5 border border-transparent focus:border-[#49effd]/50 focus:outline-none w-full max-w-[220px] sm:max-w-[290px] truncate transition-colors"
                              title="Click to rename step"
                            />
                            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#b9cacb] pl-2 sm:pl-0 flex-wrap">
                              <span className="bg-[#0e0e12] border border-[#2a292e] px-2 py-0.5 rounded text-[#b9cacb]">
                                {cfg.label}
                              </span>
                              {durationMs !== undefined && status === 'done' && (
                                <span className="tabular-nums text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
                                  {(durationMs / 1000).toFixed(1)}s
                                </span>
                              )}
                              {summaryText && status === 'done' && (
                                <span className="tabular-nums text-[#49effd] bg-[#49effd]/10 border border-[#49effd]/25 px-2 py-0.5 rounded normal-case">
                                  {summaryText}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Right Side Status Badge + Action Controls */}
                        <div className="flex items-center justify-between sm:justify-end gap-2 pl-9 sm:pl-0 flex-wrap">
                          {/* Cyber Status Pill */}
                          <div className="mr-1 flex items-center">
                            {isDisabled ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-400/35 text-[10px] font-mono font-bold uppercase tracking-wider text-amber-300">
                                <Ban size={12} />
                                <span>Disabled</span>
                              </span>
                            ) : status === 'running' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#49effd]/15 border border-[#49effd]/50 text-[10px] font-mono font-bold uppercase tracking-wider text-[#49effd] shadow-[0_0_12px_rgba(73,239,253,0.25)]">
                                <Loader2 size={12} className="animate-spin" />
                                <span>Running</span>
                              </span>
                            ) : status === 'done' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/40 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-300">
                                <CheckCircle2 size={12} className="wf-check-pop" />
                                <span>Completed</span>
                              </span>
                            ) : status === 'error' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#ffb4ab]/15 border border-[#ffb4ab]/45 text-[10px] font-mono font-bold uppercase tracking-wider text-[#ffb4ab]">
                                <AlertCircle size={12} />
                                <span>Failed</span>
                              </span>
                            ) : status === 'skipped' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0e0e12] border border-[#2a292e] text-[10px] font-mono font-bold uppercase tracking-wider text-[#b9cacb]">
                                <MinusCircle size={12} />
                                <span>Skipped</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#0e0e12] border border-[#2a292e] text-[10px] font-mono font-semibold uppercase tracking-wider text-[#b9cacb]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#49effd]/60" />
                                <span>Ready</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Run from this step */}
                            <button
                              type="button"
                              disabled={isRunning}
                              onClick={() => handleRunFromNode(node.id)}
                              className="p-1.5 rounded-lg bg-[#0e0e12] hover:bg-[#49effd]/15 border border-[#2a292e] hover:border-[#49effd]/40 text-[#b9cacb] hover:text-[#49effd] disabled:opacity-30 transition-colors active:scale-95"
                              title="Run workflow starting from this step"
                            >
                              <Play size={13} />
                            </button>

                            {/* Move Up / Move Down */}
                            <button
                              type="button"
                              onClick={() => handleMoveNodeUp(index)}
                              disabled={hasBranches || index === 0}
                              className="p-1.5 rounded-lg bg-[#0e0e12] hover:bg-[#2a292e] border border-[#2a292e] hover:border-[#49effd]/30 text-[#b9cacb] hover:text-[#e4e1e7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-95"
                              title={hasBranches ? 'Reordering disabled for branching workflows' : 'Move step up'}
                            >
                              <ArrowUp size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveNodeDown(index)}
                              disabled={hasBranches || index === activeWorkflow.nodes.length - 1}
                              className="p-1.5 rounded-lg bg-[#0e0e12] hover:bg-[#2a292e] border border-[#2a292e] hover:border-[#49effd]/30 text-[#b9cacb] hover:text-[#e4e1e7] disabled:opacity-30 disabled:cursor-not-allowed transition-colors active:scale-95"
                              title={hasBranches ? 'Reordering disabled for branching workflows' : 'Move step down'}
                            >
                              <ArrowDown size={13} />
                            </button>

                            {/* Duplicate Step */}
                            <button
                              type="button"
                              onClick={() => handleDuplicateNode(node.id)}
                              className="p-1.5 rounded-lg bg-[#0e0e12] hover:bg-[#2a292e] border border-[#2a292e] hover:border-[#49effd]/30 text-[#b9cacb] hover:text-[#e4e1e7] transition-colors active:scale-95"
                              title="Duplicate step"
                            >
                              <Copy size={13} />
                            </button>

                            {/* Delete Step */}
                            <button
                              type="button"
                              onClick={() => handleDeleteNode(node.id)}
                              className="p-1.5 rounded-lg bg-[#0e0e12] hover:bg-[#ffb4ab]/15 border border-[#2a292e] hover:border-[#ffb4ab]/40 text-[#b9cacb] hover:text-[#ffb4ab] transition-colors active:scale-95"
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
                              className="p-1.5 rounded-lg bg-[#0e0e12] hover:bg-[#2a292e] border border-[#2a292e] hover:border-[#49effd]/30 text-[#b9cacb] hover:text-[#e4e1e7] transition-colors active:scale-95"
                              title="Toggle step parameters"
                            >
                              {isSettingsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Step Parameters Area */}
                      {isSettingsOpen && (
                        <div className="mt-4 max-w-3xl">
                          <StepSettingsForm
                            node={node}
                            allNodes={activeWorkflow.nodes}
                            edges={activeWorkflow.edges}
                            stepOutputs={stepOutputs}
                            viewMode={viewMode}
                            onUpdateSettings={(newSettings) =>
                              handleUpdateNode(node.id, 'settings', newSettings)
                            }
                          />
                        </div>
                      )}

                      {/* Step Output Stream */}
                      {(output || errorText) && (
                        <div className="mt-4 max-w-4xl">
                          <div className="rounded-xl bg-[#0e0e12] border border-[#2a292e] px-4 py-3 space-y-2.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-[#b9cacb]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#49effd] shadow-[0_0_6px_#49effd]" />
                                <span className="font-bold text-[#e4e1e7]">Step Output</span>
                                {output?.type && (
                                  <>
                                    <span aria-hidden="true" className="text-[#3b494b]">·</span>
                                    <span className="text-[#49effd] font-bold">{output.type}</span>
                                  </>
                                )}
                                {summaryText && (
                                  <>
                                    <span aria-hidden="true" className="text-[#3b494b]">·</span>
                                    <span className="tabular-nums text-[#b9cacb] normal-case">
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
                                    className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#b9cacb] hover:text-[#49effd] flex items-center gap-1 px-2.5 py-1 rounded bg-[#1b1b1f] hover:bg-[#2a292e] border border-[#2a292e] transition-colors"
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
                                  className="p-1 text-[#b9cacb] hover:text-[#e4e1e7] rounded bg-[#1b1b1f] hover:bg-[#2a292e] border border-[#2a292e]"
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
                                  <pre className="text-xs text-[#e4e1e7] font-mono whitespace-pre-wrap break-words max-h-60 overflow-y-auto pt-1 leading-relaxed">
                                    {output.value}
                                  </pre>
                                )}
                                {output?.type === 'image' && (
                                  <div className="pt-2 space-y-2.5 max-w-sm">
                                    <img
                                      src={output.value}
                                      alt="Workflow output"
                                      referrerPolicy="no-referrer"
                                      className="w-full rounded-lg border border-[#2a292e] object-cover max-h-64"
                                    />
                                    <div className="flex justify-end">
                                      <a
                                        href={output.value}
                                        download="workflow-image.png"
                                        target="_blank"
                                        rel="noreferrer"
                                        className="px-3 py-1.5 bg-gradient-to-r from-[#49effd] to-[#00f0ff] hover:brightness-110 text-[#00363b] font-mono text-[11px] font-extrabold uppercase tracking-wider rounded-lg inline-flex items-center gap-1.5 shadow-[0_0_14px_rgba(73,239,253,0.3)]"
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

                    {/* Vertical Cyber Connector with Central Glowing Dot between Step Cards */}
                    {index < activeWorkflow.nodes.length - 1 && (
                      <div
                        aria-hidden="true"
                        className="h-7 relative my-0.5 flex items-center justify-center select-none"
                      >
                        <div
                          className={`w-[1.5px] h-full bg-gradient-to-b from-[#49effd]/30 via-[#49effd]/85 to-[#49effd]/30 ${
                            isConnectorFlowing ? 'wf-connector-line-flowing' : ''
                          }`}
                        />
                        <div
                          className={`absolute w-2 h-2 rounded-full bg-[#49effd] shadow-[0_0_8px_#49effd] ${
                            isConnectorFlowing ? 'wf-connector-dot-flowing' : ''
                          }`}
                        />
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>

            {/* Dashed Cyan-Outline Add Step Trigger */}
            <div className="relative pt-5 pb-2">
              <button
                type="button"
                onClick={() => setShowAddMenu((v) => !v)}
                className="w-full py-3.5 px-4 rounded-xl border border-dashed border-[#49effd]/45 hover:border-[#49effd] bg-[#49effd]/[0.04] hover:bg-[#49effd]/[0.10] text-[#49effd] font-mono text-xs font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all group shadow-[0_0_20px_rgba(73,239,253,0.06)] active:scale-[0.99]"
              >
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
                          <div className="text-xs font-bold text-[#e4e1e7] truncate">{item.label}</div>
                          <div className="text-[10px] font-mono text-[#b9cacb] truncate">{item.desc}</div>
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
          <div className="relative w-full h-[660px] overflow-hidden bg-[#0e0e12] border border-[#2a292e] rounded-2xl mt-5 shadow-[0_20px_50px_rgba(0,0,0,0.65)]">
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
              onDuplicateNode={handleDuplicateNode}
              onToggleDisableNode={handleToggleDisableNode}
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
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#49effd] px-2.5 py-1 border-b border-[#2a292e]">
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
                          <div className="text-xs font-bold text-[#e4e1e7] truncate">{item.label}</div>
                          <div className="text-[10px] font-mono text-[#b9cacb] truncate">{item.desc}</div>
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
                        <span className="text-xs font-extrabold text-[#e4e1e7] block truncate">
                          {selectedNode.label}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-[#49effd] block">
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
                    <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#b9cacb] block mb-1.5">
                      Step Name
                    </label>
                    <input
                      type="text"
                      value={selectedNode.label}
                      onChange={(e) =>
                        handleUpdateNode(selectedNode.id, 'label', e.target.value)
                      }
                      className="w-full bg-[#0e0e12] hover:bg-[#131317] focus:bg-[#0e0e12] border border-[#3b494b]/60 focus:border-[#49effd] rounded-lg px-3 py-2 text-[#e4e1e7] font-mono text-xs focus:outline-none focus:ring-1 focus:ring-[#49effd]/50 transition-colors"
                    />
                  </div>

                  {/* Step Form */}
                  <StepSettingsForm
                    node={selectedNode}
                    allNodes={activeWorkflow.nodes}
                    edges={activeWorkflow.edges}
                    stepOutputs={stepOutputs}
                    viewMode={viewMode}
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
                        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#b9cacb]">
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
                            className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#b9cacb] hover:text-[#49effd] px-2 py-0.5 rounded bg-[#0e0e12] border border-[#2a292e] flex items-center gap-1"
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
                        <pre className="text-[11px] font-mono text-[#e4e1e7] bg-[#0e0e12] border border-[#2a292e] p-3 rounded-lg max-h-64 overflow-y-auto whitespace-pre-wrap break-words leading-relaxed">
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
        <section className="pt-8 pb-6 border-t border-[#2a292e] mt-8 space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-2 h-2 rounded-full bg-[#49effd] shadow-[0_0_8px_#49effd]" />
              <h2 className="text-sm sm:text-base font-extrabold text-[#e4e1e7] font-mono uppercase tracking-wider">
                Final Output
              </h2>
              {lastExecutedNode && (
                <span className="text-[11px] font-mono text-[#b9cacb] bg-[#0e0e12] border border-[#2a292e] px-2.5 py-0.5 rounded">
                  from <span className="text-[#49effd] font-bold">{lastExecutedNode.label}</span>
                </span>
              )}
            </div>
            {lastExecutedOutput?.type === 'text' && (
              <button
                type="button"
                onClick={() => handleCopyText(lastExecutedOutput.value, 'final-result')}
                className="px-3.5 py-1.5 rounded-lg bg-[#2a292e] hover:bg-[#35343a] border border-[#3b494b]/60 hover:border-[#49effd]/40 text-[#e4e1e7] font-mono text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95"
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
            <div className="wf-cyber-card wf-final-output-enter rounded-xl p-4 sm:p-5">
              {lastExecutedOutput.type === 'text' && (
                <pre className="text-xs sm:text-sm text-[#e4e1e7] font-mono whitespace-pre-wrap break-words max-h-96 overflow-y-auto leading-relaxed bg-[#0e0e12] border border-[#2a292e] rounded-lg p-4">
                  {lastExecutedOutput.value}
                </pre>
              )}
              {lastExecutedOutput.type === 'image' && (
                <div className="space-y-4">
                  <div className="rounded-lg overflow-hidden max-w-md bg-[#0e0e12] border border-[#2a292e]">
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
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-[#49effd] to-[#00f0ff] hover:brightness-110 text-[#00363b] font-mono text-[11px] font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(73,239,253,0.35)] transition-all active:scale-95"
                  >
                    <Download size={14} />
                    <span>Download Image</span>
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="wf-cyber-card rounded-xl py-5 px-4 text-xs font-mono text-[#b9cacb]">
              No pipeline output recorded in this session yet. Click{' '}
              <span className="text-[#49effd] font-bold uppercase">Run Pipeline</span> to execute steps.
            </div>
          )}
        </section>

        {/* ================= CYBER EXECUTION LOG STREAM ================= */}
        {runLogs.length > 0 && (
          <section className="pt-6 border-t border-[#2a292e] space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-[#b9cacb]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#49effd]" />
                <span className="font-bold text-[#e4e1e7]">Execution Trace</span>
                <span aria-hidden="true" className="text-[#3b494b]">·</span>
                <span className="tabular-nums text-[#49effd] bg-[#0e0e12] border border-[#2a292e] px-2 py-0.5 rounded">
                  {runLogs.length} events
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRunLogs([])}
                className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#b9cacb] hover:text-[#49effd] px-2.5 py-1 rounded bg-[#0e0e12] hover:bg-[#1b1b1f] border border-[#2a292e] transition-colors"
              >
                Clear Trace
              </button>
            </div>

            <div className="wf-cyber-card rounded-xl overflow-hidden divide-y divide-[#2a292e] max-h-60 overflow-y-auto">
              {runLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between py-2.5 px-3.5 hover:bg-[#2a292e]/40 text-xs font-mono tabular-nums transition-colors gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {log.status === 'done' ? (
                      <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle size={13} className="text-[#ffb4ab] flex-shrink-0" />
                    )}
                    <span className="font-bold text-[#e4e1e7] truncate">
                      {log.label}
                    </span>
                    <span aria-hidden="true" className="text-[#3b494b] hidden sm:inline">·</span>
                    <span className="text-[10px] uppercase tracking-wider text-[#49effd] bg-[#0e0e12] border border-[#2a292e] px-1.5 py-0.5 rounded hidden sm:inline">
                      {log.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[#b9cacb] flex-shrink-0">
                    <span className="text-emerald-300 font-bold">{log.durationMs}ms</span>
                    <span className="text-[11px] text-[#b9cacb]/80">{log.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        </div>
      </div>

      {/* ================= CYBER TEMPLATES MODAL ================= */}
      {showTemplatesModal && (
        <div className="wf-modal-backdrop fixed inset-0 z-50 bg-[#0e0e12]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="wf-cyber-card wf-modal-panel rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-[0_24px_64px_rgba(0,0,0,0.85),0_0_24px_rgba(73,239,253,0.14)] space-y-5 backdrop-blur-2xl">
            <div className="flex items-center justify-between border-b border-[#2a292e] pb-4">
              <div>
                <h3 className="text-base font-extrabold text-[#e4e1e7] font-mono uppercase tracking-wider flex items-center gap-2">
                  <Sparkles size={15} className="text-[#49effd]" />
                  <span>Pipeline Templates</span>
                </h3>
                <p className="text-xs text-[#b9cacb] mt-0.5">
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
                    <h4 className="text-sm font-bold text-[#e4e1e7]">{tmpl.name}</h4>
                    <p className="text-xs text-[#b9cacb] leading-relaxed">{tmpl.description}</p>
                    <div className="flex items-center gap-2 pt-1 text-[10px] font-mono uppercase tracking-wider tabular-nums text-[#49effd]">
                      <span className="bg-[#1b1b1f] border border-[#2a292e] px-2 py-0.5 rounded">
                        {tmpl.nodes.length} steps
                      </span>
                      <span className="bg-[#1b1b1f] border border-[#2a292e] px-2 py-0.5 rounded">
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
        const out = stepOutputs[matchedNode.id];
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
            text: displayVal,
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
    const out = stepOutputs[step.id];
    const snippet = out
      ? out.type === 'image'
        ? '[Generated image]'
        : (out.value || '').slice(0, 40) + ((out.value || '').length > 40 ? '…' : '')
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
        <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#b9cacb]">
          {label}
        </label>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            setShowInsertMenu((prev) => !prev);
            setAutocompleteState(null);
          }}
          className="px-2.5 py-1 rounded-md bg-[#49effd]/12 hover:bg-[#49effd]/22 border border-[#49effd]/40 text-[#49effd] text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1 transition-colors active:scale-95"
          title="Insert output variable from an earlier step"
        >
          <span>{'{ } Insert variable'}</span>
        </button>
      </div>

      {/* "{ } Insert variable" Dropdown List */}
      {showInsertMenu && (
        <div className="wf-popover-enter z-30 rounded-xl bg-[#131317]/98 border border-[#49effd]/40 p-2.5 shadow-[0_16px_40px_rgba(0,0,0,0.85)] backdrop-blur-2xl space-y-1.5">
          <div className="flex items-center justify-between px-1 pb-1.5 border-b border-[#2a292e]">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#b9cacb]">
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
            <div className="text-[11px] font-mono text-[#b9cacb] py-2 px-1">
              No earlier connected steps can reach this step yet.
            </div>
          )}
        </div>
      )}

      {/* Input or Textarea with Cyber dark inset surface */}
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
          className="w-full bg-[#0e0e12] hover:bg-[#131317] focus:bg-[#0e0e12] border border-[#3b494b]/60 focus:border-[#49effd] rounded-lg p-3 text-[#e4e1e7] placeholder-[#b9cacb]/40 text-xs focus:outline-none focus:ring-1 focus:ring-[#49effd]/50 font-mono resize-y transition-colors"
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
          className="w-full bg-[#0e0e12] hover:bg-[#131317] focus:bg-[#0e0e12] border border-[#3b494b]/60 focus:border-[#49effd] rounded-lg px-3 py-2 text-[#e4e1e7] placeholder-[#b9cacb]/40 text-xs focus:outline-none focus:ring-1 focus:ring-[#49effd]/50 font-mono transition-colors"
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
  onUpdateSettings: (newSettings: Record<string, string>) => void;
}

export function StepSettingsForm({
  node,
  allNodes,
  edges = [],
  stepOutputs = {},
  viewMode = 'list',
  onUpdateSettings,
}: StepSettingsFormProps) {
  const settings = node.settings || {};

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

  return (
    <div className="space-y-4">
      {/* Disable this step toggle */}
      <div className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-[#0e0e12] border border-[#2a292e]">
        <div>
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#e4e1e7] block">
            Disable this step
          </span>
          <span className="text-[11px] text-[#b9cacb] block">
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
          <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#b9cacb] block mb-1.5">
            Input Text
          </label>
          <textarea
            rows={3}
            value={settings.text || ''}
            onChange={(e) => handleChange('text', e.target.value)}
            placeholder="Type your initial input text or prompt..."
            className="w-full bg-[#0e0e12] hover:bg-[#131317] focus:bg-[#0e0e12] border border-[#3b494b]/60 focus:border-[#49effd] rounded-lg p-3 text-[#e4e1e7] placeholder-[#b9cacb]/40 text-xs focus:outline-none focus:ring-1 focus:ring-[#49effd]/50 font-mono resize-y transition-colors"
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
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#b9cacb] block mb-1.5">
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
                className="w-full bg-[#0e0e12] hover:bg-[#131317] focus:bg-[#0e0e12] border border-[#3b494b]/60 focus:border-[#49effd] rounded-lg px-3 py-2 text-[#e4e1e7] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#49effd]/50 transition-colors"
              >
                <option value="" className="bg-[#0e0e12]">Use my active AI</option>
                <option value="existing" className="bg-[#0e0e12]">Default Built-in AI</option>
                {configuredProviders.map((provider) => (
                  <option key={provider.id} value={provider.id} className="bg-[#0e0e12]">
                    {provider.name}
                  </option>
                ))}
              </select>
            </div>

            {Boolean(settings.providerId) && settings.providerId !== 'existing' && (
              <div>
                <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#b9cacb] block mb-1.5">
                  Model
                </label>
                <select
                  value={settings.modelId || (selectedProviderModels[0]?.id || '')}
                  onChange={(e) => handleChange('modelId', e.target.value)}
                  className="w-full bg-[#0e0e12] hover:bg-[#131317] focus:bg-[#0e0e12] border border-[#3b494b]/60 focus:border-[#49effd] rounded-lg px-3 py-2 text-[#e4e1e7] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#49effd]/50 transition-colors"
                >
                  {selectedProviderModels.length > 0 ? (
                    selectedProviderModels.map((m) => (
                      <option key={m.id} value={m.id} className="bg-[#0e0e12]">
                        {m.name || m.id}
                      </option>
                    ))
                  ) : (
                    <option value={settings.modelId || ''} className="bg-[#0e0e12]">
                      {settings.modelId || 'Default Model'}
                    </option>
                  )}
                </select>
              </div>
            )}

            <div>
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#b9cacb] block mb-1.5">
                AI Persona Role
              </label>
              <select
                value={settings.role || 'general'}
                onChange={(e) => handleChange('role', e.target.value)}
                className="w-full bg-[#0e0e12] hover:bg-[#131317] focus:bg-[#0e0e12] border border-[#3b494b]/60 focus:border-[#49effd] rounded-lg px-3 py-2 text-[#e4e1e7] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#49effd]/50 transition-colors"
              >
                <option value="general" className="bg-[#0e0e12]">General Assistant (Comprehensive)</option>
                <option value="coder" className="bg-[#0e0e12]">Coder (Clean code & explanations)</option>
                <option value="architect" className="bg-[#0e0e12]">Architect (System structure & trade-offs)</option>
                <option value="dataAnalyst" className="bg-[#0e0e12]">Data Analyst (Steps & quantitative analysis)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#b9cacb] block mb-1.5">
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
                className="w-full bg-[#0e0e12] hover:bg-[#131317] focus:bg-[#0e0e12] border border-[#3b494b]/60 focus:border-[#49effd] rounded-lg px-3 py-2 text-[#e4e1e7] text-xs focus:outline-none focus:ring-1 focus:ring-[#49effd]/50 font-mono tabular-nums transition-colors"
              />
              <p className="text-[10px] font-mono text-[#b9cacb] mt-1">
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
            <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#b9cacb] block mb-1.5">
              Operator Rule
            </label>
            <select
              value={settings.operator || 'contains'}
              onChange={(e) => handleChange('operator', e.target.value)}
              className="w-full bg-[#0e0e12] hover:bg-[#131317] focus:bg-[#0e0e12] border border-[#3b494b]/60 focus:border-[#49effd] rounded-lg px-3 py-2 text-[#e4e1e7] text-xs font-mono focus:outline-none focus:ring-1 focus:ring-[#49effd]/50 transition-colors"
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


