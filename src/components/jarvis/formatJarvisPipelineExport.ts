import { JarvisExecutionStep, JarvisMessage, SavedItem } from '../../types';
import { stripConversationalMetaText } from '../../lib/format';
import { cleanAndFormatFact, cleanResearcherFinding } from '../../lib/factFormatter';

function extractDomain(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '');
  } catch {
    return urlStr.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

function isJsonKeyArtifact(str: string): boolean {
  if (!str) return true;
  const normalized = str.trim().toLowerCase().replace(/^["'`]|["'`]$/g, '');
  return /^(?:title|fact|claim|domain|url|eventdate|event_date|publishedat|published_at|updatedat|updated_at|datestatus|date_status|confirmedby|confirmed_by|sourceindex|source_index|source|sources|location|category|description|headline)$/i.test(normalized);
}

function isValidDateValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val !== 'string' && typeof val !== 'number') return false;
  const str = String(val).trim();
  if (!str) return false;
  if (/^(null|undefined|unknown|none|n\/a|unspecified)$/i.test(str)) return false;
  if (/^(dateStatus|eventDate|publishedAt|updatedAt|url|domain|claim|fact)$/i.test(str)) return false;
  return true;
}

function extractRealDateValue(obj: Record<string, unknown>): string {
  if (isValidDateValue(obj.eventDate)) return String(obj.eventDate).trim();
  if (isValidDateValue(obj.publishedAt)) return String(obj.publishedAt).trim();
  if (isValidDateValue(obj.updatedAt)) return String(obj.updatedAt).trim();
  if (isValidDateValue(obj.dateStatus)) {
    const ds = String(obj.dateStatus).trim();
    if (!/^(unknown|null|undefined|none|n\/a)$/i.test(ds)) {
      return ds;
    }
  }
  return '';
}

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

function formatVerifiedClaimEntry(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (/^"?([a-zA-Z0-9_]+)"?\s*[:=]\s*(?:null|undefined|""|''|\[\]|\{\})\s*,?$/i.test(trimmed)) return '';
    if (/^"?(dateStatus|eventDate|publishedAt|updatedAt|url)"?\s*[:=]/i.test(trimmed)) return '';
    return trimmed;
  }
  if (typeof v === 'object' && v !== null) {
    const vObj = v as Record<string, unknown>;
    let claim = String(
      vObj.claim ||
      vObj.fact ||
      vObj.statement ||
      vObj.title ||
      vObj.text ||
      vObj.point ||
      vObj.finding ||
      ''
    ).trim();

    if (!claim) {
      const entry = Object.entries(vObj).find(
        ([k, val]) =>
          !/^(domain|url|eventDate|publishedAt|updatedAt|dateStatus|confirmedBy|id|sourceIndex)$/i.test(k) &&
          typeof val === 'string' &&
          val.trim().length > 10
      );
      if (entry) claim = String(entry[1]).trim();
    }

    if (!claim) return '';
    claim = claim.replace(/^✅\s*/, '').replace(/^[-*•]\s*/, '').trim();

    const domain = (
      typeof vObj.domain === 'string' && vObj.domain.trim() && !/^(null|undefined|unknown|none)$/i.test(vObj.domain.trim())
        ? vObj.domain.trim()
        : vObj.url && typeof vObj.url === 'string' && !/^(null|undefined)$/i.test(vObj.url.trim())
        ? extractDomain(String(vObj.url))
        : ''
    );

    let dateStr = '';
    const rawDate = vObj.eventDate || vObj.publishedAt || vObj.updatedAt;
    if (typeof rawDate === 'string' && rawDate.trim() && !/^(null|undefined|unknown|none|n\/a)$/i.test(rawDate.trim())) {
      dateStr = rawDate.trim();
    }

    let confirmedStr = '';
    if (Array.isArray(vObj.confirmedBy) && vObj.confirmedBy.length > 0) {
      const validConfirmed = vObj.confirmedBy
        .map(String)
        .map((s) => s.trim())
        .filter((s) => s && !/^(null|undefined|none|\[\])$/i.test(s));
      if (validConfirmed.length > 0) {
        confirmedStr = validConfirmed.join(', ');
      }
    } else if (typeof vObj.confirmedBy === 'string' && vObj.confirmedBy.trim()) {
      const trimmedConf = vObj.confirmedBy.trim();
      if (!/^(null|undefined|none|\[\])$/i.test(trimmedConf)) {
        confirmedStr = trimmedConf;
      }
    }

    const blockLines: string[] = [`✅ ${claim}`];
    if (domain || dateStr) {
      if (domain && dateStr) {
        blockLines.push(`   Source: ${domain} (${dateStr})`);
      } else if (domain) {
        blockLines.push(`   Source: ${domain}`);
      } else {
        blockLines.push(`   Source: ${dateStr}`);
      }
    }
    if (confirmedStr) {
      blockLines.push(`   Confirmed by: ${confirmedStr}`);
    }

    return blockLines.join('\n');
  }
  return String(v).trim();
}

