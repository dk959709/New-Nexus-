import { useCallback, useEffect, useId, useState } from 'react';
import {
  ArrowUpRight,
  Bookmark,
  Check,
  Clock,
  Compass,
  Flame,
  Globe,
  Info,
  Newspaper,
  RefreshCw,
  Search,
  Share2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ErrorMessage, LoadingMessage } from '@/components';
import { storage } from '@/lib/storage';
import { api } from '@/services/api';
import type { SearchResult } from '@/types';

function formatTimeAgo(dateInput?: string): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return dateInput;

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return 'Just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatFullDate(dateInput?: string): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  if (isNaN(date.getTime())) return dateInput;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function estimateReadingTime(text: string): string {
  if (!text) return '2 min read';
  const wordCount = text.trim().split(/\s+/).length;
  const minutes = Math.max(1, Math.ceil(wordCount / 50));
  return `${minutes} min read`;
}

function getCleanPublisher(item: SearchResult): string {
  if (item.domain && !item.domain.includes('.com') && !item.domain.includes('.org') && !item.domain.includes('.net') && !item.domain.includes('http')) {
    return item.domain;
  }
  if (item.domain) {
    const clean = item.domain.replace(/^www\./i, '').replace(/\.(com|org|net|co\.uk|io|edu|gov)$/i, '');
    if (clean.length > 0) {
      return clean.charAt(0).toUpperCase() + clean.slice(1);
    }
  }
  return 'News';
}

const CATEGORIES = [
  { id: 'general', label: 'Top Stories', icon: Flame },
  { id: 'world', label: 'World', icon: Globe },
  { id: 'technology', label: 'Tech', icon: Zap },
  { id: 'business', label: 'Business', icon: Compass },
  { id: 'science', label: 'Science', icon: Sparkles },
  { id: 'health', label: 'Health', icon: Info },
  { id: 'entertainment', label: 'Entertainment', icon: Newspaper },
  { id: 'sports', label: 'Sports', icon: Flame },
  { id: 'nation', label: 'Nation', icon: Globe },
];

