// =============================================
// Alignment Controller — Main orchestrator for
// alignment, distribution, and guide operations.
//
// All widget modifications execute through
// CommandManager via UpdateWidgetCommand.
// =============================================

import type { OverlayEngine } from "../overlay/overlay-engine";
import type { CommandManager } from "../commands/command-manager";
import type { SelectionManager } from "../editor/selection-manager";
import type { AlignmentDirection, DistributionDirection, WidgetBounds, AlignmentContext } from "./alignment-types";
import { GuideManager } from "./guide-manager";
import { DistributeManager } from "./distribute-manager";
import { alignmentEvents } from "./alignment-events";
import { UpdateWidgetCommand } from "../commands/commands/UpdateWidgetCommand";

export interface AlignmentControllerConfig {
  engine: OverlayEngine;
  commandManager: CommandManager;
  selectionManager: SelectionManager;
}

export class AlignmentController {
  private engine: OverlayEngine;
  private commandManager: CommandManager;
  private selection: SelectionManager;
  private guideManager: GuideManager;
  private distributeManager: DistributeManager;

  constructor(config: AlignmentControllerConfig) {
    this.engine = config.engine;
    this.commandManager = config.commandManager;
    this.selection = config.selectionManager;
    this.guideManager = new GuideManager(this.engine);
    this.distributeManager = new DistributeManager();
  }

  /**
   * Get the guide manager for configuration.
   */
  getGuideManager(): GuideManager {
    return this.guideManager;
  }

  /**
   * Get the distribute manager.
   */
  getDistributeManager(): DistributeManager {
    return this.distributeManager;
  }

  // ─── Alignment ─────────────────────────────────

  /**
   * Align selected widgets to a direction.
   * Requires at least 2 selected widgets.
   */
  align(context: AlignmentContext, direction: AlignmentDirection): void {
    const bounds = this.getSelectedBounds(context);
    this.validateMinimumWidgets(bounds.length);

    alignmentEvents.emit("alignment:started", { direction, widgetCount: bounds.length });

    const results = this.calculateAlignment(bounds, direction);

    for (const result of results) {
      this.commandManager.execute(
        new UpdateWidgetCommand(
          this.engine,
          context.overlayId,
          context.sceneId,
          result.widgetId,
          { x: result.newX, y: result.newY },
        ),
      );
    }

    alignmentEvents.emit("alignment:completed", { direction, widgetCount: bounds.length });
  }

  /**
   * Distribute selected widgets along an axis.
   * Requires at least 2 selected widgets.
   */
  distribute(context: AlignmentContext, direction: DistributionDirection): void {
    const bounds = this.getSelectedBounds(context);
    this.validateMinimumWidgets(bounds.length);

    alignmentEvents.emit("distribution:started", { direction, widgetCount: bounds.length });

    const results = direction === "horizontal"
      ? this.distributeManager.distributeHorizontal(bounds)
      : this.distributeManager.distributeVertical(bounds);

    for (const result of results) {
      this.commandManager.execute(
        new UpdateWidgetCommand(
          this.engine,
          context.overlayId,
          context.sceneId,
          result.widgetId,
          { x: result.newX, y: result.newY },
        ),
      );
    }

    alignmentEvents.emit("distribution:completed", { direction, widgetCount: bounds.length });
  }

  // ─── Alignment Calculation ─────────────────────

  /**
   * Calculate alignment positions for a set of widgets.
   */
  calculateAlignment(
    bounds: WidgetBounds[],
    direction: AlignmentDirection,
  ): { widgetId: string; newX: number; newY: number }[] {
    if (bounds.length === 0) return [];

    switch (direction) {
      case "left":
        return this.alignLeft(bounds);
      case "right":
        return this.alignRight(bounds);
      case "top":
        return this.alignTop(bounds);
      case "bottom":
        return this.alignBottom(bounds);
      case "center-horizontal":
        return this.alignCenterHorizontal(bounds);
      case "center-vertical":
        return this.alignCenterVertical(bounds);
    }
  }

  private alignLeft(bounds: WidgetBounds[]): { widgetId: string; newX: number; newY: number }[] {
    const minX = Math.min(...bounds.map((b) => b.x));
    return bounds.map((b) => ({ widgetId: b.id, newX: minX, newY: b.y }));
  }

  private alignRight(bounds: WidgetBounds[]): { widgetId: string; newX: number; newY: number }[] {
    const maxRight = Math.max(...bounds.map((b) => b.x + b.width));
    return bounds.map((b) => ({ widgetId: b.id, newX: maxRight - b.width, newY: b.y }));
  }

  private alignTop(bounds: WidgetBounds[]): { widgetId: string; newX: number; newY: number }[] {
    const minY = Math.min(...bounds.map((b) => b.y));
    return bounds.map((b) => ({ widgetId: b.id, newX: b.x, newY: minY }));
  }

  private alignBottom(bounds: WidgetBounds[]): { widgetId: string; newX: number; newY: number }[] {
    const maxBottom = Math.max(...bounds.map((b) => b.y + b.height));
    return bounds.map((b) => ({ widgetId: b.id, newX: b.x, newY: maxBottom - b.height }));
  }

  private alignCenterHorizontal(bounds: WidgetBounds[]): { widgetId: string; newX: number; newY: number }[] {
    const minX = Math.min(...bounds.map((b) => b.x));
    const maxRight = Math.max(...bounds.map((b) => b.x + b.width));
    const centerX = (minX + maxRight) / 2;
    return bounds.map((b) => ({ widgetId: b.id, newX: centerX - b.width / 2, newY: b.y }));
  }

  private alignCenterVertical(bounds: WidgetBounds[]): { widgetId: string; newX: number; newY: number }[] {
    const minY = Math.min(...bounds.map((b) => b.y));
    const maxBottom = Math.max(...bounds.map((b) => b.y + b.height));
    const centerY = (minY + maxBottom) / 2;
    return bounds.map((b) => ({ widgetId: b.id, newX: b.x, newY: centerY - b.height / 2 }));
  }

  // ─── Helpers ───────────────────────────────────

  /**
   * Get bounds for all selected widgets.
   */
  private getSelectedBounds(context: AlignmentContext): WidgetBounds[] {
    const selectedIds = this.selection.getSelectedWidgetIds();
    const bounds: WidgetBounds[] = [];

    for (const id of selectedIds) {
      const widget = this.engine.getWidget(context.overlayId, context.sceneId, id);
      if (widget) {
        bounds.push({
          id: widget.id,
          x: widget.x,
          y: widget.y,
          width: widget.width,
          height: widget.height,
        });
      }
    }

    return bounds;
  }

  /**
   * Validate minimum widget count.
   */
  private validateMinimumWidgets(count: number): void {
    if (count < 2) {
      throw new Error("[AlignmentController] Need at least 2 widgets to align/distribute");
    }
  }

  /**
   * Snap a widget position using smart guides.
   */
  snapToGuides(
    overlayId: string,
    sceneId: string,
    widgetId: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    return this.guideManager.calculateGuides(overlayId, sceneId, widgetId, x, y, width, height);
  }
}
