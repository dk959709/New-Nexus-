/**
 * Universal Fact & Insight Sanitizer and Formatter
 * Ensures every fact and news candidate is cleanly formatted as
 * "- **[Title]** (domain.com, [date]) — Confirmed by: [sources] `[Source #X]`"
 * with no stray commas, no duplicate/malformed citations, and no raw object/array/field syntax leaking through.
 */

// Helper to extract clean alphanumeric source indexes (e.g., "6" from "[Source #6. [Source #6]")
function extractSourceIndices(text: string, explicitSource?: unknown): string[] {
  const found: string[] = [];

  // 1. If explicit source property exists
  if (explicitSource !== undefined && explicitSource !== null) {
    if (Array.isArray(explicitSource)) {
      explicitSource.forEach((item) => {
        const itemIndices = extractSourceIndices(String(item));
        itemIndices.forEach((idx) => {
          if (!found.includes(idx)) found.push(idx);
        });
      });
    } else {
      const sStr = String(explicitSource).trim();
      if (sStr) {
        const matches = sStr.match(/\b\d+\b/g);
        if (matches) {
          matches.forEach((m) => {
            if (!found.includes(m)) found.push(m);
          });
        } else {
          const cleanedExplicit = sStr.replace(/^\[?#?|\]?$/g, '').trim();
          if (cleanedExplicit && !found.includes(cleanedExplicit)) {
            found.push(cleanedExplicit);
          }
        }
      }
    }
  }

  // 2. Search for inline / trailing source patterns in text
  // Matches: [Source #6], [Source #6. [Source #6], (Source 6), sourceIndex: 6, [Citation #6], [Ref 6], [#6], etc.
  const regexPatterns = [
    /\[?\b(?:Source|Citation|Ref|Reference|SourceIndex)\s*#?\s*:?\s*(\d+)\b/gi,
    /(?:sourceIndex|source_index|sourceId|source_id|source|citation)\s*[:=]\s*["']?(\d+)["']?/gi,
    /\[(?:Source\s*#?|Citation\s*#?|Ref\s*#?|#)\s*(\d+)\]/gi,
    /\((?:Source\s*#?|Citation\s*#?|Ref\s*#?)\s*(\d+)\)/gi,
  ];

  for (const regex of regexPatterns) {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      if (match[1] && !found.includes(match[1])) {
        found.push(match[1]);
      }
    }
  }

  return found;
}

// Helper to strip ALL source citations, duplicate/nested fragments, and associated punctuation
function stripSourceCitationsAndFragments(text: string): string {
  let cleaned = text;

  // 1. Remove key-value style source definitions (e.g., `"sourceIndex": 6` or `sourceIndex: 6`)
  cleaned = cleaned.replace(/,?\s*["']?(?:sourceIndex|source_index|source|citation|sourceId|source_id)["']?\s*[:=]\s*["']?\w+["']?/gi, '');

  // 2. Remove chained / duplicated / nested citations (e.g. `[Source #6. [Source #6]`, `[Source #6] [Source #6]`, `[Source #6, #7]`, `[Source 6]`)
  cleaned = cleaned.replace(/(?:,\s*|\s*[-–—]\s*|\s+)?`?\[[^\]]*\b(?:Source|Citation|Ref|Reference)\b[^\]]*\]`?/gi, ' ');

  // 3. Remove repeated fragments like `[Source #6. [Source #6` where the inner bracket was not closed
  cleaned = cleaned.replace(/`?\[\s*(?:Source|Citation|Ref|Reference)\s*#?\s*\d+[^\]\n]*\]?`?/gi, ' ');

  // 4. Remove standalone unclosed source fragments at the end of a string
  cleaned = cleaned.replace(/\s*`?\[\s*(?:Source|Citation|Ref|Reference)\b[^\]\n]*$/gi, '');
  cleaned = cleaned.replace(/\s*(?:Source|Citation|Ref|Reference)\s*#?\s*\d*\s*\]?`?$/gi, '');

  // 5. Remove parenthetical citations like `(Source #6)` or `(Source 6)`
  cleaned = cleaned.replace(/\(\s*(?:Source|Citation|Ref|Reference)\s*#?\s*\d+\s*\)/gi, ' ');

  return cleaned;
}

// General safety-net cleaner for prose text
export function cleanProseText(text: string): string {
  if (!text) return '';

  let cleaned = text
    // Remove outermost wrapping JSON braces/brackets if any
    .replace(/^[\s{}[\]"']+|[\s{}[\]"']+$/g, '')
    // Remove leading list bullets / numbers / dashes first
    .replace(/^[-*•\d.)\]:]+\s*/, '')
    // Remove common JSON field name prefixes (e.g., `"fact":` or `insight:`)
    .replace(/^["']?(?:fact|text|statement|claim|finding|point|description|value|insight|summary|content)["']?\s*[:=]\s*["']?/i, '')
    // Remove any leftover leading list bullets / numbers
    .replace(/^[-*•\d.)\]:]+\s*/, '')
    // Remove leading quotes / whitespace / commas / colons
    .replace(/^[\s,;:\-–—"'‘“]+/, '')
    // Remove trailing quotes
    .replace(/["'’”]+$/, '')
    // Fix stray comma before/after periods: "word. ," or "word ,." or "word ," -> "word."
    .replace(/\s*,\s*\./g, '.')
    .replace(/\.\s*,+/g, '.')
    .replace(/,\s*\.\s*,+/g, '.')
    // Fix space before punctuation
    .replace(/\s+([.,;:!?])/g, '$1')
    // Fix double commas or double semicolons
    .replace(/,\s*,+/g, ',')
    .replace(/;\s*;+/g, ';')
    // Remove trailing unclosed source tags like `[Source #1` or `[Source 1` or `(Source 1` or `[Source`
    .replace(/\s*`?\[\s*(?:Source|Citation|Ref|Reference)\b[^\]\n]*$/gi, '')
    .replace(/\s*\(\s*(?:Source|Citation|Ref|Reference)\b[^)\n]*$/gi, '')
    // Remove trailing orphan comma, colon, semicolon, or dash
    .replace(/[\s,;:\-–—]+$/, '')
    // Remove unclosed trailing opening bracket/parenthesis if it has no counterpart
    .replace(/\s*[[({]\s*$/, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // If text ends with an unmatched closing bracket ']' or ')' with no opening bracket in the string, strip it
  if (cleaned.endsWith(']') && !cleaned.includes('[')) {
    cleaned = cleaned.slice(0, -1).trim();
  }
  if (cleaned.endsWith(')') && !cleaned.includes('(')) {
    cleaned = cleaned.slice(0, -1).trim();
  }

  // If text has an unmatched opening bracket '[' with no closing ']'
  const openBrackets = (cleaned.match(/\[/g) || []).length;
  const closeBrackets = (cleaned.match(/\]/g) || []).length;
  if (openBrackets > closeBrackets) {
    // Strip trailing unclosed bracket segment
    cleaned = cleaned.replace(/\[[^\]]*$/, '').trim();
  }

  const openParens = (cleaned.match(/\(/g) || []).length;
  const closeParens = (cleaned.match(/\)/g) || []).length;
  if (openParens > closeParens) {
    // Strip trailing unclosed parenthesis segment
    cleaned = cleaned.replace(/\([^)]*$/, '').trim();
  }

  // Remove trailing commas, colons, or dashes again in case bracket removal exposed one
  cleaned = cleaned
    .replace(/\.\s*,+\s*$/, '.')
    .replace(/,\s*\.\s*$/, '.')
    .replace(/[\s,;:\-–—]+$/, '')
    .trim();

  return cleaned;
}

/**
 * Check if a string is just an isolated JSON key name artifact (e.g., "title", "domain", "eventDate")
 */
function isJsonKeyArtifact(str: string): boolean {
  const normalized = str.trim().toLowerCase().replace(/^["'`]|["'`]$/g, '');
  return /^(?:title|fact|claim|domain|url|eventdate|event_date|publishedat|published_at|updatedat|updated_at|confirmedby|confirmed_by|sourceindex|source_index|source|sources|location|category|description|headline)$/i.test(normalized);
}

/**
 * Format a news candidate item into a clean, separate bullet point:
 * "- **[Title]** (domain.com, [date]) — Confirmed by: [sources] `[Source #X]`"
 * Followed optionally by the core fact description if distinct from title.
 */
export function formatCandidateBullet(
  item: unknown,
  options: { markdown?: boolean } = {},
): string {
  if (item === undefined || item === null) return '';

  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    const rawTitle = String(obj.title || obj.headline || '').trim();
    const rawFact = String(obj.fact || obj.claim || obj.statement || obj.description || '').trim();
    const domain = String(obj.domain || '').trim().replace(/^https?:\/\//, '').replace(/^www\./, '');
    const eventDate = String(obj.eventDate || '').trim();
    const publishedAt = String(obj.publishedAt || '').trim();
    const updatedAt = String(obj.updatedAt || '').trim();
    const dateVal = eventDate || publishedAt || updatedAt || String(obj.date || '').trim();
    const dateStr = dateVal && dateVal !== 'null' && dateVal !== 'undefined' ? dateVal : '';

    let confirmedList: string[] = [];
    if (Array.isArray(obj.confirmedBy)) {
      confirmedList = (obj.confirmedBy as string[])
        .map((s) => String(s).trim().replace(/^https?:\/\//, '').replace(/^www\./, ''))
        .filter((s) => Boolean(s) && !isJsonKeyArtifact(s));
    } else if (typeof obj.confirmedBy === 'string' && obj.confirmedBy.trim()) {
      const c = obj.confirmedBy.trim().replace(/^https?:\/\//, '').replace(/^www\./, '');
      if (!isJsonKeyArtifact(c)) {
        confirmedList = [c];
      }
    }

    const sourceIdx = typeof obj.sourceIndex === 'number' ? obj.sourceIndex : undefined;

    const cleanTitle = cleanProseText(rawTitle).replace(/[.]+$/, '');
    const cleanFact = cleanProseText(rawFact);

    // If both title and fact are missing or invalid, return empty
    if ((!cleanTitle || isJsonKeyArtifact(cleanTitle)) && (!cleanFact || isJsonKeyArtifact(cleanFact))) {
      return '';
    }

    // Determine headline and body text
    let headline = '';
    let body = '';

    if (cleanTitle && !isJsonKeyArtifact(cleanTitle)) {
      headline = cleanTitle;
      if (cleanFact && !isJsonKeyArtifact(cleanFact) && cleanFact.toLowerCase() !== cleanTitle.toLowerCase()) {
        body = cleanFact;
      }
    } else if (cleanFact && !isJsonKeyArtifact(cleanFact)) {
      headline = cleanFact;
    }

    // Parenthetical metadata: (domain.com, date)
    const metaParts: string[] = [];
    if (domain && !isJsonKeyArtifact(domain)) metaParts.push(domain);
    if (dateStr && !isJsonKeyArtifact(dateStr)) metaParts.push(dateStr);
    const parensStr = metaParts.length > 0 ? ` (${metaParts.join(', ')})` : '';

    // Confirmed by text
    const confirmedStr = confirmedList.length > 0 ? ` — Confirmed by: ${confirmedList.join(', ')}` : '';

    // Source tag
    let sourceTag = '';
    if (sourceIdx) {
      sourceTag = options.markdown ? ` \`[Source #${sourceIdx}]\`` : ` [Source #${sourceIdx}]`;
    }

    if (options.markdown) {
      if (headline && body) {
        return `- **${headline}**: ${body}${parensStr}${confirmedStr}${sourceTag}`;
      } else if (headline) {
        return `- **${headline}**${parensStr}${confirmedStr}${sourceTag}`;
      } else if (body) {
        return `- ${body}${parensStr}${confirmedStr}${sourceTag}`;
      }
    } else {
      if (headline && body) {
        return `- ${headline}: ${body}${parensStr}${confirmedStr}${sourceTag}`;
      } else if (headline) {
        return `- ${headline}${parensStr}${confirmedStr}${sourceTag}`;
      } else if (body) {
        return `- ${body}${parensStr}${confirmedStr}${sourceTag}`;
      }
    }
  }

  // If item is string, check if it's an isolated JSON key artifact
  const rawStr = String(item).trim();
  if (isJsonKeyArtifact(rawStr) || rawStr.length < 3) {
    return '';
  }

  // If item is string, check if it's a serialized JSON object
  if (rawStr.startsWith('{') && rawStr.endsWith('}')) {
    try {
      const parsed = JSON.parse(rawStr);
      if (parsed && typeof parsed === 'object') {
        return formatCandidateBullet(parsed, options);
      }
    } catch {
      // Continue with string handling
    }
  }

  // Check if string contains key-value patterns like "title: ..., domain: ..., eventDate: ..."
  if (/(?:title|fact|claim|domain|eventDate|publishedAt)\s*[:=]/i.test(rawStr)) {
    const titleMatch = rawStr.match(/(?:title|headline)\s*[:=]\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^,;\n]+))/i);
    const factMatch = rawStr.match(/(?:fact|claim|description|statement)\s*[:=]\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^,;\n]+))/i);
    const domainMatch = rawStr.match(/domain\s*[:=]\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^,;\s]+))/i);
    const dateMatch = rawStr.match(/(?:eventDate|publishedAt|updatedAt|date)\s*[:=]\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^,;\s]+))/i);
    const sourceMatch = rawStr.match(/sourceIndex\s*[:=]\s*(?:"?(\d+)"?)/i);

    const extractedTitle = titleMatch ? (titleMatch[1] || titleMatch[2] || titleMatch[3] || '').trim() : undefined;
    const extractedFact = factMatch ? (factMatch[1] || factMatch[2] || factMatch[3] || '').trim() : undefined;
    const extractedDomain = domainMatch ? (domainMatch[1] || domainMatch[2] || domainMatch[3] || '').trim() : undefined;
    const extractedDate = dateMatch ? (dateMatch[1] || dateMatch[2] || dateMatch[3] || '').trim() : undefined;
    const extractedSourceIdx = sourceMatch && sourceMatch[1] ? parseInt(sourceMatch[1], 10) : undefined;

    if (extractedTitle || extractedFact) {
      return formatCandidateBullet(
        {
          title: extractedTitle,
          fact: extractedFact,
          domain: extractedDomain,
          eventDate: extractedDate,
          sourceIndex: extractedSourceIdx,
        },
        options,
      );
    }
  }

  // Fallback for general fact strings
  const cleaned = cleanAndFormatFact(rawStr, { markdownSource: Boolean(options.markdown) });
  if (!cleaned || isJsonKeyArtifact(cleaned)) return '';
  return cleaned.startsWith('-') ? cleaned : `- ${cleaned}`;
}

export function cleanAndFormatFact(
  item: unknown,
  options: { markdownSource?: boolean } = {},
): string {
  if (item === undefined || item === null) return '';

  let rawText = '';
  let explicitSource: unknown = null;

  // 1. If item is an object, check if it's a candidate structure
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    // If it has candidate fields like title + (domain or eventDate or confirmedBy), delegate to formatCandidateBullet
    if (obj.title && (obj.domain || obj.eventDate || obj.publishedAt || obj.confirmedBy)) {
      return formatCandidateBullet(obj, { markdown: Boolean(options.markdownSource) }).replace(/^- /, '');
    }

    const candidate =
      obj.fact ??
      obj.text ??
      obj.statement ??
      obj.claim ??
      obj.finding ??
      obj.point ??
      obj.description ??
      obj.title ??
      obj.value ??
      obj.summary ??
      obj.content ??
      '';

    rawText = typeof candidate === 'string' ? candidate : String(candidate || '');
    if (!rawText || rawText === '[object Object]') {
      const strVal = Object.values(obj).find((v) => typeof v === 'string' && (v as string).length > 5);
      rawText = strVal ? (strVal as string) : '';
    }

    explicitSource =
      obj.sourceIndex ??
      obj.source_index ??
      obj.source ??
      obj.citation ??
      obj.sourceId ??
      obj.source_id;
  } else {
    rawText = String(item);
  }

  // 2. If rawText looks like a serialized JSON object, parse it
  const trimmed = rawText.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return cleanAndFormatFact(parsed, options);
      }
    } catch {
      // Continue with text processing
    }
  }

  if (isJsonKeyArtifact(trimmed)) return '';

  // 3. Detect and collect all unique source index references (e.g., ["6"])
  const sourceIndices = extractSourceIndices(rawText, explicitSource);

  // 4. Strip all embedded source citations and partial/duplicated citation fragments from the text
  let factText = stripSourceCitationsAndFragments(rawText);

  // 5. Clean prose text and punctuation
  factText = cleanProseText(factText);

  // If too short or just a key name artifact after cleaning, discard
  if (!factText || factText.length < 3 || isJsonKeyArtifact(factText)) return '';

  // 6. Ensure sentence ends cleanly with standard end punctuation (. ! ?)
  factText = factText.replace(/[\s,;:\-–—]+$/, '');
  if (!/[.!?]$/.test(factText)) {
    factText += '.';
  }

  // 7. Format clean source tag
  let formattedResult = factText;
  if (sourceIndices.length > 0) {
    const sourceLabel = sourceIndices.length === 1
      ? `Source #${sourceIndices[0]}`
      : `Sources #${sourceIndices.join(', #')}`;

    if (options.markdownSource) {
      formattedResult = `${factText} \`[${sourceLabel}]\``;
    } else {
      formattedResult = `${factText} [${sourceLabel}]`;
    }
  }

  // 8. Final safety net pass: ensure no stray comma before the source bracket or double periods
  formattedResult = formattedResult
    .replace(/\s*,\s*(\[[^\]]+\]|`\[[^\]]+\]`)/g, ' $1')
    .replace(/\.\s*,\s*(\[[^\]]+\]|`\[[^\]]+\]`)/g, '. $1')
    .replace(/\s*\.\s*\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();

  return formattedResult;
}

