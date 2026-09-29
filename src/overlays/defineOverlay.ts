// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — defineOverlay()
// v3.1 Architecture Spec (Frozen)
// ─────────────────────────────────────────────────────

import { OVERLAY_CATEGORIES } from './base/constants';
import type { AnyOverlayModule, OverlayModule, FlatOverlayInput, LegacyOverlayInput, OverlayMetadata } from './types';

/**
 * Validates an overlay module definition at registration time.
 * Supports both flat (Gen 2) and legacy nested (Gen 1) APIs.
 * Returns the normalized OverlayModule if valid, throws if invalid.
 */
export function defineOverlay<TConfig extends object>(
  input: OverlayModule<TConfig> | FlatOverlayInput<TConfig> | LegacyOverlayInput<TConfig>,
): OverlayModule<TConfig> {
  // ── Detect API generation ──
  const isLegacy = !!(input as Record<string, unknown>).metadata?.id &&
    typeof (input as Record<string, unknown>).validateConfig === 'function';

  let module: OverlayModule<TConfig>;

  if (isLegacy) {
    // ── Legacy (Gen 1) nested API normalization ──
    const legacy = input as LegacyOverlayInput<any>;
    const meta = legacy.metadata;

    // Normalize legacy fields to flat structure
    module = {
      id: meta.id,
      name: meta.name,
      description: meta.description,
      category: meta.category,
      icon: meta.icon,
      tags: meta.tags,
      supportsBrowserSource: meta.supportsBrowserSource,
      supportsPreview: meta.supportsPreview,
      version: typeof meta.version === 'string' ? (parseInt(meta.version, 10) || 1) : (meta.version ?? 1),
      renderer: legacy.renderer,
      settingsSchema: legacy.settingsSchema,
      defaultConfig: legacy.defaultConfig,
      configVersion: meta.configVersion,
      // Function name aliases (same signatures)
      validate: legacy.validateConfig,
      sanitize: legacy.sanitizeConfig,
      migrate: legacy.migrateConfig,
      // Preserve ALL original metadata for Studio/Preview consumers
      metadata: { ...meta } as OverlayMetadata,
      // Lifecycle (not in legacy API, but keep optional)
      onCreate: undefined,
      onDestroy: undefined,
      onEvent: undefined,
    };
  } else {
    // ── Flat (Gen 2) API — normalize and ensure metadata ──
    const flat = input as FlatOverlayInput<any> | OverlayModule<any>;
    module = { ...flat } as OverlayModule<any>;

    // Ensure metadata exists for Studio/Preview consumers
    if (!module.metadata) {
      module.metadata = {};
    }

    // Auto-populate metadata from flat properties for Studio consumers
    const md = module.metadata!;
    md.id = md.id ?? module.id;
    md.name = md.name ?? module.name;
    md.description = md.description ?? module.description;
    md.category = md.category ?? module.category;
    md.tags = md.tags ?? module.tags;
    md.icon = md.icon ?? module.icon;
    md.version = md.version ?? module.version;
    md.configVersion = md.configVersion ?? module.configVersion;
    md.supportsBrowserSource = md.supportsBrowserSource ?? module.supportsBrowserSource;
    md.supportsPreview = md.supportsPreview ?? module.supportsPreview;
    md.premium = md.premium ?? false;
    md.beta = md.beta ?? false;
    md.featured = md.featured ?? false;

    // Ensure function properties exist
    if (!module.validate) throw new Error('validate function missing');
    if (!module.sanitize) throw new Error('sanitize function missing');
    if (!module.migrate) throw new Error('migrate function missing');
  }

  // ── Run existing validation AFTER normalization ──
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

  return module as OverlayModule<any>;
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