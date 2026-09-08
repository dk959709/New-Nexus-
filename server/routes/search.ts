import { Router } from 'express';
import { z } from 'zod';
import { errorResponse, domainOf } from '../shared.js';

export const WIKIPEDIA_USER_AGENT = 'NEXUS-Intelligence/1.0 (https://nexus.app; contact: dk959709@gmail.com)';

export const searchSchema = z.object({
  query: z.string().trim().min(1).max(300),
  page: z.number().int().positive().optional(),
  category: z.enum(['ALL', 'NEWS', 'IMAGES', 'VIDEOS', 'SHOPPING', 'WIKIPEDIA']).optional(),
  region: z.string().optional(),
  language: z.string().optional(),
  max_results: z.number().int().min(1).max(30).optional(),
  maxResults: z.number().int().min(1).max(30).optional(),
});

export interface SearchResult {
  title: string;
  url: string;
  domain: string;
  description: string;
  date?: string;
  image?: string;
  thumbnail?: string;
  type: 'web' | 'news' | 'images' | 'videos' | 'shopping' | 'wikipedia' | 'wikidata';
  videoId?: string;
  channel?: string;
  duration?: string;
}

export interface YouTubeSearchVideo {
  id: string;
  videoId?: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  mediaUrl: string;
  sourceUrl: string;
  domain: string;
  type: 'video';
  duration?: string;
  views?: string;
  channel?: string;
  embedUrl?: string;
  source: 'YouTube' | 'Wikimedia Commons';
  license?: string;
}

const ytVideoCache = new Map<string, { timestamp: number; items: YouTubeSearchVideo[] }>();
const wikiVideoCache = new Map<string, { timestamp: number; items: YouTubeSearchVideo[] }>();
const YT_CACHE_TTL = 15 * 60 * 1000; // 15 mins

export async function fetchWikipediaSummary(query: string) {
  try {
    const trimmed = query.trim();
    if (!trimmed) return null;
    const encoded = encodeURIComponent(trimmed.replace(/ /g, '_'));
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`;
    const res = await fetch(url, {
      headers: { 'Api-User-Agent': WIKIPEDIA_USER_AGENT },
      signal: AbortSignal.timeout(3500),
    });
    if (res.ok) {
      const data = (await res.json()) as {
        title: string;
        extract?: string;
        description?: string;
        thumbnail?: { source: string };
        content_urls?: { desktop?: { page?: string } };
        type?: string;
      };
      if (data.extract && data.type !== 'disambiguation') {
        return {
          title: data.title,
          extract: data.extract,
          description: data.description,
          thumbnail: data.thumbnail?.source,
          url:
            data.content_urls?.desktop?.page ||
            `https://en.wikipedia.org/wiki/${encodeURIComponent(data.title.replace(/ /g, '_'))}`,
        };
      }
    }

    // Fallback: search for top matching article and retrieve summary
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(trimmed)}&srlimit=1&utf8=&format=json&origin=*`,
      {
        headers: { 'Api-User-Agent': WIKIPEDIA_USER_AGENT },
        signal: AbortSignal.timeout(3500),
      },
    );
    if (searchRes.ok) {
      const searchData = (await searchRes.json()) as {
        query?: { search?: Array<{ pageid: number; title: string; snippet: string }> };
      };
      const top = searchData.query?.search?.[0];
      if (top) {
        const topSummaryRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(top.title.replace(/ /g, '_'))}`,
          {
            headers: { 'Api-User-Agent': WIKIPEDIA_USER_AGENT },
            signal: AbortSignal.timeout(3500),
          },
        );
        if (topSummaryRes.ok) {
          const topData = (await topSummaryRes.json()) as {
            title: string;
            extract?: string;
            description?: string;
            thumbnail?: { source: string };
            content_urls?: { desktop?: { page?: string } };
          };
          return {
            title: topData.title || top.title,
            extract: topData.extract || top.snippet.replace(/<[^>]*>/g, ''),
            description: topData.description,
            thumbnail: topData.thumbnail?.source,
            url:
              topData.content_urls?.desktop?.page ||
              `https://en.wikipedia.org/wiki/${encodeURIComponent(top.title.replace(/ /g, '_'))}`,
          };
        }
      }
    }
    return null;
  } catch (err) {
    console.error('[Server Wikipedia] Summary fetch error:', err);
    return null;
  }
}

export async function fetchWikipediaSearch(query: string, limit = 10) {
  try {
    const trimmed = query.trim();
    if (!trimmed) return [];
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(trimmed)}&srlimit=${limit}&utf8=&format=json&origin=*`;
    const res = await fetch(searchUrl, {
      headers: { 'Api-User-Agent': WIKIPEDIA_USER_AGENT },
      signal: AbortSignal.timeout(3500),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      query?: { search?: Array<{ pageid: number; title: string; snippet: string }> };
    };
    const items = data.query?.search ?? [];
    if (!items.length) return [];

    const pageIds = items.map((i) => i.pageid).join('|');
    const detailsUrl = `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageIds}&prop=pageimages|description|info&inprop=url&pithumbsize=400&format=json&origin=*`;
    const detailsRes = await fetch(detailsUrl, {
      headers: { 'Api-User-Agent': WIKIPEDIA_USER_AGENT },
      signal: AbortSignal.timeout(3500),
    }).catch(() => null);

    const detailsData = detailsRes?.ok
      ? ((await detailsRes.json()) as {
          query?: {
            pages?: Record<
              string,
              {
                title: string;
                description?: string;
                thumbnail?: { source: string };
                fullurl?: string;
                canonicalurl?: string;
              }
            >;
          };
        })
      : null;
    const pagesMap = detailsData?.query?.pages ?? {};

    return items.map((item) => {
      const pageDetail = pagesMap[String(item.pageid)];
      const cleaned = item.snippet
        .replace(/<[^>]*>/g, '')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&#039;/g, "'")
        .trim();
      const url =
        pageDetail?.fullurl ||
        pageDetail?.canonicalurl ||
        `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title.replace(/ /g, '_'))}`;
      return {
        title: item.title,
        url,
        domain: 'wikipedia.org',
        description: pageDetail?.description || (cleaned ? `${cleaned.slice(0, 160)}...` : ''),
        thumbnail: pageDetail?.thumbnail?.source,
        image: pageDetail?.thumbnail?.source,
        type: 'wikipedia' as const,
      };
    });
  } catch (err) {
    console.error('[Server Wikipedia] Search error:', err);
    return [];
  }
}

export async function fetchWikimediaVideoResults(query: string, limit = 8, offset = 0): Promise<YouTubeSearchVideo[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `${trimmed.toLowerCase()}_lim${limit}_off${offset}`;
  const cached = wikiVideoCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < YT_CACHE_TTL) {
    return cached.items;
  }

  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      'filetype:video ' + trimmed,
    )}&gsrlimit=${limit}&gsroffset=${offset}&gsrnamespace=6&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=500&format=json&origin=*`;

    const res = await fetch(commonsUrl, {
      headers: {
        'User-Agent': 'NexusIntelligence/1.0 (contact: info@nexus.app)',
        'Api-User-Agent': 'NexusIntelligence/1.0 (contact: info@nexus.app)',
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              pageid: number;
              title: string;
              imageinfo?: Array<{
                url?: string;
                thumburl?: string;
                mime?: string;
                extmetadata?: {
                  ImageDescription?: { value?: string };
                  Artist?: { value?: string };
                  LicenseShortName?: { value?: string };
                };
              }>;
            }
          >;
        };
      };

      const pages = data.query?.pages ?? {};
      const items: YouTubeSearchVideo[] = [];

      for (const pageId of Object.keys(pages)) {
        const page = pages[pageId];
        const info = page.imageinfo?.[0];
        if (!info || !info.url) continue;

        const title = page.title.replace(/^File:/i, '').replace(/\.[^/.]+$/, '');
        const thumbUrl = info.thumburl || info.url;
        const mediaUrl = info.url;
        const extMeta = info.extmetadata;

        let rawDesc = extMeta?.ImageDescription?.value || '';
        rawDesc = rawDesc.replace(/<[^>]*>/g, '').trim();

        const author = extMeta?.Artist?.value ? extMeta.Artist.value.replace(/<[^>]*>/g, '').trim() : 'Wikipedia Contributor';
        const license = extMeta?.LicenseShortName?.value || 'Wikimedia Commons';

        items.push({
          id: `wiki_vid_${page.pageid}`,
          title,
          description: rawDesc || `Wikipedia educational video file: ${title}`,
          thumbnailUrl: thumbUrl,
          mediaUrl,
          sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
          domain: 'commons.wikimedia.org',
          type: 'video',
          duration: 'Wikipedia Video',
          channel: author,
          source: 'Wikimedia Commons',
          license,
        });
      }

      if (items.length > 0) {
        wikiVideoCache.set(cacheKey, { timestamp: Date.now(), items });
        return items;
      }
    }
  } catch {
    // Graceful fallback
  }

  return [];
}

