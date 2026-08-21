// =============================================
// Selection Renderer — Renders selection borders,
// bounding boxes, and multi-selection indicators.
// Pure presentation, no business logic.
// =============================================

import React, { memo } from "react";
import type { Widget } from "../../types/overlay-types";
import { calculateBoundingBox } from "./rendering-utils";

interface SelectionRendererProps {
  selectedWidgets: Widget[];
  zoom: number;
  showBoundingBox: boolean;
}

/**
 * Renders selection borders around selected widgets
 * and an overall bounding box for multi-selection.
 */
export const SelectionRenderer = memo(function SelectionRenderer({
  selectedWidgets, zoom, showBoundingBox,
}: SelectionRendererProps) {
  if (selectedWidgets.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 1000 }}>
      {/* Individual selection borders */}
      {selectedWidgets.map((widget) => (
        <div
          key={`sel-${widget.id}`}
          className="absolute border-2 border-blue-500 rounded-sm"
          style={{
            left: widget.x * zoom - 1,
            top: widget.y * zoom - 1,
            width: widget.width * zoom + 2,
            height: widget.height * zoom + 2,
          }}
        />
      ))}

      {/* Multi-selection bounding box */}
      {showBoundingBox && selectedWidgets.length > 1 && (() => {
        const bbox = calculateBoundingBox(selectedWidgets);
        if (!bbox) return null;
        return (
          <div
            className="absolute border border-dashed border-blue-400/50"
            style={{
              left: bbox.x * zoom - 4,
              top: bbox.y * zoom - 4,
              width: bbox.width * zoom + 8,
              height: bbox.height * zoom + 8,
            }}
          />
        );
      })()}
    </div>
  );
});
