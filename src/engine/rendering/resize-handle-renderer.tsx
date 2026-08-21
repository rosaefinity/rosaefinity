// =============================================
// Resize Handle Renderer — Renders 8 resize
// handles around selected widgets.
// Pure presentation, no business logic.
// =============================================

import React, { memo, useCallback } from "react";
import type { Widget } from "../../types/overlay-types";
import type { ResizeHandle } from "../interactions/interaction-types";
import { getResizeCursor } from "./rendering-utils";

interface ResizeHandleRendererProps {
  widget: Widget;
  zoom: number;
  activeHandle: ResizeHandle | null;
  onHandleMouseDown: (handle: ResizeHandle, widgetId: string) => void;
}

const HANDLE_SIZE = 8;

interface HandlePosition {
  handle: ResizeHandle;
  x: number;
  y: number;
}

function getHandlePositions(widget: Widget): HandlePosition[] {
  const { x, y, width, height } = widget;
  return [
    { handle: "nw", x: x, y: y },
    { handle: "n", x: x + width / 2, y: y },
    { handle: "ne", x: x + width, y: y },
    { handle: "w", x: x, y: y + height / 2 },
    { handle: "e", x: x + width, y: y + height / 2 },
    { handle: "sw", x: x, y: y + height },
    { handle: "s", x: x + width / 2, y: y + height },
    { handle: "se", x: x + width, y: y + height },
  ];
}

/**
 * Renders 8 resize handles around a selected widget.
 * Each handle has a cursor change and mouse down handler.
 */
export const ResizeHandleRenderer = memo(function ResizeHandleRenderer({
  widget, zoom, activeHandle, onHandleMouseDown,
}: ResizeHandleRendererProps) {
  if (widget.locked) return null;

  const handles = getHandlePositions(widget);
  const half = (HANDLE_SIZE / 2) * zoom;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 1001 }}>
      {handles.map(({ handle, x, y }) => (
        <div
          key={`resize-${handle}`}
          className="absolute bg-white border border-blue-500 pointer-events-auto"
          style={{
            left: x * zoom - half,
            top: y * zoom - half,
            width: HANDLE_SIZE * zoom,
            height: HANDLE_SIZE * zoom,
            cursor: getResizeCursor(handle),
            zIndex: activeHandle === handle ? 1002 : 1001,
            backgroundColor: activeHandle === handle ? "#3b82f6" : "white",
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onHandleMouseDown(handle, widget.id);
          }}
        />
      ))}
    </div>
  );
});
