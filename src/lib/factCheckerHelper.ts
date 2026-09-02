import type { JarvisExecutionStep } from '@/types';

export interface FactCheckerNotes {
  issues: string[];
  plausibleUnconfirmed: string[];
  fabricatedOrContradicted: string[];
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
  const plausibleUnconfirmed: string[] = [];
  const fabricatedOrContradicted: string[] = [];
  let hasOutdatedOrUnknownDate = false;

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const fObj = parsed as Record<string, unknown>;

    // 1. Extract dedicated categories if present
    const rawPlausible =
      fObj.plausible_unconfirmed ||
      fObj.plausibleUnconfirmed ||
      fObj.unconfirmed ||
      fObj.plausible;
    if (Array.isArray(rawPlausible)) {
      rawPlausible.forEach((item) => {
        const str = typeof item === 'object' && item !== null
          ? String((item as Record<string, unknown>).issue || (item as Record<string, unknown>).claim || (item as Record<string, unknown>).detail || JSON.stringify(item))
          : String(item || '').trim();
        if (str && !plausibleUnconfirmed.includes(str)) plausibleUnconfirmed.push(str);
      });
    }

    const rawFabricated =
      fObj.fabricated_or_contradicted ||
      fObj.fabricatedOrContradicted ||
      fObj.fabricated ||
      fObj.contradicted ||
      fObj.hallucinations;
    if (Array.isArray(rawFabricated)) {
      rawFabricated.forEach((item) => {
        const str = typeof item === 'object' && item !== null
          ? String((item as Record<string, unknown>).issue || (item as Record<string, unknown>).claim || (item as Record<string, unknown>).detail || JSON.stringify(item))
          : String(item || '').trim();
        if (str && !fabricatedOrContradicted.includes(str)) fabricatedOrContradicted.push(str);
      });
    }

    // 2. Extract issues array
    const rawIssues =
      fObj.issues ||
      fObj.corrections ||
      fObj.discrepancies ||
      fObj.errors ||
      fObj.flagged;

    if (Array.isArray(rawIssues)) {
      rawIssues.forEach((item) => {
        let msg = '';
        if (typeof item === 'string' && item.trim()) {
          msg = item.trim();
        } else if (typeof item === 'object' && item !== null) {
          const iObj = item as Record<string, unknown>;
          msg = String(iObj.issue || iObj.correction || iObj.error || iObj.message || iObj.text || '').trim();
        }

        if (msg) {
          issues.push(msg);

          const lower = msg.toLowerCase();
          const isPlausible =
            msg.includes('[PLAUSIBLE BUT UNCONFIRMED]') ||
            lower.includes('unverified event date') ||
            lower.includes('lacks confirmation') ||
            lower.includes('lacks independent') ||
            lower.includes('lacks secondary') ||
            lower.includes('single source');
          const isFabricated =
            msg.includes('[FABRICATED/CONTRADICTED]') ||
            msg.includes('[FABRICATED]') ||
            msg.includes('[CONTRADICTED]') ||
            lower.includes('speculative model') ||
            lower.includes('invented') ||
            lower.includes('fabricated') ||
            lower.includes('hallucinat') ||
            lower.includes('non-existent');

          if (isPlausible && !plausibleUnconfirmed.includes(msg)) {
            plausibleUnconfirmed.push(msg);
          } else if (isFabricated && !fabricatedOrContradicted.includes(msg)) {
            fabricatedOrContradicted.push(msg);
          }
        }
      });
    }

    // 3. Check dateStatus in verified array
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
          let clean = '';
          try {
            const parsedStr = JSON.parse(s);
            if (typeof parsedStr === 'string' && parsedStr.trim()) {
              clean = parsedStr.trim();
            }
          } catch {
            clean = s.slice(1, -1).replace(/\\"/g, '"').trim();
          }
          if (clean) {
            issues.push(clean);
            const lower = clean.toLowerCase();
            if (
              clean.includes('[PLAUSIBLE BUT UNCONFIRMED]') ||
              lower.includes('unverified event date') ||
              lower.includes('lacks confirmation')
            ) {
              if (!plausibleUnconfirmed.includes(clean)) plausibleUnconfirmed.push(clean);
            } else if (
              clean.includes('[FABRICATED/CONTRADICTED]') ||
              clean.includes('[FABRICATED]') ||
              lower.includes('speculative model') ||
              lower.includes('invented') ||
              lower.includes('fabricated')
            ) {
              if (!fabricatedOrContradicted.includes(clean)) fabricatedOrContradicted.push(clean);
            }
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

  if (issues.length === 0 && plausibleUnconfirmed.length === 0 && fabricatedOrContradicted.length === 0 && !hasOutdatedOrUnknownDate) {
    return null;
  }

  return {
    issues,
    plausibleUnconfirmed,
    fabricatedOrContradicted,
    hasOutdatedOrUnknownDate,
  };
}
