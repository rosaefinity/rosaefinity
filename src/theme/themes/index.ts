// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RosaeFinity Theme Engine â€” Built-in Themes
// v3.1 Architecture Spec (Frozen)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import type { RosaeTheme } from '../ThemeTokens';

const sharedTypography = {
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  xs: 10, sm: 12, md: 14, lg: 16, xl: 20, xxl: 24,
  weight: { normal: 400, medium: 500, semibold: 600, bold: 700 },
  letterSpacing: { tight: '-0.02em', normal: '0', wide: '0.04em' },
  lineHeight: { tight: 1.25, normal: 1.5, relaxed: 1.75 },
};

const sharedSpacing = {
  '0': '0px', '2': '2px', '4': '4px', '8': '8px', '12': '12px', '16': '16px',
  '20': '20px', '24': '24px', '32': '32px', '40': '40px', '48': '48px', '64': '64px',
};

const sharedShadow = {
  sm: '0 1px 2px rgba(0,0,0,0.1)', md: '0 4px 8px rgba(0,0,0,0.15)',
  lg: '0 8px 24px rgba(0,0,0,0.2)', glow: '0 0 20px rgba(124,58,237,0.3)',
  inner: 'inset 0 2px 4px rgba(0,0,0,0.1)',
};

function makeTheme(overrides: Partial<RosaeTheme['tokens']> & { colors: RosaeTheme['tokens']['colors'] }, meta: Omit<RosaeTheme, 'tokens'>): RosaeTheme {
  return {
    ...meta,
    tokens: {
      colors: overrides.colors,
      typography: overrides.typography ?? sharedTypography,
      spacing: overrides.spacing ?? sharedSpacing,
      radius: overrides.radius ?? { none: '0px', sm: '4px', md: '8px', lg: '16px', xl: '24px', full: '9999px' },
      shadow: overrides.shadow ?? { sm: '0 1px 2px rgba(0,0,0,0.1)', md: '0 4px 8px rgba(0,0,0,0.15)', lg: '0 8px 24px rgba(0,0,0,0.2)', glow: '0 0 20px rgba(124,58,237,0.3)', inner: 'inset 0 2px 4px rgba(0,0,0,0.1)' },
      animation: overrides.animation ?? { fast: '150ms', normal: '300ms', slow: '500ms', spring: 'cubic-bezier(0.34,1.56,0.64,1)', bounce: 'cubic-bezier(0.68,-0.55,0.27,1.55)', elastic: 'cubic-bezier(0.68,-0.6,0.32,1.6)' },
    },
  };
}

// â”€â”€â”€ Dark â”€â”€â”€

export const DARK_THEME: RosaeTheme = makeTheme({
  colors: {
    background: '#0a0a14', surface: '#12121e', surfaceSecondary: '#1a1a2e',
    primary: '#7c3aed', secondary: '#4e7bff', accent: '#e0306a',
    success: '#22c55e', warning: '#f59e0b', danger: '#ef4444', info: '#3b82f6',
    textPrimary: '#ffffff', textSecondary: '#94a3b8',
    border: 'rgba(255,255,255,0.08)', overlay: 'rgba(0,0,0,0.8)',
    shadow: 'rgba(0,0,0,0.3)', transparent: 'transparent',
  },
}, { id: 'dark', name: 'Dark', description: 'Default dark theme', author: 'RosaeFinity', version: '1.0.0', isDark: true });

// â”€â”€â”€ Light â”€â”€â”€

export const LIGHT_THEME: RosaeTheme = makeTheme({
  colors: {
    background: '#f8fafc', surface: '#ffffff', surfaceSecondary: '#f1f5f9',
    primary: '#7c3aed', secondary: '#3b82f6', accent: '#e0306a',
    success: '#16a34a', warning: '#d97706', danger: '#dc2626', info: '#2563eb',
    textPrimary: '#0f172a', textSecondary: '#64748b',
    border: 'rgba(0,0,0,0.08)', overlay: 'rgba(255,255,255,0.95)',
    shadow: 'rgba(0,0,0,0.08)', transparent: 'transparent',
  },
}, { id: 'light', name: 'Light', description: 'Clean light theme', author: 'RosaeFinity', version: '1.0.0', isDark: false });

// â”€â”€â”€ Midnight â”€â”€â”€

