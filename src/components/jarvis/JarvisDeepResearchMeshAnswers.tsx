import React, { useState } from 'react';
import {
  Compass,
  Search,
  Scale,
  ShieldCheck,
  Zap,
  DraftingCompass,
  BarChart3,
  Image as ImageIcon,
  Bot,
  Copy,
  Check,
  Clock,
  RotateCcw,
  Sparkles,
  Layers,
  Code2,
  FileText,
} from 'lucide-react';
import { JarvisExecutionStep } from '../../types';
import { FormattedText } from './FormattedText';

interface JarvisDeepResearchMeshAnswersProps {
  steps: JarvisExecutionStep[];
  query: string;
  isDeepResearch?: boolean;
}

const AGENT_THEMES: Record<
  string,
  {
    title: string;
    subtitle: string;
    border: string;
    bg: string;
    headerBg: string;
    text: string;
    badgeBg: string;
    accentGlow: string;
    icon: React.ReactNode;
  }
> = {
  planner: {
    title: 'PLANNER // STRATEGIC DECOMPOSITION',
    subtitle: 'Autonomous Task Routing & Multi-Phase Execution Plan',
    border: 'rgba(56, 189, 248, 0.45)',
    bg: 'linear-gradient(150deg, rgba(8, 28, 52, 0.9) 0%, rgba(6, 18, 36, 0.95) 100%)',
    headerBg: 'rgba(14, 42, 74, 0.6)',
    text: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    accentGlow: 'rgba(56, 189, 248, 0.3)',
    icon: <Compass size={18} className="text-sky-400" />,
  },
  researcher: {
    title: 'RESEARCHER // MULTI-SOURCE INTELLIGENCE',
    subtitle: 'Empirical Fact Retrieval, Knowledge Synthesis & Evidence Gathering',
    border: 'rgba(97, 215, 201, 0.45)',
    bg: 'linear-gradient(150deg, rgba(6, 32, 36, 0.9) 0%, rgba(4, 22, 28, 0.95) 100%)',
    headerBg: 'rgba(10, 48, 54, 0.6)',
    text: '#61d7c9',
    badgeBg: 'rgba(97, 215, 201, 0.15)',
    accentGlow: 'rgba(97, 215, 201, 0.3)',
    icon: <Search size={18} className="text-cyan-300" />,
  },
  factChecker: {
    title: 'FACT CHECKER // CRITICAL SCRUTINY & AUDIT',
    subtitle: 'Cross-Verification, Inconsistency Detection & Claim Validation',
    border: 'rgba(251, 191, 36, 0.45)',
    bg: 'linear-gradient(150deg, rgba(42, 28, 6, 0.9) 0%, rgba(28, 18, 4, 0.95) 100%)',
    headerBg: 'rgba(64, 42, 8, 0.6)',
    text: '#fbbf24',
    badgeBg: 'rgba(251, 191, 36, 0.15)',
    accentGlow: 'rgba(251, 191, 36, 0.3)',
    icon: <Scale size={18} className="text-amber-400" />,
  },
  reviewer: {
    title: 'REVIEWER // QUALITY ASSURANCE & PEER CRITIQUE',
    subtitle: 'Depth Evaluation, Clarity Scrutiny & Synthesis Refinements',
    border: 'rgba(52, 211, 153, 0.45)',
    bg: 'linear-gradient(150deg, rgba(6, 36, 26, 0.9) 0%, rgba(4, 24, 18, 0.95) 100%)',
    headerBg: 'rgba(10, 54, 38, 0.6)',
    text: '#34d399',
    badgeBg: 'rgba(52, 211, 153, 0.15)',
    accentGlow: 'rgba(52, 211, 153, 0.3)',
    icon: <ShieldCheck size={18} className="text-emerald-400" />,
  },
  architect: {
    title: 'ARCHITECT // BLUEPRINT & DIAGRAM SPECIFICATION',
    subtitle: 'System Architecture & Structural Topology Design',
    border: 'rgba(245, 158, 11, 0.45)',
    bg: 'linear-gradient(150deg, rgba(40, 24, 6, 0.9) 0%, rgba(24, 14, 4, 0.95) 100%)',
    headerBg: 'rgba(60, 36, 8, 0.6)',
    text: '#f59e0b',
    badgeBg: 'rgba(245, 158, 11, 0.15)',
    accentGlow: 'rgba(245, 158, 11, 0.3)',
    icon: <DraftingCompass size={18} className="text-amber-400" />,
  },
  dataAnalyst: {
    title: 'DATA ANALYST // QUANTITATIVE METRICS',
    subtitle: 'Comparative Matrix & Numerical Analysis Parsing',
    border: 'rgba(56, 189, 248, 0.45)',
    bg: 'linear-gradient(150deg, rgba(8, 28, 48, 0.9) 0%, rgba(6, 18, 32, 0.95) 100%)',
    headerBg: 'rgba(12, 42, 70, 0.6)',
    text: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    accentGlow: 'rgba(56, 189, 248, 0.3)',
    icon: <BarChart3 size={18} className="text-sky-400" />,
  },
  imageFinder: {
    title: 'IMAGE FINDER // VISUAL ASSET DISCOVERY',
    subtitle: 'Curated Photographic Grounding & Visual Media',
    border: 'rgba(244, 114, 182, 0.45)',
    bg: 'linear-gradient(150deg, rgba(40, 10, 28, 0.9) 0%, rgba(24, 6, 18, 0.95) 100%)',
    headerBg: 'rgba(60, 16, 42, 0.6)',
    text: '#f472b6',
    badgeBg: 'rgba(244, 114, 182, 0.15)',
    accentGlow: 'rgba(244, 114, 182, 0.3)',
    icon: <ImageIcon size={18} className="text-pink-400" />,
  },
  finalSynthesizer: {
    title: 'SYNTHESIZER // COMPREHENSIVE COMPILATION',
    subtitle: 'Overarching Unified Synthesis & Multi-Agent Harmonization',
    border: 'rgba(168, 85, 247, 0.45)',
    bg: 'linear-gradient(150deg, rgba(32, 10, 48, 0.9) 0%, rgba(20, 6, 32, 0.95) 100%)',
    headerBg: 'rgba(48, 16, 72, 0.6)',
    text: '#c084fc',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
    accentGlow: 'rgba(168, 85, 247, 0.3)',
    icon: <Zap size={18} className="text-purple-400" />,
  },
};

