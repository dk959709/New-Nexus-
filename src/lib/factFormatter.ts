/**
 * Universal Fact & Insight Sanitizer and Formatter
 * Ensures every fact is cleanly formatted as "- [fact text]. [Source #X]"
 * with no stray commas, no broken indentation, and no raw object/array syntax leaking through.
 */

export function cleanAndFormatFact(
  item: unknown,
  options: { markdownSource?: boolean } = {},
): string {
  if (item === undefined || item === null) return '';

  let factText = '';
  let sourceIndex: string | number | null = null;

  // 1. If item is an object, extract text and source
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    const candidate =
      obj.fact ||
      obj.text ||
      obj.statement ||
      obj.claim ||
      obj.finding ||
      obj.point ||
      obj.description ||
      obj.title ||
      obj.value ||
      '';

    factText = typeof candidate === 'string' ? candidate : String(candidate || '');
    if (!factText || factText === '[object Object]') {
      const strVal = Object.values(obj).find((v) => typeof v === 'string' && (v as string).length > 5);
      factText = strVal ? (strVal as string) : '';
    }

    if (obj.sourceIndex !== undefined && obj.sourceIndex !== null) {
      sourceIndex = obj.sourceIndex as string | number;
    } else if (obj.source !== undefined && obj.source !== null) {
      sourceIndex = obj.source as string | number;
    }
  } else {
    factText = String(item);
  }

  // 2. If factText looks like a serialized JSON object, parse it
  const trimmed = factText.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        return cleanAndFormatFact(parsed, options);
      }
    } catch {
      // Continue to regex cleanup
    }
  }

  // 3. Extract any embedded sourceIndex in the text (e.g. `sourceIndex: 1` or `"sourceIndex": 1` or `[Source #1]`)
  if (sourceIndex === null || sourceIndex === undefined) {
    const srcMatch = factText.match(/(?:sourceIndex|source|citation)\s*[:=]\s*["']?(\d+)["']?/i);
    if (srcMatch && srcMatch[1]) {
      sourceIndex = srcMatch[1];
    } else {
      const bracketMatch = factText.match(/\[(?:Source\s*#?|Citation\s*#?)\s*(\d+)\]/i);
      if (bracketMatch && bracketMatch[1]) {
        sourceIndex = bracketMatch[1];
      }
    }
  }

  // 4. Clean out raw JSON syntax, escaped quotes, dangling commas, leaked keys
  let cleaned = factText
    // Remove embedded sourceIndex key-value pairs
    .replace(/,?\s*["']?(?:sourceIndex|source|citation)["']?\s*[:=]\s*["']?\d+["']?/gi, '')
    // Remove leading/trailing JSON markers & braces
    .replace(/^[\s{}[\]"']+|[\s{}[\]"']+$/g, '')
    // Remove "fact": or "text": or "claim": prefixes
    .replace(/^["']?(?:fact|text|statement|claim|finding|point|description|value)["']?\s*[:=]\s*["']?/i, '')
    // Remove trailing commas, colons, or unneeded punctuation
    .replace(/["']?\s*[,;:]\s*$/, '')
    .replace(/^["']|["']$/g, '')
    // Replace multiple newlines or irregular indentation with a single clean space
    .replace(/\s+/g, ' ')
    .trim();

  // If too short after cleaning, discard
  if (!cleaned || cleaned.length < 3) return '';

  // Clean any leading bullet or list indicators from within the text
  cleaned = cleaned.replace(/^[-*•\d.)\]:]+\s*/, '').trim();
  if (!cleaned) return '';

  // Ensure sentence ends cleanly with a period if it doesn't already have end punctuation
  if (!/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }

  // If sourceIndex is present, append [Source #X]
  if (sourceIndex !== null && sourceIndex !== undefined && String(sourceIndex).trim() !== '') {
    const sStr = String(sourceIndex).trim();
    if (options.markdownSource) {
      return `${cleaned} \`[Source #${sStr}]\``;
    }
    return `${cleaned} [Source #${sStr}]`;
  }

  return cleaned;
}

export function cleanAndFormatInsight(item: unknown): string {
  if (item === undefined || item === null) return '';

  let text = '';
  if (typeof item === 'object' && item !== null) {
    const obj = item as Record<string, unknown>;
    const candidate =
      obj.insight ||
      obj.text ||
      obj.statement ||
      obj.point ||
      obj.fact ||
      obj.description ||
      '';
    text = typeof candidate === 'string' ? candidate : String(candidate || '');
  } else {
    text = String(item);
  }

  let cleaned = text
    .replace(/^[\s{}[\]"']+|[\s{}[\]"']+$/g, '')
    .replace(/^["']?(?:insight|text|statement|point|fact|description)["']?\s*[:=]\s*["']?/i, '')
    .replace(/["']?\s*[,;:]\s*$/, '')
    .replace(/^["']|["']$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  cleaned = cleaned.replace(/^[-*•\d.)\]:]+\s*/, '').trim();
  if (!cleaned || cleaned.length < 3) return '';

  if (!/[.!?]$/.test(cleaned)) {
    cleaned += '.';
  }

  return cleaned;
}
