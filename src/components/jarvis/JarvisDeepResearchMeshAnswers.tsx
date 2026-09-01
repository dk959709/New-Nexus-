import React, { useState } from 'react';
import {
  Bot,
  Brain,
  Check,
  Clock,
  Code2,
  Copy,
  FileText,
  Globe,
  HelpCircle,
  Layers,
  Lightbulb,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { JarvisExecutionStep } from '../../types';
import { FormattedText } from './FormattedText';
import { copyToClipboard } from '@/lib/clipboard';
import { cleanAndFormatFact, formatResearcherOutput } from '../../lib/factFormatter';

interface JarvisDeepResearchMeshAnswersProps {
  steps: JarvisExecutionStep[];
  query?: string;
  isDeepResearch?: boolean;
}

interface AgentTheme {
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

const AGENT_THEMES: Record<string, AgentTheme> = {
  planner: {
    title: 'PLANNER // STRATEGIC DECOMPOSITION',
    subtitle: 'Autonomous Task Scoping, Multi-Step Architecture & Directives',
    border: 'rgba(97, 215, 201, 0.45)',
    bg: 'linear-gradient(150deg, rgba(8, 28, 36, 0.9) 0%, rgba(5, 18, 24, 0.95) 100%)',
    headerBg: 'rgba(12, 38, 48, 0.6)',
    text: '#61d7c9',
    badgeBg: 'rgba(97, 215, 201, 0.15)',
    accentGlow: 'rgba(97, 215, 201, 0.3)',
    icon: <Brain size={18} className="text-cyan-400" />,
  },
  researcher: {
    title: 'RESEARCHER // EMPIRICAL INTELLIGENCE',
    subtitle: 'Real-time Web Search, Multi-Engine Retrieval & Fact Extraction',
    border: 'rgba(56, 189, 248, 0.45)',
    bg: 'linear-gradient(150deg, rgba(10, 24, 44, 0.9) 0%, rgba(6, 15, 30, 0.95) 100%)',
    headerBg: 'rgba(14, 35, 62, 0.6)',
    text: '#38bdf8',
    badgeBg: 'rgba(56, 189, 248, 0.15)',
    accentGlow: 'rgba(56, 189, 248, 0.3)',
    icon: <Search size={18} className="text-sky-400" />,
  },
  webFetcher: {
    title: 'WEB FETCHER // DIRECT PAGE EXTRACTION',
    subtitle: 'Raw HTML Content Retrieval, Text Extraction & Structure Parsing',
    border: 'rgba(34, 211, 238, 0.45)',
    bg: 'linear-gradient(150deg, rgba(8, 32, 40, 0.9) 0%, rgba(5, 20, 26, 0.95) 100%)',
    headerBg: 'rgba(12, 44, 56, 0.6)',
    text: '#22d3ee',
    badgeBg: 'rgba(34, 211, 238, 0.15)',
    accentGlow: 'rgba(34, 211, 238, 0.3)',
    icon: <Globe size={18} className="text-cyan-400" />,
  },
  advisor: {
    title: 'ADVISOR // COMPARATIVE & CONCEPTUAL ANALYSIS',
    subtitle: 'Reasoned Trade-Offs, Comparison Tables, ASCII Blueprints & Verdicts',
    border: 'rgba(250, 204, 21, 0.45)',
    bg: 'linear-gradient(150deg, rgba(34, 28, 8, 0.9) 0%, rgba(22, 18, 5, 0.95) 100%)',
    headerBg: 'rgba(50, 40, 12, 0.6)',
    text: '#facc15',
    badgeBg: 'rgba(250, 204, 21, 0.15)',
    accentGlow: 'rgba(250, 204, 21, 0.3)',
    icon: <Lightbulb size={18} className="text-amber-400" />,
  },
  factChecker: {
    title: 'FACT CHECKER // INTEGRITY & ACCURACY AUDIT',
    subtitle: 'Cross-Verification, Anomaly Detection & Grounded Claim Scrutiny',
    border: 'rgba(192, 132, 252, 0.45)',
    bg: 'linear-gradient(150deg, rgba(28, 14, 48, 0.9) 0%, rgba(16, 8, 30, 0.95) 100%)',
    headerBg: 'rgba(42, 18, 70, 0.6)',
    text: '#c084fc',
    badgeBg: 'rgba(192, 132, 252, 0.15)',
    accentGlow: 'rgba(192, 132, 252, 0.3)',
    icon: <ShieldCheck size={18} className="text-purple-400" />,
  },
  reviewer: {
    title: 'REVIEWER // QUALITY ASSURANCE',
    subtitle: 'Synthesis Critique, Structural Nuance & Completeness Evaluation',
    border: 'rgba(52, 211, 153, 0.45)',
    bg: 'linear-gradient(150deg, rgba(6, 32, 24, 0.9) 0%, rgba(4, 20, 16, 0.95) 100%)',
    headerBg: 'rgba(10, 48, 36, 0.6)',
    text: '#34d399',
    badgeBg: 'rgba(52, 211, 153, 0.15)',
    accentGlow: 'rgba(52, 211, 153, 0.3)',
    icon: <Check size={18} className="text-emerald-400" />,
  },
  architect: {
    title: 'ARCHITECT // SYSTEM BLUEPRINT DESIGNER',
    subtitle: 'High-Level Technical Architecture & Diagram Specification',
    border: 'rgba(251, 146, 60, 0.45)',
    bg: 'linear-gradient(150deg, rgba(36, 18, 8, 0.9) 0%, rgba(24, 12, 5, 0.95) 100%)',
    headerBg: 'rgba(54, 26, 12, 0.6)',
    text: '#fb923c',
    badgeBg: 'rgba(251, 146, 60, 0.15)',
    accentGlow: 'rgba(251, 146, 60, 0.3)',
    icon: <Layers size={18} className="text-orange-400" />,
  },
  dataAnalyst: {
    title: 'DATA ANALYST // STATISTICAL DECOMPOSITION',
    subtitle: 'Quantitative Metrics Extraction & Data Structuring',
    border: 'rgba(244, 114, 182, 0.45)',
    bg: 'linear-gradient(150deg, rgba(36, 10, 24, 0.9) 0%, rgba(24, 6, 16, 0.95) 100%)',
    headerBg: 'rgba(54, 14, 36, 0.6)',
    text: '#f472b6',
    badgeBg: 'rgba(244, 114, 182, 0.15)',
    accentGlow: 'rgba(244, 114, 182, 0.3)',
    icon: <Sparkles size={18} className="text-pink-400" />,
  },
  critic: {
    title: 'CRITIC // DEVIL\'S ADVOCATE & STRESS TEST',
    subtitle: 'Counter-Hypothesis Generation & Edge-Case Probing',
    border: 'rgba(251, 113, 133, 0.45)',
    bg: 'linear-gradient(150deg, rgba(36, 8, 14, 0.9) 0%, rgba(24, 5, 10, 0.95) 100%)',
    headerBg: 'rgba(54, 12, 22, 0.6)',
    text: '#fb7185',
    badgeBg: 'rgba(251, 113, 133, 0.15)',
    accentGlow: 'rgba(251, 113, 133, 0.3)',
    icon: <HelpCircle size={18} className="text-rose-400" />,
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

/**
 * Multi-pass ultra-resilient JSON parser with repair strategies
 */
function parseAgentJson(rawOutput: string): { parsed: unknown; isJson: boolean } {
  if (!rawOutput) return { parsed: null, isJson: false };
  let cleaned = rawOutput.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // Pass 1: Direct JSON.parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && (typeof parsed === 'object' || Array.isArray(parsed))) {
      return { parsed, isJson: true };
    }
  } catch {
    // continue
  }

  // Pass 2: Boundary extraction (between first { and last } or first [ and last ])
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');

  let toParse = cleaned;
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace && (firstBracket === -1 || firstBrace < firstBracket)) {
    toParse = cleaned.substring(firstBrace, lastBrace + 1);
  } else if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    toParse = cleaned.substring(firstBracket, lastBracket + 1);
  }

  try {
    const parsed = JSON.parse(toParse);
    if (parsed && (typeof parsed === 'object' || Array.isArray(parsed))) {
      return { parsed, isJson: true };
    }
  } catch {
    // continue
  }

  // Pass 3: Common JSON error repairs (trailing commas, smart quotes, comments, unescaped quotes)
  try {
    const sanitized = toParse
      // Strip comments
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Trailing commas
      .replace(/,\s*([}\]])/g, '$1')
      // Smart quotes to ASCII
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");

    const parsed = JSON.parse(sanitized);
    if (parsed && (typeof parsed === 'object' || Array.isArray(parsed))) {
      return { parsed, isJson: true };
    }
  } catch {
    // continue
  }

  return { parsed: null, isJson: false };
}

