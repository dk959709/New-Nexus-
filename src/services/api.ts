import type {
  SearchResult,
  WeatherData,
  GeocodeResult,
  ConfigStatus,
  WallpaperPhoto,
} from '@/types';

const BASE = import.meta.env.VITE_API_URL ?? '';

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (body as { error?: string }).error ?? 'Request failed. Please try again.',
    );
  }
  return (body as { data?: T }).data ?? (body as T);
}

export const api = {
  search(query: string, category?: string, page?: number): Promise<SearchResult[]> {
    return call<SearchResult[]>('/api/search', {
      method: 'POST',
      body: JSON.stringify({ query, category, page }),
    });
  },

  weather(queryString: string): Promise<WeatherData> {
    return call<WeatherData>('/api/weather?' + queryString);
  },

  geocode(city: string): Promise<GeocodeResult[]> {
    return call<GeocodeResult[]>(
      '/api/weather/geocode?city=' + encodeURIComponent(city),
    );
  },

  news(): Promise<SearchResult[]> {
    return call<SearchResult[]>('/api/news');
  },

  configStatus(): Promise<ConfigStatus> {
    return call<ConfigStatus>('/api/config/status');
  },

  health(): Promise<{ status: string }> {
    return call<{ status: string }>('/api/health');
  },

  aiChat(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    memory = '',
  ): Promise<{
    answer: string;
    model: string;
    tool?: 'none' | 'search' | 'weather';
    sources?: Array<{
      title: string;
      url: string;
      domain?: string;
      description?: string;
      date?: string;
    }>;
  }> {
    return call<{
      answer: string;
      model: string;
      tool?: 'none' | 'search' | 'weather';
      sources?: Array<{
        title: string;
        url: string;
        domain?: string;
        description?: string;
        date?: string;
      }>;
    }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        history: history.slice(-8),
        memory: memory.slice(-1200),
      }),
    });
  },

  wallpapers(query: string, page?: number): Promise<WallpaperPhoto[]> {
    const qs = `query=${encodeURIComponent(query)}${page ? `&page=${page}` : ''}`;

    return call<WallpaperPhoto[]>(`/api/wallpapers?${qs}`).then((photos) =>
      photos.map((photo) => ({
        ...photo,
        landscape: new URL(photo.landscape, BASE || window.location.origin).toString(),
        large2x: new URL(photo.large2x, BASE || window.location.origin).toString(),
        original: new URL(photo.original, BASE || window.location.origin).toString(),
      })),
    );
  },
};
