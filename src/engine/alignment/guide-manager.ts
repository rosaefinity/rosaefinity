// =============================================
// Guide Manager — Calculates smart guides for
// alignment snapping. Pure math, no DOM.
// =============================================

import type { OverlayEngine } from "../overlay/overlay-engine";
import type { Guide, GuideAxis, GuideCandidate, GuideCalculationResult, GuideManagerConfig } from "./guide-types";
import { alignmentEvents } from "./alignment-events";

const DEFAULT_THRESHOLD = 5;
const CANVAS_WIDTH = 1920;
const CANVAS_HEIGHT = 1080;

export class GuideManager {
  private engine: OverlayEngine;
  private config: GuideManagerConfig = {
    enabled: true,
    threshold: DEFAULT_THRESHOLD,
    showCanvasCenter: true,
    showWidgetEdges: true,
    showWidgetCenters: true,
  };
  private customGuides: Guide[] = [];
  private guideCounter = 0;

  constructor(engine: OverlayEngine) {
    this.engine = engine;
  }

  /**
   * Enable/disable guide system.
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Check if guides are enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Set the snap threshold (distance in pixels).
   */
  setThreshold(threshold: number): void {
    if (typeof threshold !== "number" || threshold <= 0 || Number.isNaN(threshold)) {
      throw new Error("[GuideManager] Threshold must be a positive number");
    }
    this.config.threshold = threshold;
  }

  /**
   * Get the current threshold.
   */
  getThreshold(): number {
    return this.config.threshold;
  }

  /**
   * Configure which guide sources are active.
   */
  configure(options: Partial<GuideManagerConfig>): void {
    this.config = { ...this.config, ...options };
  }

  /**
   * Get current configuration.
   */
  getConfig(): GuideManagerConfig {
    return { ...this.config };
  }

  /**
   * Add a custom guide line.
   */
  addCustomGuide(axis: GuideAxis, position: number): string {
    const id = `guide_${++this.guideCounter}`;
    this.customGuides.push({ id, axis, position, source: "custom" });
    alignmentEvents.emit("guides:changed", { guideCount: this.getAllGuides().length });
    return id;
  }

  /**
   * Remove a custom guide by ID.
   */
  removeCustomGuide(id: string): void {
    this.customGuides = this.customGuides.filter((g) => g.id !== id);
    alignmentEvents.emit("guides:changed", { guideCount: this.getAllGuides().length });
  }

  /**
   * Clear all custom guides.
   */
  clearCustomGuides(): void {
    this.customGuides = [];
    alignmentEvents.emit("guides:changed", { guideCount: this.getAllGuides().length });
  }

  /**
   * Get all custom guides.
   */
  getCustomGuides(): Guide[] {
    return [...this.customGuides];
  }

  /**
   * Calculate snapping guides for a given widget position.
   * Returns snapped position and which guides are active.
   */
  calculateGuides(
    overlayId: string,
    sceneId: string,
    widgetId: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): GuideCalculationResult {
    if (!this.config.enabled) {
      return { snappedX: x, snappedY: y, activeGuidesX: [], activeGuidesY: [] };
    }

    const allGuides = this.collectGuides(overlayId, sceneId, widgetId);
    const candidatesX = this.findNearestGuides(x, "x", allGuides);
    const candidatesY = this.findNearestGuides(y, "y", allGuides);

    // Also check right/bottom edges for widget edges
    const rightCandidates = this.findNearestGuides(x + width, "x", allGuides);
    const bottomCandidates = this.findNearestGuides(y + height, "y", allGuides);

    let snappedX = x;
    let snappedY = y;
    const activeGuidesX: Guide[] = [];
    const activeGuidesY: Guide[] = [];

    // Snap left edge
    if (candidatesX.length > 0 && candidatesX[0].distance <= this.config.threshold) {
      snappedX = candidatesX[0].position;
      activeGuidesX.push(candidatesX[0].guide);
    }

    // Snap right edge (adjust position to align right edge)
    if (rightCandidates.length > 0 && rightCandidates[0].distance <= this.config.threshold) {
      if (activeGuidesX.length === 0 || rightCandidates[0].distance < candidatesX[0].distance) {
        snappedX = rightCandidates[0].position - width;
        activeGuidesX.length = 0;
        activeGuidesX.push(rightCandidates[0].guide);
      }
    }

    // Snap top edge
    if (candidatesY.length > 0 && candidatesY[0].distance <= this.config.threshold) {
      snappedY = candidatesY[0].position;
      activeGuidesY.push(candidatesY[0].guide);
    }

    // Snap bottom edge
    if (bottomCandidates.length > 0 && bottomCandidates[0].distance <= this.config.threshold) {
      if (activeGuidesY.length === 0 || bottomCandidates[0].distance < candidatesY[0].distance) {
        snappedY = bottomCandidates[0].position - height;
        activeGuidesY.length = 0;
        activeGuidesY.push(bottomCandidates[0].guide);
      }
    }

    return { snappedX, snappedY, activeGuidesX, activeGuidesY };
  }

