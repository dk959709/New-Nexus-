import { useCallback, useEffect, useState } from 'react';
import {
  ArrowUpRight,
  Bookmark,
  BookOpen,
  ExternalLink,
  Globe,
  MapPin,
  Navigation,
  Newspaper,
  Search,
  Send,
  Sparkles,
  Trash2,
  User,
  Palette,
  Bell,
  Bot,
  Shield,
  Info,
  CheckCircle2,
  Image as ImageIcon,
  Film,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SearchBox, WeatherCard, HourlyForecast, DailyForecast, ErrorMessage, LoadingMessage, ResultCard, WeatherMap, AnswerCard, MediaResultCard, MediaViewer } from '@/components';
import { WallpaperSelector } from '@/components/WallpaperSelector';
import { SpaceStarfield } from '@/components/SpaceStarfield';
import { MeteorShower } from '@/animations/MeteorShower';
import { AIProvidersSettings } from '@/components/AIProvidersSettings';
import { api, BASE } from '@/services/api';
import { searchWikimediaCommons, extractMediaFromResults, searchYouTubeVideos, searchMoreVideos } from '@/services/media';
import { getLocation } from '@/services/location';
import { storage } from '@/lib/storage';
import { useSettings } from '@/hooks/useSettings';
import { playTapSound } from '@/lib/audio';
import { askSmartAnswerEngine } from '@/services/answerEngine';
import type { SearchResult, WeatherData, Settings, AnswerEngineResult, MediaItem } from '@/types';


function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

const SMART_SUGGESTIONS = [
  'What is a black hole?',
  'Explain gravity simply',
  'What is photosynthesis?',
  'Latest space news',
  'Search Wikipedia for Mars',
];

