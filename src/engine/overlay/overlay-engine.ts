// =============================================
// Overlay Engine — Canonical state manager for
// all overlay mutations.
//
// Storage-agnostic: no React, no Dexie, no browser APIs.
// All mutations emit typed events via OverlayEventBus.
// Persistence remains external (OverlayPersistence listens).
//
// Usage:
//   const engine = new OverlayEngine();
//   engine.createOverlay("My Overlay");
//   engine.createScene(overlayId, "Scene 1");
//   engine.createWidget(overlayId, sceneId, "alert-card");
// =============================================

import type {
  Overlay,
  Scene,
  Widget,
  WidgetGroup,
  OverlayTheme,
  OverlaySettings,
  AnimationConfig,
  TransitionConfig,
} from "../../types/overlay-types";
import {
  DEFAULT_OVERLAY_THEME,
  DEFAULT_OVERLAY_SETTINGS,
  DEFAULT_TRANSITION,
} from "../../types/overlay-types";
import { overlayEvents } from "./overlay-events";

// ===== ID Generation =====

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

// ===== Validation Helpers =====

function requireOverlay(overlays: Map<string, Overlay>, id: string): Overlay {
  const overlay = overlays.get(id);
  if (!overlay) {
    throw new Error(`[OverlayEngine] Overlay not found: "${id}"`);
  }
  return overlay;
}

function requireScene(overlay: Overlay, sceneId: string): Scene {
  const scene = overlay.scenes.find((s) => s.id === sceneId);
  if (!scene) {
    throw new Error(`[OverlayEngine] Scene not found: "${sceneId}" in overlay "${overlay.id}"`);
  }
  return scene;
}

function requireWidget(scene: Scene, widgetId: string): Widget {
  const widget = scene.widgets.find((w) => w.id === widgetId);
  if (!widget) {
    throw new Error(`[OverlayEngine] Widget not found: "${widgetId}" in scene "${scene.id}"`);
  }
  return widget;
}

// ===== Immutable Helpers =====

function replaceInArray<T extends { id: string }>(arr: T[], id: string, replacement: T): T[] {
  return arr.map((item) => (item.id === id ? replacement : item));
}

function removeFromArray<T extends { id: string }>(arr: T[], id: string): T[] {
  return arr.filter((item) => item.id !== id);
}

function deepCloneOverlay(overlay: Overlay): Overlay {
  return JSON.parse(JSON.stringify(overlay));
}

// ===== Overlay Engine =====

export class OverlayEngine {
  private overlays: Map<string, Overlay> = new Map();

  // ─── Overlay CRUD ───────────────────────────────

  /**
   * Create a new overlay with default theme and settings.
   * Emits: overlay:created
   * @returns The created Overlay
   */
  createOverlay(name: string, options?: { description?: string }): Overlay {
    if (!name || name.trim().length === 0) {
      throw new Error("[OverlayEngine] Overlay name cannot be empty");
    }

    const now = new Date().toISOString();
    const id = generateId("ovl");
    const defaultSceneId = generateId("scn");

    const defaultScene: Scene = {
      id: defaultSceneId,
      name: "Default Scene",
      widgets: [],
      groups: [],
      visible: true,
      order: 0,
      transition: { ...DEFAULT_TRANSITION },
      background: "transparent",
    };

    const overlay: Overlay = {
      id,
      name: name.trim(),
      description: options?.description ?? "",
      version: 1,
      createdAt: now,
      updatedAt: now,
      activeSceneId: defaultSceneId,
      scenes: [defaultScene],
      theme: { ...DEFAULT_OVERLAY_THEME },
      settings: { ...DEFAULT_OVERLAY_SETTINGS },
    };

    this.overlays.set(id, overlay);
    overlayEvents.emit("overlay:created", { overlay: deepCloneOverlay(overlay) });
    return deepCloneOverlay(overlay);
  }

  /**
   * Delete an overlay and all its data.
   * Emits: overlay:deleted
   */
  deleteOverlay(id: string): void {
    requireOverlay(this.overlays, id);
    this.overlays.delete(id);
    overlayEvents.emit("overlay:deleted", { overlayId: id });
  }

