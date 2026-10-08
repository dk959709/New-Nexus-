import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  BackgroundVariant,
  type Node,
  type Edge,
  type Connection,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {
  WorkflowNode,
  WorkflowEdge,
  WorkflowNodeType,
  WorkflowStepStatus,
  WorkflowOutput,
} from '@/types';
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
} from 'lucide-react';

export interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  stepStatuses: Record<string, WorkflowStepStatus>;
  stepOutputs: Record<string, WorkflowOutput>;
  isRunning: boolean;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string | null) => void;
  onUpdateNodesPosition: (updated: Array<{ id: string; x: number; y: number }>) => void;
  onConnect: (connection: Connection) => void;
  onDeleteEdge: (edgeId: string) => void;
  onTidy: () => void;
}

export const NODE_CONFIG: Record<
  WorkflowNodeType,
  { label: string; icon: React.ComponentType<{ size?: number; className?: string }>; color: string; desc: string }
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

interface NodeDataPayload {
  label: string;
  type: WorkflowNodeType;
  status: WorkflowStepStatus;
  isSelected: boolean;
  outputPreview?: string;
  onDeleteNode?: (id: string) => void;
}

/**
 * Custom Canvas Node Component
 */
function CustomWorkflowNodeComponent({ data }: NodeProps<Node<NodeDataPayload>>) {
  const { label, type, status, isSelected, outputPreview } = data;
  const cfg = NODE_CONFIG[type] || NODE_CONFIG.input;
  const IconComponent = cfg.icon;

  const isInput = type === 'input';
  const isIf = type === 'if';

  return (
    <div
      className={`relative rounded-2xl bg-slate-900/95 border backdrop-blur-xl shadow-xl transition-all duration-200 select-none min-w-[210px] max-w-[260px] p-3.5 ${
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
      {/* Target handle on Left (unless input node) */}
      {!isInput && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-4 !h-4 !-left-2 !bg-cyan-400 hover:!scale-125 !border-2 !border-slate-950 !transition-transform cursor-crosshair"
          title="Connect input to this step"
        />
      )}

      {/* Node Header */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg border flex-shrink-0 ${cfg.color}`}>
            <IconComponent size={15} />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-white truncate leading-tight">{label}</h4>
            <span className="text-[10px] text-slate-400 font-mono block truncate">{cfg.label}</span>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex-shrink-0">
          {status === 'running' && (
            <div className="flex items-center gap-1 text-[10px] text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded-full border border-cyan-500/30 font-medium">
              <Loader2 size={11} className="animate-spin" />
            </div>
          )}
          {status === 'done' && (
            <div className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
              <CheckCircle2 size={12} />
            </div>
          )}
          {status === 'error' && (
            <div className="text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded-full border border-rose-500/30">
              <AlertCircle size={12} />
            </div>
          )}
          {status === 'skipped' && (
            <div className="text-slate-400 bg-white/5 px-1.5 py-0.5 rounded-full border border-white/10" title="Skipped">
              <MinusCircle size={12} />
            </div>
          )}
          {(!status || status === 'idle') && (
            <div className="w-2 h-2 rounded-full bg-slate-600" />
          )}
        </div>
      </div>

      {/* Output preview snippet if available */}
      {outputPreview && (
        <div className="mt-1 pt-1.5 border-t border-white/5 text-[10px] text-slate-400 font-mono truncate">
          {outputPreview}
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
}

const nodeTypes = {
  workflowNode: CustomWorkflowNodeComponent,
};

export function WorkflowCanvas({
  nodes,
  edges,
  stepStatuses,
  stepOutputs,
  isRunning,
  selectedNodeId,
  onSelectNode,
  onUpdateNodesPosition,
  onConnect,
  onDeleteEdge,
  onTidy,
}: WorkflowCanvasProps) {
  // Convert workflow nodes to ReactFlow nodes
  const rfNodes = useMemo<Node<NodeDataPayload>[]>(() => {
    return nodes.map((n) => {
      const out = stepOutputs[n.id]?.value;
      const snippet = out ? (out.length > 35 ? out.slice(0, 35) + '...' : out) : undefined;
      return {
        id: n.id,
        type: 'workflowNode',
        position: { x: n.x, y: n.y },
        data: {
          label: n.label,
          type: n.type,
          status: stepStatuses[n.id] || 'idle',
          isSelected: selectedNodeId === n.id,
          outputPreview: snippet,
        },
      };
    });
  }, [nodes, stepStatuses, stepOutputs, selectedNodeId]);

  // Convert workflow edges to ReactFlow edges
  const rfEdges = useMemo<Edge[]>(() => {
    return edges.map((e) => {
      const isYes = e.branch === 'yes';
      const isNo = e.branch === 'no';
      const edgeColor = isYes ? '#10b981' : isNo ? '#f43f5e' : '#06b6d4';

      return {
        id: e.id,
        source: e.from,
        target: e.to,
        sourceHandle: e.branch || 'default',
        animated: isRunning,
        label: e.branch ? e.branch.toUpperCase() : undefined,
        labelStyle: {
          fill: edgeColor,
          fontWeight: 700,
          fontSize: 10,
        },
        labelBgStyle: {
          fill: '#020617',
          fillOpacity: 0.85,
        },
        labelBgPadding: [4, 2] as [number, number],
        labelBgBorderRadius: 4,
        style: {
          stroke: edgeColor,
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: edgeColor,
          width: 16,
          height: 16,
        },
      };
    });
  }, [edges, isRunning]);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onSelectNode(node.id);
    },
    [onSelectNode],
  );

  const handlePaneClick = useCallback(() => {
    onSelectNode(null);
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
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        onNodeDragStop={handleNodeDragStop}
        onConnect={onConnect}
        onEdgeClick={handleEdgeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
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
