import type { AnyOverlayModule } from './types';
import { giftAlertOverlay } from './gift-alert';
import { GiftComboOverlay } from './gifts/GiftCombo';
import { coinJarProOverlay } from './coin-jar-pro';
import { goalProgressOverlay } from './goal-progress';
import { goalLikesOverlay } from './goal-likes';
import { goalFollowersOverlay } from './goal-followers';
import { goalGiftsOverlay } from './goal-gifts';

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
  giftAlertOverlay as unknown as AnyOverlayModule,
  // Gift Combo
  GiftComboOverlay as unknown as AnyOverlayModule,
  // Coin Jar Pro
  coinJarProOverlay as unknown as AnyOverlayModule,
  // Goal Likes (renamed from Goal Progress — fixed to likes only)
  goalProgressOverlay as unknown as AnyOverlayModule,
  // Goal Followers
  goalFollowersOverlay as unknown as AnyOverlayModule,
  // Goal Gifts
  goalGiftsOverlay as unknown as AnyOverlayModule,
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

/**
 * Load a registered overlay module by ID.
 * Returns a Promise resolving to the module, or null if not found.
 * Used by BrowserSourceApp to dynamically resolve overlays.
 */
export async function loadModule(id: string): Promise<AnyOverlayModule | null> {
  return byId.get(id) ?? null;
}
