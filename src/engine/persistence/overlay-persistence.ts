// =============================================
// Overlay Persistence — Event-driven persistence layer
//
// Subscribes to overlayEvents and auto-saves
// with debouncing. Uses injected repository for
// storage-agnostic persistence.
//
// Usage:
//   const repo = new DexieOverlayRepository();
//   const persistence = new OverlayPersistence(repo);
//   persistence.init(); // starts listening to events
//   persistence.destroy(); // stops listening
// =============================================

import type { Overlay } from "../../types/overlay-types";
import type { OverlayRepository } from "./overlay-repository";
import { overlayEvents } from "../overlay/overlay-events";
import { migrateOverlay, needsMigration } from "./migrations";

const AUTOSAVE_DEBOUNCE_MS = 500;

export class OverlayPersistence {
  private repository: OverlayRepository;
  private dirtyOverlays: Map<string, Overlay> = new Map();
  private deletedIds: Set<string> = new Set();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribers: (() => void)[] = [];
  private initialized = false;

  constructor(repository: OverlayRepository) {
    this.repository = repository;
  }

  /**
   * Start listening to overlay events.
   * Call once at application startup.
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.unsubscribers.push(
      overlayEvents.on("overlay:created", (data) => {
        this.enqueueSaveOverlay(data.overlay);
      }),
      overlayEvents.on("overlay:updated", (data) => {
        this.enqueueSaveOverlay(data.overlay);
      }),
      overlayEvents.on("overlay:deleted", (data) => {
        this.deletedIds.add(data.overlayId);
        this.dirtyOverlays.delete(data.overlayId);
        this.repository.delete(data.overlayId).catch((err) => {
          console.error("[Persistence] Failed to delete overlay:", err);
        });
      }),
      overlayEvents.on("scene:created", (data) => {
        this.enqueueSaveById(data.overlayId);
      }),
      overlayEvents.on("scene:deleted", (data) => {
        this.enqueueSaveById(data.overlayId);
      }),
      overlayEvents.on("scene:updated", (data) => {
        this.enqueueSaveById(data.overlayId);
      }),
      overlayEvents.on("scene:switched", (data) => {
        this.enqueueSaveById(data.overlayId);
      }),
      overlayEvents.on("widget:created", (data) => {
        this.enqueueSaveById(data.overlayId);
      }),
      overlayEvents.on("widget:deleted", (data) => {
        this.enqueueSaveById(data.overlayId);
      }),
      overlayEvents.on("widget:updated", (data) => {
        this.enqueueSaveById(data.overlayId);
      }),
    );
  }

  /**
   * Stop listening to events and flush pending saves.
   * Call on application shutdown.
   */
  async destroy(): Promise<void> {
    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers = [];

    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    // Flush any pending saves
    await this.flush();
  }

  /**
   * Manually load an overlay by ID.
   * Runs migration if needed.
   */
  async load(id: string): Promise<Overlay | null> {
    const overlay = await this.repository.load(id);
    if (!overlay) return null;

    if (needsMigration(overlay)) {
      const migrated = await migrateOverlay(overlay);
      await this.repository.save(migrated);
      return migrated;
    }

    return overlay;
  }

  /**
   * Manually save an overlay.
   * Migrates if needed before saving.
   */
  async save(overlay: Overlay): Promise<void> {
    if (needsMigration(overlay)) {
      overlay = await migrateOverlay(overlay);
    }
    await this.repository.save(overlay);
  }

  /**
   * List all overlays.
   */
  async list(): Promise<Overlay[]> {
    const overlays = await this.repository.list();
    // Migrate any outdated overlays
    const migrated = await Promise.all(
      overlays.map(async (o) => {
        if (needsMigration(o)) {
          const m = await migrateOverlay(o);
          await this.repository.save(m);
          return m;
        }
        return o;
      })
    );
    return migrated;
  }

  /**
   * Delete an overlay.
   */
  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  // ===== Private Methods =====

  /**
   * Enqueue a full overlay for deferred save.
   * Used when events carry the complete overlay data (created, updated).
   */
  private enqueueSaveOverlay(overlay: Overlay): void {
    this.dirtyOverlays.set(overlay.id, overlay);
    this.scheduleSave();
  }

  /**
   * Enqueue an overlay ID for save.
   * Used for scene/widget events that don't carry full overlay data.
   * The overlay will be loaded from the repository during flush.
   */
  private enqueueSaveById(overlayId: string): void {
    if (!this.dirtyOverlays.has(overlayId)) {
      this.dirtyOverlays.set(overlayId, null as unknown as Overlay);
    }
    this.scheduleSave();
  }

  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.flush().catch((err) => {
        console.error("[Persistence] Auto-save flush failed:", err);
      });
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  /**
   * Flush all pending overlay saves to the repository.
   * Overlays with full data are saved directly.
   * Overlays with only IDs are loaded from the repository first.
   * Skips overlays deleted during the flush cycle.
   * Re-queues failed saves for the next flush attempt.
   */
  private async flush(): Promise<void> {
    if (this.dirtyOverlays.size === 0) return;

    const entries = Array.from(this.dirtyOverlays.entries());
    this.dirtyOverlays.clear();

    const failed: [string, Overlay][] = [];

    for (const [id, overlay] of entries) {
      // Skip overlays that were deleted during this flush cycle
      if (this.deletedIds.has(id)) {
        this.deletedIds.delete(id);
        continue;
      }

      try {
        if (overlay) {
          // Full overlay data available — save directly
          await this.repository.save(overlay);
        } else {
          // Only ID available — load from repository, then save back.
          // This handles scene/widget events where the overlay data
          // needs to be re-read from the engine's in-memory state.
          const existing = await this.repository.load(id);
          if (existing) {
            await this.repository.save(existing);
          }
        }
      } catch (err) {
        console.error(`[Persistence] Failed to save overlay ${id}:`, err);
        failed.push([id, overlay]);
      }
    }

    // Re-queue failed saves for the next flush cycle
    if (failed.length > 0) {
      for (const [id, overlay] of failed) {
        this.dirtyOverlays.set(id, overlay);
      }
      this.scheduleSave();
    }
  }
}
