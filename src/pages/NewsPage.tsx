import { useEffect, useState } from 'react';
import { ArrowUpRight, Newspaper } from 'lucide-react';
import { ErrorMessage, LoadingMessage } from '@/components';
import { api } from '@/services/api';
import type { SearchResult } from '@/types';

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>;
}

export function NewsPage() {
  const [items, setItems] = useState<SearchResult[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.news()
      .then(setItems)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

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
