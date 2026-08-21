// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RosaeFinity Theme Engine â€” Theme Provider
// v3.1 Architecture Spec (Frozen)
//
// Wraps the app with theme context, applies CSS variables,
// and listens for OS theme changes.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import React, { useEffect, useMemo, useCallback } from 'react';
import { ThemeContext, type ThemeContextValue } from './ThemeContext';
import { useThemeStore } from './ThemeStore';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps): React.ReactElement {
  const {
    currentTheme, mode, systemTheme,
    setMode, setTheme, setCustomTheme, setSystemTheme, applyCurrentTheme,
  } = useThemeStore();

  // â”€â”€ Apply CSS variables on theme change â”€â”€
  useEffect(() => {
    applyCurrentTheme();
  }, [currentTheme, applyCurrentTheme]);

  // â”€â”€ Listen for OS theme changes â”€â”€
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const handler = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'light' : 'dark');
    };

    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [setSystemTheme]);

  // â”€â”€ Context value (memoized) â”€â”€
  const contextValue: ThemeContextValue = useMemo(() => ({
    theme: currentTheme,
    mode,
    isDark: currentTheme.isDark,
    isCustom: mode === 'custom',
    setMode,
    setTheme,
    setCustomTheme,
  }), [currentTheme, mode, setMode, setTheme, setCustomTheme]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}
