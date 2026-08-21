// =============================================
// Canvas Renderer — Root rendering container.
// Renders the infinite canvas with grid, scene,
// selection, handles, guides, and hover.
//
// Pure presentation. No business logic.
// All state comes from props (read-only).
// =============================================

import React, { memo, useMemo, useCallback, useRef, useState } from "react";
import type { Scene, Widget, WidgetGroup } from "../../types/overlay-types";
import type { ResizeHandle } from "../interactions/interaction-types";
import type { Guide } from "../alignment/guide-types";
import { SceneRenderer } from "./scene-renderer";
import { SelectionRenderer } from "./selection-renderer";
import { ResizeHandleRenderer } from "./resize-handle-renderer";
import { RotationRenderer } from "./rotation-renderer";
import { SnapGuideRenderer } from "./snap-guide-renderer";
import { GridRenderer } from "./grid-renderer";
import { HoverRenderer } from "./hover-renderer";

export interface CanvasRendererProps {
  // Scene data
  scene: Scene | null;
  groups: WidgetGroup[];

  // Selection state
  selectedWidgetIds: string[];
  hoveredWidgetId: string | null;
  showBoundingBox: boolean;

  // Viewport
  zoom: number;
  panX: number;
  panY: number;
  canvasWidth: number;
  canvasHeight: number;

  // Grid
  gridVisible: boolean;
  gridSize: number;

  // Guides
  activeGuides: Guide[];

  // Active tool state
  activeHandle: ResizeHandle | null;
  isRotating: boolean;
  rotationAngle: number | null;

  // Event handlers (passed from InteractionController)
  onWidgetMouseDown: (widgetId: string, event: React.MouseEvent) => void;
  onCanvasMouseDown: (event: React.MouseEvent) => void;
  onCanvasMouseMove: (event: React.MouseEvent) => void;
  onCanvasMouseUp: (event: React.MouseEvent) => void;
  onWidgetMouseEnter: (widgetId: string) => void;
  onWidgetMouseLeave: () => void;
  onHandleMouseDown: (handle: ResizeHandle, widgetId: string) => void;
}

/**
 * Root canvas renderer. Renders all visual layers:
 * grid, widgets, selection, handles, rotation, guides, hover.
 *
 * This component is purely presentational — it receives all state
 * as props and delegates events to parent handlers.
 */
export const CanvasRenderer = memo(function CanvasRenderer(props: CanvasRendererProps) {
  const {
    scene, groups,
    selectedWidgetIds, hoveredWidgetId, showBoundingBox,
    zoom, panX, panY, canvasWidth, canvasHeight,
    gridVisible, gridSize,
    activeGuides,
    activeHandle, isRotating, rotationAngle,
    onWidgetMouseDown, onCanvasMouseDown, onCanvasMouseMove, onCanvasMouseUp,
    onWidgetMouseEnter, onWidgetMouseLeave, onHandleMouseDown,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);

  // Resolve selected widgets from scene
  const selectedWidgets = useMemo(() => {
    if (!scene || selectedWidgetIds.length === 0) return [];
    return scene.widgets.filter((w) => selectedWidgetIds.includes(w.id));
  }, [scene, selectedWidgetIds]);

  // Resolve hovered widget
  const hoveredWidget = useMemo(() => {
    if (!scene || !hoveredWidgetId) return null;
    return scene.widgets.find((w) => w.id === hoveredWidgetId) ?? null;
  }, [scene, hoveredWidgetId]);

  // Find which selected widget has resize handles (last selected)
  const activeResizeWidget = useMemo(() => {
    if (selectedWidgets.length === 0) return null;
    return selectedWidgets[selectedWidgets.length - 1];
  }, [selectedWidgets]);

  // Canvas transform
  const canvasTransform = `translate(${panX}px, ${panY}px) scale(${zoom})`;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-[#1a1a24]"
      onMouseDown={onCanvasMouseDown}
      onMouseMove={onCanvasMouseMove}
      onMouseUp={onCanvasMouseUp}
      style={{ cursor: isRotating ? "crosshair" : "default" }}
    >
      {/* Grid layer */}
      <GridRenderer
        width={canvasWidth}
        height={canvasHeight}
        gridSize={gridSize}
        zoom={zoom}
        panX={panX}
        panY={panY}
        visible={gridVisible}
      />

      {/* Canvas transform container */}
      <div
        className="absolute"
        style={{
          transform: canvasTransform,
          transformOrigin: "0 0",
          width: canvasWidth,
          height: canvasHeight,
        }}
      >
        {/* Widget layer */}
        <SceneRenderer scene={scene} zoom={1} />

        {/* Selection borders */}
        <SelectionRenderer
          selectedWidgets={selectedWidgets}
          zoom={1}
          showBoundingBox={showBoundingBox}
        />

        {/* Resize handles on last selected widget */}
        {activeResizeWidget && activeHandle !== null && (
          <ResizeHandleRenderer
            widget={activeResizeWidget}
            zoom={1}
            activeHandle={activeHandle}
            onHandleMouseDown={onHandleMouseDown}
          />
        )}

        {/* Rotation handle on single selected widget */}
        {selectedWidgets.length === 1 && isRotating && (
          <RotationRenderer
            widget={selectedWidgets[0]}
            zoom={1}
            isRotating={isRotating}
            currentAngle={rotationAngle}
          />
        )}

        {/* Hover border */}
        <HoverRenderer
          widget={hoveredWidget}
          zoom={1}
        />
      </div>

      {/* Guide lines (in screen space, not canvas space) */}
      <SnapGuideRenderer
        guides={activeGuides}
        canvasWidth={canvasWidth}
        canvasHeight={canvasHeight}
        zoom={zoom}
        panX={panX}
        panY={panY}
      />
    </div>
  );
});
