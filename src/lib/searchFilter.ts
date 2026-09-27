/**
 * Shared Topical Relevance Filtering for Search Results
 * Used by both AI Assistant Web Search (server/routes/search.ts & server/index.ts)
 * and Commander Mode (src/services/commanderOrchestrator.ts).
 */

/**
 * Extracts significant keywords from a search query for topical relevance evaluation,
 * stripping common stop words.
 */
export function extractSignificantQueryWords(query: string): string[] {
  if (!query || typeof query !== 'string') return [];
  const stopWords = new Set([
    'the', 'is', 'what', 'whats', "what's", 'latest', 'update', 'updates', 'recent',
    'recently', 'newest', 'new', 'news', 'current', 'currently', 'a', 'an', 'and',
    'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'about', 'by', 'from', 'how',
    'why', 'who', 'when', 'where', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'can', 'could', 'should', 'would',
    'will', 'it', 'its', 'this', 'that', 'these', 'those', 'tell', 'show', 'give',
    'me', 'my', 'your', 'which', 'there', 'their', 'they', 'our', 'us', 'today', 'now'
  ]);

  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !stopWords.has(w));
}

/**
 * Checks if a search result item mentions any significant keyword from the search query.
 */
export function isResultTopicallyRelevant(
  item: { title?: string; name?: string; description?: string; snippet?: string; summary?: string; content?: string },
  queryWords: string[],
): boolean {
  if (!queryWords || queryWords.length === 0) return true;
  const title = String(item.title ?? item.name ?? '').toLowerCase();
  const snippet = String(item.description ?? item.snippet ?? item.summary ?? item.content ?? '').toLowerCase();
  const text = `${title} ${snippet}`;
  return queryWords.some((w) => text.includes(w));
}

/**
 * Prunes/demotes search results that have no query-relevant words so generic or unrelated
 * results (e.g. generic year overviews or unrelated regulatory pages) don't pollute agent grounding.
 */
export function applyTopicalRelevanceFilter<T extends { title?: string; name?: string; description?: string; snippet?: string; summary?: string; content?: string }>(
  results: T[],
  query: string,
): T[] {
  const queryWords = extractSignificantQueryWords(query);
  if (queryWords.length === 0 || results.length === 0) {
    return results;
  }

  const relevant: T[] = [];
  const lowRelevance: T[] = [];

  for (const item of results) {
    if (isResultTopicallyRelevant(item, queryWords)) {
      relevant.push(item);
    } else {
      lowRelevance.push(item);
    }
  }

  if (relevant.length >= 3) {
    return relevant;
  }

  return [...relevant, ...lowRelevance];
}
