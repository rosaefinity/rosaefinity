import type { AnyOverlayModule } from './types';
import { giftAlertOverlay } from './gift-alert';

// ─── Registry Builder ───

interface RegistryResult {
  /** Frozen array — the single source of truth */
  registry: readonly AnyOverlayModule[];
  /** Id -> module index */
  byId: ReadonlyMap<string, AnyOverlayModule>;
  /** category -> modules index */
  byCategory: ReadonlyMap<string, readonly AnyOverlayModule[]>;
}

/**
 * Builds a frozen registry array with pre-computed lookup Maps.
 * Throws immediately if any overlay ids are duplicated.
 *
 * Exported for testing and for future dynamic registration (if ever needed).
 */
export function registryBuilder(modules: AnyOverlayModule[]): RegistryResult {
  // ── Duplicate id detection ──
  const seen = new Set<string>();
  for (const mod of modules) {
    if (seen.has(mod.id)) {
      throw new Error(`Duplicate overlay id: "${mod.id}". Each overlay must have a unique id.`);
    }
    seen.add(mod.id);
  }

  // ── Freeze the array ──
  const frozen = Object.freeze([...modules]) as readonly AnyOverlayModule[];

  // ── Build byId index ──
  const byId = new Map<string, AnyOverlayModule>();
  for (const mod of frozen) {
    byId.set(mod.id, mod);
  }

  // ── Build byCategory index ──
  const byCategory = new Map<string, readonly AnyOverlayModule[]>();
  for (const mod of frozen) {
    const existing = byCategory.get(mod.category);
    if (existing) {
      // Categories are small sets; building frozen tuples is fine
      byCategory.set(mod.category, Object.freeze([...existing, mod]));
    } else {
      byCategory.set(mod.category, Object.freeze([mod]));
    }
  }

  return {
    registry: frozen,
    byId: byId as ReadonlyMap<string, AnyOverlayModule>,
    byCategory: byCategory as ReadonlyMap<string, readonly AnyOverlayModule[]>,
  };
}

// ─── Static Registry ───
// Import and add overlay modules here as they are created.

const _initialModules: AnyOverlayModule[] = [
  // Gift Alert
  giftAlertOverlay,
];

const { registry: overlayRegistry, byId, byCategory } = registryBuilder(_initialModules);

export { overlayRegistry };

// ─── Lookup Helpers (Map-based, O(1)) ───

/** Returns the overlay module with the given id, or undefined. */
export function getOverlayModule(id: string): AnyOverlayModule | undefined {
  return byId.get(id);
}

/** Returns all registered overlay modules. */
export function getOverlayModules(): readonly AnyOverlayModule[] {
  return overlayRegistry;
}

/** Returns overlay modules filtered by category. */
export function getOverlaysByCategory(category: string): readonly AnyOverlayModule[] {
  return byCategory.get(category) ?? [];
}

/** Boolean check for whether an overlay id is registered. */
export function hasOverlay(id: string): boolean {
  return byId.has(id);
}
