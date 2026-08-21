// =============================================
// Rendering Utilities — Pure helper functions
// for the rendering layer. No side effects.
// =============================================

import type { Widget, Scene } from "../../types/overlay-types";

/**
 * Sort widgets by zIndex for correct rendering order.
 * Returns a new array (immutable).
 */
export function sortByZIndex(widgets: Widget[]): Widget[] {
  return [...widgets].sort((a, b) => a.zIndex - b.zIndex);
}

/**
 * Filter visible widgets only.
 * Returns a new array (immutable).
 */
export function filterVisible(widgets: Widget[]): Widget[] {
  return widgets.filter((w) => w.visible);
}

/**
 * Calculate widget bounds for intersection tests.
 */
export function getWidgetBounds(widget: Widget) {
  return {
    x: widget.x,
    y: widget.y,
    width: widget.width,
    height: widget.height,
    right: widget.x + widget.width,
    bottom: widget.y + widget.height,
    centerX: widget.x + widget.width / 2,
    centerY: widget.y + widget.height / 2,
  };
}

/**
 * Check if two rectangles intersect.
 */
export function rectsIntersect(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/**
 * Generate a stable React key from a widget.
 */
export function widgetKey(widget: Widget): string {
  return `wgt-${widget.id}`;
}

/**
 * Generate a stable React key from a scene.
 */
export function sceneKey(scene: Scene): string {
  return `scn-${scene.id}`;
}

/**
 * Calculate bounding box for a set of widgets.
 */
export function calculateBoundingBox(widgets: Widget[]): {
  x: number; y: number; width: number; height: number;
} | null {
  if (widgets.length === 0) return null;

  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;

  for (const w of widgets) {
    minX = Math.min(minX, w.x);
    minY = Math.min(minY, w.y);
    maxX = Math.max(maxX, w.x + w.width);
    maxY = Math.max(maxY, w.y + w.height);
  }

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Convert screen coordinates to canvas coordinates.
 */
export function screenToCanvas(
  screenX: number, screenY: number,
  panX: number, panY: number,
  zoom: number,
): { x: number; y: number } {
  return {
    x: (screenX - panX) / zoom,
    y: (screenY - panY) / zoom,
  };
}

/**
 * Convert canvas coordinates to screen coordinates.
 */
export function canvasToScreen(
  canvasX: number, canvasY: number,
  panX: number, panY: number,
  zoom: number,
): { x: number; y: number } {
  return {
    x: canvasX * zoom + panX,
    y: canvasY * zoom + panY,
  };
}

/**
 * Get cursor style for a resize handle.
 */
export function getResizeCursor(handle: string): string {
  const cursors: Record<string, string> = {
    nw: "nwse-resize",
    n: "ns-resize",
    ne: "nesw-resize",
    w: "ew-resize",
    e: "ew-resize",
    sw: "nesw-resize",
    s: "ns-resize",
    se: "nwse-resize",
  };
  return cursors[handle] || "default";
}
