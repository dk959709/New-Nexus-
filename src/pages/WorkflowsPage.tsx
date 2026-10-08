import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type {
  Workflow,
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowStepStatus,
  WorkflowOutput,
} from '@/types';
import { storage } from '@/lib/storage';
import { runWorkflow, hasWorkflowCycle } from '@/lib/workflowEngine';
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
  const [showAddMenu, setShowAddMenu] = useState<boolean>(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  // Delete current workflow
  const handleDeleteCurrent = () => {
    if (!activeWorkflow) return;
    if (workflows.length <= 1) {
      alert('You cannot delete the only workflow. Create another one first.');
      return;
    }
    const confirmed = window.confirm(`Delete workflow "${activeWorkflow.name}"?`);
    if (!confirmed) return;

    const remaining = workflows.filter((w) => w.id !== activeWorkflow.id);
    setWorkflows(remaining);
    setActiveWorkflowId(remaining[0].id);
    setSelectedNodeId(null);
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
    setStepErrors({});
    setLastExecutedNodeId(null);
    setRunLogs([]);
  };

  // Run workflow
  const handleRun = async () => {
    if (!activeWorkflow || isRunning) return;
    setIsRunning(true);
    stopRequestedRef.current = false;
    handleClearResults();

    const nodeMap = new Map<string, WorkflowNode>();
    for (const n of activeWorkflow.nodes) nodeMap.set(n.id, n);

    stepStartTimesRef.current = {};

    try {
      await runWorkflow(activeWorkflow, {
        shouldStop: () => stopRequestedRef.current,
        onStatus: (nodeId, status, output, errorText) => {
          setStepStatuses((prev) => ({ ...prev, [nodeId]: status }));

          if (status === 'running') {
            stepStartTimesRef.current[nodeId] = Date.now();
          }

          if (output) {
            setStepOutputs((prev) => ({ ...prev, [nodeId]: output }));
            setLastExecutedNodeId(nodeId);
          }

          if (errorText) {
            setStepErrors((prev) => ({ ...prev, [nodeId]: errorText }));
          }

          if (status === 'done' || status === 'error') {
            const startT = stepStartTimesRef.current[nodeId] || Date.now();
            const duration = Date.now() - startT;
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
      });
    } catch (err: unknown) {
      console.error('Workflow execution error:', err);
      showToast(`Workflow error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsRunning(false);
    }
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

  // Update node settings / label
  const handleUpdateNode = (
    nodeId: string,
    field: 'label' | 'settings',
    value: string | Record<string, string>,
  ) => {
    updateCurrentWorkflow((wf) => ({
      ...wf,
      nodes: wf.nodes.map((n) => {
        if (n.id === nodeId) {
          if (field === 'label') return { ...n, label: value as string };
          if (field === 'settings') return { ...n, settings: value as Record<string, string> };
        }
        return n;
      }),
    }));
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
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400">
        <Loader2 className="animate-spin text-cyan-400 mb-2" />
        <p>Initializing workflows...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-20 animate-in fade-in duration-300">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-4 sm:right-8 z-50 bg-slate-900/95 border border-cyan-500/40 text-cyan-200 text-xs font-mono px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-xl flex items-center gap-2 animate-in slide-in-from-top-2">
          <Sparkles size={14} className="text-cyan-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header & Intro */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] font-mono uppercase tracking-wider">
              WORKFLOW ORCHESTRATOR
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1 flex items-center gap-2">
            <GitBranch className="text-cyan-400" size={26} />
            Workflows
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
            Build autonomous multi-step pipelines with web search, academic scholar data, AI synthesis, and image generation.
          </p>
        </div>

        {/* Top Controls: Run / Stop / Clear */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setShowTemplatesModal(true)}
            className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-medium transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Sparkles size={14} className="text-purple-400" />
            <span>Templates</span>
          </button>

          <button
            type="button"
            onClick={handleClearResults}
            disabled={isRunning}
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
            title="Clear previous outputs & step statuses"
          >
            <RotateCcw size={13} />
            <span className="hidden sm:inline">Clear</span>
          </button>

          {isRunning ? (
            <button
              type="button"
              onClick={handleStop}
              className="px-4 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-xs font-semibold transition-all flex items-center gap-2 shadow-lg shadow-rose-500/10 animate-pulse"
            >
              <Square size={13} className="fill-rose-400" />
              <span>Stop</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleRun}
              className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-95"
            >
              <Play size={14} className="fill-slate-950" />
              <span>Run</span>
            </button>
          )}
        </div>
      </div>

      {/* Workflow Switcher & Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 border border-white/10 p-3 rounded-2xl backdrop-blur-md">
        {/* Left: Workflow Selector & Management */}
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Picker */}
          <div className="relative">
            <select
              value={activeWorkflow.id}
              onChange={(e) => {
                setActiveWorkflowId(e.target.value);
                setSelectedNodeId(null);
                handleClearResults();
              }}
              className="appearance-none bg-slate-950/80 border border-white/10 text-white font-medium text-xs rounded-xl pl-3 pr-8 py-2 focus:outline-none focus:border-cyan-500 transition-colors cursor-pointer"
            >
              {workflows.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.nodes.length} steps)
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
          </div>

          {/* New Workflow */}
          <button
            type="button"
            onClick={handleCreateNew}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
            title="Create new blank workflow"
          >
            <Plus size={15} />
          </button>

          {/* Rename Workflow */}
          {isRenaming ? (
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                className="bg-slate-950 border border-cyan-500/50 text-white text-xs px-2.5 py-1.5 rounded-lg focus:outline-none w-36"
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
                className="p-1.5 rounded-lg bg-cyan-500 text-slate-950 hover:bg-cyan-400"
              >
                <Check size={13} />
              </button>
              <button
                type="button"
                onClick={() => setIsRenaming(false)}
                className="p-1.5 rounded-lg bg-white/10 text-slate-300 hover:bg-white/20"
              >
                <X size={13} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRenameDraft(activeWorkflow.name);
                setIsRenaming(true);
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
              title="Rename workflow"
            >
              <Edit2 size={14} />
            </button>
          )}

          {/* Duplicate */}
          <button
            type="button"
            onClick={handleDuplicate}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
            title="Duplicate workflow"
          >
            <Copy size={14} />
          </button>

          {/* Delete */}
          <button
            type="button"
            onClick={handleDeleteCurrent}
            className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 transition-colors"
            title="Delete current workflow"
          >
            <Trash2 size={14} />
          </button>
        </div>

        {/* Right: Segmented Switch: List | Canvas */}
        <div className="flex items-center self-end sm:self-auto bg-slate-950/80 p-1 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              viewMode === 'list'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers size={13} />
            <span>List</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('canvas')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              viewMode === 'canvas'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <GitBranch size={13} />
            <span>Canvas</span>
          </button>
        </div>
      </div>

      {/* Main View Area */}
      {viewMode === 'list' ? (
        /* ================= LIST VIEW ================= */
        <div className="space-y-4">
          {/* Branching Notice Banner */}
          {hasBranches && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2.5">
              <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
              <span>
                <b>This workflow has branches.</b> Reordering steps is managed in <b>Canvas</b> view to maintain graph integrity. You can still edit step settings below.
              </span>
            </div>
          )}

          {/* List of Step Cards */}
          <div className="space-y-3">
            {activeWorkflow.nodes.map((node, index) => {
              const cfg = NODE_CONFIG[node.type] || NODE_CONFIG.input;
              const IconComp = cfg.icon;
              const status = stepStatuses[node.id] || 'idle';
              const output = stepOutputs[node.id];
              const errorText = stepErrors[node.id];
              const isSettingsOpen = !collapsedSettings[node.id];
              const isOutputOpen = !collapsedOutputs[node.id];

              return (
                <div
                  key={node.id}
                  className={`rounded-2xl bg-slate-900/80 border transition-all duration-200 overflow-hidden shadow-lg ${
                    status === 'running'
                      ? 'border-cyan-500/60 ring-1 ring-cyan-500/30'
                      : status === 'error'
                      ? 'border-rose-500/60'
                      : status === 'done'
                      ? 'border-emerald-500/40'
                      : 'border-white/10 hover:border-white/15'
                  }`}
                >
                  {/* Card Header Bar */}
                  <div className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/[0.02]">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Step Number */}
                      <span className="w-6 h-6 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs font-mono flex items-center justify-center flex-shrink-0">
                        {index + 1}
                      </span>

                      {/* Type Icon */}
                      <div className={`p-2 rounded-xl border flex-shrink-0 ${cfg.color}`}>
                        <IconComp size={16} />
                      </div>

                      {/* Editable Label */}
                      <div className="min-w-0">
                        <input
                          type="text"
                          value={node.label}
                          onChange={(e) => handleUpdateNode(node.id, 'label', e.target.value)}
                          className="bg-transparent hover:bg-white/5 focus:bg-slate-950 font-semibold text-white text-sm sm:text-base rounded px-1.5 py-0.5 border border-transparent focus:border-cyan-500/50 outline-none w-full max-w-[200px] sm:max-w-[320px] truncate"
                          title="Click to rename step"
                        />
                        <span className="text-[11px] text-slate-400 font-mono block pl-1.5">
                          {cfg.label}
                        </span>
                      </div>
                    </div>

                    {/* Right side badges & actions */}
                    <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                      {/* Status badge */}
                      <div className="flex-shrink-0">
                        {status === 'running' && (
                          <span className="px-2.5 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-[11px] font-medium flex items-center gap-1.5">
                            <Loader2 size={12} className="animate-spin" />
                            <span>Running</span>
                          </span>
                        )}
                        {status === 'done' && (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[11px] font-medium flex items-center gap-1.5">
                            <CheckCircle2 size={12} />
                            <span>Done</span>
                          </span>
                        )}
                        {status === 'error' && (
                          <span className="px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-medium flex items-center gap-1.5">
                            <AlertCircle size={12} />
                            <span>Error</span>
                          </span>
                        )}
                        {status === 'skipped' && (
                          <span className="px-2.5 py-1 rounded-full bg-slate-800 border border-white/10 text-slate-400 text-[11px] font-medium flex items-center gap-1.5">
                            <MinusCircle size={12} />
                            <span>Skipped</span>
                          </span>
                        )}
                        {status === 'idle' && (
                          <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-500 text-[11px] font-mono">
                            Idle
                          </span>
                        )}
                      </div>

                      {/* Move Up / Move Down */}
                      <button
                        type="button"
                        onClick={() => handleMoveNodeUp(index)}
                        disabled={hasBranches || index === 0}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={hasBranches ? 'Reordering disabled for branching workflows' : 'Move step up'}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveNodeDown(index)}
                        disabled={hasBranches || index === activeWorkflow.nodes.length - 1}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                        title={hasBranches ? 'Reordering disabled for branching workflows' : 'Move step down'}
                      >
                        <ArrowDown size={14} />
                      </button>

                      {/* Delete Step */}
                      <button
                        type="button"
                        onClick={() => handleDeleteNode(node.id)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-white/10 transition-colors"
                        title="Delete step"
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
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors ml-1"
                        title="Toggle settings panel"
                      >
                        {isSettingsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                    </div>
                  </div>

                  {/* Card Body: Settings Form */}
                  {isSettingsOpen && (
                    <div className="p-4 border-t border-white/5 bg-slate-950/40 space-y-3">
                      <StepSettingsForm
                        node={node}
                        allNodes={activeWorkflow.nodes}
                        onUpdateSettings={(newSettings) =>
                          handleUpdateNode(node.id, 'settings', newSettings)
                        }
                      />
                    </div>
                  )}

                  {/* Output Callout / Box */}
                  {(output || errorText) && (
                    <div className="border-t border-white/5 p-3.5 bg-black/40">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                          <span>Output result</span>
                          {output?.type && (
                            <span className="text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20">
                              {output.type}
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          {output?.type === 'text' && (
                            <button
                              type="button"
                              onClick={() => handleCopyText(output.value, `out-${node.id}`)}
                              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 px-2 py-0.5 rounded bg-white/5 hover:bg-white/10"
                            >
                              {copiedKey === `out-${node.id}` ? (
                                <>
                                  <Check size={11} className="text-emerald-400" />
                                  <span>Copied</span>
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
                            className="text-slate-400 hover:text-white"
                          >
                            {isOutputOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {isOutputOpen && (
                        <div>
                          {errorText && (
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                              {errorText}
                            </div>
                          )}
                          {output?.type === 'text' && (
                            <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap break-words max-h-56 overflow-y-auto p-3 rounded-xl bg-slate-950/70 border border-white/5">
                              {output.value}
                            </pre>
                          )}
                          {output?.type === 'image' && (
                            <div className="mt-2 rounded-xl overflow-hidden border border-white/10 max-w-sm">
                              <img
                                src={output.value}
                                alt="Workflow output"
                                className="w-full object-cover max-h-64"
                              />
                              <div className="p-2 bg-slate-900/90 flex justify-end">
                                <a
                                  href={output.value}
                                  download="workflow-image.png"
                                  target="_blank"
                                  rel="noreferrer"
                                  className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold rounded-lg flex items-center gap-1.5"
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
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Step Button Bar */}
          <div className="relative pt-2">
            <button
              type="button"
              onClick={() => setShowAddMenu((v) => !v)}
              className="w-full py-3.5 rounded-2xl border-2 border-dashed border-white/15 hover:border-cyan-500/50 bg-slate-900/40 hover:bg-slate-900/70 text-slate-300 hover:text-cyan-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm group"
            >
              <Plus size={16} className="group-hover:rotate-90 transition-transform" />
              <span>Add Step to Workflow</span>
            </button>

            {/* Node type selection dropdown */}
            {showAddMenu && (
              <div className="absolute left-0 right-0 top-full mt-2 z-30 bg-slate-900/95 border border-white/15 rounded-2xl p-3 shadow-2xl backdrop-blur-xl grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(Object.keys(NODE_CONFIG) as WorkflowNodeType[]).map((type) => {
                  const item = NODE_CONFIG[type];
                  const Icon = item.icon;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => handleAddStep(type)}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-cyan-500/30 text-left transition-all"
                    >
                      <div className={`p-2 rounded-lg border ${item.color}`}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{item.label}</div>
                        <div className="text-[10px] text-slate-400 truncate">{item.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ================= CANVAS VIEW ================= */
        <div className="relative w-full h-[640px] rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-slate-950">
          <WorkflowCanvas
            nodes={activeWorkflow.nodes}
            edges={activeWorkflow.edges}
            stepStatuses={stepStatuses}
            stepOutputs={stepOutputs}
            isRunning={isRunning}
            selectedNodeId={selectedNodeId}
            onSelectNode={(nodeId) => {
              if (connectSourceNodeId && nodeId && connectSourceNodeId !== nodeId) {
                // Phone connect mode destination selection!
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
          />

          {/* Floating Canvas Controls: Add Node Button */}
          <div className="absolute bottom-5 left-5 z-20">
            <button
              type="button"
              onClick={() => setShowAddMenu((v) => !v)}
              className="px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-xl shadow-cyan-500/25 transition-all active:scale-95"
            >
              <Plus size={16} />
              <span>Add Node</span>
            </button>

            {/* Canvas Node Palette Dropdown */}
            {showAddMenu && (
              <div className="absolute left-0 bottom-full mb-3 w-80 bg-slate-900/95 border border-white/15 rounded-2xl p-3 shadow-2xl backdrop-blur-xl grid grid-cols-1 gap-1.5 max-h-96 overflow-y-auto">
                <div className="text-[11px] font-mono text-slate-400 px-2 py-1 uppercase tracking-wider">
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
                      className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 hover:border-cyan-500/30 text-left transition-all"
                    >
                      <div className={`p-1.5 rounded-lg border ${item.color}`}>
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{item.label}</div>
                        <div className="text-[10px] text-slate-400 truncate">{item.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Phone Connect Mode Prompt Banner */}
          {connectSourceNodeId && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-cyan-500 text-slate-950 font-semibold text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in">
              <span>Tap a target node to connect</span>
              <button
                type="button"
                onClick={() => setConnectSourceNodeId(null)}
                className="bg-slate-950/20 hover:bg-slate-950/40 p-1 rounded-md"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* Branch choice popup if source is IF in connect mode */}
          {connectBranchPrompt && (
            <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-white/15 rounded-2xl p-5 max-w-xs w-full shadow-2xl text-center space-y-4">
                <h4 className="text-sm font-bold text-white">Choose Branch for Condition</h4>
                <p className="text-xs text-slate-400">
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
                    className="flex-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs"
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
                    className="flex-1 py-2 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-bold text-xs"
                  >
                    NO Branch
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setConnectBranchPrompt(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Canvas Node Inspector Drawer / Bottom Sheet */}
          {selectedNode && (
            <div className="absolute right-0 top-0 bottom-0 w-full sm:w-96 z-30 bg-slate-900/95 border-l border-white/10 shadow-2xl backdrop-blur-2xl p-5 flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div
                      className={`p-1.5 rounded-lg border ${
                        NODE_CONFIG[selectedNode.type]?.color
                      }`}
                    >
                      {React.createElement(NODE_CONFIG[selectedNode.type]?.icon || Sparkles, {
                        size: 15,
                      })}
                    </div>
                    <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                      {NODE_CONFIG[selectedNode.type]?.label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedNodeId(null)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white bg-white/5"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Step Label */}
                <div>
                  <label className="text-xs font-medium text-slate-400 block mb-1">
                    Step Name / Label
                  </label>
                  <input
                    type="text"
                    value={selectedNode.label}
                    onChange={(e) =>
                      handleUpdateNode(selectedNode.id, 'label', e.target.value)
                    }
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Step Form */}
                <StepSettingsForm
                  node={selectedNode}
                  allNodes={activeWorkflow.nodes}
                  onUpdateSettings={(newSettings) =>
                    handleUpdateNode(selectedNode.id, 'settings', newSettings)
                  }
                />

                {/* Connect mode for phones */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConnectSourceNodeId(selectedNode.id);
                      showToast('Connect mode active: Tap target node');
                    }}
                    className="w-full py-2.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <GitBranch size={14} />
                    <span>Connect to another node</span>
                  </button>
                </div>

                {/* Last Output (if any) */}
                {stepOutputs[selectedNode.id] && (
                  <div className="pt-2 border-t border-white/10 space-y-1">
                    <span className="text-xs font-mono text-slate-400">Recent Output</span>
                    {stepOutputs[selectedNode.id].type === 'image' ? (
                      <img
                        src={stepOutputs[selectedNode.id].value}
                        alt="Output"
                        className="rounded-xl border border-white/10 max-h-40 object-cover w-full"
                      />
                    ) : (
                      <pre className="text-[11px] font-mono text-slate-300 bg-slate-950 p-2.5 rounded-xl border border-white/5 max-h-36 overflow-y-auto whitespace-pre-wrap">
                        {stepOutputs[selectedNode.id].value}
                      </pre>
                    )}
                  </div>
                )}
              </div>

              {/* Delete Node in Drawer */}
              <div className="pt-6 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => handleDeleteNode(selectedNode.id)}
                  className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <Trash2 size={14} />
                  <span>Delete This Step</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================= RESULT CARD ================= */}
      <div className="rounded-2xl bg-slate-900/80 border border-white/10 p-5 backdrop-blur-xl shadow-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-sm font-bold text-white tracking-tight">Final Result</h3>
            {lastExecutedNode && (
              <span className="text-xs font-mono text-slate-400">
                from step "{lastExecutedNode.label}"
              </span>
            )}
          </div>
          {lastExecutedOutput?.type === 'text' && (
            <button
              type="button"
              onClick={() => handleCopyText(lastExecutedOutput.value, 'final-result')}
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              {copiedKey === 'final-result' ? (
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
        </div>

        {lastExecutedOutput ? (
          <div>
            {lastExecutedOutput.type === 'text' && (
              <pre className="text-xs sm:text-sm text-slate-200 font-mono whitespace-pre-wrap break-words p-4 rounded-xl bg-slate-950/80 border border-white/5 max-h-80 overflow-y-auto">
                {lastExecutedOutput.value}
              </pre>
            )}
            {lastExecutedOutput.type === 'image' && (
              <div className="space-y-3">
                <div className="rounded-xl overflow-hidden border border-white/10 max-w-md">
                  <img
                    src={lastExecutedOutput.value}
                    alt="Final synthesis"
                    className="w-full object-cover max-h-96"
                  />
                </div>
                <a
                  href={lastExecutedOutput.value}
                  download="nexus-workflow-result.png"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition-all shadow-md shadow-cyan-500/20"
                >
                  <Download size={14} />
                  <span>Download Image</span>
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500">
            Results from the workflow execution will appear here once you click <b>Run</b>.
          </div>
        )}
      </div>

      {/* ================= RUN LOG ================= */}
      {runLogs.length > 0 && (
        <div className="rounded-2xl bg-slate-900/60 border border-white/10 p-5 space-y-3 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
              Execution Log ({runLogs.length} steps)
            </h3>
            <button
              type="button"
              onClick={() => setRunLogs([])}
              className="text-[11px] text-slate-500 hover:text-slate-300"
            >
              Clear Log
            </button>
          </div>

          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {runLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-white/5 text-xs font-mono"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {log.status === 'done' ? (
                    <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0" />
                  ) : (
                    <AlertCircle size={13} className="text-rose-400 flex-shrink-0" />
                  )}
                  <span className="font-semibold text-white truncate">{log.label}</span>
                  <span className="text-[10px] text-slate-500 hidden sm:inline">({log.type})</span>
                </div>
                <div className="flex items-center gap-3 text-slate-400 flex-shrink-0">
                  <span>{log.durationMs}ms</span>
                  <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TEMPLATES MODAL ================= */}
      {showTemplatesModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/15 rounded-3xl max-w-xl w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Sparkles size={18} className="text-purple-400" />
                  Workflow Templates
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Load ready-to-run workflows with built-in configurations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplatesModal(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-white/5"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {DEFAULT_WORKFLOW_TEMPLATES.map((tmpl) => (
                <div
                  key={tmpl.name}
                  className="p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 hover:border-cyan-500/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <h4 className="text-sm font-bold text-white">{tmpl.name}</h4>
                    <p className="text-xs text-slate-400">{tmpl.description}</p>
                    <div className="flex items-center gap-1.5 pt-1 text-[11px] font-mono text-cyan-400">
                      <span>{tmpl.nodes.length} nodes</span>
                      <span>·</span>
                      <span>{tmpl.edges.length} connections</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex-shrink-0 transition-all shadow-md shadow-cyan-500/20"
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

/**
 * Shared StepSettingsForm component for configuring node properties
 */
interface StepSettingsFormProps {
  node: WorkflowNode;
  allNodes: WorkflowNode[];
  onUpdateSettings: (newSettings: Record<string, string>) => void;
}

export function StepSettingsForm({
  node,
  allNodes,
  onUpdateSettings,
}: StepSettingsFormProps) {
  const settings = node.settings || {};

  const handleChange = (field: string, val: string) => {
    onUpdateSettings({ ...settings, [field]: val });
  };

  // Find previous steps available for {{Placeholder}} injection
  const priorNodes = allNodes.filter((n) => n.id !== node.id);

  return (
    <div className="space-y-3.5">
      {/* Node Type Specific Inputs */}
      {node.type === 'input' && (
        <div>
          <label className="text-xs font-medium text-slate-300 block mb-1">
            Input Text
          </label>
          <textarea
            rows={3}
            value={settings.text || ''}
            onChange={(e) => handleChange('text', e.target.value)}
            placeholder="Type your initial input text or prompt..."
            className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono resize-y"
          />
        </div>
      )}

      {node.type === 'webSearch' && (
        <div>
          <label className="text-xs font-medium text-slate-300 block mb-1">
            Search Query
          </label>
          <input
            type="text"
            value={settings.query || ''}
            onChange={(e) => handleChange('query', e.target.value)}
            placeholder="e.g. {{Input.output}} latest discoveries"
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      )}

      {node.type === 'webFetch' && (
        <div>
          <label className="text-xs font-medium text-slate-300 block mb-1">
            Webpage Target URL
          </label>
          <input
            type="text"
            value={settings.url || ''}
            onChange={(e) => handleChange('url', e.target.value)}
            placeholder="https://en.wikipedia.org/wiki/James_Webb_Space_Telescope"
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      )}

      {node.type === 'scholar' && (
        <div>
          <label className="text-xs font-medium text-slate-300 block mb-1">
            Academic Topic Query
          </label>
          <input
            type="text"
            value={settings.query || ''}
            onChange={(e) => handleChange('query', e.target.value)}
            placeholder="e.g. {{Input.output}}"
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      )}

      {node.type === 'ai' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              AI Persona Role
            </label>
            <select
              value={settings.role || 'general'}
              onChange={(e) => handleChange('role', e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-medium"
            >
              <option value="general">General Assistant (Comprehensive)</option>
              <option value="coder">Coder (Clean code & explanations)</option>
              <option value="architect">Architect (System structure & trade-offs)</option>
              <option value="dataAnalyst">Data Analyst (Steps & quantitative analysis)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Prompt Instructions
            </label>
            <textarea
              rows={4}
              value={settings.prompt || ''}
              onChange={(e) => handleChange('prompt', e.target.value)}
              placeholder="e.g. Summarize in simple English with bullet points: {{Web Search.output}}"
              className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono resize-y"
            />
          </div>
        </div>
      )}

      {node.type === 'image' && (
        <div>
          <label className="text-xs font-medium text-slate-300 block mb-1">
            Image Prompt
          </label>
          <textarea
            rows={3}
            value={settings.prompt || ''}
            onChange={(e) => handleChange('prompt', e.target.value)}
            placeholder="e.g. {{AI.output}}"
            className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono resize-y"
          />
        </div>
      )}

      {node.type === 'weather' && (
        <div>
          <label className="text-xs font-medium text-slate-300 block mb-1">
            City Name
          </label>
          <input
            type="text"
            value={settings.city || ''}
            onChange={(e) => handleChange('city', e.target.value)}
            placeholder="e.g. London, Tokyo, San Francisco"
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
          />
        </div>
      )}

      {node.type === 'nasa' && (
        <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs flex items-center gap-2">
          <Rocket size={15} className="text-cyan-400 flex-shrink-0" />
          <span>
            Fetches the latest Astronomy Picture of the Day (APOD) directly from NASA telemetry. No fields required.
          </span>
        </div>
      )}

      {node.type === 'if' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Test Value (Value 1)
            </label>
            <input
              type="text"
              value={settings.value1 || ''}
              onChange={(e) => handleChange('value1', e.target.value)}
              placeholder="e.g. {{AI.output}}"
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 block mb-1">
              Operator Rule
            </label>
            <select
              value={settings.operator || 'contains'}
              onChange={(e) => handleChange('operator', e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-medium"
            >
              <option value="contains">Contains</option>
              <option value="notContains">Does not contain</option>
              <option value="equals">Equals</option>
              <option value="isEmpty">Is empty</option>
              <option value="isNotEmpty">Is not empty</option>
              <option value="lengthGreaterThan">Length greater than</option>
              <option value="lengthLessThan">Length less than</option>
            </select>
          </div>

          {settings.operator !== 'isEmpty' && settings.operator !== 'isNotEmpty' && (
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                Comparison Target (Value 2)
              </label>
              <input
                type="text"
                value={settings.value2 || ''}
                onChange={(e) => handleChange('value2', e.target.value)}
                placeholder="Target value or number..."
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>
          )}
        </div>
      )}

      {/* Placeholders Help & Quick Insert Pills */}
      {node.type !== 'nasa' && (
        <div className="pt-2 border-t border-white/5 space-y-2">
          <p className="text-[11px] text-slate-400 font-mono">
            💡 Use <code className="text-cyan-400 bg-cyan-500/10 px-1 py-0.5 rounded">{'{{Step label.output}}'}</code> to inject an earlier result.
          </p>

          {priorNodes.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-mono">
                Click to copy placeholder:
              </span>
              {priorNodes.map((p) => {
                const tag = `{{${p.label}.output}}`;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(tag);
                    }}
                    className="text-[10px] font-mono text-cyan-300 bg-white/5 hover:bg-cyan-500/20 px-2 py-0.5 rounded-lg border border-white/10 hover:border-cyan-500/30 transition-colors"
                    title={`Click to copy ${tag}`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
