// =============================================
// Dexie Overlay Repository — IndexedDB implementation
// of the OverlayRepository interface.
//
// Uses the overlays table defined in db.ts
// version(2).stores({ overlays: "id, name, updatedAt" })
// =============================================

import type { Overlay } from "../../types/overlay-types";
import type { OverlayRepository } from "./overlay-repository";
import { db } from "../../lib/db";

export class DexieOverlayRepository implements OverlayRepository {
  async save(overlay: Overlay): Promise<void> {
    await db.overlays.put(overlay);
  }

  async load(id: string): Promise<Overlay | null> {
    const result = await db.overlays.get(id);
    return result ?? null;
  }

  async delete(id: string): Promise<void> {
    await db.overlays.delete(id);
  }

  async list(): Promise<Overlay[]> {
    return await db.overlays.orderBy("updatedAt").reverse().toArray();
  }

  async update(id: string, patch: Partial<Overlay>): Promise<void> {
    const existing = await db.overlays.get(id);
    if (!existing) {
      throw new Error(`Overlay ${id} not found`);
    }
    await db.overlays.put({ ...existing, ...patch, id } as Overlay);
  }
}
