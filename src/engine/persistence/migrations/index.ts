// =============================================
// Migration Runner — Centralized schema migration
//
// Each version has its own migration file in
// this directory. The runner reads the overlay's
// current version and applies migrations
// sequentially until the current schema version.
// =============================================

import type { Overlay } from "../../../types/overlay-types";
import { CURRENT_VERSION, migrateToV1 } from "./v1-initial";

// Migration registry — add new migrations here
const migrations: Record<number, (overlay: Overlay) => Overlay> = {
  1: migrateToV1,
};

/**
 * Migrate an overlay to the current schema version.
 * Runs migrations sequentially from (currentVersion + 1) to CURRENT_VERSION.
 */
export async function migrateOverlay(overlay: Overlay): Promise<Overlay> {
  let current = overlay.version || 0;

  while (current < CURRENT_VERSION) {
    const migration = migrations[current + 1];
    if (migration) {
      overlay = migration(overlay);
      current++;
    } else {
      console.warn(`[Migration] No migration found for version ${current + 1}`);
      break;
    }
  }

  overlay.version = CURRENT_VERSION;
  return overlay;
}

/**
 * Check if an overlay needs migration.
 */
export function needsMigration(overlay: Overlay): boolean {
  return (overlay.version || 0) < CURRENT_VERSION;
}
