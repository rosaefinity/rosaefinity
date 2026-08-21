// =============================================
// Rotate Controller — Handles widget rotation
// operations. Supports free rotate and 15° snapping.
// =============================================

import type { OverlayEngine } from "../overlay/overlay-engine";
import type { CommandManager } from "../commands/command-manager";
import type { RotateData, PointerState } from "./interaction-types";
import { RotateWidgetCommand } from "../commands/commands/RotateWidgetCommand";
import { interactionEvents } from "./interaction-events";

const SNAP_ANGLE = 15;
const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export class RotateController {
  private engine: OverlayEngine;
  private commandManager: CommandManager;
  private rotateData: RotateData | null = null;
  private isRotating = false;
  private startAngle = 0;

  constructor(engine: OverlayEngine, commandManager: CommandManager) {
    this.engine = engine;
    this.commandManager = commandManager;
  }

  /**
   * Start rotation on mouse down near a widget.
   */
  startRotate(
    overlayId: string,
    sceneId: string,
    widgetId: string,
    pointer: PointerState,
  ): void {
    const widget = this.engine.getWidget(overlayId, sceneId, widgetId);
    if (!widget) return;

    const centerX = widget.x + widget.width / 2;
    const centerY = widget.y + widget.height / 2;
    this.startAngle = Math.atan2(pointer.y - centerY, pointer.x - centerX) * RAD_TO_DEG;

    this.rotateData = {
      widgetId,
      overlayId,
      sceneId,
      startX: pointer.x,
      startY: pointer.y,
      currentX: pointer.x,
      currentY: pointer.y,
      originalAngle: widget.rotation,
      centerX,
      centerY,
      snapAngle: pointer.shiftKey,
    };
  }

  /**
   * Update rotation on mouse move.
   */
  updateRotate(pointer: PointerState): boolean {
    if (!this.rotateData) return false;

    if (!this.isRotating) {
      this.isRotating = true;
      interactionEvents.emit("rotate:start", this.rotateData);
      interactionEvents.emit("interaction:start", { mode: "rotating" });
    }

    this.rotateData.currentX = pointer.x;
    this.rotateData.currentY = pointer.y;
    this.rotateData.snapAngle = pointer.shiftKey;

    interactionEvents.emit("rotate:update", this.rotateData);
    interactionEvents.emit("interaction:update", { mode: "rotating" });
    return true;
  }

  /**
   * End rotation. Executes RotateWidgetCommand.
   */
  endRotate(pointer: PointerState): void {
    if (!this.rotateData) return;

    if (this.isRotating) {
      const d = this.rotateData;
      const currentAngle = Math.atan2(pointer.y - d.centerY, pointer.x - d.centerX) * RAD_TO_DEG;
      let deltaAngle = currentAngle - this.startAngle;
      let newAngle = d.originalAngle + deltaAngle;

      // Normalize to 0-360
      newAngle = ((newAngle % 360) + 360) % 360;

      // Snap to 15° if Shift held
      if (d.snapAngle) {
        newAngle = Math.round(newAngle / SNAP_ANGLE) * SNAP_ANGLE;
      }

      newAngle = Math.round(newAngle * 100) / 100;

      if (newAngle !== d.originalAngle) {
        this.commandManager.execute(
          new RotateWidgetCommand(this.engine, d.overlayId, d.sceneId, d.widgetId, newAngle),
        );
      }

      interactionEvents.emit("rotate:end", {
        widgetId: d.widgetId,
        overlayId: d.overlayId,
        sceneId: d.sceneId,
      });
      interactionEvents.emit("interaction:end", { mode: "rotating" });
    }

    this.rotateData = null;
    this.isRotating = false;
  }

  /**
   * Cancel rotation.
   */
  cancelRotate(): void {
    if (this.isRotating) {
      interactionEvents.emit("rotate:end", {
        widgetId: this.rotateData?.widgetId || "",
        overlayId: this.rotateData?.overlayId || "",
        sceneId: this.rotateData?.sceneId || "",
      });
      interactionEvents.emit("interaction:end", { mode: "rotating" });
    }
    this.rotateData = null;
    this.isRotating = false;
  }

  /**
   * Calculate the current rotation angle from center.
   */
  getCurrentAngle(pointer: PointerState): number {
    if (!this.rotateData) return 0;
    const angle = Math.atan2(
      pointer.y - this.rotateData.centerY,
      pointer.x - this.rotateData.centerX,
    ) * RAD_TO_DEG;
    let delta = angle - this.startAngle;
    let result = this.rotateData.originalAngle + delta;
    result = ((result % 360) + 360) % 360;

    if (this.rotateData.snapAngle) {
      result = Math.round(result / SNAP_ANGLE) * SNAP_ANGLE;
    }

    return Math.round(result * 100) / 100;
  }

  /**
   * Check if rotation is active.
   */
  isActive(): boolean {
    return this.rotateData !== null;
  }

  /**
   * Get current rotate data.
   */
  getRotateData(): RotateData | null {
    return this.rotateData ? { ...this.rotateData } : null;
  }
}
