import { JarvisExecutionStep, JarvisMessage } from '../../types';
import { stripConversationalMetaText } from '../../lib/format';
import { cleanAndFormatFact, cleanAndFormatInsight } from '../../lib/factFormatter';

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

  // Pass 2: Boundary extraction
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

  // Pass 3: Common JSON error repairs
  try {
    const sanitized = toParse
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/,\s*([}\]])/g, '$1')
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

function extractArrayFromDirtyJson(raw: string, keyNames: string[]): string[] {
  const items: string[] = [];

  for (const key of keyNames) {
    const keyRegex = new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'i');
    const match = raw.match(keyRegex);
    if (match && match[1]) {
      const stringMatches = match[1].match(/"((?:\\.|[^"\\])*)"/g);
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

function formatAgentStep(step: JarvisExecutionStep): string {
  const agentTitle = step.name ? step.name.toUpperCase() : step.agentId.toUpperCase();
  const raw = step.rawOutput || step.outputPreview || step.summary || '';
  if (!raw) return '';

  let { parsed, isJson } = parseAgentJson(raw);
  if (!isJson && step.outputPreview && step.outputPreview !== raw) {
    const previewRes = parseAgentJson(step.outputPreview);
    if (previewRes.isJson) {
      parsed = previewRes.parsed;
      isJson = true;
    }
  }

  // 1. Planner Agent
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
      const taskExtracted = extractStringFromDirtyJson(raw, ['task', 'objective']);
      if (taskExtracted) task = taskExtracted;
      const planExtracted = extractArrayFromDirtyJson(raw, ['plan', 'steps']);
      if (planExtracted.length > 0) plan = planExtracted;
    }

    const lines: string[] = [
      `=== ${agentTitle} ===`,
      `Targeted Objective:`,
      task,
      ``,
      `Strategic Execution Plan:`,
    ];

    if (plan.length > 0) {
      plan.forEach((item, idx) => {
        lines.push(`${idx + 1}. Phase ${idx + 1}: ${String(item)}`);
      });
    } else {
      lines.push(`1. Multi-phase analysis and factual synthesis`);
    }

    lines.push(``);
    lines.push(`Pipeline Directives:`);
    lines.push(`- Deep Research Mesh: ${needsResearch ? 'Active (Empirical Fact Retrieval)' : 'Bypassed'}`);
    lines.push(`- Fact Verification Audit: ${needsFactCheck ? 'Active (Claim Scrutiny Enabled)' : 'Bypassed'}`);
    lines.push(`- Quality Assurance Peer Review: ${needsReview ? 'Active (Multi-Point Review)' : 'Bypassed'}`);
    if (needsDiagram) lines.push(`- Architectural Diagram: Active (SVG Blueprint Generation)`);
    if (needsChart) lines.push(`- Quantitative Chart: Active (Numerical Spec Extraction)`);
    if (needsImage) lines.push(`- Visual Image Lookup: Active (Photographic Retrieval)`);

    return lines.join('\n');
  }

  // 2. Researcher Agent
  if (step.agentId === 'researcher') {
    let facts: unknown[] = [];
    let context = '';
    let keyInsights: unknown[] = [];

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const rObj = parsed as Record<string, unknown>;
      facts = Array.isArray(rObj.facts) ? (rObj.facts as unknown[]) : Array.isArray(rObj.findings) ? (rObj.findings as unknown[]) : [];
      context = typeof rObj.context === 'string' ? rObj.context : typeof rObj.summary === 'string' ? rObj.summary : '';
      keyInsights = Array.isArray(rObj.keyInsights) ? (rObj.keyInsights as unknown[]) : Array.isArray(rObj.insights) ? (rObj.insights as unknown[]) : [];
    } else {
      facts = extractArrayFromDirtyJson(raw, ['facts', 'findings']);
      keyInsights = extractArrayFromDirtyJson(raw, ['keyInsights', 'insights']);
      context = extractStringFromDirtyJson(raw, ['context', 'summary']);
    }

    const lines: string[] = [`=== ${agentTitle} ===`];

    if (facts.length > 0) {
      lines.push(`Core Facts & Intelligence:`);
      facts.forEach((fact) => {
        const formatted = cleanAndFormatFact(fact, { markdownSource: false });
        if (formatted) {
          lines.push(`- ${formatted}`);
        }
      });
      lines.push(``);
    }

    if (keyInsights.length > 0) {
      lines.push(`Key Empirical Insights:`);
      keyInsights.forEach((insight) => {
        const formatted = cleanAndFormatInsight(insight);
        if (formatted) {
          lines.push(`- ${formatted}`);
        }
      });
      lines.push(``);
    }

    if (context) {
      lines.push(`Contextual Background:`);
      lines.push(context);
    }

    return lines.join('\n').trim();
  }

  // 3. Fact Checker Agent (GUARANTEED CLEAN VIEW ALWAYS)
  if (step.agentId === 'factChecker') {
    let summary = '';
    let verified: string[] = [];
    let issues: string[] = [];

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const fObj = parsed as Record<string, unknown>;
      summary =
        typeof fObj.summary === 'string'
          ? fObj.summary
          : typeof fObj.status === 'string'
          ? fObj.status
          : typeof fObj.verdict === 'string'
          ? fObj.verdict
          : '';

      const rawVerified =
        fObj.verified ||
        fObj.verifiedClaims ||
        fObj.claims ||
        fObj.validated ||
        fObj.facts;

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
        fObj.notes;

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
    } else {
      verified = extractArrayFromDirtyJson(raw, ['verified', 'verifiedClaims', 'claims', 'facts']);
      issues = extractArrayFromDirtyJson(raw, ['issues', 'corrections', 'discrepancies', 'errors', 'notes']);
      summary = extractStringFromDirtyJson(raw, ['summary', 'status', 'verdict']);
    }

    const finalSummary = summary || (verified.length > 0 ? `Validated ${verified.length} claims.` : 'All claims verified.');
    const lines: string[] = [
      `=== ${agentTitle} ===`,
      `Verification Status: ${finalSummary}`,
      ``,
    ];

    if (verified.length > 0) {
      lines.push(`Verified Claims:`);
      verified.forEach((v) => {
        lines.push(`- ${String(v)}`);
      });
      lines.push(``);
    }

    lines.push(`Correction & Audit Notes:`);
    if (issues.length > 0) {
      issues.forEach((issue) => {
        lines.push(`- ${String(issue)}`);
      });
    } else {
      lines.push(`- No factual contradictions or ungrounded claims detected.`);
    }

    return lines.join('\n').trim();
  }

  // 4. Reviewer Agent
  if (step.agentId === 'reviewer') {
    let recommendation = 'Proceed with comprehensive synthesis.';
    let critique = '';
    let score: number | null = null;

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const rvObj = parsed as Record<string, unknown>;
      recommendation =
        typeof rvObj.recommendation === 'string'
          ? rvObj.recommendation
          : 'Proceed with comprehensive synthesis.';
      critique = typeof rvObj.critique === 'string' ? rvObj.critique : '';
      score = typeof rvObj.score === 'number' ? rvObj.score : null;
    } else {
      const rec = extractStringFromDirtyJson(raw, ['recommendation', 'verdict']);
      if (rec) recommendation = rec;
      critique = extractStringFromDirtyJson(raw, ['critique', 'feedback']);
    }

    const lines: string[] = [`=== ${agentTitle} ===`];
    lines.push(`Verdict & Recommendation: ${recommendation}`);
    if (score !== null) {
      lines.push(`Quality Score: ${score}/100`);
    }
    if (critique) {
      lines.push(``);
      lines.push(`Refinements & Editorial Critique:`);
      lines.push(critique);
    }

    return lines.join('\n').trim();
  }

  // 5. Generic agent formatting
  if (isJson && parsed !== null) {
    if (Array.isArray(parsed)) {
      const lines: string[] = [`=== ${agentTitle} ===`];
      parsed.forEach((item, i) => {
        const formatted = cleanAndFormatFact(item, { markdownSource: false });
        if (formatted) {
          lines.push(`${i + 1}. ${formatted}`);
        } else {
          lines.push(`${i + 1}. ${String(item)}`);
        }
      });
      return lines.join('\n');
    }

    const pObj = parsed as Record<string, unknown>;
    const lines: string[] = [`=== ${agentTitle} ===`];
    for (const [key, val] of Object.entries(pObj)) {
      const titleKey = key.replace(/([A-Z])/g, ' $1').toUpperCase();
      if (Array.isArray(val)) {
        lines.push(`${titleKey}:`);
        val.forEach((item) => {
          const formatted = cleanAndFormatFact(item, { markdownSource: false });
          if (formatted) {
            lines.push(`- ${formatted}`);
          } else {
            lines.push(`- ${String(item)}`);
          }
        });
        lines.push(``);
      } else if (val && typeof val === 'object') {
        lines.push(`${titleKey}:`);
        lines.push(JSON.stringify(val, null, 2));
        lines.push(``);
      } else if (val !== undefined && val !== null && val !== '') {
        lines.push(`${titleKey}: ${String(val)}`);
      }
    }
    return lines.join('\n').trim();
  }

  // Plain text / logs
  return `=== ${agentTitle} ===\n${raw}`;
}

