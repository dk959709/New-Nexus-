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
  Home,
  Map,
  Menu,
  Mic,
  Newspaper,
  Radio,
  Rocket,
  Search,
  Settings,
  Sunrise,
  Sunset,
  Wind,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useState } from 'react';
import type { Condition, HourlyEntry, WeatherCurrent, WeatherData, TemperatureUnit, WindUnit, SearchResult } from '@/types';
import { formatTemp, formatTime, formatWind } from '@/lib/format';
import { useSpeechSearch } from '@/hooks/useSpeechSearch';
import { WeatherBackground } from '@/animations/WeatherBackground';
import { Outlet } from 'react-router-dom';

export function WeatherIcon({ condition, size = 28 }: { condition: Condition; size?: number }) {
  const icons: Record<Condition, typeof Cloud> = {
    clear: CloudSun,
    'partly-cloudy': CloudSun,
    cloudy: Cloud,
    rain: CloudRain,
    storm: CloudLightning,
    snow: CloudSnow,
    fog: CloudFog,
  };
  const Icon = icons[condition];
  return <Icon size={size} strokeWidth={1.6} />;
}

const navItems = [
  { to: '/', label: 'Overview', icon: Home },
  { to: '/search', label: 'Web Search', icon: Search },
  { to: '/weather', label: 'Weather', icon: CloudSun },
  { to: '/weather/map', label: 'Weather Map', icon: Map },
  { to: '/news', label: 'Live News', icon: Newspaper },
  { to: '/space', label: 'NASA Space', icon: Rocket },
  { to: '/saved', label: 'Saved', icon: Bookmark },
] as const;

export function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="app-shell">
      <aside className={menuOpen ? 'open' : ''}>
        <div className="brand"><span><Radio size={17} /></span><b>NEXUS</b></div>
        <small className="brand-subtitle">INTELLIGENCE OS</small>
        <nav className="side-nav">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink to={to} end={to === '/'} key={to} onClick={() => setMenuOpen(false)}>
              <Icon size={18} />{label}
            </NavLink>
          ))}
        </nav>
        <NavLink className="settings-link" to="/settings" onClick={() => setMenuOpen(false)}><Settings size={18} />Settings</NavLink>
        <p className="system-status"><i /> Systems online</p>
      </aside>
      <header className="mobile-header">
        <button className="icon-button" onClick={() => setMenuOpen((value) => !value)} aria-label="Open menu"><Menu size={21} /></button>
        <div className="brand"><span><Radio size={15} /></span><b>NEXUS</b></div>
        <NavLink to="/search" className="icon-button" aria-label="Search"><Search size={19} /></NavLink>
      </header>
      {menuOpen && <button className="menu-overlay" onClick={() => setMenuOpen(false)} aria-label="Close menu" />}
      <main><div className="page-content"><Outlet /></div></main>
      <nav className="bottom-nav">
        {navItems.slice(0, 5).map(({ to, label, icon: Icon }) => (
          <NavLink to={to} end={to === '/'} key={to}><Icon size={18} /><small>{label.replace('Web ', '')}</small></NavLink>
        ))}
      </nav>
    </div>
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
    <section className="weather-current card">
      <WeatherBackground condition={data.condition} isDay={data.isDay} reduced={reduced} />
      <div className="weather-current-content">
        <div className="weather-topline"><div><span className="eyebrow">LIVE CONDITIONS</span><h2>{data.location}</h2><p>{data.conditionLabel} · Updated {formatTime(data.updatedAt)}</p></div><WeatherIcon condition={data.condition} size={58} /></div>
        <div className="temperature"><strong>{formatTemp(data.temperature, temperatureUnit)}</strong><span>Feels like {formatTemp(data.feelsLike, temperatureUnit)}</span></div>
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
