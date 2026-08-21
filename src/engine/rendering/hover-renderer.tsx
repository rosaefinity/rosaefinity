// =============================================
// Hover Renderer — Renders hover border around
// the widget under the cursor.
// Pure presentation, no business logic.
// =============================================

import React, { memo } from "react";
import type { Widget } from "../../types/overlay-types";

interface HoverRendererProps {
  widget: Widget | null;
  zoom: number;
}

/**
 * Renders a subtle border around the hovered widget.
 * Only shows when no widget is selected (to avoid visual clutter).
 */
export const HoverRenderer = memo(function HoverRenderer({
  widget, zoom,
}: HoverRendererProps) {
  if (!widget || !widget.visible) return null;

  return (
    <div
      className="pointer-events-none absolute border border-white/30 rounded-sm"
      style={{
        left: widget.x * zoom - 1,
        top: widget.y * zoom - 1,
        width: widget.width * zoom + 2,
        height: widget.height * zoom + 2,
        zIndex: 998,
      }}
    />
  );
});
