// =============================================
// Migration v1 — Initial overlay schema
//
// This migration creates the initial overlay
// structure. Since overlays are new, this is
// a no-op migration that just ensures the
// version field is set.
// =============================================

import type { Overlay } from "../../../types/overlay-types";

export const CURRENT_VERSION = 1;

export function migrateToV1(overlay: Overlay): Overlay {
  // v1 is the initial schema — ensure version is set
  return {
    ...overlay,
    version: 1,
  };
}
