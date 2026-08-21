// =============================================
// Editor State — Transient editor state manager.
//
// Manages ONLY editor UI state (selection, viewport,
// tools, clipboard, preferences). NEVER stores overlay data.
//
// Storage-agnostic: no React, no Dexie, no browser APIs.
// All mutations emit typed events via EditorEventBus.
// =============================================

import { editorEvents } from "./editor-events";

// ===== Types =====

export type EditorTool =
  | "select"
  | "move"
  | "resize"
  | "rotate"
  | "text"
  | "shape";

export interface EditorState {
  selectedOverlayId: string | null;
  selectedSceneId: string | null;
  selectedWidgetIds: string[];
  activeTool: EditorTool;
  zoom: number;
  panX: number;
  panY: number;
  gridVisible: boolean;
  snapToGrid: boolean;
  rulerVisible: boolean;
  clipboardWidgetIds: string[];
}

// ===== Constants =====

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 5.0;
export const ZOOM_STEP = 0.1;

export const VALID_TOOLS: EditorTool[] = [
  "select", "move", "resize", "rotate", "text", "shape",
];

export const DEFAULT_EDITOR_STATE: EditorState = {
  selectedOverlayId: null,
  selectedSceneId: null,
  selectedWidgetIds: [],
  activeTool: "select",
  zoom: 1.0,
  panX: 0,
  panY: 0,
  gridVisible: true,
  snapToGrid: true,
  rulerVisible: false,
  clipboardWidgetIds: [],
};

// ===== Validation Helpers =====

function validateTool(tool: string): EditorTool {
  if (!VALID_TOOLS.includes(tool as EditorTool)) {
    throw new Error(
      `[EditorState] Invalid tool: "${tool}". Valid tools: ${VALID_TOOLS.join(", ")}`,
    );
  }
  return tool as EditorTool;
}

function validateZoom(zoom: number): void {
  if (typeof zoom !== "number" || Number.isNaN(zoom)) {
    throw new Error("[EditorState] Zoom cannot be NaN");
  }
  if (!Number.isFinite(zoom)) {
    throw new Error("[EditorState] Zoom cannot be Infinity");
  }
  if (zoom < MIN_ZOOM) {
    throw new Error(`[EditorState] Zoom ${zoom} is below minimum ${MIN_ZOOM}`);
  }
  if (zoom > MAX_ZOOM) {
    throw new Error(`[EditorState] Zoom ${zoom} is above maximum ${MAX_ZOOM}`);
  }
}

function validateWidgetIds(ids: string[]): void {
  for (const id of ids) {
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      throw new Error("[EditorState] Widget ID cannot be empty");
    }
  }
  // Check for duplicates
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`[EditorState] Duplicate widget ID: "${id}"`);
    }
    seen.add(id);
  }
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// ===== Editor State Manager =====

export class EditorStateManager {
  private state: EditorState = { ...DEFAULT_EDITOR_STATE };

  /**
   * Get a deep copy of the current editor state.
   */
  getState(): EditorState {
    return deepClone(this.state);
  }

  // ─── Overlay / Scene Selection ──────────────────

  /**
   * Select an overlay. Clears widget selection.
   * Emits: selection:changed
   */
  selectOverlay(overlayId: string | null): void {
    const prev = this.state;
    this.state = {
      ...this.state,
      selectedOverlayId: overlayId,
      selectedWidgetIds: [],
    };
    this.emitSelectionIfChanged(prev);
  }

  /**
   * Select a scene. Clears widget selection.
   * Emits: selection:changed
   */
  selectScene(sceneId: string | null): void {
    const prev = this.state;
    this.state = {
      ...this.state,
      selectedSceneId: sceneId,
      selectedWidgetIds: [],
    };
    this.emitSelectionIfChanged(prev);
  }

  // ─── Tool ──────────────────────────────────────

  /**
   * Set the active editor tool.
   * Emits: tool:changed
   */
  setTool(tool: string): void {
    const validated = validateTool(tool);
    if (this.state.activeTool === validated) return;

    const prev = this.state;
    this.state = { ...this.state, activeTool: validated };
    editorEvents.emit("tool:changed", { tool: validated });
  }

