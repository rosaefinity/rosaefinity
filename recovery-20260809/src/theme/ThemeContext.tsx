// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RosaeFinity Theme Engine â€” Theme Context
// v3.1 Architecture Spec (Frozen)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { createContext, useContext } from 'react';
import type { RosaeTheme, ThemeMode } from './ThemeTokens';
import { DARK_THEME } from './themes';

export interface ThemeContextValue {
  theme: RosaeTheme;
  mode: ThemeMode;
  isDark: boolean;
  isCustom: boolean;
  setMode: (mode: ThemeMode) => void;
  setTheme: (themeId: string) => void;
  setCustomTheme: (theme: RosaeTheme) => void;
}

export const ThemeContext = createContext<ThemeContextValue>({
  theme: DARK_THEME,
  mode: 'dark',
  isDark: true,
  isCustom: false,
  setMode: () => {},
  setTheme: () => {},
  setCustomTheme: () => {},
});

/**
 * Hook to access the current theme context.
 */
export function useThemeContext(): ThemeContextValue {
  return useContext(ThemeContext);
}
