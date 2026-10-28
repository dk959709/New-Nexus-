import React, { useState, useEffect } from 'react';
import {
  Compass,
  Globe2,
  ShieldCheck,
  Lightbulb,
  ScanEye,
  Sparkles,
  Boxes,
  BarChart3,
  Image as ImageIcon,
  AlertCircle,
  Clock,
  Terminal,
  Activity,
  Check,
  AlertTriangle,
  RotateCcw,
  Server,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import type { ParallaxTheme } from '@/components/parallax/ParallaxSettings';
import type { JarvisMessage } from '@/types';

interface JarvisTerminalDiagnosticLogProps {
  message: JarvisMessage;
  isRunning?: boolean;
  defaultOpen?: boolean;
  theme?: ParallaxTheme;
}

// Icon mapping per role
const AGENT_ICONS: Record<string, React.ReactNode> = {
  planner: <Compass size={13} className="text-emerald-400" />,
  specialist_1: <Sparkles size={13} className="text-sky-400" />,
  specialist_2: <BarChart3 size={13} className="text-purple-400" />,
  specialist_3: <Lightbulb size={13} className="text-emerald-400" />,
  researcher: <Globe2 size={13} className="text-[#d99b64]" />,
  webFetcher: <Globe2 size={13} className="text-cyan-400" />,
  customApiRunner: <Server size={13} className="text-sky-400" />,
  factChecker: <ShieldCheck size={13} className="text-purple-400" />,
  advisor: <Lightbulb size={13} className="text-amber-400" />,
  reviewer: <ScanEye size={13} className="text-amber-400" />,
  finalSynthesizer: <Sparkles size={13} className="text-rose-400" />,
  synthesizer: <Sparkles size={13} className="text-rose-400" />,
  architect: <Boxes size={13} className="text-amber-400" />,
  dataAnalyst: <BarChart3 size={13} className="text-sky-400" />,
  imageFinder: <ImageIcon size={13} className="text-pink-400" />,
};

const AGENT_ROLE_DESCRIPTIONS: Record<string, string> = {
  planner: 'Decomposes inquiry & constructs execution topology',
  specialist_1: 'Domain-tailored technical & architectural investigation',
  specialist_2: 'Empirical cross-examination & comparative analysis',
  specialist_3: 'Practical execution pathways & strategic synthesis',
  researcher: 'Gathers multi-source intelligence & verifiable facts',
  webFetcher: 'Fetches and parses raw webpage HTML directly',
  customApiRunner: 'Direct REST API execution & parameterized retrieval',
  factChecker: 'Audits claims, detects anomalies & verifies truth',
  advisor: 'Evaluates trade-offs, comparisons & verified verdicts',
  reviewer: 'Conducts quality critique, tone balance & rigor audit',
  finalSynthesizer: 'Compiles verified multi-agent neural synthesis',
  synthesizer: 'Compiles verified multi-agent neural synthesis',
  architect: 'Constructs technical vector blueprint SVG diagrams',
  dataAnalyst: 'Generates structured quantitative dataset metrics',
  imageFinder: 'Locates real verified photographic visual references',
};

const AGENT_THEMES: Record<string, { text: string }> = {
  planner: { text: '#34d399' },
  specialist_1: { text: '#38bdf8' },
  specialist_2: { text: '#c084fc' },
  specialist_3: { text: '#34d399' },
  researcher: { text: '#d99b64' },
  webFetcher: { text: '#22d3ee' },
  customApiRunner: { text: '#38bdf8' },
  factChecker: { text: '#c084fc' },
  advisor: { text: '#facc15' },
  reviewer: { text: '#fbbf24' },
  finalSynthesizer: { text: '#fb7185' },
  synthesizer: { text: '#fb7185' },
  architect: { text: '#fbbf24' },
  dataAnalyst: { text: '#38bdf8' },
  imageFinder: { text: '#f472b6' },
};

function getAgentTheme(agentId: string) {
  return AGENT_THEMES[agentId] || { text: '#38bdf8' };
}

export const JarvisTerminalDiagnosticLog: React.FC<JarvisTerminalDiagnosticLogProps> = ({
  message,
  isRunning = false,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(defaultOpen);
  const steps = Array.isArray(message?.steps) ? message.steps : [];
  const isDeepResearch = Boolean(message?.deepResearch);
  const hasRunningStep = isRunning || steps.some((s) => s?.status === 'running');

  useEffect(() => {
    if (hasRunningStep) {
      setIsOpen(true);
    }
  }, [hasRunningStep]);

  const baseTime = message?.timestamp ? new Date(message.timestamp) : null;
  const formatStepTime = (idx: number) => {
    if (!baseTime) return `0${idx + 1}`;
    const d = new Date(baseTime.getTime() + idx * 450);
    return d.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <div className="w-full rounded-lg bg-[var(--j-low)] p-2.5 sm:p-3 flex flex-col gap-1.5 transition-all duration-200">
      {/* Header Row with Terminal Icon, Title, STREAM LIVE caption when running, and Chevron */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <Terminal size={13} className="text-[var(--j-accent)] shrink-0" />
          <span className="font-mono text-[10px] font-semibold uppercase text-[var(--j-text)] tracking-[0.12em] truncate">
            JARVIS // NEURAL PIPELINE DIAGNOSTIC LOG
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {hasRunningStep ? (
            <span className="font-mono text-[9px] font-medium uppercase tracking-wider text-[var(--j-accent2)] flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--j-accent)] animate-pulse" />
              <span>STREAM LIVE</span>
            </span>
          ) : (
            <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--j-muted)]">
              {steps.length} {steps.length === 1 ? 'AGENT' : 'AGENTS'}
              {isDeepResearch ? ' · DEEP MESH' : ''}
            </span>
          )}
          <span className="text-[var(--j-muted)] group-hover:text-[var(--j-text)] transition-colors">
            {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="flex flex-col gap-2 pt-1.5 border-t border-white/[0.04]">
          {/* Monospace Stream Summary Lines with Cyan Timestamps */}
          {steps.length > 0 ? (
            <div className="flex flex-col gap-1 font-mono text-[11px] text-[var(--j-muted)]">
              {steps.map((step, idx) => {
                const theme = getAgentTheme(step.agentId);
                const statusLabel =
                  step.status === 'completed'
                    ? step.durationMs
                      ? `${step.durationMs}ms`
                      : 'completed'
                    : step.status;
                return (
                  <p key={`line-${step.agentId}-${idx}`} className="truncate m-0 leading-relaxed">
                    <span className="text-[var(--j-accent2)]">&gt; [{formatStepTime(idx)}]</span>{' '}
                    <span className="font-semibold" style={{ color: theme.text }}>
                      {step.name}
                    </span>{' '}
                    <span className="text-[var(--j-faint)]">({step.providerName}/{step.model})</span>:{' '}
                    <span className="text-[var(--j-text)]">
                      {step.summary || AGENT_ROLE_DESCRIPTIONS[step.agentId] || statusLabel}
                    </span>
                  </p>
                );
              })}
              {hasRunningStep && (
                <div className="flex items-center gap-1.5 pt-0.5 text-[var(--j-accent)] font-mono text-[11px]">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--j-accent)] animate-pulse" />
                  <span>Orchestrating active neural pipeline nodes...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="font-mono text-[11px] text-[var(--j-faint)]">
              <span className="text-[var(--j-accent2)]">&gt; [STANDBY]</span>{' '}
              <span>Awaiting synthesis directive to initialize agent diagnostic stream.</span>
            </div>
          )}

          {/* Detailed Agent Step Breakdown Cards (Tonal --j-card) */}
          {steps.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1">
              {steps.map((step, idx) => {
                const theme = getAgentTheme(step.agentId);
                const icon = AGENT_ICONS[step.agentId] || (
                  step.icon ? (
                    <span className="text-xs">{step.icon}</span>
                  ) : (
                    <Activity size={13} style={{ color: theme.text }} />
                  )
                );
                const roleDesc =
                  step.summary || AGENT_ROLE_DESCRIPTIONS[step.agentId] || 'Autonomous execution agent';
                const isCompleted = step.status === 'completed';
                const isFailed = step.status === 'failed';

                return (
                  <div
                    key={`${step.agentId}-${idx}`}
                    className="relative p-2.5 rounded-lg bg-[var(--j-card)] transition-all duration-200"
                    style={{
                      borderLeft: `2px solid ${
                        isFailed ? 'var(--j-danger)' : isCompleted ? theme.text : 'var(--j-faint)'
                      }`,
                    }}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="shrink-0">{icon}</span>
                        <span
                          className="font-bold text-[11.5px] tracking-wide uppercase"
                          style={{ color: theme.text }}
                        >
                          {step.name}
                        </span>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-[var(--j-lowest)] text-[var(--j-muted)]">
                          {step.providerName}/{step.model}
                        </span>
                        {step.usedFallback && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 text-[9.5px] font-mono">
                            <RotateCcw size={9} />
                            <span>FAILOVER</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 font-mono text-[10px]">
                        {step.durationMs !== undefined && step.durationMs !== null && (
                          <span className="text-[var(--j-accent2)] px-1.5 py-0.5 rounded bg-[var(--j-lowest)] flex items-center gap-1">
                            <Clock size={9} />
                            <span>{step.durationMs}ms</span>
                          </span>
                        )}
                        <span
                          className="px-2 py-0.5 rounded uppercase font-semibold flex items-center gap-1"
                          style={{
                            background: 'var(--j-lowest)',
                            color: isCompleted
                              ? '#34d399'
                              : isFailed
                              ? 'var(--j-danger)'
                              : 'var(--j-muted)',
                          }}
                        >
                          {isCompleted ? (
                            <>
                              <Check size={9} />
                              <span>EXECUTED</span>
                            </>
                          ) : isFailed ? (
                            <>
                              <AlertTriangle size={9} />
                              <span>ERROR</span>
                            </>
                          ) : (
                            <span>{step.status === 'running' ? 'ACTIVE' : 'BYPASSED'}</span>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="mt-1.5 pt-1.5 border-t border-white/[0.04] flex flex-col gap-0.5 font-mono text-[10.5px] text-[var(--j-muted)]">
                      <div className="flex items-start gap-1.5">
                        <span className="text-[var(--j-faint)] shrink-0">ROLE:</span>
                        <span className="text-[var(--j-text)] font-sans text-[11.5px]">
                          {step.specialistRole || roleDesc}
                        </span>
                      </div>

                      {step.assignedTools && step.assignedTools.length > 0 && (
                        <div className="flex items-start gap-1.5">
                          <span className="text-[var(--j-accent2)] shrink-0">TOOLS:</span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {step.assignedTools.map((tool) => (
                              <span
                                key={tool}
                                className="px-1.5 py-0.2 rounded bg-[var(--j-lowest)] text-[var(--j-accent2)] text-[9.5px] font-mono capitalize"
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {step.outputPreview && (
                        <div className="flex items-start gap-1.5">
                          <span className="text-[var(--j-faint)] shrink-0">DATA:</span>
                          <span className="text-[var(--j-muted)] font-mono text-[10px] truncate max-w-2xl bg-[var(--j-lowest)] px-1.5 py-0.5 rounded">
                            {step.outputPreview.replace(/\n+/g, ' ').slice(0, 140)}
                            {step.outputPreview.length > 140 ? '...' : ''}
                          </span>
                        </div>
                      )}

                      {step.error && (
                        <div className="flex items-start gap-1.5 text-[var(--j-danger)]">
                          <AlertCircle size={11} className="shrink-0 mt-0.5" />
                          <span className="font-sans text-[11px]">{step.error}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