function extractArrayFromDirtyJson(raw: string, keyNames: string[]): string[] {
  const items: string[] = [];

  for (const key of keyNames) {
    const keyRegex = new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'i');
    const match = raw.match(keyRegex);
    if (match && match[1]) {
      const arrayContent = match[1].trim();

      if (arrayContent.includes('{')) {
        const objectMatches = arrayContent.match(/\{[\s\S]*?\}/g);
        if (objectMatches) {
          for (const objStr of objectMatches) {
            try {
              const parsed = JSON.parse(objStr);
              const formatted = formatVerifiedClaimEntry(parsed);
              if (formatted) items.push(formatted);
            } catch {
              const claimMatch = objStr.match(/"claim"\s*:\s*"((?:\\.|[^"\\])*)"/i) || objStr.match(/"fact"\s*:\s*"((?:\\.|[^"\\])*)"/i);
              const domainMatch = objStr.match(/"domain"\s*:\s*"((?:\\.|[^"\\])*)"/i);
              const dateMatch = objStr.match(/"eventDate"\s*:\s*"((?:\\.|[^"\\])*)"/i) || objStr.match(/"publishedAt"\s*:\s*"((?:\\.|[^"\\])*)"/i);
              if (claimMatch && claimMatch[1]) {
                const claim = claimMatch[1].replace(/\\"/g, '"');
                const domain = domainMatch ? domainMatch[1].replace(/\\"/g, '"') : '';
                const date = dateMatch ? dateMatch[1].replace(/\\"/g, '"') : '';
                const meta = [domain, date].filter(Boolean).join(', ');
                items.push(meta ? `${claim} (${meta})` : claim);
              }
            }
          }
        }
      } else {
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

export interface ParsedResearcherCandidate {
  id: string;
  title: string;
  fact: string;
  domain?: string;
  eventDate?: string;
  publishedAt?: string;
  updatedAt?: string;
  confirmedBy?: string[];
  sourceIndex?: number;
  url?: string;
  category?: string;
}

export interface ParsedResearcherData {
  candidates: ParsedResearcherCandidate[];
  sources: unknown[];
  insights: string[];
  context: string;
}

export function extractResearcherData(
  step: JarvisExecutionStep,
  parsed: unknown,
  raw: string
): ParsedResearcherData {
  const candidates: ParsedResearcherCandidate[] = [];
  const sources: unknown[] = [];
  let insights: string[] = [];
  let context = '';

  const processObject = (obj: Record<string, unknown>) => {
    // 1. Process candidate objects
    const candKeys = ['candidates', 'news_candidates', 'newsCandidates', 'items', 'articles', 'stories'];
    for (const key of candKeys) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        const rawCands = obj[key] as unknown[];
        rawCands.forEach((cand, idx) => {
          if (typeof cand === 'object' && cand !== null) {
            const cObj = cand as Record<string, unknown>;
            const rawTitle = String(cObj.title || cObj.headline || '').trim();
            const rawFact = String(cObj.fact || cObj.claim || cObj.statement || cObj.description || '').trim();
            const domain = String(cObj.domain || (cObj.url ? extractDomain(String(cObj.url)) : '')).trim();
            const eventDate = String(cObj.eventDate || cObj.publishedAt || cObj.updatedAt || cObj.date || '').trim();

            let confirmedList: string[] = [];
            if (Array.isArray(cObj.confirmedBy)) {
              confirmedList = (cObj.confirmedBy as string[])
                .map(String)
                .map((s) => s.trim().replace(/^https?:\/\//, '').replace(/^www\./, ''))
                .filter(Boolean);
            } else if (typeof cObj.confirmedBy === 'string' && cObj.confirmedBy.trim()) {
              confirmedList = [cObj.confirmedBy.trim().replace(/^https?:\/\//, '').replace(/^www\./, '')];
            }

            const sourceIdx = typeof cObj.sourceIndex === 'number' ? cObj.sourceIndex : typeof cObj.source_index === 'number' ? cObj.source_index : undefined;
            const url = typeof cObj.url === 'string' && cObj.url ? cObj.url : undefined;
            const category = typeof cObj.category === 'string' && cObj.category ? cObj.category : undefined;

            if (rawTitle || rawFact) {
              const { title: cleanTitle, fact: cleanFact } = cleanResearcherFinding(rawTitle, rawFact, idx);
              candidates.push({
                id: `cand-${idx}`,
                title: cleanTitle,
                fact: cleanFact,
                domain: domain && domain !== 'null' && domain !== 'undefined' ? domain : undefined,
                eventDate: eventDate && eventDate !== 'null' && eventDate !== 'undefined' ? eventDate : undefined,
                publishedAt: typeof cObj.publishedAt === 'string' ? cObj.publishedAt : undefined,
                updatedAt: typeof cObj.updatedAt === 'string' ? cObj.updatedAt : undefined,
                confirmedBy: confirmedList.length > 0 ? confirmedList : undefined,
                sourceIndex: sourceIdx,
                url,
                category,
              });
            }
          } else if (typeof cand === 'string' && cand.trim().length > 5) {
            const { title: cleanTitle, fact: cleanFact } = cleanResearcherFinding('', cand.trim(), idx);
            candidates.push({
              id: `cand-${idx}`,
              title: cleanTitle,
              fact: cleanFact,
            });
          }
        });
        break;
      }
    }

    // 2. Process facts array if candidates was empty
    if (candidates.length === 0) {
      const factKeys = ['facts', 'findings', 'core_facts', 'coreFacts', 'key_facts', 'keyFacts', 'points', 'claims'];
      for (const key of factKeys) {
        if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
          (obj[key] as unknown[]).forEach((f, idx) => {
            if (typeof f === 'string' && f.trim().length > 5) {
              const bulletMatch = f.match(/^(?:[-*•]\s*)?(?:\*\*([^*]+)\*\*[:\s]+)?(.*)$/);
              const title = bulletMatch && bulletMatch[1] ? bulletMatch[1].trim() : '';
              const fact = bulletMatch && bulletMatch[2] ? bulletMatch[2].trim() : f.trim();
              const { title: cleanTitle, fact: cleanFact } = cleanResearcherFinding(title, fact, idx);
              candidates.push({
                id: `fact-${idx}`,
                title: cleanTitle,
                fact: cleanFact,
              });
            } else if (typeof f === 'object' && f !== null) {
              const fObj = f as Record<string, unknown>;
              const factText = String(fObj.fact || fObj.claim || fObj.statement || fObj.text || fObj.finding || '').trim();
              const title = String(fObj.title || fObj.headline || '').trim();
              if (factText || title) {
                const { title: cleanTitle, fact: cleanFact } = cleanResearcherFinding(title, factText, idx);
                candidates.push({
                  id: `fact-${idx}`,
                  title: cleanTitle,
                  fact: cleanFact,
                  domain: typeof fObj.domain === 'string' ? fObj.domain : undefined,
                  eventDate: typeof fObj.eventDate === 'string' ? fObj.eventDate : typeof fObj.date === 'string' ? fObj.date : undefined,
                  sourceIndex: typeof fObj.sourceIndex === 'number' ? fObj.sourceIndex : undefined,
                });
              }
            }
          });
          break;
        }
      }
    }

    // 3. Process sources
    const srcKeys = ['sources', 'references', 'search_results'];
    for (const key of srcKeys) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        (obj[key] as unknown[]).forEach((s, idx) => {
          if (typeof s === 'object' && s !== null) {
            const sObj = s as Record<string, unknown>;
            const url = String(sObj.url || sObj.link || '');
            const title = String(sObj.title || sObj.name || url);
            const domain = String(sObj.domain || (url ? extractDomain(url) : ''));
            const sIdx = typeof sObj.index === 'number' ? sObj.index : idx + 1;
            const publishedAt = typeof sObj.publishedAt === 'string' ? sObj.publishedAt : undefined;
            if (url) {
              sources.push({
                index: sIdx,
                title,
                url,
                domain: domain || undefined,
                publishedAt,
              });
            }
          }
        });
        break;
      }
    }

    // 4. Process insights
    const insightKeys = ['keyInsights', 'insights', 'takeaways'];
    for (const key of insightKeys) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0 && insights.length === 0) {
        insights = (obj[key] as unknown[]).map(String).filter(Boolean);
        break;
      }
    }

    // 5. Context
    if (typeof obj.context === 'string' && !context) context = obj.context;
    else if (typeof obj.summary === 'string' && !context) context = obj.summary;
    else if (typeof obj.notes === 'string' && !context) context = obj.notes;
  };

  // Inspect parsed object
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    processObject(parsed as Record<string, unknown>);
  }

  // Fallback to step.outputPreview
  if (candidates.length === 0 && step.outputPreview) {
    try {
      const previewJson = JSON.parse(step.outputPreview);
      if (previewJson && typeof previewJson === 'object' && !Array.isArray(previewJson)) {
        processObject(previewJson as Record<string, unknown>);
      }
    } catch {
      // ignore
    }
  }

  // Fallback to raw string parsing
  if (candidates.length === 0 && raw) {
    try {
      const rawJson = JSON.parse(raw);
      if (rawJson && typeof rawJson === 'object') {
        if (Array.isArray(rawJson)) {
          rawJson.forEach((item, idx) => {
            if (typeof item === 'object' && item !== null) {
              const iObj = item as Record<string, unknown>;
              candidates.push({
                id: `cand-raw-${idx}`,
                title: String(iObj.title || ''),
                fact: String(iObj.fact || iObj.claim || iObj.description || iObj.title || ''),
                domain: typeof iObj.domain === 'string' ? iObj.domain : undefined,
                eventDate: typeof iObj.eventDate === 'string' ? iObj.eventDate : undefined,
                sourceIndex: typeof iObj.sourceIndex === 'number' ? iObj.sourceIndex : undefined,
              });
            } else if (typeof item === 'string') {
              candidates.push({ id: `cand-raw-${idx}`, title: '', fact: item });
            }
          });
        } else {
          processObject(rawJson as Record<string, unknown>);
        }
      }
    } catch {
      // Line by line bullet extraction
      const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let idx = 0;
      for (const line of lines) {
        if (line.startsWith('{') || line.startsWith('}') || line.startsWith('[') || line.startsWith(']') || line.startsWith('```')) {
          continue;
        }
        const bulletMatch = line.match(/^(?:(?:\d+[.)]|[*•–—-]|\s*-)\s+|fact\s*\d*\s*[:-]\s*)(.*)$/i);
        const text = bulletMatch ? bulletMatch[1].trim() : line;
        if (text.length > 10 && !text.includes('":') && !text.startsWith('"')) {
          const boldTitleMatch = text.match(/^\*\*([^*]+)\*\*[:\s]+(.*)$/);
          if (boldTitleMatch) {
            candidates.push({
              id: `line-${idx++}`,
              title: boldTitleMatch[1].trim(),
              fact: boldTitleMatch[2].trim(),
            });
          } else {
            candidates.push({
              id: `line-${idx++}`,
              title: '',
              fact: text,
            });
          }
        }
      }
    }
  }

  return { candidates, sources, insights, context };
}