function parseAgentJson(rawOutput: string): { parsed: unknown; isJson: boolean } {
  if (!rawOutput) return { parsed: null, isJson: false };
  let cleaned = rawOutput.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // Try direct parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && (typeof parsed === 'object' || Array.isArray(parsed))) {
      return { parsed, isJson: true };
    }
  } catch {
    // continue
  }

  // Try extracting substring between first { and last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      return { parsed, isJson: true };
    } catch {
      // continue
    }
  }

  // Try extracting substring between first [ and last ]
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    try {
      const parsed = JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
      return { parsed, isJson: true };
    } catch {
      // continue
    }
  }

  return { parsed: null, isJson: false };
}

function formatAgentContentToMarkdown(step: JarvisExecutionStep): {
  formatted: string;
  isStructuredJson: boolean;
  raw: string;
} {
  const raw = step.rawOutput || step.outputPreview || step.summary || '';
  if (!raw) {
    return { formatted: 'No output data recorded for this step.', isStructuredJson: false, raw: '' };
  }

  const { parsed, isJson } = parseAgentJson(raw);

  if (isJson && parsed !== null) {
    // 1. Planner Agent
    if (step.agentId === 'planner' && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const pObj = parsed as Record<string, unknown>;
      const task = String(pObj.task || pObj.objective || 'Autonomous query execution');
      const plan = Array.isArray(pObj.plan) ? pObj.plan : Array.isArray(pObj.steps) ? pObj.steps : [];
      const needsDiagram = Boolean(pObj.needsDiagram);
      const needsChart = Boolean(pObj.needsChart);
      const needsImage = Boolean(pObj.needsImage);
      const needsResearch = Boolean(pObj.needsResearch ?? true);
      const needsFactCheck = Boolean(pObj.needsFactCheck ?? true);
      const needsReview = Boolean(pObj.needsReview ?? true);

      let md = `### 🎯 Targeted Objective\n**Task Scope:** ${task}\n\n### 📋 Strategic Execution Plan\n`;
      if (plan.length > 0) {
        plan.forEach((item, idx) => {
          md += `${idx + 1}. **Phase ${idx + 1}:** ${String(item)}\n`;
        });
      } else {
        md += `1. Multi-phase analysis and factual synthesis\n`;
      }

      md += `\n### 🧭 Neural Pipeline Directives\n`;
      md += `- **Deep Research Mesh:** ${needsResearch ? '✅ Active (Empirical Fact Retrieval)' : '⚪ Bypassed'}\n`;
      md += `- **Fact Verification Audit:** ${needsFactCheck ? '✅ Active (Claim Scrutiny Enabled)' : '⚪ Bypassed'}\n`;
      md += `- **Quality Assurance Peer Review:** ${needsReview ? '✅ Active (Multi-Point Review)' : '⚪ Bypassed'}\n`;
      md += `- **Architectural Diagram:** ${needsDiagram ? '✅ Active (SVG Blueprint Generation)' : '⚪ Standby'}\n`;
      md += `- **Quantitative Chart:** ${needsChart ? '✅ Active (Numerical Spec Extraction)' : '⚪ Standby'}\n`;
      md += `- **Visual Image Lookup:** ${needsImage ? '✅ Active (Photographic Retrieval)' : '⚪ Standby'}\n`;

      return { formatted: md, isStructuredJson: true, raw };
    }

    // 2. Researcher Agent
    if (step.agentId === 'researcher' && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const rObj = parsed as Record<string, unknown>;
      const facts = Array.isArray(rObj.facts) ? rObj.facts : Array.isArray(rObj.findings) ? rObj.findings : [];
      const context = typeof rObj.context === 'string' ? rObj.context : typeof rObj.summary === 'string' ? rObj.summary : '';
      const keyInsights = Array.isArray(rObj.keyInsights) ? rObj.keyInsights : Array.isArray(rObj.insights) ? rObj.insights : [];

      let md = `### 🔎 Core Fact Intelligence & Verified Findings\n`;
      if (facts.length > 0) {
        facts.forEach((fact) => {
          md += `- ${String(fact)}\n`;
        });
      } else {
        md += `- Fact gathering completed successfully.\n`;
      }

      if (keyInsights.length > 0) {
        md += `\n### 💡 Key Empirical Insights\n`;
        keyInsights.forEach((insight) => {
          md += `- ${String(insight)}\n`;
        });
      }

      if (context) {
        md += `\n### 📖 Deep Contextual Background\n${context}\n`;
      }

      return { formatted: md, isStructuredJson: true, raw };
    }

    // 3. Fact Checker Agent
    if (step.agentId === 'factChecker' && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const fObj = parsed as Record<string, unknown>;
      const summary = typeof fObj.summary === 'string' ? fObj.summary : 'All claims verified.';
      const verified = Array.isArray(fObj.verified) ? fObj.verified : [];
      const issues = Array.isArray(fObj.issues) ? fObj.issues : Array.isArray(fObj.corrections) ? fObj.corrections : [];

      let md = `### ⚖️ Fact-Check Audit Summary\n**Verification Status:** ${summary}\n\n`;

      if (verified.length > 0) {
        md += `#### ✅ Verified Claims & Accuracy Points:\n`;
        verified.forEach((v) => {
          md += `- **Verified:** ${String(v)}\n`;
        });
      }

      if (issues.length > 0) {
        md += `\n#### ⚠️ Discrepancy & Correction Notes:\n`;
        issues.forEach((issue) => {
          md += `- **Correction:** ${String(issue)}\n`;
        });
      } else {
        md += `\n#### 🛡️ Cross-Verification Audit Result:\n- No factual contradictions or ungrounded hallucinations detected.\n`;
      }

      return { formatted: md, isStructuredJson: true, raw };
    }

    // 4. Reviewer Agent
    if (step.agentId === 'reviewer' && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const rvObj = parsed as Record<string, unknown>;
      const recommendation =
        typeof rvObj.recommendation === 'string'
          ? rvObj.recommendation
          : typeof rvObj.verdict === 'string'
          ? rvObj.verdict
          : 'Proceed with comprehensive synthesis.';
      const critique = typeof rvObj.critique === 'string' ? rvObj.critique : typeof rvObj.feedback === 'string' ? rvObj.feedback : '';
      const score = typeof rvObj.score === 'number' ? rvObj.score : null;

      let md = `### 🛡️ Peer Review & Quality Assurance\n`;
      if (score !== null) {
        md += `**Quality Score:** \`${score}/100\` • **Verdict:** ${recommendation}\n\n`;
      } else {
        md += `**Verdict & Recommendation:** ${recommendation}\n\n`;
      }

      if (critique) {
        md += `### 🔍 Refinements & Editorial Critique\n${critique}\n`;
      }

      return { formatted: md, isStructuredJson: true, raw };
    }

    // 5. Generic or Custom Agent JSON formatting (Never raw JSON block as default!)
    if (typeof parsed === 'object' && parsed !== null) {
      if (Array.isArray(parsed)) {
        let md = `### 📊 ${step.name ? step.name.toUpperCase() : step.agentId.toUpperCase()} // STRUCTURED RECORDS\n\n`;
        parsed.forEach((item, i) => {
          md += `${i + 1}. ${typeof item === 'object' ? JSON.stringify(item) : String(item)}\n`;
        });
        return { formatted: md, isStructuredJson: true, raw };
      }

      const pObj = parsed as Record<string, unknown>;
      let md = `### ⚡ ${step.name ? step.name.toUpperCase() : step.agentId.toUpperCase()} // EXECUTION OUTPUT\n\n`;
      
      for (const [key, val] of Object.entries(pObj)) {
        const titleKey = key.replace(/([A-Z])/g, ' $1').toUpperCase();
        if (Array.isArray(val)) {
          md += `**${titleKey}:**\n`;
          val.forEach((item) => {
            md += `- ${typeof item === 'object' ? JSON.stringify(item) : String(item)}\n`;
          });
          md += `\n`;
        } else if (val && typeof val === 'object') {
          md += `**${titleKey}:**\n\`\`\`json\n${JSON.stringify(val, null, 2)}\n\`\`\`\n\n`;
        } else if (val !== undefined && val !== null && val !== '') {
          md += `**${titleKey}:** ${String(val)}\n\n`;
        }
      }
      return { formatted: md, isStructuredJson: true, raw };
    }
  }

  // Fallback for non-JSON or plain text (e.g. terminal logs, pasted text, markdown)
  return { formatted: raw, isStructuredJson: true, raw };
}

