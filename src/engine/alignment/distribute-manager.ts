// =============================================
// Distribute Manager — Calculates equal spacing
// for widget distribution. Pure math, no DOM.
// =============================================

import type { WidgetBounds, DistributionResult } from "./alignment-types";

export class DistributeManager {
  /**
   * Distribute widgets equally along the horizontal axis.
   * Preserves ordering by current x position.
   */
  distributeHorizontal(bounds: WidgetBounds[]): DistributionResult[] {
    if (bounds.length < 2) {
      throw new Error("[DistributeManager] Need at least 2 widgets to distribute");
    }

    // Sort by x position
    const sorted = [...bounds].sort((a, b) => a.x - b.x);

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpan = (last.x + last.width) - first.x;
    const totalWidgetWidth = sorted.reduce((sum, w) => sum + w.width, 0);
    const availableSpace = totalSpan - totalWidgetWidth;
    const gap = availableSpace / (sorted.length - 1);

    const results: DistributionResult[] = [];
    let currentX = first.x;

    for (let i = 0; i < sorted.length; i++) {
      const widget = sorted[i];
      results.push({
        widgetId: widget.id,
        newX: Math.round(currentX * 100) / 100,
        newY: widget.y,
        index: i,
      });
      currentX += widget.width + gap;
    }

    return results;
  }

  /**
   * Distribute widgets equally along the vertical axis.
   * Preserves ordering by current y position.
   */
  distributeVertical(bounds: WidgetBounds[]): DistributionResult[] {
    if (bounds.length < 2) {
      throw new Error("[DistributeManager] Need at least 2 widgets to distribute");
    }

    // Sort by y position
    const sorted = [...bounds].sort((a, b) => a.y - b.y);

    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpan = (last.y + last.height) - first.y;
    const totalWidgetHeight = sorted.reduce((sum, w) => sum + w.height, 0);
    const availableSpace = totalSpan - totalWidgetHeight;
    const gap = availableSpace / (sorted.length - 1);

    const results: DistributionResult[] = [];
    let currentY = first.y;

    for (let i = 0; i < sorted.length; i++) {
      const widget = sorted[i];
      results.push({
        widgetId: widget.id,
        newX: widget.x,
        newY: Math.round(currentY * 100) / 100,
        index: i,
      });
      currentY += widget.height + gap;
    }

    return results;
  }

  /**
   * Calculate the total span needed for horizontal distribution.
   */
  getHorizontalSpan(bounds: WidgetBounds[]): number {
    if (bounds.length === 0) return 0;
    const sorted = [...bounds].sort((a, b) => a.x - b.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return (last.x + last.width) - first.x;
  }

  /**
   * Calculate the total span needed for vertical distribution.
   */
  getVerticalSpan(bounds: WidgetBounds[]): number {
    if (bounds.length === 0) return 0;
    const sorted = [...bounds].sort((a, b) => a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    return (last.y + last.height) - first.y;
  }

  /**
   * Calculate the gap size for horizontal distribution.
   */
  getHorizontalGap(bounds: WidgetBounds[]): number {
    if (bounds.length < 2) return 0;
    const sorted = [...bounds].sort((a, b) => a.x - b.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpan = (last.x + last.width) - first.x;
    const totalWidgetWidth = sorted.reduce((sum, w) => sum + w.width, 0);
    return (totalSpan - totalWidgetWidth) / (sorted.length - 1);
  }

  /**
   * Calculate the gap size for vertical distribution.
   */
  getVerticalGap(bounds: WidgetBounds[]): number {
    if (bounds.length < 2) return 0;
    const sorted = [...bounds].sort((a, b) => a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const totalSpan = (last.y + last.height) - first.y;
    const totalWidgetHeight = sorted.reduce((sum, w) => sum + w.height, 0);
    return (totalSpan - totalWidgetHeight) / (sorted.length - 1);
  }
}