export async function fetchYouTubeSearchResults(query: string, page = 1): Promise<YouTubeSearchVideo[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `${trimmed.toLowerCase()}_p${page}`;
  const cached = ytVideoCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < YT_CACHE_TTL) {
    return cached.items;
  }

  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(trimmed)}`;
    const res = await fetch(searchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': 'SOCS=CAESEwgDEgk2MTQ1MjQ4OTUaAmVuIAEaBgiA_LyaBg; CONSENT=PENDING+999; PREF=tz=UTC&hl=en',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(6000),
    });

    if (res.ok) {
      const html = await res.text();
      const match =
        html.match(/var ytInitialData = ({.+?});<\/script>/s) ||
        html.match(/ytInitialData\s*=\s*({.+?});/s);

      if (match) {
        const data = JSON.parse(match[1]);
        const contents =
          data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

        const items: YouTubeSearchVideo[] = [];
        const seenIds = new Set<string>();

        for (const section of contents) {
          const itemSection = section.itemSectionRenderer?.contents || [];
          for (const item of itemSection) {
            const v = item.videoRenderer;
            if (v && v.videoId && !seenIds.has(v.videoId)) {
              seenIds.add(v.videoId);
              const title =
                v.title?.runs?.map((r: { text?: string }) => r.text).join('') ||
                v.title?.simpleText ||
                'YouTube Video';
              const description =
                v.detailedMetadataSnippets?.[0]?.snippetText?.runs?.map((r: { text?: string }) => r.text).join('') ||
                v.descriptionSnippet?.runs?.map((r: { text?: string }) => r.text).join('') ||
                '';
              const channel =
                v.ownerText?.runs?.[0]?.text ||
                v.longBylineText?.runs?.[0]?.text ||
                'YouTube Creator';
              const duration = v.lengthText?.simpleText || 'Video';
              const views = v.viewCountText?.simpleText || v.shortViewCountText?.simpleText || '';
              const thumb =
                v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url ||
                `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`;

              items.push({
                id: `yt_${v.videoId}`,
                videoId: v.videoId,
                title,
                description,
                thumbnailUrl: thumb,
                mediaUrl: `https://www.youtube.com/embed/${v.videoId}`,
                sourceUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
                domain: 'youtube.com',
                type: 'video',
                duration,
                views,
                channel,
                embedUrl: `https://www.youtube.com/embed/${v.videoId}`,
                source: 'YouTube',
              });
            }
          }
        }

        if (items.length > 0) {
          const pagedItems = page === 1 ? items : items.slice((page - 1) * 8);
          const finalItems = pagedItems.length > 0 ? pagedItems : items;
          ytVideoCache.set(cacheKey, { timestamp: Date.now(), items: finalItems });
          return finalItems;
        }
      }
    }
  } catch {
    // Network or scraping transient fallback
  }

  return [];
}

export async function fetchExaSearch(query: string, requestedMax = 15): Promise<SearchResult[]> {
  const exaKey = (process.env.EXA_API_KEY || '').trim();
  if (!exaKey) return [];
  try {
    const numResults = Math.min(Math.max(requestedMax, 5), 25);
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': exaKey,
      },
      body: JSON.stringify({
        query,
        numResults,
        type: 'auto',
        contents: {
          text: { maxCharacters: 1000 },
          highlights: true,
        },
      }),
      signal: AbortSignal.timeout(7000),
    });

    if (!res.ok) {
      console.warn(`[Exa AI] Search API returned HTTP ${res.status}`);
      return [];
    }

    const data = (await res.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        publishedDate?: string;
        author?: string;
        image?: string;
        favicon?: string;
        text?: string;
        highlights?: string[];
      }>;
    };

    if (!Array.isArray(data.results)) return [];

    return data.results
      .map((item) => {
        const urlValue = String(item.url || '');
        const snippet =
          Array.isArray(item.highlights) && item.highlights.length > 0
            ? item.highlights.join(' ')
            : (item.text || item.title || '');

        return {
          title: String(item.title || 'Exa Search Result').trim(),
          url: urlValue,
          domain: domainOf(urlValue),
          description: String(snippet).trim().slice(0, 1000),
          date: item.publishedDate,
          image: item.image,
          type: 'web' as const,
        };
      })
      .filter((item) => item.title && item.url);
  } catch (err) {
    console.warn('[Exa AI Fallback Search Error]:', err);
    return [];
  }
}

export async function fetchDuckDuckGoSearch(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const results: SearchResult[] = [];
    const resultBlocks = html.split('class="result">').slice(1);
    for (const block of resultBlocks) {
      const titleMatch = block.match(/class="result__title"[^>]*>[\s\S]*?<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i) ||
                           block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/div>/i);
      const urlMatch = block.match(/class="result__url"[^>]*href="([^"]+)"/i) || block.match(/href="([^"]+)"/i);

      if (titleMatch || urlMatch) {
        let rawUrl = urlMatch ? urlMatch[1] : (titleMatch ? titleMatch[1] : '');
        if (rawUrl.includes('uddg=')) {
          try {
            const parsedUrl = new URL(rawUrl.startsWith('http') ? rawUrl : `https://duckduckgo.com${rawUrl}`);
            const uddg = parsedUrl.searchParams.get('uddg');
            if (uddg) rawUrl = decodeURIComponent(uddg);
          } catch {
            // ignore URL parse error
          }
        }
        const titleClean = titleMatch ? titleMatch[2].replace(/<[^>]+>/g, '').trim() : (rawUrl ? new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`).hostname : 'Result');
        const descClean = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, '').trim() : '';

        if (rawUrl && !rawUrl.startsWith('/')) {
          results.push({
            title: titleClean || 'DuckDuckGo Result',
            url: rawUrl,
            domain: domainOf(rawUrl),
            description: descClean || titleClean,
            type: 'web',
          });
        }
      }
      if (results.length >= 10) break;
    }
    return results;
  } catch (err) {
    console.warn('[DuckDuckGo Fallback Search Error]:', err);
    return [];
  }
}

export function isGeneralWorldNewsQuery(q?: string): boolean {
  if (!q || !q.trim()) return true;
  const lower = q.toLowerCase().trim();
  const normalized = lower.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const worldNewsPatterns = [
    /^latest world news$/,
    /^world news$/,
    /^top world news$/,
    /^top \d+ world news( today)?$/,
    /^top \d+ news( today)?$/,
    /^world news today$/,
    /^breaking world news$/,
    /^global news$/,
    /^international news$/,
    /^world news breaking headlines$/,
    /^today s top world news$/,
    /^top stories$/,
    /^top headlines$/,
    /^breaking news$/,
    /^latest news$/,
    /^news$/,
  ];
  if (worldNewsPatterns.some((pattern) => pattern.test(normalized))) {
    return true;
  }
  const isJustWorldOrTop = /^(what are the )?(top \d+ |latest |breaking )?(world|global|international) news( today| this week)?$/.test(normalized);
  return isJustWorldOrTop;
}

export function cleanNewsSearchTopic(q: string): string {
  return q
    .replace(/^(what are the|tell me the|give me the|find|search for|show me)\s+/i, '')
    .replace(/^top \d+\s+/i, '')
    .replace(/\b(today|yesterday|this week|latest)\b/gi, '')
    .replace(/\bnews\b/gi, '')
    .trim();
}

export async function fetchGoogleNewsRSS(query?: string, category?: string): Promise<SearchResult[]> {
  try {
    let rssUrl: string;
    const cat = category?.toUpperCase().trim();
    const knownTopics = ['WORLD', 'BUSINESS', 'TECHNOLOGY', 'SCIENCE', 'HEALTH', 'SPORTS', 'ENTERTAINMENT', 'NATION'];

    if (cat && knownTopics.includes(cat)) {
      rssUrl = `https://news.google.com/rss/headlines/section/topic/${cat}?hl=en-US&gl=US&ceid=US:en`;
    } else if (isGeneralWorldNewsQuery(query)) {
      rssUrl = `https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en`;
    } else {
      const rawQ = query?.trim() || 'world news breaking';
      const cleanTopic = cleanNewsSearchTopic(rawQ) || rawQ;
      const q = cleanTopic.includes('when:') ? cleanTopic : `${cleanTopic} when:7d`;
      rssUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
    }

    const res = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const results: SearchResult[] = [];
    const items = xml.split('<item>').slice(1);

    const cleanHtml = (str: string): string => {
      if (!str) return '';
      let cleaned = str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
      cleaned = cleaned.replace(/<[^>]+>/g, '');
      cleaned = cleaned
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'")
        .replace(/&nbsp;/g, ' ');
      return cleaned.trim();
    };

    for (const itemXml of items) {
      const titleMatch = itemXml.match(/<title>([\s\S]*?)<\/title>/i);
      const linkMatch = itemXml.match(/<link>([\s\S]*?)<\/link>/i);
      const pubDateMatch = itemXml.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
      const sourceMatch = itemXml.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
      const descMatch = itemXml.match(/<description>([\s\S]*?)<\/description>/i);

      if (titleMatch && linkMatch) {
        let title = cleanHtml(titleMatch[1]);
        const link = cleanHtml(linkMatch[1]);
        const date = pubDateMatch ? cleanHtml(pubDateMatch[1]) : undefined;
        const sourceName = sourceMatch ? cleanHtml(sourceMatch[1]) : '';
        const description = descMatch ? cleanHtml(descMatch[1]) : title;

        if (sourceName && !title.includes(sourceName)) {
          title = `${title} — ${sourceName}`;
        }

        if (title && link) {
          results.push({
            title,
            url: link,
            domain: domainOf(link) || sourceName || 'News',
            description: description || title,
            date,
            type: 'news',
          });
        }
      }
      if (results.length >= 50) break;
    }

    results.sort((a, b) => {
      const timeA = a.date ? new Date(a.date).getTime() : 0;
      const timeB = b.date ? new Date(b.date).getTime() : 0;
      const validA = isNaN(timeA) ? 0 : timeA;
      const validB = isNaN(timeB) ? 0 : timeB;
      return validB - validA;
    });

    return results.slice(0, 25);
  } catch (err) {
    console.warn('[Google News RSS Error]:', err);
    return [];
  }
}

