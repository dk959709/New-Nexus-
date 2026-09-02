import type { Condition, TemperatureUnit, WindUnit } from '@/types';

export function formatTemp(value: number, unit: TemperatureUnit): string {
  const converted = unit === 'fahrenheit' ? value * 9 / 5 + 32 : value;
  return `${Math.round(converted)}°`;
}

export function formatWind(value: number, unit: WindUnit): string {
  const converted = unit === 'mph' ? value * 0.621371 : value;
  return `${Math.round(converted)} ${unit === 'mph' ? 'mph' : 'km/h'}`;
}

export function formatTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function conditionLabel(condition: Condition): string {
  const labels: Record<Condition, string> = {
    clear: 'Clear sky',
    'partly-cloudy': 'Partly cloudy',
    cloudy: 'Cloudy',
    rain: 'Rain',
    storm: 'Thunderstorm',
    snow: 'Snow',
    fog: 'Fog',
  };
  return labels[condition];
}

export function formatDay(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(
    new Date(iso),
  );
}

/**
 * Strips raw conversational meta-text and unprompted parenthesis disclaimers
 * (e.g. "(Note: This response was kept brief...)" or "(Note: Fact checker verified...)")
 * from the synthesized output, letting the technical Agent Log HUD present the diagnostic context.
 */
export function stripConversationalMetaText(text: string): string {
  if (!text || typeof text !== 'string') return '';

  let cleaned = text.trim();

  // 1. Remove standalone paragraph lines enclosed in parentheses with meta-notes
  cleaned = cleaned.replace(
    /^\s*\((?:Note|Notice|Disclaimer|Summary|Brief|Output|Synthesizer|Fact\s*Check|Verified|Response|Analysis|Caveat)[^)]*\)\s*$/gim,
    ''
  );

  // 2. Remove trailing parenthetical meta-notes at the end of the text
  cleaned = cleaned.replace(
    /\n*\s*\((?:Note|Notice|Disclaimer|Summary|Brief|Output|Synthesizer|Fact\s*Check|Verified|Response|Analysis|Caveat|Please\s+note)[^)]*\)\s*$/gi,
    ''
  );

  // 3. Remove "(This answer/response is brief because...)" or "(Brief because...)"
  cleaned = cleaned.replace(
    /\n*\s*\((?:This\s+)?(?:answer|response|summary|synthesis|explanation)\s+is\s+(?:brief|concise|short|streamlined)[^)]*\)\s*$/gi,
    ''
  );

  // 4. Remove leading meta parenthetical notes like "(Note: ...)" on the first line
  cleaned = cleaned.replace(
    /^\s*\((?:Note|Notice|Disclaimer|Summary|Brief|Output|Synthesizer|Fact\s*Check|Verified|Response|Analysis|Caveat)[^)]*\)\s*\n*/gi,
    ''
  );

  return cleaned.trim();
}

/**
 * Strips markdown syntax (headers, bold/italics, backticks, bullet points, numbers, links, code blocks)
 * from text for clean, natural neural speech synthesis and audio generation.
 */
export function cleanMarkdownForSpeech(text: string): string {
  if (!text || typeof text !== 'string') return '';

  return text
    // 1. Remove multi-line code blocks
    .replace(/```[\s\S]*?```/g, ' ')
    // 2. Remove inline code backticks while preserving content
    .replace(/`([^`]+)`/g, '$1')
    .replace(/`/g, '')
    // 3. Remove images ![alt](url)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    // 4. Transform links [text](url) into just text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // 5. Remove HTML tags
    .replace(/<[^>]+>/g, ' ')
    // 6. Remove headers at start of line (# H1, ## H2, etc.)
    .replace(/^\s*#{1,6}\s+/gm, '')
    // 7. Remove bullet points (*, -, +, •) at start of lines
    .replace(/^\s*[-*+•]\s+/gm, '')
    // 8. Remove ordered list numbering (1., 2., 10.) at start of lines
    .replace(/^\s*\d+\.\s+/gm, '')
    // 9. Remove blockquotes (>) at start of lines
    .replace(/^\s*>\s+/gm, '')
    // 10. Remove horizontal dividers
    .replace(/^\s*[-*_]{3,}\s*$/gm, '')
    // 11. Remove bold, italic, and strikethrough markers (*, _, ~) while preserving words
    .replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, '$1')
    .replace(/[*_~]/g, '')
    // 12. Clean up citations like [1], [2], [Source]
    .replace(/\[\d+\]/g, '')
    // 13. Collapse multiple line breaks and normalize spaces
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

