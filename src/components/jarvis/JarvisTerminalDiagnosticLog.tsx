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
  AlertCircle,
  Clock,
  Terminal,
  Activity,
  Check,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { JarvisCornerBrackets } from './JarvisCornerBrackets';
import type { JarvisMessage } from '@/types';

interface JarvisTerminalDiagnosticLogProps {
  message: JarvisMessage;
}

// Icon mapping per role
const AGENT_ICONS: Record<string, React.ReactNode> = {
  planner: <Compass size={14} className="text-emerald-400" />,
  researcher: <Globe2 size={14} className="text-sky-400" />,
  factChecker: <ShieldCheck size={14} className="text-purple-400" />,
  reviewer: <ScanEye size={14} className="text-amber-400" />,
  finalSynthesizer: <Sparkles size={14} className="text-rose-400" />,
  synthesizer: <Sparkles size={14} className="text-rose-400" />,
  architect: <Boxes size={14} className="text-amber-400" />,
  dataAnalyst: <BarChart3 size={14} className="text-sky-400" />,
  imageFinder: <ImageIcon size={14} className="text-pink-400" />,
};

const AGENT_ROLE_DESCRIPTIONS: Record<string, string> = {
  planner: 'Decomposes inquiry & constructs execution topology',
  researcher: 'Gathers multi-source intelligence & verifiable facts',
  factChecker: 'Audits claims, detects anomalies & verifies truth',
  reviewer: 'Conducts quality critique, tone balance & rigor audit',
  finalSynthesizer: 'Compiles verified multi-agent neural synthesis',
  synthesizer: 'Compiles verified multi-agent neural synthesis',
  architect: 'Constructs technical vector blueprint SVG diagrams',
  dataAnalyst: 'Generates structured quantitative dataset metrics',
  imageFinder: 'Locates real verified photographic visual references',
};

const AGENT_THEMES: Record<
  string,
  {
    border: string;
    bg: string;
    text: string;
    glow: string;
    badgeBg: string;
  }
> = {
  planner: {
    border: 'rgba(52, 211, 153, 0.4)',
    bg: 'rgba(52, 211, 153, 0.08)',
    text: '#34d399',
    glow: 'rgba(52, 211, 153, 0.25)',
    badgeBg: 'rgba(52, 211, 153, 0.18)',
  },
  researcher: {
    border: 'rgba(56, 189, 248, 0.4)',
    bg: 'rgba(56, 189, 248, 0.08)',
    text: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.25)',
    badgeBg: 'rgba(56, 189, 248, 0.18)',
  },
  factChecker: {
    border: 'rgba(192, 132, 252, 0.4)',
    bg: 'rgba(192, 132, 252, 0.08)',
    text: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.25)',
    badgeBg: 'rgba(192, 132, 252, 0.18)',
  },
  reviewer: {
    border: 'rgba(251, 191, 36, 0.4)',
    bg: 'rgba(251, 191, 36, 0.08)',
    text: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.25)',
    badgeBg: 'rgba(251, 191, 36, 0.18)',
  },
  finalSynthesizer: {
    border: 'rgba(251, 113, 133, 0.4)',
    bg: 'rgba(251, 113, 133, 0.08)',
    text: '#fb7185',
    glow: 'rgba(251, 113, 133, 0.25)',
    badgeBg: 'rgba(251, 113, 133, 0.18)',
  },
  synthesizer: {
    border: 'rgba(251, 113, 133, 0.4)',
    bg: 'rgba(251, 113, 133, 0.08)',
    text: '#fb7185',
    glow: 'rgba(251, 113, 133, 0.25)',
    badgeBg: 'rgba(251, 113, 133, 0.18)',
  },
  architect: {
    border: 'rgba(245, 158, 11, 0.4)',
    bg: 'rgba(245, 158, 11, 0.08)',
    text: '#fbbf24',
    glow: 'rgba(245, 158, 11, 0.25)',
    badgeBg: 'rgba(245, 158, 11, 0.18)',
  },
  dataAnalyst: {
    border: 'rgba(56, 189, 248, 0.4)',
    bg: 'rgba(56, 189, 248, 0.08)',
    text: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.25)',
    badgeBg: 'rgba(56, 189, 248, 0.18)',
  },
  imageFinder: {
    border: 'rgba(244, 114, 182, 0.4)',
    bg: 'rgba(244, 114, 182, 0.08)',
    text: '#f472b6',
    glow: 'rgba(244, 114, 182, 0.25)',
    badgeBg: 'rgba(244, 114, 182, 0.18)',
  },
};

