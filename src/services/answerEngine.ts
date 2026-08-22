import { api } from './api';
import { getWikipediaSummary } from './wikipedia';
import type { AnswerEngineResult, AISource, SearchResult, SourceCategory, ConfidenceLevel } from '@/types';

// In-memory cache on the client
const clientCache = new Map<string, { result: AnswerEngineResult; timestamp: number }>();
const CLIENT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function classifyQueryCategories(query: string): SourceCategory[] {
  const q = query.toLowerCase().trim();
  const categories = new Set<SourceCategory>();

  if (/\b(weather|temperature|forecast|rain|snow|wind|humidity|climate|degrees)\b/.test(q)) {
    categories.add('weather');
  }

  if (
    /\b(space|black hole|black holes|nasa|astronaut|mars|moon|planet|planets|galaxy|galaxies|universe|telescope|iss|star|stars|solar system|orbit|asteroid|supernova|nebula|cosmos|astronomy)\b/.test(
      q,
    )
  ) {
    categories.add('nasa');
    categories.add('wikipedia');
  }

  if (/\b(news|latest|today|breaking|recent|headlines|update|updates|happening)\b/.test(q)) {
    categories.add('news');
    categories.add('web');
  }

  if (
    /\b(who is|who was|what is|what was|what are|define|definition|explain|how does|why is|why do|history of|biography|concept|theory|photosynthesis|einstein|newton|quantum|dna|evolution|biology|physics|chemistry|wikipedia|wiki)\b/.test(
      q,
    )
  ) {
    categories.add('wikipedia');
    categories.add('web');
  }

  if (categories.has('weather') && categories.size === 1) {
    return ['weather'];
  }

  if (q.includes('space') && q.includes('news')) {
    categories.add('news');
    categories.add('nasa');
    categories.add('web');
  }

  if (categories.size === 0) {
    categories.add('wikipedia');
    categories.add('web');
  }

  return Array.from(categories);
}

export async function askSmartAnswerEngine(
  query: string,
  customSources?: SearchResult[],
): Promise<AnswerEngineResult> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('Please enter a question or topic.');
  }

  const cacheKey = customSources ? `custom:${trimmed}:${customSources.length}` : trimmed.toLowerCase();

  const cached = clientCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CLIENT_CACHE_TTL) {
    return { ...cached.result, fromCache: true };
  }

  try {
    const formattedCustom = customSources?.map((s) => ({
      title: s.title,
      url: s.url,
      description: s.description,
      domain: s.domain,
    }));

    const result = await api.smartAnswer(trimmed, formattedCustom);
    clientCache.set(cacheKey, { result, timestamp: Date.now() });
    return result;
  } catch (error) {
    console.warn('[AnswerEngine] Server endpoint error, attempting client-side fallback:', error);

    // Client-side fallback: Try Wikipedia summary
    try {
      const wiki = await getWikipediaSummary(trimmed);
      if (wiki && wiki.extract) {
        const sources: AISource[] = [
          {
            title: wiki.title,
            url: wiki.url,
            domain: 'wikipedia.org',
            description: wiki.extract,
            thumbnail: wiki.thumbnail,
            image: wiki.thumbnail,
            type: 'wikipedia',
          },
        ];

        const fallbackResult: AnswerEngineResult = {
          query: trimmed,
          answer: wiki.extract,
          confidence: 'limited' as ConfidenceLevel,
          confidenceReason: 'Retrieved directly from Wikipedia knowledge summary.',
          sources,
          followUps: [
            `What is the history of ${wiki.title}?`,
            `How does ${wiki.title} work?`,
            `What are related concepts to ${wiki.title}?`,
          ],
          selectedCategories: ['wikipedia'],
          model: 'wikipedia-client',
        };

        clientCache.set(cacheKey, { result: fallbackResult, timestamp: Date.now() });
        return fallbackResult;
      }
    } catch {
      // ignore
    }

    throw error;
  }
}
