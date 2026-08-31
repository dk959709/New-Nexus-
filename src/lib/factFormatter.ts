/**
 * Universal Fact & Insight Sanitizer and Formatter
 * Ensures every fact is cleanly formatted as "- [fact text]. [Source #X]"
 * with no stray commas, no duplicate/malformed citations, and no raw object/array syntax leaking through.
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
  cleaned = cleaned.replace(/`?\[\s*(?:Source|Citation|Ref|Reference)\s*#?\s*\d+[\s\S]*?(?:\]|(?=\s*\[|\s*$))/gi, ' ');

  // 4. Remove standalone unclosed source fragments at the end of a string
  cleaned = cleaned.replace(/\s*`?\[\s*(?:Source|Citation|Ref|Reference)\b[\s\S]*$/gi, '');
  cleaned = cleaned.replace(/\s*(?:Source|Citation|Ref|Reference)\s*#?\s*\d*\s*\]?`?$/gi, '');

  // 5. Remove parenthetical citations like `(Source #6)` or `(Source 6)`
  cleaned = cleaned.replace(/\(\s*(?:Source|Citation|Ref|Reference)\s*#?\s*\d+\s*\)/gi, ' ');

  return cleaned;
}

// General safety-net cleaner for prose text
function cleanProseText(text: string): string {
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

export function cleanAndFormatFact(
  item: unknown,
  options: { markdownSource?: boolean } = {},
): string {
  if (item === undefined || item === null) return '';

  let rawText = '';
  let explicitSource: unknown = null;

  // 1. If item is an object, extract text and explicit source property
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
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

  // 3. Detect and collect all unique source index references (e.g., ["6"])
  const sourceIndices = extractSourceIndices(rawText, explicitSource);

  // 4. Strip all embedded source citations and partial/duplicated citation fragments from the text
  let factText = stripSourceCitationsAndFragments(rawText);

  // 5. Clean prose text and punctuation
  factText = cleanProseText(factText);

  // If too short after cleaning, discard
  if (!factText || factText.length < 3) return '';

  // 6. Ensure sentence ends cleanly with standard end punctuation (. ! ?)
  // Remove any trailing commas or stray punctuation before the period
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

  if (!text || text.length < 3) return '';

  text = text.replace(/[\s,;:\-–—]+$/, '');
  if (!/[.!?]$/.test(text)) {
    text += '.';
  }

  return text
    .replace(/\s*\.\s*\./g, '.')
    .replace(/\s+/g, ' ')
    .trim();
}
