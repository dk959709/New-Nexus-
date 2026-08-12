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
