import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSnow, CloudSun, Sun } from 'lucide-react';
import type { Condition } from '@/types';

export function WeatherIcon({ condition, size = 28 }: { condition: Condition; size?: number }) {
  const Icon = { clear: Sun, cloudy: Cloud, rain: CloudRain, storm: CloudLightning, snow: CloudSnow, fog: CloudFog, 'partly-cloudy': CloudSun }[condition ?? 'clear'];
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}

export function AmbientBackdrop({ condition, reduced = false }: { condition: Condition; reduced?: boolean }) {
  return <div className={`ambient ambient-${condition} ${reduced ? 'ambient-reduced' : ''}`} aria-hidden="true"><div className="ambient-orb" /><div className="ambient-grid" /></div>;
}
