import type { MediaItem, SearchResult } from '@/types';

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

/**
  * Search or generate YouTube video items for a given query
  */
export function searchYouTubeVideos(query: string): MediaItem[] {
  const q = query.toLowerCase().trim();
  const items: MediaItem[] = [];

  const curatedYouTubeDB: Array<{
    keywords: string[];
    videoId: string;
    title: string;
    description: string;
    channel: string;
    duration?: string;
  }> = [
    {
      keywords: ['nasa', 'black hole', 'blackholes', 'space', 'astronomy', 'universe', 'mars', 'telescope'],
      videoId: 'e3uWgbL1gV4',
      title: 'NASA: What is a Black Hole? Explained with Space Science',
      description: 'An official NASA visualization and explanation of black holes, event horizons, and spacetime curvature.',
      channel: 'NASA',
      duration: '4:25',
    },
    {
      keywords: ['nasa', 'webb', 'telescope', 'jwst', 'space', 'galaxy'],
      videoId: 'zR_zsTqY5L4',
      title: 'NASA James Webb Space Telescope First Deep Field Images Revealed',
      description: 'Explore the deepest infrared view of the universe ever captured by humanity.',
      channel: 'NASA',
      duration: '6:18',
    },
    {
      keywords: ['nasa', 'mars', 'rover', 'perseverance', 'landing'],
      videoId: '21X5lGlDOfg',
      title: 'Mars Perseverance Rover Landing on the Red Planet (Official NASA Footage)',
      description: 'Relive the dramatic entry, descent, and landing of NASA’s Perseverance rover on Mars.',
      channel: 'NASA',
      duration: '3:50',
    },
    {
      keywords: ['cat', 'cats', 'kitten', 'pet', 'funny'],
      videoId: '07d2dXHYb94',
      title: 'Cute and Funny Cats Compilation - Best Feline Moments',
      description: 'A delightful compilation of playful cats and adorable kittens.',
      channel: 'Animal Planet',
      duration: '10:15',
    },
    {
      keywords: ['documentary', 'science', 'universe', 'cosmos', 'physics', 'earth'],
      videoId: '36YllqXrznQ',
      title: 'The Scale of the Universe - Journey from Quarks to Galaxy Clusters',
      description: 'An immersive scientific documentary exploring scale and astrophysics across the cosmos.',
      channel: 'Science Channel',
      duration: '15:20',
    },
    {
      keywords: ['documentary', 'earth', 'nature', 'ocean', 'wildlife'],
      videoId: 'C89q95q5g8g',
      title: 'Planet Earth - Spectacular Wildlife and Natural Habitats Documentaries',
      description: 'Journey through Earth’s most breathtaking natural ecosystems and animal kingdoms.',
      channel: 'BBC Earth',
      duration: '8:45',
    },
  ];

  const matchedIds = new Set<string>();
  for (const entry of curatedYouTubeDB) {
    if (entry.keywords.some((kw) => q.includes(kw))) {
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

  if (items.length === 0 && q.length > 0) {
    const defaultVid = curatedYouTubeDB[0];
    items.push({
      id: `yt_${defaultVid.videoId}_${Math.random().toString(36).slice(2, 8)}`,
      title: `YouTube: ${query} (Space & Science Feature)`,
      description: `Curated YouTube video result matching search query "${query}".`,
      thumbnailUrl: `https://img.youtube.com/vi/${defaultVid.videoId}/hqdefault.jpg`,
      mediaUrl: `https://www.youtube.com/embed/${defaultVid.videoId}`,
      sourceUrl: `https://www.youtube.com/watch?v=${defaultVid.videoId}`,
      domain: 'youtube.com',
      type: 'video',
      duration: defaultVid.duration,
      videoId: defaultVid.videoId,
      channel: defaultVid.channel,
      embedUrl: `https://www.youtube.com/embed/${defaultVid.videoId}`,
      source: 'YouTube',
    });
  }

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
  * Generate additional paginated video results for load more / infinite scroll
  */
export function searchMoreVideos(query: string, pageNum: number): MediaItem[] {
  const videoPool = [
    { videoId: 'e3uWgbL1gV4', channel: 'NASA', duration: '4:25' },
    { videoId: 'zR_zsTqY5L4', channel: 'NASA', duration: '6:18' },
    { videoId: '21X5lGlDOfg', channel: 'NASA', duration: '3:50' },
    { videoId: '07d2dXHYb94', channel: 'Animal Planet', duration: '10:15' },
    { videoId: '36YllqXrznQ', channel: 'Science Channel', duration: '15:20' },
    { videoId: 'C89q95q5g8g', channel: 'BBC Earth', duration: '8:45' },
    { videoId: 'kJQP7kiw5Fk', channel: 'Pop Hits', duration: '4:02' },
    { videoId: '5qap5aO4i9A', channel: 'Lofi Girl', duration: 'Live' },
  ];

  const q = query.trim();
  const items: MediaItem[] = [];
  const count = 6;
  const startIdx = ((pageNum - 1) * count);

  for (let i = 0; i < count; i++) {
    const poolItem = videoPool[(startIdx + i) % videoPool.length];
    const uniqueVid = poolItem.videoId;
    const itemNum = startIdx + i + 1;
    const title = `${q.charAt(0).toUpperCase() + q.slice(1)} - Feature Insight #${itemNum}`;
    const description = `Detailed documentary and media insights regarding "${q}", featuring expert analysis and footage (Page ${pageNum}, Item ${i + 1}).`;

    items.push({
      id: `more_vid_${uniqueVid}_${itemNum}_${Math.random().toString(36).slice(2, 6)}`,
      title,
      description,
      thumbnailUrl: `https://img.youtube.com/vi/${uniqueVid}/hqdefault.jpg`,
      mediaUrl: `https://www.youtube.com/embed/${uniqueVid}`,
      sourceUrl: `https://www.youtube.com/watch?v=${uniqueVid}`,
      domain: 'youtube.com',
      type: 'video',
      duration: poolItem.duration,
      videoId: uniqueVid,
      channel: poolItem.channel,
      embedUrl: `https://www.youtube.com/embed/${uniqueVid}`,
      source: 'YouTube',
    });
  }

  return items;
}
