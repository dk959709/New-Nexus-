import {
  Bookmark,
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Eye,
  Gauge,
  Mic,
  Sun,
  Sunrise,
  Sunset,
  Wind,
  X,
  Search,
} from 'lucide-react';
import { useState } from 'react';
import type { Condition, HourlyEntry, WeatherCurrent, WeatherData, TemperatureUnit, WindUnit, SearchResult } from '@/types';
import { formatTemp, formatTime, formatWind } from '@/lib/format';
import { useSpeechSearch } from '@/hooks/useSpeechSearch';
import { WeatherBackground } from '@/animations/WeatherBackground';

export { Layout } from './Layout';

export function WeatherIcon({ condition, size = 28 }: { condition: Condition; size?: number }) {
  const icons: Record<Condition, typeof Cloud> = {
    clear: Sun,
    'partly-cloudy': CloudSun,
    cloudy: Cloud,
    rain: CloudRain,
    storm: CloudLightning,
    snow: CloudSnow,
    fog: CloudFog,
  };
  const Icon = icons[condition ?? 'clear'];
  return (
    <span className={`weather-icon-living weather-icon-${condition ?? 'clear'}`} aria-hidden="true">
      <Icon size={size} strokeWidth={1.7} />
    </span>
  );
}

export function SearchBox({ onSearch, recent = [], placeholder = 'What do you want to know?' }: { onSearch: (value: string) => void; recent?: string[]; placeholder?: string }) {
  const [value, setValue] = useState('');
  const { supported, listening, start } = useSpeechSearch(setValue);
  const submit = (candidate: string) => { if (candidate.trim()) onSearch(candidate.trim()); };
  return (
    <div className="search-box-wrap">
      <form className="search-box" onSubmit={(event) => { event.preventDefault(); submit(value); }}>
        <Search size={20} className="search-icon" />
        <input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} aria-label="Search" />
        {value && <button type="button" className="input-action" onClick={() => setValue('')} aria-label="Clear search"><X size={17} /></button>}
        {supported && <button type="button" className={`input-action ${listening ? 'recording' : ''}`} onClick={start} aria-label="Voice search"><Mic size={18} /></button>}
        <button className="search-submit" type="submit">Search</button>
      </form>
      {!value && recent.length > 0 && <div className="recent-row"><span>Recent</span>{recent.slice(0, 4).map((item) => <button key={item} onClick={() => submit(item)}>{item}</button>)}</div>}
    </div>
  );
}

export function WeatherCard({ data, temperatureUnit, windUnit, reduced }: { data: WeatherCurrent; temperatureUnit: TemperatureUnit; windUnit: WindUnit; reduced: boolean }) {
  return (
    <section className="weather-current card weather-card">
      <WeatherBackground condition={data.condition} isDay={data.isDay} reduced={reduced} />
      <div className="weather-current-content">
        <div className="weather-topline"><div><span className="eyebrow">LIVE CONDITIONS</span><h2>{data.location}</h2><p>{data.conditionLabel} · Updated {formatTime(data.updatedAt)}</p></div><span className="weather-icon"><WeatherIcon condition={data.condition} size={58} /></span></div>
        <div className="temperature weather-temp"><strong>{formatTemp(data.temperature, temperatureUnit)}</strong><span>Feels like {formatTemp(data.feelsLike, temperatureUnit)}</span></div>
        <div className="weather-metrics">
          <Metric icon={Droplets} label="Humidity" value={`${data.humidity}%`} /><Metric icon={Wind} label="Wind" value={formatWind(data.wind, windUnit)} /><Metric icon={Gauge} label="Pressure" value={`${data.pressure} hPa`} /><Metric icon={Eye} label="Visibility" value={`${data.visibility} km`} />
        </div>
        <div className="sun-row"><span><Sunrise size={15} /> {data.sunrise}</span><span>Rain {data.rainProbability}%</span><span><Sunset size={15} /> {data.sunset}</span></div>
      </div>
    </section>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Droplets; label: string; value: string }) {
  return <div className="metric"><Icon size={16} /><span>{label}</span><b>{value}</b></div>;
}

export function HourlyForecast({ entries, unit }: { entries: HourlyEntry[]; unit: TemperatureUnit }) {
  return <section className="forecast-section"><div className="section-heading"><div><span className="eyebrow">NEXT 24 HOURS</span><h3>Hourly forecast</h3></div></div><div className="hourly-list">{entries.map((entry) => <div className="hour-item" key={entry.time}><span>{formatTime(entry.time)}</span><WeatherIcon condition={entry.condition} size={25} /><b>{formatTemp(entry.temperature, unit)}</b><em>{entry.rainProbability}% rain</em></div>)}</div></section>;
}

export function DailyForecast({ data, temperatureUnit, windUnit }: { data: WeatherData['daily']; temperatureUnit: TemperatureUnit; windUnit: WindUnit }) {
  return <section className="forecast-section"><div className="section-heading"><div><span className="eyebrow">EXTENDED OUTLOOK</span><h3>7-day forecast</h3></div></div><div className="daily-list">{data.map((entry) => <div className="day-item" key={entry.day}><b>{entry.day}</b><WeatherIcon condition={entry.condition} size={25} /><span>{entry.conditionLabel}</span><em>{entry.rainProbability}%</em><strong>{formatTemp(entry.high, temperatureUnit)} <i>{formatTemp(entry.low, temperatureUnit)}</i></strong><small>{formatWind(entry.wind, windUnit)}</small></div>)}</div></section>;
}

export function ResultCard({ result, saved, onSave }: { result: SearchResult; saved: boolean; onSave: () => void }) {
  return <article className="result-card"><div className="result-meta"><span>{result.domain}</span><button onClick={onSave} aria-label={saved ? 'Remove from saved' : 'Save result'}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button></div><a href={result.url} target="_blank" rel="noreferrer"><h2>{result.title} <ExternalArrow /></h2></a><p>{result.description}</p><code>{result.url}</code></article>;
}

function ExternalArrow() { return <span className="external-arrow">↗</span>; }

export function ErrorMessage({ message }: { message: string }) { return <div className="error-message" role="alert">{message}</div>; }
export function LoadingMessage({ label = 'Loading live data...' }: { label?: string }) { return <div className="loading-message"><span className="loading-dot" />{label}</div>; }
export { WeatherMap } from './WeatherMap';