export function cleanAndFormatInsight(item: unknown): string {
  if (item === undefined || item === null) return '';

  let rawText = '';
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    const candidate =
      obj.insight ??
      obj.text ??
      obj.statement ??
      obj.point ??
      obj.fact ??
      obj.finding ??
      obj.description ??
      obj.summary ??
      '';
    rawText = typeof candidate === 'string' ? candidate : String(candidate || '');
  } else {
    rawText = String(item);
  }

  const trimmed = rawText.trim();
  if (isJsonKeyArtifact(trimmed)) return '';

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return cleanAndFormatInsight(parsed);
      }
    } catch {
      // Continue
    }
  }

  // Strip any accidental source tags from insights
  let text = stripSourceCitationsAndFragments(rawText);
  text = cleanProseText(text);

  if (!text || text.length < 3 || isJsonKeyArtifact(text)) return '';

  text = text.replace(/[\s,;:\-–—]+$/, '');
  if (!/[.!?]$/.test(text)) {
    text += '.';
  }

  return text
    .replace(/\s*\.\s*\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Specialized Researcher Formatter that GUARANTEES clean separated markdown bullet points
 * for live Researcher display and saved items.
 */
export function formatResearcherOutput(
  step: { outputPreview?: string; rawOutput?: string; summary?: string },
  parsedObj?: unknown,
  rawStr?: string,
): string {
  const raw = rawStr || step.rawOutput || step.outputPreview || step.summary || '';
  let candidates: unknown[] = [];
  let facts: unknown[] = [];
  let keyInsights: unknown[] = [];
  let context = '';

  // Helper to extract candidate objects and facts from any object
  const inspectObject = (obj: Record<string, unknown>): { foundCandidates: unknown[]; foundFacts: unknown[] } => {
    let foundCandidates: unknown[] = [];
    let foundFacts: unknown[] = [];

    // 1. Check candidates array
    const candKeys = ['candidates', 'news_candidates', 'newsCandidates', 'items', 'articles', 'stories'];
    for (const key of candKeys) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        foundCandidates = obj[key] as unknown[];
        break;
      }
    }

    // 2. Check facts array
    const factKeys = ['facts', 'findings', 'core_facts', 'coreFacts', 'key_facts', 'keyFacts', 'points', 'claims'];
    for (const key of factKeys) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        foundFacts = obj[key] as unknown[];
        break;
      }
    }

    // 3. Check insights
    const insightKeys = ['keyInsights', 'insights', 'takeaways'];
    for (const key of insightKeys) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0 && keyInsights.length === 0) {
        keyInsights = obj[key] as unknown[];
        break;
      }
    }

    // 4. Check context
    if (typeof obj.context === 'string' && !context) context = obj.context;
    else if (typeof obj.summary === 'string' && !context) context = obj.summary;

    return { foundCandidates, foundFacts };
  };

  // Step 1: Check parsedObj
  if (parsedObj && typeof parsedObj === 'object' && !Array.isArray(parsedObj)) {
    const { foundCandidates, foundFacts } = inspectObject(parsedObj as Record<string, unknown>);
    candidates = foundCandidates;
    facts = foundFacts;
  }

  // Step 2: Check step.outputPreview - use if richer or if primary list is small/incomplete
  if (step.outputPreview) {
    try {
      const previewJson = JSON.parse(step.outputPreview);
      if (previewJson && typeof previewJson === 'object' && !Array.isArray(previewJson)) {
        const { foundCandidates: pCands, foundFacts: pFacts } = inspectObject(previewJson as Record<string, unknown>);
        if (pCands.length > candidates.length) {
          candidates = pCands;
        }
        if (pFacts.length > facts.length) {
          facts = pFacts;
        }
      }
    } catch {
      // continue
    }
  }

  // Step 3: Try parsing raw string if still fewer than 3 items
  if (candidates.length < 3 && facts.length < 3 && raw) {
    try {
      const rawJson = JSON.parse(raw);
      if (rawJson && typeof rawJson === 'object') {
        if (Array.isArray(rawJson)) {
          if (rawJson.length > candidates.length) candidates = rawJson;
        } else {
          const { foundCandidates: rCands, foundFacts: rFacts } = inspectObject(rawJson as Record<string, unknown>);
          if (rCands.length > candidates.length) candidates = rCands;
          if (rFacts.length > facts.length) facts = rFacts;
        }
      }
    } catch {
      // Robust balanced-brace block extraction for candidate objects
      const extracted: unknown[] = [];
      let depth = 0;
      let startIdx = -1;
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] === '{') {
          if (depth === 0) startIdx = i;
          depth++;
        } else if (raw[i] === '}') {
          depth--;
          if (depth === 0 && startIdx !== -1) {
            const block = raw.slice(startIdx, i + 1);
            try {
              const parsedBlock = JSON.parse(block);
              if (parsedBlock && typeof parsedBlock === 'object') {
                extracted.push(parsedBlock);
              }
            } catch {
              const titleM = block.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)"/i);
              const factM = block.match(/"fact"\s*:\s*"((?:\\.|[^"\\])*)"/i);
              const domainM = block.match(/"domain"\s*:\s*"((?:\\.|[^"\\])*)"/i);
              const dateM = block.match(/(?:"eventDate"|"publishedAt"|"updatedAt")\s*:\s*"((?:\\.|[^"\\])*)"/i);
              const srcM = block.match(/(?:"sourceIndex"|"source_index")\s*:\s*(\d+)/i);
              if (titleM || factM) {
                extracted.push({
                  title: titleM ? titleM[1].replace(/\\"/g, '"') : undefined,
                  fact: factM ? factM[1].replace(/\\"/g, '"') : undefined,
                  domain: domainM ? domainM[1].replace(/\\"/g, '"') : undefined,
                  eventDate: dateM ? dateM[1].replace(/\\"/g, '"') : undefined,
                  sourceIndex: srcM ? parseInt(srcM[1], 10) : undefined,
                });
              }
            }
            startIdx = -1;
          }
        }
      }
      if (extracted.length > candidates.length) {
        candidates = extracted;
      }
    }
  }

  // Step 4: Fallback to line-by-line bullet extraction if still empty
  if (candidates.length === 0 && facts.length === 0 && raw) {
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const parsedLines: string[] = [];
    for (const l of lines) {
      if (l.startsWith('{') || l.startsWith('}') || l.startsWith('[') || l.startsWith(']') || l.startsWith('```')) {
        continue;
      }
      const bulletMatch = l.match(/^(?:(?:\d+[.)]|[*•–—-]|\s*-)\s+|fact\s*\d*\s*[:-]\s*)(.*)$/i);
      const text = bulletMatch ? bulletMatch[1].trim() : l;
      if (text.length > 10 && !isJsonKeyArtifact(text)) {
        parsedLines.push(text);
      }
    }
    if (parsedLines.length > 0) {
      facts = parsedLines;
    }
  }

  let md = `### 🔎 Core Fact Intelligence & Verified Findings\n`;

  const itemsToRender = candidates.length > 0 ? candidates : facts;
  const renderedBullets: string[] = [];

  if (itemsToRender.length > 0) {
    itemsToRender.forEach((item) => {
      const bullet = formatCandidateBullet(item, { markdown: true });
      if (bullet && !renderedBullets.includes(bullet)) {
        renderedBullets.push(bullet);
      }
    });
  }

  if (renderedBullets.length > 0) {
    md += renderedBullets.join('\n') + '\n';
  } else {
    md += `- Empirical research gathering completed successfully.\n`;
  }

  if (keyInsights.length > 0) {
    md += `\n### 💡 Key Empirical Insights\n`;
    const renderedInsights: string[] = [];
    keyInsights.forEach((insight) => {
      const formatted = cleanAndFormatInsight(insight);
      if (formatted && !renderedInsights.includes(formatted)) {
        renderedInsights.push(`- ${formatted}`);
      }
    });
    if (renderedInsights.length > 0) {
      md += renderedInsights.join('\n') + '\n';
    }
  }

  if (context && context.trim().length > 15) {
    md += `\n### 📖 Deep Contextual Background\n${cleanProseText(context)}\n`;
  }

  return md;
}

