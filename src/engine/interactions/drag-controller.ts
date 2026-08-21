// =============================================
// Drag Controller — Handles widget drag operations.
// Creates MoveWidgetCommands for each widget movement.
// =============================================

import type { OverlayEngine } from "../overlay/overlay-engine";
import type { CommandManager } from "../commands/command-manager";
import type { SelectionManager } from "../editor/selection-manager";
import type { SnapManager } from "./snap-manager";
import type { DragData, PointerState } from "./interaction-types";
import { MoveWidgetCommand } from "../commands/commands/MoveWidgetCommand";
import { interactionEvents } from "./interaction-events";

const DRAG_THRESHOLD = 3;

export class DragController {
  private engine: OverlayEngine;
  private commandManager: CommandManager;
  private selection: SelectionManager;
  private snapManager: SnapManager;
  private dragData: DragData | null = null;
  private isDragging = false;
  private startX = 0;
  private startY = 0;

  constructor(
    engine: OverlayEngine,
    commandManager: CommandManager,
    selection: SelectionManager,
    snapManager: SnapManager,
  ) {
    this.engine = engine;
    this.commandManager = commandManager;
    this.selection = selection;
    this.snapManager = snapManager;
  }

  /**
   * Start a potential drag operation on mouse down.
   */
  startDrag(
    overlayId: string,
    sceneId: string,
    widgetId: string,
    pointer: PointerState,
  ): void {
    this.startX = pointer.x;
    this.startY = pointer.y;

    const widget = this.engine.getWidget(overlayId, sceneId, widgetId);
    if (!widget) return;

    this.dragData = {
      widgetIds: this.selection.getSelectedWidgetIds().includes(widgetId)
        ? this.selection.getSelectedWidgetIds()
        : [widgetId],
      overlayId,
      sceneId,
      startX: pointer.x,
      startY: pointer.y,
      currentX: pointer.x,
      currentY: pointer.y,
      offsetX: pointer.x - widget.x,
      offsetY: pointer.y - widget.y,
    };
  }

  /**
   * Update drag position on mouse move.
   * Returns true if drag has started (exceeded threshold).
   */
  updateDrag(pointer: PointerState): boolean {
    if (!this.dragData) return false;

    const dx = pointer.x - this.startX;
    const dy = pointer.y - this.startY;

    if (!this.isDragging) {
      if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) {
        return false;
      }
      this.isDragging = true;
      interactionEvents.emit("drag:start", this.dragData);
      interactionEvents.emit("interaction:start", { mode: "dragging" });
    }

    this.dragData.currentX = pointer.x;
    this.dragData.currentY = pointer.y;

    interactionEvents.emit("drag:update", this.dragData);
    interactionEvents.emit("interaction:update", { mode: "dragging" });
    return true;
  }

  /**
   * End drag operation on mouse up. Executes MoveWidgetCommands.
   */
  endDrag(pointer: PointerState): void {
    if (!this.dragData) return;

    if (this.isDragging) {
      const dx = pointer.x - this.dragData.startX;
      const dy = pointer.y - this.dragData.startY;

      if (dx !== 0 || dy !== 0) {
        for (const widgetId of this.dragData.widgetIds) {
          const widget = this.engine.getWidget(
            this.dragData.overlayId,
            this.dragData.sceneId,
            widgetId,
          );
          if (!widget) continue;

          const snapped = this.snapManager.snap(widget.x + dx, widget.y + dy);
          const cmd = new MoveWidgetCommand(
            this.engine,
            this.dragData.overlayId,
            this.dragData.sceneId,
            widgetId,
            snapped.x,
            snapped.y,
          );
          this.commandManager.execute(cmd);
        }
      }

      interactionEvents.emit("drag:end", {
        widgetIds: this.dragData.widgetIds,
        overlayId: this.dragData.overlayId,
        sceneId: this.dragData.sceneId,
      });
      interactionEvents.emit("interaction:end", { mode: "dragging" });
    }

    this.dragData = null;
    this.isDragging = false;
  }

  /**
   * Cancel the current drag operation.
   */
  cancelDrag(): void {
    if (this.isDragging) {
      interactionEvents.emit("drag:end", {
        widgetIds: this.dragData?.widgetIds || [],
        overlayId: this.dragData?.overlayId || "",
        sceneId: this.dragData?.sceneId || "",
      });
      interactionEvents.emit("interaction:end", { mode: "dragging" });
    }
    this.dragData = null;
    this.isDragging = false;
  }

  /**
   * Check if a drag is in progress.
   */
  isActive(): boolean {
    return this.dragData !== null;
  }

  /**
   * Get current drag data.
   */
  getDragData(): DragData | null {
    return this.dragData ? { ...this.dragData } : null;
  }

  /**
   * Get the delta from drag start to current position.
   */
  getDelta(): { dx: number; dy: number } {
    if (!this.dragData) return { dx: 0, dy: 0 };
    return {
      dx: this.dragData.currentX - this.dragData.startX,
      dy: this.dragData.currentY - this.dragData.startY,
    };
  }
}
