// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Configuration Factory
// v3.1 Architecture Spec (Frozen)
//
// Single source of truth for runtime BaseOverlayConfig.
// Merges base defaults with module-specific overrides.
// ─────────────────────────────────────────────────────

import type { BaseOverlayConfig } from './types';
import type { AnyOverlayModule } from './types';
import {
  DEFAULT_COLORS,
  DEFAULT_BORDER,
  DEFAULT_SHADOW,
  DEFAULT_SPACING,
  DEFAULT_POSITION,
  DEFAULT_SIZE,
  DEFAULT_SCALE,
  DEFAULT_ROTATION,
  DEFAULT_OPACITY,
  DEFAULT_ANIMATION_SPEED,
  DEFAULT_ANIMATION_DURATION,
  DEFAULT_ANIMATION_DELAY,
  DEFAULT_ANIMATION_EASING,
  DEFAULT_ANIMATION_LOOP,
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  DEFAULT_FONT_WEIGHT,
  DEFAULT_LETTER_SPACING,
  DEFAULT_LINE_HEIGHT,
  DEFAULT_TEXT_ALIGN,
  DEFAULT_TEXT_TRANSFORM,
  DEFAULT_TEXT_SHADOW,
  DEFAULT_DURATION,
  DEFAULT_MAX_ITEMS,
  DEFAULT_COOLDOWN,
  DEFAULT_HIDDEN_WHEN_INACTIVE,
  DEFAULT_AUTO_HIDE,
  DEFAULT_AUTO_HIDE_DELAY,
  DEFAULT_AUTO_PLAY,
  DEFAULT_CLICK_THROUGH,
  DEFAULT_LOCK_POSITION,
  DEFAULT_SOUND_VOLUME,
  DEFAULT_SCREEN_ID,
} from './base/constants';

// ═══════════════════════════════════════════════════════
// BASE OVERLAY DEFAULTS
// ═══════════════════════════════════════════════════════

/**
 * Complete BaseOverlayConfig with sensible defaults for every field.
 * This is the single source of truth for missing config values.
 */
export const baseOverlayDefaults: BaseOverlayConfig = {
  // ── Visibility ──
  enabled: false,
  visible: true,

  // ── Layout ──
  position: { ...DEFAULT_POSITION },
  size: { ...DEFAULT_SIZE },
  scale: DEFAULT_SCALE,
  rotation: DEFAULT_ROTATION,
  opacity: DEFAULT_OPACITY,

  // ── Animation ──
  animationSpeed: DEFAULT_ANIMATION_SPEED,
  animationDuration: DEFAULT_ANIMATION_DURATION,
  animationDelay: DEFAULT_ANIMATION_DELAY,
  animationEasing: DEFAULT_ANIMATION_EASING,
  animationLoop: DEFAULT_ANIMATION_LOOP,
  transition: 'fade',

  // ── Typography ──
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: DEFAULT_FONT_SIZE,
  fontWeight: DEFAULT_FONT_WEIGHT,
  letterSpacing: DEFAULT_LETTER_SPACING,
  lineHeight: DEFAULT_LINE_HEIGHT,
  textAlign: DEFAULT_TEXT_ALIGN,
  textTransform: DEFAULT_TEXT_TRANSFORM,
  textShadow: { ...DEFAULT_TEXT_SHADOW },

  // ── Colors ──
  colors: { ...DEFAULT_COLORS },

  // ── Border ──
  border: { ...DEFAULT_BORDER },

  // ── Shadow ──
  shadow: { ...DEFAULT_SHADOW },

  // ── Spacing ──
  padding: { ...DEFAULT_SPACING },
  margin: { ...DEFAULT_SPACING },

  // ── Behavior ──
  duration: DEFAULT_DURATION,
  maxItems: DEFAULT_MAX_ITEMS,
  cooldown: DEFAULT_COOLDOWN,
  hiddenWhenInactive: DEFAULT_HIDDEN_WHEN_INACTIVE,
  autoHide: DEFAULT_AUTO_HIDE,
  autoHideDelay: DEFAULT_AUTO_HIDE_DELAY,
  autoPlay: DEFAULT_AUTO_PLAY,
  clickThrough: DEFAULT_CLICK_THROUGH,
  lockPosition: DEFAULT_LOCK_POSITION,

  // ── Audio ──
  soundEnabled: false,
  soundUrl: '',
  soundVolume: DEFAULT_SOUND_VOLUME,

  // ── Screen ──
  screenId: DEFAULT_SCREEN_ID,
};

// ═══════════════════════════════════════════════════════
// DEEP MERGE
// ═══════════════════════════════════════════════════════

const OBJECT_KEYS = [
  'position',
  'size',
  'colors',
  'border',
  'shadow',
  'padding',
  'margin',
] as const;

type ObjectKey = (typeof OBJECT_KEYS)[number];

/**
 * Two-level typed merge of BaseOverlayConfig objects.
 * For known nested object fields, performs a shallow spread.
 * For all other fields, takes the overlay value if present.
 */
function mergeConfigs(
  base: BaseOverlayConfig,
  overlay: Partial<BaseOverlayConfig>,
): BaseOverlayConfig {
  const result = { ...base };

  for (const key of Object.keys(overlay) as (keyof BaseOverlayConfig)[]) {
    const val = overlay[key];
    if (val === undefined) continue;

    if (
      (OBJECT_KEYS as readonly string[]).includes(key) &&
      typeof val === 'object' &&
      val !== null
    ) {
      (result as unknown as Record<string, unknown>)[key] = {
        ...((base as unknown as Record<string, unknown>)[key] as object),
        ...val,
      };
    } else {
      (result as unknown as Record<string, unknown>)[key] = val;
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════

/**
 * Creates a complete BaseOverlayConfig by merging base defaults
 * with the module's partial defaultConfig.
 *
 * This is the single entry point for producing runtime configs.
 * Every renderer entry point must call this instead of using
 * `module.defaultConfig` directly.
 */
export function createOverlayConfig(module: AnyOverlayModule): BaseOverlayConfig {
  return mergeConfigs(baseOverlayDefaults, module.defaultConfig);
}

/**
 * Ensures a config object has all required fields by filling missing
 * properties from baseOverlayDefaults. Called when loading saved configs
 * from storage that may lack newly added fields.
 */
export function resolveConfig(config: Partial<BaseOverlayConfig>): BaseOverlayConfig {
  return mergeConfigs(baseOverlayDefaults, config);
}