/**
 * Set of known scraped headers, breadcrumbs, navigation items, or boilerplate phrases
 * that frequently leak into scraped web snippets or LLM summaries.
 */
const KNOWN_JUNK_HEADERS = [
  'it support',
  'browser extension precautions',
  'technical support',
  'customer support',
  'help desk',
  'system requirements',
  'security notice',
  'security precautions',
  'precautions',
  'precautions to take',
  'table of contents',
  'frequently asked questions',
  'faq',
  'related articles',
  'related posts',
  'related topics',
  'related content',
  'recommended reading',
  'key takeaways',
  'overview',
  'summary',
  'introduction',
  'conclusion',
  'disclaimer',
  'warning',
  'notice',
  'important note',
  'cookie policy',
  'privacy policy',
  'terms of use',
  'terms of service',
  'about us',
  'contact us',
  'advertisement',
  'sponsored',
  'skip to content',
  'read more',
  'share this',
  'comments',
  'leave a reply',
  'untitled',
  'article',
  'news',
  'page',
  'home',
];

const JUNK_HEADER_PREFIX_REGEX = new RegExp(
  `^(?:(?:${KNOWN_JUNK_HEADERS.map((h) => h.replace(/\s+/g, '\\s+')).join('|')})[\\s:/-]*)+`,
  'i',
);