function getAgentTheme(agentId: string) {
  return (
    AGENT_THEMES[agentId] || {
      border: 'rgba(56, 189, 248, 0.35)',
      bg: 'rgba(56, 189, 248, 0.06)',
      text: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.2)',
      badgeBg: 'rgba(56, 189, 248, 0.15)',
    }
  );
}

export const JarvisTerminalDiagnosticLog: React.FC<JarvisTerminalDiagnosticLogProps> = ({
  message,
}) => {
  const steps = Array.isArray(message?.steps) ? message.steps : [];
  const isDeepResearch = Boolean(message?.deepResearch);

  return (
    <div
      className="relative mb-5 rounded-2xl overflow-hidden backdrop-blur-xl border border-cyan-500/30 transition-all duration-300"
      style={{
        background: 'linear-gradient(160deg, rgba(4, 12, 24, 0.96) 0%, rgba(8, 14, 34, 0.98) 100%)',
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Sci-Fi Corner Brackets */}
      <JarvisCornerBrackets color="rgba(56, 189, 248, 0.6)" size={12} />

      {/* Terminal Diagnostic Header Bar */}
      <div className="px-4 py-2.5 bg-slate-950/80 border-b border-cyan-500/25 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <div className="h-3 w-[1px] bg-slate-700 mx-1" />
          <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-300 tracking-wider">
            <Terminal size={13} className="text-cyan-400" />
            <span>JARVIS // NEURAL PIPELINE DIAGNOSTIC LOG</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
          <span className="hidden sm:inline">TARGET:</span>
          <span className="text-slate-200 font-bold max-w-[200px] truncate">
            &quot;{message.query}&quot;
          </span>
          {isDeepResearch && (
            <span className="px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 font-bold tracking-wider">
              DEEP RESEARCH MESH
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
            {steps.length} AGENTS
          </span>
        </div>
      </div>

      {/* Terminal Body: Uniform Agent Card List */}
      <div className="p-3 sm:p-4 flex flex-col gap-2.5 relative z-10">
        {steps.map((step, idx) => {
          const theme = getAgentTheme(step.agentId);
          const icon = AGENT_ICONS[step.agentId] || (
            step.icon ? (
              <span className="text-xs">{step.icon}</span>
            ) : (
              <Activity size={14} style={{ color: theme.text }} />
            )
          );
          const roleDesc =
            step.summary || AGENT_ROLE_DESCRIPTIONS[step.agentId] || 'Autonomous execution agent';
          const isCompleted = step.status === 'completed';
          const isSkipped = step.status === 'skipped';
          const isFailed = step.status === 'failed';

          return (
            <div
              key={`${step.agentId}-${idx}`}
              className="relative p-3 rounded-xl border transition-all duration-200"
              style={{
                background: isCompleted
                  ? theme.bg
                  : isSkipped
                  ? 'rgba(15, 23, 42, 0.4)'
                  : isFailed
                  ? 'rgba(244, 63, 94, 0.1)'
                  : 'rgba(6, 16, 30, 0.6)',
                borderColor: isFailed
                  ? 'rgba(244, 63, 94, 0.45)'
                  : isCompleted
                  ? theme.border
                  : 'rgba(148, 163, 184, 0.15)',
                boxShadow: isCompleted ? `0 0 14px ${theme.glow}` : 'none',
              }}
            >
              {/* Card Main Line: Icon + Role Name + Monospace Model String + Timer + Status Badge */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                {/* Left Role & Model Block */}
                <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                  {/* Clean Tech Icon Container */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-inner"
                    style={{
                      background: 'rgba(4, 12, 24, 0.8)',
                      border: `1px solid ${isCompleted ? theme.text : 'rgba(148,163,184,0.3)'}`,
                    }}
                  >
                    {icon}
                  </div>

                  {/* Agent Role Title */}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span
                      className="font-bold text-xs tracking-wide uppercase"
                      style={{ color: theme.text }}
                    >
                      {step.name}
                    </span>

                    {/* Monospace Provider / Model String */}
                    <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-black/50 border border-white/10 text-slate-300 tracking-tight">
                      {step.providerName}/{step.model}
                    </span>
                  </div>

                  {/* Failover badge if triggered */}
                  {step.usedFallback && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono">
                      <RotateCcw size={9} />
                      <span>FAILOVER</span>
                    </span>
                  )}
                </div>

                {/* Right: Sleek Execution Timer Placement & Status Pill */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* Execution Timer */}
                  {step.durationMs !== undefined && step.durationMs !== null && (
                    <span className="font-mono text-[11px] text-cyan-300/90 px-2 py-0.5 rounded bg-slate-900/80 border border-cyan-500/30 flex items-center gap-1">
                      <Clock size={10} className="text-cyan-400" />
                      <span>{step.durationMs}ms</span>
                    </span>
                  )}

                  {/* Status Badge */}
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1"
                    style={{
                      background: isCompleted
                        ? 'rgba(52, 211, 153, 0.2)'
                        : isFailed
                        ? 'rgba(244, 63, 94, 0.2)'
                        : 'rgba(148, 163, 184, 0.15)',
                      color: isCompleted
                        ? '#34d399'
                        : isFailed
                        ? '#fb7185'
                        : '#94a3b8',
                      border: `1px solid ${
                        isCompleted
                          ? 'rgba(52,211,153,0.4)'
                          : isFailed
                          ? 'rgba(244,63,94,0.4)'
                          : 'rgba(148,163,184,0.2)'
                      }`,
                    }}
                  >
                    {isCompleted ? (
                      <>
                        <Check size={10} />
                        <span>EXECUTED</span>
                      </>
                    ) : isFailed ? (
                      <>
                        <AlertTriangle size={10} />
                        <span>ERROR</span>
                      </>
                    ) : (
                      <span>BYPASSED</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Subtly Indented Sub-Lines (Tree Branches: ├── and └──) */}
              <div className="mt-2.5 pt-2 border-t border-white/5 flex flex-col gap-1 font-mono text-[11px] pl-1 sm:pl-2">
                {/* Role Goal Line */}
                <div className="flex items-start gap-1.5 text-slate-400 leading-relaxed">
                  <span className="text-slate-600 font-bold shrink-0">├──</span>
                  <span className="text-slate-500 shrink-0">ROLE:</span>
                  <span className="text-slate-300 font-sans text-xs">{roleDesc}</span>
                </div>

                {/* Summary / Task Diagnostic Line */}
                {step.summary && (
                  <div className="flex items-start gap-1.5 text-slate-300 leading-relaxed">
                    <span className="text-cyan-600/80 font-bold shrink-0">
                      {step.error || step.outputPreview ? '├──' : '└──'}
                    </span>
                    <span className="text-cyan-400/80 shrink-0">DIAGNOSTIC:</span>
                    <span className="text-slate-200 font-sans text-xs">{step.summary}</span>
                  </div>
                )}

                {/* Optional Output Preview Line */}
                {step.outputPreview && (
                  <div className="flex items-start gap-1.5 text-slate-400 leading-relaxed">
                    <span className="text-slate-600 font-bold shrink-0">
                      {step.error ? '├──' : '└──'}
                    </span>
                    <span className="text-slate-500 shrink-0">DATA:</span>
                    <span className="text-slate-400 font-mono text-[10px] truncate max-w-2xl bg-black/40 px-1.5 py-0.5 rounded">
                      {step.outputPreview.replace(/\n+/g, ' ').slice(0, 140)}
                      {step.outputPreview.length > 140 ? '...' : ''}
                    </span>
                  </div>
                )}

                {/* Error Diagnostic Line */}
                {step.error && (
                  <div className="flex items-start gap-1.5 text-rose-300 leading-relaxed">
                    <span className="text-rose-600 font-bold shrink-0">└──</span>
                    <span className="text-rose-400 font-bold shrink-0">NOTICE:</span>
                    <span className="text-rose-200 font-sans text-xs flex items-center gap-1">
                      <AlertCircle size={12} className="text-rose-400 shrink-0" />
                      <span>{step.error}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
