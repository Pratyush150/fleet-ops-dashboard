import { useCallback, useEffect, useState } from 'react';

export type ThemeName = 'dark' | 'light';

const STORAGE_KEY = 'fleet-ops:theme';

function readStoredTheme(): ThemeName {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // Private browsing or blocked storage: fall through to the default.
  }
  return 'dark';
}

/**
 * Theme state persisted to localStorage and applied as `data-theme` on <html>.
 * Storage access is wrapped because it throws outright in some privacy modes.
 */
export function useTheme(): { theme: ThemeName; toggleTheme: () => void } {
  const [theme, setTheme] = useState<ThemeName>(() => readStoredTheme());

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Non-fatal: the theme still applies for this session.
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggleTheme };
}