export const MIDNIGHT_THEME: RosaeTheme = makeTheme({
  colors: {
    background: '#020617', surface: '#0f172a', surfaceSecondary: '#1e293b',
    primary: '#818cf8', secondary: '#38bdf8', accent: '#f472b6',
    success: '#4ade80', warning: '#fbbf24', danger: '#f87171', info: '#60a5fa',
    textPrimary: '#f1f5f9', textSecondary: '#94a3b8',
    border: 'rgba(148,163,184,0.1)', overlay: 'rgba(2,6,23,0.9)',
    shadow: 'rgba(0,0,0,0.4)', transparent: 'transparent',
  },
}, { id: 'midnight', name: 'Midnight', description: 'Deep midnight blue', author: 'RosaeFinity', version: '1.0.0', isDark: true });

// â”€â”€â”€ Purple â”€â”€â”€

export const PURPLE_THEME: RosaeTheme = makeTheme({
  colors: {
    background: '#130a24', surface: '#1e1040', surfaceSecondary: '#2a1856',
    primary: '#a855f7', secondary: '#c084fc', accent: '#f0abfc',
    success: '#86efac', warning: '#fde047', danger: '#fb7185', info: '#93c5fd',
    textPrimary: '#faf5ff', textSecondary: '#c4b5fd',
    border: 'rgba(168,85,247,0.2)', overlay: 'rgba(19,10,36,0.9)',
    shadow: 'rgba(88,28,135,0.3)', transparent: 'transparent',
  },
}, { id: 'purple', name: 'Purple', description: 'Rich purple aesthetic', author: 'RosaeFinity', version: '1.0.0', isDark: true });

// â”€â”€â”€ Ocean â”€â”€â”€

export const OCEAN_THEME: RosaeTheme = makeTheme({
  colors: {
    background: '#0a1628', surface: '#0f2035', surfaceSecondary: '#162d4a',
    primary: '#0ea5e9', secondary: '#38bdf8', accent: '#2dd4bf',
    success: '#34d399', warning: '#fbbf24', danger: '#f87171', info: '#7dd3fc',
    textPrimary: '#e0f2fe', textSecondary: '#7dd3fc',
    border: 'rgba(56,189,248,0.15)', overlay: 'rgba(10,22,40,0.9)',
    shadow: 'rgba(0,51,102,0.3)', transparent: 'transparent',
  },
}, { id: 'ocean', name: 'Ocean', description: 'Deep ocean blues', author: 'RosaeFinity', version: '1.0.0', isDark: true });

// â”€â”€â”€ Glass â”€â”€â”€

export const GLASS_THEME: RosaeTheme = makeTheme({
  colors: {
    background: 'rgba(10,10,20,0.7)', surface: 'rgba(255,255,255,0.05)', surfaceSecondary: 'rgba(255,255,255,0.08)',
    primary: 'rgba(124,58,237,0.8)', secondary: 'rgba(78,123,255,0.8)', accent: 'rgba(224,48,106,0.8)',
    success: 'rgba(34,197,94,0.8)', warning: 'rgba(245,158,11,0.8)', danger: 'rgba(239,68,68,0.8)', info: 'rgba(59,130,246,0.8)',
    textPrimary: 'rgba(255,255,255,0.9)', textSecondary: 'rgba(255,255,255,0.5)',
    border: 'rgba(255,255,255,0.1)', overlay: 'rgba(0,0,0,0.5)',
    shadow: 'rgba(0,0,0,0.2)', transparent: 'transparent',
  },
  shadow: { sm: '0 1px 2px rgba(0,0,0,0.1)', md: '0 4px 12px rgba(0,0,0,0.15)', lg: '0 8px 32px rgba(0,0,0,0.2)', glow: '0 0 20px rgba(124,58,237,0.2)', inner: 'inset 0 1px 2px rgba(255,255,255,0.05)' },
}, { id: 'glass', name: 'Glass', description: 'Frosted glass effect', author: 'RosaeFinity', version: '1.0.0', isDark: true });

// â”€â”€â”€ Minimal â”€â”€â”€

