import type {
  SearchResult,
  WeatherData,
  GeocodeResult,
  ConfigStatus,
  WallpaperPhoto,
  TelegramAutomations,
  TelegramBotCommand,
  TelegramActivityItem,
} from '@/types';

function getBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (!envUrl) return '';

  // If envUrl points to legacy localhost/port 8787 or standard dev ports, always use relative path
  if (
    envUrl.includes('localhost') ||
    envUrl.includes('127.0.0.1') ||
    envUrl.includes('0.0.0.0') ||
    envUrl.includes(':8787') ||
    envUrl.includes(':3000') ||
    envUrl.includes(':5173')
  ) {
    return '';
  }

  // Remove trailing slashes
  return envUrl.replace(/\/+$/, '');
}

const BASE = getBaseUrl();

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const url = BASE + path;
  console.log(`[API] Fetching ${init?.method ?? 'GET'} ${url}`, init?.body ? JSON.parse(init.body as string) : '');
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
    console.log(`[API] Response status: ${res.status} for ${url}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`[API] Error response:`, body);
      throw new Error(
        (body as { error?: string }).error ?? 'Request failed. Please try again.',
      );
    }
    console.log(`[API] Success response for ${url}:`, body);
    return (body as { data?: T }).data ?? (body as T);
  } catch (err) {
    console.error(`[API] Request failed for ${url}:`, err);
    throw err;
  }
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

  telegramConnect(
    token: string,
    chatId?: string,
    allowedUsers?: string[],
    automations?: Partial<TelegramAutomations>,
  ): Promise<{
    botInfo: { id: number; username: string; first_name: string };
    allowedUsers: string[];
    automations?: TelegramAutomations;
  }> {
    return call<{
      botInfo: { id: number; username: string; first_name: string };
      allowedUsers: string[];
      automations?: TelegramAutomations;
    }>('/api/telegram/connect', {
      method: 'POST',
      body: JSON.stringify({ token, chatId, allowedUsers, automations }),
    });
  },

  telegramStatus(): Promise<{
    connected: boolean;
    botInfo?: { id: number; username: string; first_name: string };
    chatId?: string;
    allowedUsers?: string[];
    automations?: TelegramAutomations;
  }> {
    return call<{
      connected: boolean;
      botInfo?: { id: number; username: string; first_name: string };
      chatId?: string;
      allowedUsers?: string[];
      automations?: TelegramAutomations;
    }>('/api/telegram/status');
  },

  telegramUpdateAllowedUsers(allowedUsers: string[]): Promise<{ success: boolean; allowedUsers: string[] }> {
    return call<{ success: boolean; allowedUsers: string[] }>('/api/telegram/allowed-users', {
      method: 'POST',
      body: JSON.stringify({ allowedUsers }),
    });
  },

  telegramGetAutomations(): Promise<{ automations: TelegramAutomations; connected: boolean }> {
    return call<{ automations: TelegramAutomations; connected: boolean }>('/api/telegram/automations');
  },

  telegramUpdateAutomations(automations: Partial<TelegramAutomations>): Promise<{
    success: boolean;
    automations: TelegramAutomations;
  }> {
    return call<{ success: boolean; automations: TelegramAutomations }>('/api/telegram/automations', {
      method: 'POST',
      body: JSON.stringify({ automations }),
    });
  },

  telegramTestAlert(type: 'weather' | 'rain' | 'iss' | 'quick_replies', city?: string): Promise<{
    success: boolean;
    message: string;
  }> {
    return call<{ success: boolean; message: string }>('/api/telegram/test-alert', {
      method: 'POST',
      body: JSON.stringify({ type, city }),
    });
  },

  telegramDisconnect(): Promise<{ success: boolean }> {
    return call<{ success: boolean }>('/api/telegram/disconnect', {
      method: 'POST',
    });
  },

  telegramGetActivity(): Promise<{ activities: TelegramActivityItem[] }> {
    return call<{ activities: TelegramActivityItem[] }>('/api/telegram/activity');
  },

  telegramClearActivity(): Promise<{ success: boolean }> {
    return call<{ success: boolean }>('/api/telegram/activity/clear', {
      method: 'POST',
    });
  },

  telegramGetCommands(): Promise<{ commands: TelegramBotCommand[]; registered: boolean }> {
    return call<{ commands: TelegramBotCommand[]; registered: boolean }>('/api/telegram/commands');
  },

  telegramSyncCommands(): Promise<{ success: boolean; commands: TelegramBotCommand[] }> {
    return call<{ success: boolean; commands: TelegramBotCommand[] }>('/api/telegram/commands/sync', {
      method: 'POST',
    });
  },

  telegramMessage(
    message: string,
    senderId?: string,
    senderUsername?: string,
  ): Promise<{ answer: string; tool?: string; sources?: unknown; weather?: unknown }> {
    return call<{ answer: string; tool?: string; sources?: unknown; weather?: unknown }>(
      '/api/telegram/message',
      {
        method: 'POST',
        body: JSON.stringify({ message, senderId, senderUsername }),
      },
    );
  },
};
