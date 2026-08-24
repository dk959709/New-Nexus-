import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  ChevronUp,
  ExternalLink,
  Globe,
  Loader2,
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
  Maximize2,
  Rocket,
  Moon as MoonIcon,
} from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { SearchBox, WeatherCard, HourlyForecast, DailyForecast, ErrorMessage, LoadingMessage, WeatherMap, AnswerCard, MediaViewer, UnifiedResultCard } from '@/components';
import { WallpaperSelector } from '@/components/WallpaperSelector';
import { SpaceStarfield } from '@/components/SpaceStarfield';
import { MeteorShower } from '@/animations/MeteorShower';
import { AIProvidersSettings } from '@/components/AIProvidersSettings';
import { api, BASE } from '@/services/api';
import { executeSmarterMediaSearch, appendUnifiedSearchOutput, type UnifiedSearchOutput } from '@/services/unifiedSearch';
import { getLocation } from '@/services/location';
import { storage } from '@/lib/storage';
import { useSettings } from '@/hooks/useSettings';
import { playTapSound } from '@/lib/audio';
import { askSmartAnswerEngine } from '@/services/answerEngine';
import type { SearchResult, WeatherData, Settings, AnswerEngineResult, UnifiedSearchResult } from '@/types';


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
      <div className="space-content-wrapper relative">
        {/* Floating colorful ambient live aurora background orbs */}
        <div className="absolute top-10 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />
        <div className="absolute top-40 right-10 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '7s' }} />

        <div className="hero-wrap relative z-10">
          <div className="hero-aurora-glow" aria-hidden="true" />
          <section className="hero">
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span className="eyebrow">NEXUS INTELLIGENT</span>
            </div>
            <h1>
              <span className="hero-gradient-line">Search the web.</span>
              <br />
              <span className="hero-gradient-line hero-glow-text">Understand the world.</span>
            </h1>
            <p className="text-slate-300 font-medium sm:text-base">A unified view of live search, weather, and world signals — clear, fast, and precise.</p>
          </section>
        </div>
        <div className="relative z-10">
          <SearchBox onSearch={search} recent={storage.getSearches()} />
        </div>

        {/* Smart Answer Engine Section */}
        <section
          className="nexus-ai-card relative z-10 overflow-hidden"
          aria-label="NEXUS Smart Answer Engine"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-500/15 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="nexus-ai-label flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-md shadow-cyan-500/20">
                <Sparkles size={18} className="ai-sparkle-active" />
              </div>
              <span className="font-bold text-sm tracking-wider text-white">NEXUS Smart Answer Engine</span>
            </div>
            <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-mono text-cyan-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              Multi-Source Intelligence
            </span>
          </div>

          <div className="nexus-ai-form">
            <div className="nexus-ai-input-wrap shadow-xl">
              <Sparkles size={20} className="ai-sparkle-active text-cyan-400" />

              <input
                value={aiQuery}
                onChange={(event) => setAiQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') askNexusAI();
                }}
                placeholder="Ask NEXUS anything (e.g. What is a black hole? Explain gravity)..."
                aria-label="Ask NEXUS AI anything"
                className="nexus-ai-input placeholder:text-slate-500"
              />
            </div>

            <button
              type="button"
              onClick={() => askNexusAI()}
              disabled={!aiQuery.trim() || aiLoading}
              aria-label="Ask NEXUS AI"
              className="nexus-ai-submit group relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 via-sky-400 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <Send size={18} className="relative z-10" />
            </button>
          </div>

          {/* Quick Suggestions Chips */}
          {!smartResult && !aiLoading && (
            <div className="mt-4 pt-4 border-t border-white/10 flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <span className="text-xs font-mono text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={12} /> Try asking:
              </span>
              <div className="flex flex-wrap gap-2">
                {SMART_SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    className="px-3.5 py-1.5 rounded-xl bg-white/[0.04] hover:bg-cyan-500/15 border border-white/10 hover:border-cyan-500/40 text-xs text-slate-300 hover:text-white transition-all flex items-center gap-1.5 shadow-sm group"
                    onClick={() => askNexusAI(suggestion)}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 group-hover:bg-cyan-400 transition-colors" />
                    <span>{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {aiLoading && (
            <div className="nexus-ai-loading mt-4 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 flex items-center gap-3">
              <Sparkles size={18} className="ai-sparkle-active animate-spin text-cyan-400" />
              <span className="text-xs sm:text-sm font-medium">NEXUS Engine is retrieving and synthesizing verified sources...</span>
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
              className="mt-4 animate-in fade-in duration-300"
            />
          )}
        </section>

        {weather ? (
          <div className="home-dashboard relative z-10">
            <div className="home-main space-y-6">
              <WeatherCard
                data={weather.current}
                temperatureUnit={settings.temperature}
                windUnit={settings.wind}
                reduced={settings.animations === 'reduced'}
              />
              <HourlyForecast entries={weather.hourly} unit={settings.temperature} />
            </div>
            <aside className="brief-card relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-all pointer-events-none" />
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span className="eyebrow">LIVE SIGNALS</span>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">World briefing</h2>
              <p className="text-slate-300 text-xs sm:text-sm mb-4 leading-relaxed">Search the current web or open the live news desk for your next signal.</p>
              <Link
                to="/news"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-semibold text-xs transition-all shadow-md group-hover:translate-x-1"
              >
                Explore live news <ArrowUpRight size={15} />
              </Link>
            </aside>
          </div>
        ) : (
          <div className="location-prompt relative z-10 p-8 rounded-2xl bg-slate-900/80 border border-cyan-500/20 backdrop-blur-xl text-center shadow-2xl">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 mb-4 shadow-lg shadow-cyan-500/20 animate-pulse">
              <Navigation size={28} />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Weather intelligence is waiting</h2>
            <p className="text-slate-300 text-xs sm:text-sm max-w-md mx-auto mb-6">Allow location access to see local conditions, or search for a city manually.</p>
            <Link
              to="/weather"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-sky-500 text-slate-950 font-bold text-xs shadow-lg hover:brightness-110 transition-all"
            >
              Open weather workspace <ArrowUpRight size={16} />
            </Link>
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
  const [activeTab, setActiveTab] = useState<'all' | 'videos' | 'images' | 'wikipedia' | 'web'>('all');
  const [searchOutput, setSearchOutput] = useState<UnifiedSearchOutput | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<UnifiedSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(storage.getSaved());

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Synthesis on Search Page
  const [synthesizedResult, setSynthesizedResult] = useState<AnswerEngineResult | null>(null);
  const [synthesizing, setSynthesizing] = useState(false);
  const [synthesisError, setSynthesisError] = useState('');

  const search = (value: string) => {
    storage.saveSearch(value);
    setSynthesizedResult(null);
    setPage(1);
    setHasMore(true);
    navigate(`/search?q=${encodeURIComponent(value)}`);
  };

  useEffect(() => {
    if (!query) {
      setSearchOutput(null);
      setSynthesizedResult(null);
      setPage(1);
      setHasMore(true);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setLoadingMore(false);
    setPage(1);
    setHasMore(true);
    setError('');
    setSynthesizedResult(null);

    const runSearch = async () => {
      try {
        const output = await executeSmarterMediaSearch(query, 1);
        if (!isMounted) return;
        setSearchOutput(output);
        setHasMore(output.results.length > 0);
      } catch (err) {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : 'Failed to execute unified media search.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    runSearch();

    return () => {
      isMounted = false;
    };
  }, [query]);

  const currentTabResults: UnifiedSearchResult[] = searchOutput
    ? searchOutput.tabResults[activeTab] || []
    : [];

  const handleLoadMore = useCallback(async () => {
    if (!query || loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const moreOutput = await executeSmarterMediaSearch(query, nextPage);
      if (!moreOutput || moreOutput.results.length === 0) {
        setHasMore(false);
      } else {
        setSearchOutput((prev) => (prev ? appendUnifiedSearchOutput(prev, moreOutput) : moreOutput));
        setPage(nextPage);
        // If results returned were very few, we may be near the end
        if (moreOutput.results.length < 3) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.warn('Failed to load more results:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [query, loading, loadingMore, hasMore, page]);

  // Infinite scroll trigger with IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || loading || loadingMore || !hasMore || currentTabResults.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { rootMargin: '350px' },
    );

    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [handleLoadMore, loading, loadingMore, hasMore, currentTabResults.length]);

  // Track window scroll position for floating back-to-top button
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 400);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSynthesizeResults = async () => {
    if (!query || currentTabResults.length === 0 || synthesizing) return;
    playTapSound();
    setSynthesizing(true);
    setSynthesisError('');

    try {
      const searchResultsForAI: SearchResult[] = currentTabResults.slice(0, 8).map((r) => ({
        title: r.title,
        url: r.url,
        domain: r.domain,
        description: r.description,
        type: 'web',
      }));

      const response = await askSmartAnswerEngine(query, searchResultsForAI);
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

  const toggleSave = (result: UnifiedSearchResult) => {
    const updated = storage.toggleSaved({
      id: result.url,
      type: result.type === 'video' ? 'search' : 'search',
      title: result.title,
      subtitle: result.domain,
      url: result.url,
      savedAt: new Date().toISOString(),
    });
    setSaved(updated);
  };

  const counts = {
    all: searchOutput?.tabResults.all.length || 0,
    videos: searchOutput?.tabResults.videos.length || 0,
    images: searchOutput?.tabResults.images.length || 0,
    wikipedia: searchOutput?.tabResults.wikipedia.length || 0,
    web: searchOutput?.tabResults.web.length || 0,
  };

  const intent = searchOutput?.intent;

  return (
    <>
      <PageIntro
        eyebrow="SMARTER MEDIA SEARCH"
        title="Find the signal."
        description="Intelligently classified and unified results from YouTube, Wikimedia Commons, Wikipedia, and the open web."
      />
      <SearchBox onSearch={search} recent={storage.getSearches()} />

      {/* 5 Tab Navigation: All Sources, Videos, Images, Wikipedia, Web */}
      <div className="search-filter-tabs-wrap">
        <div className="search-filter-tabs">
          <button
            type="button"
            className={`search-filter-tab ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => {
              playTapSound();
              setActiveTab('all');
            }}
          >
            <Sparkles size={14} />
            <span>All Sources</span>
            {counts.all > 0 && <span className="tab-count-badge">{counts.all}</span>}
          </button>

          <button
            type="button"
            className={`search-filter-tab ${activeTab === 'videos' ? 'active' : ''}`}
            onClick={() => {
              playTapSound();
              setActiveTab('videos');
            }}
          >
            <Film size={14} />
            <span>🎬 Videos</span>
            {counts.videos > 0 && <span className="tab-count-badge">{counts.videos}</span>}
          </button>

          <button
            type="button"
            className={`search-filter-tab ${activeTab === 'images' ? 'active' : ''}`}
            onClick={() => {
              playTapSound();
              setActiveTab('images');
            }}
          >
            <ImageIcon size={14} />
            <span>🖼️ Images</span>
            {counts.images > 0 && <span className="tab-count-badge">{counts.images}</span>}
          </button>

          <button
            type="button"
            className={`search-filter-tab ${activeTab === 'wikipedia' ? 'active' : ''}`}
            onClick={() => {
              playTapSound();
              setActiveTab('wikipedia');
            }}
          >
            <BookOpen size={14} />
            <span>📚 Wikipedia</span>
            {counts.wikipedia > 0 && <span className="tab-count-badge">{counts.wikipedia}</span>}
          </button>

          <button
            type="button"
            className={`search-filter-tab ${activeTab === 'web' ? 'active' : ''}`}
            onClick={() => {
              playTapSound();
              setActiveTab('web');
            }}
          >
            <Globe size={14} />
            <span>🌐 Web</span>
            {counts.web > 0 && <span className="tab-count-badge">{counts.web}</span>}
          </button>
        </div>
      </div>

      {/* Query Intent & Search Stats Bar */}
      {!loading && searchOutput && currentTabResults.length > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 mb-4 px-4 py-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs text-slate-300 w-full max-w-[920px]">
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles size={14} className="text-cyan-400 shrink-0" />
            <span>
              {intent?.isVideo && activeTab === 'all'
                ? '🎬 Video intent detected · Prioritizing YouTube & Wikimedia video streams'
                : intent?.isImage && activeTab === 'all'
                ? '🖼️ Visual intent detected · Prioritizing high-resolution imagery'
                : intent?.isKnowledge && activeTab === 'all'
                ? '📚 Knowledge intent detected · Prioritizing encyclopedic articles'
                : `Showing ${currentTabResults.length} ${activeTab === 'all' ? 'unified' : activeTab} result${currentTabResults.length === 1 ? '' : 's'}${page > 1 ? ` · Page ${page}` : ''}`}
            </span>
          </div>
          <span className="text-slate-400 font-mono text-[11px] shrink-0 self-end sm:self-auto">
            {searchOutput.stats.sourcesQueried?.length || 4} sources · {searchOutput.stats.durationMs || 0}ms
          </span>
        </div>
      )}

      {loading && (
        <LoadingMessage
          label={
            activeTab === 'videos'
              ? 'Searching YouTube and Wikimedia Commons video streams...'
              : activeTab === 'images'
              ? 'Searching Wikimedia Commons and image sources...'
              : activeTab === 'wikipedia'
              ? 'Searching Wikipedia knowledge base...'
              : activeTab === 'web'
              ? 'Searching live web index...'
              : 'Searching YouTube, Wikimedia, Wikipedia, and the Web simultaneously...'
          }
        />
      )}

      {error && (
        <ErrorMessage
          message={
            error.includes('not configured')
              ? 'Search is not configured yet. Add SEARCH_API_KEY and SEARCH_API_URL to the server environment, or use Wikipedia and Media tabs.'
              : error
          }
        />
      )}

      {/* "Synthesize with NEXUS AI" Action Banner */}
      {!loading && currentTabResults.length > 0 && (
        <div className="nexus-synthesize-banner w-full max-w-[920px]">
          <div className="synthesize-banner-content">
            <div className="synthesize-banner-info">
              <Sparkles size={16} className="text-cyan-400 animate-pulse shrink-0" />
              <div>
                <h4>Synthesize with NEXUS AI</h4>
                <p>Generate a concise, cited synthesis from these {currentTabResults.length} {activeTab} results.</p>
              </div>
            </div>
            <button
              type="button"
              className="synthesize-action-btn shrink-0"
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
        <div className="nexus-ai-error mb-4 w-full max-w-[920px]">
          {synthesisError}
        </div>
      )}

      {synthesizedResult && (
        <div className="mb-6 w-full max-w-[920px]">
          <AnswerCard
            result={synthesizedResult}
            onSelectFollowUp={(q) => search(q)}
          />
        </div>
      )}

      {!loading && query && !error && currentTabResults.length === 0 && (
        <div className="empty-state p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center max-w-[920px] mx-auto my-10">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 flex items-center justify-center mx-auto mb-3">
            {activeTab === 'videos' ? (
              <Film size={24} />
            ) : activeTab === 'images' ? (
              <ImageIcon size={24} />
            ) : activeTab === 'wikipedia' ? (
              <BookOpen size={24} />
            ) : (
              <Search size={24} />
            )}
          </div>
          <h2 className="text-lg font-bold text-slate-100 mb-1">No results found in {activeTab === 'all' ? 'All Sources' : activeTab}</h2>
          <p className="text-sm text-slate-400 max-w-md mx-auto mb-4">
            We couldn't find matching results for &ldquo;{query}&rdquo; under this category.
          </p>
          {activeTab !== 'all' && (
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 font-semibold text-xs transition-all shadow"
            >
              <Sparkles size={14} /> Switch to All Sources
            </button>
          )}
        </div>
      )}

      {/* Specific Gallery Grid for Image Tab */}
      {!loading && activeTab === 'images' && currentTabResults.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8 w-full max-w-[920px]">
          {currentTabResults.map((result) => (
            <div
              key={result.id}
              className="group relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800/80 hover:border-cyan-500/50 transition-all cursor-pointer aspect-square shadow-md"
              onClick={() => setSelectedMedia(result)}
            >
              <img
                src={result.thumbnail || result.playableUrl || result.url}
                alt={result.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                referrerPolicy="no-referrer"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).src =
                    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-3">
                <p className="text-xs font-semibold text-slate-100 line-clamp-2">{result.title}</p>
                <div className="flex items-center justify-between mt-1.5 text-[11px] text-cyan-300">
                  <span className="font-mono">{result.source === 'wikimedia' ? 'Wikimedia' : result.domain}</span>
                  <ExternalLink size={12} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Specific Grid for Videos Tab */}
      {!loading && activeTab === 'videos' && currentTabResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 w-full max-w-[920px]">
          {currentTabResults.map((result) => (
            <UnifiedResultCard
              key={result.id}
              result={result}
              saved={saved.some((item) => item.id === result.url)}
              onSave={() => toggleSave(result)}
              onPlayMedia={(r) => setSelectedMedia(r)}
              onViewImage={(r) => setSelectedMedia(r)}
            />
          ))}
        </div>
      )}

      {/* Unified List View for All, Wikipedia, and Web Tabs */}
      {!loading && (activeTab === 'all' || activeTab === 'wikipedia' || activeTab === 'web') && currentTabResults.length > 0 && (
        <div className="results-list">
          {currentTabResults.map((result) => (
            <UnifiedResultCard
              key={result.id}
              result={result}
              saved={saved.some((item) => item.id === result.url)}
              onSave={() => toggleSave(result)}
              onPlayMedia={(r) => setSelectedMedia(r)}
              onViewImage={(r) => setSelectedMedia(r)}
            />
          ))}
        </div>
      )}

      {/* Infinite Scroll Sentinel & Load More Controls */}
      {!loading && currentTabResults.length > 0 && (
        <div className="w-full max-w-[920px] mx-auto my-8 flex flex-col items-center justify-center gap-3">
          {/* Invisible trigger for intersection observer */}
          <div ref={sentinelRef} className="h-6 w-full pointer-events-none" />

          {loadingMore && (
            <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-slate-900/80 border border-cyan-500/30 text-cyan-300 shadow-xl backdrop-blur-md animate-pulse">
              <Loader2 size={18} className="animate-spin text-cyan-400" />
              <span className="text-xs font-semibold tracking-wide">Loading more results for &ldquo;{query}&rdquo;...</span>
            </div>
          )}

          {!loadingMore && hasMore && (
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={handleLoadMore}
                className="group flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 hover:from-cyan-950 hover:via-slate-800 hover:to-cyan-950 border border-slate-700 hover:border-cyan-500/50 text-slate-200 hover:text-white font-semibold text-xs transition-all shadow-lg hover:shadow-cyan-500/10 active:scale-95"
              >
                <Sparkles size={15} className="text-cyan-400 group-hover:rotate-12 transition-transform" />
                <span>Load More Results (Page {page + 1})</span>
                <ArrowDown size={14} className="text-slate-400 group-hover:translate-y-0.5 transition-transform" />
              </button>
              <span className="text-[11px] text-slate-400 font-mono">
                Showing {currentTabResults.length} {activeTab === 'all' ? 'unified' : activeTab} results · Scroll down or click to load more
              </span>
            </div>
          )}

          {!loadingMore && !hasMore && currentTabResults.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900/40 border border-slate-800/60 text-slate-400 text-xs font-medium">
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span>You have reached the end of results ({currentTabResults.length} total items)</span>
            </div>
          )}
        </div>
      )}

      {/* Floating "Scroll to Top" Button */}
      {showBackToTop && (
        <button
          type="button"
          onClick={scrollToTop}
          aria-label="Scroll back to top"
          className="fixed bottom-6 right-6 z-40 p-3 rounded-2xl bg-slate-900/90 hover:bg-cyan-500 text-slate-300 hover:text-slate-950 border border-slate-700 hover:border-cyan-400 shadow-2xl backdrop-blur-xl transition-all duration-300 hover:scale-110 active:scale-95 group"
        >
          <ChevronUp size={20} className="group-hover:-translate-y-0.5 transition-transform" />
        </button>
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
  const [activeTab, setActiveTab] = useState<'apod' | 'iss' | 'moon' | 'planets'>('apod');
  const [apod, setApod] = useState<{ title: string; explanation: string; url: string; hdurl?: string; date: string; media_type: string; copyright?: string } | null>(null);
  const [moon, setMoon] = useState<{ phaseName: string; illumination: number; ageDays: number } | null>(null);
  const [iss, setIss] = useState<{ latitude: number; longitude: number; timestamp: number } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [savedStatus, setSavedStatus] = useState(false);

  useEffect(() => {
    fetch(BASE + '/api/space/moon').then((res) => res.json()).then((json) => setMoon(json.data)).catch(() => {});
    fetch(BASE + '/api/space/iss').then((res) => res.json()).then((json) => setIss(json.data)).catch(() => {});
    fetch(BASE + '/api/nasa/apod').then(async (res) => {
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'NASA data is temporarily unavailable.');
      setApod(body.data);
    }).catch((err: Error) => setError(err.message)).finally(() => setLoading(false));
  }, []);

  const planets = [
    { name: 'Mercury', type: 'Terrestrial', distance: '57.9M km', radius: '2,439 km', temp: '167°C', moons: 0, color: 'from-amber-600 to-slate-700', desc: 'The smallest and innermost planet in the Solar System.' },
    { name: 'Venus', type: 'Terrestrial', distance: '108.2M km', radius: '6,051 km', temp: '464°C', moons: 0, color: 'from-yellow-500 to-amber-700', desc: 'Hottest planet with a thick carbon dioxide atmosphere.' },
    { name: 'Earth', type: 'Terrestrial', distance: '149.6M km', radius: '6,371 km', temp: '15°C', moons: 1, color: 'from-blue-500 to-cyan-700', desc: 'Our home planet, the only world known to harbor life.' },
    { name: 'Mars', type: 'Terrestrial', distance: '227.9M km', radius: '3,389 km', temp: '-65°C', moons: 2, color: 'from-red-600 to-orange-800', desc: 'The dusty, cold, desert world with a very thin atmosphere.' },
    { name: 'Jupiter', type: 'Gas Giant', distance: '778.5M km', radius: '69,911 km', temp: '-110°C', moons: 95, color: 'from-orange-400 to-amber-900', desc: 'The largest planet, featuring the iconic Great Red Spot.' },
    { name: 'Saturn', type: 'Gas Giant', distance: '1.43B km', radius: '58,232 km', temp: '-140°C', moons: 146, color: 'from-yellow-200 to-amber-600', desc: 'Adorned with a dazzling, complex system of icy rings.' },
    { name: 'Uranus', type: 'Ice Giant', distance: '2.87B km', radius: '25,362 km', temp: '-195°C', moons: 28, color: 'from-cyan-400 to-blue-800', desc: 'An ice giant with a unique sideways tilt on its axis.' },
    { name: 'Neptune', type: 'Ice Giant', distance: '4.50B km', radius: '24,622 km', temp: '-200°C', moons: 16, color: 'from-blue-600 to-indigo-950', desc: 'Dark, cold, and whipped by supersonic winds.' },
  ];

  const handleSaveApod = () => {
    if (!apod) return;
    playTapSound();
    storage.saveItem({
      id: `apod_${apod.date}`,
      title: apod.title,
      subtitle: `NASA APOD · ${apod.date}`,
      url: apod.hdurl || apod.url,
      type: 'space',
    });
    setSavedStatus(true);
    setTimeout(() => setSavedStatus(false), 2500);
  };

  return (
    <>
      <SpaceStarfield />
      <MeteorShower reduced={settings.animations === 'reduced'} />
      <div className="space-content-wrapper max-w-6xl mx-auto px-4 py-8 relative z-10">
        <PageIntro eyebrow="COSMIC OBSERVATORY" title="Deep Space & NASA Explorer" description="Real-time orbital tracking, astronomical imagery, and solar system telemetry." />
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-white/10 pb-4">
          <button
            onClick={() => { playTapSound(); setActiveTab('apod'); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'apod' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10' : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'}`}
          >
            <Sparkles size={16} /> NASA APOD
          </button>
          <button
            onClick={() => { playTapSound(); setActiveTab('iss'); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'iss' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10' : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'}`}
          >
            <Rocket size={16} /> Live ISS Tracker
          </button>
          <button
            onClick={() => { playTapSound(); setActiveTab('moon'); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'moon' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10' : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'}`}
          >
            <MoonIcon size={16} /> Lunar Phase
          </button>
          <button
            onClick={() => { playTapSound(); setActiveTab('planets'); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${activeTab === 'planets' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-lg shadow-cyan-500/10' : 'bg-white/[0.03] text-slate-400 hover:text-white border border-white/5'}`}
          >
            <Globe size={16} /> Solar System
          </button>
        </div>

        {loading && <LoadingMessage label="Connecting to NASA telemetry & deep space feeds..." />}
        {error && <ErrorMessage message={error} />}

        {/* Tab 1: APOD */}
        {activeTab === 'apod' && apod && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="rounded-2xl bg-slate-900/80 border border-cyan-500/20 p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                  <span className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono uppercase tracking-wider mb-2">
                    Astronomy Picture of the Day · {apod.date}
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{apod.title}</h2>
                  {apod.copyright && <p className="text-xs text-slate-400 mt-1">Image Credit & Copyright: {apod.copyright}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveApod}
                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-medium text-white transition-all flex items-center gap-1.5"
                  >
                    <Bookmark size={14} className={savedStatus ? "text-cyan-400 fill-cyan-400" : ""} />
                    {savedStatus ? 'Saved to Library' : 'Save Image'}
                  </button>
                </div>
              </div>

              {apod.media_type === 'image' ? (
                <div className="relative group rounded-xl overflow-hidden border border-white/10 bg-black/40 my-6">
                  <img
                    src={apod.hdurl || apod.url}
                    alt={apod.title}
                    className="w-full max-h-[600px] object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                    <button
                      onClick={() => setZoomImage(apod.hdurl || apod.url)}
                      className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-semibold text-xs flex items-center gap-2 shadow-lg hover:bg-cyan-400 transition-colors"
                    >
                      <Maximize2 size={14} /> View High Definition
                    </button>
                  </div>
                </div>
              ) : (
                <div className="my-6 p-8 rounded-xl bg-black/40 border border-white/10 text-center">
                  <Film size={48} className="mx-auto text-cyan-400 mb-3" />
                  <p className="text-sm text-slate-300 mb-4">Today's featured NASA media is a video presentation.</p>
                  <a
                    href={apod.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 text-slate-950 font-semibold text-sm hover:bg-cyan-400 transition-all shadow-lg"
                  >
                    Watch NASA Video <ArrowUpRight size={16} />
                  </a>
                </div>
              )}

              <div className="prose prose-invert max-w-none">
                <h3 className="text-sm font-semibold text-cyan-300 uppercase tracking-wider mb-2">Scientific Context</h3>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed">{apod.explanation}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: ISS Tracker */}
        {activeTab === 'iss' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
            <div className="md:col-span-2 rounded-2xl bg-slate-900/80 border border-cyan-500/20 p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden flex flex-col justify-between">
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono uppercase tracking-wider mb-3">
                  Live Orbital Telemetry
                </span>
                <h3 className="text-2xl font-bold text-white mb-2">International Space Station</h3>
                <p className="text-slate-300 text-sm mb-6">Tracking humanity's orbital laboratory in real-time as it orbits Earth every 90 minutes at 27,600 km/h.</p>
              </div>

              <div className="p-6 rounded-xl bg-black/50 border border-white/10 relative overflow-hidden flex flex-col items-center justify-center min-h-[240px]">
                {/* Radar animation circle */}
                <div className="absolute w-48 h-48 rounded-full border border-cyan-500/20 animate-ping pointer-events-none" />
                <div className="absolute w-32 h-32 rounded-full border border-cyan-500/40 pointer-events-none" />
                <div className="w-16 h-16 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/30 mb-4 z-10 animate-pulse">
                  <Rocket className="text-cyan-300 transform rotate-45" size={28} />
                </div>
                {iss ? (
                  <div className="text-center z-10">
                    <p className="text-sm font-mono text-cyan-300">LAT: {iss.latitude.toFixed(4)}° · LON: {iss.longitude.toFixed(4)}°</p>
                    <p className="text-xs text-slate-400 mt-1">Altitude: ~420 km · Speed: 7.66 km/s</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">Acquiring orbital coordinates...</p>
                )}
              </div>
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl bg-slate-900/80 border border-cyan-500/20 p-6 backdrop-blur-xl shadow-2xl">
                <h4 className="text-sm font-semibold text-cyan-300 uppercase tracking-wider mb-4">Orbital Statistics</h4>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between pb-3 border-b border-white/5">
                    <span className="text-slate-400">Orbital Period</span>
                    <span className="font-mono text-white">92.90 minutes</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b border-white/5">
                    <span className="text-slate-400">Incline</span>
                    <span className="font-mono text-white">51.64°</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b border-white/5">
                    <span className="text-slate-400">Crew Onboard</span>
                    <span className="font-mono text-white">7 Astronauts</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Orbit Type</span>
                    <span className="font-mono text-white">Low Earth Orbit (LEO)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Moon Phase */}
        {activeTab === 'moon' && moon && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
            <div className="rounded-2xl bg-slate-900/80 border border-cyan-500/20 p-6 backdrop-blur-xl shadow-2xl flex flex-col items-center justify-center text-center">
              <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-slate-800 via-slate-600 to-slate-200 border-4 border-cyan-500/30 shadow-2xl shadow-cyan-500/20 flex items-center justify-center mb-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" style={{ clipPath: `polygon(${100 - moon.illumination}% 0%, 100% 0%, 100% 100%, ${100 - moon.illumination}% 100%)` }} />
                <MoonIcon size={48} className="text-cyan-200 z-10" />
              </div>
              <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 mb-1">Current Lunar Phase</span>
              <h3 className="text-2xl font-bold text-white mb-2">{moon.phaseName}</h3>
              <p className="text-slate-300 text-sm max-w-sm">The moon is currently {moon.illumination}% illuminated and is {moon.ageDays} days into its lunar cycle.</p>
            </div>

            <div className="rounded-2xl bg-slate-900/80 border border-cyan-500/20 p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between">
              <div>
                <h4 className="text-sm font-semibold text-cyan-300 uppercase tracking-wider mb-4">Lunar Metrics</h4>
                <div className="space-y-4 text-sm">
                  <div className="flex justify-between pb-3 border-b border-white/5">
                    <span className="text-slate-400">Illumination</span>
                    <span className="font-mono text-white">{moon.illumination}%</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b border-white/5">
                    <span className="text-slate-400">Lunar Age</span>
                    <span className="font-mono text-white">{moon.ageDays} / 29.5 days</span>
                  </div>
                  <div className="flex justify-between pb-3 border-b border-white/5">
                    <span className="text-slate-400">Distance from Earth</span>
                    <span className="font-mono text-white">~384,400 km</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tidal Impact</span>
                    <span className="font-mono text-cyan-400">Moderate Spring Tides</span>
                  </div>
                </div>
              </div>
              <div className="mt-6 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs text-cyan-200">
                ✨ Tip: Clear night skies provide optimal stargazing conditions during this lunar phase.
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Solar System */}
        {activeTab === 'planets' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in duration-300">
            {planets.map((planet) => (
              <div key={planet.name} className="rounded-2xl bg-slate-900/80 border border-white/10 p-5 backdrop-blur-xl shadow-xl hover:border-cyan-500/40 transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">{planet.type}</span>
                    <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${planet.color} shadow-md group-hover:scale-110 transition-transform`} />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-1">{planet.name}</h3>
                  <p className="text-xs text-slate-300 mb-4 leading-relaxed">{planet.desc}</p>
                </div>
                <div className="space-y-2 text-xs font-mono pt-3 border-t border-white/5 text-slate-400">
                  <div className="flex justify-between">
                    <span>Distance</span>
                    <span className="text-white">{planet.distance}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Radius</span>
                    <span className="text-white">{planet.radius}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Avg Temp</span>
                    <span className="text-white">{planet.temp}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Moons</span>
                    <span className="text-cyan-300">{planet.moons}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* High-Definition Image Modal */}
      {zoomImage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-5xl w-full max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setZoomImage(null)}
              className="absolute -top-12 right-0 px-4 py-2 rounded-xl bg-white/10 text-white font-semibold text-xs hover:bg-white/20 transition-colors"
            >
              ✕ Close HD View
            </button>
            <img src={zoomImage} alt="High Definition Space View" className="max-h-[82vh] rounded-2xl object-contain border border-white/20 shadow-2xl" />
          </div>
        </div>
      )}
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