export const MINIMAL_THEME: RosaeTheme = makeTheme({
  colors: {
    background: '#111111', surface: '#1a1a1a', surfaceSecondary: '#222222',
    primary: '#ffffff', secondary: '#888888', accent: '#ffffff',
    success: '#4caf50', warning: '#ff9800', danger: '#f44336', info: '#2196f3',
    textPrimary: '#ffffff', textSecondary: '#888888',
    border: 'rgba(255,255,255,0.06)', overlay: 'rgba(0,0,0,0.9)',
    shadow: 'rgba(0,0,0,0.3)', transparent: 'transparent',
  },
}, { id: 'minimal', name: 'Minimal', description: 'Clean minimal design', author: 'RosaeFinity', version: '1.0.0', isDark: true });

// â”€â”€â”€ Gaming â”€â”€â”€

export const GAMING_THEME: RosaeTheme = makeTheme({
  colors: {
    background: '#0d0d0d', surface: '#1a1a1a', surfaceSecondary: '#252525',
    primary: '#00ff88', secondary: '#00ccff', accent: '#ff0066',
    success: '#00ff88', warning: '#ffcc00', danger: '#ff0044', info: '#00ccff',
    textPrimary: '#e0ffe0', textSecondary: '#88aa88',
    border: 'rgba(0,255,136,0.15)', overlay: 'rgba(0,0,0,0.85)',
    shadow: 'rgba(0,255,136,0.15)', transparent: 'transparent',
  },
  shadow: { ...sharedShadow, glow: '0 0 20px rgba(0,255,136,0.3)' },
}, { id: 'gaming', name: 'Gaming', description: 'Neon gaming aesthetic', author: 'RosaeFinity', version: '1.0.0', isDark: true });

// â”€â”€â”€ Cyberpunk â”€â”€â”€

export const CYBERPUNK_THEME: RosaeTheme = makeTheme({
  colors: {
    background: '#0a0014', surface: '#140028', surfaceSecondary: '#1e003c',
    primary: '#ff00ff', secondary: '#00ffff', accent: '#ffff00',
    success: '#00ff00', warning: '#ff8800', danger: '#ff0044', info: '#00aaff',
    textPrimary: '#ffeeff', textSecondary: '#cc88ff',
    border: 'rgba(255,0,255,0.2)', overlay: 'rgba(10,0,20,0.9)',
    shadow: 'rgba(255,0,255,0.2)', transparent: 'transparent',
  },
  shadow: { ...sharedShadow, glow: '0 0 20px rgba(255,0,255,0.4)' },
}, { id: 'cyberpunk', name: 'Cyberpunk', description: 'Neon cyberpunk aesthetic', author: 'RosaeFinity', version: '1.0.0', isDark: true });

// â”€â”€â”€ Streamer â”€â”€â”€

export const STREAMER_THEME: RosaeTheme = makeTheme({
  colors: {
    background: '#18181b', surface: '#27272a', surfaceSecondary: '#3f3f46',
    primary: '#a855f7', secondary: '#ec4899', accent: '#f59e0b',
    success: '#22c55e', warning: '#eab308', danger: '#ef4444', info: '#6366f1',
    textPrimary: '#fafafa', textSecondary: '#a1a1aa',
    border: 'rgba(255,255,255,0.08)', overlay: 'rgba(0,0,0,0.85)',
    shadow: 'rgba(0,0,0,0.3)', transparent: 'transparent',
  },
}, { id: 'streamer', name: 'Streamer', description: 'Professional streamer theme', author: 'RosaeFinity', version: '1.0.0', isDark: true });

// â”€â”€â”€ Professional â”€â”€â”€

export const PROFESSIONAL_THEME: RosaeTheme = makeTheme({
  colors: {
    background: '#f5f5f5', surface: '#ffffff', surfaceSecondary: '#eeeeee',
    primary: '#1a1a2e', secondary: '#16213e', accent: '#e94560',
    success: '#27ae60', warning: '#f39c12', danger: '#e74c3c', info: '#3498db',
    textPrimary: '#1a1a2e', textSecondary: '#666666',
    border: 'rgba(0,0,0,0.1)', overlay: 'rgba(245,245,245,0.95)',
    shadow: 'rgba(0,0,0,0.08)', transparent: 'transparent',
  },
}, { id: 'professional', name: 'Professional', description: 'Clean professional look', author: 'RosaeFinity', version: '1.0.0', isDark: false });

