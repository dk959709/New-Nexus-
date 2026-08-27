import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  BookOpen,
  ChevronUp,
  ExternalLink,
  Globe,
  Loader2,
  Search,
  Sparkles,
  CheckCircle2,
  Image as ImageIcon,
  Film,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SearchBox, ErrorMessage, LoadingMessage, AnswerCard, MediaViewer, UnifiedResultCard } from '@/components';
import { executeSmarterMediaSearch, appendUnifiedSearchOutput, type UnifiedSearchOutput } from '@/services/unifiedSearch';
import { storage } from '@/lib/storage';
import { playTapSound } from '@/lib/audio';
import { askSmartAnswerEngine } from '@/services/answerEngine';
import type { SearchResult, AnswerEngineResult, UnifiedSearchResult } from '@/types';

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

export function SearchPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const query = params.get('q') ?? '';
  const tabParam = params.get('tab');
  const [activeTab, setActiveTab] = useState<'all' | 'videos' | 'images' | 'wikipedia' | 'web'>(() => {
    if (tabParam === 'videos' || tabParam === 'images' || tabParam === 'wikipedia' || tabParam === 'web') {
      return tabParam;
    }
    return 'all';
  });

  useEffect(() => {
    const t = params.get('tab');
    if (t === 'videos' || t === 'images' || t === 'wikipedia' || t === 'web' || t === 'all') {
      setActiveTab(t);
    }
  }, [params]);
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
        domain: r.domain || '',
        description: r.description || '',
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
      subtitle: result.domain || '',
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

          {/* Bottom Search Bar on Results Page */}
          <div className="w-full max-w-[920px] mt-8 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between gap-2 mb-3">
              <span className="text-xs font-mono tracking-wider text-cyan-300 uppercase font-bold flex items-center gap-1.5">
                <Search size={13} className="text-cyan-400" />
                Search Another Query
              </span>
            </div>
            <SearchBox initialValue="" onSearch={search} recent={storage.getSearches()} />
          </div>
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
