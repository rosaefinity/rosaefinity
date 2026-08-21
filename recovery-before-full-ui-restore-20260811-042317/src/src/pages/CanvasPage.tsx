// =============================================
// CanvasPage — Editor host component.
// Wires all editor engines to the CanvasRenderer.
// No business logic — only event bridging.
// =============================================

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CanvasRenderer } from "../engine/rendering/canvas-renderer";
import { useEditor } from "../hooks/use-editor";
import type { ResizeHandle } from "../engine/interactions/interaction-types";
import type { PointerState } from "../engine/interactions/interaction-types";
import { InspectorPanel } from "../components/inspector/InspectorPanel";

export function CanvasPage() {
  const { instance, snapshot, refreshSnapshot } = useEditor();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [hoveredWidgetId, setHoveredWidgetId] = useState<string | null>(null);
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationAngle, setRotationAngle] = useState<number | null>(null);
  const [activeGuides, setActiveGuides] = useState<any[]>([]);
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  if (!instance) return <div className="flex items-center justify-center h-full text-white/40">Loading editor...</div>;

  const { interaction, keyboard, editorState, viewport, engine } = instance;
  const { editorState: es, activeScene } = snapshot;

  // Set active context when overlay/scene changes
  useEffect(() => {
    interaction.setActiveContext(es.selectedOverlayId, es.selectedSceneId);
    keyboard.setActiveContext(es.selectedOverlayId, es.selectedSceneId);
  }, [es.selectedOverlayId, es.selectedSceneId, interaction, keyboard]);

  // ─── Pointer Event Handlers ──────────────────

  const toPointerState = useCallback((e: React.MouseEvent): PointerState => ({
    x: e.clientX,
    y: e.clientY,
    button: e.button,
    shiftKey: e.shiftKey,
    ctrlKey: e.ctrlKey || e.metaKey,
    altKey: e.altKey,
  }), []);

  const findWidgetAtPoint = useCallback((x: number, y: number): string | null => {
    if (!activeScene) return null;
    // Check in reverse z-order (top widget first)
    const sorted = [...activeScene.widgets].sort((a, b) => b.zIndex - a.zIndex);
    for (const widget of sorted) {
      if (!widget.visible) continue;
      if (x >= widget.x && x <= widget.x + widget.width &&
          y >= widget.y && y <= widget.y + widget.height) {
        return widget.id;
      }
    }
    return null;
  }, [activeScene]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const ptr = toPointerState(e);
    const widgetId = findWidgetAtPoint(ptr.x, ptr.y);
    interaction.mouseDown(ptr, widgetId, null, es.activeTool);
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    refreshSnapshot();
  }, [toPointerState, findWidgetAtPoint, interaction, es.activeTool, refreshSnapshot]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const ptr = toPointerState(e);
    interaction.mouseMove(ptr);
    lastPointerRef.current = { x: e.clientX, y: e.clientY };
    refreshSnapshot();
  }, [toPointerState, interaction, refreshSnapshot]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    const ptr = toPointerState(e);
    interaction.mouseUp(ptr);
    setActiveHandle(null);
    setIsRotating(false);
    setRotationAngle(null);
    setActiveGuides([]);
    refreshSnapshot();
  }, [toPointerState, interaction, refreshSnapshot]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    interaction.zoomWheel(e.deltaY, e.clientX, e.clientY);
    refreshSnapshot();
  }, [interaction, refreshSnapshot]);

  const handleWidgetMouseEnter = useCallback((widgetId: string) => {
    setHoveredWidgetId(widgetId);
  }, []);

  const handleWidgetMouseLeave = useCallback(() => {
    setHoveredWidgetId(null);
  }, []);

  const handleHandleMouseDown = useCallback((handle: ResizeHandle, widgetId: string) => {
    setActiveHandle(handle);
  }, []);

  // ─── Keyboard Event Handlers ─────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keyboard.keyDown(e.key, e.code, {
        ctrl: e.ctrlKey || e.metaKey,
        shift: e.shiftKey,
        alt: e.altKey,
        meta: e.metaKey,
      });
      refreshSnapshot();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keyboard.keyUp(e.key, e.code);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [keyboard, refreshSnapshot]);

  return (
    <div className="flex h-full">
      {/* Canvas Area */}
      <div ref={canvasRef} className="flex-1 relative overflow-hidden">
        <CanvasRenderer
          scene={activeScene}
          groups={activeScene?.groups || []}
          selectedWidgetIds={es.selectedWidgetIds}
          hoveredWidgetId={hoveredWidgetId}
          showBoundingBox={es.selectedWidgetIds.length > 1}
          zoom={es.zoom}
          panX={es.panX}
          panY={es.panY}
          canvasWidth={1920}
          canvasHeight={1080}
          gridVisible={es.gridVisible}
          gridSize={10}
          activeGuides={activeGuides}
          activeHandle={activeHandle}
          isRotating={isRotating}
          rotationAngle={rotationAngle}
          onWidgetMouseDown={(id, e) => {
            const ptr = toPointerState(e);
            interaction.mouseDown(ptr, id, null, es.activeTool);
            refreshSnapshot();
          }}
          onCanvasMouseDown={handleMouseDown}
          onCanvasMouseMove={handleMouseMove}
          onCanvasMouseUp={handleMouseUp}
          onWidgetMouseEnter={handleWidgetMouseEnter}
          onWidgetMouseLeave={handleWidgetMouseLeave}
          onHandleMouseDown={handleHandleMouseDown}
        />
      </div>

      {/* Inspector Panel */}
      <InspectorPanel instance={instance} snapshot={snapshot} />

      {/* Status Bar */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-black/50 border-t border-white/10 flex items-center px-4 gap-6 text-xs text-white/40">
        <span>Tool: {es.activeTool}</span>
        <span>Zoom: {Math.round(es.zoom * 100)}%</span>
        <span>Selected: {es.selectedWidgetIds.length}</span>
        <span>Scene: {activeScene?.name || "—"}</span>
        <span>Overlay: {snapshot.activeOverlay?.name || "—"}</span>
      </div>
    </div>
  );
}
