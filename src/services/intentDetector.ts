/**
 * NEXUS Query Intent Detection
 * 
 * Performs deterministic, lightweight classification of user queries using
 * local application code without calling OpenRouter or DeepSeek.
 */

export interface QueryIntent {
  query: string;
  videoIntent: boolean;
  imageIntent: boolean;
  knowledgeIntent: boolean;
  webIntent: boolean;
  isVideo?: boolean;
  isImage?: boolean;
  isKnowledge?: boolean;
  primaryCategory: 'video' | 'image' | 'knowledge' | 'web';
  cleanTopic: string;
}

const VIDEO_REGEX = /\b(video|videos|watch|clip|clips|footage|trailer|gameplay|stream|movie|animation|short|shorts|play|yt|youtube)\b/i;
const IMAGE_REGEX = /\b(image|images|photo|photos|picture|pictures|pic|pics|wallpaper|wallpapers|art|illustration|diagram|gallery|render|visual|photo gallery|portrait)\b/i;
const KNOWLEDGE_REGEX = /\b(who is|who was|what is|what was|what are|define|definition|explain|how does|why is|why do|history of|biography|concept|theory|einstein|albert einstein|newton|quantum|dna|evolution|physics|chemistry|wikipedia|wiki|black hole|nasa|space|mars|universe|galaxy)\b/i;
const NEWS_REGEX = /\b(news|latest|today|breaking|recent|headlines|update|updates)\b/i;

export function detectQueryIntent(query: string): QueryIntent {
  const trimmed = query.trim();
  const q = trimmed.toLowerCase();

  const hasVideo = VIDEO_REGEX.test(q);
  const hasImage = IMAGE_REGEX.test(q);
  const hasKnowledge = KNOWLEDGE_REGEX.test(q);
  const hasNews = NEWS_REGEX.test(q);

  let primaryCategory: 'video' | 'image' | 'knowledge' | 'web' = 'web';
  if (hasVideo) {
    primaryCategory = 'video';
  } else if (hasImage) {
    primaryCategory = 'image';
  } else if (hasKnowledge) {
    primaryCategory = 'knowledge';
  } else if (hasNews) {
    primaryCategory = 'web';
  }

  // Clean stripped topic for media searches
  let cleanTopic = trimmed
    .replace(new RegExp(VIDEO_REGEX.source, 'gi'), '')
    .replace(new RegExp(IMAGE_REGEX.source, 'gi'), '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleanTopic) {
    cleanTopic = trimmed;
  }

  return {
    query: trimmed,
    videoIntent: hasVideo,
    imageIntent: hasImage,
    knowledgeIntent: hasKnowledge,
    webIntent: true,
    isVideo: hasVideo,
    isImage: hasImage,
    isKnowledge: hasKnowledge,
    primaryCategory,
    cleanTopic,
  };
}