export interface GNewsArticleItem {
  title: string;
  description: string;
  content?: string;
  url: string;
  image?: string;
  publishedAt: string;
  source: {
    name: string;
    url?: string;
  };
}

export interface GNewsResponse {
  totalArticles: number;
  articles: GNewsArticleItem[];
  errors?: string[] | string;
}

export interface FetchGNewsOptions {
  category?: string;
  query?: string;
  country?: string;
  lang?: string;
  max?: number;
}

export async function fetchGNewsArticles(options: FetchGNewsOptions = {}): Promise<{
  articles: SearchResult[];
  source: string;
  totalArticles: number;
  category: string;
}> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error('GNEWS_API_KEY is not configured in server environment');
  }

  const isWorld = isGeneralWorldNewsQuery(options.query) || options.category === 'world';
  const category = isWorld ? 'world' : options.category && options.category.trim() ? options.category.trim() : 'general';
  const lang = options.lang || 'en';
  const country = options.country || 'us';
  const max = Math.min(options.max || 10, 10);

  let url: string;
  if (isWorld || !options.query?.trim()) {
    url = `https://gnews.io/api/v4/top-headlines?category=${encodeURIComponent(category)}&lang=${lang}&country=${country}&max=${max}&apikey=${apiKey.trim()}`;
  } else {
    const cleanTopic = cleanNewsSearchTopic(options.query.trim()) || options.query.trim();
    url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(cleanTopic)}&lang=${lang}&country=${country}&max=${max}&apikey=${apiKey.trim()}`;
  }

  const res = await fetch(url, {
    headers: {
      'User-Agent': 'NEXUS-Intelligence/1.0',
    },
  });

  if (res.status === 401 || res.status === 403) {
    throw new Error('GNews API Key is invalid or unauthorized');
  }
  if (res.status === 429) {
    throw new Error('GNews API daily request limit reached (100 requests/day limit on free tier)');
  }
  if (!res.ok) {
    let errorDetail = `GNews API returned HTTP ${res.status}`;
    try {
      const errJson = (await res.json()) as { errors?: string[] | string };
      if (errJson.errors) {
        errorDetail += `: ${Array.isArray(errJson.errors) ? errJson.errors.join(', ') : errJson.errors}`;
      }
    } catch {
      // ignore
    }
    throw new Error(errorDetail);
  }

  const data = (await res.json()) as GNewsResponse;
  const rawArticles = data.articles || [];

  const articles: SearchResult[] = rawArticles.map((art) => {
    const rawPublisher = art.source?.name?.trim() || '';
    const domain = rawPublisher || domainOf(art.url) || 'News';
    return {
      title: art.title || 'Untitled Headline',
      url: art.url,
      domain,
      description: art.description || art.content || art.title || '',
      date: art.publishedAt || undefined,
      image: art.image || undefined,
      thumbnail: art.image || undefined,
      type: 'news' as const,
    };
  });

  return {
    articles,
    source: 'GNews API',
    totalArticles: data.totalArticles || articles.length,
    category,
  };
}

export async function searchProvider(input: z.infer<typeof searchSchema>): Promise<{
  results: SearchResult[];
  searchSource: string;
  fallbackOccurred?: boolean;
  fallbackReason?: string;
}> {
  if (input.category === 'WIKIPEDIA') {
    const wiki = await fetchWikipediaSearch(input.query, 20);
    return { results: wiki, searchSource: 'Wikipedia' };
  }

  if (input.category === 'NEWS') {
    try {
      const gnews = await fetchGNewsArticles({ query: input.query });
      if (gnews.articles.length > 0) {
        return { results: gnews.articles, searchSource: 'GNews API' };
      }
      console.log('[searchProvider] GNews API error: Zero articles returned');
    } catch (err) {
      console.log(`[searchProvider] GNews API error: ${(err as Error).message}`);
    }
    const newsResults = await fetchGoogleNewsRSS(input.query);
    if (newsResults.length > 0) {
      return { results: newsResults, searchSource: 'Google News RSS (fallback)' };
    }
  }

  if (input.category === 'VIDEOS') {
    const page = input.page ?? 1;
    const [ytVideos, wikiVideos] = await Promise.all([
      fetchYouTubeSearchResults(input.query, page),
      fetchWikimediaVideoResults(input.query, 6, (page - 1) * 6),
    ]);

    const combined: SearchResult[] = [];
    const seenUrls = new Set<string>();

    for (const v of ytVideos) {
      if (!seenUrls.has(v.sourceUrl)) {
        seenUrls.add(v.sourceUrl);
        combined.push({
          title: v.title,
          url: v.sourceUrl,
          domain: 'youtube.com',
          description: v.description || `YouTube video by ${v.channel || 'Creator'} (${v.duration || 'Watch'})`,
          thumbnail: v.thumbnailUrl,
          image: v.thumbnailUrl,
          type: 'videos' as const,
          videoId: v.videoId,
          channel: v.channel,
          duration: v.duration,
        });
      }
    }

    for (const w of wikiVideos) {
      if (!seenUrls.has(w.sourceUrl)) {
        seenUrls.add(w.sourceUrl);
        combined.push({
          title: `[Wikipedia Media] ${w.title}`,
          url: w.sourceUrl,
          domain: 'commons.wikimedia.org',
          description: w.description || `Wikipedia Commons educational video file: ${w.title}`,
          thumbnail: w.thumbnailUrl,
          image: w.thumbnailUrl,
          type: 'videos' as const,
          channel: w.channel || 'Wikimedia Commons',
          duration: 'Wikipedia Video',
        });
      }
    }

    if (combined.length > 0) {
      return { results: combined, searchSource: 'YouTube & Wikimedia' };
    }
  }

  const TRUSTED_RESEARCH_DOMAINS = [
    'nasa.gov',
    'esa.int',
    'space.com',
    'wikipedia.org',
    'nature.com',
    'sciencedirect.com',
    '.edu',
    '.gov',
  ];

  const isTrustedResearchDomain = (urlOrDomain: string): boolean => {
    if (!urlOrDomain) return false;
    const lower = urlOrDomain.toLowerCase();
    return TRUSTED_RESEARCH_DOMAINS.some((td) =>
      td.startsWith('.') ? lower.includes(td) || lower.endsWith(td.slice(1)) : lower.includes(td),
    );
  };

  const key = process.env.SEARCH_API_KEY || process.env.TAVILY_API_KEY;
  const url = process.env.SEARCH_API_URL || (key ? 'https://api.tavily.com/search' : undefined);
  let primaryResults: SearchResult[] = [];
  let primaryFailed = false;
  const requestedMax = input.max_results ?? input.maxResults ?? 15;

  if (key && url) {
    try {
      const isTavily = url.includes('tavily.com') || Boolean(process.env.TAVILY_API_KEY);
      const bodyPayload = isTavily
        ? {
            api_key: key,
            query: input.query,
            search_depth: 'basic',
            max_results: Math.min(Math.max(requestedMax, 5), 25),
            topic: input.category === 'NEWS' ? 'news' : 'general',
            include_answer: false,
          }
        : {
            query: input.query,
            page: input.page ?? 1,
            category: input.category ?? 'ALL',
            region: input.region,
            language: input.language,
            max_results: Math.min(Math.max(requestedMax, 5), 25),
          };

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (!isTavily) {
        headers['Authorization'] = `Bearer ${key}`;
        headers['X-API-Key'] = key;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(6000),
      });

      if (!response.ok) {
        console.warn(`[Search] Tavily/Primary search returned HTTP ${response.status}`);
        primaryFailed = true;
      } else {
        const payload = (await response.json()) as {
          results?: Array<Record<string, unknown>>;
          organic_results?: Array<Record<string, unknown>>;
          news?: Array<Record<string, unknown>>;
        };
        const items = payload.results ?? payload.organic_results ?? payload.news ?? [];
        const type: SearchResult['type'] =
          input.category === 'NEWS'
            ? 'news'
            : input.category === 'IMAGES'
              ? 'images'
              : input.category === 'VIDEOS'
                ? 'videos'
                : input.category === 'SHOPPING'
                  ? 'shopping'
                  : 'web';

        primaryResults = items
          .map((item) => {
            const urlValue = String(item.url ?? item.link ?? '');
            return {
              title: String(item.title ?? ''),
              url: urlValue,
              domain: domainOf(urlValue),
              description: String(item.content ?? item.description ?? item.snippet ?? ''),
              date: item.date ? String(item.date) : undefined,
              image: item.image ? String(item.image) : (item.thumbnail ? String(item.thumbnail) : undefined),
              thumbnail: item.thumbnail ? String(item.thumbnail) : undefined,
              type,
            };
          })
          .filter((item) => item.title && item.url);
      }
    } catch (err) {
      console.warn('[Search] Primary search (Tavily/API) error or timeout:', err);
      primaryFailed = true;
    }
  } else {
    primaryFailed = true;
  }

  const isScientificOrFactualTopic = /\b(nasa|space|mars|moon|galaxy|physics|science|biology|chemistry|einstein|theory|history|edu|research|paper|quantum|black hole|astronomy|telescope)\b/i.test(input.query);
  const hasTrustedDomainMatch = primaryResults.some((r) => isTrustedResearchDomain(r.domain || r.url));
  const lacksTrustedDomainsForTopic = isScientificOrFactualTopic && !hasTrustedDomainMatch && primaryResults.length > 0;
  const needsFallback = primaryFailed || primaryResults.length < 3 || lacksTrustedDomainsForTopic;

  if (!needsFallback && primaryResults.length >= 3) {
    console.log(`[Search] Source Used: Tavily (${primaryResults.length} results) for query: "${input.query}"`);
    return { results: primaryResults, searchSource: 'Tavily API', fallbackOccurred: false };
  }

  const tavilyFallbackReason = primaryFailed
    ? 'Tavily failed'
    : primaryResults.length < 3
      ? 'Tavily returned insufficient results'
      : 'Domain verification triggered Tavily fallback';

  let exaResults: SearchResult[] = [];
  const exaKey = (process.env.EXA_API_KEY || '').trim();

  if (exaKey) {
    console.log(`[Search] Fallback 1 to Exa AI Search triggered (${tavilyFallbackReason}) for query: "${input.query}"`);
    exaResults = await fetchExaSearch(input.query, requestedMax);
    if (exaResults.length >= 3) {
      console.log(`[Search] Source Used: Exa AI Fallback (${exaResults.length} results) for query: "${input.query}"`);
      let finalResults = exaResults;
      if (primaryResults.length > 0) {
        const seenUrls = new Set(exaResults.map((r) => r.url.toLowerCase()));
        const extraPrimary = primaryResults.filter((r) => !seenUrls.has(r.url.toLowerCase()));
        finalResults = [...exaResults, ...extraPrimary];
      }
      return {
        results: finalResults,
        searchSource: 'Exa AI fallback',
        fallbackOccurred: true,
        fallbackReason: `${tavilyFallbackReason}, falling back to Exa AI`,
      };
    } else {
      console.log(`[Search] Exa AI returned ${exaResults.length} results (insufficient), proceeding to Fallback 2 (DuckDuckGo)...`);
    }
  }

  const ddgFallbackReason = primaryFailed
    ? (exaKey ? 'Tavily & Exa AI failed, falling back to DuckDuckGo' : 'Tavily failed, falling back to DuckDuckGo')
    : (exaKey ? 'Tavily & Exa AI returned insufficient results, falling back to DuckDuckGo' : 'Tavily returned insufficient results, falling back to DuckDuckGo');

  console.log(`[Search] Fallback 2 to DuckDuckGo Search triggered (${ddgFallbackReason}) for query: "${input.query}"`);
  const ddgResults = await fetchDuckDuckGoSearch(input.query);

  if (ddgResults.length > 0) {
    console.log(`[Search] Source Used: DuckDuckGo Fallback (${ddgResults.length} results) for query: "${input.query}"`);
    let finalResults = ddgResults;
    const priorResults = [...exaResults, ...primaryResults];
    if (priorResults.length > 0) {
      const seenUrls = new Set(ddgResults.map((r) => r.url.toLowerCase()));
      const extraPrior = priorResults.filter((r) => !seenUrls.has(r.url.toLowerCase()));
      finalResults = [...ddgResults, ...extraPrior];
    }
    return {
      results: finalResults,
      searchSource: 'DuckDuckGo fallback',
      fallbackOccurred: true,
      fallbackReason: ddgFallbackReason,
    };
  }

  if (exaResults.length > 0) {
    console.log(`[Search] Source Used: Exa AI (Partial ${exaResults.length} results) for query: "${input.query}"`);
    return {
      results: exaResults,
      searchSource: 'Exa AI fallback',
      fallbackOccurred: true,
      fallbackReason: `${tavilyFallbackReason}, partial Exa AI results`,
    };
  }

  if (primaryResults.length > 0) {
    console.log(`[Search] Source Used: Tavily (Partial ${primaryResults.length} results) for query: "${input.query}"`);
    return { results: primaryResults, searchSource: 'Tavily API', fallbackOccurred: false };
  }

  if (input.category === 'ALL' || !input.category) {
    const wikiResults = await fetchWikipediaSearch(input.query, 10);
    if (wikiResults.length > 0) {
      console.log(`[Search] Source Used: Wikipedia Fallback (${wikiResults.length} results) for query: "${input.query}"`);
      return {
        results: wikiResults,
        searchSource: 'Wikipedia Fallback',
        fallbackOccurred: true,
        fallbackReason: 'Primary, Exa AI & DuckDuckGo returned 0 results, used Wikipedia fallback',
      };
    }
  }

  return { results: [], searchSource: 'No Results', fallbackOccurred: true, fallbackReason: ddgFallbackReason };
}

export function extractTagContents(html: string, tagName: string): string[] {
  const results: string[] = [];
  const openTagRegex = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  let match: RegExpExecArray | null;

  while ((match = openTagRegex.exec(html)) !== null) {
    const startIndex = match.index + match[0].length;
    let depth = 1;
    let searchIdx = startIndex;
    let endIndex = -1;

    while (depth > 0) {
      const nextOpen = html.toLowerCase().indexOf(`<${tagName}`, searchIdx);
      const nextClose = html.toLowerCase().indexOf(`</${tagName}>`, searchIdx);

      if (nextClose === -1) {
        endIndex = html.length;
        break;
      }

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        searchIdx = nextOpen + `<${tagName}`.length;
      } else {
        depth--;
        if (depth === 0) {
          endIndex = nextClose;
          break;
        }
        searchIdx = nextClose + `</${tagName}>`.length;
      }
    }

    if (endIndex !== -1) {
      results.push(html.slice(startIndex, endIndex));
      openTagRegex.lastIndex = endIndex + `</${tagName}>`.length;
    }
  }

  return results;
}

export function cleanHtmlToText(rawChunk: string, isArticleOrMainScope = false): string {
  let cleaned = rawChunk
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, ' ')
    .replace(/<canvas\b[^<]*(?:(?!<\/canvas>)<[^<]*)*<\/canvas>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, ' ');

  if (!isArticleOrMainScope) {
    cleaned = cleaned.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ');
  }

  cleaned = cleaned
    .replace(/<\/(h[1-6]|p|div|section|article|li|tr|blockquote)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ');

  cleaned = cleaned.replace(/<[^>]+>/g, ' ');

  cleaned = cleaned
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&mdash;/gi, '—')
    .replace(/&ndash;/gi, '–')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  const lines = cleaned
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .filter((l) => l.length > 0 && l !== '•' && l !== '• ');

  return lines.join('\n\n');
}

export function extractReadableTextFromHtml(html: string): {
  title: string;
  description: string;
  headings: string[];
  textContent: string;
  rawTotalLength: number;
  isTruncated: boolean;
} {
  let title = '';
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
  }

  let description = '';
  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([\s\S]*?)["']/i) ||
    html.match(/<meta[^>]*content=["']([\s\S]*?)["'][^>]*name=["']description["']/i) ||
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([\s\S]*?)["']/i);
  if (descMatch && descMatch[1]) {
    description = descMatch[1].trim();
  }

  let selectedSourceHtml = '';
  let fullText = '';
  const articleSnippets = extractTagContents(html, 'article');
  if (articleSnippets.length > 0) {
    const combinedArticle = articleSnippets.join('\n\n');
    const articleText = cleanHtmlToText(combinedArticle, true);
    if (articleText.trim().length >= 80) {
      fullText = articleText;
      selectedSourceHtml = combinedArticle;
    }
  }

  if (!fullText) {
    const mainSnippets = extractTagContents(html, 'main');
    if (mainSnippets.length > 0) {
      const combinedMain = mainSnippets.join('\n\n');
      const mainText = cleanHtmlToText(combinedMain, true);
      if (mainText.trim().length >= 80) {
        fullText = mainText;
        selectedSourceHtml = combinedMain;
      }
    }
  }

  if (!fullText) {
    fullText = cleanHtmlToText(html, false);
    selectedSourceHtml = html;
  }

  const headings: string[] = [];
  const headingRegex = /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi;
  let hMatch: RegExpExecArray | null;
  const headingSource = selectedSourceHtml || html;
  while ((hMatch = headingRegex.exec(headingSource)) !== null) {
    const hText = hMatch[2].replace(/<[^>]+>/g, '').trim();
    if (hText && hText.length > 1 && !headings.includes(hText)) {
      headings.push(`H${hMatch[1]}: ${hText}`);
    }
  }

  if (headings.length === 0 && selectedSourceHtml !== html) {
    let fallbackHMatch: RegExpExecArray | null;
    while ((fallbackHMatch = headingRegex.exec(html)) !== null) {
      const hText = fallbackHMatch[2].replace(/<[^>]+>/g, '').trim();
      if (hText && hText.length > 1 && !headings.includes(hText)) {
        headings.push(`H${fallbackHMatch[1]}: ${hText}`);
      }
    }
  }

  const rawTotalLength = fullText.length;
  const MAX_CONTENT_CHARS = 4500;
  let textContent = fullText;
  let isTruncated = false;

  if (rawTotalLength > MAX_CONTENT_CHARS) {
    isTruncated = true;
    textContent = fullText.slice(0, MAX_CONTENT_CHARS) + `\n\n[Note: Page content truncated from ${rawTotalLength.toLocaleString()} characters to ${MAX_CONTENT_CHARS.toLocaleString()} characters for optimal synthesis.]`;
  }

  if (!textContent || textContent.trim().length === 0) {
    const fallbackParts = [
      title ? `Page Title: ${title}` : '',
      description ? `Meta Description: ${description}` : '',
      headings.length > 0 ? `Page Headings:\n${headings.join('\n')}` : '',
    ].filter(Boolean);
    textContent = fallbackParts.join('\n\n') || (title ? `Webpage at title: ${title}` : 'Webpage content loaded (Single-Page Application interface).');
  }

  return {
    title,
    description,
    headings: headings.slice(0, 25),
    textContent,
    rawTotalLength: rawTotalLength || textContent.length,
    isTruncated,
  };
}

const HEADLESS_RENDER_TIMEOUT_MS = Number(process.env.HEADLESS_RENDER_TIMEOUT_MS) || 12000;
const ENABLE_HEADLESS_RENDER = process.env.ENABLE_HEADLESS_RENDER !== 'false';
const RENDER_PROXY_URL = process.env.RENDER_PROXY_URL || '';
const RENDER_PROXY_API_KEY = process.env.RENDER_PROXY_API_KEY || '';

interface PlaywrightRoute {
  request: () => { resourceType: () => string };
  abort: () => Promise<void>;
  continue: () => Promise<void>;
}

interface PlaywrightPage {
  route: (url: string, handler: (route: PlaywrightRoute) => Promise<void> | void) => Promise<void>;
  goto: (url: string, options?: { waitUntil?: string; timeout?: number }) => Promise<unknown>;
  waitForLoadState: (state?: string, options?: { timeout?: number }) => Promise<unknown>;
  content: () => Promise<string>;
}

interface PlaywrightBrowserContext {
  newPage: () => Promise<PlaywrightPage>;
}

interface PlaywrightBrowser {
  newContext: (options?: { userAgent?: string }) => Promise<PlaywrightBrowserContext>;
  close: () => Promise<void>;
}

interface PlaywrightModule {
  chromium: {
    launch: (options?: { headless?: boolean; args?: string[] }) => Promise<PlaywrightBrowser>;
  };
}

let cachedPlaywrightModule: PlaywrightModule | null | undefined;

export async function loadPlaywright(): Promise<PlaywrightModule | null> {
  if (cachedPlaywrightModule !== undefined) return cachedPlaywrightModule;
  try {
    const dynamicImport = new Function('specifier', 'return import(specifier)') as (
      specifier: string,
    ) => Promise<PlaywrightModule>;
    cachedPlaywrightModule = await dynamicImport('playwright-chromium');
  } catch {
    cachedPlaywrightModule = null;
  }
  return cachedPlaywrightModule;
}

export function isLikelyJsGatedPage(rawHtml: string, extractedText: string): boolean {
  const noscriptWarning =
    /enable javascript|javascript is disabled|requires javascript|please turn on javascript|you need to enable javascript|this app requires javascript/i.test(
      rawHtml,
    );
  const emptyAppRoot = /<div[^>]*id=["'](root|app|__next|___gatsby)["'][^>]*>\s*<\/div>/i.test(rawHtml);
  const veryThinText = extractedText.trim().length < 200;
  const scriptHeavyThinPage =
    veryThinText && rawHtml.length > 1500 && (rawHtml.match(/<script\b/gi)?.length || 0) >= 3;
  return noscriptWarning || emptyAppRoot || scriptHeavyThinPage;
}

export async function renderPageHeadless(url: string): Promise<{ ok: boolean; html?: string; error?: string }> {
  if (!ENABLE_HEADLESS_RENDER) {
    return { ok: false, error: 'Headless rendering disabled (ENABLE_HEADLESS_RENDER=false).' };
  }
  const playwright = await loadPlaywright();
  if (!playwright) {
    return { ok: false, error: 'playwright-chromium is not installed on this server.' };
  }

  let browser: PlaywrightBrowser | null = null;
  try {
    browser = await playwright.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (compatible; NEXUS-Intelligence/1.0; +https://nexus.app)',
    });
    const page = await context.newPage();

    await page.route('**/*', (route: PlaywrightRoute) => {
      const type = route.request().resourceType();
      if (type === 'image' || type === 'media' || type === 'font') {
        return route.abort();
      }
      return route.continue();
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: HEADLESS_RENDER_TIMEOUT_MS });
    await page.waitForLoadState('networkidle', { timeout: HEADLESS_RENDER_TIMEOUT_MS }).catch(() => {});
    const html = await page.content();
    return { ok: true, html };
  } catch (err) {
    const errObj = err as Error;
    return { ok: false, error: `Headless render failed: ${errObj.message || 'Unknown error'}` };
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

export async function renderPageViaProxy(url: string): Promise<{ ok: boolean; html?: string; error?: string }> {
  const currentProxyUrl = (process.env.RENDER_PROXY_URL || RENDER_PROXY_URL || '').trim();
  const currentProxyKey = (process.env.RENDER_PROXY_API_KEY || RENDER_PROXY_API_KEY || '').trim();

  if (!currentProxyUrl) {
    console.log('[Server WebFetch] Fallback 2 (Browserless): RENDER_PROXY_URL is not configured in this environment.');
    return { ok: false, error: 'No RENDER_PROXY_URL configured.' };
  }
  try {
    const separator = currentProxyUrl.includes('?') ? '&' : '?';
    const proxyUrl =
      currentProxyKey && !currentProxyUrl.includes('token=')
        ? `${currentProxyUrl}${separator}token=${encodeURIComponent(currentProxyKey)}`
        : currentProxyUrl;

    const maskedUrl = proxyUrl.replace(/token=[^&]+/g, 'token=***');
    console.log(`[Server WebFetch] Attempting Fallback 2 (Browserless Proxy): ${maskedUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEADLESS_RENDER_TIMEOUT_MS);
    const response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({ url }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      const errMsg = `Browserless proxy returned HTTP ${response.status}${errText ? `: ${errText.slice(0, 200).replace(/\s+/g, ' ')}` : ''}`;
      console.warn(`[Server WebFetch] Fallback 2 (Browserless Proxy) failed: ${errMsg}`);
      return { ok: false, error: errMsg };
    }
    const html = await response.text();
    if (!html || !html.trim()) {
      console.warn('[Server WebFetch] Fallback 2 (Browserless Proxy) returned an empty response.');
      return { ok: false, error: 'Render proxy returned an empty response.' };
    }
    console.log(`[Server WebFetch] Fallback 2 (Browserless Proxy) successfully received ${html.length} chars of HTML.`);
    return { ok: true, html };
  } catch (err) {
    const errObj = err as Error;
    const errMsg = `Browserless proxy request failed: ${errObj.message || 'Unknown error'}`;
    console.warn(`[Server WebFetch] Fallback 2 (Browserless Proxy) connection error: ${errMsg}`);
    return { ok: false, error: errMsg };
  }
}

