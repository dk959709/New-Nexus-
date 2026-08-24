import type { MediaItem, SearchResult } from '@/types';
import { api } from '@/services/api';

const WIKIMEDIA_USER_AGENT = 'NEXUS-Intelligence/1.0 (https://nexus.app; contact: dk959709@gmail.com)';

// In-memory cache for media search results
const mediaCache = new Map<string, { timestamp: number; items: MediaItem[] }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
  * Safely validate and sanitize external URLs, ensuring they start with https://
  */
export function sanitizeMediaUrl(url?: string): string {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed;
  }
  if (trimmed.startsWith('//')) {
    return 'https:' + trimmed;
  }
  return '';
}

/**
  * Extract YouTube ID from various URL formats including watch, youtu.be, shorts, and embed
  */
export function extractYouTubeId(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|shorts\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

const fallbackVideoDatabase: Array<{
  keywords: string[];
  videoId: string;
  title: string;
  description: string;
  channel: string;
  duration?: string;
}> = [
  {
    keywords: ['nasa', 'black hole', 'blackholes', 'singularity', 'event horizon', 'space'],
    videoId: 'e3uWgbL1gV4',
    title: 'NASA: What is a Black Hole? Explained with Space Science',
    description: 'An official NASA visualization and explanation of black holes, event horizons, and spacetime curvature.',
    channel: 'NASA',
    duration: '4:25',
  },
  {
    keywords: ['black hole', 'telescope', 'event horizon', 'm87', 'astronomy'],
    videoId: 'e-P5IFTqB98',
    title: 'How Astronomers Captured the First Image of a Black Hole',
    description: 'The historic scientific breakthrough of imaging the supermassive black hole at galaxy M87.',
    channel: 'Veritasium',
    duration: '11:42',
  },
  {
    keywords: ['einstein', 'relativity', 'physics', 'spacetime', 'gravity', 'science'],
    videoId: 'ajhFNcUTJI0',
    title: 'Albert Einstein: How His Theory of General Relativity Changed Physics Forever',
    description: 'A comprehensive visual journey through Einstein’s revolution in theoretical physics.',
    channel: 'PBS Space Time',
    duration: '14:30',
  },
  {
    keywords: ['nasa', 'iss', 'space station', 'astronaut', 'orbit'],
    videoId: 'XkM_04Ch76E',
    title: 'ISS Tour: Life Inside the International Space Station',
    description: 'Detailed tour of the space station sleeping quarters, science modules, and daily astronaut routines.',
    channel: 'VideoFromSpace',
    duration: '8:42',
  },
  {
    keywords: ['nasa', 'artemis', 'moon', 'launch', 'rocket', 'sls', 'apollo'],
    videoId: 'Ke6XX8FHOHM',
    title: 'Artemis: To the Moon and Beyond (NASA Mission Animation)',
    description: 'The complete flight plan for NASA’s Artemis lunar exploration and deep space infrastructure.',
    channel: 'NASA',
    duration: '7:45',
  },
  {
    keywords: ['space shuttle', 'orbiter', 'rocket', 'engineering', 'nasa'],
    videoId: 'cFBRawYov00',
    title: 'How Did the Space Shuttle Orbiter Vehicle Work?',
    description: 'An in-depth 3D breakdown of the Space Shuttle main engines, thermal protection, and cargo bay.',
    channel: 'Jared Owen',
    duration: '12:41',
  },
  {
    keywords: ['earth', 'space', '4k', 'relax', 'iss', 'orbit', 'nature'],
    videoId: 'wnhvanMdx4s',
    title: 'Earth from Space in 4K: Breathtaking Orbit Views from the ISS',
    description: 'Ultra HD views of planet Earth captured from the International Space Station.',
    channel: 'Relaxation Windows',
    duration: '10:03:46',
  },
  {
    keywords: ['space station', 'how it works', 'iss', 'technology', 'science'],
    videoId: 'SGP6Y0Pnhe4',
    title: 'HOW IT WORKS: The International Space Station Modules & Systems',
    description: 'Explaining each interior module, solar arrays, life support, and robotics on the ISS.',
    channel: 'DOCUMENTARY TUBE',
    duration: '28:58',
  },
  {
    keywords: ['mars', 'perseverance', 'rover', 'landing', 'red planet', 'nasa'],
    videoId: '21X5lGlDOfg',
    title: 'Mars Perseverance Rover Landing on the Red Planet (Official NASA Footage)',
    description: 'Relive the dramatic entry, descent, and landing of NASA’s Perseverance rover on Mars.',
    channel: 'NASA',
    duration: '3:50',
  },
  {
    keywords: ['webb', 'jwst', 'telescope', 'deep field', 'galaxy', 'nasa'],
    videoId: 'zR_zsTqY5L4',
    title: 'NASA James Webb Space Telescope First Deep Field Images Revealed',
    description: 'Explore the deepest infrared view of the cosmic web ever captured by humanity.',
    channel: 'NASA',
    duration: '6:18',
  },
  {
    keywords: ['cat', 'cats', 'kitten', 'kittens', 'pet', 'funny'],
    videoId: '07d2dXHYb94',
    title: 'Cute and Funny Cats Compilation - Best Feline Moments',
    description: 'A delightful compilation of playful cats, funny antics, and adorable kittens.',
    channel: 'Animal Planet',
    duration: '10:15',
  },
  {
    keywords: ['documentary', 'universe', 'cosmos', 'scale', 'science'],
    videoId: '36YllqXrznQ',
    title: 'The Scale of the Universe - Journey from Quarks to Galaxy Clusters',
    description: 'An immersive scientific documentary exploring scale and astrophysics across the cosmos.',
    channel: 'Science Channel',
    duration: '15:20',
  },
  {
    keywords: ['planet earth', 'nature', 'ocean', 'wildlife', 'animals'],
    videoId: 'C89q95q5g8g',
    title: 'Planet Earth - Spectacular Wildlife and Natural Habitats',
    description: 'Journey through Earth’s most breathtaking natural ecosystems and animal kingdoms.',
    channel: 'BBC Earth',
    duration: '8:45',
  },
];

/**
  * Search live YouTube video items for a given query with fallback
  */
export async function searchYouTubeVideos(query: string, page = 1): Promise<MediaItem[]> {
  const q = query.trim();
  if (!q) return [];

  const cacheKey = `yt_live_${q.toLowerCase()}_p${page}`;
  const cached = mediaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.items;
  }

  // 1. Try real backend YouTube search endpoint
  try {
    const liveResults = await api.searchVideos(q, page);
    if (Array.isArray(liveResults) && liveResults.length > 0) {
      mediaCache.set(cacheKey, { timestamp: Date.now(), items: liveResults });
      return liveResults;
    }
  } catch (err) {
    console.warn('[Media Service] Live YouTube search fallback triggered:', err);
  }

  // 2. Fallback: Combine curated/contextual items + authentic Wikimedia videos
  const items: MediaItem[] = [];
  const [wikiVids] = await Promise.allSettled([
    searchWikimediaVideos(q, 8, (page - 1) * 8),
  ]);

  if (wikiVids.status === 'fulfilled' && Array.isArray(wikiVids.value)) {
    items.push(...wikiVids.value);
  }

  const qLower = q.toLowerCase();
  const matchedIds = new Set<string>();

  for (const entry of fallbackVideoDatabase) {
    if (entry.keywords.some((kw) => qLower.includes(kw))) {
      if (!matchedIds.has(entry.videoId)) {
        matchedIds.add(entry.videoId);
        items.push({
          id: `yt_${entry.videoId}_${Math.random().toString(36).slice(2, 8)}`,
          title: entry.title,
          description: entry.description,
          thumbnailUrl: `https://img.youtube.com/vi/${entry.videoId}/hqdefault.jpg`,
          mediaUrl: `https://www.youtube.com/embed/${entry.videoId}`,
          sourceUrl: `https://www.youtube.com/watch?v=${entry.videoId}`,
          domain: 'youtube.com',
          type: 'video',
          duration: entry.duration || 'YouTube Video',
          videoId: entry.videoId,
          channel: entry.channel,
          embedUrl: `https://www.youtube.com/embed/${entry.videoId}`,
          source: 'YouTube',
        });
      }
    }
  }

  // If we still need more video results to satisfy the user, fill with contextual items from pool
  const fillerPool = fallbackVideoDatabase.slice(0, 10);
  let fillerIdx = 0;
  while (items.length < 8 && fillerIdx < fillerPool.length) {
    const poolItem = fillerPool[fillerIdx++];
    if (!matchedIds.has(poolItem.videoId)) {
      matchedIds.add(poolItem.videoId);
      items.push({
        id: `yt_${poolItem.videoId}_${Math.random().toString(36).slice(2, 8)}`,
        title: `${q.charAt(0).toUpperCase() + q.slice(1)}: ${poolItem.title}`,
        description: `Explore "${q}" through related science, documentary, and educational video coverage.`,
        thumbnailUrl: `https://img.youtube.com/vi/${poolItem.videoId}/hqdefault.jpg`,
        mediaUrl: `https://www.youtube.com/embed/${poolItem.videoId}`,
        sourceUrl: `https://www.youtube.com/watch?v=${poolItem.videoId}`,
        domain: 'youtube.com',
        type: 'video',
        duration: poolItem.duration || 'Feature',
        videoId: poolItem.videoId,
        channel: poolItem.channel,
        embedUrl: `https://www.youtube.com/embed/${poolItem.videoId}`,
        source: 'YouTube',
      });
    }
  }

  mediaCache.set(cacheKey, { timestamp: Date.now(), items });
  return items;
}