  /**
   * Rename an overlay.
   * Emits: overlay:updated
   */
  renameOverlay(id: string, name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error("[OverlayEngine] Overlay name cannot be empty");
    }

    const overlay = requireOverlay(this.overlays, id);
    const updated = {
      ...overlay,
      name: name.trim(),
      updatedAt: new Date().toISOString(),
    };
    this.overlays.set(id, updated);
    overlayEvents.emit("overlay:updated", { overlay: deepCloneOverlay(updated) });
  }

  /**
   * Duplicate an overlay with new IDs for all nested entities.
   * Emits: overlay:created
   * @returns The duplicated Overlay
   */
  duplicateOverlay(id: string, newName?: string): Overlay {
    const source = requireOverlay(this.overlays, id);
    const cloned = deepCloneOverlay(source);
    const now = new Date().toISOString();

    // Generate new IDs for the overlay and all nested entities
    const newOverlayId = generateId("ovl");
    const idMap = new Map<string, string>();
    idMap.set(cloned.id, newOverlayId);

    cloned.id = newOverlayId;
    cloned.name = newName ?? `${source.name} Copy`;
    cloned.createdAt = now;
    cloned.updatedAt = now;

    // Remap scenes
    cloned.scenes = cloned.scenes.map((scene) => {
      const newSceneId = generateId("scn");
      idMap.set(scene.id, newSceneId);
      return {
        ...scene,
        id: newSceneId,
        widgets: scene.widgets.map((widget) => {
          const newWidgetId = generateId("wgt");
          idMap.set(widget.id, newWidgetId);
          return {
            ...widget,
            id: newWidgetId,
            groupId: widget.groupId ? idMap.get(widget.groupId) ?? widget.groupId : undefined,
          };
        }),
        groups: scene.groups.map((group) => {
          const newGroupId = generateId("grp");
          idMap.set(group.id, newGroupId);
          return {
            ...group,
            id: newGroupId,
            widgetIds: group.widgetIds.map((wid) => idMap.get(wid) ?? wid),
          };
        }),
      };
    });

    // Remap active scene ID
    cloned.activeSceneId = idMap.get(source.activeSceneId) ?? cloned.scenes[0]?.id ?? "";

    this.overlays.set(newOverlayId, cloned);
    overlayEvents.emit("overlay:created", { overlay: deepCloneOverlay(cloned) });
    return deepCloneOverlay(cloned);
  }

  // ─── Scene CRUD ─────────────────────────────────

  /**
   * Create a new scene in an overlay.
   * Emits: scene:created
   * @returns The created Scene
   */
  createScene(overlayId: string, name: string): Scene {
    const overlay = requireOverlay(this.overlays, overlayId);

    if (!name || name.trim().length === 0) {
      throw new Error("[OverlayEngine] Scene name cannot be empty");
    }

    const now = new Date().toISOString();
    const scene: Scene = {
      id: generateId("scn"),
      name: name.trim(),
      widgets: [],
      groups: [],
      visible: true,
      order: overlay.scenes.length,
      transition: { ...DEFAULT_TRANSITION },
      background: "transparent",
    };

    const updatedOverlay = {
      ...overlay,
      scenes: [...overlay.scenes, scene],
      updatedAt: now,
    };
    this.overlays.set(overlayId, updatedOverlay);
    overlayEvents.emit("scene:created", { overlayId, scene: deepCloneOverlay(scene) });
    return deepCloneOverlay(scene);
  }

  /**
   * Delete a scene from an overlay.
   * If it's the active scene, switches to the first remaining scene.
   * Emits: scene:deleted (and scene:switched if active scene changed)
   */
  deleteScene(overlayId: string, sceneId: string): void {
    const overlay = requireOverlay(this.overlays, overlayId);
    requireScene(overlay, sceneId);

    if (overlay.scenes.length <= 1) {
      throw new Error("[OverlayEngine] Cannot delete the last scene");
    }

    const now = new Date().toISOString();
    const remaining = removeFromArray(overlay.scenes, sceneId);

    // Reassign order values
    const reordered = remaining.map((s, i) => ({ ...s, order: i }));

    const updatedOverlay: Overlay = {
      ...overlay,
      scenes: reordered,
      activeSceneId: overlay.activeSceneId === sceneId ? reordered[0].id : overlay.activeSceneId,
      updatedAt: now,
    };

    this.overlays.set(overlayId, updatedOverlay);
    overlayEvents.emit("scene:deleted", { overlayId, sceneId });

    // If active scene changed, emit switch event
    if (overlay.activeSceneId === sceneId) {
      overlayEvents.emit("scene:switched", { overlayId, sceneId: reordered[0].id });
    }
  }

  /**
   * Reorder scenes within an overlay.
   * The provided sceneIds array defines the new order.
   * Emits: overlay:updated
   */
  reorderScenes(overlayId: string, sceneIds: string[]): void {
    const overlay = requireOverlay(this.overlays, overlayId);

    // Validate all IDs exist
    for (const sid of sceneIds) {
      requireScene(overlay, sid);
    }

    if (sceneIds.length !== overlay.scenes.length) {
      throw new Error("[OverlayEngine] Reorder array must include all scenes");
    }

    const now = new Date().toISOString();
    const reordered = sceneIds.map((sid, i) => {
      const scene = overlay.scenes.find((s) => s.id === sid)!;
      return { ...scene, order: i };
    });

    const updatedOverlay: Overlay = {
      ...overlay,
      scenes: reordered,
      updatedAt: now,
    };
    this.overlays.set(overlayId, updatedOverlay);
    overlayEvents.emit("overlay:updated", { overlay: deepCloneOverlay(updatedOverlay) });
  }

  /**
   * Switch the active scene in an overlay.
   * Emits: scene:switched
   */
  switchScene(overlayId: string, sceneId: string): void {
    const overlay = requireOverlay(this.overlays, overlayId);
    requireScene(overlay, sceneId);

    const now = new Date().toISOString();
    const updatedOverlay: Overlay = {
      ...overlay,
      activeSceneId: sceneId,
      updatedAt: now,
    };
    this.overlays.set(overlayId, updatedOverlay);
    overlayEvents.emit("scene:switched", { overlayId, sceneId });
  }

  // ─── Widget CRUD ────────────────────────────────

  /**
   * Create a new widget in a scene.
   * Emits: widget:created
   * @returns The created Widget
   */
  createWidget(
    overlayId: string,
    sceneId: string,
    type: string,
    config?: Partial<Widget>,
  ): Widget {
    const overlay = requireOverlay(this.overlays, overlayId);
    const scene = requireScene(overlay, sceneId);

    if (!type || type.trim().length === 0) {
      throw new Error("[OverlayEngine] Widget type cannot be empty");
    }

    const now = new Date().toISOString();
    const maxZ = scene.widgets.reduce((max, w) => Math.max(max, w.zIndex), 0);

    const widget: Widget = {
      id: generateId("wgt"),
      type: type.trim(),
      x: config?.x ?? 100,
      y: config?.y ?? 100,
      width: config?.width ?? 200,
      height: config?.height ?? 100,
      rotation: config?.rotation ?? 0,
      zIndex: config?.zIndex ?? maxZ + 1,
      locked: config?.locked ?? false,
      visible: config?.visible ?? true,
      groupId: config?.groupId,
      props: config?.props ?? {},
      animations: config?.animations ?? [],
    };

    const updatedScene: Scene = {
      ...scene,
      widgets: [...scene.widgets, widget],
    };
    const updatedOverlay = this.updateSceneInOverlay(overlay, updatedScene, now);
    this.overlays.set(overlayId, updatedOverlay);
    overlayEvents.emit("widget:created", { overlayId, sceneId, widget: deepCloneOverlay(widget) });
    return deepCloneOverlay(widget);
  }

  /**
   * Update properties of an existing widget.
   * Emits: widget:updated
   */
  updateWidget(
    overlayId: string,
    sceneId: string,
    widgetId: string,
    changes: Partial<Omit<Widget, "id">>,
  ): void {
    const overlay = requireOverlay(this.overlays, overlayId);
    const scene = requireScene(overlay, sceneId);
    const existing = requireWidget(scene, widgetId);

    const now = new Date().toISOString();
    const updatedWidget: Widget = { ...existing, ...changes, id: widgetId };
    const updatedScene: Scene = {
      ...scene,
      widgets: replaceInArray(scene.widgets, widgetId, updatedWidget),
    };
    const updatedOverlay = this.updateSceneInOverlay(overlay, updatedScene, now);
    this.overlays.set(overlayId, updatedOverlay);
    overlayEvents.emit("widget:updated", { overlayId, sceneId, widget: deepCloneOverlay(updatedWidget) });
  }

  /**
   * Delete a widget from a scene.
   * Also removes the widget from any group it belongs to.
   * Emits: widget:deleted
   */
  deleteWidget(overlayId: string, sceneId: string, widgetId: string): void {
    const overlay = requireOverlay(this.overlays, overlayId);
    const scene = requireScene(overlay, sceneId);
    requireWidget(scene, widgetId);

    const now = new Date().toISOString();

    // Remove widget from any group
    const updatedGroups = scene.groups.map((g) => ({
      ...g,
      widgetIds: g.widgetIds.filter((wid) => wid !== widgetId),
    }));

    const updatedScene: Scene = {
      ...scene,
      widgets: removeFromArray(scene.widgets, widgetId),
      groups: updatedGroups,
    };
    const updatedOverlay = this.updateSceneInOverlay(overlay, updatedScene, now);
    this.overlays.set(overlayId, updatedOverlay);
    overlayEvents.emit("widget:deleted", { overlayId, sceneId, widgetId });
  }

  /**
   * Duplicate a widget within the same scene.
   * Emits: widget:created
   * @returns The duplicated Widget
   */
  duplicateWidget(overlayId: string, sceneId: string, widgetId: string): Widget {
    const overlay = requireOverlay(this.overlays, overlayId);
    const scene = requireScene(overlay, sceneId);
    const source = requireWidget(scene, widgetId);

    const cloned = deepCloneOverlay(source) as Widget;
    cloned.id = generateId("wgt");
    cloned.x += 20;
    cloned.y += 20;
    cloned.locked = false;

    // Insert after source widget in z-order
    const maxZ = scene.widgets.reduce((max, w) => Math.max(max, w.zIndex), 0);
    cloned.zIndex = maxZ + 1;

    const now = new Date().toISOString();
    const updatedScene: Scene = {
      ...scene,
      widgets: [...scene.widgets, cloned],
    };
    const updatedOverlay = this.updateSceneInOverlay(overlay, updatedScene, now);
    this.overlays.set(overlayId, updatedOverlay);
    overlayEvents.emit("widget:created", { overlayId, sceneId, widget: deepCloneOverlay(cloned) });
    return deepCloneOverlay(cloned);
  }

  // ─── Widget Grouping ────────────────────────────

  /**
   * Group multiple widgets together.
   * Emits: overlay:updated
   * @returns The created WidgetGroup
   */
  groupWidgets(
    overlayId: string,
    sceneId: string,
    widgetIds: string[],
    name: string,
  ): WidgetGroup {
    const overlay = requireOverlay(this.overlays, overlayId);
    const scene = requireScene(overlay, sceneId);

    if (widgetIds.length < 2) {
      throw new Error("[OverlayEngine] Group requires at least 2 widgets");
    }

    if (!name || name.trim().length === 0) {
      throw new Error("[OverlayEngine] Group name cannot be empty");
    }

    // Validate all widget IDs exist
    for (const wid of widgetIds) {
      requireWidget(scene, wid);
    }

    // Check no widget is already in another group
    for (const wid of widgetIds) {
      const widget = scene.widgets.find((w) => w.id === wid)!;
      if (widget.groupId) {
        throw new Error(`[OverlayEngine] Widget "${wid}" is already in group "${widget.groupId}"`);
      }
    }

    const group: WidgetGroup = {
      id: generateId("grp"),
      name: name.trim(),
      widgetIds: [...widgetIds],
      locked: false,
    };

    // Assign groupId to all widgets
    const updatedWidgets = scene.widgets.map((w) =>
      widgetIds.includes(w.id) ? { ...w, groupId: group.id } : w,
    );

    const now = new Date().toISOString();
    const updatedScene: Scene = {
      ...scene,
      widgets: updatedWidgets,
      groups: [...scene.groups, group],
    };
    const updatedOverlay = this.updateSceneInOverlay(overlay, updatedScene, now);
    this.overlays.set(overlayId, updatedOverlay);
    overlayEvents.emit("overlay:updated", { overlay: deepCloneOverlay(updatedOverlay) });
    return deepCloneOverlay(group);
  }

  /**
   * Ungroup all widgets in a group. Removes the group.
   * Emits: overlay:updated
   */
  ungroupWidgets(overlayId: string, sceneId: string, groupId: string): void {
    const overlay = requireOverlay(this.overlays, overlayId);
    const scene = requireScene(overlay, sceneId);

    const group = scene.groups.find((g) => g.id === groupId);
    if (!group) {
      throw new Error(`[OverlayEngine] Group not found: "${groupId}"`);
    }

    // Remove groupId from all widgets in the group
    const updatedWidgets = scene.widgets.map((w) =>
      w.groupId === groupId ? { ...w, groupId: undefined } : w,
    );

    const now = new Date().toISOString();
    const updatedScene: Scene = {
      ...scene,
      widgets: updatedWidgets,
      groups: removeFromArray(scene.groups, groupId),
    };
    const updatedOverlay = this.updateSceneInOverlay(overlay, updatedScene, now);
    this.overlays.set(overlayId, updatedOverlay);
    overlayEvents.emit("overlay:updated", { overlay: deepCloneOverlay(updatedOverlay) });
  }

  // ─── Query Methods ──────────────────────────────

  /**
   * Get a copy of an overlay by ID.
   * Returns null if not found.
   */
  getOverlay(id: string): Overlay | null {
    const overlay = this.overlays.get(id);
    return overlay ? deepCloneOverlay(overlay) : null;
  }

  /**
   * List all overlays.
   */
  listOverlays(): Overlay[] {
    return Array.from(this.overlays.values()).map(deepCloneOverlay);
  }

  /**
   * Get a scene from an overlay.
   * Returns null if not found.
   */
  getScene(overlayId: string, sceneId: string): Scene | null {
    const overlay = this.overlays.get(overlayId);
    if (!overlay) return null;
    const scene = overlay.scenes.find((s) => s.id === sceneId);
    return scene ? deepCloneOverlay(scene) : null;
  }

  /**
   * Get a widget from a scene.
   * Returns null if not found.
   */
  getWidget(overlayId: string, sceneId: string, widgetId: string): Widget | null {
    const overlay = this.overlays.get(overlayId);
    if (!overlay) return null;
    const scene = overlay.scenes.find((s) => s.id === sceneId);
    if (!scene) return null;
    const widget = scene.widgets.find((w) => w.id === widgetId);
    return widget ? deepCloneOverlay(widget) : null;
  }

  /**
   * Get the active scene for an overlay.
   */
  getActiveScene(overlayId: string): Scene | null {
    const overlay = this.overlays.get(overlayId);
    if (!overlay) return null;
    const scene = overlay.scenes.find((s) => s.id === overlay.activeSceneId);
    return scene ? deepCloneOverlay(scene) : null;
  }

  // ─── Bulk Load ──────────────────────────────────

  /**
   * Load an overlay into the engine's in-memory state.
   * Used by persistence layer on application startup.
   * Does NOT emit events (load is not a mutation).
   */
  loadOverlay(overlay: Overlay): void {
    this.overlays.set(overlay.id, overlay);
  }

  /**
   * Load multiple overlays into the engine's in-memory state.
   * Used by persistence layer on application startup.
   */
  loadOverlays(overlays: Overlay[]): void {
    for (const overlay of overlays) {
      this.overlays.set(overlay.id, overlay);
    }
  }

  /**
   * Clear all in-memory state.
   * Used for testing or full reset.
   */
  clear(): void {
    this.overlays.clear();
  }

  // ─── Private Helpers ────────────────────────────

  private updateSceneInOverlay(overlay: Overlay, scene: Scene, updatedAt: string): Overlay {
    return {
      ...overlay,
      scenes: replaceInArray(overlay.scenes, scene.id, scene),
      updatedAt,
    };
  }
}
