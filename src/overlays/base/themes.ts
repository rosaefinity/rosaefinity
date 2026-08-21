// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Theme Engine
// v3.1 Architecture Spec (Frozen)
// ─────────────────────────────────────────────────────

import type { OverlayTheme } from './types';
import { DEFAULT_THEME } from './constants';

// ─── Dark Theme ───

export const DARK_THEME: OverlayTheme = {
  ...DEFAULT_THEME,
};

// ─── Light Theme ───

export const LIGHT_THEME: OverlayTheme = {
  colors: {
    primary: '#d62858',
    secondary: '#3b6bef',
    background: 'rgba(255, 255, 255, 0.9)',
    text: '#1a1a2e',
    accent: '#d4900a',
    success: '#16a34a',
    warning: '#d97706',
    error: '#dc2626',
    border: 'rgba(0, 0, 0, 0.1)',
    surface: 'rgba(0, 0, 0, 0.03)',
    overlay: 'rgba(255, 255, 255, 0.95)',
  },
  typography: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.5,
    letterSpacing: 0,
  },
  spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  radius: { sm: 4, md: 8, lg: 16, full: 9999 },
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.08)',
    md: '0 4px 6px rgba(0, 0, 0, 0.12)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.12)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
  },
  animation: { fast: 150, normal: 300, slow: 500, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
};

// ─── Theme Resolution ───

export type ThemeMode = 'dark' | 'light' | 'auto';

/**
 * Resolve the active theme based on mode.
 * 'auto' follows system preference.
 */
export function resolveTheme(mode: ThemeMode, customTheme?: OverlayTheme): OverlayTheme {
  if (customTheme && mode !== 'auto') return customTheme;

  if (mode === 'auto') {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return customTheme ?? LIGHT_THEME;
    }
    return customTheme ?? DARK_THEME;
  }

  if (mode === 'light') return customTheme ?? LIGHT_THEME;
  return customTheme ?? DARK_THEME;
}

/**
 * Generate CSS custom properties from a theme.
 */
export function themeToCSSVariables(theme: OverlayTheme): Record<string, string> {
  return {
    '--overlay-primary': theme.colors.primary,
    '--overlay-secondary': theme.colors.secondary,
    '--overlay-bg': theme.colors.background,
    '--overlay-text': theme.colors.text,
    '--overlay-accent': theme.colors.accent,
    '--overlay-success': theme.colors.success,
    '--overlay-warning': theme.colors.warning,
    '--overlay-error': theme.colors.error,
    '--overlay-border': theme.colors.border,
    '--overlay-surface': theme.colors.surface,
    '--overlay-overlay': theme.colors.overlay,
    '--overlay-font': theme.typography.fontFamily,
    '--overlay-font-size': `${theme.typography.fontSize}px`,
    '--overlay-font-weight': String(theme.typography.fontWeight),
    '--overlay-line-height': String(theme.typography.lineHeight),
    '--overlay-spacing-xs': `${theme.spacing.xs}px`,
    '--overlay-spacing-sm': `${theme.spacing.sm}px`,
    '--overlay-spacing-md': `${theme.spacing.md}px`,
    '--overlay-spacing-lg': `${theme.spacing.lg}px`,
    '--overlay-spacing-xl': `${theme.spacing.xl}px`,
    '--overlay-radius-sm': `${theme.radius.sm}px`,
    '--overlay-radius-md': `${theme.radius.md}px`,
    '--overlay-radius-lg': `${theme.radius.lg}px`,
    '--overlay-radius-full': `${theme.radius.full}px`,
    '--overlay-shadow-sm': theme.shadow.sm,
    '--overlay-shadow-md': theme.shadow.md,
    '--overlay-shadow-lg': theme.shadow.lg,
    '--overlay-shadow-xl': theme.shadow.xl,
    '--overlay-anim-fast': `${theme.animation.fast}ms`,
    '--overlay-anim-normal': `${theme.animation.normal}ms`,
    '--overlay-anim-slow': `${theme.animation.slow}ms`,
    '--overlay-anim-easing': theme.animation.easing,
  };
}