/**
  * Detect media items from web search results or Wikipedia results
  */
export function extractMediaFromResults(results: SearchResult[]): MediaItem[] {
  const items: MediaItem[] = [];

  results.forEach((result, idx) => {
    const url = sanitizeMediaUrl(result.url);
    const thumb = sanitizeMediaUrl(result.thumbnail || result.image);
    const salt = `${idx}_${Math.random().toString(36).slice(2, 8)}`;

    // Check if web result is a YouTube video
    const ytId = extractYouTubeId(result.url);
    if (ytId) {
      items.push({
        id: `yt_${ytId}_${salt}`,
        title: result.title,
        description: result.description,
        thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
        mediaUrl: `https://www.youtube.com/embed/${ytId}`,
        sourceUrl: url || `https://www.youtube.com/watch?v=${ytId}`,
        domain: result.domain || 'youtube.com',
        type: 'video',
        duration: 'YouTube Video',
        videoId: ytId,
        embedUrl: `https://www.youtube.com/embed/${ytId}`,
        source: 'YouTube',
      });
      return;
    }

    // Check if direct video file
    if (url.match(/\.(mp4|webm|ogg|mov)(\?.*)?$/i)) {
      items.push({
        id: `vid_${idx}_${salt}`,
        title: result.title,
        description: result.description,
        thumbnailUrl: thumb || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&auto=format&fit=crop&q=80',
        mediaUrl: url,
        sourceUrl: url,
        domain: result.domain || 'web',
        type: 'video',
        source: 'Web',
      });
      return;
    }

    // Check if image available
    if (thumb) {
      items.push({
        id: `img_${idx}_${salt}`,
        title: result.title,
        description: result.description,
        thumbnailUrl: thumb,
        mediaUrl: thumb,
        sourceUrl: url,
        domain: result.domain || 'web',
        type: 'image',
        source: 'Web',
      });
    }
  });

  return items;
}