export function HomePage() {
  const navigate = useNavigate();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [settings] = useSettings();
  const [aiQuery, setAiQuery] = useState('');
  const [smartResult, setSmartResult] = useState<AnswerEngineResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  useEffect(() => {
    getLocation()
      .then((position) => api.weather(`latitude=${position.latitude}&longitude=${position.longitude}`))
      .then(setWeather)
      .catch(() => undefined);
  }, []);

  const search = (query: string) => {
    storage.saveSearch(query);
    navigate(`/search?q=${encodeURIComponent(query)}`);
  };

  const askNexusAI = async (queryToAsk?: string) => {
    const targetQuery = (queryToAsk || aiQuery).trim();
    if (!targetQuery || aiLoading) return;

    playTapSound();
    setAiQuery(targetQuery);
    setAiLoading(true);
    setAiError('');
    setSmartResult(null);

    try {
      const response = await askSmartAnswerEngine(targetQuery);
      setSmartResult(response);
    } catch (err) {
      setAiError(
        err instanceof Error
          ? err.message
          : 'NEXUS Answer Engine is temporarily unavailable.',
      );
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <>
      <SpaceStarfield />
      <MeteorShower reduced={settings.animations === 'reduced'} />
      <div className="space-content-wrapper">
        <div className="hero-wrap">
          <div className="hero-aurora-glow" aria-hidden="true" />
          <section className="hero">
            <span className="eyebrow">NEXUS INTELLIGENT</span>
            <h1>
              <span className="hero-gradient-line">Search the web.</span>
              <br />
              <span className="hero-gradient-line hero-glow-text">Understand the world.</span>
            </h1>
            <p>A unified view of live search, weather, and world signals — clear, fast, and precise.</p>
          </section>
        </div>
        <SearchBox onSearch={search} recent={storage.getSearches()} />

        {/* Smart Answer Engine Section */}
        <section
          className="nexus-ai-card"
          aria-label="NEXUS Smart Answer Engine"
        >
          <div className="nexus-ai-label">
            <div className="flex items-center gap-1.5">
              <Sparkles size={16} className="ai-sparkle-active" />
              <span>NEXUS Smart Answer Engine</span>
            </div>
            <span className="text-xs opacity-60">Multi-Source Intelligence</span>
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
                placeholder="Ask NEXUS anything (e.g. What is a black hole? Explain gravity)..."
                aria-label="Ask NEXUS AI anything"
                className="nexus-ai-input"
              />
            </div>

            <button
              type="button"
              onClick={() => askNexusAI()}
              disabled={!aiQuery.trim() || aiLoading}
              aria-label="Ask NEXUS AI"
              className="nexus-ai-submit"
            >
              <Send size={18} />
            </button>
          </div>

          {/* Quick Suggestions Chips */}
          {!smartResult && !aiLoading && (
            <div className="smart-prompt-chips-row">
              <span className="prompt-chips-label">Try asking:</span>
              <div className="prompt-chips-list">
                {SMART_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="smart-suggestion-chip"
                    onClick={() => askNexusAI(suggestion)}
                  >
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {aiLoading && (
            <div className="nexus-ai-loading">
              <Sparkles size={14} className="ai-sparkle-active animate-spin" />
              <span>NEXUS Engine is retrieving and synthesizing verified sources...</span>
            </div>
          )}

          {aiError && (
            <div className="nexus-ai-error">
              {aiError}
            </div>
          )}

          {smartResult && (
            <AnswerCard
              result={smartResult}
              onSelectFollowUp={(q) => askNexusAI(q)}
              className="mt-4"
            />
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
  const [sourceTab, setSourceTab] = useState<'all' | 'web' | 'wikipedia' | 'media'>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [mediaResults, setMediaResults] = useState<MediaItem[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(storage.getSaved());
  const [mediaOffset, setMediaOffset] = useState(16);
  const [loadingMore, setLoadingMore] = useState(false);

  // Synthesis on Search Page
  const [synthesizedResult, setSynthesizedResult] = useState<AnswerEngineResult | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState('');

  const loadMoreVideos = useCallback(async () => {
    if (!query || loadingMore) return;
    setLoadingMore(true);
    try {
      const pageNum = Math.floor(mediaOffset / 16) + 1;
      const moreCommons = await searchWikimediaCommons(query, 16, mediaOffset).catch(() => [] as MediaItem[]);
      const moreYouTube = searchMoreVideos(query, pageNum);
      const combinedNew = [...moreCommons, ...moreYouTube];

      if (combinedNew.length > 0) {
        setMediaResults((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newItems = combinedNew.filter((m) => !existingIds.has(m.id));
          return [...prev, ...newItems];
        });
        setMediaOffset((prev) => prev + 16);
      } else {
        const fallbackMore = searchMoreVideos(query, pageNum + 1);
        if (fallbackMore.length > 0) {
          setMediaResults((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newItems = fallbackMore.filter((m) => !existingIds.has(m.id));
            return [...prev, ...newItems];
          });
        }
        setMediaOffset((prev) => prev + 16);
      }
    } catch (err) {
      console.error('Failed to load more videos:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [query, loadingMore, mediaOffset]);

  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 600) {
        if (!loadingMore && query) {
          loadMoreVideos();
        }
      }
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadingMore, query, mediaOffset, loadMoreVideos]);

  const search = (value: string) => {
    storage.saveSearch(value);
    setSynthesizedResult(null);
    navigate(`/search?q=${encodeURIComponent(value)}`);
  };

  useEffect(() => {
    if (!query) {
      setResults([]);
      setMediaResults([]);
      setSynthesizedResult(null);
      return;
    }

    setMediaOffset(16);

    let isMounted = true;
    setLoading(true);
    setError('');
    setSynthesizedResult(null);

    const fetchResults = async () => {
      try {
        const youtubeItems = searchYouTubeVideos(query);

        if (sourceTab === 'media') {
          const [commonsItems, webItems] = await Promise.all([
            searchWikimediaCommons(query, 16).catch(() => [] as MediaItem[]),
            api.search(query, 'ALL').catch(() => [] as SearchResult[]),
          ]);
          if (!isMounted) return;
          const extractedWebMedia = extractMediaFromResults(webItems);
          const combinedMedia: MediaItem[] = [...youtubeItems, ...commonsItems];
          for (const item of extractedWebMedia) {
            if (!combinedMedia.some((m) => m.mediaUrl === item.mediaUrl)) {
              combinedMedia.push(item);
            }
          }
          setMediaResults(combinedMedia);
          setResults([]);
        } else if (sourceTab === 'wikipedia') {
          const wikiItems = await api.searchWikipedia(query, 15);
          if (!isMounted) return;
          const searchRes = wikiItems.map(api.wikipediaToSearchResult);
          setResults(searchRes);
          setMediaResults(extractMediaFromResults(searchRes));
        } else if (sourceTab === 'web') {
          const webItems = await api.search(query, 'ALL');
          if (!isMounted) return;
          setResults(webItems);
          const webMedia = extractMediaFromResults(webItems);
          const combinedMedia: MediaItem[] = [...youtubeItems];
          for (const item of webMedia) {
            if (!combinedMedia.some((m) => m.mediaUrl === item.mediaUrl)) {
              combinedMedia.push(item);
            }
          }
          setMediaResults(combinedMedia);
        } else {
          // 'all': fetch web results, Wikipedia results, Wikimedia media, and YouTube videos concurrently
          const [webItems, wikiItems, commonsItems] = await Promise.all([
            api.search(query, 'ALL').catch(() => [] as SearchResult[]),
            api.searchWikipedia(query, 6).then((items) => items.map(api.wikipediaToSearchResult)).catch(() => [] as SearchResult[]),
            searchWikimediaCommons(query, 8).catch(() => [] as MediaItem[]),
          ]);

          if (!isMounted) return;

          const combined: SearchResult[] = [];
          if (wikiItems.length > 0) {
            combined.push(...wikiItems.slice(0, 3));
          }
          for (const item of webItems) {
            if (!combined.some((c) => c.url === item.url)) {
              combined.push(item);
            }
          }
          if (wikiItems.length > 3) {
            for (const item of wikiItems.slice(3)) {
              if (!combined.some((c) => c.url === item.url)) {
                combined.push(item);
              }
            }
          }

          setResults(combined);

          const webMedia = extractMediaFromResults(combined);
          const combinedMedia: MediaItem[] = [...youtubeItems, ...commonsItems];
          for (const item of webMedia) {
            if (!combinedMedia.some((m) => m.mediaUrl === item.mediaUrl)) {
              combinedMedia.push(item);
            }
          }
          setMediaResults(combinedMedia);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to fetch search results.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchResults();

    return () => {
      isMounted = false;
    };
  }, [query, sourceTab]);

  const handleSynthesizeResults = async () => {
    if (!query || results.length === 0 || synthesizing) return;
    playTapSound();
    setSynthesizing(true);
    setSynthesisError('');

    try {
      const response = await askSmartAnswerEngine(query, results);
      setSynthesizedResult(response);
    } catch (err) {
      setSynthesisError(
        err instanceof Error
          ? err.message
          : 'Failed to synthesize search results.',
      );
    } finally {
      setSynthesizing(false);
    }
  };

  const toggleSave = (result: SearchResult) => {
    const updated = storage.toggleSaved({
      id: result.url,
      type: result.type === 'news' ? 'news' : 'search',
      title: result.title,
      subtitle: result.domain,
      url: result.url,
      savedAt: new Date().toISOString(),
    });
    setSaved(updated);
  };

  return (
    <>
      <PageIntro
        eyebrow="KNOWLEDGE & WEB SEARCH"
        title="Find the signal."
        description="Real results from the open web, Wikipedia knowledge base, and Wikimedia media stream, normalized into a clear, readable display."
      />
      <SearchBox onSearch={search} recent={storage.getSearches()} />

      <div className="search-filter-tabs-wrap">
        <div className="search-filter-tabs">
          <button
            type="button"
            className={`search-filter-tab ${sourceTab === 'all' ? 'active' : ''}`}
            onClick={() => { playTapSound(); setSourceTab('all'); }}
          >
            <Sparkles size={14} />
            <span>All Sources</span>
          </button>

          <button
            type="button"
            className={`search-filter-tab ${sourceTab === 'web' ? 'active' : ''}`}
            onClick={() => { playTapSound(); setSourceTab('web'); }}
          >
            <Globe size={14} />
            <span>Web</span>
          </button>

          <button
            type="button"
            className={`search-filter-tab ${sourceTab === 'wikipedia' ? 'active' : ''}`}
            onClick={() => { playTapSound(); setSourceTab('wikipedia'); }}
          >
            <BookOpen size={14} />
            <span>Wikipedia</span>
          </button>

          <button
            type="button"
            className={`search-filter-tab ${sourceTab === 'media' ? 'active' : ''}`}
            onClick={() => { playTapSound(); setSourceTab('media'); }}
          >
            <ImageIcon size={14} />
            <span>🖼️ Media</span>
          </button>
        </div>
      </div>

      {loading && (
        <LoadingMessage
          label={
            sourceTab === 'wikipedia'
              ? 'Searching Wikipedia knowledge base...'
              : sourceTab === 'media'
              ? 'Retrieving Wikimedia Commons and media stream...'
              : 'Searching live sources...'
          }
        />
      )}

      {error && (
        <ErrorMessage
          message={
            error.includes('not configured')
              ? 'Search is not configured yet. Add SEARCH_API_KEY and SEARCH_API_URL to the server environment, or use Wikipedia or Media search tabs.'
              : error
          }
        />
      )}

      {/* "Ask NEXUS to synthesize these results" Action Banner */}
      {!loading && results.length > 0 && sourceTab !== 'media' && (
        <div className="nexus-synthesize-banner">
          <div className="synthesize-banner-content">
            <div className="synthesize-banner-info">
              <Sparkles size={16} className="text-cyan-400 animate-pulse" />
              <div>
                <h4>Synthesize with NEXUS AI</h4>
                <p>Generate a concise, verified answer cited directly from these search results.</p>
              </div>
            </div>
            <button
              type="button"
              className="synthesize-action-btn"
              onClick={handleSynthesizeResults}
              disabled={synthesizing}
            >
              {synthesizing ? (
                <>
                  <Sparkles size={14} className="animate-spin" />
                  <span>Synthesizing...</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Ask NEXUS about these results</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {synthesisError && (
        <div className="nexus-ai-error mb-4">
          {synthesisError}
        </div>
      )}

      {synthesizedResult && (
        <div className="mb-6">
          <AnswerCard
            result={synthesizedResult}
            onSelectFollowUp={(q) => search(q)}
          />
        </div>
      )}

      {!loading && query && !error && sourceTab === 'media' && mediaResults.length === 0 && (
        <div className="empty-state">
          <ImageIcon size={30} />
          <h2>No playable media found for this search.</h2>
          <p>Try a different search term or check Web and Wikipedia tabs.</p>
        </div>
      )}

      {!loading && query && !error && sourceTab !== 'media' && results.length === 0 && (
        <div className="empty-state">
          <Search size={30} />
          <h2>No live results returned</h2>
          <p>Try a broader search phrase or check another source tab.</p>
        </div>
      )}

      {sourceTab === 'media' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mediaResults.map((item) => (
              <MediaResultCard
                key={item.id}
                item={item}
                onSelect={(m) => setSelectedMedia(m)}
              />
            ))}
          </div>
          {mediaResults.length > 0 && (
            <div className="text-center pt-4 pb-8">
              <button
                type="button"
                onClick={loadMoreVideos}
                disabled={loadingMore}
                className="secondary-button px-6 py-2.5 text-sm inline-flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
                    Loading more videos...
                  </>
                ) : (
                  '↓ Load More Videos'
                )}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="results-list">
          {results.map((result) => (
            <ResultCard
              key={result.url}
              result={result}
              saved={saved.some((item) => item.id === result.url)}
              onSave={() => toggleSave(result)}
            />
          ))}
        </div>
      )}

      <MediaViewer item={selectedMedia} onClose={() => setSelectedMedia(null)} />
    </>
  );
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
                    src={`https://www.google.com/s2/favicons?domain=${typeof item.domain === 'string' ? item.domain : 'news'}&sz=32`}
                    alt=""
                    className="news-source-favicon"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  {typeof item.domain === 'string' && item.domain ? item.domain : 'news'}
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
  const [settings] = useSettings();
  const [apod, setApod] = useState<{ title: string; explanation: string; url: string; hdurl?: string; date: string; media_type: string } | null>(null);
  const [moon, setMoon] = useState<{ phaseName: string; illumination: number; ageDays: number } | null>(null);
  const [iss, setIss] = useState<{ latitude: number; longitude: number; timestamp: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch(BASE + '/api/space/moon').then((res) => res.json()).then((json) => setMoon(json.data)).catch(() => {});
    fetch(BASE + '/api/space/iss').then((res) => res.json()).then((json) => setIss(json.data)).catch(() => {});
    fetch(BASE + '/api/nasa/apod').then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'NASA data is temporarily unavailable.');
      setApod(body.data);
    }).catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }, []);
  return (
    <>
      <SpaceStarfield />
      <MeteorShower reduced={settings.animations === 'reduced'} />
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

type SettingsCategory =
  | 'account'
  | 'appearance'
  | 'notifications'
  | 'ai'
  | 'media-backend'
  | 'privacy'
  | 'about';

interface TestResultData {
  available: boolean;
  version?: string;
  success: boolean;
  title?: string;
  thumbnail?: string;
  duration?: number;
  source?: string;
  originalUrl?: string;
  formats?: Array<{
    formatId: string;
    ext: string;
    height?: number;
    width?: number;
    fps?: number;
    hasVideo: boolean;
    hasAudio: boolean;
    playableUrl: string;
  }>;
  error?: string;
}

function MediaBackendSettings() {
  const [status, setStatus] = useState<{ available: boolean; version?: string; message?: string } | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [testUrl, setTestUrl] = useState('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResultData | null>(null);

  const checkStatus = () => {
    setLoadingStatus(true);
    api.getMediaStatus()
      .then((res) => {
        setStatus(res);
        setLoadingStatus(false);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Failed to check status';
        setStatus({ available: false, message: msg });
        setLoadingStatus(false);
      });
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleTest = () => {
    if (!testUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    api.testMediaBackend(testUrl.trim())
      .then((res) => {
        setTesting(false);
        setTestResult(res);
      })
      .catch((err: unknown) => {
        setTesting(false);
        const msg = err instanceof Error ? err.message : 'Test failed';
        setTestResult({ available: false, success: false, error: msg });
      });
  };

  return (
    <div className="settings-list space-y-6">
      <section
        style={{
          background: 'rgba(14,31,39,0.6)',
          border: '1px solid var(--line)',
          borderRadius: '12px',
          padding: '24px',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 style={{ fontSize: '16px', margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎬</span> yt-dlp Backend Integration
            </h2>
            <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>
              Server-side media stream extraction for YouTube, Vimeo, and public video sources.
            </p>
          </div>
          <button
            onClick={checkStatus}
            className="secondary-button text-xs px-3 py-1.5"
            disabled={loadingStatus}
          >
            Refresh Status
          </button>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-lg bg-slate-950/60 border border-slate-800 mb-6">
          <div className="flex-1">
            <span className="text-xs text-slate-400 block mb-1">Backend Status</span>
            {loadingStatus ? (
              <span className="text-xs text-slate-400">Checking status...</span>
            ) : status?.available ? (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-sm font-semibold text-emerald-400">Available ({status.version || 'Active'})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                <span className="text-sm font-semibold text-rose-400">Unavailable ({status?.message || 'Not found'})</span>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-200">Test Media Backend Extraction</h3>
          <p className="text-xs text-slate-400">
            Enter a public video URL to test metadata extraction and stream resolution.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={testUrl}
              onChange={(e) => setTestUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            />
            <button
              onClick={handleTest}
              disabled={testing || !testUrl.trim()}
              className="search-submit text-xs px-4 py-2 whitespace-nowrap flex items-center gap-1.5"
            >
              {testing ? 'Extracting...' : 'Test Backend'}
            </button>
          </div>

          {testResult && (
            <div className="mt-4 p-4 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-2 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span className="text-slate-400">Test Result</span>
                <span className={testResult.success ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                  {testResult.success ? 'SUCCESS ✓' : 'FAILED ✕'}
                </span>
              </div>
              {testResult.success ? (
                <>
                  <p><strong className="text-cyan-400">Title:</strong> {testResult.title}</p>
                  <p><strong className="text-cyan-400">Source:</strong> {testResult.source}</p>
                  <p><strong className="text-cyan-400">Formats Found:</strong> {testResult.formats?.length || 0}</p>
                  <p><strong className="text-cyan-400">Playable Stream URL:</strong> <a href={testResult.formats?.[0]?.playableUrl} target="_blank" rel="noreferrer" className="text-cyan-300 underline truncate block">{testResult.formats?.[0]?.playableUrl}</a></p>
                </>
              ) : (
                <p className="text-rose-400"><strong className="text-slate-300">Error:</strong> {testResult.error}</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export function SettingsPage() {
  const [settings, update] = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTabParam = (searchParams.get('tab') as SettingsCategory) || 'ai';
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>(activeTabParam);

  const switchCategory = (cat: SettingsCategory) => {
    setActiveCategory(cat);
    setSearchParams({ tab: cat });
    if (settings.sound !== false) {
      playTapSound();
    }
  };

  const choose = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    update({ [key]: value });
    if (settings.sound !== false && key === 'sound') {
      if (value === true) playTapSound();
    } else if (settings.sound !== false) {
      playTapSound();
    }
  };

  return (
    <>
      <PageIntro
        eyebrow="SYSTEM CONFIGURATION"
        title="Settings & Intelligence."
        description="Manage AI providers, neural keys, workspace appearance, and system integrations."
      />

      {/* Category Navigation Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '24px',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <button
          onClick={() => switchCategory('ai')}
          className={activeCategory === 'ai' ? 'selected' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: `1px solid ${
              activeCategory === 'ai' ? 'var(--accent)' : 'rgba(165,207,214,0.18)'
            }`,
            background:
              activeCategory === 'ai'
                ? 'rgba(97,215,201,0.15)'
                : 'rgba(14,31,39,0.6)',
            color: activeCategory === 'ai' ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            boxShadow:
              activeCategory === 'ai' ? '0 0 12px rgba(97,215,201,0.2)' : 'none',
          }}
        >
          <Bot size={16} /> 🤖 AI Providers
        </button>

        <button
          onClick={() => switchCategory('appearance')}
          className={activeCategory === 'appearance' ? 'selected' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: `1px solid ${
              activeCategory === 'appearance'
                ? 'var(--accent)'
                : 'rgba(165,207,214,0.18)'
            }`,
            background:
              activeCategory === 'appearance'
                ? 'rgba(97,215,201,0.15)'
                : 'rgba(14,31,39,0.6)',
            color: activeCategory === 'appearance' ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Palette size={16} /> Appearance
        </button>

        <button
          onClick={() => switchCategory('notifications')}
          className={activeCategory === 'notifications' ? 'selected' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: `1px solid ${
              activeCategory === 'notifications'
                ? 'var(--accent)'
                : 'rgba(165,207,214,0.18)'
            }`,
            background:
              activeCategory === 'notifications'
                ? 'rgba(97,215,201,0.15)'
                : 'rgba(14,31,39,0.6)',
            color:
              activeCategory === 'notifications' ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Bell size={16} /> Notifications
        </button>

        <button
          onClick={() => switchCategory('account')}
          className={activeCategory === 'account' ? 'selected' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: `1px solid ${
              activeCategory === 'account'
                ? 'var(--accent)'
                : 'rgba(165,207,214,0.18)'
            }`,
            background:
              activeCategory === 'account'
                ? 'rgba(97,215,201,0.15)'
                : 'rgba(14,31,39,0.6)',
            color: activeCategory === 'account' ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <User size={16} /> Account
        </button>

        <button
          onClick={() => switchCategory('media-backend')}
          className={activeCategory === 'media-backend' ? 'selected' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: `1px solid ${
              activeCategory === 'media-backend'
                ? 'var(--accent)'
                : 'rgba(165,207,214,0.18)'
            }`,
            background:
              activeCategory === 'media-backend'
                ? 'rgba(97,215,201,0.15)'
                : 'rgba(14,31,39,0.6)',
            color: activeCategory === 'media-backend' ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Film size={16} /> Media Backends
        </button>

        <button
          onClick={() => switchCategory('privacy')}
          className={activeCategory === 'privacy' ? 'selected' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: `1px solid ${
              activeCategory === 'privacy'
                ? 'var(--accent)'
                : 'rgba(165,207,214,0.18)'
            }`,
            background:
              activeCategory === 'privacy'
                ? 'rgba(97,215,201,0.15)'
                : 'rgba(14,31,39,0.6)',
            color: activeCategory === 'privacy' ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Shield size={16} /> Privacy & Security
        </button>

        <button
          onClick={() => switchCategory('about')}
          className={activeCategory === 'about' ? 'selected' : ''}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '9px 16px',
            borderRadius: '8px',
            border: `1px solid ${
              activeCategory === 'about'
                ? 'var(--accent)'
                : 'rgba(165,207,214,0.18)'
            }`,
            background:
              activeCategory === 'about'
                ? 'rgba(97,215,201,0.15)'
                : 'rgba(14,31,39,0.6)',
            color: activeCategory === 'about' ? 'var(--accent)' : 'var(--muted)',
            fontWeight: 600,
            fontSize: '13px',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Info size={16} /> About
        </button>
      </div>

      {/* Category Views */}
      <div className="settings-content-wrapper">
        {/* 🤖 AI Providers Category */}
        {activeCategory === 'ai' && <AIProvidersSettings />}

        {/* 🎬 Media Backends Category */}
        {activeCategory === 'media-backend' && <MediaBackendSettings />}

        {/* 🎨 Appearance Category */}
        {activeCategory === 'appearance' && (
          <div className="settings-list">
            <SettingRow
              label="Theme Mode"
              description="Switch between Dark, Light, or match your system settings."
              value={settings.theme}
              options={['dark', 'light', 'system']}
              onChange={(value) => choose('theme', value as Settings['theme'])}
            />
            <SettingRow
              label="Navigation Audio Feedback"
              description="Play a subtle tactical sound when switching tabs and interacting with controls."
              value={settings.sound !== false ? 'on' : 'off'}
              options={['on', 'off']}
              onChange={(value) => choose('sound', value === 'on')}
            />
            <SettingRow
              label="Temperature Units"
              description="Display atmospheric weather readings in Celsius or Fahrenheit."
              value={settings.temperature}
              options={['celsius', 'fahrenheit']}
              onChange={(value) => choose('temperature', value as Settings['temperature'])}
            />
            <SettingRow
              label="Wind Speed Units"
              description="Display wind velocity in kilometers per hour or miles per hour."
              value={settings.wind}
              options={['kmh', 'mph']}
              onChange={(value) => choose('wind', value as Settings['wind'])}
            />
            <SettingRow
              label="Motion & Starfield Effects"
              description="Toggle high-fidelity orbital animations or distraction-free static mode."
              value={settings.animations}
              options={['full', 'reduced']}
              onChange={(value) => choose('animations', value as Settings['animations'])}
            />
            <WallpaperSelector
              value={settings.wallpaper}
              onSelect={(wallpaper) => choose('wallpaper', wallpaper)}
            />
          </div>
        )}

        {/* 🔔 Notifications Category */}
        {activeCategory === 'notifications' && (
          <div className="settings-list">
            <section
              className="setting-row"
              style={{
                background: 'linear-gradient(135deg, rgba(14,31,39,0.7) 0%, rgba(20,24,48,0.7) 100%)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '16px', margin: '0 0 4px' }}>Telegram Bot Integration</h2>
                <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>
                  Connect your personal Telegram bot for instant weather alerts, smart search, and scheduled briefings.
                </p>
              </div>
              <Link
                to="/telegram"
                className="secondary-button"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '9px 16px',
                  borderRadius: '8px',
                  textDecoration: 'none',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                <Send size={15} /> Configure Telegram
              </Link>
            </section>

            <section
              className="setting-row"
              style={{
                background: 'rgba(14,31,39,0.5)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '15px', margin: '0 0 4px' }}>Severe Weather Alerts</h2>
                <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>
                  Display alert banners on dashboard when meteorological agencies issue warnings for your area.
                </p>
              </div>
              <span style={{ fontSize: '12px', color: '#34d399', fontWeight: 600 }}>
                Enabled (Active)
              </span>
            </section>
          </div>
        )}

        {/* 👤 Account Category */}
        {activeCategory === 'account' && (
          <div className="settings-list">
            <section
              className="setting-row"
              style={{
                background: 'linear-gradient(135deg, rgba(14,31,39,0.7) 0%, rgba(20,24,48,0.7) 100%)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(97,215,201,0.15)',
                    color: 'var(--accent)',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <User size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', margin: '0 0 4px' }}>NEXUS Local User</h2>
                  <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>
                    Workspace Session · Encrypted Client Storage
                  </p>
                </div>
              </div>
              <span
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  background: 'rgba(52,211,153,0.15)',
                  color: '#34d399',
                  fontWeight: 600,
                }}
              >
                Local Synced
              </span>
            </section>

            <section
              className="setting-row"
              style={{
                background: 'rgba(14,31,39,0.5)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '15px', margin: '0 0 4px' }}>AI Provider Credentials</h2>
                <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>
                  Manage multiple API keys, rotation strategy, and models in the AI Providers section.
                </p>
              </div>
              <button
                onClick={() => switchCategory('ai')}
                className="secondary-button"
                style={{ padding: '8px 14px', borderRadius: '7px', fontSize: '12px' }}
              >
                Open AI Providers
              </button>
            </section>
          </div>
        )}

        {/* 🔒 Privacy & Security Category */}
        {activeCategory === 'privacy' && (
          <div className="settings-list">
            <section
              className="setting-row"
              style={{
                background: 'linear-gradient(135deg, rgba(14,31,39,0.7) 0%, rgba(20,24,48,0.7) 100%)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '15px', margin: '0 0 4px' }}>Client-Side Zero Telemetry</h2>
                <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>
                  Your search history, saved articles, smart memory, and custom API keys are stored locally on your device.
                </p>
              </div>
              <CheckCircle2 size={20} color="#34d399" />
            </section>

            <section
              className="setting-row"
              style={{
                background: 'rgba(14,31,39,0.5)',
                border: '1px solid var(--line)',
                borderRadius: '10px',
                padding: '20px',
              }}
            >
              <div>
                <h2 style={{ fontSize: '15px', margin: '0 0 4px' }}>Reset System Preferences & Data</h2>
                <p style={{ color: 'var(--muted)', fontSize: '12px', margin: 0 }}>
                  Erase local caches, preferences, search history, and reset all configured state.
                </p>
              </div>
              <button
                className="danger-button"
                onClick={() => {
                  if (confirm('Are you sure you want to reset all preferences and stored state?')) {
                    storage.clearAll();
                    window.location.reload();
                  }
                }}
              >
                Reset All Data
              </button>
            </section>
          </div>
        )}

        {/* ℹ️ About Category */}
        {activeCategory === 'about' && (
          <div className="settings-list">
            <section
              style={{
                background: 'linear-gradient(135deg, rgba(14,31,39,0.7) 0%, rgba(20,24,48,0.7) 100%)',
                border: '1px solid var(--line)',
                borderRadius: '12px',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: 'rgba(97,215,201,0.15)',
                    color: 'var(--accent)',
                  }}
                >
                  <Bot size={20} />
                </span>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px', letterSpacing: '-0.02em' }}>
                    NEXUS Intelligence OS
                  </h2>
                  <p style={{ margin: 0, color: 'var(--muted)', fontSize: '12px' }}>
                    Version 2.5.0 · Neural Search & Multi-Provider Architecture
                  </p>
                </div>
              </div>

              <p style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.6, margin: '14px 0' }}>
                NEXUS provides unified intelligence, meteorological science, NASA astrophysics data, and real-time news retrieval. All AI providers share a centralized tool context layer supporting DeepSeek, OpenRouter, Google Gemini, Groq, and custom API endpoints with multi-key failover and rotation.
              </p>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                  borderTop: '1px solid var(--line)',
                  paddingTop: '16px',
                  marginTop: '16px',
                  fontSize: '12px',
                }}
              >
                <div>
                  <span style={{ color: 'var(--muted)' }}>Neural Core:</span>
                  <div style={{ fontWeight: 600, color: '#fff' }}>Multi-Provider Engine</div>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Key Redundancy:</span>
                  <div style={{ fontWeight: 600, color: '#34d399' }}>Automatic Failover / Round Robin</div>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Shared Tools:</span>
                  <div style={{ fontWeight: 600, color: '#93c5fd' }}>Web · Wiki · Weather · Space · News</div>
                </div>
                <div>
                  <span style={{ color: 'var(--muted)' }}>Environment:</span>
                  <div style={{ fontWeight: 600, color: '#fff' }}>TypeScript · Express · Vite</div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function SettingRow({ label, description, value, options, onChange }: { label: string; description: string; value: string; options: string[]; onChange: (value: string) => void }) { return <section className="setting-row"><div><h2>{label}</h2><p>{description}</p></div><div className="segmented-control">{options.map((option) => <button className={option === value ? 'selected' : ''} onClick={() => onChange(option)} key={option}>{option}</button>)}</div></section>; }

export { TelegramPage } from './TelegramPage';
export { DevicesPage } from './DevicesPage';

