import type { SearchResult, UnifiedSearchResult, UnifiedSearchSource, UnifiedResultType } from '@/types';
import { api } from '@/services/api';
import { searchWikipedia } from '@/services/wikipedia';
import { searchWikimediaCommons, searchWikimediaVideos, searchYouTubeVideos, extractMediaFromResults } from '@/services/media';
import { detectQueryIntent, type QueryIntent } from '@/services/intentDetector';

export interface UnifiedSearchOutput {
  query: string;
  page: number;
  hasMore: boolean;
  intent: QueryIntent;
  results: UnifiedSearchResult[];
  tabResults: {
    all: UnifiedSearchResult[];
    videos: UnifiedSearchResult[];
    images: UnifiedSearchResult[];
    wikipedia: UnifiedSearchResult[];
    web: UnifiedSearchResult[];
  };
  stats: {
    total: number;
    videoCount: number;
    imageCount: number;
    wikiCount: number;
    webCount: number;
    sourcesQueried: string[];
    durationMs: number;
  };
}

function sanitizeUrl(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.startsWith('//')) return `https:${trimmed}`;
  return trimmed;
}

function normalizeCanonicalUrl(url: string): string {
  if (!url) return '';
  return url
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/\/+$/, '');
}

/**
 * Deduplicate unified search results across sources
 */
export function deduplicateUnifiedResults(items: UnifiedSearchResult[]): UnifiedSearchResult[] {
  const seenCanonicalUrls = new Set<string>();
  const seenUniqueKeys = new Set<string>();
  const output: UnifiedSearchResult[] = [];

  for (const item of items) {
    if (!item.title || !item.url) continue;

    const canonicalUrl = normalizeCanonicalUrl(item.url);
    const uniqueKey = item.videoId
      ? `yt:${item.videoId}`
      : item.source === 'wikipedia'
        ? `wiki:${item.title.toLowerCase().trim()}`
        : `${item.source}:${canonicalUrl}`;

    if (seenCanonicalUrls.has(canonicalUrl) || seenUniqueKeys.has(uniqueKey)) {
      continue;
    }

    seenCanonicalUrls.add(canonicalUrl);
    seenUniqueKeys.add(uniqueKey);
    output.push(item);
  }

  return output;
}

/**
 * Rank search results based on query intent
 */
export function rankUnifiedResults(
  items: UnifiedSearchResult[],
  intent: QueryIntent,
): {
  all: UnifiedSearchResult[];
  videos: UnifiedSearchResult[];
  images: UnifiedSearchResult[];
  wikipedia: UnifiedSearchResult[];
  web: UnifiedSearchResult[];
} {
  const videos = items.filter((item) => item.type === 'video');
  const images = items.filter((item) => item.type === 'image');
  const wikipedia = items.filter((item) => item.source === 'wikipedia' || item.type === 'article');
  const web = items.filter((item) => item.source === 'web' && item.type !== 'video' && item.type !== 'image');

  let all: UnifiedSearchResult[] = [];

  if (intent.videoIntent) {
    // Video query: Rank videos first, then top wikipedia, web, and images
    all = [...videos, ...wikipedia.slice(0, 2), ...web, ...images];
  } else if (intent.imageIntent) {
    // Image query: Rank images first, then wikipedia, web, and videos
    all = [...images, ...wikipedia.slice(0, 2), ...web, ...videos];
  } else if (intent.knowledgeIntent) {
    // Factual / concept / entity query: Rank Wikipedia top, followed by video, web, images
    const mixed: UnifiedSearchResult[] = [];
    if (wikipedia.length > 0) mixed.push(wikipedia[0]);
    if (videos.length > 0) mixed.push(videos[0]);
    if (wikipedia.length > 1) mixed.push(...wikipedia.slice(1, 3));
    mixed.push(...web.slice(0, 4));
    if (images.length > 0) mixed.push(...images.slice(0, 4));
    mixed.push(...web.slice(4));
    if (videos.length > 1) mixed.push(...videos.slice(1));
    all = mixed;
  } else {
    // Balanced mixed layout
    const mixed: UnifiedSearchResult[] = [];
    if (wikipedia.length > 0) mixed.push(wikipedia[0]);
    if (videos.length > 0) mixed.push(videos[0]);
    if (web.length > 0) mixed.push(...web.slice(0, 3));
    if (images.length > 0) mixed.push(...images.slice(0, 4));
    if (wikipedia.length > 1) mixed.push(...wikipedia.slice(1));
    if (web.length > 3) mixed.push(...web.slice(3));
    if (videos.length > 1) mixed.push(...videos.slice(1));
    if (images.length > 4) mixed.push(...images.slice(4));
    all = mixed;
  }

  // Ensure all is deduplicated
  all = deduplicateUnifiedResults(all);

  return {
    all,
    videos: deduplicateUnifiedResults(videos),
    images: deduplicateUnifiedResults(images),
    wikipedia: deduplicateUnifiedResults(wikipedia),
    web: deduplicateUnifiedResults(web),
  };
}