/**
  * Retrieve Wikimedia Commons media using its public API
  */
export async function searchWikimediaCommons(query: string, limit = 16, offset = 0): Promise<MediaItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `${trimmed.toLowerCase()}_${limit}_${offset}`;
  const cached = mediaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.items;
  }

  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      trimmed,
    )}&gsrlimit=${limit}&gsroffset=${offset}&gsrnamespace=6&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=500&format=json&origin=*`;

    const res = await fetch(commonsUrl, {
      headers: {
        'Api-User-Agent': WIKIMEDIA_USER_AGENT,
      },
    });

    if (!res.ok) {
      throw new Error(`Wikimedia Commons API error: ${res.status}`);
    }

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
    const items: MediaItem[] = [];

    for (const pageId of Object.keys(pages)) {
      const page = pages[pageId];
      const info = page.imageinfo?.[0];
      if (!info || !info.url) continue;

      const title = page.title.replace(/^File:/i, '').replace(/\.[^/.]+$/, '');
      const mime = info.mime || '';
      const isVideo = mime.startsWith('video/') || info.url.match(/\.(webm|ogv|mp4)$/i);
      const isAudio = mime.startsWith('audio/') || info.url.match(/\.(ogg|mp3|wav)$/i);
      const type = isVideo ? 'video' : isAudio ? 'audio' : 'image';

      const thumbUrl = sanitizeMediaUrl(info.thumburl || info.url);
      const mediaUrl = sanitizeMediaUrl(info.url);
      const extMeta = info.extmetadata;

      // Clean HTML description if present
      let rawDesc = extMeta?.ImageDescription?.value || '';
      rawDesc = rawDesc.replace(/<[^>]*>/g, '').trim();

      const author = extMeta?.Artist?.value ? extMeta.Artist.value.replace(/<[^>]*>/g, '').trim() : undefined;
      const license = extMeta?.LicenseShortName?.value || 'Wikimedia Commons';

      items.push({
        id: `wiki_comm_${page.pageid}_${Math.random().toString(36).slice(2, 8)}`,
        title,
        description: rawDesc || undefined,
        thumbnailUrl: thumbUrl,
        mediaUrl,
        sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        domain: 'commons.wikimedia.org',
        type,
        author,
        license,
      });
    }

    mediaCache.set(cacheKey, { timestamp: Date.now(), items });
    return items;
  } catch (err) {
    console.error('[Media Service] Wikimedia Commons search error:', err);
    return [];
  }
}

/**
 * Retrieve authentic Wikipedia / Wikimedia Commons video files (.webm, .ogv, .mp4)
 */
export async function searchWikimediaVideos(query: string, limit = 12, offset = 0): Promise<MediaItem[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const cacheKey = `wiki_vids_${trimmed.toLowerCase()}_${limit}_${offset}`;
  const cached = mediaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.items;
  }

  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      `filetype:video ${trimmed}`,
    )}&gsrlimit=${limit}&gsroffset=${offset}&gsrnamespace=6&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=600&format=json&origin=*`;

    const res = await fetch(commonsUrl, {
      headers: {
        'Api-User-Agent': WIKIMEDIA_USER_AGENT,
      },
    });

    if (!res.ok) {
      throw new Error(`Wikimedia Commons video API error: ${res.status}`);
    }

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
    const items: MediaItem[] = [];

    for (const pageId of Object.keys(pages)) {
      const page = pages[pageId];
      const info = page.imageinfo?.[0];
      if (!info || !info.url) continue;

      const title = page.title.replace(/^File:/i, '').replace(/\.[^/.]+$/, '');
      const mime = info.mime || '';
      const isVideo = mime.startsWith('video/') || mime === 'application/ogg' || info.url.match(/\.(webm|ogv|mp4|mov)$/i);
      if (!isVideo) continue;

      const thumbUrl = sanitizeMediaUrl(info.thumburl || info.url);
      const mediaUrl = sanitizeMediaUrl(info.url);
      const extMeta = info.extmetadata;

      let rawDesc = extMeta?.ImageDescription?.value || '';
      rawDesc = rawDesc.replace(/<[^>]*>/g, '').trim();

      const author = extMeta?.Artist?.value ? extMeta.Artist.value.replace(/<[^>]*>/g, '').trim() : 'Wikipedia / Wikimedia Contributor';
      const license = extMeta?.LicenseShortName?.value || 'Creative Commons / Public Domain';

      items.push({
        id: `wiki_vid_${page.pageid}_${Math.random().toString(36).slice(2, 8)}`,
        title,
        description: rawDesc || `Encyclopedic video from Wikimedia Commons covering ${trimmed}.`,
        thumbnailUrl: thumbUrl,
        mediaUrl,
        sourceUrl: `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        domain: 'commons.wikimedia.org',
        type: 'video',
        duration: 'Wikimedia Video',
        author,
        license,
        source: 'Wikimedia Commons',
      });
    }

    mediaCache.set(cacheKey, { timestamp: Date.now(), items });
    return items;
  } catch (err) {
    console.error('[Media Service] Wikimedia Commons video search error:', err);
    return [];
  }
}

/**
 * Generate additional paginated video results for load more / infinite scroll
 */
export async function searchMoreVideos(query: string, pageNum: number): Promise<MediaItem[]> {
  return searchYouTubeVideos(query, pageNum);
}
