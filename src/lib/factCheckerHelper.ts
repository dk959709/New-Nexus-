import type { JarvisExecutionStep } from '@/types';

export interface FactCheckerNotes {
  issues: string[];
  hasOutdatedOrUnknownDate: boolean;
}

/**
 * Robust JSON extraction helper for dirty or markdown-wrapped JSON strings
 */
function parseJsonSafely(raw: string): unknown {
  if (!raw || typeof raw !== 'string') return null;
  let cleaned = raw.trim();

  // Strip code fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    // Attempt extracting between outer brackets/braces
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
      } catch {
        // continue
      }
    }

    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      try {
        return JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
      } catch {
        // continue
      }
    }
  }

  return null;
}

/**
 * Inspects the fact checker step data (raw output or output preview)
 * to extract any flagged issues and check if any verified claim has
 * dateStatus === 'older' or 'unknown'.
 */
export function extractFactCheckerNotes(steps?: JarvisExecutionStep[]): FactCheckerNotes | null {
  if (!steps || !Array.isArray(steps)) return null;

  const factStep = steps.find((s) => s && s.agentId === 'factChecker' && s.status === 'completed');
  if (!factStep) return null;

  const raw = factStep.rawOutput || factStep.outputPreview || '';
  if (!raw) return null;

  const parsed = parseJsonSafely(raw) || parseJsonSafely(factStep.outputPreview || '');

  const issues: string[] = [];
  let hasOutdatedOrUnknownDate = false;

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const fObj = parsed as Record<string, unknown>;

    // 1. Extract issues array
    const rawIssues =
      fObj.issues ||
      fObj.corrections ||
      fObj.discrepancies ||
      fObj.errors ||
      fObj.flagged;

    if (Array.isArray(rawIssues)) {
      rawIssues.forEach((item) => {
        if (typeof item === 'string' && item.trim()) {
          issues.push(item.trim());
        } else if (typeof item === 'object' && item !== null) {
          const iObj = item as Record<string, unknown>;
          const msg = (iObj.issue || iObj.correction || iObj.error || iObj.message || iObj.text || '') as string;
          if (msg.trim()) {
            issues.push(msg.trim());
          }
        }
      });
    }

    // 2. Check dateStatus in verified array
    const rawVerified =
      fObj.verified ||
      fObj.verifiedClaims ||
      fObj.claims ||
      fObj.validated ||
      fObj.facts;

    if (Array.isArray(rawVerified)) {
      for (const vItem of rawVerified) {
        if (typeof vItem === 'object' && vItem !== null) {
          const vObj = vItem as Record<string, unknown>;
          const status = String(vObj.dateStatus || '').toLowerCase().trim();
          if (status === 'older' || status === 'unknown') {
            hasOutdatedOrUnknownDate = true;
            break;
          }
        } else if (typeof vItem === 'string') {
          // In normalized string representation, tags like [older] or [unknown] might be present
          const lower = vItem.toLowerCase();
          if (
            lower.includes('[older]') ||
            lower.includes('[unknown]') ||
            lower.includes('datestatus: older') ||
            lower.includes('datestatus: unknown')
          ) {
            hasOutdatedOrUnknownDate = true;
            break;
          }
        }
      }
    }
  } else if (typeof raw === 'string') {
    // Regex-based dirty extraction fallback if standard JSON parsing couldn't decode
    const issueMatches = raw.match(/"issues"\s*:\s*\[([\s\S]*?)\]/i);
    if (issueMatches && issueMatches[1]) {
      const stringMatches = issueMatches[1].match(/"((?:\\.|[^"\\])*)"/g);
      if (stringMatches) {
        stringMatches.forEach((s) => {
          try {
            const parsedStr = JSON.parse(s);
            if (typeof parsedStr === 'string' && parsedStr.trim()) {
              issues.push(parsedStr.trim());
            }
          } catch {
            const clean = s.slice(1, -1).replace(/\\"/g, '"').trim();
            if (clean) issues.push(clean);
          }
        });
      }
    }

    if (
      /"dateStatus"\s*:\s*"(?:older|unknown)"/i.test(raw) ||
      /\[older\]/i.test(raw) ||
      /\[unknown\]/i.test(raw)
    ) {
      hasOutdatedOrUnknownDate = true;
    }
  }

  if (issues.length === 0 && !hasOutdatedOrUnknownDate) {
    return null;
  }

  return {
    issues,
    hasOutdatedOrUnknownDate,
  };
}
