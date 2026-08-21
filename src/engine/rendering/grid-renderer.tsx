// =============================================
// Grid Renderer — Renders the background grid.
// Pure presentation, no business logic.
// =============================================

import React, { memo } from "react";

interface GridRendererProps {
  width: number;
  height: number;
  gridSize: number;
  zoom: number;
  panX: number;
  panY: number;
  visible: boolean;
}

/**
 * Renders a configurable background grid.
 * Zoom-aware: grid lines scale with zoom level.
 */
export const GridRenderer = memo(function GridRenderer({
  width, height, gridSize, zoom, panX, panY, visible,
}: GridRendererProps) {
  if (!visible || gridSize <= 0) return null;

  const scaledGrid = gridSize * zoom;
  if (scaledGrid < 4) return null; // Grid too small to render

  const offsetX = panX % scaledGrid;
  const offsetY = panY % scaledGrid;

  return (
    <svg
      width={width}
      height={height}
      className="pointer-events-none absolute inset-0"
      style={{ zIndex: 0 }}
    >
      <defs>
        <pattern
          id="grid"
          width={scaledGrid}
          height={scaledGrid}
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path
            d={`M ${scaledGrid} 0 L 0 0 0 ${scaledGrid}`}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
});