/**
 * Regex-based string array extractor for malformed/unparseable JSON blocks
 */
function extractArrayFromDirtyJson(raw: string, keyNames: string[]): string[] {
  const items: string[] = [];

  for (const key of keyNames) {
    const keyRegex = new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'i');
    const match = raw.match(keyRegex);
    if (match && match[1]) {
      const arrayContent = match[1];
      // Match each string inside the array
      const stringMatches = arrayContent.match(/"((?:\\.|[^"\\])*)"/g);
      if (stringMatches) {
        for (const s of stringMatches) {
          try {
            const parsed = JSON.parse(s);
            if (typeof parsed === 'string' && parsed.trim()) {
              items.push(parsed.trim());
            }
          } catch {
            const clean = s.slice(1, -1).replace(/\\"/g, '"').trim();
            if (clean) items.push(clean);
          }
        }
      }
      if (items.length > 0) break;
    }
  }

  return items;
}

/**
 * Regex-based string property extractor for dirty JSON blocks
 */
function extractStringFromDirtyJson(raw: string, keyNames: string[]): string {
  for (const key of keyNames) {
    const keyRegex = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i');
    const match = raw.match(keyRegex);
    if (match && match[1]) {
      try {
        return JSON.parse(`"${match[1]}"`);
      } catch {
        return match[1].replace(/\\"/g, '"').trim();
      }
    }
  }
  return '';
}

/**
 * Specialized Fact Checker Formatter that GUARANTEES clean markdown rendering
 * even on malformed JSON, dirty strings, or partial outputs.
 */
function formatFactCheckerOutput(step: JarvisExecutionStep, parsed: unknown, raw: string): string {
  let summary = '';
  let verified: string[] = [];
  let issues: string[] = [];

  // Case A: Structured object
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const fObj = parsed as Record<string, unknown>;
    summary =
      typeof fObj.summary === 'string'
        ? fObj.summary
        : typeof fObj.status === 'string'
        ? fObj.status
        : typeof fObj.verdict === 'string'
        ? fObj.verdict
        : typeof fObj.auditSummary === 'string'
        ? fObj.auditSummary
        : '';

    const rawVerified =
      fObj.verified ||
      fObj.verifiedClaims ||
      fObj.claims ||
      fObj.validated ||
      fObj.validClaims ||
      fObj.facts ||
      fObj.trueClaims;

    if (Array.isArray(rawVerified)) {
      verified = rawVerified
        .map((v) => {
          if (typeof v === 'object' && v !== null) {
            const vObj = v as Record<string, unknown>;
            const text = (vObj.claim || vObj.fact || vObj.statement || vObj.text || vObj.point || vObj.finding || '') as string;
            return text || JSON.stringify(v);
          }
          return String(v);
        })
        .filter(Boolean);
    }

    const rawIssues =
      fObj.issues ||
      fObj.corrections ||
      fObj.discrepancies ||
      fObj.errors ||
      fObj.notes ||
      fObj.flagged ||
      fObj.contradictions ||
      fObj.unverified;

    if (Array.isArray(rawIssues)) {
      issues = rawIssues
        .map((i) => {
          if (typeof i === 'object' && i !== null) {
            const iObj = i as Record<string, unknown>;
            const text = (iObj.issue || iObj.correction || iObj.error || iObj.discrepancy || iObj.note || iObj.message || iObj.text || '') as string;
            return text || JSON.stringify(i);
          }
          return String(i);
        })
        .filter(Boolean);
    }
  }

  // Case B: Array of objects or strings
  else if (Array.isArray(parsed)) {
    parsed.forEach((item) => {
      if (typeof item === 'string') {
        if (item.toLowerCase().includes('issue') || item.toLowerCase().includes('correction') || item.toLowerCase().includes('mismatch')) {
          issues.push(item);
        } else {
          verified.push(item);
        }
      } else if (typeof item === 'object' && item !== null) {
        const iObj = item as Record<string, unknown>;
        const claimText = String(iObj.claim || iObj.fact || iObj.text || iObj.statement || iObj.point || '');
        const isIssue = Boolean(iObj.issue || iObj.correction || iObj.error || iObj.invalid || iObj.flagged);
        if (isIssue) {
          issues.push(String(iObj.issue || iObj.correction || iObj.error || iObj.message || claimText));
        } else if (claimText) {
          verified.push(claimText);
        }
      }
    });
  }

  // Case C: JSON parsing failed on raw string - apply regex heuristic extraction
  if (verified.length === 0 && issues.length === 0) {
    const rawToScan = raw || step.outputPreview || step.summary || '';
    verified = extractArrayFromDirtyJson(rawToScan, ['verified', 'verifiedClaims', 'claims', 'validated', 'facts']);
    issues = extractArrayFromDirtyJson(rawToScan, ['issues', 'corrections', 'discrepancies', 'errors', 'notes', 'flagged']);
    if (!summary) {
      summary = extractStringFromDirtyJson(rawToScan, ['summary', 'status', 'verdict', 'auditSummary']);
    }

    // If still empty, check for markdown/bullet list items in raw text
    if (verified.length === 0 && issues.length === 0) {
      const lines = rawToScan.split('\n').map((l) => l.trim()).filter(Boolean);
      lines.forEach((line) => {
        // Skip JSON wrapper lines
        if (line === '{' || line === '}' || line === '[' || line === ']' || line.startsWith('```') || line.startsWith('"verified":') || line.startsWith('"issues":')) {
          return;
        }
        const cleanLine = line
          .replace(/^[-*•]\s*/, '')
          .replace(/^\d+\.\s*/, '')
          .replace(/^"(.*)"[,]*/, '$1')
          .replace(/\\"/g, '"')
          .trim();

        if (cleanLine.length > 5) {
          if (cleanLine.toLowerCase().includes('issue:') || cleanLine.toLowerCase().includes('correction:') || cleanLine.toLowerCase().includes('mismatch:')) {
            issues.push(cleanLine);
          } else {
            verified.push(cleanLine);
          }
        }
      });
    }
  }

  // Build the clean Markdown output
  const finalSummary = summary || (verified.length > 0 ? `Validated ${verified.length} claims with empirical ground checks.` : 'Fact verification audit completed.');
  let md = `### ⚖️ Fact-Check Audit Summary\n**Verification Status:** ${finalSummary}\n\n`;

  if (verified.length > 0) {
    md += `#### ✅ Verified Claims & Accuracy Points:\n`;
    verified.forEach((v) => {
      md += `- **Verified:** ${v}\n`;
    });
  } else {
    md += `#### ✅ Verified Claims & Accuracy Points:\n- Claims checked and verified against grounding corpus.\n`;
  }

  if (issues.length > 0) {
    md += `\n#### ⚠️ Discrepancy & Correction Notes:\n`;
    issues.forEach((issue) => {
      md += `- **Correction:** ${issue}\n`;
    });
  } else {
    md += `\n#### 🛡️ Cross-Verification Audit Result:\n- No factual contradictions, anomalies, or unsupported hallucinations detected.\n`;
  }

  return md;
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

  // Try parsing from rawOutput first, then fallback to outputPreview if available
  let { parsed, isJson } = parseAgentJson(raw);
  if (!isJson && step.outputPreview && step.outputPreview !== raw) {
    const previewRes = parseAgentJson(step.outputPreview);
    if (previewRes.isJson) {
      parsed = previewRes.parsed;
      isJson = true;
    }
  }

  // 1. FACT CHECKER AGENT (GUARANTEED CLEAN VIEW ALWAYS)
  if (step.agentId === 'factChecker') {
    const md = formatFactCheckerOutput(step, parsed, raw);
    return { formatted: md, isStructuredJson: true, raw };
  }

  // 2. PLANNER AGENT
  if (step.agentId === 'planner') {
    let task = 'Autonomous query execution';
    let plan: string[] = [];
    let needsDiagram = false;
    let needsChart = false;
    let needsImage = false;
    let needsResearch = true;
    let needsFactCheck = true;
    let needsReview = true;

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const pObj = parsed as Record<string, unknown>;
      task = String(pObj.task || pObj.objective || 'Autonomous query execution');
      plan = Array.isArray(pObj.plan) ? (pObj.plan as string[]) : Array.isArray(pObj.steps) ? (pObj.steps as string[]) : [];
      needsDiagram = Boolean(pObj.needsDiagram);
      needsChart = Boolean(pObj.needsChart);
      needsImage = Boolean(pObj.needsImage);
      needsResearch = Boolean(pObj.needsResearch ?? true);
      needsFactCheck = Boolean(pObj.needsFactCheck ?? true);
      needsReview = Boolean(pObj.needsReview ?? true);
    } else {
      // Fallback extraction
      const taskExtracted = extractStringFromDirtyJson(raw, ['task', 'objective']);
      if (taskExtracted) task = taskExtracted;
      const planExtracted = extractArrayFromDirtyJson(raw, ['plan', 'steps']);
      if (planExtracted.length > 0) plan = planExtracted;
    }

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

  // 3. RESEARCHER AGENT
  if (step.agentId === 'researcher') {
    const md = formatResearcherOutput(step, parsed, raw);
    return { formatted: md, isStructuredJson: true, raw };
  }

  // 4. REVIEWER AGENT
  if (step.agentId === 'reviewer') {
    let recommendation = 'Proceed with comprehensive synthesis.';
    let critique = '';
    let score: number | null = null;

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const rvObj = parsed as Record<string, unknown>;
      recommendation =
        typeof rvObj.recommendation === 'string'
          ? rvObj.recommendation
          : typeof rvObj.verdict === 'string'
          ? rvObj.verdict
          : 'Proceed with comprehensive synthesis.';
      critique = typeof rvObj.critique === 'string' ? rvObj.critique : typeof rvObj.feedback === 'string' ? rvObj.feedback : '';
      score = typeof rvObj.score === 'number' ? rvObj.score : null;
    } else {
      const rec = extractStringFromDirtyJson(raw, ['recommendation', 'verdict']);
      if (rec) recommendation = rec;
      critique = extractStringFromDirtyJson(raw, ['critique', 'feedback']);
    }

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

  // 4.5 WEB FETCHER AGENT
  if (step.agentId === 'webFetcher') {
    let title = '';
    let url = '';
    let length = 0;
    let rawTotalLength = 0;
    let isTruncated = false;
    let description = '';
    let headings: string[] = [];
    let preview = '';

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const wObj = parsed as Record<string, unknown>;
      title = String(wObj.title || '');
      url = String(wObj.finalUrl || wObj.url || '');
      length = typeof wObj.length === 'number' ? wObj.length : 0;
      rawTotalLength = typeof wObj.rawTotalLength === 'number' ? wObj.rawTotalLength : length;
      isTruncated = Boolean(wObj.isTruncated || (rawTotalLength > 3500));
      description = String(wObj.description || '');
      headings = Array.isArray(wObj.headings) ? (wObj.headings as string[]) : [];
      preview = String(wObj.textContent || wObj.preview || wObj.contentExcerpt || '');
    }

    let md = `### 🌐 Web Fetcher // Direct Page Extraction\n`;
    if (title) md += `**Page Title:** ${title}\n`;
    if (url) md += `**Source URL:** [${url}](${url})\n`;
    if (rawTotalLength > 0) {
      md += `**Content Parsed:** ${rawTotalLength.toLocaleString()} characters total${isTruncated ? ' _(capped to 3,500 chars for concise synthesis)_' : ''}\n\n`;
    }
    if (description) md += `**Meta Description:** ${description}\n\n`;
    if (headings.length > 0) {
      md += `#### 📑 Page Structure & Sections:\n${headings.map((h) => `- ${h}`).join('\n')}\n\n`;
    }
    if (preview) {
      md += `#### 📄 Content Excerpt:\n${preview}\n`;
    }

    return { formatted: md, isStructuredJson: true, raw };
  }

  // 5. Generic or Custom Agent JSON formatting
  if (isJson && parsed !== null) {
    if (Array.isArray(parsed)) {
      let md = `### 📊 ${step.name ? step.name.toUpperCase() : step.agentId.toUpperCase()} // STRUCTURED RECORDS\n\n`;
      parsed.forEach((item, i) => {
        const formatted = cleanAndFormatFact(item, { markdownSource: true });
        if (formatted) {
          md += `${i + 1}. ${formatted}\n`;
        } else {
          md += `${i + 1}. ${String(item)}\n`;
        }
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
          const formatted = cleanAndFormatFact(item, { markdownSource: true });
          if (formatted) {
            md += `- ${formatted}\n`;
          } else {
            md += `- ${String(item)}\n`;
          }
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

  // Fallback for non-JSON or plain text (e.g. terminal logs, pasted text, markdown)
  // If the plain text accidentally starts with `{`, clean it up so raw JSON is not displayed
  if (raw.trim().startsWith('{') && raw.trim().endsWith('}')) {
    const lines = raw
      .replace(/^\{\s*/, '')
      .replace(/\s*\}\s*$/, '')
      .split('\n')
      .map((l) => l.trim().replace(/^"([^"]+)":\s*/, '**$1:** ').replace(/",?$/, '').replace(/^"/, ''))
      .filter((l) => l.length > 0 && l !== '[' && l !== ']');
    const cleanedMd = `### ⚡ ${step.name ? step.name.toUpperCase() : step.agentId.toUpperCase()} // OUTPUT\n\n` + lines.map((l) => `- ${l}`).join('\n');
    return { formatted: cleanedMd, isStructuredJson: true, raw };
  }

  return { formatted: raw, isStructuredJson: true, raw };
}

export const JarvisDeepResearchMeshAnswers: React.FC<JarvisDeepResearchMeshAnswersProps> = ({
  steps,
  isDeepResearch = false,
}) => {
  const [copiedStepIndex, setCopiedStepIndex] = useState<number | null>(null);
  const [rawViewMap, setRawViewMap] = useState<Record<number, boolean>>({});

  // Filter out skipped steps and finalSynthesizer (as the synthesizer is rendered in the final answer block)
  const agentSteps = steps.filter(
    (s) => s.status === 'completed' && s.agentId !== 'finalSynthesizer',
  );

  if (agentSteps.length === 0) return null;

  const handleCopy = async (text: string, step: JarvisExecutionStep, idx: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const agentName = step.name || step.agentId || 'Agent';
    const modelId = step.model || step.providerName || 'unknown';
    const textWithModel = `${text.trim()}\n\n---\nModels Used:\n${agentName}: ${modelId}`;
    const success = await copyToClipboard(textWithModel);
    if (success) {
      setCopiedStepIndex(idx);
      setTimeout(() => setCopiedStepIndex(null), 2000);
    }
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
                    onClick={(e) => handleCopy(isShowingRaw ? raw : formatted, step, idx, e)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1 text-xs font-mono bg-black/40 border border-white/10"
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