// â”€â”€â”€ Classic OBS â”€â”€â”€

export const CLASSIC_OBS_THEME: RosaeTheme = makeTheme({
  colors: {
    background: '#2b2b2b', surface: '#3c3c3c', surfaceSecondary: '#4a4a4a',
    primary: '#5b9bd5', secondary: '#70ad47', accent: '#ffc000',
    success: '#70ad47', warning: '#ffc000', danger: '#ff0000', info: '#5b9bd5',
    textPrimary: '#e0e0e0', textSecondary: '#b0b0b0',
    border: 'rgba(255,255,255,0.1)', overlay: 'rgba(43,43,43,0.95)',
    shadow: 'rgba(0,0,0,0.3)', transparent: 'transparent',
  },
}, { id: 'classic-obs', name: 'Classic OBS', description: 'Classic OBS Studio look', author: 'RosaeFinity', version: '1.0.0', isDark: true });

// â”€â”€â”€ Pastel â”€â”€â”€

export const PASTEL_THEME: RosaeTheme = makeTheme({
  colors: {
    background: '#fef7ff', surface: '#ffffff', surfaceSecondary: '#fdf2f8',
    primary: '#c084fc', secondary: '#93c5fd', accent: '#fda4af',
    success: '#86efac', warning: '#fde68a', danger: '#fca5a5', info: '#a5b4fc',
    textPrimary: '#1e1b4b', textSecondary: '#6b7280',
    border: 'rgba(0,0,0,0.06)', overlay: 'rgba(254,247,255,0.95)',
    shadow: 'rgba(0,0,0,0.05)', transparent: 'transparent',
  },
}, { id: 'pastel', name: 'Pastel', description: 'Soft pastel colors', author: 'RosaeFinity', version: '1.0.0', isDark: false });

// â”€â”€â”€ Neon â”€â”€â”€

export const NEON_THEME: RosaeTheme = makeTheme({
  colors: {
    background: '#000000', surface: '#0a0a0a', surfaceSecondary: '#141414',
    primary: '#ff0080', secondary: '#00ff80', accent: '#0080ff',
    success: '#00ff80', warning: '#ffff00', danger: '#ff0040', info: '#0080ff',
    textPrimary: '#ffffff', textSecondary: '#aaaaaa',
    border: 'rgba(255,0,128,0.2)', overlay: 'rgba(0,0,0,0.95)',
    shadow: 'rgba(255,0,128,0.2)', transparent: 'transparent',
  },
  shadow: { ...sharedShadow, glow: '0 0 30px rgba(255,0,128,0.4)' },
}, { id: 'neon', name: 'Neon', description: 'Bright neon colors', author: 'RosaeFinity', version: '1.0.0', isDark: true });

// â”€â”€â”€ TikFinity Inspired â”€â”€â”€

export const TIKFINITY_THEME: RosaeTheme = makeTheme({
  colors: {
    background: '#111827', surface: '#1f2937', surfaceSecondary: '#374151',
    primary: '#e0306a', secondary: '#4e7bff', accent: '#f0a020',
    success: '#10b981', warning: '#f59e0b', danger: '#ef4444', info: '#6366f1',
    textPrimary: '#f9fafb', textSecondary: '#9ca3af',
    border: 'rgba(255,255,255,0.08)', overlay: 'rgba(17,24,39,0.9)',
    shadow: 'rgba(0,0,0,0.3)', transparent: 'transparent',
  },
}, { id: 'tikfinity', name: 'TikFinity Inspired', description: 'Inspired by TikFinity Desktop', author: 'RosaeFinity', version: '1.0.0', isDark: true });

// â”€â”€â”€ All Themes â”€â”€â”€

export const ALL_THEMES: readonly RosaeTheme[] = [
  DARK_THEME, LIGHT_THEME, MIDNIGHT_THEME, PURPLE_THEME, OCEAN_THEME,
  GLASS_THEME, MINIMAL_THEME, GAMING_THEME, CYBERPUNK_THEME, STREAMER_THEME,
  PROFESSIONAL_THEME, CLASSIC_OBS_THEME, PASTEL_THEME, NEON_THEME, TIKFINITY_THEME,
];

export function getThemeById(id: string): RosaeTheme | undefined {
  return ALL_THEMES.find(t => t.id === id);
}