export async function renderPageViaJinaReader(url: string): Promise<{
  ok: boolean;
  data?: {
    title: string;
    description: string;
    headings: string[];
    textContent: string;
    length: number;
    rawTotalLength: number;
    isTruncated: boolean;
  };
  error?: string;
}> {
  try {
    const jinaUrl = `https://r.jina.ai/${url}`;
    console.log(`[Server WebFetch] Attempting Fallback 3 (Jina Reader): ${jinaUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response: globalThis.Response | null = null;
    let usedTargetSelector = true;

    try {
      response = await fetch(jinaUrl, {
        headers: {
          'Accept': 'application/json',
          'X-Target-Selector': 'article, main',
          'X-Remove-Selector': 'nav, header, footer, aside',
        },
        signal: controller.signal,
      });
    } catch {
      // Network or abort error on first attempt
    }

    if (!response || !response.ok) {
      usedTargetSelector = false;
      const fallbackController = new AbortController();
      const fallbackTimeoutId = setTimeout(() => fallbackController.abort(), 15000);
      try {
        response = await fetch(jinaUrl, {
          headers: {
            'Accept': 'application/json',
            'X-Remove-Selector': 'nav, header, footer, aside',
          },
          signal: fallbackController.signal,
        });
      } finally {
        clearTimeout(fallbackTimeoutId);
      }
    }
    clearTimeout(timeoutId);

    if (!response || !response.ok) {
      return { ok: false, error: `Jina Reader returned HTTP ${response?.status || 502}` };
    }

    console.log(`[Server WebFetch] Jina Reader content extracted via: ${usedTargetSelector ? 'article/main target selector' : 'full-page fallback'}`);

    const rawBodyText = await response.text().catch(() => '');
    if (!rawBodyText || !rawBodyText.trim()) {
      return { ok: false, error: 'Jina Reader returned an empty response.' };
    }

    let title = '';
    let description = '';
    let rawContent = '';

    try {
      const json = JSON.parse(rawBodyText) as {
        data?: {
          title?: string;
          description?: string;
          content?: string;
        };
        title?: string;
        description?: string;
        content?: string;
      };
      if (json && (json.data || json.content)) {
        title = (json.data?.title || json.title || '').trim();
        description = (json.data?.description || json.description || '').trim();
        rawContent = (json.data?.content || json.content || '').trim();
      }
    } catch {
      // Non-JSON format (Markdown plain text)
    }

    if (!rawContent && rawBodyText) {
      const titleMatch = rawBodyText.match(/^Title:\s*(.+)$/m);
      if (titleMatch) title = titleMatch[1].trim();
      const contentMatch = rawBodyText.match(/Markdown Content:\s*([\s\S]+)$/i);
      rawContent = contentMatch ? contentMatch[1].trim() : rawBodyText.trim();
    }

    if (!rawContent || rawContent.trim().length === 0) {
      return { ok: false, error: 'Jina Reader returned empty content.' };
    }

    const headings: string[] = [];
    const headingRegex = /^(#{1,3})\s+(.+)$/gm;
    let hMatch: RegExpExecArray | null;
    while ((hMatch = headingRegex.exec(rawContent)) !== null) {
      const level = hMatch[1].length;
      const hText = hMatch[2].replace(/[#*_`]/g, '').trim();
      if (hText && !headings.includes(hText)) {
        headings.push(`H${level}: ${hText}`);
      }
    }

    const rawTotalLength = rawContent.length;
    const MAX_CONTENT_CHARS = 4500;
    let textContent = rawContent;
    let isTruncated = false;

    if (rawTotalLength > MAX_CONTENT_CHARS) {
      isTruncated = true;
      textContent =
        rawContent.slice(0, MAX_CONTENT_CHARS) +
        `\n\n[Note: Page content truncated from ${rawTotalLength.toLocaleString()} characters to ${MAX_CONTENT_CHARS.toLocaleString()} characters for optimal synthesis.]`;
    }

    return {
      ok: true,
      data: {
        title,
        description,
        headings: headings.slice(0, 25),
        textContent,
        length: textContent.length,
        rawTotalLength,
        isTruncated,
      },
    };
  } catch (err) {
    const errObj = err as Error;
    return { ok: false, error: `Jina Reader failed: ${errObj.message || 'Network error'}` };
  }
}