export function NewsPage() {
  const [items, setItems] = useState<SearchResult[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('general');
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [savedUrls, setSavedUrls] = useState<Set<string>>(() => {
    const saved = storage.getSaved();
    return new Set(saved.map((s) => s.url || s.id));
  });

  const searchInputId = useId();

  const fetchNews = useCallback(async (cat: string, query?: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.news({
        category: cat,
        query: query && query.trim() ? query.trim() : undefined,
      });

      setItems(res.data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve news stream.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews(activeCategory, submittedQuery);
  }, [activeCategory, submittedQuery, fetchNews]);

  const handleCategorySelect = (catId: string) => {
    setActiveCategory(catId);
    setSearchQuery('');
    setSubmittedQuery('');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittedQuery(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSubmittedQuery('');
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleToggleBookmark = (item: SearchResult) => {
    const id = item.url;
    const isCurrentlySaved = savedUrls.has(id);

    if (isCurrentlySaved) {
      storage.removeSaved(id);
      setSavedUrls((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } else {
      storage.saveItem({
        id: item.url,
        type: 'news',
        title: item.title,
        subtitle: `${getCleanPublisher(item)} • ${formatTimeAgo(item.date)}`,
        url: item.url,
        content: item.description,
        savedAt: new Date().toISOString(),
      });
      setSavedUrls((prev) => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header & Title */}
      <div className="page-intro" id="news-page-intro" style={{ marginBottom: '20px' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <span className="eyebrow flex items-center gap-2">
              <span className="news-live-pulse" />
              LIVE BRIEFING STREAM
            </span>
            <h1 className="hero-gradient-line" style={{ margin: '8px 0 10px' }}>
              Global Headlines
            </h1>
            <p style={{ margin: 0, maxWidth: '680px' }}>
              Real-time global news feed, curated topics, and verified publisher intelligence delivered directly to your workstation.
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchNews(activeCategory, submittedQuery)}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[rgba(97,215,201,0.08)] hover:bg-[rgba(97,215,201,0.18)] border border-[rgba(97,215,201,0.3)] text-[var(--accent)] transition-all cursor-pointer disabled:opacity-50"
            title="Refresh latest news headlines"
            id="news-refresh-btn"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="news-category-pills" id="news-categories-bar">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id && !submittedQuery;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleCategorySelect(cat.id)}
              className={`news-cat-btn ${isActive ? 'active' : ''}`}
              id={`cat-btn-${cat.id}`}
            >
              <Icon size={14} className={isActive ? 'text-[#071016]' : 'text-[var(--accent)]'} />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Topic Search Bar */}
      <form onSubmit={handleSearchSubmit} className="news-search-bar" id="news-search-form">
        <Search size={16} className="text-[var(--accent)] shrink-0" />
        <label htmlFor={searchInputId} className="sr-only">Search breaking news topics</label>
        <input
          id={searchInputId}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search topics (e.g. Artificial Intelligence, SpaceX, Global Markets, Climate)..."
        />
        {searchQuery && (
          <button
            type="button"
            onClick={handleClearSearch}
            className="text-xs text-[var(--muted)] hover:text-white px-2 py-1"
          >
            Clear
          </button>
        )}
        <button
          type="submit"
          className="search-submit"
          style={{ padding: '8px 16px', borderRadius: '8px' }}
        >
          Search
        </button>
      </form>

      {/* Active Search Filter Chip */}
      {submittedQuery && (
        <div className="flex items-center justify-between gap-3 p-3 mb-6 rounded-xl bg-[rgba(97,215,201,0.08)] border border-[rgba(97,215,201,0.25)]">
          <div className="flex items-center gap-2 text-sm text-[var(--text)]">
            <Search size={15} className="text-[var(--accent)]" />
            Showing search results for: <strong className="text-white">"{submittedQuery}"</strong>
          </div>
          <button
            type="button"
            onClick={handleClearSearch}
            className="text-xs text-[var(--accent)] hover:underline font-semibold"
          >
            Reset to Top Stories
          </button>
        </div>
      )}

      {/* Loading Indicator */}
      {loading && items.length === 0 && (
        <LoadingMessage label="Retrieving live news stories..." />
      )}

      {/* Error Message */}
      {error && !loading && <ErrorMessage message={error} />}

      {/* Empty State */}
      {!loading && !error && items.length === 0 && (
        <div className="empty-state p-12 text-center rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
          <Newspaper size={48} className="text-[var(--accent)] mx-auto mb-4 opacity-70" />
          <h3 className="text-lg font-bold text-white mb-2">No news stories found</h3>
          <p className="text-sm text-[var(--muted)] max-w-md mx-auto mb-6">
            We couldn't find any articles matching your selected category or search query.
          </p>
          <button
            type="button"
            onClick={() => handleCategorySelect('general')}
            className="search-submit inline-flex items-center gap-2"
          >
            <Flame size={15} />
            View Top Stories
          </button>
        </div>
      )}

      {/* News Stream - Borderless clean layout */}
      {items.length > 0 && (
        <div className="news-grid" id="news-articles-grid">
          {items.map((item, idx) => {
            const cleanPub = getCleanPublisher(item);
            const isSaved = savedUrls.has(item.url);
            const isCopied = copiedUrl === item.url;

            return (
              <article className="news-card" key={item.url || idx} id={`news-card-${idx}`}>
                {/* Article Thumbnail */}
                <div className="news-thumb-wrap">
                  {item.image || item.thumbnail ? (
                    <img
                      src={item.image || item.thumbnail}
                      alt={item.title}
                      className="news-thumb"
                      loading="lazy"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="news-thumb-placeholder">
                      <Newspaper size={36} />
                    </div>
                  )}

                  {/* Floating Publisher Tag over Image */}
                  <div className="absolute top-3 left-3 z-10">
                    <span className="news-publisher-tag px-2.5 py-1 rounded-md bg-[rgba(7,16,22,0.85)] backdrop-blur-md border border-[rgba(255,255,255,0.1)] text-white shadow-md">
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${typeof item.domain === 'string' ? item.domain : 'news'}&sz=32`}
                        alt=""
                        className="news-source-favicon"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                      {cleanPub}
                    </span>
                  </div>

                  {/* Floating Time Ago Badge */}
                  <div className="absolute bottom-3 right-3 z-10">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[rgba(7,16,22,0.85)] backdrop-blur-md border border-[rgba(255,255,255,0.08)] text-[var(--muted)]">
                      {formatTimeAgo(item.date)}
                    </span>
                  </div>
                </div>

                {/* Article Body */}
                <div className="news-card-body">
                  <div className="news-meta-row">
                    <span className="news-source-info">
                      <span className="text-[var(--accent)] font-semibold text-xs">{cleanPub}</span>
                    </span>
                    {item.date && (
                      <span className="news-time-tag" title={formatFullDate(item.date)}>
                        <Clock size={11} className="text-[var(--accent)]" />
                        {formatTimeAgo(item.date)}
                      </span>
                    )}
                  </div>

                  <h2 className="line-clamp-2 hover:text-[var(--accent)] transition-colors">
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.title}
                    </a>
                  </h2>

                  <p className="line-clamp-3">{item.description}</p>

                  {/* Footer Actions */}
                  <div className="news-card-footer">
                    <span className="text-[11px] text-[var(--muted)] font-mono">
                      {estimateReadingTime(item.description)}
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleBookmark(item)}
                        className={`news-icon-btn ${isSaved ? 'saved' : ''}`}
                        title={isSaved ? 'Remove from bookmarks' : 'Save article'}
                      >
                        <Bookmark size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyLink(item.url)}
                        className="news-icon-btn"
                        title="Share / Copy link"
                      >
                        {isCopied ? <Check size={13} className="text-[var(--accent)]" /> : <Share2 size={13} />}
                      </button>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--accent)] hover:opacity-80 transition-opacity"
                      >
                        Read Story <ArrowUpRight size={14} />
                      </a>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
