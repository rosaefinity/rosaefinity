// =============================================
// Box Selection Controller — Handles marquee
// (rubber band) selection of widgets.
// Supports both left→right and right→left selection.
// =============================================

import type { OverlayEngine } from "../overlay/overlay-engine";
import type { SelectionManager } from "../editor/selection-manager";
import type { BoxSelectionData, PointerState, SelectionBox } from "./interaction-types";
import { interactionEvents } from "./interaction-events";

const BOX_SELECT_THRESHOLD = 3;

export class BoxSelectionController {
  private engine: OverlayEngine;
  private selection: SelectionManager;
  private boxData: BoxSelectionData | null = null;
  private isActive = false;
  private startX = 0;
  private startY = 0;

  constructor(engine: OverlayEngine, selection: SelectionManager) {
    this.engine = engine;
    this.selection = selection;
  }

  /**
   * Start box selection on mouse down (on empty canvas area).
   */
  startBoxSelection(pointer: PointerState, additive: boolean): void {
    this.startX = pointer.x;
    this.startY = pointer.y;
    this.boxData = {
      startX: pointer.x,
      startY: pointer.y,
      currentX: pointer.x,
      currentY: pointer.y,
      additive,
    };
  }

  /**
   * Update box selection on mouse move.
   */
  updateBoxSelection(pointer: PointerState): boolean {
    if (!this.boxData) return false;

    if (!this.isActive) {
      const dx = Math.abs(pointer.x - this.startX);
      const dy = Math.abs(pointer.y - this.startY);
      if (dx < BOX_SELECT_THRESHOLD && dy < BOX_SELECT_THRESHOLD) {
        return false;
      }
      this.isActive = true;
    }

    this.boxData.currentX = pointer.x;
    this.boxData.currentY = pointer.y;
    return true;
  }

  /**
   * End box selection. Selects all widgets within the box.
   */
  endBoxSelection(
    pointer: PointerState,
    overlayId: string,
    sceneId: string,
  ): string[] {
    if (!this.boxData || !this.isActive) {
      this.boxData = null;
      this.isActive = false;
      return [];
    }

    this.boxData.currentX = pointer.x;
    this.boxData.currentY = pointer.y;

    const box = this.getSelectionBox();
    const selectedIds = this.findWidgetsInBox(overlayId, sceneId, box);

    if (this.boxData.additive) {
      const current = this.selection.getSelectedWidgetIds();
      const merged = [...new Set([...current, ...selectedIds])];
      this.selection.selectWidgets(merged);
    } else {
      this.selection.selectWidgets(selectedIds);
    }

    interactionEvents.emit("selection:box", {
      box,
      additive: this.boxData.additive,
    });

    const result = [...selectedIds];
    this.boxData = null;
    this.isActive = false;
    return result;
  }

  /**
   * Cancel box selection.
   */
  cancelBoxSelection(): void {
    this.boxData = null;
    this.isActive = false;
  }

  /**
   * Get the current selection box (handles left→right and right→left).
   */
  getSelectionBox(): SelectionBox {
    if (!this.boxData) return { x: 0, y: 0, width: 0, height: 0 };

    const x = Math.min(this.boxData.startX, this.boxData.currentX);
    const y = Math.min(this.boxData.startY, this.boxData.currentY);
    const width = Math.abs(this.boxData.currentX - this.boxData.startX);
    const height = Math.abs(this.boxData.currentY - this.boxData.startY);

    return { x, y, width, height };
  }

  /**
   * Find all widgets within the selection box.
   * Uses intersection test — any overlap counts.
   */
  private findWidgetsInBox(
    overlayId: string,
    sceneId: string,
    box: SelectionBox,
  ): string[] {
    if (box.width === 0 && box.height === 0) return [];

    const scene = this.engine.getScene(overlayId, sceneId);
    if (!scene) return [];

    const result: string[] = [];

    for (const widget of scene.widgets) {
      if (!widget.visible) continue;

      // Widget bounds
      const wx = widget.x;
      const wy = widget.y;
      const ww = widget.width;
      const wh = widget.height;

      // Check intersection: two rectangles overlap if they don't NOT overlap
      const intersects =
        box.x < wx + ww &&
        box.x + box.width > wx &&
        box.y < wy + wh &&
        box.y + box.height > wy;

      if (intersects) {
        result.push(widget.id);
      }
    }

    return result;
  }

  /**
   * Check if box selection is active.
   */
  isBoxSelecting(): boolean {
    return this.boxData !== null;
  }

  /**
   * Get current box selection data.
   */
  getBoxSelectionData(): BoxSelectionData | null {
    return this.boxData ? { ...this.boxData } : null;
  }
}