  // ─── Viewport ──────────────────────────────────

  /**
   * Set zoom level. Clamps to [MIN_ZOOM, MAX_ZOOM].
   * Emits: viewport:changed
   */
  setZoom(zoom: number): void {
    validateZoom(zoom);
    const clamped = Math.round(zoom * 100) / 100;
    if (this.state.zoom === clamped) return;

    const prev = this.state;
    this.state = { ...this.state, zoom: clamped };
    this.emitViewportIfChanged(prev);
  }

  /**
   * Zoom in by ZOOM_STEP.
   * Emits: viewport:changed
   */
  zoomIn(): void {
    this.setZoom(Math.min(this.state.zoom + ZOOM_STEP, MAX_ZOOM));
  }

  /**
   * Zoom out by ZOOM_STEP.
   * Emits: viewport:changed
   */
  zoomOut(): void {
    this.setZoom(Math.max(this.state.zoom - ZOOM_STEP, MIN_ZOOM));
  }

  /**
   * Set pan position.
   * Emits: viewport:changed
   */
  pan(x: number, y: number): void {
    if (typeof x !== "number" || typeof y !== "number" || Number.isNaN(x) || Number.isNaN(y)) {
      throw new Error("[EditorState] Pan coordinates cannot be NaN");
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("[EditorState] Pan coordinates cannot be Infinity");
    }
    if (this.state.panX === x && this.state.panY === y) return;

    const prev = this.state;
    this.state = { ...this.state, panX: x, panY: y };
    this.emitViewportIfChanged(prev);
  }

  /**
   * Center the viewport at origin (0, 0).
   * Emits: viewport:changed
   */
  center(): void {
    this.pan(0, 0);
  }

  /**
   * Reset viewport to default values.
   * Emits: viewport:changed
   */
  resetViewport(): void {
    const prev = this.state;
    this.state = { ...this.state, zoom: 1.0, panX: 0, panY: 0 };
    this.emitViewportIfChanged(prev);
  }

  /**
   * Fit viewport to screen. Sets zoom to 1.0 and pans to (0, 0).
   * In a real implementation this would calculate from canvas dimensions.
   * Emits: viewport:changed
   */
  fitScreen(): void {
    this.resetViewport();
  }

  // ─── Preferences ───────────────────────────────

  /**
   * Show the grid.
   * Emits: preferences:changed
   */
  showGrid(): void {
    if (this.state.gridVisible) return;
    const prev = this.state;
    this.state = { ...this.state, gridVisible: true };
    this.emitPreferencesIfChanged(prev);
  }

  /**
   * Hide the grid.
   * Emits: preferences:changed
   */
  hideGrid(): void {
    if (!this.state.gridVisible) return;
    const prev = this.state;
    this.state = { ...this.state, gridVisible: false };
    this.emitPreferencesIfChanged(prev);
  }

  /**
   * Toggle grid visibility.
   * Emits: preferences:changed
   */
  toggleGrid(): void {
    if (this.state.gridVisible) {
      this.hideGrid();
    } else {
      this.showGrid();
    }
  }

  /**
   * Enable snap to grid.
   * Emits: preferences:changed
   */
  enableSnap(): void {
    if (this.state.snapToGrid) return;
    const prev = this.state;
    this.state = { ...this.state, snapToGrid: true };
    this.emitPreferencesIfChanged(prev);
  }

  /**
   * Disable snap to grid.
   * Emits: preferences:changed
   */
  disableSnap(): void {
    if (!this.state.snapToGrid) return;
    const prev = this.state;
    this.state = { ...this.state, snapToGrid: false };
    this.emitPreferencesIfChanged(prev);
  }

  /**
   * Toggle snap to grid.
   * Emits: preferences:changed
   */
  toggleSnap(): void {
    if (this.state.snapToGrid) {
      this.disableSnap();
    } else {
      this.enableSnap();
    }
  }

