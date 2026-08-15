import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Bookmark, ExternalLink, MapPin, Navigation, Search, Trash2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SearchBox, WeatherCard, HourlyForecast, DailyForecast, ErrorMessage, LoadingMessage, ResultCard, WeatherMap } from '@/components';
import { WallpaperSelector } from '@/components/WallpaperSelector';
import { api } from '@/services/api';
import { getLocation } from '@/services/location';
import { storage } from '@/lib/storage';
import { useSettings } from '@/hooks/useSettings';
import type { SearchResult, WeatherData, Settings } from '@/types';

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

export function HomePage() {
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [settings] = useSettings();
  useEffect(() => { getLocation().then((position) => api.weather(`latitude=${position.latitude}&longitude=${position.longitude}`)).then(setWeather).catch(() => undefined); }, []);
  const search = (query: string) => { storage.saveSearch(query); navigate(`/search?q=${encodeURIComponent(query)}`); };
  return <>
    <section className="hero"><span className="eyebrow">NEXUS INTELLIGENT (dk959709@gmail.com)</span><h1>Search the web.<br /><span>Understand the world.</span></h1><p>One clear signal from billions of data points. Search, weather, and live context in one calm interface.</p></section>
    <SearchBox onSearch={search} recent={storage.getSearches()} />
    {weather ? <div className="home-dashboard"><div className="home-main"><WeatherCard data={weather.current} temperatureUnit={settings.temperature} windUnit={settings.wind} reduced={settings.animations === 'reduced'} /><HourlyForecast entries={weather.hourly} unit={settings.temperature} /></div><aside className="brief-card"><span className="eyebrow">LIVE SIGNALS</span><h2>World briefing</h2><p>Search the current web or open the live news desk for your next signal.</p><Link to="/news">Explore live news <ArrowUpRight size={15} /></Link></aside></div> : <div className="location-prompt"><Navigation size={25} /><h2>Weather intelligence is waiting</h2><p>Allow location access to see local conditions, or search for a city manually.</p><Link to="/weather">Open weather workspace</Link></div>}
  </>;
}

export function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get('q') ?? '';
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(storage.getSaved());
  const search = (value: string) => { storage.saveSearch(value); navigate(`/search?q=${encodeURIComponent(value)}`); };
  useEffect(() => { if (!query) return; setLoading(true); setError(''); api.search(query).then(setResults).catch((err: Error) => setError(err.message)).finally(() => setLoading(false)); }, [query]);
  const toggleSave = (result: SearchResult) => { const updated = storage.toggleSaved({ id: result.url, type: result.type === 'news' ? 'news' : 'search', title: result.title, subtitle: result.domain, url: result.url, savedAt: new Date().toISOString() }); setSaved(updated); };
  return <><PageIntro eyebrow="WEB SEARCH" title="Find the signal." description="Real results from the open web, normalized into a clear, readable stream." /><SearchBox onSearch={search} recent={storage.getSearches()} />{loading && <LoadingMessage label="Searching the live web..." />}{error && <ErrorMessage message={error.includes('not configured') ? 'Search is not configured yet. Add SEARCH_API_KEY and SEARCH_API_URL to the server environment.' : error} />}{!loading && query && !error && results.length === 0 && <div className="empty-state"><Search size={30} /><h2>No live results returned</h2><p>Try a broader search phrase.</p></div>}<div className="results-list">{results.map((result) => <ResultCard key={result.url} result={result} saved={saved.some((item) => item.id === result.url)} onSave={() => toggleSave(result)} />)}</div></>;
}

