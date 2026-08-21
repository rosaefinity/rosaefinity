// =============================================
// RosaeFinity â€” Layer Renderer
// z-index ordering, grouping, visibility,
// locking, nesting, reusable scenes.
// =============================================

import type { OverlayInstance, OverlayScene, LayerGroup } from './types.js';

export class LayerRenderer {
  private overlays = new Map<string, OverlayInstance>();
  private groups = new Map<string, LayerGroup>();
  private scenes = new Map<string, OverlayScene>();
  private activeSceneId: string | null = null;
  private maxZIndex = 100;

  /** Add an overlay */
  addOverlay(overlay: OverlayInstance): void {
    this.overlays.set(overlay.id, { ...overlay });
    if (overlay.zIndex > this.maxZIndex) this.maxZIndex = overlay.zIndex;
  }

  /** Remove an overlay */
  removeOverlay(id: string): void {
    this.overlays.delete(id);
    // Remove from groups
    for (const group of this.groups.values()) {
      group.overlayIds = group.overlayIds.filter(oid => oid !== id);
    }
  }

  /** Update an overlay */
  updateOverlay(id: string, updates: Partial<OverlayInstance>): void {
    const overlay = this.overlays.get(id);
    if (overlay) {
      this.overlays.set(id, { ...overlay, ...updates, updatedAt: Date.now() });
    }
  }

  /** Get overlay by ID */
  getOverlay(id: string): OverlayInstance | undefined {
    return this.overlays.get(id);
  }

  /** Get all overlays sorted by z-index */
  getSortedOverlays(): OverlayInstance[] {
    return Array.from(this.overlays.values())
      .filter(o => o.visible)
      .sort((a, b) => a.zIndex - b.zIndex);
  }

  /** Get overlays for a scene */
  getSceneOverlays(sceneId: string): OverlayInstance[] {
    return this.getSortedOverlays().filter(o => o.sceneId === sceneId);
  }

  /** Bring to front */
  bringToFront(id: string): void {
    this.maxZIndex++;
    this.updateOverlay(id, { zIndex: this.maxZIndex });
  }

  /** Send to back */
  sendToBack(id: string): void {
    this.updateOverlay(id, { zIndex: 0 });
  }

  /** Bring forward */
  bringForward(id: string): void {
    const overlay = this.overlays.get(id);
    if (overlay) {
      this.updateOverlay(id, { zIndex: overlay.zIndex + 1 });
    }
  }

  /** Send backward */
  sendBackward(id: string): void {
    const overlay = this.overlays.get(id);
    if (overlay && overlay.zIndex > 0) {
      this.updateOverlay(id, { zIndex: overlay.zIndex - 1 });
    }
  }

  // â”€â”€ Groups â”€â”€

  createGroup(name: string): LayerGroup {
    const group: LayerGroup = {
      id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      visible: true,
      locked: false,
      overlayIds: [],
    };
    this.groups.set(group.id, group);
    return group;
  }

  addToGroup(groupId: string, overlayId: string): void {
    const group = this.groups.get(groupId);
    const overlay = this.overlays.get(overlayId);
    if (group && overlay) {
      group.overlayIds.push(overlayId);
      this.updateOverlay(overlayId, { groupId });
    }
  }

  toggleGroupVisibility(groupId: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.visible = !group.visible;
      for (const oid of group.overlayIds) {
        this.updateOverlay(oid, { visible: group.visible });
      }
    }
  }

  toggleGroupLock(groupId: string): void {
    const group = this.groups.get(groupId);
    if (group) {
      group.locked = !group.locked;
      for (const oid of group.overlayIds) {
        this.updateOverlay(oid, { locked: group.locked });
      }
    }
  }

  getGroups(): LayerGroup[] {
    return Array.from(this.groups.values());
  }

  // â”€â”€ Scenes â”€â”€

  createScene(name: string, description = ''): OverlayScene {
    const scene: OverlayScene = {
      id: `scene-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      description,
      overlayIds: [],
      overlays: [],
      visible: true,
      hotkey: null,
      isActive: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.scenes.set(scene.id, scene);
    return scene;
  }

  activateScene(sceneId: string): void {
    // Deactivate current
    if (this.activeSceneId) {
      const current = this.scenes.get(this.activeSceneId);
      if (current) current.isActive = false;
    }
    // Activate new
    const scene = this.scenes.get(sceneId);
    if (scene) {
      scene.isActive = true;
      this.activeSceneId = sceneId;
      // Show only overlays in this scene
      for (const overlay of this.overlays.values()) {
        this.updateOverlay(overlay.id, { visible: overlay.sceneId === sceneId });
      }
    }
  }

  deactivateAllScenes(): void {
    for (const scene of this.scenes.values()) {
      scene.isActive = false;
    }
    this.activeSceneId = null;
    // Show all overlays
    for (const overlay of this.overlays.values()) {
      this.updateOverlay(overlay.id, { visible: true });
    }
  }

  duplicateScene(sceneId: string, newName: string): OverlayScene | null {
    const scene = this.scenes.get(sceneId);
    if (!scene) return null;

    const newScene = this.createScene(newName, `Copy of ${scene.name}`);
    for (const overlay of scene.overlays) {
      const copy = { ...overlay, id: `ov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, sceneId: newScene.id };
      this.addOverlay(copy);
      newScene.overlays.push(copy);
    }
    return newScene;
  }

  exportScene(sceneId: string): string | null {
    const scene = this.scenes.get(sceneId);
    if (!scene) return null;
    const overlays = scene.overlays.map(o => this.overlays.get(o.id)).filter(Boolean);
    return JSON.stringify({ ...scene, overlays }, null, 2);
  }

  getActiveSceneId(): string | null { return this.activeSceneId; }
  getScenes(): OverlayScene[] { return Array.from(this.scenes.values()); }
  getScene(id: string): OverlayScene | undefined { return this.scenes.get(id); }

  /** Get stats */
  getStats() {
    return {
      overlayCount: this.overlays.size,
      groupCount: this.groups.size,
      sceneCount: this.scenes.size,
      activeSceneId: this.activeSceneId,
    };
  }
}
