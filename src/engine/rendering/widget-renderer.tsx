// =============================================
// Widget Renderer — Renders a single widget.
// Pure presentation, no business logic.
// =============================================

import React, { memo } from "react";
import type { Widget } from "../../types/overlay-types";

interface WidgetRendererProps {
  widget: Widget;
  zoom: number;
}

/**
 * Renders a single widget with position, rotation, scale, opacity, and lock state.
 * Pure presentation component — no side effects.
 */
export const WidgetRenderer = memo(function WidgetRenderer({
  widget, zoom,
}: WidgetRendererProps) {
  if (!widget.visible) return null;

  const transform = [
    `translate(${widget.x * zoom}px, ${widget.y * zoom}px)`,
    `rotate(${widget.rotation}deg)`,
    `scale(${zoom})`,
  ].join(" ");

  return (
    <div
      data-widget-id={widget.id}
      className="absolute"
      style={{
        width: widget.width,
        height: widget.height,
        transform,
        transformOrigin: "0 0",
        opacity: widget.locked ? 0.7 : 1,
        cursor: widget.locked ? "not-allowed" : "move",
      }}
    >
      {/* Widget content placeholder */}
      <div
        className="w-full h-full rounded-lg border border-white/20 bg-white/5 flex items-center justify-center text-xs text-white/40"
      >
        {widget.type}
      </div>
    </div>
  );
});
