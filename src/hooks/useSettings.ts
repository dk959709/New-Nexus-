import { useEffect, useState } from 'react';
import type { Settings } from '@/types';
import { storage } from '@/lib/storage';

export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(storage.getSettings());

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    storage.saveSettings(next);
  };

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
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