export function WeatherPage() {
  const [settings] = useSettings();
  const [city, setCity] = useState('');
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const load = useCallback((query: string) => { setLoading(true); setError(''); api.weather(query).then(setWeather).catch((err: Error) => setError(err.message)).finally(() => setLoading(false)); }, []);
  const searchCity = () => { if (city.trim()) load(`city=${encodeURIComponent(city.trim())}`); };
  const useMyLocation = () => { setLoading(true); setError(''); getLocation().then((position) => load(`latitude=${position.latitude}&longitude=${position.longitude}`)).catch((err: Error) => { setLoading(false); setError(err.message); }); };
  return <><PageIntro eyebrow="WEATHER INTELLIGENCE" title="Read the atmosphere." description="Live conditions, hourly detail, and a 7-day forecast from real weather data." /><div className="location-search"><MapPin size={17} /><input value={city} onChange={(event) => setCity(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') searchCity(); }} placeholder="Search a city" aria-label="Search a city" /><button onClick={searchCity}>Update</button><button className="secondary-button" onClick={useMyLocation}>Use my location</button></div>{loading && <LoadingMessage label="Reading live atmosphere data..." />}{error && <ErrorMessage message={error.includes('permission') ? error : error.includes('configured') ? 'Weather is unavailable. The server weather provider is not configured.' : error} />}{weather && <div className="weather-dashboard"><div className="weather-main"><WeatherCard data={weather.current} temperatureUnit={settings.temperature} windUnit={settings.wind} reduced={settings.animations === 'reduced'} /><HourlyForecast entries={weather.hourly} unit={settings.temperature} /><DailyForecast data={weather.daily} temperatureUnit={settings.temperature} windUnit={settings.wind} /></div><WeatherAlerts alerts={weather.alerts} /></div>}</>;
}

function WeatherAlerts({ alerts }: { alerts: WeatherData['alerts'] }) { return <aside className="alerts-card"><span className="eyebrow">WEATHER ALERTS</span>{alerts.length ? alerts.map((alert) => <div className={`alert ${alert.severity}`} key={alert.title}><b>{alert.title}</b><p>{alert.description}</p></div>) : <div className="no-alerts"><span>✓</span><p>No active alerts returned for this location.</p></div>}</aside>; }

export function NewsPage() {
  const [items, setItems] = useState<SearchResult[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.news().then(setItems).catch((err: Error) => setError(err.message)).finally(() => setLoading(false)); }, []);
  return <><PageIntro eyebrow="LIVE BRIEFING" title="What matters now." description="Current headlines from your configured news and search provider." />{loading && <LoadingMessage label="Fetching current headlines..." />}{error && <ErrorMessage message={error.includes('not configured') ? 'News is not configured yet. Add SEARCH_API_KEY and SEARCH_API_URL to the server environment.' : error} />}<div className="news-grid">{items.map((item) => <article className="news-card" key={item.url}><span className="eyebrow">{item.domain}</span><h2>{item.title}</h2><p>{item.description}</p><a href={item.url} target="_blank" rel="noreferrer">Read story <ArrowUpRight size={15} /></a></article>)}</div></>;
}

export function MapPage() {
  const [status, setStatus] = useState<boolean | null>(null);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | undefined>(undefined);
  useEffect(() => { api.configStatus().then((data) => setStatus(data.map)).catch(() => setStatus(false)); }, []);
  useEffect(() => { getLocation().then((pos) => setPosition({ latitude: pos.latitude, longitude: pos.longitude })).catch(() => undefined); }, []);
  return <><PageIntro eyebrow="WEATHER MAP" title="See the bigger picture." description="Explore live weather layers around the world." />{status ? <WeatherMap latitude={position?.latitude} longitude={position?.longitude} /> : <div className="map-panel"><MapPin size={36} /><h2>Map provider not configured</h2><p>Add MAP_API_KEY to the server environment to enable a live weather map. NEXUS does not invent map tiles or weather layers.</p></div>}</>;
}

export function SpacePage() {
  const [apod, setApod] = useState<{ title: string; explanation: string; url: string; hdurl?: string; date: string; media_type: string } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('https://new-nexus.onrender.com/api/nasa/apod').then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'NASA data is temporarily unavailable.');
      setApod(body.data);
    }).catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }, []);
  return <><PageIntro eyebrow="SPACE" title="Look up." description="Today's picture from NASA, with the story behind it." />{loading && <LoadingMessage label="Fetching today's space picture..." />}{error && <ErrorMessage message={error} />}{apod && <div className="news-card"><span className="eyebrow">{apod.date}</span><h2>{apod.title}</h2>{apod.media_type === 'image' ? <img src={apod.hdurl || apod.url} alt={apod.title} style={{ width: '100%', borderRadius: '12px', margin: '12px 0' }} /> : <a href={apod.url} target="_blank" rel="noreferrer">Watch video <ArrowUpRight size={15} /></a>}<p>{apod.explanation}</p></div>}</>;
}

export function SavedPage() {
  const [items, setItems] = useState(storage.getSaved());
  const remove = (id: string) => setItems(storage.removeSaved(id));
  return <><PageIntro eyebrow="YOUR LIBRARY" title="Saved for later." description="Search results and stories you want to return to." />{!items.length ? <div className="empty-state"><Bookmark size={34} /><h2>Your library is empty</h2><p>Save search results and stories to see them here.</p></div> : <div className="saved-list">{items.map((item) => <div className="saved-item" key={item.id}><div><span className="eyebrow">{item.type}</span><h2>{item.title}</h2><p>{item.subtitle}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer">Open source <ExternalLink size={13} /></a>}</div><button onClick={() => remove(item.id)} aria-label="Remove saved item"><Trash2 size={17} /></button></div>)}</div>}</>;
}

export function SettingsPage() {
  const [settings, update] = useSettings();
  const choose = <K extends keyof Settings>(key: K, value: Settings[K]) => update({ [key]: value });
  return <><PageIntro eyebrow="CONTROL CENTER" title="Make it yours." description="Tune the way NEXUS feels and reads across your devices." /><div className="settings-list"><SettingRow label="Theme" description="Choose the interface appearance." value={settings.theme} options={['dark', 'light', 'system']} onChange={(value) => choose('theme', value as Settings['theme'])} /><SettingRow label="Temperature" description="Choose Celsius or Fahrenheit." value={settings.temperature} options={['celsius', 'fahrenheit']} onChange={(value) => choose('temperature', value as Settings['temperature'])} /><SettingRow label="Wind speed" description="Choose kilometers or miles per hour." value={settings.wind} options={['kmh', 'mph']} onChange={(value) => choose('wind', value as Settings['wind'])} /><SettingRow label="Animations" description="Reduce motion for a calmer experience." value={settings.animations} options={['full', 'reduced']} onChange={(value) => choose('animations', value as Settings['animations'])} /><WallpaperSelector value={settings.wallpaper} onSelect={(wallpaper) => choose('wallpaper', wallpaper)} /><button className="danger-button" onClick={() => { storage.clearAll(); window.location.reload(); }}>Clear all local data</button></div></>;
}

function SettingRow({ label, description, value, options, onChange }: { label: string; description: string; value: string; options: string[]; onChange: (value: string) => void }) { return <section className="setting-row"><div><h2>{label}</h2><p>{description}</p></div><div className="segmented-control">{options.map((option) => <button className={option === value ? 'selected' : ''} onClick={() => onChange(option)} key={option}>{option}</button>)}</div></section>; }