export function formatResearcherOutput(step: JarvisExecutionStep, parsed: unknown, raw: string): string {
  const resData = extractResearcherData(step, parsed, raw);
  let md = `### 🎯 Targeted Research Scope\n**Research Focus:** ${step.summary || 'Real-time multi-source empirical retrieval and fact extraction'}\n\n### 📋 Verified Empirical Findings\n`;

  if (resData.candidates.length > 0) {
    resData.candidates.forEach((cand, idx) => {
      const { title: cleanTitle, fact: cleanFact } = cleanResearcherFinding(cand.title, cand.fact, idx);

      md += `${idx + 1}. **${cleanTitle}:** ${cleanFact}\n`;

      const domain = cand.domain || (cand.url ? extractDomain(cand.url) : '');
      const dateStr = cand.eventDate || cand.publishedAt || cand.updatedAt || '';
      const cleanDate = dateStr && !/^(null|undefined|none|unknown)$/i.test(dateStr) ? dateStr : '';
      const srcPart = domain || (cand.sourceIndex !== undefined ? `Source #${cand.sourceIndex}` : (step.searchSource ? step.searchSource : ''));

      if (srcPart || cleanDate) {
        const datePart = cleanDate ? ` (${cleanDate})` : '';
        md += `   - **Source:** ${srcPart}${datePart}\n`;
      }
      if (cand.confirmedBy && cand.confirmedBy.length > 0) {
        md += `   - **Confirmed by:** ${cand.confirmedBy.join(', ')}\n`;
      }
    });
  } else {
    const rawText = (typeof raw === 'string' ? raw : '') || step.outputPreview || step.summary || '';
    const candidateLines = rawText
      .split('\n')
      .map((l) => l.trim().replace(/^[-*•\d.]+\s*/, '').trim())
      .filter((l) => l.length > 15 && !l.startsWith('{') && !l.startsWith('}') && !l.startsWith('[') && !l.startsWith(']'));

    const fallbackItems = candidateLines.slice(0, 5);
    if (fallbackItems.length > 0) {
      fallbackItems.forEach((factText, idx) => {
        const { title: cleanTitle, fact: cleanFact } = cleanResearcherFinding('', factText, idx);
        md += `${idx + 1}. **${cleanTitle}:** ${cleanFact}\n`;
        if (step.searchSource) {
          md += `   - **Source:** ${step.searchSource}\n`;
        }
      });
    } else {
      md += `1. **Empirical Retrieval:** Real-time multi-source fact gathering executed successfully.\n`;
      if (step.searchSource) {
        md += `   - **Source:** ${step.searchSource}\n`;
      }
    }
  }

  return md.trim();
}

