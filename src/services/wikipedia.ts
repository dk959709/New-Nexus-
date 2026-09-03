import type { SearchResult, WikipediaArticle, WikipediaSearchResult } from '@/types';

const WIKIPEDIA_USER_AGENT = 'NEXUS-Intelligence/1.0 (https://nexus.app; contact: dk959709@gmail.com)';

// In-memory cache for fast responsive responses
const searchCache = new Map<string, { timestamp: number; results: WikipediaSearchResult[] }>();
const articleCache = new Map<string, { timestamp: number; article: WikipediaArticle }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Strip HTML tags (like <span class="searchmatch">) from Wikipedia search snippets
 */
function cleanSnippet(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#039;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Search Wikipedia articles using the official MediaWiki API
 */
export async function searchWikipedia(
  query: string,
  limit = 10,
  offset = 0,
): Promise<WikipediaSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `${trimmed.toLowerCase()}_${limit}_${offset}`;
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.results;
  }

  try {
    // 1. Search for matching articles with pagination support
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      trimmed,
    )}&srlimit=${limit}&sroffset=${offset}&utf8=&format=json&origin=*`;

    const res = await fetch(searchUrl, {
      headers: {
        'Api-User-Agent': WIKIPEDIA_USER_AGENT,
      },
    });

    if (!res.ok) {
      throw new Error(`Wikipedia search failed with status ${res.status}`);
    }

    const data = (await res.json()) as {
      query?: {
        search?: Array<{
          pageid: number;
          title: string;
          snippet: string;
          size?: number;
          wordcount?: number;
        }>;
      };
    };

    const searchItems = data.query?.search ?? [];
    if (searchItems.length === 0) {
      searchCache.set(cacheKey, { timestamp: Date.now(), results: [] });
      return [];
    }

    // 2. Fetch page images and descriptions in batch for the retrieved titles
    const pageIds = searchItems.map((item) => item.pageid).join('|');
    const detailsUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageIds}&prop=pageimages|description|info&inprop=url&pithumbsize=400&format=json&origin=*`;

    const detailsRes = await fetch(detailsUrl, {
      headers: {
        'Api-User-Agent': WIKIPEDIA_USER_AGENT,
      },
    }).catch(() => null);

    const detailsData = detailsRes?.ok
      ? ((await detailsRes.json()) as {
          query?: {
            pages?: Record<
              string,
              {
                pageid: number;
                title: string;
                description?: string;
                thumbnail?: { source: string; width: number; height: number };
                fullurl?: string;
                canonicalurl?: string;
              }
            >;
          };
        })
      : null;

    const pagesMap = detailsData?.query?.pages ?? {};

    const results: WikipediaSearchResult[] = searchItems.map((item) => {
      const pageDetail = pagesMap[String(item.pageid)];
      const cleaned = cleanSnippet(item.snippet);
      const url =
        pageDetail?.fullurl ||
        pageDetail?.canonicalurl ||
        `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;

      return {
        pageid: item.pageid,
        title: item.title,
        snippet: cleaned,
        description: pageDetail?.description || (cleaned ? `${cleaned.slice(0, 160)}...` : undefined),
        thumbnail: pageDetail?.thumbnail?.source,
        url,
      };
    });

    searchCache.set(cacheKey, { timestamp: Date.now(), results });
    return results;
  } catch (err) {
    console.error('[Wikipedia Service] Search error:', err);
    throw err;
  }
}

/**
 * Fetch a summary of a specific Wikipedia article (or top match for a query)
 */
export async function getWikipediaSummary(titleOrQuery: string): Promise<WikipediaArticle | null> {
  const trimmed = titleOrQuery.trim();
  if (!trimmed) return null;

  const cacheKey = trimmed.toLowerCase();
  const cached = articleCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.article;
  }

  try {
    // First try the REST v1 page summary endpoint directly with normalized title
    const encodedTitle = encodeURIComponent(trimmed.replace(/ /g, '_'));
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`;

    const res = await fetch(summaryUrl, {
      headers: {
        'Api-User-Agent': WIKIPEDIA_USER_AGENT,
      },
    });

    if (res.ok) {
      const data = (await res.json()) as {
        pageid?: number;
        title: string;
        extract?: string;
        description?: string;
        thumbnail?: { source: string };
        content_urls?: { desktop?: { page?: string } };
        type?: string;
      };

      // Disambiguation or missing extracts might not be ideal single answers
      if (data.extract && data.type !== 'disambiguation') {
        const article: WikipediaArticle = {
          pageid: data.pageid ?? 0,
          title: data.title,
          extract: data.extract,
          description: data.description,
          thumbnail: data.thumbnail?.source,
          url:
            data.content_urls?.desktop?.page ||
            `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title.replace(/ /g, '_'))}`,
        };

        articleCache.set(cacheKey, { timestamp: Date.now(), article });
        return article;
      }
    }

    // Fallback 1: Try MediaWiki prop=extracts for fuller article extract or if REST summary was missing/disambiguation
    const extractsUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages|description|info&inprop=url&exintro=true&explaintext=true&titles=${encodedTitle}&pithumbsize=400&format=json&origin=*`;
    const extractsRes = await fetch(extractsUrl, {
      headers: { 'Api-User-Agent': WIKIPEDIA_USER_AGENT },
    }).catch(() => null);

    if (extractsRes && extractsRes.ok) {
      const extData = (await extractsRes.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              pageid: number;
              title: string;
              extract?: string;
              description?: string;
              thumbnail?: { source: string };
              fullurl?: string;
              canonicalurl?: string;
            }
          >;
        };
      };
      const pages = extData.query?.pages;
      if (pages) {
        const firstKey = Object.keys(pages)[0];
        if (firstKey && firstKey !== '-1') {
          const p = pages[firstKey];
          if (p && p.extract && p.extract.trim().length > 0) {
            const article: WikipediaArticle = {
              pageid: p.pageid,
              title: p.title,
              extract: p.extract.trim(),
              description: p.description,
              thumbnail: p.thumbnail?.source,
              url:
                p.fullurl ||
                p.canonicalurl ||
                `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, '_'))}`,
            };
            articleCache.set(cacheKey, { timestamp: Date.now(), article });
            return article;
          }
        }
      }
    }

    // Fallback 2: search for top article then fetch its summary
    const searchResults = await searchWikipedia(trimmed, 1);
    if (searchResults.length > 0) {
      const top = searchResults[0];
      const topSummaryRes = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(top.title.replace(/ /g, '_'))}`,
        {
          headers: {
            'Api-User-Agent': WIKIPEDIA_USER_AGENT,
          },
        },
      );

      if (topSummaryRes.ok) {
        const topData = (await topSummaryRes.json()) as {
          pageid?: number;
          title: string;
          extract?: string;
          description?: string;
          thumbnail?: { source: string };
          content_urls?: { desktop?: { page?: string } };
        };

        const article: WikipediaArticle = {
          pageid: topData.pageid ?? top.pageid,
          title: topData.title || top.title,
          extract: topData.extract || top.snippet,
          description: topData.description || top.description,
          thumbnail: topData.thumbnail?.source || top.thumbnail,
          url: topData.content_urls?.desktop?.page || top.url,
        };

        articleCache.set(cacheKey, { timestamp: Date.now(), article });
        return article;
      }

      // If summary API failed, construct from search result
      const fallbackArticle: WikipediaArticle = {
        pageid: top.pageid,
        title: top.title,
        extract: top.snippet,
        description: top.description,
        thumbnail: top.thumbnail,
        url: top.url,
      };
      return fallbackArticle;
    }

    return null;
  } catch (err) {
    console.error('[Wikipedia Service] Get summary error:', err);
    return null;
  }
}

/**
 * Convert Wikipedia search result or article into the NEXUS unified SearchResult type
 */
export function wikipediaToSearchResult(
  item: WikipediaSearchResult | WikipediaArticle,
): SearchResult {
  const isArticle = 'extract' in item;
  const description = isArticle ? (item as WikipediaArticle).extract : (item as WikipediaSearchResult).snippet;

  return {
    title: item.title,
    url: item.url,
    domain: 'wikipedia.org',
    description: description || item.description || '',
    image: item.thumbnail,
    thumbnail: item.thumbnail,
    type: 'wikipedia',
  };
}

/**
 * Format Wikipedia response into the required report section format
 */
export function formatWikipediaForReport(article: WikipediaArticle | null): string {
  if (!article) {
    return `=== WIKIPEDIA ===\nno entry found`;
  }

  const lines: string[] = ['=== WIKIPEDIA ==='];
  lines.push(`Title: ${article.title}`);
  if (article.description) {
    lines.push(`Description: ${article.description}`);
  }
  if (article.extract) {
    lines.push(`Summary: ${article.extract}`);
  }
  lines.push(`URL: ${article.url}`);

  return lines.join('\n');
}

