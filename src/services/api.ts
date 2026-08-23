import type {
  SearchResult,
  WeatherData,
  GeocodeResult,
  ConfigStatus,
  WallpaperPhoto,
  TelegramAutomations,
  TelegramBotCommand,
  TelegramActivityItem,
  AISource,
  AnswerEngineResult,
  WikipediaSearchResult,
  WikipediaArticle,
  AIProviderConfig,
  NexusDevice,
  DevicePermissions,
  DeviceStatus,
  AndroidDeviceInfo,
  SmartTVInfo,
  TVControlAction,
  DiscoveredNetworkDevice,
  NetworkInfo,
  NetworkScanResult,
} from '@/types';
import { storage } from '@/lib/storage';
import { searchWikipedia, getWikipediaSummary, wikipediaToSearchResult } from './wikipedia';

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
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      console.warn(`[API] Error response:`, body);
      let errorMsg = 'Request failed. Please try again.';
      if (typeof body.error === 'string') {
        errorMsg = body.error;
      } else if (typeof body.error === 'object' && body.error !== null) {
        const nestedErr = body.error as { message?: string };
        errorMsg = nestedErr.message || JSON.stringify(body.error);
      } else if (typeof body.message === 'string') {
        errorMsg = body.message;
      }
      throw new Error(errorMsg);
    }
    console.log(`[API] Success response for ${url}:`, body);
    return ((body as { data?: T }).data ?? (body as unknown as T)) as T;
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

  smartAnswer(
    query: string,
    customSources?: Array<{ title: string; url: string; description: string; domain?: string }>,
    customProvider?: AIProviderConfig | null,
  ): Promise<AnswerEngineResult> {
    const provider = customProvider !== undefined ? customProvider : storage.getActiveAIProvider();
    return call<AnswerEngineResult>('/api/ai/answer', {
      method: 'POST',
      body: JSON.stringify({
        query,
        customSources,
        providerConfig: provider || undefined,
      }),
    });
  },

  aiChat(
    message: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
    memory = '',
    customProvider?: AIProviderConfig | null,
  ): Promise<{
    answer: string;
    model: string;
    tool?: 'none' | 'search' | 'weather';
    sources?: AISource[];
    weather?: unknown;
  }> {
    const provider = customProvider !== undefined ? customProvider : storage.getActiveAIProvider();
    return call<{
      answer: string;
      model: string;
      tool?: 'none' | 'search' | 'weather';
      sources?: AISource[];
      weather?: unknown;
    }>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        history: history.slice(-4),
        memory: memory.slice(-300),
        providerConfig: provider || undefined,
      }),
    });
  },

  testAIProviderConnection(payload: {
    url: string;
    model: string;
    key: string;
  }): Promise<{ ok: boolean; model?: string; status?: number; error?: string }> {
    return call<{ ok: boolean; model?: string; status?: number; error?: string }>(
      '/api/ai/provider/test',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
  },

  searchWikipedia(query: string, limit = 10): Promise<WikipediaSearchResult[]> {
    return searchWikipedia(query, limit);
  },

  getWikipediaSummary(titleOrQuery: string): Promise<WikipediaArticle | null> {
    return getWikipediaSummary(titleOrQuery);
  },

  wikipediaToSearchResult(item: WikipediaSearchResult | WikipediaArticle): SearchResult {
    return wikipediaToSearchResult(item);
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

  // NEXUS Devices API
  getDevices(): Promise<{
    devices: NexusDevice[];
    overview: { online: number; warning: number; offline: number; total: number };
  }> {
    return call<{
      devices: NexusDevice[];
      overview: { online: number; warning: number; offline: number; total: number };
    }>('/api/devices');
  },

  getDevice(id: string): Promise<NexusDevice> {
    return call<NexusDevice>(`/api/devices/${id}`);
  },

  pairDevice(
    pairingCode: string,
    name?: string,
    sampleData?: Partial<AndroidDeviceInfo>,
  ): Promise<{ success: boolean; device: NexusDevice }> {
    return call<{ success: boolean; device: NexusDevice }>('/api/devices/pair', {
      method: 'POST',
      body: JSON.stringify({ pairingCode, name, sampleData }),
    });
  },

  disconnectDevice(id: string): Promise<{ success: boolean }> {
    return call<{ success: boolean }>(`/api/devices/${id}/disconnect`, {
      method: 'POST',
    });
  },

  getDeviceStatus(id: string): Promise<{
    status: DeviceStatus;
    lastSeen: string;
    device: NexusDevice;
  }> {
    return call<{
      status: DeviceStatus;
      lastSeen: string;
      device: NexusDevice;
    }>(`/api/devices/${id}/status`);
  },

  updateDevicePermissions(
    id: string,
    permissions: DevicePermissions,
  ): Promise<{ success: boolean; permissions: DevicePermissions }> {
    return call<{ success: boolean; permissions: DevicePermissions }>(
      `/api/devices/${id}/permissions`,
      {
        method: 'PUT',
        body: JSON.stringify({ permissions }),
      },
    );
  },

  generatePairingCode(): Promise<{ pairingCode: string; expiresInSeconds: number }> {
    return call<{ pairingCode: string; expiresInSeconds: number }>(
      '/api/devices/pair-code/generate',
      {
        method: 'POST',
      },
    );
  },

  reportAgentTelemetry(payload: Record<string, unknown>): Promise<{ success: boolean }> {
    return call<{ success: boolean }>('/api/devices/agent/report', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Smart TV Integration API
  testTVConnection(
    ipAddress: string,
    port: number,
    method: string,
  ): Promise<{ success: boolean; reachable: boolean; error?: string; latencyMs?: number; model?: string }> {
    return call<{ success: boolean; reachable: boolean; error?: string; latencyMs?: number; model?: string }>(
      '/api/devices/tv/test',
      {
        method: 'POST',
        body: JSON.stringify({ ipAddress, port, method }),
      },
    );
  },

  connectTV(data: {
    name?: string;
    ipAddress: string;
    port: number;
    method: string;
    model?: string;
  }): Promise<{ success: boolean; device: NexusDevice }> {
    return call<{ success: boolean; device: NexusDevice }>('/api/devices/tv/connect', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  controlTV(
    action: TVControlAction,
    deviceId?: string,
    value?: unknown,
  ): Promise<{ success: boolean; action: TVControlAction; tvState: SmartTVInfo; message?: string }> {
    return call<{ success: boolean; action: TVControlAction; tvState: SmartTVInfo; message?: string }>(
      '/api/devices/tv/control',
      {
        method: 'POST',
        body: JSON.stringify({ action, deviceId, value }),
      },
    );
  },

  refreshTV(deviceId?: string): Promise<{ success: boolean; reachable: boolean; device: NexusDevice; message?: string }> {
    return call<{ success: boolean; reachable: boolean; device: NexusDevice; message?: string }>(
      '/api/devices/tv/refresh',
      {
        method: 'POST',
        body: JSON.stringify({ deviceId }),
      },
    );
  },

  getTVStatus(
    deviceId?: string,
  ): Promise<{ connected: boolean; device?: NexusDevice; tv?: SmartTVInfo; message?: string }> {
    const query = deviceId ? `?deviceId=${encodeURIComponent(deviceId)}` : '';
    return call<{ connected: boolean; device?: NexusDevice; tv?: SmartTVInfo; message?: string }>(
      `/api/devices/tv/status${query}`,
    );
  },

  // Real Network Scanner API
  getNetworkInfo(): Promise<NetworkInfo> {
    return call<NetworkInfo>('/api/devices/network/info');
  },

  getDiscoveredDevices(): Promise<{ devices: DiscoveredNetworkDevice[]; count: number }> {
    return call<{ devices: DiscoveredNetworkDevice[]; count: number }>('/api/devices/network/discovered');
  },

  scanNetwork(params?: { subnet?: string; localIp?: string }): Promise<NetworkScanResult> {
    return call<NetworkScanResult>('/api/devices/network/scan', {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
  },

  reportScanResults(data: {
    devices: DiscoveredNetworkDevice[];
    scannedSubnet?: string;
  }): Promise<{ success: boolean; count: number; devices: DiscoveredNetworkDevice[] }> {
    return call<{ success: boolean; count: number; devices: DiscoveredNetworkDevice[] }>(
      '/api/devices/network/report-scan',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    );
  },

  pingNetworkDevice(
    ip: string,
    port?: number,
  ): Promise<{ ip: string; port: number; reachable: boolean; latencyMs: number; error?: string }> {
    return call<{ ip: string; port: number; reachable: boolean; latencyMs: number; error?: string }>(
      '/api/devices/network/ping',
      {
        method: 'POST',
        body: JSON.stringify({ ip, port }),
      },
    );
  },
};