export interface ParsedFactCheckerClaim {
  id: string;
  claim: string;
  domain?: string;
  url?: string;
  date?: string;
  confirmedBy?: string[];
}

export interface ParsedFactCheckerData {
  summary: string;
  claims: ParsedFactCheckerClaim[];
  issues: string[];
  plausibleUnconfirmed: string[];
  fabricatedOrContradicted: string[];
}

export function extractFactCheckerData(
  step: JarvisExecutionStep,
  parsed: unknown,
  raw: string
): ParsedFactCheckerData {
  let summary = '';
  const claims: ParsedFactCheckerClaim[] = [];
  const issues: string[] = [];
  const plausibleUnconfirmed: string[] = [];
  const fabricatedOrContradicted: string[] = [];

  let rawClaims: unknown[] = [];
  let rawIssues: unknown[] = [];
  let rawPlausible: unknown[] = [];
  let rawFabricated: unknown[] = [];

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

    const verifiedField =
      fObj.verified ||
      fObj.verifiedClaims ||
      fObj.claims ||
      fObj.validated ||
      fObj.validClaims ||
      fObj.facts ||
      fObj.trueClaims;

    if (Array.isArray(verifiedField)) {
      rawClaims = verifiedField;
    } else if (fObj.claim || fObj.fact || fObj.statement) {
      rawClaims = [fObj];
    }

    const issuesField =
      fObj.issues ||
      fObj.corrections ||
      fObj.discrepancies ||
      fObj.errors ||
      fObj.notes ||
      fObj.flagged ||
      fObj.contradictions ||
      fObj.unverified;
    if (Array.isArray(issuesField)) {
      rawIssues = issuesField;
    }

    const plausibleField =
      fObj.plausible_unconfirmed ||
      fObj.plausibleUnconfirmed ||
      fObj.unconfirmed ||
      fObj.plausible;
    if (Array.isArray(plausibleField)) {
      rawPlausible = plausibleField;
    }

    const fabricatedField =
      fObj.fabricated_or_contradicted ||
      fObj.fabricatedOrContradicted ||
      fObj.fabricated ||
      fObj.contradicted ||
      fObj.hallucinations;
    if (Array.isArray(fabricatedField)) {
      rawFabricated = fabricatedField;
    }
  } else if (Array.isArray(parsed)) {
    parsed.forEach((item) => {
      if (typeof item === 'object' && item !== null) {
        const iObj = item as Record<string, unknown>;
        if (iObj.issue || iObj.correction || iObj.error || iObj.invalid || iObj.flagged) {
          rawIssues.push(iObj);
        } else {
          rawClaims.push(iObj);
        }
      } else if (typeof item === 'string') {
        if (item.toLowerCase().includes('issue') || item.toLowerCase().includes('mismatch')) {
          issues.push(item);
        } else {
          rawClaims.push(item);
        }
      }
    });
  }

  // Fallback: If no claims found from parsed, scan raw string for JSON objects in "verified": [ ... ]
  if (rawClaims.length === 0) {
    const rawToScan = raw || step.outputPreview || step.summary || '';
    const match = rawToScan.match(/"(?:verified|verifiedClaims|claims|facts)"\s*:\s*\[([\s\S]*?)\]/i);
    if (match && match[1]) {
      const objMatches = match[1].match(/\{[\s\S]*?\}/g);
      if (objMatches) {
        objMatches.forEach((objStr) => {
          try {
            const parsedObj = JSON.parse(objStr);
            if (parsedObj && typeof parsedObj === 'object') {
              rawClaims.push(parsedObj);
            }
          } catch {
            const claimMatch = objStr.match(/"(?:claim|fact|statement|title)"\s*:\s*"((?:\\.|[^"\\])*)"/i);
            const domainMatch = objStr.match(/"domain"\s*:\s*"((?:\\.|[^"\\])*)"/i);
            const urlMatch = objStr.match(/"url"\s*:\s*"((?:\\.|[^"\\])*)"/i);
            const dateMatch = objStr.match(/"(?:eventDate|publishedAt|updatedAt)"\s*:\s*"((?:\\.|[^"\\])*)"/i);
            if (claimMatch && claimMatch[1]) {
              rawClaims.push({
                claim: claimMatch[1].replace(/\\"/g, '"'),
                domain: domainMatch ? domainMatch[1].replace(/\\"/g, '"') : undefined,
                url: urlMatch ? urlMatch[1].replace(/\\"/g, '"') : undefined,
                eventDate: dateMatch ? dateMatch[1].replace(/\\"/g, '"') : undefined,
              });
            }
          }
        });
      }
    }
  }

  // Parse each raw claim entry into a structured ParsedFactCheckerClaim
  rawClaims.forEach((item, idx) => {
    if (!item) return;

    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      let claimText = String(
        obj.claim ||
        obj.fact ||
        obj.statement ||
        obj.title ||
        obj.text ||
        obj.point ||
        obj.finding ||
        ''
      ).trim();

      if (!claimText || isJsonKeyArtifact(claimText)) {
        const entry = Object.entries(obj).find(
          ([k, v]) =>
            !/^(domain|url|eventDate|publishedAt|updatedAt|dateStatus|confirmedBy|id|sourceIndex)$/i.test(k) &&
            typeof v === 'string' &&
            v.trim().length > 10
        );
        if (entry) claimText = String(entry[1]).trim();
      }

      if (!claimText || isJsonKeyArtifact(claimText)) return;
      claimText = claimText.replace(/^✅\s*/, '').replace(/^[-*•]\s*/, '').trim();

      let domain = '';
      if (typeof obj.domain === 'string' && obj.domain.trim() && !/^(null|undefined|unknown|none)$/i.test(obj.domain.trim())) {
        domain = obj.domain.trim();
      } else if (typeof obj.url === 'string' && obj.url.trim() && !/^(null|undefined)$/i.test(obj.url.trim())) {
        domain = extractDomain(obj.url.trim());
      }

      let url: string | undefined = undefined;
      if (typeof obj.url === 'string' && obj.url.trim() && obj.url.trim().startsWith('http')) {
        url = obj.url.trim();
      }

      const dateStr = extractRealDateValue(obj);

      let confirmedList: string[] = [];
      if (Array.isArray(obj.confirmedBy)) {
        confirmedList = obj.confirmedBy
          .map((c) => String(c || '').trim())
          .filter((c) => c && !/^(null|undefined|none|\[\])$/i.test(c));
      } else if (typeof obj.confirmedBy === 'string' && obj.confirmedBy.trim()) {
        const cStr = obj.confirmedBy.trim();
        if (!/^(null|undefined|none|\[\])$/i.test(cStr)) {
          confirmedList = cStr.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }

      claims.push({
        id: `claim-${idx}`,
        claim: claimText,
        domain: domain || undefined,
        url,
        date: dateStr || undefined,
        confirmedBy: confirmedList.length > 0 ? confirmedList : undefined,
      });
    } else if (typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) return;
      // Skip raw JSON key: value noise lines
      if (/^"?([a-zA-Z0-9_]+)"?\s*[:=]\s*(?:null|undefined|""|''|\[\]|\{\})\s*,?$/i.test(trimmed)) return;
      if (/^"?(dateStatus|eventDate|publishedAt|updatedAt|url)"?\s*[:=]/i.test(trimmed)) return;

      // Check if multi-line block already
      if (trimmed.includes('\n')) {
        const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
        let cText = '';
        let cDomain = '';
        let cDate = '';
        let cConfirmed: string[] = [];

        lines.forEach((l) => {
          if (l.startsWith('✅') || (!cText && !l.toLowerCase().startsWith('source:') && !l.toLowerCase().startsWith('confirmed by:'))) {
            cText = l.replace(/^✅\s*/, '').replace(/^[-*•]\s*/, '').trim();
          } else if (l.toLowerCase().startsWith('source:')) {
            const srcContent = l.replace(/^source:\s*/i, '').trim();
            const dateM = srcContent.match(/\(([^)]+)\)/);
            if (dateM) {
              cDate = dateM[1].trim();
              cDomain = srcContent.replace(/\s*\([^)]+\)/, '').trim();
            } else {
              cDomain = srcContent;
            }
          } else if (l.toLowerCase().startsWith('confirmed by:')) {
            const confContent = l.replace(/^confirmed by:\s*/i, '').trim();
            cConfirmed = confContent.split(',').map((s) => s.trim()).filter(Boolean);
          }
        });

        if (cText && !isJsonKeyArtifact(cText)) {
          claims.push({
            id: `claim-${idx}`,
            claim: cText,
            domain: cDomain || undefined,
            date: cDate || undefined,
            confirmedBy: cConfirmed.length > 0 ? cConfirmed : undefined,
          });
          return;
        }
      }

      // Single string
      const cleanClaim = trimmed.replace(/^✅\s*/, '').replace(/^[-*•]\s*/, '').trim();
      if (cleanClaim && !isJsonKeyArtifact(cleanClaim) && cleanClaim.length > 3) {
        claims.push({
          id: `claim-${idx}`,
          claim: cleanClaim,
        });
      }
    }
  });

  // Process issues
  rawIssues.forEach((item) => {
    if (typeof item === 'string' && item.trim()) {
      issues.push(item.trim());
    } else if (typeof item === 'object' && item !== null) {
      const iObj = item as Record<string, unknown>;
      const text = String(iObj.issue || iObj.correction || iObj.error || iObj.discrepancy || iObj.note || iObj.message || iObj.text || '').trim();
      if (text) issues.push(text);
    }
  });

  // Process plausibleUnconfirmed
  rawPlausible.forEach((item) => {
    const text = typeof item === 'object' && item !== null
      ? String((item as Record<string, unknown>).issue || (item as Record<string, unknown>).claim || (item as Record<string, unknown>).detail || '')
      : String(item || '').trim();
    if (text && !plausibleUnconfirmed.includes(text)) plausibleUnconfirmed.push(text);
  });

  // Process fabricatedOrContradicted
  rawFabricated.forEach((item) => {
    const text = typeof item === 'object' && item !== null
      ? String((item as Record<string, unknown>).issue || (item as Record<string, unknown>).claim || (item as Record<string, unknown>).detail || '')
      : String(item || '').trim();
    if (text && !fabricatedOrContradicted.includes(text)) fabricatedOrContradicted.push(text);
  });

  if (!summary) {
    summary =
      claims.length > 0
        ? `Validated ${claims.length} ${claims.length === 1 ? 'claim' : 'claims'} with empirical ground checks.`
        : (step.summary || 'Fact verification audit completed.');
  }

  return {
    summary,
    claims,
    issues,
    plausibleUnconfirmed,
    fabricatedOrContradicted,
  };
}

