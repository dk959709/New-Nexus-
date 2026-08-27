import React from 'react';
import {
  Compass,
  Globe2,
  ShieldCheck,
  ScanEye,
  Sparkles,
  Boxes,
  BarChart3,
  Image as ImageIcon,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import type { JarvisExecutionStep, JarvisMessage } from '@/types';

interface JarvisPipelineHudTrackerProps {
  message: JarvisMessage;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

interface AgentNodeDef {
  id: string;
  name: string;
  shortLabel: string;
  code: string;
  icon: React.ReactNode;
  color: string;
  glowColor: string;
  isOptional?: boolean;
}

const CORE_AGENTS: AgentNodeDef[] = [
  {
    id: 'planner',
    name: 'Planner',
    shortLabel: 'PLAN',
    code: 'PLN-01',
    icon: <Compass size={13} />,
    color: '#34d399',
    glowColor: 'rgba(52, 211, 153, 0.5)',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    shortLabel: 'RSRCH',
    code: 'RSC-02',
    icon: <Globe2 size={13} />,
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.5)',
  },
  {
    id: 'factChecker',
    name: 'Fact Checker',
    shortLabel: 'FACTS',
    code: 'FCT-03',
    icon: <ShieldCheck size={13} />,
    color: '#c084fc',
    glowColor: 'rgba(192, 132, 252, 0.5)',
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    shortLabel: 'REVIEW',
    code: 'REV-04',
    icon: <ScanEye size={13} />,
    color: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.5)',
  },
  {
    id: 'finalSynthesizer',
    name: 'Synthesizer',
    shortLabel: 'SYNTH',
    code: 'SYN-05',
    icon: <Sparkles size={13} />,
    color: '#fb7185',
    glowColor: 'rgba(251, 113, 133, 0.5)',
  },
];

const OPTIONAL_AGENTS: Record<string, AgentNodeDef> = {
  architect: {
    id: 'architect',
    name: 'Architect',
    shortLabel: 'DIAGRAM',
    code: 'ARC-06',
    icon: <Boxes size={13} />,
    color: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.5)',
    isOptional: true,
  },
  dataAnalyst: {
    id: 'dataAnalyst',
    name: 'Data Analyst',
    shortLabel: 'CHART',
    code: 'DAT-07',
    icon: <BarChart3 size={13} />,
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.5)',
    isOptional: true,
  },
  imageFinder: {
    id: 'imageFinder',
    name: 'Image Finder',
    shortLabel: 'IMAGES',
    code: 'IMG-08',
    icon: <ImageIcon size={13} />,
    color: '#f472b6',
    glowColor: 'rgba(244, 114, 182, 0.5)',
    isOptional: true,
  },
};

