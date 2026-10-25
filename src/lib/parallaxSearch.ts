import { storage } from '@/lib/storage';
import { api } from '@/services/api';
import type { SearchResult } from '@/types';

export function getParallaxSearchOptions():
  | { customSearchApiKey: string; customSearchApiUrl: string }
  | undefined {
  const mode = storage.getParallaxWebSearchMode();
  const url = storage.getParallaxWebSearchUrl().trim();
  const key = storage.getParallaxWebSearchKey().trim();

  if (mode === 'custom' && url.length > 0 && key.length > 0) {
    return {
      customSearchApiKey: key,
      customSearchApiUrl: url,
    };
  }
  return undefined;
}

export async function parallaxSearch(
  query: string,
  category = 'ALL',
  page = 1,
  maxResults = 10,
): Promise<
  SearchResult[] & {
    searchSource?: string;
    fallbackOccurred?: boolean;
    fallbackReason?: string;
  }
> {
  const customOptions = getParallaxSearchOptions();

  if (customOptions) {
    try {
      const res = await api.search(query, category, page, maxResults, customOptions);
      if (Array.isArray(res) && res.length > 0) {
        return res;
      }
    } catch {
      // Fall through to single retry with Default search
    }
    return api.search(query, category, page, maxResults);
  }

  return api.search(query, category, page, maxResults);
}