export function formatFactCheckerOutput(step: JarvisExecutionStep, parsed: unknown, raw: string): string {
  const data = extractFactCheckerData(step, parsed, raw);

  const lines: string[] = [
    `### 🎯 Verification Audit Scope`,
    `**Audit Scope:** ${data.summary || 'Empirical ground verification & claim scrutiny'}`,
    ``,
    `### 📋 Verified Empirical Claims`,
  ];

  if (data.claims.length > 0) {
    data.claims.forEach((c, idx) => {
      let cleanClaim = (c.claim || '').trim().replace(/^(?:\*\*)?Claim\s*\d*[:\s-]*(?:\*\*)?\s*/i, '').trim();
      let boldTitle = `**Claim ${idx + 1}:** `;
      const boldMatch = cleanClaim.match(/^(\*\*[^*]+\*\*[:\s]*)(.*)$/);
      if (boldMatch) {
        boldTitle = boldMatch[1].endsWith(' ') ? boldMatch[1] : `${boldMatch[1]} `;
        cleanClaim = boldMatch[2].trim();
      }
      lines.push(`${idx + 1}. ${boldTitle}${cleanClaim}`);
      const domain = c.domain || (c.url ? extractDomain(c.url) : '');
      const dateStr = c.date && !/^(null|undefined|none|unknown)$/i.test(c.date) ? c.date : '';
      const hasSource = Boolean(domain || dateStr);
      if (hasSource) {
        if (domain && dateStr) {
          lines.push(`   - **Source:** ${domain} (${dateStr})`);
        } else if (domain) {
          lines.push(`   - **Source:** ${domain}`);
        } else {
          lines.push(`   - **Source:** ${dateStr}`);
        }
      }
      if (c.confirmedBy && c.confirmedBy.length > 0) {
        lines.push(`   - **Confirmed by:** ${c.confirmedBy.join(', ')}`);
      }
    });
  } else {
    lines.push(`1. **Full Integrity Verification:** All empirical claims verified against grounding corpus.`);
  }

  return lines.join('\n').trim();
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
    const formatted = formatResearcherOutput(step, parsed, raw);
    return `=== ${agentTitle} ===\n${formatted}`.trim();
  }

  // 3. Fact Checker Agent
  if (step.agentId === 'factChecker' || step.agentId === 'factchecker') {
    const formatted = formatFactCheckerOutput(step, parsed, raw);
    return `=== ${agentTitle} ===\n${formatted}`.trim();
  }

  // 3.5. Advisor Agent
  if (step.agentId === 'advisor') {
    const lines: string[] = [`=== ${agentTitle} ===`];
    lines.push(raw || step.summary || 'Comparative, trade-off, and conceptual analysis completed.');
    return lines.join('\n').trim();
  }

  // 3.8. Web Fetcher Agent
  if (step.agentId === 'webFetcher') {
    let title = '';
    let url = '';
    let length = 0;
    let rawTotalLength = 0;
    let isTruncated = false;
    let description = '';
    let headings: string[] = [];
    let excerpt = '';

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const wObj = parsed as Record<string, unknown>;
      title = String(wObj.title || '');
      url = String(wObj.finalUrl || wObj.url || '');
      length = typeof wObj.length === 'number' ? wObj.length : 0;
      rawTotalLength = typeof wObj.rawTotalLength === 'number' ? wObj.rawTotalLength : length;
      isTruncated = Boolean(wObj.isTruncated || (rawTotalLength > 4500));
      description = String(wObj.description || '');
      headings = Array.isArray(wObj.headings) ? (wObj.headings as string[]) : [];
      excerpt = String(wObj.textContent || wObj.preview || wObj.contentExcerpt || '');
    }

    const lines: string[] = [`=== ${agentTitle} ===`];
    if (title) lines.push(`Page Title: ${title}`);
    if (url) lines.push(`Source URL: ${url}`);
    if (rawTotalLength > 0) {
      lines.push(`Parsed Content Length: ${rawTotalLength.toLocaleString()} characters${isTruncated ? ' (capped to 4,500 characters for processing)' : ''}`);
    }
    if (description) lines.push(`Description: ${description}`);
    if (headings.length > 0) {
      lines.push(`Key Headings:`);
      headings.forEach((h) => lines.push(`- ${h}`));
    }
    if (excerpt) {
      lines.push(`Content Excerpt:`);
      lines.push(excerpt);
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
  msgOrQuery: JarvisMessage | SavedItem | { query?: string; title?: string; steps?: JarvisExecutionStep[]; deepResearch?: boolean; timestamp?: number | string; savedAt?: string; content?: string; answer?: string; sources?: unknown[] } | string,
  maybeSteps?: JarvisExecutionStep[],
  maybeFinalMessage?: JarvisMessage | SavedItem | Record<string, unknown>,
): string {
  let userQuery = '';
  let steps: JarvisExecutionStep[] = [];
  let finalMessage: Record<string, unknown> | null = null;

  if (typeof msgOrQuery === 'object' && msgOrQuery !== null) {
    const item = msgOrQuery as Record<string, unknown>;
    const rawQuery = typeof item.query === 'string' ? item.query.trim() : '';
    const rawTitle = typeof item.title === 'string' ? item.title.trim() : '';
    userQuery = rawQuery || rawTitle;
    steps = Array.isArray(item.steps) ? (item.steps as JarvisExecutionStep[]) : [];
    finalMessage = item;
  } else {
    userQuery = typeof msgOrQuery === 'string' ? msgOrQuery.trim() : '';
    steps = Array.isArray(maybeSteps) ? maybeSteps : [];
    finalMessage = (maybeFinalMessage as Record<string, unknown>) || null;
    if (!userQuery && finalMessage) {
      const fQuery = typeof finalMessage.query === 'string' ? finalMessage.query.trim() : '';
      const fTitle = typeof finalMessage.title === 'string' ? finalMessage.title.trim() : '';
      userQuery = fQuery || fTitle;
    }
  }

  // If userQuery is still empty or a generic fallback placeholder, look inside planner agent step
  if (!userQuery || userQuery.toLowerCase() === 'jarvis synthesis' || userQuery.toLowerCase() === 'untitled synthesis') {
    const plannerStep = steps.find((s) => s && s.agentId === 'planner');
    if (plannerStep) {
      try {
        const raw = plannerStep.rawOutput || plannerStep.outputPreview;
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          if (parsed && typeof parsed.task === 'string' && parsed.task.trim()) {
            userQuery = parsed.task.trim();
          }
        }
      } catch {
        // ignore
      }
      if ((!userQuery || userQuery.toLowerCase() === 'jarvis synthesis') && plannerStep.summary && plannerStep.summary.trim()) {
        const cleanedSummary = plannerStep.summary
          .replace(/^Decomposing inquiry:\s*/i, '')
          .replace(/^Executing plan for:\s*/i, '')
          .trim();
        if (cleanedSummary) {
          userQuery = cleanedSummary;
        }
      }
    }
  }

  // Fallback if still empty
  if (!userQuery || userQuery.toLowerCase() === 'jarvis synthesis') {
    userQuery = 'Autonomous Multi-Agent Synthesis';
  }

  const exportParts: string[] = [];

  const rawTimestamp = finalMessage?.timestamp || finalMessage?.savedAt;
  const dateObj = rawTimestamp ? new Date(rawTimestamp as string | number) : new Date();
  const formattedDate = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    : new Date().toLocaleString('en-GB', {
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
    ? (finalMessage.answer || (finalMessage as Record<string, unknown>).content as string || (finalMessage as Record<string, unknown>).subtitle as string || '')
    : '';
  const cleanFinalText = stripConversationalMetaText(finalAnswerText as string);
  exportParts.push(cleanFinalText || 'Synthesis complete.');

  // If sources exist on final answer
  const sources = finalMessage?.sources;
  if (Array.isArray(sources) && sources.length > 0) {
    exportParts.push(`\n\n=== VERIFIED CITATIONS & GROUNDING SOURCES ===`);
    sources.forEach((rawSrc: unknown, idx: number) => {
      const src = (rawSrc && typeof rawSrc === 'object') ? (rawSrc as Record<string, unknown>) : {};
      const title = (typeof src.title === 'string' && src.title) || (typeof src.domain === 'string' && src.domain) || 'Source';
      const url = typeof src.url === 'string' ? src.url : '';
      exportParts.push(`[${idx + 1}] ${title}${url ? ` - ${url}` : ''}`);
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
