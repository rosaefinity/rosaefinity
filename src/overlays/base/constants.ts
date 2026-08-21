// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Constants & Defaults
// v3.1 Architecture Spec
// ─────────────────────────────────────────────────────

import type {
  OverlayColors,
  OverlayBorder,
  OverlayShadow,
  OverlaySpacing,
  OverlayTheme,
} from './types';

// ─── Overlay Categories ───

export const OVERLAY_CATEGORIES = [
  'goals',
  'gifts',
  'chat',
  'alerts',
  'actions',
  'graphics',
  'media',
  'leaderboard',
  'utilities',
  'experimental',
] as const;

export type OverlayCategory = (typeof OVERLAY_CATEGORIES)[number];

export interface CategoryMeta {
  id: OverlayCategory;
  label: string;
  icon: string;
  description: string;
  sortOrder: number;
}

export const CATEGORY_META: readonly CategoryMeta[] = [
  { id: 'goals',        label: 'Goals',        icon: '🎯', description: 'Track progress toward goals',           sortOrder: 0 },
  { id: 'gifts',        label: 'Gifts',        icon: '🎁', description: 'Gift-related overlays',                 sortOrder: 1 },
  { id: 'chat',         label: 'Chat',         icon: '💬', description: 'Chat message overlays',                 sortOrder: 2 },
  { id: 'alerts',       label: 'Alerts',       icon: '🔔', description: 'Event alert overlays',                  sortOrder: 3 },
  { id: 'actions',      label: 'Actions',      icon: '⚡', description: 'Interactive overlays',                   sortOrder: 4 },
  { id: 'graphics',     label: 'Graphics',     icon: '✨', description: 'Visual effects and particles',          sortOrder: 5 },
  { id: 'media',        label: 'Media',        icon: '🎬', description: 'Image, video, and browser overlays',    sortOrder: 6 },
  { id: 'leaderboard',  label: 'Leaderboard',  icon: '🏆', description: 'Rankings and leaderboards',            sortOrder: 7 },
  { id: 'utilities',    label: 'Utilities',    icon: '⚙️', description: 'System info and tools',                 sortOrder: 8 },
  { id: 'experimental', label: 'Experimental', icon: '🧪', description: 'Experimental features',                sortOrder: 9 },
] as const;

// ─── Default Colors ───

export const DEFAULT_COLORS: OverlayColors = {
  primary: '#e0306a',
  secondary: '#4e7bff',
  background: 'rgba(0, 0, 0, 0.6)',
  text: '#ffffff',
  accent: '#f0a020',
};

// ─── Default Border ───

export const DEFAULT_BORDER: OverlayBorder = {
  width: 0,
  color: 'transparent',
  radius: 8,
};

// ─── Default Shadow ───

export const DEFAULT_SHADOW: OverlayShadow = {
  enabled: false,
  color: 'rgba(0, 0, 0, 0.3)',
  blur: 12,
  offsetX: 0,
  offsetY: 4,
};

// ─── Default Spacing ───

export const DEFAULT_SPACING: OverlaySpacing = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

// ─── Default Theme ───

export const DEFAULT_THEME: OverlayTheme = {
  colors: {
    primary: '#e0306a',
    secondary: '#4e7bff',
    background: 'rgba(0, 0, 0, 0.6)',
    text: '#ffffff',
    accent: '#f0a020',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    border: 'rgba(255, 255, 255, 0.1)',
    surface: 'rgba(255, 255, 255, 0.05)',
    overlay: 'rgba(0, 0, 0, 0.8)',
  },
  typography: {
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
    fontSize: 14,
    fontWeight: 600,
    lineHeight: 1.5,
    letterSpacing: 0,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
  },
  radius: {
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },
  shadow: {
    sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
    md: '0 4px 6px rgba(0, 0, 0, 0.1)',
    lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
    xl: '0 20px 25px rgba(0, 0, 0, 0.15)',
  },
  animation: {
    fast: 150,
    normal: 300,
    slow: 500,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
};

// ─── Default Base Config Values ───

export const DEFAULT_POSITION = { x: 0, y: 0 };
export const DEFAULT_SIZE = { width: 300, height: 200 };
export const DEFAULT_SCALE = 1;
export const DEFAULT_ROTATION = 0;
export const DEFAULT_OPACITY = 1;
export const DEFAULT_ANIMATION_SPEED = 1;
export const DEFAULT_ANIMATION_DELAY = 0;
export const DEFAULT_ANIMATION_EASING = 'ease' as const;
export const DEFAULT_ANIMATION_LOOP = false;
export const DEFAULT_ANIMATION_PRESET = 'none' as const;
export const DEFAULT_ANIMATION_DURATION = 0;
export const DEFAULT_FONT_FAMILY = "'Segoe UI', system-ui, -apple-system, sans-serif";
export const DEFAULT_FONT_SIZE = 14;
export const DEFAULT_FONT_WEIGHT = 600;
export const DEFAULT_LETTER_SPACING = 0;
export const DEFAULT_LINE_HEIGHT = 1.5;
export const DEFAULT_TEXT_ALIGN = 'left' as const;
export const DEFAULT_TEXT_TRANSFORM = 'none' as const;
export const DEFAULT_TEXT_SHADOW: OverlayShadow = {
  enabled: false,
  color: 'rgba(0, 0, 0, 0.5)',
  blur: 2,
  offsetX: 1,
  offsetY: 1,
};
export const DEFAULT_DURATION = 5;
export const DEFAULT_MAX_ITEMS = 10;
export const DEFAULT_COOLDOWN = 0;
export const DEFAULT_HIDDEN_WHEN_INACTIVE = false;
export const DEFAULT_AUTO_HIDE = false;
export const DEFAULT_AUTO_HIDE_DELAY = 5;
export const DEFAULT_AUTO_PLAY = true;
export const DEFAULT_CLICK_THROUGH = false;
export const DEFAULT_LOCK_POSITION = false;
export const DEFAULT_SOUND_VOLUME = 80;
export const DEFAULT_SCREEN_ID = 'screen-0';

// ─── Event Types ───

export const OVERLAY_EVENT_TYPES = [
  'gift',
  'follow',
  'like',
  'share',
  'comment',
  'subscribe',
  'join',
  'battle-progress',
  'goal-progress',
  'coin',
  'obs-scene-change',
  'obs-stream-start',
  'obs-stream-stop',
  'streamerbot-trigger',
  'hotkey',
  'media-change',
  'media-play',
  'media-pause',
  'timer-tick',
  'timer-complete',
  'custom',
  'test',
] as const;

export type OverlayEventType = (typeof OVERLAY_EVENT_TYPES)[number];