/**
 * Execute parallel multi-source search across Web, Wikipedia, Wikimedia Commons, and YouTube
 */
export async function executeSmarterMediaSearch(query: string, page = 1): Promise<UnifiedSearchOutput> {
  const startTime = Date.now();
  const trimmed = query.trim();
  const intent = detectQueryIntent(trimmed);

  const rawUnifiedList: UnifiedSearchResult[] = [];
  const sourcesQueried: string[] = ['Web', 'Wikipedia', 'Wikimedia Commons', 'Wikimedia Videos', 'YouTube'];

  const wikiOffset = (page - 1) * 12;
  const commonsOffset = (page - 1) * 16;
  const videoOffset = (page - 1) * 10;

  // Parallel source searches with Promise.allSettled for maximum error resilience
  const [webOutcome, wikiOutcome, wikimediaOutcome, wikiVideoOutcome, youtubeOutcome] = await Promise.allSettled([
    // 1. Web Search (passes page index)
    api.search(trimmed, 'ALL', page).catch(() => [] as SearchResult[]),
    // 2. Wikipedia Search (supports offset for infinite scroll pagination)
    searchWikipedia(trimmed, 12, wikiOffset).catch(() => []),
    // 3. Wikimedia Commons Media Search (supports offset for infinite scroll pagination)
    searchWikimediaCommons(intent.cleanTopic || trimmed, 16, commonsOffset).catch(() => []),
    // 4. Dedicated Wikipedia / Wikimedia Commons Videos Search
    searchWikimediaVideos(intent.cleanTopic || trimmed, 10, videoOffset).catch(() => []),
    // 5. YouTube Video Search (live search with pagination support)
    searchYouTubeVideos(trimmed, page).catch(() => []),
  ]);

  // Process YouTube results
  if (youtubeOutcome.status === 'fulfilled' && Array.isArray(youtubeOutcome.value)) {
    youtubeOutcome.value.forEach((yt) => {
      rawUnifiedList.push({
        id: yt.id,
        title: yt.title,
        source: 'youtube',
        type: 'video',
        url: yt.sourceUrl || `https://www.youtube.com/watch?v=${yt.videoId}`,
        thumbnail: yt.thumbnailUrl,
        playableUrl: yt.mediaUrl,
        duration: yt.duration,
        videoId: yt.videoId,
        channel: yt.channel,
        embedUrl: yt.embedUrl,
        description: yt.description,
        domain: 'youtube.com',
      });
    });
  }

  // Process Dedicated Wikimedia / Wikipedia Video results
  if (wikiVideoOutcome.status === 'fulfilled' && Array.isArray(wikiVideoOutcome.value)) {
    wikiVideoOutcome.value.forEach((wv) => {
      rawUnifiedList.push({
        id: wv.id,
        title: wv.title,
        source: 'wikimedia',
        type: 'video',
        url: wv.sourceUrl || wv.mediaUrl,
        thumbnail: wv.thumbnailUrl || wv.mediaUrl,
        playableUrl: wv.mediaUrl,
        duration: wv.duration || 'Wikimedia Video',
        creator: wv.author,
        author: wv.author,
        license: wv.license,
        description: wv.description,
        domain: 'commons.wikimedia.org',
      });
    });
  }

  // Process Wikimedia Commons results
  if (wikimediaOutcome.status === 'fulfilled' && Array.isArray(wikimediaOutcome.value)) {
    wikimediaOutcome.value.forEach((wm) => {
      const isVideo = wm.type === 'video' || wm.mediaUrl.match(/\.(webm|ogv|mp4)$/i) !== null;
      rawUnifiedList.push({
        id: wm.id,
        title: wm.title,
        source: 'wikimedia',
        type: isVideo ? 'video' : 'image',
        url: wm.sourceUrl || wm.mediaUrl,
        thumbnail: wm.thumbnailUrl || wm.mediaUrl,
        playableUrl: isVideo ? wm.mediaUrl : undefined,
        creator: wm.author,
        author: wm.author,
        license: wm.license,
        description: wm.description,
        domain: 'commons.wikimedia.org',
      });
    });
  }

  // Process Wikipedia results
  if (wikiOutcome.status === 'fulfilled' && Array.isArray(wikiOutcome.value)) {
    wikiOutcome.value.forEach((wk) => {
      rawUnifiedList.push({
        id: `wiki_${wk.pageid}_p${page}`,
        title: wk.title,
        source: 'wikipedia',
        type: 'article',
        url: wk.url,
        thumbnail: wk.thumbnail,
        description: wk.snippet || wk.description,
        domain: 'wikipedia.org',
      });
    });
  }

  // Process Web results + Extracted media
  if (webOutcome.status === 'fulfilled' && Array.isArray(webOutcome.value)) {
    const webResults = webOutcome.value;

    webResults.forEach((w, idx) => {
      const u = sanitizeUrl(w.url);
      const isWikiUrl = u.includes('wikipedia.org');
      const isWikimediaUrl = u.includes('commons.wikimedia.org');
      const isYtUrl = u.includes('youtube.com') || u.includes('youtu.be');
      const isDirectVid = u.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i) !== null;

      let source: UnifiedSearchSource = 'web';
      let type: UnifiedResultType = 'web';

      if (isYtUrl) {
        source = 'youtube';
        type = 'video';
      } else if (isWikiUrl) {
        source = 'wikipedia';
        type = 'article';
      } else if (isWikimediaUrl) {
        source = 'wikimedia';
        type = isDirectVid ? 'video' : 'image';
      } else if (isDirectVid) {
        source = 'web';
        type = 'video';
      } else if (w.type === 'images') {
        type = 'image';
      }

      rawUnifiedList.push({
        id: `web_${idx}_p${page}_${Math.random().toString(36).slice(2, 6)}`,
        title: w.title,
        source,
        type,
        url: u,
        thumbnail: w.thumbnail || w.image,
        description: w.description,
        domain: w.domain || (source === 'wikipedia' ? 'wikipedia.org' : source === 'wikimedia' ? 'commons.wikimedia.org' : 'web'),
        publishedAt: w.date,
      });
    });

    // Also extract embedded media from web results
    const extractedMedia = extractMediaFromResults(webResults);
    extractedMedia.forEach((m) => {
      if (m.videoId && !rawUnifiedList.some((r) => r.videoId === m.videoId)) {
        rawUnifiedList.push({
          id: m.id,
          title: m.title,
          source: 'youtube',
          type: 'video',
          url: m.sourceUrl,
          thumbnail: m.thumbnailUrl,
          playableUrl: m.mediaUrl,
          duration: m.duration,
          videoId: m.videoId,
          channel: m.channel,
          embedUrl: m.embedUrl,
          description: m.description,
          domain: 'youtube.com',
        });
      }
    });
  }

  // Deduplicate and Rank
  const tabResults = rankUnifiedResults(rawUnifiedList, intent);

  const durationMs = Date.now() - startTime;
  const hasMore = tabResults.all.length > 0;

  return {
    query: trimmed,
    page,
    hasMore,
    intent,
    results: tabResults.all,
    tabResults,
    stats: {
      total: tabResults.all.length,
      videoCount: tabResults.videos.length,
      imageCount: tabResults.images.length,
      wikiCount: tabResults.wikipedia.length,
      webCount: tabResults.web.length,
      sourcesQueried,
      durationMs,
    },
  };
}

