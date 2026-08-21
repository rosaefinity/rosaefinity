// =============================================
// Scene Renderer — Renders the active scene's
// widgets sorted by zIndex. Pure presentation.
// =============================================

import React, { memo, useMemo } from "react";
import type { Scene } from "../../types/overlay-types";
import { WidgetRenderer } from "./widget-renderer";
import { sortByZIndex, filterVisible } from "./rendering-utils";

interface SceneRendererProps {
  scene: Scene | null;
  zoom: number;
}

/**
 * Renders all visible widgets in a scene, sorted by zIndex.
 * Only renders the active scene for performance.
 */
export const SceneRenderer = memo(function SceneRenderer({
  scene, zoom,
}: SceneRendererProps) {
  const sortedWidgets = useMemo(() => {
    if (!scene) return [];
    return sortByZIndex(filterVisible(scene.widgets));
  }, [scene]);

  if (!scene || sortedWidgets.length === 0) return null;

  return (
    <div className="absolute inset-0" style={{ zIndex: 1 }}>
      {sortedWidgets.map((widget) => (
        <WidgetRenderer
          key={`widget-${widget.id}`}
          widget={widget}
          zoom={zoom}
        />
      ))}
    </div>
  );
});