export const JarvisDeepResearchMeshAnswers: React.FC<JarvisDeepResearchMeshAnswersProps> = ({
  steps,
  isDeepResearch = false,
}) => {
  const [copiedStepIndex, setCopiedStepIndex] = useState<number | null>(null);
  const [rawViewMap, setRawViewMap] = useState<Record<number, boolean>>({});

  // Filter out skipped steps and finalSynthesizer (as the synthesizer is rendered in the final answer block)
  // We want to show Planner, Researcher, Fact Checker, Reviewer, and any Custom/Architect/DataAnalyst agents
  const agentSteps = steps.filter(
    (s) => s.status === 'completed' && s.agentId !== 'finalSynthesizer',
  );

  if (agentSteps.length === 0) return null;

  const handleCopy = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStepIndex(idx);
    setTimeout(() => setCopiedStepIndex(null), 2000);
  };

  const toggleRawView = (idx: number) => {
    setRawViewMap((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <div className="mb-6 flex flex-col gap-4">
      {/* Individual Agent Answers Section Banner */}
      <div className="relative p-3 sm:p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/30 flex items-center justify-between flex-wrap gap-2 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(97,215,201,0.3)]">
            <Layers size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase">
                {isDeepResearch
                  ? 'DEEP RESEARCH // AGENT MESH FULL ANSWERS'
                  : 'MULTI-AGENT INTELLIGENCE // INDIVIDUAL AGENT ANSWERS'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
                {agentSteps.length} AGENTS COMPLETED
              </span>
            </div>
            <p className="text-[11px] text-slate-400 m-0">
              {isDeepResearch
                ? 'Unfiltered individual agent answers across the autonomous intelligence pipeline'
                : 'Unfiltered individual agent answers from each pipeline specialist'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400/80 bg-cyan-950/40 px-2.5 py-1 rounded-full border border-cyan-500/20">
          <Sparkles size={11} className="text-cyan-400" />
          <span>FULL PIPELINE TRANSPARENCY</span>
        </div>
      </div>

      {/* Individual Agent Answers Cards */}
      <div className="flex flex-col gap-4">
        {agentSteps.map((step, idx) => {
          const theme = AGENT_THEMES[step.agentId] || {
            title: `${step.name.toUpperCase()} // AUTONOMOUS AGENT`,
            subtitle: 'Independent Agent Execution Node',
            border: 'rgba(148, 163, 184, 0.45)',
            bg: 'linear-gradient(150deg, rgba(15, 23, 42, 0.9) 0%, rgba(8, 14, 28, 0.95) 100%)',
            headerBg: 'rgba(30, 41, 59, 0.6)',
            text: '#94a3b8',
            badgeBg: 'rgba(148, 163, 184, 0.15)',
            accentGlow: 'rgba(148, 163, 184, 0.25)',
            icon: <Bot size={18} className="text-slate-300" />,
          };

          const { formatted, isStructuredJson, raw } = formatAgentContentToMarkdown(step);
          const isShowingRaw = Boolean(rawViewMap[idx]);

          return (
            <div
              key={`${step.agentId}-${idx}`}
              className="relative rounded-2xl overflow-hidden border transition-all duration-300 shadow-xl"
              style={{
                background: theme.bg,
                borderColor: theme.border,
                boxShadow: `0 8px 32px rgba(0, 0, 0, 0.45), 0 0 20px ${theme.accentGlow}`,
              }}
            >
              {/* Agent Card Header */}
              <div
                className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2"
                style={{
                  background: theme.headerBg,
                  borderColor: theme.border,
                }}
              >
                {/* Left: Agent Icon & Title */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
                    style={{
                      background: 'rgba(4, 12, 24, 0.85)',
                      border: `1.5px solid ${theme.text}`,
                    }}
                  >
                    {theme.icon}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-bold text-xs sm:text-sm tracking-wider uppercase font-mono"
                        style={{ color: theme.text }}
                      >
                        {theme.title}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-black/60 border border-white/10 text-slate-300">
                        {step.providerName}/{step.model}
                      </span>
                      {step.usedFallback && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono">
                          <RotateCcw size={9} />
                          <span>FAILOVER</span>
                        </span>
                      )}
                      {step.agentId === 'researcher' && step.searchSource && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-500/15 border border-cyan-400/30 text-cyan-300">
                          via {step.searchSource}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 m-0 hidden sm:block">
                      {theme.subtitle}
                    </p>
                  </div>
                </div>

                {/* Right: Timer + Raw Toggle + Copy Button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {step.durationMs !== undefined && step.durationMs !== null && (
                    <span className="font-mono text-[11px] text-slate-300 px-2 py-1 rounded bg-black/50 border border-white/10 flex items-center gap-1">
                      <Clock size={11} className="text-cyan-400" />
                      <span>{step.durationMs}ms</span>
                    </span>
                  )}

                  {isStructuredJson && (
                    <button
                      type="button"
                      onClick={() => toggleRawView(idx)}
                      className="px-2 py-1 rounded text-xs font-mono flex items-center gap-1 bg-black/50 border border-white/15 text-slate-300 hover:text-white hover:border-white/30 transition-all"
                      title={isShowingRaw ? 'Switch to Formatted View' : 'Switch to Raw JSON View'}
                    >
                      {isShowingRaw ? (
                        <>
                          <FileText size={12} className="text-cyan-300" />
                          <span>Formatted</span>
                        </>
                      ) : (
                        <>
                          <Code2 size={12} className="text-cyan-300" />
                          <span>Raw JSON</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleCopy(isShowingRaw ? raw : formatted, idx)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors flex items-center gap-1 text-xs font-mono bg-black/40 border border-white/10"
                    title="Copy full agent answer"
                  >
                    {copiedStepIndex === idx ? (
                      <>
                        <Check size={13} className="text-emerald-400" />
                        <span className="text-emerald-300 text-[10px]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span className="text-[10px] hidden sm:inline">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Agent Full Answer Body */}
              <div className="p-4 sm:p-5 text-slate-100 text-sm leading-relaxed overflow-hidden">
                {isShowingRaw ? (
                  <div className="rounded-xl bg-black/70 border border-white/10 p-3.5 overflow-x-auto max-h-[500px] overflow-y-auto">
                    <pre className="font-mono text-xs text-cyan-200 leading-relaxed whitespace-pre-wrap break-words m-0">
                      {raw}
                    </pre>
                  </div>
                ) : (
                  <FormattedText content={formatted} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
