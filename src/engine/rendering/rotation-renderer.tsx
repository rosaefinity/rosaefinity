// =============================================
// Rotation Renderer — Renders the rotation
// handle and rotation guide line.
// Pure presentation, no business logic.
// =============================================

import React, { memo } from "react";
import type { Widget } from "../../types/overlay-types";

interface RotationRendererProps {
  widget: Widget;
  zoom: number;
  isRotating: boolean;
  currentAngle: number | null;
}

const HANDLE_DISTANCE = 30;
const HANDLE_SIZE = 10;

/**
 * Renders a rotation handle above the widget and a guide line
 * showing the current rotation angle.
 */
export const RotationRenderer = memo(function RotationRenderer({
  widget, zoom, isRotating, currentAngle,
}: RotationRendererProps) {
  if (widget.locked) return null;

  const centerX = (widget.x + widget.width / 2) * zoom;
  const centerY = (widget.y + widget.height / 2) * zoom;
  const handleY = widget.y * zoom - HANDLE_DISTANCE * zoom;
  const handleX = centerX;
  const half = (HANDLE_SIZE / 2) * zoom;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 1001 }}>
      {/* Guide line from center to handle */}
      <svg className="pointer-events-none absolute inset-0" style={{ zIndex: 1000 }}>
        <line
          x1={centerX}
          y1={centerY}
          x2={handleX}
          y2={handleY}
          stroke={isRotating ? "#f59e0b" : "rgba(255,255,255,0.3)"}
          strokeWidth={1}
          strokeDasharray={isRotating ? "none" : "4 4"}
        />
      </svg>

      {/* Rotation handle */}
      <div
        className="absolute bg-amber-500 border-2 border-white rounded-full pointer-events-auto"
        style={{
          left: handleX - half,
          top: handleY - half,
          width: HANDLE_SIZE * zoom,
          height: HANDLE_SIZE * zoom,
          cursor: "grab",
          zIndex: 1002,
        }}
      />

      {/* Angle indicator during rotation */}
      {isRotating && currentAngle !== null && (
        <div
          className="absolute text-xs text-amber-400 font-mono pointer-events-none"
          style={{
            left: handleX + HANDLE_SIZE * zoom,
            top: handleY - 8,
            zIndex: 1003,
          }}
        >
          {Math.round(currentAngle)}°
        </div>
      )}
    </div>
  );
});