export const JarvisPipelineHudTracker: React.FC<JarvisPipelineHudTrackerProps> = ({
  message,
  isExpanded,
  onToggleExpand,
}) => {
  const steps = Array.isArray(message?.steps) ? message.steps : [];

  // Match step helper by agent ID
  const findStep = (agentId: string): JarvisExecutionStep | undefined => {
    return steps.find(
      (s) =>
        s &&
        (s.agentId === agentId ||
          (agentId === 'finalSynthesizer' && s.agentId === 'synthesizer') ||
          (agentId === 'synthesizer' && s.agentId === 'finalSynthesizer')),
    );
  };

  // Build the list of active agents to display in the tracker:
  // 1. All 5 core agents always shown
  const activeNodes: AgentNodeDef[] = [...CORE_AGENTS];

  // 2. Optional agents only added if their respective mode was ON or executed
  if (message?.diagramMode || steps.some((s) => s?.agentId === 'architect')) {
    activeNodes.push(OPTIONAL_AGENTS.architect);
  }
  if (message?.chartMode || steps.some((s) => s?.agentId === 'dataAnalyst')) {
    activeNodes.push(OPTIONAL_AGENTS.dataAnalyst);
  }
  if (message?.imageMode || steps.some((s) => s?.agentId === 'imageFinder')) {
    activeNodes.push(OPTIONAL_AGENTS.imageFinder);
  }

  // 3. Custom agents from pipeline execution steps
  steps.forEach((s) => {
    if (
      s &&
      !activeNodes.some(
        (n) =>
          n.id === s.agentId ||
          (n.id === 'finalSynthesizer' && s.agentId === 'synthesizer') ||
          (n.id === 'synthesizer' && s.agentId === 'finalSynthesizer') ||
          (n.id === 'architect' && s.agentId === 'architect') ||
          (n.id === 'dataAnalyst' && s.agentId === 'dataAnalyst') ||
          (n.id === 'imageFinder' && s.agentId === 'imageFinder'),
      )
    ) {
      const customNode: AgentNodeDef = {
        id: s.agentId,
        name: s.name || 'Custom Agent',
        shortLabel: (s.name || s.agentId).replace(/^custom[_\s-]*/i, '').slice(0, 8) || 'CUSTOM',
        icon: s.icon || '🤖',
        color: '#c084fc',
        glowColor: 'rgba(192, 132, 252, 0.4)',
      };
      const synthIdx = activeNodes.findIndex((n) => n.id === 'finalSynthesizer');
      if (synthIdx >= 0) {
        activeNodes.splice(synthIdx, 0, customNode);
      } else {
        activeNodes.push(customNode);
      }
    }
  });

  // Calculate statistics safely
  const totalDuration = steps.reduce((sum, s) => sum + (s?.durationMs || 0), 0);
  const executedCount = steps.filter((s) => s?.status === 'completed').length;
  const skippedCount = steps.filter((s) => s?.status === 'skipped').length;
  const hasFailed = steps.some((s) => s?.status === 'failed');

  return (
    <div className="w-full mb-4 group select-none">
      <div
        onClick={onToggleExpand}
        className="w-full p-2.5 sm:p-3 rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden backdrop-blur-md"
        style={{
          background: 'linear-gradient(135deg, rgba(6, 18, 36, 0.85) 0%, rgba(10, 16, 44, 0.9) 100%)',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          boxShadow: isExpanded
            ? '0 0 20px rgba(56, 189, 248, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
            : '0 4px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Subtle high-tech grid background overlay */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(56, 189, 248, 0.8) 1px, transparent 0)',
            backgroundSize: '12px 12px',
          }}
        />

        {/* Top Header Row of the HUD Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-2.5 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_8px_rgba(56,189,248,0.4)]">
              <Layers size={11} />
            </div>
            <span className="text-[11px] font-mono font-bold tracking-wider text-cyan-300 uppercase flex items-center gap-1.5">
              <span>PIPELINE HUD TRACKER</span>
              <span className="text-slate-500 text-[10px]">[{activeNodes.length} NODES]</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {totalDuration > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-900/80 border border-slate-700/60 text-[10px] font-mono text-cyan-300">
                <Clock size={10} className="text-cyan-400" />
                <span>{totalDuration}ms</span>
              </span>
            )}
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase transition-colors flex items-center gap-1 ${
                hasFailed
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              }`}
            >
              <CheckCircle2 size={10} />
              <span>{executedCount} RUN</span>
              {skippedCount > 0 && (
                <span className="text-slate-400 font-normal">/ {skippedCount} SKP</span>
              )}
            </span>

            <div className="w-5 h-5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 transition-transform">
              {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </div>
          </div>
        </div>

        {/* Horizontal Node Track Display */}
        <div className="relative z-10 pt-1 pb-0.5">
          {/* Connecting Track Line behind nodes */}
          <div className="absolute top-[18px] left-3 right-3 h-[2px] bg-slate-800/80 pointer-events-none rounded-full" />
          <div
            className="absolute top-[18px] left-3 right-3 h-[2px] pointer-events-none rounded-full opacity-60"
            style={{
              background: 'linear-gradient(90deg, rgba(52,211,153,0.5) 0%, rgba(56,189,248,0.5) 30%, rgba(192,132,252,0.5) 60%, rgba(251,113,133,0.5) 100%)',
            }}
          />

          {/* Node Grid Layout */}
          <div className="flex items-center justify-between gap-1 sm:gap-2 overflow-x-auto no-scrollbar py-1">
            {activeNodes.map((node) => {
              const step = findStep(node.id);
              const status = step?.status || 'skipped';
              const isCompleted = status === 'completed';
              const isRunning = status === 'running';
              const isFailed = status === 'failed';
              const isSkipped = status === 'skipped';

              return (
                <div
                  key={node.id}
                  className="flex flex-col items-center gap-1.5 shrink-0 relative z-10 group/node"
                  style={{ minWidth: '46px' }}
                  title={`${node.name}: ${status.toUpperCase()}${step?.durationMs ? ` (${step.durationMs}ms)` : ''}`}
                >
                  {/* Visual Node Orb */}
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all duration-300 relative"
                    style={{
                      background: isCompleted
                        ? `linear-gradient(135deg, ${node.color}33 0%, rgba(6, 18, 36, 0.95) 100%)`
                        : isRunning
                        ? 'rgba(56, 189, 248, 0.25)'
                        : isFailed
                        ? 'rgba(244, 63, 94, 0.2)'
                        : 'rgba(15, 23, 42, 0.85)',
                      border: isCompleted
                        ? `1.5px solid ${node.color}`
                        : isRunning
                        ? '1.5px solid #38bdf8'
                        : isFailed
                        ? '1.5px solid #f43f5e'
                        : '1px dashed rgba(148, 163, 184, 0.3)',
                      boxShadow: isCompleted
                        ? `0 0 12px ${node.glowColor}`
                        : isRunning
                        ? '0 0 12px rgba(56,189,248,0.5)'
                        : isFailed
                        ? '0 0 10px rgba(244,63,94,0.4)'
                        : 'none',
                      color: isCompleted
                        ? node.color
                        : isRunning
                        ? '#38bdf8'
                        : isFailed
                        ? '#f43f5e'
                        : '#64748b',
                    }}
                  >
                    {/* Status Pip Dot */}
                    {isCompleted && (
                      <span
                        className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full border border-slate-950"
                        style={{
                          backgroundColor: node.color,
                          boxShadow: `0 0 6px ${node.color}`,
                        }}
                      />
                    )}
                    {isFailed && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-rose-500 border border-slate-950 shadow-[0_0_6px_#f43f5e]" />
                    )}

                    {/* Icon */}
                    <span className="scale-90 sm:scale-100">{node.icon}</span>
                  </div>

                  {/* Node Label & Code */}
                  <div className="flex flex-col items-center text-center">
                    <span
                      className="text-[9px] sm:text-[10px] font-mono font-bold tracking-tight uppercase"
                      style={{
                        color: isCompleted
                          ? node.color
                          : isRunning
                          ? '#38bdf8'
                          : isFailed
                          ? '#fb7185'
                          : '#64748b',
                      }}
                    >
                      {node.shortLabel}
                    </span>
                    <span className="text-[8px] font-mono text-slate-500 hidden sm:inline">
                      {isCompleted ? (step?.durationMs ? `${step.durationMs}ms` : '✓') : isSkipped ? 'OFF' : status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
