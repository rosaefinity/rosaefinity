// =============================================
// Viewport Manager — Manages zoom, pan, and
// viewport-related operations.
//
// Delegates state storage to EditorStateManager.
// Provides higher-level viewport operations.
// =============================================

import type { EditorStateManager } from "./editor-state";
import { MIN_ZOOM, MAX_ZOOM } from "./editor-state";

export class ViewportManager {
  private editorState: EditorStateManager;

  constructor(editorState: EditorStateManager) {
    this.editorState = editorState;
  }

  /**
   * Zoom in by the standard step.
   */
  zoomIn(): void {
    this.editorState.zoomIn();
  }

  /**
   * Zoom out by the standard step.
   */
  zoomOut(): void {
    this.editorState.zoomOut();
  }

  /**
   * Set zoom to a specific level. Clamps to [MIN_ZOOM, MAX_ZOOM].
   */
  setZoom(zoom: number): void {
    this.editorState.setZoom(zoom);
  }

  /**
   * Pan the viewport to absolute coordinates.
   */
  pan(x: number, y: number): void {
    this.editorState.pan(x, y);
  }

  /**
   * Center the viewport at origin.
   */
  center(): void {
    this.editorState.center();
  }

  /**
   * Reset viewport to defaults (zoom=1, pan=0,0).
   */
  reset(): void {
    this.editorState.resetViewport();
  }

  /**
   * Fit viewport to screen (alias for reset).
   */
  fitScreen(): void {
    this.editorState.fitScreen();
  }

  /**
   * Calculate snap position for a given coordinate.
   * Snaps to the nearest grid point based on current grid size.
   */
  snapToGrid(x: number, y: number, gridSize: number): { x: number; y: number } {
    if (typeof x !== "number" || typeof y !== "number" || Number.isNaN(x) || Number.isNaN(y)) {
      throw new Error("[ViewportManager] Coordinates cannot be NaN");
    }
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error("[ViewportManager] Coordinates cannot be Infinity");
    }
    if (typeof gridSize !== "number" || gridSize <= 0 || Number.isNaN(gridSize)) {
      throw new Error("[ViewportManager] Grid size must be a positive number");
    }

    const state = this.editorState.getState();
    if (!state.snapToGrid) {
      return { x, y };
    }

    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    };
  }

  /**
   * Get the current viewport state.
   */
  getViewport(): { zoom: number; panX: number; panY: number } {
    const state = this.editorState.getState();
    return { zoom: state.zoom, panX: state.panX, panY: state.panY };
  }

  /**
   * Get the zoom level.
   */
  getZoom(): number {
    return this.editorState.getState().zoom;
  }

  /**
   * Check if a zoom level is within valid bounds.
   */
  isValidZoom(zoom: number): boolean {
    return typeof zoom === "number" && !Number.isNaN(zoom) && Number.isFinite(zoom) && zoom >= MIN_ZOOM && zoom <= MAX_ZOOM;
  }
}
