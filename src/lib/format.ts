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

