// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RosaeFinity Theme Engine â€” Zustand Store
// v3.1 Architecture Spec (Frozen)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { RosaeTheme, ThemeMode, ThemeDiagnostics } from './ThemeTokens';
import { DARK_THEME, LIGHT_THEME, ALL_THEMES, getThemeById } from './themes';
import { generateCSSVariables, injectCSSVariables, countCSSVariables } from './ThemeGenerator';

// â”€â”€â”€ Store Interface â”€â”€â”€

interface ThemeStoreState {
  currentTheme: RosaeTheme;
  mode: ThemeMode;
  customTheme: RosaeTheme | null;
  systemTheme: 'dark' | 'light';
  themeVersion: number;
  registeredThemes: RosaeTheme[];

  // Actions
  setMode: (mode: ThemeMode) => void;
  setTheme: (themeId: string) => void;
  setCustomTheme: (theme: RosaeTheme) => void;
  setSystemTheme: (systemTheme: 'dark' | 'light') => void;
  registerTheme: (theme: RosaeTheme) => void;
  removeTheme: (themeId: string) => void;
  duplicateTheme: (themeId: string, newName: string) => RosaeTheme | null;
  exportTheme: (themeId: string) => string | null;
  importTheme: (json: string) => boolean;
  validateTheme: (theme: unknown) => theme is RosaeTheme;
  resetTheme: () => void;
  getTheme: (themeId: string) => RosaeTheme | undefined;
  listThemes: () => RosaeTheme[];
  getDiagnostics: () => ThemeDiagnostics;
  applyCurrentTheme: () => void;
}

// â”€â”€â”€ Resolve effective theme â”€â”€â”€

function resolveTheme(mode: ThemeMode, customTheme: RosaeTheme | null, systemTheme: 'dark' | 'light'): RosaeTheme {
  switch (mode) {
    case 'light': return LIGHT_THEME;
    case 'custom': return customTheme ?? DARK_THEME;
    case 'auto': return systemTheme === 'light' ? LIGHT_THEME : DARK_THEME;
    case 'dark':
    default: return DARK_THEME;
  }
}

// â”€â”€â”€ Validation â”€â”€â”€

function isValidTheme(value: unknown): value is RosaeTheme {
  if (!value || typeof value !== 'object') return false;
  const t = value as Record<string, unknown>;
  if (typeof t.id !== 'string' || typeof t.name !== 'string') return false;
  if (!t.tokens || typeof t.tokens !== 'object') return false;
  const tokens = t.tokens as Record<string, unknown>;
  if (!tokens.colors || typeof tokens.colors !== 'object') return false;
  return true;
}

// â”€â”€â”€ Store â”€â”€â”€

export const useThemeStore = create<ThemeStoreState>()(
  persist(
    (set, get) => {
      // Detect system theme
      const systemTheme: 'dark' | 'light' =
        typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches
          ? 'light' : 'dark';

      const initialTheme = resolveTheme('dark', null, systemTheme);

      return {
        currentTheme: initialTheme,
        mode: 'dark',
        customTheme: null,
        systemTheme,
        themeVersion: 1,
        registeredThemes: [...ALL_THEMES],

        setMode: (mode) => {
          const state = get();
          const currentTheme = resolveTheme(mode, state.customTheme, state.systemTheme);
          set({ mode, currentTheme, themeVersion: state.themeVersion + 1 });
          get().applyCurrentTheme();
        },

        setTheme: (themeId) => {
          const theme = get().registeredThemes.find(t => t.id === themeId);
          if (theme) {
            set({ currentTheme: theme, themeVersion: get().themeVersion + 1 });
            get().applyCurrentTheme();
          }
        },

        setCustomTheme: (theme) => {
          set({ customTheme: theme, currentTheme: theme, mode: 'custom', themeVersion: get().themeVersion + 1 });
          get().applyCurrentTheme();
        },

        setSystemTheme: (systemTheme) => {
          set({ systemTheme });
          const state = get();
          if (state.mode === 'auto') {
            const currentTheme = resolveTheme('auto', state.customTheme, systemTheme);
            set({ currentTheme, themeVersion: state.themeVersion + 1 });
            get().applyCurrentTheme();
          }
        },

        registerTheme: (theme) => {
          set(state => ({
            registeredThemes: [...state.registeredThemes.filter(t => t.id !== theme.id), theme],
          }));
        },

        removeTheme: (themeId) => {
          if (themeId === 'dark' || themeId === 'light') return; // Cannot remove built-in
          set(state => ({
            registeredThemes: state.registeredThemes.filter(t => t.id !== themeId),
          }));
        },

        duplicateTheme: (themeId, newName) => {
          const original = get().registeredThemes.find(t => t.id === themeId);
          if (!original) return null;
          const dup: RosaeTheme = {
            ...JSON.parse(JSON.stringify(original)),
            id: `${original.id}-copy-${Date.now()}`,
            name: newName,
            author: 'Custom',
          };
          get().registerTheme(dup);
          return dup;
        },

        exportTheme: (themeId) => {
          const theme = get().registeredThemes.find(t => t.id === themeId);
          if (!theme) return null;
          return JSON.stringify(theme, null, 2);
        },

        importTheme: (json) => {
          try {
            const theme = JSON.parse(json);
            if (!isValidTheme(theme)) return false;
            get().registerTheme(theme);
            return true;
          } catch {
            return false;
          }
        },

        validateTheme: (theme): theme is RosaeTheme => isValidTheme(theme),

        resetTheme: () => {
          set({ currentTheme: DARK_THEME, mode: 'dark', customTheme: null, themeVersion: 1 });
          get().applyCurrentTheme();
        },

        getTheme: (themeId) => get().registeredThemes.find(t => t.id === themeId),

        listThemes: () => get().registeredThemes,

        getDiagnostics: () => {
          const state = get();
          return {
            themeName: state.currentTheme.name,
            mode: state.mode,
            tokenCount: countTokens(state.currentTheme),
            updateTimeMs: 0,
            cssVariableCount: countCSSVariables(),
          };
        },

        applyCurrentTheme: () => {
          const theme = get().currentTheme;
          const vars = generateCSSVariables(theme);
          injectCSSVariables(vars);
        },
      };
    },
    {
      name: 'rosaefinity-theme',
      partialize: (state) => ({
        mode: state.mode,
        customTheme: state.customTheme,
        currentThemeId: state.currentTheme.id,
      }),
      merge: (persisted, current) => {
        const data = persisted as { mode?: ThemeMode; customTheme?: RosaeTheme | null; currentThemeId?: string };
        const mode = data.mode ?? 'dark';
        const customTheme = data.customTheme ?? null;
        const systemTheme = current.systemTheme;
        const currentTheme = resolveTheme(mode, customTheme, systemTheme);

        return {
          ...current,
          mode,
          customTheme,
          currentTheme,
        };
      },
    }
  )
);

// â”€â”€â”€ Token counter â”€â”€â”€

function countTokens(theme: RosaeTheme): number {
  let count = 0;
  const t = theme.tokens;
  count += Object.keys(t.colors).length;
  count += Object.keys(t.typography).length;
  count += Object.keys(t.spacing).length;
  count += Object.keys(t.radius).length;
  count += Object.keys(t.shadow).length;
  count += Object.keys(t.animation).length;
  return count;
}
