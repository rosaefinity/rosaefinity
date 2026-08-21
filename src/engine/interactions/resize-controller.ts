// =============================================
// Resize Controller — Handles widget resize
// operations via 8-point handles.
// =============================================

import type { OverlayEngine } from "../overlay/overlay-engine";
import type { CommandManager } from "../commands/command-manager";
import type { ResizeData, ResizeHandle, PointerState } from "./interaction-types";
import { ResizeWidgetCommand } from "../commands/commands/ResizeWidgetCommand";
import { MoveWidgetCommand } from "../commands/commands/MoveWidgetCommand";
import { interactionEvents } from "./interaction-events";

export class ResizeController {
  private engine: OverlayEngine;
  private commandManager: CommandManager;
  private resizeData: ResizeData | null = null;
  private isResizing = false;
  private startX = 0;
  private startY = 0;

  constructor(engine: OverlayEngine, commandManager: CommandManager) {
    this.engine = engine;
    this.commandManager = commandManager;
  }

  /**
   * Start resize on mouse down on a handle.
   */
  startResize(
    overlayId: string,
    sceneId: string,
    widgetId: string,
    handle: ResizeHandle,
    pointer: PointerState,
  ): void {
    this.startX = pointer.x;
    this.startY = pointer.y;

    const widget = this.engine.getWidget(overlayId, sceneId, widgetId);
    if (!widget) return;

    this.resizeData = {
      widgetId,
      overlayId,
      sceneId,
      handle,
      startX: pointer.x,
      startY: pointer.y,
      currentX: pointer.x,
      currentY: pointer.y,
      originalX: widget.x,
      originalY: widget.y,
      originalWidth: widget.width,
      originalHeight: widget.height,
      keepAspectRatio: pointer.shiftKey,
      centerResize: pointer.altKey,
    };
  }

  /**
   * Update resize on mouse move.
   */
  updateResize(pointer: PointerState): boolean {
    if (!this.resizeData) return false;

    if (!this.isResizing) {
      this.isResizing = true;
      interactionEvents.emit("resize:start", this.resizeData);
      interactionEvents.emit("interaction:start", { mode: "resizing" });
    }

    this.resizeData.currentX = pointer.x;
    this.resizeData.currentY = pointer.y;
    this.resizeData.keepAspectRatio = pointer.shiftKey;
    this.resizeData.centerResize = pointer.altKey;

    interactionEvents.emit("resize:update", this.resizeData);
    interactionEvents.emit("interaction:update", { mode: "resizing" });
    return true;
  }

  /**
   * End resize. Executes ResizeWidgetCommand + optional MoveWidgetCommand.
   */
  endResize(pointer: PointerState): void {
    if (!this.resizeData) return;

    if (this.isResizing) {
      const d = this.resizeData;
      const dx = pointer.x - d.startX;
      const dy = pointer.y - d.startY;

      const result = this.calculateResize(d, dx, dy);
      const minSize = 10;

      const newWidth = Math.max(result.width, minSize);
      const newHeight = Math.max(result.height, minSize);

      if (newWidth !== d.originalWidth || newHeight !== d.originalHeight) {
        this.commandManager.execute(
          new ResizeWidgetCommand(this.engine, d.overlayId, d.sceneId, d.widgetId, newWidth, newHeight),
        );
      }

      if (result.x !== d.originalX || result.y !== d.originalY) {
        this.commandManager.execute(
          new MoveWidgetCommand(this.engine, d.overlayId, d.sceneId, d.widgetId, result.x, result.y),
        );
      }

      interactionEvents.emit("resize:end", {
        widgetId: d.widgetId,
        overlayId: d.overlayId,
        sceneId: d.sceneId,
      });
      interactionEvents.emit("interaction:end", { mode: "resizing" });
    }

    this.resizeData = null;
    this.isResizing = false;
  }

  /**
   * Cancel resize.
   */
  cancelResize(): void {
    if (this.isResizing) {
      interactionEvents.emit("resize:end", {
        widgetId: this.resizeData?.widgetId || "",
        overlayId: this.resizeData?.overlayId || "",
        sceneId: this.resizeData?.sceneId || "",
      });
      interactionEvents.emit("interaction:end", { mode: "resizing" });
    }
    this.resizeData = null;
    this.isResizing = false;
  }

  /**
   * Calculate new size and position based on handle and delta.
   */
  private calculateResize(
    d: ResizeData,
    dx: number,
    dy: number,
  ): { x: number; y: number; width: number; height: number } {
    let newX = d.originalX;
    let newY = d.originalY;
    let newWidth = d.originalWidth;
    let newHeight = d.originalHeight;

    // Handle horizontal
    if (d.handle.includes("e")) {
      newWidth = d.originalWidth + dx;
    } else if (d.handle.includes("w")) {
      newWidth = d.originalWidth - dx;
      newX = d.originalX + dx;
    }

    // Handle vertical
    if (d.handle.includes("s")) {
      newHeight = d.originalHeight + dy;
    } else if (d.handle.includes("n")) {
      newHeight = d.originalHeight - dy;
      newY = d.originalY + dy;
    }

    // Center resize (Alt)
    if (d.centerResize) {
      const halfDx = dx / 2;
      const halfDy = dy / 2;
      newX = d.originalX + halfDx;
      newY = d.originalY + halfDy;
      newWidth = d.originalWidth - dx;
      newHeight = d.originalHeight - dy;
    }

    // Keep aspect ratio (Shift)
    if (d.keepAspectRatio && d.originalWidth > 0 && d.originalHeight > 0) {
      const aspectRatio = d.originalWidth / d.originalHeight;
      if (d.handle === "n" || d.handle === "s") {
        newWidth = newHeight * aspectRatio;
      } else {
        newHeight = newWidth / aspectRatio;
      }

      // Recalculate position for corner handles
      if (d.handle.includes("w")) {
        newX = d.originalX + (d.originalWidth - newWidth);
      }
      if (d.handle.includes("n")) {
        newY = d.originalY + (d.originalHeight - newHeight);
      }
    }

    return { x: newX, y: newY, width: newWidth, height: newHeight };
  }

  /**
   * Check if resize is active.
   */
  isActive(): boolean {
    return this.resizeData !== null;
  }

  /**
   * Get current resize data.
   */
  getResizeData(): ResizeData | null {
    return this.resizeData ? { ...this.resizeData } : null;
  }
}
