import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Bookmark, ExternalLink, MapPin, Navigation, Newspaper, Search, Send, Sparkles, Trash2 } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SearchBox, WeatherCard, HourlyForecast, DailyForecast, ErrorMessage, LoadingMessage, ResultCard, WeatherMap } from '@/components';
import { WallpaperSelector } from '@/components/WallpaperSelector';
import { SpaceStarfield } from '@/components/SpaceStarfield';
import { api } from '@/services/api';
import { getLocation } from '@/services/location';
import { storage } from '@/lib/storage';
import { useSettings } from '@/hooks/useSettings';
import { playTapSound } from '@/lib/audio';
import type { SearchResult, WeatherData, Settings } from '@/types';

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

export function HomePage() {
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [settings] = useSettings();
  const [aiQuery, setAiQuery] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  useEffect(() => { getLocation().then((position) => api.weather(`latitude=${position.latitude}&longitude=${position.longitude}`)).then(setWeather).catch(() => undefined); }, []);
  const search = (query: string) => { storage.saveSearch(query); navigate(`/search?q=${encodeURIComponent(query)}`); };

  const askNexusAI = async () => {
    const query = aiQuery.trim();
    if (!query || aiLoading) return;

    setAiLoading(true);
    setAiError('');
    setAiAnswer('');

    try {
      const response = await api.aiChat(query);
      setAiAnswer(response.answer);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'NEXUS AI is temporarily unavailable.',
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      <SpaceStarfield />
      <div className="space-content-wrapper">
        <div className="hero-wrap">
          <div className="hero-aurora-glow" aria-hidden="true" />
          <section className="hero">
            <span className="eyebrow">NEXUS INTELLIGENT (dk959709@gmail.com)</span>
            <h1>
              <span className="hero-gradient-line">Search the web.</span>
              <br />
              <span className="hero-gradient-line hero-glow-text">Understand the world.</span>
            </h1>
            <p>A unified view of live search, weather, and world signals — clear, fast, and precise.</p>
          </section>
        </div>
        <SearchBox onSearch={search} recent={storage.getSearches()} />

        <section
          className="nexus-ai-card"
          aria-label="NEXUS AI Search"
        >
          <div className="nexus-ai-label">
            <Sparkles size={16} className="ai-sparkle-active" />
            <span>NEXUS AI Search</span>
          </div>

          <div className="nexus-ai-form">
            <div className="nexus-ai-input-wrap">
              <Sparkles size={18} className="ai-sparkle-active" />

              <input
                value={aiQuery}
                onChange={(event) => setAiQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') askNexusAI();
                }}
                placeholder="Ask NEXUS AI anything..."
                aria-label="Ask NEXUS AI anything"
                className="nexus-ai-input"
              />
            </div>

            <button
              type="button"
              onClick={askNexusAI}
              disabled={!aiQuery.trim() || aiLoading}
              aria-label="Ask NEXUS AI"
              className="nexus-ai-submit"
            >
              <Send size={18} />
            </button>
          </div>

          {aiLoading && (
            <div className="nexus-ai-loading">
              <Sparkles size={14} className="ai-sparkle-active" /> NEXUS AI is thinking...
            </div>
          )}

          {aiError && (
            <div className="nexus-ai-error">
              {aiError}
            </div>
          )}

          {aiAnswer && (
            <div className="nexus-ai-answer">
              <div className="nexus-ai-answer-badge">
                <Sparkles size={14} className="ai-sparkle-active" /> NEXUS AI
              </div>
              {aiAnswer}
            </div>
          )}
        </section>

        {weather ? (
          <div className="home-dashboard">
            <div className="home-main">
              <WeatherCard
                data={weather.current}
                temperatureUnit={settings.temperature}
                windUnit={settings.wind}
                reduced={settings.animations === 'reduced'}
              />
              <HourlyForecast entries={weather.hourly} unit={settings.temperature} />
            </div>
            <aside className="brief-card">
              <span className="eyebrow">LIVE SIGNALS</span>
              <h2>World briefing</h2>
              <p>Search the current web or open the live news desk for your next signal.</p>
              <Link to="/news">
                Explore live news <ArrowUpRight size={15} />
              </Link>
            </aside>
          </div>
        ) : (
          <div className="location-prompt">
            <Navigation size={25} />
            <h2>Weather intelligence is waiting</h2>
            <p>Allow location access to see local conditions, or search for a city manually.</p>
            <Link to="/weather">Open weather workspace</Link>
          </div>
        )}
      </div>
    </>
  );
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
  return (
    <>
      <PageIntro eyebrow="LIVE BRIEFING" title="What matters now." description="Current headlines from your configured news and search provider." />
      {loading && <LoadingMessage label="Fetching current headlines..." />}
      {error && <ErrorMessage message={error.includes('not configured') ? 'News is not configured yet. Add SEARCH_API_KEY and SEARCH_API_URL to the server environment.' : error} />}
      <div className="news-grid">
        {items.map((item) => (
          <article className="news-card" key={item.url}>
            <div className="news-thumb-wrap">
              {item.image || item.thumbnail ? (
                <img
                  src={item.image || item.thumbnail}
                  alt={item.title}
                  className="news-thumb"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="news-thumb-placeholder">
                  <Newspaper size={32} />
                </div>
              )}
            </div>
            <div className="news-card-body">
              <div className="news-meta-row">
                <span className="news-source-info">
                  <img
                    src={`https://www.google.com/s2/favicons?domain=${item.domain}&sz=32`}
                    alt=""
                    className="news-source-favicon"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  {item.domain}
                </span>
                {item.date && <span>{item.date}</span>}
              </div>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <div className="news-card-footer">
                <a href={item.url} target="_blank" rel="noreferrer">
                  Read story <ArrowUpRight size={15} />
                </a>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export function MapPage() {
  const [status, setStatus] = useState<boolean | null>(null);
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | undefined>(undefined);
  useEffect(() => { api.configStatus().then((data) => setStatus(data.map)).catch(() => setStatus(false)); }, []);
  useEffect(() => { getLocation().then((pos) => setPosition({ latitude: pos.latitude, longitude: pos.longitude })).catch(() => undefined); }, []);
  return <><PageIntro eyebrow="WEATHER MAP" title="See the bigger picture." description="Explore live weather layers around the world." />{status ? <WeatherMap latitude={position?.latitude} longitude={position?.longitude} /> : <div className="map-panel"><MapPin size={36} /><h2>Map provider not configured</h2><p>Add MAP_API_KEY to the server environment to enable a live weather map. NEXUS does not invent map tiles or weather layers.</p></div>}</>;
}

export function SpacePage() {
  useSettings();
  const [apod, setApod] = useState<{ title: string; explanation: string; url: string; hdurl?: string; date: string; media_type: string } | null>(null);
  const [moon, setMoon] = useState<{ phaseName: string; illumination: number; ageDays: number } | null>(null);
  const [iss, setIss] = useState<{ latitude: number; longitude: number; timestamp: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch('/api/space/moon').then((res) => res.json()).then((json) => setMoon(json.data)).catch(() => {});
    fetch('/api/space/iss').then((res) => res.json()).then((json) => setIss(json.data)).catch(() => {});
    fetch('/api/nasa/apod').then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'NASA data is temporarily unavailable.');
      setApod(body.data);
    }).catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }, []);
  return (
    <>
      <SpaceStarfield />
      <div className="space-content-wrapper">
        <PageIntro eyebrow="SPACE" title="Look up." description="Today's picture from NASA, with the story behind it." />
        {loading && <LoadingMessage label="Fetching today's space picture..." />}
        {error && <ErrorMessage message={error} />}
        {apod && (() => {
          let explanation = apod.explanation || '';
          if (apod.title && explanation.toLowerCase().startsWith(apod.title.toLowerCase())) {
            explanation = explanation.slice(apod.title.length).trim();
            explanation = explanation.replace(/^[\s\-–—:.]+/g, '').trim();
          }
          return (
            <div className="news-card">
              <span className="eyebrow">{apod.date}</span>
              <h2>{apod.title}</h2>
              {apod.media_type === 'image' ? (
                <img
                  src={apod.hdurl || apod.url}
                  alt={apod.title}
                  style={{ width: '100%', borderRadius: '12px', margin: '12px 0' }}
                />
              ) : (
                <a href={apod.url} target="_blank" rel="noreferrer">
                  Watch video <ArrowUpRight size={15} />
                </a>
              )}
              <p>{explanation}</p>
            </div>
          );
        })()}
        {moon && (
          <div className="news-card weather-card">
            <span className="eyebrow">MOON PHASE</span>
            <h2>{moon.phaseName}</h2>
            <p>Illumination: {moon.illumination}% · Age: {moon.ageDays} days</p>
          </div>
        )}
        {iss && (
          <div className="news-card weather-card">
            <span className="eyebrow">ISS LOCATION</span>
            <h2>Live position</h2>
            <p>Latitude: {iss.latitude.toFixed(2)}° · Longitude: {iss.longitude.toFixed(2)}°</p>
          </div>
        )}
      </div>
    </>
  );
}

export function SavedPage() {
  const [items, setItems] = useState(storage.getSaved());
  const remove = (id: string) => setItems(storage.removeSaved(id));
  return <><PageIntro eyebrow="YOUR LIBRARY" title="Saved for later." description="Search results and stories you want to return to." />{!items.length ? <div className="empty-state"><Bookmark size={34} /><h2>Your library is empty</h2><p>Save search results and stories to see them here.</p></div> : <div className="saved-list">{items.map((item) => <div className="saved-item" key={item.id}><div><span className="eyebrow">{item.type}</span><h2>{item.title}</h2><p>{item.subtitle}</p>{item.url && <a href={item.url} target="_blank" rel="noreferrer">Open source <ExternalLink size={13} /></a>}</div><button onClick={() => remove(item.id)} aria-label="Remove saved item"><Trash2 size={17} /></button></div>)}</div>}</>;
}

export function SettingsPage() {
  const [settings, update] = useSettings();
  const choose = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    update({ [key]: value });
    if (settings.sound !== false && key === 'sound') {
      if (value === true) playTapSound();
    } else if (settings.sound !== false) {
      playTapSound();
    }
  };
  return <><PageIntro eyebrow="PREFERENCES" title="Personalize your experience." description="Adjust appearance, units, and display settings to match how you work." /><div className="settings-list"><SettingRow label="Appearance" description="Switch between Dark, Light, or match your system settings." value={settings.theme} options={['dark', 'light', 'system']} onChange={(value) => choose('theme', value as Settings['theme'])} /><SettingRow label="Navigation Tap Sound" description="Play a subtle click sound when switching tabs." value={settings.sound !== false ? 'on' : 'off'} options={['on', 'off']} onChange={(value) => choose('sound', value === 'on')} /><SettingRow label="Temperature Units" description="Display weather in Celsius or Fahrenheit." value={settings.temperature} options={['celsius', 'fahrenheit']} onChange={(value) => choose('temperature', value as Settings['temperature'])} /><SettingRow label="Wind Speed Units" description="Choose kilometers per hour or miles per hour." value={settings.wind} options={['kmh', 'mph']} onChange={(value) => choose('wind', value as Settings['wind'])} /><SettingRow label="Motion & Animations" description="Reduce motion for a calmer, distraction-free experience." value={settings.animations} options={['full', 'reduced']} onChange={(value) => choose('animations', value as Settings['animations'])} /><WallpaperSelector value={settings.wallpaper} onSelect={(wallpaper) => choose('wallpaper', wallpaper)} /><section className="setting-row"><div><h2>Telegram Bot Integration</h2><p>Connect your Telegram bot to receive Nexus intelligence, weather, and search.</p></div><Link to="/telegram" className="secondary-button" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 15px', borderRadius: '7px', textDecoration: 'none', fontWeight: 600, fontSize: '12px' }}><Send size={14} /> Configure Bot</Link></section><button className="danger-button" onClick={() => { storage.clearAll(); window.location.reload(); }}>Reset Preferences</button></div></>;
}

function SettingRow({ label, description, value, options, onChange }: { label: string; description: string; value: string; options: string[]; onChange: (value: string) => void }) { return <section className="setting-row"><div><h2>{label}</h2><p>{description}</p></div><div className="segmented-control">{options.map((option) => <button className={option === value ? 'selected' : ''} onClick={() => onChange(option)} key={option}>{option}</button>)}</div></section>; }

export { TelegramPage } from './TelegramPage';