export function isBlockedOrErrorPage(rawHtml: string, textContent: string, title: string = ''): boolean {
  const combined = `${title} ${textContent} ${rawHtml.slice(0, 5000)}`.toLowerCase();

  if (
    combined.includes('the request could not be satisfied') ||
    combined.includes('request blocked') ||
    (combined.includes('403 error') && combined.includes('cloudfront')) ||
    combined.includes('generated by cloudfront') ||
    combined.includes('error: the request could not be satisfied')
  ) {
    return true;
  }

  if (
    combined.includes('just a moment...') ||
    combined.includes('attention required! | cloudflare') ||
    combined.includes('cf-browser-verification') ||
    (combined.includes('cloudflare') && combined.includes('ray id') && textContent.length < 1500)
  ) {
    return true;
  }

  if (
    (combined.includes('403 forbidden') ||
      combined.includes('access denied') ||
      combined.includes('401 unauthorized') ||
      combined.includes('405 not allowed') ||
      combined.includes('405 method not allowed') ||
      combined.includes('access to this page has been denied')) &&
    textContent.length < 1200
  ) {
    return true;
  }

  if (
    (combined.includes('verify you are human') ||
      combined.includes('please verify that you are a human') ||
      combined.includes('confirm you are not a robot') ||
      combined.includes('security check to access') ||
      combined.includes('datadome') ||
      combined.includes('perimeterx')) &&
    textContent.length < 1000
  ) {
    return true;
  }

  return false;
}

