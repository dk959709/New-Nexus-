import { useState, useCallback, useEffect } from 'react';

export type JarvisSynthesisTheme = 'cyan' | 'black';

const THEME_STORAGE_KEY = 'jarvis_synthesis_theme';
const THEME_CHANGE_EVENT = 'jarvis_synthesis_theme_change';

export function useJarvisSynthesisTheme() {
  const [synthesisTheme, setSynthesisTheme] = useState<JarvisSynthesisTheme>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'black' || saved === 'cyan') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'cyan';
  });

  const toggleSynthesisTheme = useCallback(() => {
    setSynthesisTheme((prev) => {
      const next: JarvisSynthesisTheme = prev === 'cyan' ? 'black' : 'cyan';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
        window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: next }));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const setTheme = useCallback((newTheme: JarvisSynthesisTheme) => {
    setSynthesisTheme(newTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT, { detail: newTheme }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const handleCustomChange = (e: Event) => {
      const custom = e as CustomEvent<JarvisSynthesisTheme>;
      if (custom.detail === 'cyan' || custom.detail === 'black') {
        setSynthesisTheme(custom.detail);
      }
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && (e.newValue === 'cyan' || e.newValue === 'black')) {
        setSynthesisTheme(e.newValue as JarvisSynthesisTheme);
      }
    };

    window.addEventListener(THEME_CHANGE_EVENT, handleCustomChange);
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, handleCustomChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  return { synthesisTheme, toggleSynthesisTheme, setTheme };
}