/**
 * Merge newly fetched page results with existing output
 */
export function appendUnifiedSearchOutput(
  prev: UnifiedSearchOutput,
  next: UnifiedSearchOutput,
): UnifiedSearchOutput {
  const mergedAll = deduplicateUnifiedResults([...prev.results, ...next.results]);
  const mergedVideos = deduplicateUnifiedResults([...prev.tabResults.videos, ...next.tabResults.videos]);
  const mergedImages = deduplicateUnifiedResults([...prev.tabResults.images, ...next.tabResults.images]);
  const mergedWiki = deduplicateUnifiedResults([...prev.tabResults.wikipedia, ...next.tabResults.wikipedia]);
  const mergedWeb = deduplicateUnifiedResults([...prev.tabResults.web, ...next.tabResults.web]);

  return {
    ...prev,
    page: next.page,
    hasMore: next.results.length > 0,
    results: mergedAll,
    tabResults: {
      all: mergedAll,
      videos: mergedVideos,
      images: mergedImages,
      wikipedia: mergedWiki,
      web: mergedWeb,
    },
    stats: {
      ...prev.stats,
      total: mergedAll.length,
      videoCount: mergedVideos.length,
      imageCount: mergedImages.length,
      wikiCount: mergedWiki.length,
      webCount: mergedWeb.length,
      durationMs: prev.stats.durationMs + next.stats.durationMs,
    },
  };
}
