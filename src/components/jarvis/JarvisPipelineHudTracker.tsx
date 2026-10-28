import React from 'react';
import {
  Compass,
  Globe2,
  Lightbulb,
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
  Code2,
  RefreshCw,
  Hourglass,
} from 'lucide-react';
import type { ParallaxTheme } from '@/components/parallax/ParallaxSettings';
import type { JarvisExecutionStep, JarvisMessage } from '@/types';

interface JarvisPipelineHudTrackerProps {
  message: JarvisMessage;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isRunning?: boolean;
  theme?: ParallaxTheme;
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
    icon: <Compass size={12} />,
    color: '#34d399',
    glowColor: 'rgba(52, 211, 153, 0.5)',
  },
  {
    id: 'researcher',
    name: 'Researcher',
    shortLabel: 'RSRCH',
    code: 'RSC-02',
    icon: <Globe2 size={12} />,
    color: '#d99b64',
    glowColor: 'rgba(180, 115, 60, 0.5)',
  },
  {
    id: 'factChecker',
    name: 'Fact Checker',
    shortLabel: 'FACTS',
    code: 'FCT-03',
    icon: <ShieldCheck size={12} />,
    color: '#c084fc',
    glowColor: 'rgba(192, 132, 252, 0.5)',
  },
  {
    id: 'advisor',
    name: 'Advisor',
    shortLabel: 'ADVISOR',
    code: 'ADV-04',
    icon: <Lightbulb size={12} />,
    color: '#facc15',
    glowColor: 'rgba(250, 204, 21, 0.5)',
  },
  {
    id: 'reviewer',
    name: 'Reviewer',
    shortLabel: 'REVIEW',
    code: 'REV-05',
    icon: <ScanEye size={12} />,
    color: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.5)',
  },
  {
    id: 'finalSynthesizer',
    name: 'Synthesizer',
    shortLabel: 'SYNTH',
    code: 'SYN-06',
    icon: <Sparkles size={12} />,
    color: '#fb7185',
    glowColor: 'rgba(251, 113, 133, 0.5)',
  },
];

const OPTIONAL_AGENTS: Record<string, AgentNodeDef> = {
  architect: {
    id: 'architect',
    name: 'Architect',
    shortLabel: 'DIAGRAM',
    code: 'ARC-07',
    icon: <Boxes size={12} />,
    color: '#fbbf24',
    glowColor: 'rgba(251, 191, 36, 0.5)',
    isOptional: true,
  },
  dataAnalyst: {
    id: 'dataAnalyst',
    name: 'Data Analyst',
    shortLabel: 'CHART',
    code: 'DAT-08',
    icon: <BarChart3 size={12} />,
    color: '#38bdf8',
    glowColor: 'rgba(56, 189, 248, 0.5)',
    isOptional: true,
  },
  imageFinder: {
    id: 'imageFinder',
    name: 'Image Finder',
    shortLabel: 'IMAGES',
    code: 'IMG-09',
    icon: <ImageIcon size={12} />,
    color: '#f472b6',
    glowColor: 'rgba(244, 114, 182, 0.5)',
    isOptional: true,
  },
  coder: {
    id: 'coder',
    name: 'Coder',
    shortLabel: 'CODE',
    code: 'COD-10',
    icon: <Code2 size={12} />,
    color: '#60a5fa',
    glowColor: 'rgba(96, 165, 250, 0.5)',
    isOptional: true,
  },
};

