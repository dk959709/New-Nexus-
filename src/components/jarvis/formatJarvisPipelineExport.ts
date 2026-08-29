import { JarvisExecutionStep, JarvisMessage } from '../../types';
import { stripConversationalMetaText } from '../../lib/format';

function formatAgentStep(step: JarvisExecutionStep): string {
  const agentTitle = step.name ? step.name.toUpperCase() : step.agentId.toUpperCase();
  const raw = step.rawOutput || step.outputPreview || step.summary || '';
  if (!raw) return '';

  const trimmed = raw.trim();

  // Try parsing structured JSON
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      const parsed = JSON.parse(trimmed);

      // 1. Planner Agent
      if (step.agentId === 'planner' && typeof parsed === 'object' && parsed !== null) {
        const pObj = parsed as Record<string, unknown>;
        const task = String(pObj.task || 'Autonomous query execution');
        const plan = Array.isArray(pObj.plan) ? pObj.plan : [];
        const needsDiagram = Boolean(pObj.needsDiagram);
        const needsChart = Boolean(pObj.needsChart);
        const needsImage = Boolean(pObj.needsImage);
        const needsResearch = Boolean(pObj.needsResearch ?? true);
        const needsFactCheck = Boolean(pObj.needsFactCheck ?? true);
        const needsReview = Boolean(pObj.needsReview ?? true);

        const lines: string[] = [
          `=== PLANNER ===`,
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
      if (step.agentId === 'researcher' && typeof parsed === 'object' && parsed !== null) {
        const rObj = parsed as Record<string, unknown>;
        const facts = Array.isArray(rObj.facts) ? rObj.facts : [];
        const context = typeof rObj.context === 'string' ? rObj.context : '';
        const keyInsights = Array.isArray(rObj.keyInsights) ? rObj.keyInsights : [];

        const lines: string[] = [`=== RESEARCHER ===`];

        if (facts.length > 0) {
          lines.push(`Core Facts & Intelligence:`);
          facts.forEach((fact) => {
            lines.push(`- ${String(fact)}`);
          });
          lines.push(``);
        }

        if (keyInsights.length > 0) {
          lines.push(`Key Empirical Insights:`);
          keyInsights.forEach((insight) => {
            lines.push(`- ${String(insight)}`);
          });
          lines.push(``);
        }

        if (context) {
          lines.push(`Contextual Background:`);
          lines.push(context);
        }

        return lines.join('\n').trim();
      }

      // 3. Fact Checker Agent
      if (step.agentId === 'factChecker' && typeof parsed === 'object' && parsed !== null) {
        const fObj = parsed as Record<string, unknown>;
        const summary = typeof fObj.summary === 'string' ? fObj.summary : 'All claims verified.';
        const verified = Array.isArray(fObj.verified) ? fObj.verified : [];
        const issues = Array.isArray(fObj.issues) ? fObj.issues : [];

        const lines: string[] = [
          `=== FACT CHECKER ===`,
          `Verification Status: ${summary}`,
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
      if (step.agentId === 'reviewer' && typeof parsed === 'object' && parsed !== null) {
        const rvObj = parsed as Record<string, unknown>;
        const recommendation =
          typeof rvObj.recommendation === 'string'
            ? rvObj.recommendation
            : 'Proceed with comprehensive synthesis.';
        const critique = typeof rvObj.critique === 'string' ? rvObj.critique : '';
        const score = typeof rvObj.score === 'number' ? rvObj.score : null;

        const lines: string[] = [`=== REVIEWER ===`];
        lines.push(`Verdict & Recommendation: ${recommendation}`);
        if (score !== null) {
          lines.push(`Quality Score: ${score}/100`);
        }

        if (critique) {
          lines.push(``);
          lines.push(`Editorial Critique & Refinements:`);
          lines.push(critique);
        }

        return lines.join('\n').trim();
      }

      // 5. Generic structured JSON agent
      return [`=== ${agentTitle} ===`, JSON.stringify(parsed, null, 2)].join('\n');
    } catch {
      // Not valid JSON, fallback to plain text below
    }
  }

  // Plain text fallback
  return [`=== ${agentTitle} ===`, trimmed].join('\n');
}

/**
 * Generates a unified, well-formatted text export of the ENTIRE pipeline output,
 * including Planner, Researcher, Fact Checker, Reviewer, custom agent nodes,
 * Final Synthesis answer, and grounded sources.
 */
export function formatFullPipelineExport(msg: JarvisMessage): string {
  const sections: string[] = [];

  // Header
  const dateStr = msg.timestamp
    ? new Date(msg.timestamp).toLocaleString()
    : new Date().toLocaleString();

  sections.push(`========================================`);
  sections.push(`JARVIS INTELLIGENCE REPORT`);
  sections.push(`Query: ${msg.query || 'Inquiry'}`);
  sections.push(`Mode: ${msg.deepResearch ? 'Autonomous Multi-Agent Deep Research' : 'Standard Synthesis'}`);
  sections.push(`Timestamp: ${dateStr}`);
  sections.push(`========================================`);

  // Pipeline Agent Steps (Planner, Researcher, Fact Checker, Reviewer, etc.)
  if (msg.steps && msg.steps.length > 0) {
    const completedSteps = msg.steps.filter(
      (s) => s.status === 'completed' && s.agentId !== 'finalSynthesizer',
    );

    completedSteps.forEach((step) => {
      const stepText = formatAgentStep(step);
      if (stepText) {
        sections.push(``);
        sections.push(stepText);
      }
    });
  }

  // Final Synthesis Section
  const cleanAns = stripConversationalMetaText(msg.answer) || msg.answer;
  sections.push(``);
  sections.push(`=== FINAL SYNTHESIS ===`);
  sections.push(cleanAns);

  // Grounded Sources Section
  if (msg.sources && msg.sources.length > 0) {
    sections.push(``);
    sections.push(`=== GROUNDED SOURCES ===`);
    const cleanHtml = (str: string): string => {
      if (!str) return '';
      let cleaned = str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
      cleaned = cleaned.replace(/<[^>]+>/g, '');
      cleaned = cleaned
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ');
      return cleaned.trim();
    };

    msg.sources.forEach((s, idx) => {
      const cleanTitle = cleanHtml(s.title || 'Source');
      let sourceLine = `[${idx + 1}] ${cleanTitle}`;
      if (s.url) {
        sourceLine += ` (${s.url})`;
      } else if (s.domain) {
        sourceLine += ` [${s.domain}]`;
      }
      if (s.description) {
        const cleanDesc = cleanHtml(s.description);
        if (cleanDesc) {
          sourceLine += `\n    - ${cleanDesc}`;
        }
      }
      sections.push(sourceLine);
    });
  }

  return sections.join('\n');
}
