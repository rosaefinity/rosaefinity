// =============================================
// Interaction Controller — Main orchestrator
// for all editor interactions.
//
// Routes pointer events to the correct sub-controller.
// UI sends events here; this layer never touches DOM.
// =============================================

import type { OverlayEngine } from "../overlay/overlay-engine";
import type { CommandManager } from "../commands/command-manager";
import type { SelectionManager } from "../editor/selection-manager";
import type { ViewportManager } from "../editor/viewport-manager";
import type { PointerState, InteractionMode, ResizeHandle } from "./interaction-types";
import { DragController } from "./drag-controller";
import { ResizeController } from "./resize-controller";
import { RotateController } from "./rotate-controller";
import { BoxSelectionController } from "./box-selection-controller";
import { SnapManager } from "./snap-manager";
import { interactionEvents } from "./interaction-events";
import { DeleteWidgetCommand } from "../commands/commands/DeleteWidgetCommand";

export interface InteractionControllerConfig {
  engine: OverlayEngine;
  commandManager: CommandManager;
  selectionManager: SelectionManager;
  viewportManager: ViewportManager;
}

export class InteractionController {
  private engine: OverlayEngine;
  private commandManager: CommandManager;
  private selection: SelectionManager;
  private viewport: ViewportManager;

  private dragCtrl: DragController;
  private resizeCtrl: ResizeController;
  private rotateCtrl: RotateController;
  private boxSelectCtrl: BoxSelectionController;
  private snapManager: SnapManager;

  private currentMode: InteractionMode = "idle";
  private activeOverlayId: string | null = null;
  private activeSceneId: string | null = null;

  constructor(config: InteractionControllerConfig) {
    this.engine = config.engine;
    this.commandManager = config.commandManager;
    this.selection = config.selectionManager;
    this.viewport = config.viewportManager;

    this.snapManager = new SnapManager();
    this.dragCtrl = new DragController(this.engine, this.commandManager, this.selection, this.snapManager);
    this.resizeCtrl = new ResizeController(this.engine, this.commandManager);
    this.rotateCtrl = new RotateController(this.engine, this.commandManager);
    this.boxSelectCtrl = new BoxSelectionController(this.engine, this.selection);
  }

  /**
   * Set the active overlay and scene context for interactions.
   */
  setActiveContext(overlayId: string | null, sceneId: string | null): void {
    this.activeOverlayId = overlayId;
    this.activeSceneId = sceneId;
  }

  /**
   * Get the current interaction mode.
   */
  getMode(): InteractionMode {
    return this.currentMode;
  }

  /**
   * Get the snap manager for configuration.
   */
  getSnapManager(): SnapManager {
    return this.snapManager;
  }

  // ─── Mouse Events ──────────────────────────────

  /**
   * Handle mouse down. Routes to appropriate sub-controller
   * based on active tool and target.
   */
  mouseDown(
    pointer: PointerState,
    targetWidgetId: string | null,
    handle: ResizeHandle | null,
    tool: string,
  ): void {
    if (!this.activeOverlayId || !this.activeSceneId) return;

    switch (tool) {
      case "select":
        if (handle) {
          this.startResize(pointer, handle);
        } else if (targetWidgetId) {
          this.startDrag(pointer, targetWidgetId);
        } else {
          this.startBoxSelection(pointer, pointer.ctrlKey || pointer.shiftKey);
        }
        break;

      case "move":
        if (targetWidgetId) {
          this.startDrag(pointer, targetWidgetId);
        }
        break;

      case "resize":
        if (handle && targetWidgetId) {
          this.startResize(pointer, handle);
        } else if (targetWidgetId) {
          // Default to SE handle when clicking widget directly
          this.startResizeWithHandle(pointer, targetWidgetId, "se");
        }
        break;

      case "rotate":
        if (targetWidgetId) {
          this.startRotate(pointer, targetWidgetId);
        }
        break;

      default:
        break;
    }
  }

  /**
   * Handle mouse move. Delegates to active sub-controller.
   */
  mouseMove(pointer: PointerState): boolean {
    let handled = false;

    if (this.dragCtrl.isActive()) {
      handled = this.dragCtrl.updateDrag(pointer);
    } else if (this.resizeCtrl.isActive()) {
      handled = this.resizeCtrl.updateResize(pointer);
    } else if (this.rotateCtrl.isActive()) {
      handled = this.rotateCtrl.updateRotate(pointer);
    } else if (this.boxSelectCtrl.isBoxSelecting()) {
      handled = this.boxSelectCtrl.updateBoxSelection(pointer);
    }

    return handled;
  }