export const JarvisPipelineHudTracker: React.FC<JarvisPipelineHudTrackerProps> = ({
  message,
  isExpanded,
  onToggleExpand,
  isRunning = false,
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
  const isDynamicSpecialistPipeline =
    message?.newAgentMode ||
    steps.some(
      (s) =>
        s?.agentId === 'specialist_1' ||
        (typeof s?.agentId === 'string' && s.agentId.startsWith('specialist_')),
    );

  const isCodeOnlyPipeline =
    !isDynamicSpecialistPipeline &&
    steps.some((s) => s?.agentId === 'coder') &&
    steps.some((s) => s?.agentId === 'finalSynthesizer' && s.status === 'skipped');

  const isAutoCodePipeline =
    !isDynamicSpecialistPipeline &&
    steps.some((s) => s?.agentId === 'coder') &&
    (steps.some((s) => s?.agentId === 'finalSynthesizer' && s.status !== 'skipped') ||
      steps.some((s) => s?.agentId === 'reviewer' && s.status !== 'skipped'));

  let activeNodes: AgentNodeDef[] = [];

  const hasCoder = steps.some((s) => s?.agentId === 'coder');
  const hasResearcher = steps.some((s) => s?.agentId === 'researcher');

  if (isDynamicSpecialistPipeline) {
    const pNode = CORE_AGENTS.find((a) => a.id === 'planner') || CORE_AGENTS[0];
    activeNodes.push(pNode);

    const specialistSteps = steps.filter(
      (s) => s?.agentId && typeof s.agentId === 'string' && s.agentId.startsWith('specialist_'),
    );

    if (specialistSteps.length > 0) {
      specialistSteps.forEach((sp, idx) => {
        const colors = ['#38bdf8', '#c084fc', '#34d399'];
        const glowColors = [
          'rgba(56, 189, 248, 0.5)',
          'rgba(192, 132, 252, 0.5)',
          'rgba(52, 211, 153, 0.5)',
        ];
        const rawLabel = sp.name ? sp.name.replace(/^(Specialist\s*\d*[:-]?\s*)/i, '').trim() : '';
        const shortLabel = rawLabel ? rawLabel.slice(0, 8).toUpperCase() : `SPEC-${idx + 1}`;

        activeNodes.push({
          id: sp.agentId,
          name: sp.name || `Specialist ${idx + 1}`,
          shortLabel,
          code: `SPC-0${idx + 1}`,
          icon: idx === 0 ? <Sparkles size={12} /> : idx === 1 ? <BarChart3 size={12} /> : <Lightbulb size={12} />,
          color: colors[idx % colors.length],
          glowColor: glowColors[idx % glowColors.length],
        });
      });
    } else {
      const defaultSpecNames = ['Technical Specialist', 'Empirical Analyst', 'Practical Strategist'];
      for (let i = 1; i <= 3; i++) {
        activeNodes.push({
          id: `specialist_${i}`,
          name: defaultSpecNames[i - 1],
          shortLabel: `SPEC-0${i}`,
          code: `SPC-0${i}`,
          icon: <Sparkles size={12} />,
          color: i === 1 ? '#38bdf8' : i === 2 ? '#c084fc' : '#34d399',
          glowColor: i === 1 ? 'rgba(56, 189, 248, 0.5)' : i === 2 ? 'rgba(192, 132, 252, 0.5)' : 'rgba(52, 211, 153, 0.5)',
        });
      }
    }

    const sNode = CORE_AGENTS.find((a) => a.id === 'finalSynthesizer') || CORE_AGENTS[5];
    activeNodes.push(sNode);
  } else if (isCodeOnlyPipeline) {
    const plannerNode = CORE_AGENTS.find((a) => a.id === 'planner');
    if (plannerNode) activeNodes.push(plannerNode);
    activeNodes.push(OPTIONAL_AGENTS.coder);
  } else if (isAutoCodePipeline && !hasResearcher) {
    const pNode = CORE_AGENTS.find((a) => a.id === 'planner');
    const revNode = CORE_AGENTS.find((a) => a.id === 'reviewer');
    const sNode = CORE_AGENTS.find((a) => a.id === 'finalSynthesizer');
    if (pNode) activeNodes.push(pNode);
    activeNodes.push(OPTIONAL_AGENTS.coder);
    if (revNode) activeNodes.push(revNode);
    if (sNode) activeNodes.push(sNode);
  } else if (hasCoder) {
    const pNode = CORE_AGENTS.find((a) => a.id === 'planner');
    const coderNode = OPTIONAL_AGENTS.coder;
    const revNode = CORE_AGENTS.find((a) => a.id === 'reviewer');
    const rsrchNode = CORE_AGENTS.find((a) => a.id === 'researcher');
    const factNode = CORE_AGENTS.find((a) => a.id === 'factChecker');
    const advNode = CORE_AGENTS.find((a) => a.id === 'advisor');
    const synthNode = CORE_AGENTS.find((a) => a.id === 'finalSynthesizer');

    if (pNode) activeNodes.push(pNode);
    if (coderNode) activeNodes.push(coderNode);
    if (revNode) activeNodes.push(revNode);
    if (rsrchNode) activeNodes.push(rsrchNode);
    if (factNode) activeNodes.push(factNode);
    if (advNode) activeNodes.push(advNode);
    if (synthNode) activeNodes.push(synthNode);
  } else {
    activeNodes = [...CORE_AGENTS];
  }

  if (message?.diagramMode || steps.some((s) => s?.agentId === 'architect')) {
    activeNodes.push(OPTIONAL_AGENTS.architect);
  }
  if (message?.chartMode || steps.some((s) => s?.agentId === 'dataAnalyst')) {
    activeNodes.push(OPTIONAL_AGENTS.dataAnalyst);
  }
  if (message?.imageMode || steps.some((s) => s?.agentId === 'imageFinder')) {
    activeNodes.push(OPTIONAL_AGENTS.imageFinder);
  }

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
        code: 'CST-99',
        icon: s.icon ? <span>{s.icon}</span> : <Boxes size={12} />,
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

  // Calculate statistics safely from real data
  const totalDuration = steps.reduce((sum, s) => sum + (s?.durationMs || 0), 0);
  const executedCount = steps.filter((s) => s?.status === 'completed').length;
  const skippedCount = steps.filter((s) => s?.status === 'skipped').length;
  const hasRunning = isRunning || steps.some((s) => s?.status === 'running');

  // Derive 4 Stitch macro-stages (01 PLAN / 02 SWARM / 03 VALIDATE / 04 CONSENSUS) from real steps
  const getStageState = (stageAgentIds: string[]): 'completed' | 'running' | 'pending' => {
    const matched = steps.filter((s) =>
      stageAgentIds.some(
        (id) =>
          s?.agentId === id ||
          (id === 'specialist_' && typeof s?.agentId === 'string' && s.agentId.startsWith('specialist_')),
      ),
    );
    if (matched.some((s) => s.status === 'running')) return 'running';
    if (matched.some((s) => s.status === 'completed')) return 'completed';
    return 'pending';
  };

  const stages: Array<{ label: string; state: 'completed' | 'running' | 'pending' }> = [
    {
      label: '01 PLAN',
      state: getStageState(['planner']),
    },
    {
      label: '02 SWARM',
      state: getStageState([
        'researcher',
        'specialist_',
        'coder',
        'architect',
        'dataAnalyst',
        'imageFinder',
        'webFetcher',
        'customApiRunner',
      ]),
    },
    {
      label: '03 VALIDATE',
      state: getStageState(['factChecker', 'advisor', 'reviewer']),
    },
    {
      label: '04 CONSENSUS',
      state: getStageState(['finalSynthesizer', 'synthesizer']),
    },
  ];

  return (
    <div className="w-full select-none jarvis-pipeline-hud-tracker">
      <div
        onClick={onToggleExpand}
        className="jarvis-pipeline-hud-card w-full p-3 sm:p-3.5 rounded-xl bg-[var(--j-lowest)] cursor-pointer transition-all duration-200 shadow-lg"
      >
        {/* Header Row: Pulsing Dot + "PIPELINE EXECUTION STATE" + Real Right Caption */}
        <div className="jarvis-pipeline-hud-header flex items-center justify-between flex-wrap gap-2 pb-1.5">
          <div className="flex items-center gap-2">
            <span
              className={`inline-block w-1.5 h-1.5 rounded-full bg-[var(--j-accent)] ${
                hasRunning ? 'animate-ping' : ''
              }`}
            />
            <span className="font-mono text-[10px] font-semibold uppercase text-[var(--j-accent)] tracking-[0.12em]">
              PIPELINE EXECUTION STATE
            </span>
          </div>

          <div className="flex items-center gap-2 font-mono text-[9.5px] text-[var(--j-muted)] uppercase tracking-wider">
            <span>
              {executedCount}/{activeNodes.length} NODES
              {skippedCount > 0 ? ` · ${skippedCount} SKP` : ''}
            </span>
            {totalDuration > 0 && (
              <span className="inline-flex items-center gap-1 text-[var(--j-accent2)]">
                <Clock size={10} />
                <span>{(totalDuration / 1000).toFixed(1)}s</span>
              </span>
            )}
            <span className="text-[var(--j-muted)] flex items-center">
              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </span>
          </div>
        </div>

        {/* 4-Step Stitch Stepper Tracker (PLAN / SWARM / VALIDATE / CONSENSUS) */}
        <div className="grid grid-cols-4 gap-1.5 py-1.5">
          {stages.map((st, idx) => {
            const isComp = st.state === 'completed';
            const isRun = st.state === 'running';
            return (
              <div
                key={st.label}
                className={`flex flex-col gap-1 ${!isComp && !isRun ? 'opacity-45' : ''}`}
              >
                <div
                  className={`h-1 w-full rounded-full relative overflow-hidden ${
                    isComp
                      ? 'bg-[var(--j-accent)] shadow-[0_0_8px_rgba(0,240,255,0.6)]'
                      : isRun
                      ? 'bg-[var(--j-accent)] shadow-[0_0_10px_rgba(0,240,255,0.9)]'
                      : 'bg-[var(--j-high)]'
                  }`}
                >
                  {isRun && <div className="absolute inset-0 bg-white/60 animate-pulse" />}
                </div>
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`font-mono text-[9px] uppercase tracking-wider truncate ${
                      isRun
                        ? 'text-[var(--j-accent)] font-bold'
                        : isComp
                        ? 'text-[var(--j-accent2)] font-medium'
                        : 'text-[var(--j-muted)]'
                    }`}
                  >
                    {st.label}
                  </span>
                  {isComp ? (
                    <CheckCircle2 size={10} className="text-[var(--j-accent2)] shrink-0" />
                  ) : isRun ? (
                    <RefreshCw size={10} className="text-[var(--j-accent)] animate-spin shrink-0" />
                  ) : idx === 3 ? (
                    <Hourglass size={10} className="text-[var(--j-muted)] shrink-0" />
                  ) : (
                    <Clock size={10} className="text-[var(--j-muted)] shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Compact Real Agent Node Strip */}
        <div className="jarvis-pipeline-hud-track pt-1.5 mt-1 border-t border-white/[0.04]">
          <div className="jarvis-pipeline-hud-nodes flex items-center justify-between gap-1 overflow-x-auto no-scrollbar py-0.5">
            {activeNodes.map((node) => {
              const step = findStep(node.id);
              const status = step?.status || 'skipped';
              const isCompleted = status === 'completed';
              const isNodeRunning = status === 'running';
              const isFailed = status === 'failed';

              return (
                <div
                  key={node.id}
                  className="jarvis-pipeline-hud-node flex items-center gap-1 px-1.5 py-1 rounded-md bg-[var(--j-low)] shrink-0"
                  title={`${node.name}: ${status.toUpperCase()}${step?.durationMs ? ` (${step.durationMs}ms)` : ''}`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full shrink-0 ${isNodeRunning ? 'animate-ping' : ''}`}
                    style={{
                      backgroundColor: isCompleted
                        ? node.color
                        : isNodeRunning
                        ? 'var(--j-accent)'
                        : isFailed
                        ? 'var(--j-danger)'
                        : 'var(--j-faint)',
                    }}
                  />
                  <span
                    className="jarvis-pipeline-hud-label font-mono text-[8.5px] sm:text-[9px] font-semibold uppercase tracking-wider"
                    style={{
                      color: isCompleted
                        ? node.color
                        : isNodeRunning
                        ? 'var(--j-accent)'
                        : isFailed
                        ? 'var(--j-danger)'
                        : 'var(--j-muted)',
                    }}
                  >
                    {node.shortLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
