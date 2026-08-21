// =============================================
// Snap Guide Renderer — Renders alignment
// guide lines during drag/resize operations.
// Pure presentation, no business logic.
// =============================================

import React, { memo } from "react";
import type { Guide } from "../alignment/guide-types";

interface SnapGuideRendererProps {
  guides: Guide[];
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  panX: number;
  panY: number;
}

/**
 * Renders vertical and horizontal guide lines.
 * Guides are positioned in canvas space and transformed to screen space.
 */
export const SnapGuideRenderer = memo(function SnapGuideRenderer({
  guides, canvasWidth, canvasHeight, zoom, panX, panY,
}: SnapGuideRendererProps) {
  if (guides.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 999 }}>
      {guides.map((guide) => {
        if (guide.axis === "x") {
          const screenX = guide.position * zoom + panX;
          return (
            <div
              key={`guide-x-${guide.id}`}
              className="absolute bg-cyan-400/70"
              style={{
                left: screenX,
                top: 0,
                width: 1,
                height: canvasHeight,
              }}
            />
          );
        } else {
          const screenY = guide.position * zoom + panY;
          return (
            <div
              key={`guide-y-${guide.id}`}
              className="absolute bg-cyan-400/70"
              style={{
                left: 0,
                top: screenY,
                width: canvasWidth,
                height: 1,
              }}
            />
          );
        }
      })}
    </div>
  );
});
