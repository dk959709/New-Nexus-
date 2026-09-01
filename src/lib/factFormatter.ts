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
  const inspectObject = (obj: Record<string, unknown>) => {
    // 1. Check candidates array
    const candKeys = ['candidates', 'news_candidates', 'newsCandidates', 'items', 'articles', 'stories'];
    for (const key of candKeys) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        candidates = obj[key] as unknown[];
        break;
      }
    }

    // 2. Check facts array
    const factKeys = ['facts', 'findings', 'core_facts', 'coreFacts', 'key_facts', 'keyFacts', 'points', 'claims'];
    for (const key of factKeys) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        facts = obj[key] as unknown[];
        break;
      }
    }

    // 3. Check insights
    const insightKeys = ['keyInsights', 'insights', 'takeaways'];
    for (const key of insightKeys) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        keyInsights = obj[key] as unknown[];
        break;
      }
    }

    // 4. Check context
    if (typeof obj.context === 'string') context = obj.context;
    else if (typeof obj.summary === 'string' && !context) context = obj.summary;
  };

  // Step 1: Check parsedObj
  if (parsedObj && typeof parsedObj === 'object' && !Array.isArray(parsedObj)) {
    inspectObject(parsedObj as Record<string, unknown>);
  }

  // Step 2: Try parsing step.outputPreview if candidates/facts are still empty
  if (candidates.length === 0 && facts.length === 0 && step.outputPreview) {
    try {
      const previewJson = JSON.parse(step.outputPreview);
      if (previewJson && typeof previewJson === 'object' && !Array.isArray(previewJson)) {
        inspectObject(previewJson as Record<string, unknown>);
      }
    } catch {
      // continue
    }
  }

  // Step 3: Try parsing raw string
  if (candidates.length === 0 && facts.length === 0 && raw) {
    try {
      const rawJson = JSON.parse(raw);
      if (rawJson && typeof rawJson === 'object') {
        if (Array.isArray(rawJson)) {
          candidates = rawJson;
        } else {
          inspectObject(rawJson as Record<string, unknown>);
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
      if (extracted.length > 0) {
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