export async function executeFallbackCascade(
  normalizedUrl: string,
  hostname: string,
  reason: string,
): Promise<{
  ok: boolean;
  data?: {
    url: string;
    finalUrl: string;
    title: string;
    description: string;
    headings: string[];
    textContent: string;
    length: number;
    rawTotalLength: number;
    isTruncated: boolean;
    renderedVia: 'static' | 'headless-browser' | 'render-proxy' | 'jina-reader' | 'wikipedia-api';
    status: number;
  };
  error?: string;
}> {
  console.log(`[Server WebFetch] Starting fallback cascade for ${normalizedUrl}. Reason: ${reason}`);

  console.log('[Server WebFetch] Attempting Fallback 1 (Headless Chromium)...');
  const headlessResult = await renderPageHeadless(normalizedUrl);
  if (headlessResult.ok && headlessResult.html) {
    const renderedData = extractReadableTextFromHtml(headlessResult.html);
    const isError = isBlockedOrErrorPage(headlessResult.html, renderedData.textContent, renderedData.title);
    if (!isError && renderedData.textContent.trim().length > 100) {
      console.log(`[Server WebFetch] Fallback 1 (Headless Chromium) succeeded with ${renderedData.textContent.length} chars.`);
      return {
        ok: true,
        data: {
          url: normalizedUrl,
          finalUrl: normalizedUrl,
          title: renderedData.title || hostname,
          description: renderedData.description,
          headings: renderedData.headings,
          textContent: renderedData.textContent,
          length: renderedData.textContent.length,
          rawTotalLength: renderedData.rawTotalLength,
          isTruncated: renderedData.isTruncated,
          renderedVia: 'headless-browser',
          status: 200,
        },
      };
    } else {
      console.log('[Server WebFetch] Fallback 1 (Headless Chromium) returned a block/error page or insufficient text.');
    }
  } else {
    console.log(`[Server WebFetch] Fallback 1 (Headless Chromium) unavailable or failed: ${headlessResult.error || 'unknown'}`);
  }

  console.log('[Server WebFetch] Attempting Fallback 2 (Browserless Proxy)...');
  const proxyResult = await renderPageViaProxy(normalizedUrl);
  if (proxyResult.ok && proxyResult.html) {
    const renderedData = extractReadableTextFromHtml(proxyResult.html);
    const isError = isBlockedOrErrorPage(proxyResult.html, renderedData.textContent, renderedData.title);
    if (!isError && renderedData.textContent.trim().length > 100) {
      console.log(`[Server WebFetch] Fallback 2 (Browserless Proxy) succeeded with ${renderedData.textContent.length} chars.`);
      return {
        ok: true,
        data: {
          url: normalizedUrl,
          finalUrl: normalizedUrl,
          title: renderedData.title || hostname,
          description: renderedData.description,
          headings: renderedData.headings,
          textContent: renderedData.textContent,
          length: renderedData.textContent.length,
          rawTotalLength: renderedData.rawTotalLength,
          isTruncated: renderedData.isTruncated,
          renderedVia: 'render-proxy',
          status: 200,
        },
      };
    } else {
      console.log('[Server WebFetch] Fallback 2 (Browserless Proxy) returned a block/error page or insufficient text.');
    }
  } else {
    console.log(`[Server WebFetch] Fallback 2 (Browserless Proxy) failed or skipped: ${proxyResult.error || 'unknown'}`);
  }

  console.log(`[Server WebFetch] Attempting Fallback 3 (Jina Reader)...`);
  const jinaResult = await renderPageViaJinaReader(normalizedUrl);
  if (jinaResult.ok && jinaResult.data) {
    const isError = isBlockedOrErrorPage('', jinaResult.data.textContent, jinaResult.data.title);
    if (!isError && jinaResult.data.textContent.trim().length > 100) {
      console.log(`[Server WebFetch] Fallback 3 (Jina Reader) succeeded with ${jinaResult.data.textContent.length} chars.`);
      return {
        ok: true,
        data: {
          url: normalizedUrl,
          finalUrl: normalizedUrl,
          title: jinaResult.data.title || hostname,
          description: jinaResult.data.description,
          headings: jinaResult.data.headings,
          textContent: jinaResult.data.textContent,
          length: jinaResult.data.length,
          rawTotalLength: jinaResult.data.rawTotalLength,
          isTruncated: jinaResult.data.isTruncated,
          renderedVia: 'jina-reader',
          status: 200,
        },
      };
    } else {
      console.log('[Server WebFetch] Fallback 3 (Jina Reader) returned a block/error page or insufficient text.');
    }
  } else {
    console.log(`[Server WebFetch] Fallback 3 (Jina Reader) failed: ${jinaResult.error || 'unknown'}`);
  }

  return {
    ok: false,
    error: `All fetch methods (Direct, Headless, Browserless, Jina Reader) failed for ${normalizedUrl}. Primary failure: ${reason}`,
  };
}