/**
 * Splits text into coherent sentences, avoiding splits on common abbreviations.
 */
function splitIntoSentences(text: string): string[] {
  if (!text) return [];
  // Protect common abbreviations by temporarily replacing period
  const protectedText = text
    .replace(/\b(e\.g\.|i\.e\.|vs\.|etc\.|dr\.|mr\.|ms\.|mrs\.|u\.s\.|jan\.|feb\.|mar\.|apr\.|jun\.|jul\.|aug\.|sep\.|oct\.|nov\.|dec\.)/gi, (m) =>
      m.replace(/\./g, '__DOT__'),
    )
    .replace(/\b(\d+)\.(\d+)\b/g, '$1__DOT__$2');

  const rawSentences = protectedText.split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/);

  return rawSentences
    .map((s) => s.replace(/__DOT__/g, '.').trim())
    .filter(Boolean);
}

/**
 * Cleans a researcher finding for presentation in the UI:
 * - Strips leftover headers/fragments from scraped source content (e.g. 'IT Support', 'Browser extension precautions', '###' markers).
 * - Extracts/promotes a clean bold title.
 * - Extracts and keeps only the relevant summary sentence(s) (1-2 clear, informative sentences).
 * - Returns clean { title: string, fact: string } suitable for numbered display.
 */
