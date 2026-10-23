import { useEffect, useState } from 'react';
import type { Settings, ThemeMode } from '@/types';
import { storage } from '@/lib/storage';

const SETTINGS_CHANGED_EVENT = 'nexus-settings-changed';

export function resolveEffectiveTheme(theme: ThemeMode | undefined): string {
  if (!theme || theme === 'system') {
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  }
  return theme;
}

export function applyDocumentTheme(theme: ThemeMode | undefined) {
  if (typeof document === 'undefined') return;
  const effective = resolveEffectiveTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = effective;
  root.style.colorScheme = effective === 'light' ? 'light' : 'dark';
}

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(() => storage.getSettings());

  const update = (patch: Partial<Settings>) => {
    const current = storage.getSettings();
    const next = { ...current, ...patch };
    setSettings(next);
    storage.saveSettings(next);
    applyDocumentTheme(next.theme);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent<Settings>(SETTINGS_CHANGED_EVENT, { detail: next }));
    }
  };

  useEffect(() => {
    const handleSync = (event: Event) => {
      const custom = event as CustomEvent<Settings>;
      if (custom.detail) {
        setSettings(custom.detail);
      } else {
        setSettings(storage.getSettings());
      }
    };
    window.addEventListener(SETTINGS_CHANGED_EVENT, handleSync);
    return () => window.removeEventListener(SETTINGS_CHANGED_EVENT, handleSync);
  }, []);

  useEffect(() => {
    applyDocumentTheme(settings.theme);
  }, [settings.theme]);

  useEffect(() => {
    const layer = document.getElementById('nexus-wallpaper');
    if (!layer) return;
    if (settings.wallpaper) {
      layer.style.backgroundImage = `url("${settings.wallpaper.url}")`;
      layer.dataset.active = 'true';
    } else {
      layer.style.backgroundImage = '';
      delete layer.dataset.active;
    }
  }, [settings.wallpaper]);

  return [settings, update];
}