  /**
   * Show the ruler.
   * Emits: preferences:changed
   */
  showRuler(): void {
    if (this.state.rulerVisible) return;
    const prev = this.state;
    this.state = { ...this.state, rulerVisible: true };
    this.emitPreferencesIfChanged(prev);
  }

  /**
   * Hide the ruler.
   * Emits: preferences:changed
   */
  hideRuler(): void {
    if (!this.state.rulerVisible) return;
    const prev = this.state;
    this.state = { ...this.state, rulerVisible: false };
    this.emitPreferencesIfChanged(prev);
  }

  // ─── Reset ─────────────────────────────────────

  /**
   * Reset entire editor state to defaults.
   * Emits: selection:changed, viewport:changed, tool:changed, preferences:changed
   */
  reset(): void {
    const prev = this.state;
    this.state = { ...DEFAULT_EDITOR_STATE };

    // Emit all events if anything changed
    if (prev.selectedOverlayId !== null || prev.selectedSceneId !== null || prev.selectedWidgetIds.length > 0) {
      editorEvents.emit("selection:changed", {
        selectedOverlayId: null,
        selectedSceneId: null,
        selectedWidgetIds: [],
      });
    }
    if (prev.zoom !== 1.0 || prev.panX !== 0 || prev.panY !== 0) {
      editorEvents.emit("viewport:changed", { zoom: 1.0, panX: 0, panY: 0 });
    }
    if (prev.activeTool !== "select") {
      editorEvents.emit("tool:changed", { tool: "select" });
    }
    if (prev.gridVisible !== true || prev.snapToGrid !== true || prev.rulerVisible !== false) {
      editorEvents.emit("preferences:changed", { gridVisible: true, snapToGrid: true, rulerVisible: false });
    }
  }

  // ─── Selection (internal, used by SelectionManager) ──

  /**
   * Set the selected widget IDs. Used internally by SelectionManager.
   * Emits: selection:changed
   */
  setSelectedWidgets(ids: string[]): void {
    const prev = this.state;
    this.state = { ...this.state, selectedWidgetIds: [...ids] };
    this.emitSelectionIfChanged(prev);
  }

  // ─── Clipboard (internal, used by ClipboardManager) ──

  /**
   * Set the clipboard widget IDs. Used internally by ClipboardManager.
   * Emits: clipboard:changed
   */
  setClipboardWidgetIds(ids: string[]): void {
    const prev = this.state;
    this.state = { ...this.state, clipboardWidgetIds: [...ids] };
    if (JSON.stringify(prev.clipboardWidgetIds) !== JSON.stringify(ids)) {
      editorEvents.emit("clipboard:changed", { clipboardWidgetIds: [...ids] });
    }
  }

  // ─── Private Helpers ────────────────────────────

  private emitSelectionIfChanged(prev: EditorState): void {
    if (
      prev.selectedOverlayId === this.state.selectedOverlayId &&
      prev.selectedSceneId === this.state.selectedSceneId &&
      JSON.stringify(prev.selectedWidgetIds) === JSON.stringify(this.state.selectedWidgetIds)
    ) {
      return;
    }
    editorEvents.emit("selection:changed", {
      selectedOverlayId: this.state.selectedOverlayId,
      selectedSceneId: this.state.selectedSceneId,
      selectedWidgetIds: [...this.state.selectedWidgetIds],
    });
  }

  private emitViewportIfChanged(prev: EditorState): void {
    if (
      prev.zoom === this.state.zoom &&
      prev.panX === this.state.panX &&
      prev.panY === this.state.panY
    ) {
      return;
    }
    editorEvents.emit("viewport:changed", {
      zoom: this.state.zoom,
      panX: this.state.panX,
      panY: this.state.panY,
    });
  }

  private emitPreferencesIfChanged(prev: EditorState): void {
    if (
      prev.gridVisible === this.state.gridVisible &&
      prev.snapToGrid === this.state.snapToGrid &&
      prev.rulerVisible === this.state.rulerVisible
    ) {
      return;
    }
    editorEvents.emit("preferences:changed", {
      gridVisible: this.state.gridVisible,
      snapToGrid: this.state.snapToGrid,
      rulerVisible: this.state.rulerVisible,
    });
  }
}