  /**
   * Collect all available guides from canvas, widgets, and custom guides.
   */
  private collectGuides(
    overlayId: string,
    sceneId: string,
    excludeWidgetId: string,
  ): Guide[] {
    const guides: Guide[] = [];

    // Canvas center guides
    if (this.config.showCanvasCenter) {
      guides.push(
        { id: "canvas-center-x", axis: "x", position: CANVAS_WIDTH / 2, source: "canvas-center" },
        { id: "canvas-center-y", axis: "y", position: CANVAS_HEIGHT / 2, source: "canvas-center" },
      );
    }

    // Canvas edges
    guides.push(
      { id: "canvas-left", axis: "x", position: 0, source: "canvas-center" },
      { id: "canvas-right", axis: "x", position: CANVAS_WIDTH, source: "canvas-center" },
      { id: "canvas-top", axis: "y", position: 0, source: "canvas-center" },
      { id: "canvas-bottom", axis: "y", position: CANVAS_HEIGHT, source: "canvas-center" },
    );

    // Widget guides
    const scene = this.engine.getScene(overlayId, sceneId);
    if (scene) {
      for (const widget of scene.widgets) {
        if (widget.id === excludeWidgetId) continue;

        if (this.config.showWidgetEdges) {
          guides.push(
            { id: `${widget.id}-left`, axis: "x", position: widget.x, source: "widget-edge" },
            { id: `${widget.id}-right`, axis: "x", position: widget.x + widget.width, source: "widget-edge" },
            { id: `${widget.id}-top`, axis: "y", position: widget.y, source: "widget-edge" },
            { id: `${widget.id}-bottom`, axis: "y", position: widget.y + widget.height, source: "widget-edge" },
          );
        }

        if (this.config.showWidgetCenters) {
          guides.push(
            { id: `${widget.id}-center-x`, axis: "x", position: widget.x + widget.width / 2, source: "widget-center" },
            { id: `${widget.id}-center-y`, axis: "y", position: widget.y + widget.height / 2, source: "widget-center" },
          );
        }
      }
    }

    // Custom guides
    guides.push(...this.customGuides);

    return guides;
  }

  /**
   * Find nearest guides to a position along an axis.
   */
  private findNearestGuides(
    position: number,
    axis: GuideAxis,
    allGuides: Guide[],
  ): GuideCandidate[] {
    const axisGuides = allGuides.filter((g) => g.axis === axis);
    const candidates: GuideCandidate[] = [];

    for (const guide of axisGuides) {
      const distance = Math.abs(position - guide.position);
      candidates.push({ position: guide.position, distance, guide });
    }

    candidates.sort((a, b) => a.distance - b.distance);
    return candidates;
  }

  /**
   * Get all guides (for rendering guide lines in the editor).
   */
  getAllGuides(): Guide[] {
    return [
      ...this.collectGuides("", "", ""),
    ];
  }
}