  /**
   * Handle mouse up. Completes the active interaction.
   */
  mouseUp(pointer: PointerState): void {
    if (this.dragCtrl.isActive()) {
      this.dragCtrl.endDrag(pointer);
      this.currentMode = "idle";
    } else if (this.resizeCtrl.isActive()) {
      this.resizeCtrl.endResize(pointer);
      this.currentMode = "idle";
    } else if (this.rotateCtrl.isActive()) {
      this.rotateCtrl.endRotate(pointer);
      this.currentMode = "idle";
    } else if (this.boxSelectCtrl.isBoxSelecting()) {
      this.boxSelectCtrl.endBoxSelection(
        pointer,
        this.activeOverlayId!,
        this.activeSceneId!,
      );
      this.currentMode = "idle";
    }
  }

  /**
   * Handle click on a widget (select it).
   */
  click(targetWidgetId: string | null, additive: boolean): void {
    if (!targetWidgetId) {
      this.selection.clearSelection();
      return;
    }

    if (additive) {
      this.selection.toggleSelection(targetWidgetId);
    } else {
      this.selection.selectWidget(targetWidgetId);
    }
  }

  /**
   * Handle double click on a widget (future: open properties).
   */
  doubleClick(targetWidgetId: string | null): void {
    // Reserved for future: open widget property editor
  }

  // ─── Viewport Events ───────────────────────────

  /**
   * Handle zoom wheel event.
   */
  zoomWheel(deltaY: number, centerX: number, centerY: number): void {
    if (deltaY < 0) {
      this.viewport.zoomIn();
    } else {
      this.viewport.zoomOut();
    }
  }

  /**
   * Handle pan (middle mouse or space+drag).
   */
  startPan(pointer: PointerState): void {
    this.currentMode = "panning";
    interactionEvents.emit("interaction:start", { mode: "panning" });
  }

  /**
   * Update pan position.
   */
  updatePan(pointer: PointerState, lastX: number, lastY: number): void {
    if (this.currentMode !== "panning") return;
    const dx = pointer.x - lastX;
    const dy = pointer.y - lastY;
    const vp = this.viewport.getViewport();
    this.viewport.pan(vp.panX + dx, vp.panY + dy);
  }

  /**
   * End pan.
   */
  endPan(): void {
    if (this.currentMode === "panning") {
      this.currentMode = "idle";
      interactionEvents.emit("interaction:end", { mode: "panning" });
    }
  }

  // ─── Keyboard ──────────────────────────────────

  /**
   * Handle key down for interaction shortcuts.
   * Returns true if the key was handled.
   */
  keyDown(key: string, pointer: PointerState | null): boolean {
    switch (key) {
      case "Escape":
        this.cancelAll();
        return true;
      case "Delete":
      case "Backspace":
        this.deleteSelectedWidgets();
        return true;
      default:
        return false;
    }
  }

  // ─── Convenience Methods ───────────────────────

  private startDrag(pointer: PointerState, widgetId: string): void {
    this.currentMode = "dragging";
    this.dragCtrl.startDrag(this.activeOverlayId!, this.activeSceneId!, widgetId, pointer);
  }

  private startResize(pointer: PointerState, handle: ResizeHandle): void {
    this.currentMode = "resizing";
    const selectedIds = this.selection.getSelectedWidgetIds();
    if (selectedIds.length === 1) {
      this.resizeCtrl.startResize(this.activeOverlayId!, this.activeSceneId!, selectedIds[0], handle, pointer);
    }
  }

  private startResizeWithHandle(pointer: PointerState, widgetId: string, handle: ResizeHandle): void {
    this.currentMode = "resizing";
    this.resizeCtrl.startResize(this.activeOverlayId!, this.activeSceneId!, widgetId, handle, pointer);
  }

  private startRotate(pointer: PointerState, widgetId: string): void {
    this.currentMode = "rotating";
    this.rotateCtrl.startRotate(this.activeOverlayId!, this.activeSceneId!, widgetId, pointer);
  }

  private startBoxSelection(pointer: PointerState, additive: boolean): void {
    this.currentMode = "box-selecting";
    this.boxSelectCtrl.startBoxSelection(pointer, additive);
  }

  private deleteSelectedWidgets(): void {
    if (!this.activeOverlayId || !this.activeSceneId) return;
    const selectedIds = this.selection.getSelectedWidgetIds();
    for (const id of selectedIds) {
      try {
        this.commandManager.execute(
          new DeleteWidgetCommand(this.engine, this.activeOverlayId, this.activeSceneId, id),
        );
      } catch {
        // Widget may not exist
      }
    }
    this.selection.clearSelection();
  }

  private cancelAll(): void {
    this.dragCtrl.cancelDrag();
    this.resizeCtrl.cancelResize();
    this.rotateCtrl.cancelRotate();
    this.boxSelectCtrl.cancelBoxSelection();
    this.currentMode = "idle";
  }
}
