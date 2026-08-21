// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — defineOverlay()
// v3.1 Architecture Spec (Frozen)
// ─────────────────────────────────────────────────────

import { OVERLAY_CATEGORIES } from './base/constants';
import type { AnyOverlayModule, OverlayModule } from './types';

/**
 * Validates an overlay module definition at registration time.
 * Returns the typed module if valid, throws if invalid.
 */
export function defineOverlay<TConfig extends object>(
  module: OverlayModule<TConfig>,
): OverlayModule<TConfig> {
  // ── Validate required fields ──

  if (!module.id || typeof module.id !== 'string') {
    throw new Error(`[defineOverlay] Overlay must have a string "id". Got: ${String(module.id)}`);
  }

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(module.id)) {
    throw new Error(
      `[defineOverlay] Overlay id "${module.id}" must be kebab-case (lowercase letters, digits, hyphens only).`
    );
  }

  if (!module.name || typeof module.name !== 'string') {
    throw new Error(`[defineOverlay] Overlay "${module.id}" must have a string "name".`);
  }

  if (!module.description || typeof module.description !== 'string') {
    throw new Error(`[defineOverlay] Overlay "${module.id}" must have a string "description".`);
  }

  if (!module.category || !OVERLAY_CATEGORIES.includes(module.category as never)) {
    throw new Error(
      `[defineOverlay] Overlay "${module.id}" has invalid category "${String(module.category)}". ` +
      `Must be one of: ${OVERLAY_CATEGORIES.join(', ')}`
    );
  }

  if (!Array.isArray(module.tags)) {
    throw new Error(`[defineOverlay] Overlay "${module.id}" must have a "tags" array.`);
  }

  // ── Validate components ──
  // React.memo() returns an object with $$typeof === Symbol(react.memo), not a function
  // React.lazy() returns an object with $$typeof === Symbol(react.lazy)
  // Accept function components, class components, React.memo, React.lazy, and forwardRef
  const isValidRenderer = module.renderer &&
    (typeof module.renderer === 'function' ||
      (typeof module.renderer === 'object' &&
        module.renderer !== null &&
        typeof (module.renderer as Record<string, unknown>).$$typeof === 'symbol'));
  if (!isValidRenderer) {
    throw new Error(`[defineOverlay] Overlay "${module.id}" must have a "renderer" component (function, React.memo, React.lazy, or forwardRef).`);
  }

  // ── Validate settings ──
  if (!Array.isArray(module.settingsSchema)) {
    throw new Error(`[defineOverlay] Overlay "${module.id}" must have a "settingsSchema" array.`);
  }

  // ── Validate config ──
  if (!module.defaultConfig || typeof module.defaultConfig !== 'object') {
    throw new Error(`[defineOverlay] Overlay "${module.id}" must have a "defaultConfig" object.`);
  }

  if (typeof module.validate !== 'function') {
    throw new Error(`[defineOverlay] Overlay "${module.id}" must have a "validate" function.`);
  }

  if (typeof module.sanitize !== 'function') {
    throw new Error(`[defineOverlay] Overlay "${module.id}" must have a "sanitize" function.`);
  }

  if (typeof module.migrate !== 'function') {
    throw new Error(`[defineOverlay] Overlay "${module.id}" must have a "migrate" function.`);
  }

  // ── Log successful registration in dev ──
  if (import.meta.env?.DEV) {
    console.debug(`[defineOverlay] Registered: ${module.id} v${module.version} (${module.category})`);
  }

  return module as OverlayModule<TConfig>;
}

/**
 * Type guard: checks if a value is a valid OverlayModule.
 */
export function isOverlayModule(value: unknown): value is AnyOverlayModule {
  if (!value || typeof value !== 'object') return false;
  const mod = value as Record<string, unknown>;
  const renderer = mod.renderer;
  const isValidRenderer = !!(renderer &&
    (typeof renderer === 'function' ||
      (typeof renderer === 'object' &&
        renderer !== null &&
        typeof (renderer as Record<string, unknown>).$$typeof === 'symbol')));
  return (
    typeof mod.id === 'string' &&
    isValidRenderer &&
    typeof mod.validate === 'function'
  );
}
