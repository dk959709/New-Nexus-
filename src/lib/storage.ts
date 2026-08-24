import type { SavedItem, Settings, AIProvidersState, AIProviderConfig, KeyHealthStatus } from '@/types';

const KEYS = {
  searches: 'nexus-searches',
  saved: 'nexus-saved',
  settings: 'nexus-settings',
  locations: 'nexus-locations',
  aiProviders: 'nexus-ai-providers',
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage may be full or unavailable
  }
}

export const storage = {
  getSearches(): string[] {
    return read<string[]>(KEYS.searches, []);
  },
  saveSearch(query: string): string[] {
    const existing = this.getSearches().filter((s) => s !== query);
    const updated = [query, ...existing].slice(0, 20);
    write(KEYS.searches, updated);
    return updated;
  },
  clearSearches(): void {
    write(KEYS.searches, []);
  },

  getSaved(): SavedItem[] {
    return read<SavedItem[]>(KEYS.saved, []);
  },
  saveItem(item: SavedItem): SavedItem[] {
    const existing = this.getSaved().filter((s) => s.id !== item.id);
    const updated = [item, ...existing];
    write(KEYS.saved, updated);
    return updated;
  },
  toggleSaved(item: SavedItem): SavedItem[] {
    const existing = this.getSaved();
    const found = existing.some((s) => s.id === item.id);
    const updated = found
      ? existing.filter((s) => s.id !== item.id)
      : [item, ...existing];
    write(KEYS.saved, updated);
    return updated;
  },
  removeSaved(id: string): SavedItem[] {
    const updated = this.getSaved().filter((s) => s.id !== id);
    write(KEYS.saved, updated);
    return updated;
  },
  clearSaved(): void {
    write(KEYS.saved, []);
  },

  getSettings(): Settings {
    return read<Settings>(KEYS.settings, {
      theme: 'dark',
      temperature: 'celsius',
      wind: 'kmh',
      animations: 'full',
      wallpaper: null,
      sound: true,
    });
  },
  saveSettings(settings: Settings): void {
    write(KEYS.settings, settings);
  },

  getAIProvidersState(): AIProvidersState {
    const defaultState: AIProvidersState = {
      activeProviderId: 'existing',
      providers: [],
    };
    return read<AIProvidersState>(KEYS.aiProviders, defaultState);
  },

  saveAIProvidersState(state: AIProvidersState): void {
    write(KEYS.aiProviders, state);
  },

  getActiveAIProvider(): AIProviderConfig | null {
    const state = this.getAIProvidersState();
    if (!state.activeProviderId || state.activeProviderId === 'existing') {
      return null; // Signals to use server's existing default AI configuration
    }
    return state.providers.find((p) => p.id === state.activeProviderId) || null;
  },

  updateKeyHealth(providerId: string, keyId: string, status: KeyHealthStatus, errorMsg?: string): void {
    const state = this.getAIProvidersState();
    const providerIndex = state.providers.findIndex((p) => p.id === providerId);
    if (providerIndex === -1) return;

    const provider = state.providers[providerIndex];
    const updatedKeys = provider.keys.map((k) => {
      if (k.id === keyId) {
        return {
          ...k,
          status,
          lastTested: Date.now(),
          lastError: errorMsg,
          cooldownUntil: status === 'cooldown' ? Date.now() + 60000 : undefined,
        };
      }
      return k;
    });

    state.providers[providerIndex] = { ...provider, keys: updatedKeys };
    this.saveAIProvidersState(state);
  },

  getLocations(): SavedItem[] {
    return read<SavedItem[]>(KEYS.locations, []);
  },
  saveLocation(item: SavedItem): SavedItem[] {
    const existing = this.getLocations().filter((s) => s.id !== item.id);
    const updated = [item, ...existing].slice(0, 10);
    write(KEYS.locations, updated);
    return updated;
  },
  removeLocation(id: string): SavedItem[] {
    const updated = this.getLocations().filter((s) => s.id !== id);
    write(KEYS.locations, updated);
    return updated;
  },

  clearAll(): void {
    localStorage.removeItem(KEYS.searches);
    localStorage.removeItem(KEYS.saved);
    localStorage.removeItem(KEYS.locations);
  },
};