export function cleanResearcherFinding(
  rawTitle?: string | null,
  rawFact?: string | null,
  idx: number = 0,
): { title: string; fact: string } {
  const title = (rawTitle || '').trim();
  let fact = (rawFact || '').trim();

  // 1. Initial cleanup of markdown headers, dividers, HTML, and stray citations
  const stripMarkdownAndNoise = (str: string): string => {
    return str
      .replace(/\r\n/g, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/#{1,6}\s*/g, ' ')
      .replace(/^[-*_]{3,}\s*$/gm, ' ')
      .replace(/(?:,\s*|\s*[-–—]\s*|\s+)?`?\[[^\]]*\b(?:Source|Citation|Ref|Reference)\b[^\]]*\]`?/gi, ' ')
      .replace(/\(\s*(?:Source|Citation|Ref|Reference)\s*#?\s*\d+\s*\)/gi, ' ')
      .replace(/`+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  // 2. Handle multi-line scraped facts where early lines are heading fragments
  if (fact.includes('\n')) {
    const rawLines = fact.split('\n').map((l) => l.trim()).filter(Boolean);
    const validLines: string[] = [];
    for (const line of rawLines) {
      const strippedLine = line.replace(/^#{1,6}\s*/, '').trim();
      const lower = strippedLine.toLowerCase();
      // If line is a known junk header or very short line with no punctuation at end
      const isJunk = KNOWN_JUNK_HEADERS.some((h) => lower === h || lower.startsWith(`${h}:`) || lower.startsWith(`${h} -`));
      const isShortHeader = strippedLine.split(/\s+/).length <= 4 && !/[.!?]$/.test(strippedLine);
      if (isJunk || (isShortHeader && validLines.length === 0)) {
        continue;
      }
      validLines.push(strippedLine);
    }
    fact = validLines.join(' ');
  }

  fact = stripMarkdownAndNoise(fact);

  // Strip breadcrumbs (e.g., "Home > Category > Topic > ")
  fact = fact.replace(/^(?:[A-Za-z0-9\s-]{2,25}\s*[>/»|]\s*)+/, '').trim();

  // Strip leading junk header phrases (e.g. "IT Support Browser extension precautions", "IT Support: ")
  while (JUNK_HEADER_PREFIX_REGEX.test(fact)) {
    fact = fact.replace(JUNK_HEADER_PREFIX_REGEX, '').trim();
  }

  // Strip leading list numbering, bullets, and stray punctuation
  fact = fact
    .replace(/^[-*•\d.)\]:]+\s*/, '')
    .replace(/^["']?(?:fact|finding|claim|statement|description|insight|point)\s*\d*[:=]\s*["']?/i, '')
    .replace(/^[\s,;:\-–—"'‘“]+/, '')
    .trim();

  // Clean raw title
  let cleanTitle = stripMarkdownAndNoise(title)
    .replace(/^(?:Finding\s*\d+|Fact\s*\d+|Claim\s*\d+|\d+[.)])[:\s-]*/i, '')
    .replace(/^[\s#*•\d.:–—-]+/, '')
    .replace(/[\s:–—*#]+$/, '')
    .trim();

  // Check if cleanTitle is just a junk header
  const isTitleJunk =
    !cleanTitle ||
    cleanTitle.length < 3 ||
    KNOWN_JUNK_HEADERS.includes(cleanTitle.toLowerCase()) ||
    JUNK_HEADER_PREFIX_REGEX.test(cleanTitle);

  if (isTitleJunk) {
    cleanTitle = '';
  }

  // Check if fact starts with bold title markdown: **Some Title:** or **Some Title**
  const boldMatch = fact.match(/^(\*\*[^*]+\*\*[:\s]*)(.*)$/);
  if (boldMatch) {
    const extractedBold = boldMatch[1].replace(/[*:]/g, '').trim();
    if (extractedBold && !KNOWN_JUNK_HEADERS.includes(extractedBold.toLowerCase()) && !JUNK_HEADER_PREFIX_REGEX.test(extractedBold)) {
      if (!cleanTitle) {
        cleanTitle = extractedBold;
      }
      fact = boldMatch[2].trim();
    }
  }

  // Check if fact starts with a colon title: "Malware Infection: Using cracked software..."
  if (!cleanTitle) {
    const colonMatch = fact.match(/^([A-Za-z0-9\s-]{3,40}):\s+([A-Z].*)$/);
    if (colonMatch) {
      const candidateTitle = colonMatch[1].trim();
      if (!KNOWN_JUNK_HEADERS.includes(candidateTitle.toLowerCase()) && !JUNK_HEADER_PREFIX_REGEX.test(candidateTitle)) {
        cleanTitle = candidateTitle;
        fact = colonMatch[2].trim();
      }
    }
  }

  // Fallback title if none found
  if (!cleanTitle) {
    cleanTitle = `Finding ${idx + 1}`;
  }

  // Remove duplicate title prefix from fact if fact repeats the title
  if (cleanTitle && cleanTitle.toLowerCase() !== `finding ${idx + 1}`.toLowerCase()) {
    const escaped = cleanTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    fact = fact.replace(new RegExp(`^(?:\\*\\*)?${escaped}(?:\\*\\*)?[:\\s-]*`, 'i'), '').trim();
  }

  // Again strip any leading junk headers exposed after title stripping
  while (JUNK_HEADER_PREFIX_REGEX.test(fact)) {
    fact = fact.replace(JUNK_HEADER_PREFIX_REGEX, '').trim();
  }

  // Strip leading quotes or punctuation from fact
  fact = fact.replace(/^[\s,;:\-–—"'‘“]+/, '').replace(/^[-*•\d.)\]:]+\s*/, '').trim();

  // Extract relevant summary sentence(s)
  const sentences = splitIntoSentences(fact);
  const validSentences: string[] = [];

  const BOILERPLATE_SENTENCE_REGEX = /(?:click\s+here|read\s+more|learn\s+more|subscribe|newsletter|privacy\s+policy|terms\s+of\s+(?:use|service)|cookie\s+policy|leave\s+a\s+(?:reply|comment)|all\s+rights\s+reserved|follow\s+us|share\s+(?:this|on)|sign\s+up|log\s+in|table\s+of\s+contents|frequently\s+asked\s+questions)/i;
  const AUTHOR_METADATA_REGEX = /^(?:photo|image|figure\s*\d+|author|published|written\s+by|source|credit)[:\s]/i;

  for (const s of sentences) {
    const sTrimmed = s.trim();
    if (!sTrimmed) continue;
    if (BOILERPLATE_SENTENCE_REGEX.test(sTrimmed)) continue;
    if (AUTHOR_METADATA_REGEX.test(sTrimmed)) continue;
    if (sTrimmed.split(/\s+/).length < 4 && !/[.!?]$/.test(sTrimmed)) continue;

    validSentences.push(sTrimmed);
  }

  let finalFact = '';
  if (validSentences.length > 0) {
    // Keep 1-2 core sentences (up to 3 if first two are short)
    const firstSentence = validSentences[0];
    if (validSentences.length > 1 && (firstSentence.length < 90 || (firstSentence.length + validSentences[1].length < 240))) {
      finalFact = `${validSentences[0]} ${validSentences[1]}`;
      if (validSentences.length > 2 && finalFact.length < 140 && finalFact.length + validSentences[2].length < 240) {
        finalFact += ` ${validSentences[2]}`;
      }
    } else {
      finalFact = firstSentence;
    }
  } else {
    // Fallback if no sentence boundaries detected
    finalFact = fact.slice(0, 220).replace(/[,;:\s]+$/, '').trim();
    if (fact.length > 220 && !/[.!?]$/.test(finalFact)) {
      finalFact += '...';
    }
  }

  // Capitalize first letter
  if (finalFact) {
    finalFact = finalFact.charAt(0).toUpperCase() + finalFact.slice(1);
    // Ensure ending with a period if missing punctuation
    if (!/[.!?]$/.test(finalFact) && !finalFact.endsWith('...')) {
      finalFact += '.';
    }
  } else {
    finalFact = 'Empirical evidence extracted from gathered sources.';
  }

  // Clean title formatting: Capitalize first letter, ensure no trailing colon or markdown
  cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);
  cleanTitle = cleanTitle.replace(/[:\s-]+$/, '').trim();

  return {
    title: cleanTitle,
    fact: finalFact,
  };
}