export async function fetchDirectWebPage(targetUrl: string): Promise<{
  ok: boolean;
  data?: {
    url: string;
    finalUrl: string;
    title: string;
    description: string;
    headings: string[];
    textContent: string;
    length: number;
    rawTotalLength: number;
    isTruncated: boolean;
    renderedVia: 'static' | 'headless-browser' | 'render-proxy' | 'jina-reader' | 'wikipedia-api';
    status: number;
  };
  error?: string;
}> {
  let normalizedUrl = targetUrl.trim().replace(/^["'`<]+|[>"'`]+$/g, '').trim();
  if (!/^https?:\/\//i.test(normalizedUrl)) {
    normalizedUrl = `https://${normalizedUrl}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    return { ok: false, error: `Invalid URL format: "${targetUrl}"` };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: `Unsupported protocol: "${parsed.protocol}" (only HTTP and HTTPS are supported)` };
  }

  console.log(`[Server WebFetch] Initiating fetch for: ${normalizedUrl}`);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(normalizedUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 (compatible; NEXUS-Intelligence/1.0; +https://nexus.app)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      signal: controller.signal,
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    console.log(`[Server WebFetch] Response status ${response.status} ${response.statusText} for ${normalizedUrl}`);

    if (!response.ok) {
      if (parsed.hostname.includes('wikipedia.org')) {
        const articlePath = parsed.pathname.replace(/^\/wiki\//, '').replace(/^\//, '');
        const wikiQuery = decodeURIComponent(articlePath || 'Main_Page');
        const wikiSummary = await fetchWikipediaSummary(wikiQuery);
        if (wikiSummary && wikiSummary.extract) {
          const wikiText = wikiSummary.extract;
          const isTrunc = wikiText.length > 4500;
          const cappedWikiText = isTrunc
            ? wikiText.slice(0, 4500) +
              `\n\n[Note: Page content truncated from ${wikiText.length.toLocaleString()} characters to 4,500 characters for optimal synthesis.]`
            : wikiText;
          return {
            ok: true,
            data: {
              url: normalizedUrl,
              finalUrl: wikiSummary.url || normalizedUrl,
              title: wikiSummary.title || parsed.hostname,
              description: wikiSummary.description || '',
              headings: ['H1: ' + wikiSummary.title],
              textContent: cappedWikiText,
              length: cappedWikiText.length,
              rawTotalLength: wikiText.length,
              isTruncated: isTrunc,
              renderedVia: 'wikipedia-api',
              status: response.status,
            },
          };
        }
      }

      console.log(`[Server WebFetch] Direct fetch returned HTTP ${response.status} ${response.statusText}. Triggering fallback cascade...`);
      return await executeFallbackCascade(
        normalizedUrl,
        parsed.hostname,
        `HTTP ${response.status} (${response.statusText || 'Fetch Error'})`,
      );
    }

    const rawBody = await response.text();
    if (!rawBody || !rawBody.trim()) {
      console.log(`[Server WebFetch] Direct fetch returned empty response body. Triggering fallback cascade...`);
      return await executeFallbackCascade(normalizedUrl, parsed.hostname, 'Empty response body on direct fetch');
    }

    const parsedData = extractReadableTextFromHtml(rawBody);

    if (isBlockedOrErrorPage(rawBody, parsedData.textContent, parsedData.title)) {
      console.warn(
        `[Server WebFetch] Fake success detected: Direct fetch returned a WAF/bot block page ("${parsedData.title}"). Triggering fallback cascade...`,
      );
      const fallbackResult = await executeFallbackCascade(
        normalizedUrl,
        parsed.hostname,
        `WAF/bot block page intercepted (CloudFront/Cloudflare error: "${parsedData.title}")`,
      );
      if (fallbackResult.ok) {
        return fallbackResult;
      }
      return {
        ok: false,
        error: `Page access blocked by security firewall (${parsedData.title || '403 Forbidden'}). All fallbacks failed.`,
      };
    }

    if (isLikelyJsGatedPage(rawBody, parsedData.textContent)) {
      console.log(`[Server WebFetch] Direct fetch detected JS-gated page. Triggering fallback cascade...`);
      const fallbackResult = await executeFallbackCascade(
        normalizedUrl,
        parsed.hostname,
        'Page requires JavaScript rendering (empty root / noscript warning)',
      );
      if (fallbackResult.ok) {
        return fallbackResult;
      }
    }

    return {
      ok: true,
      data: {
        url: normalizedUrl,
        finalUrl: response.url || normalizedUrl,
        title: parsedData.title || parsed.hostname,
        description: parsedData.description,
        headings: parsedData.headings,
        textContent: parsedData.textContent,
        length: parsedData.textContent.length,
        rawTotalLength: parsedData.rawTotalLength,
        isTruncated: parsedData.isTruncated,
        renderedVia: 'static',
        status: response.status,
      },
    };
  } catch (err) {
    const errObj = err as Error;
    console.error(`[Server WebFetch] Direct fetch failed for ${normalizedUrl}:`, errObj);

    console.log(`[Server WebFetch] Network error on direct fetch. Triggering fallback cascade...`);
    const fallbackResult = await executeFallbackCascade(
      normalizedUrl,
      parsed.hostname,
      errObj.message || 'Direct network error',
    );
    if (fallbackResult.ok) {
      return fallbackResult;
    }

    const isTimeout =
      errObj.name === 'AbortError' ||
      errObj.message?.includes('timeout') ||
      errObj.message?.includes('aborted');
    const msg = isTimeout
      ? `Connection timed out after 15s while fetching ${normalizedUrl}`
      : `Failed to reach ${normalizedUrl}: ${errObj.message || 'Network error'}`;
    return { ok: false, error: msg };
  }
}

export interface SearchRouterDependencies {
  generateSummaryAi?: (params: {
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    maxTokens?: number;
  }) => Promise<{ text: string } | null>;
}

export function createSearchRouter(deps: SearchRouterDependencies = {}) {
  const router = Router();

  router.post('/api/search', async (req, res) => {
    const parsed = searchSchema.safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 400, 'Enter a valid search query.');
    try {
      const searchRes = await searchProvider(parsed.data);
      return res.json({
        data: searchRes.results,
        searchSource: searchRes.searchSource,
        fallbackOccurred: searchRes.fallbackOccurred,
        fallbackReason: searchRes.fallbackReason,
      });
    } catch (error) {
      const err = error as Error & { status?: number };
      return errorResponse(res, err.status ?? 502, err.message);
    }
  });

  router.post('/api/web/fetch', async (req, res) => {
    const url = typeof req.body?.url === 'string' ? req.body.url.trim() : '';
    if (!url) {
      return errorResponse(res, 400, 'A valid URL is required.');
    }
    const result = await fetchDirectWebPage(url);
    if (!result.ok || !result.data) {
      return res.status(200).json({
        ok: false,
        error: result.error || `Unable to fetch web page at ${url}`,
      });
    }
    return res.json({
      ok: true,
      data: result.data,
    });
  });

  router.get('/api/web/fetch', async (req, res) => {
    const url = typeof req.query?.url === 'string' ? req.query.url.trim() : '';
    if (!url) {
      return errorResponse(res, 400, 'A valid URL query parameter is required.');
    }
    const result = await fetchDirectWebPage(url);
    if (!result.ok || !result.data) {
      return res.status(200).json({
        ok: false,
        error: result.error || `Unable to fetch web page at ${url}`,
      });
    }
    return res.json({
      ok: true,
      data: result.data,
    });
  });

  router.get('/api/videos/search', async (req, res) => {
    const query = typeof req.query.query === 'string' ? req.query.query : '';
    const page = typeof req.query.page === 'string' ? parseInt(req.query.page, 10) || 1 : 1;
    if (!query.trim()) {
      return errorResponse(res, 400, 'Enter a valid video search query.');
    }
    try {
      const [ytVideos, wikiVideos] = await Promise.all([
        fetchYouTubeSearchResults(query, page),
        fetchWikimediaVideoResults(query, 6, (page - 1) * 6),
      ]);

      const merged: YouTubeSearchVideo[] = [];
      const seenUrls = new Set<string>();

      const maxLen = Math.max(ytVideos.length, wikiVideos.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < ytVideos.length && !seenUrls.has(ytVideos[i].sourceUrl)) {
          seenUrls.add(ytVideos[i].sourceUrl);
          merged.push(ytVideos[i]);
        }
        if (i < wikiVideos.length && !seenUrls.has(wikiVideos[i].sourceUrl)) {
          seenUrls.add(wikiVideos[i].sourceUrl);
          merged.push(wikiVideos[i]);
        }
      }

      return res.json({ data: merged.length > 0 ? merged : ytVideos });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to search videos.';
      return errorResponse(res, 500, msg);
    }
  });

  router.post('/api/search/summary', async (req, res) => {
    const parsed = z
      .object({
        query: z.string().min(1),
        results: z
          .array(
            z.object({
              title: z.string(),
              url: z.string(),
              description: z.string(),
            }),
          )
          .max(20),
      })
      .safeParse(req.body);
    if (!parsed.success) return errorResponse(res, 400, 'A query and search results are required.');

    if (deps.generateSummaryAi) {
      const openRouterResult = await deps.generateSummaryAi({
        messages: [
          {
            role: 'user',
            content: `Answer only from these sources. Query: ${parsed.data.query}\nSources: ${JSON.stringify(parsed.data.results)}`,
          },
        ],
        temperature: 0.3,
        maxTokens: 500,
      });

      if (openRouterResult) {
        return res.json({
          data: { choices: [{ message: { content: openRouterResult.text } }] },
        });
      }
    }

    if (parsed.data.results.length > 0 && parsed.data.results[0].description) {
      return res.json({
        data: {
          choices: [
            {
              message: {
                content: `${parsed.data.results[0].title}: ${parsed.data.results[0].description}`,
              },
            },
          ],
        },
      });
    }

    return errorResponse(res, 503, 'AI summary provider is temporarily unavailable.');
  });

  // Live News Page Endpoint (Primary GNews Integration with fallback)
  router.get('/api/news', async (req, res) => {
    const category = typeof req.query.category === 'string' ? req.query.category : 'general';
    const query = typeof req.query.q === 'string' ? req.query.q : typeof req.query.query === 'string' ? req.query.query : undefined;
    const country = typeof req.query.country === 'string' ? req.query.country : 'us';
    const lang = typeof req.query.lang === 'string' ? req.query.lang : 'en';

    try {
      const gnews = await fetchGNewsArticles({ category, query, country, lang });
      return res.json({
        data: gnews.articles,
        source: 'GNews',
        provider: 'gnews',
        category: gnews.category,
        total: gnews.totalArticles,
        isFallback: false,
        hasGNewsKey: true,
      });
    } catch (error) {
      const err = error as Error;
      console.warn('[Live News Page GNews Error]:', err.message);

      try {
        const rssQuery = query || (category && category !== 'general' ? `${category} news` : 'latest world news');
        const fallbackResults = await fetchGoogleNewsRSS(rssQuery, category);
        return res.json({
          data: fallbackResults,
          source: 'Google News RSS (Fallback)',
          provider: 'google_rss',
          category,
          total: fallbackResults.length,
          isFallback: true,
          error: err.message,
          hasGNewsKey: Boolean(process.env.GNEWS_API_KEY && process.env.GNEWS_API_KEY.trim()),
        });
      } catch {
        return errorResponse(res, 502, err.message || 'News provider is temporarily unavailable.');
      }
    }
  });

  // Dedicated Google News RSS Endpoint (Keeps JARVIS Researcher independent)
  router.get('/api/news/rss', async (req, res) => {
    try {
      const q = typeof req.query.q === 'string' ? req.query.q : typeof req.query.query === 'string' ? req.query.query : undefined;
      const results = await fetchGoogleNewsRSS(q);
      return res.json({
        data: results,
        source: 'Google News RSS',
      });
    } catch (err) {
      return errorResponse(res, 502, (err as Error).message);
    }
  });

  return router;
}

export default createSearchRouter;