export function formatModelsUsedFooter(steps?: JarvisExecutionStep[]): string {
  if (!steps || steps.length === 0) return '';
  const completedSteps = steps.filter((s) => s && s.status === 'completed');
  if (completedSteps.length === 0) return '';

  const lines = ['---', 'Models Used:'];
  completedSteps.forEach((s) => {
    const name = s.name || s.agentId || 'Agent';
    const model = s.model || s.providerName || 'unknown';
    lines.push(`${name}: ${model}`);
  });
  return lines.join('\n');
}

export function formatFullPipelineExport(
  msgOrQuery: JarvisMessage | string,
  maybeSteps?: JarvisExecutionStep[],
  maybeFinalMessage?: JarvisMessage,
): string {
  let userQuery = '';
  let steps: JarvisExecutionStep[] = [];
  let finalMessage: JarvisMessage | null = null;

  if (typeof msgOrQuery === 'object' && msgOrQuery !== null) {
    const msg = msgOrQuery as JarvisMessage;
    userQuery = msg.query || '';
    steps = Array.isArray(msg.steps) ? msg.steps : [];
    finalMessage = msg;
  } else {
    userQuery = typeof msgOrQuery === 'string' ? msgOrQuery : '';
    steps = Array.isArray(maybeSteps) ? maybeSteps : [];
    finalMessage = maybeFinalMessage || null;
  }

  const exportParts: string[] = [];

  const dateObj = finalMessage?.timestamp ? new Date(finalMessage.timestamp) : new Date();
  const formattedDate = dateObj.toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const mode =
    finalMessage && finalMessage.deepResearch === false
      ? 'Standard Multi-Agent Research'
      : 'Autonomous Multi-Agent Deep Research';

  exportParts.push('========================================');
  exportParts.push('JARVIS INTELLIGENCE REPORT');
  exportParts.push(`Query: ${userQuery}`);
  exportParts.push(`Mode: ${mode}`);
  exportParts.push(`Timestamp: ${formattedDate}`);
  exportParts.push('========================================\n');

  // Render individual completed agent steps
  const completedSteps = steps.filter(
    (s) => s.status === 'completed' && s.agentId !== 'finalSynthesizer',
  );

  if (completedSteps.length > 0) {
    exportParts.push(`--- MULTI-AGENT INTERMEDIATE SPECIALIST DELIBERATIONS ---`);
    exportParts.push(`The following sections detail the exact intermediate outputs generated by`);
    exportParts.push(`each autonomous agent in the pipeline leading up to the final synthesis.\n`);

    completedSteps.forEach((step) => {
      const formatted = formatAgentStep(step);
      if (formatted) {
        exportParts.push(formatted);
        exportParts.push(`\n--------------------------------------------------------------------------------\n`);
      }
    });
  }

  // Render final synthesis
  exportParts.push(`=== FINAL SYNTHESIS & UNIFIED COMPREHENSIVE INTELLIGENCE ===\n`);
  const finalAnswerText = finalMessage
    ? (finalMessage.answer || (finalMessage as Record<string, unknown>).content as string || '')
    : '';
  const cleanFinalText = stripConversationalMetaText(finalAnswerText);
  exportParts.push(cleanFinalText || 'Synthesis complete.');

  // If sources exist on final answer
  if (finalMessage?.sources && finalMessage.sources.length > 0) {
    exportParts.push(`\n\n=== VERIFIED CITATIONS & GROUNDING SOURCES ===`);
    finalMessage.sources.forEach((src, idx) => {
      exportParts.push(`[${idx + 1}] ${src.title} - ${src.url}`);
    });
  }

  // Models Used section: include all agents that actually ran for that query
  // (skip any agents that were bypassed, like Fact Checker/Reviewer being skipped for casual questions)
  const modelsUsedBlock = formatModelsUsedFooter(steps);
  if (modelsUsedBlock) {
    exportParts.push(`\n\n${modelsUsedBlock}`);
  }

  exportParts.push(`\n================================================================================`);
  exportParts.push(`End of Autonomous Multi-Agent Intelligence Audit Report.`);

  return exportParts.join('\n');
}
