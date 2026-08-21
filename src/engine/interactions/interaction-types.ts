// =============================================
// Interaction Types — Shared types for all
// editor interaction controllers.
// =============================================

// ===== Interaction Mode =====
export type InteractionMode =
  | 'idle'
  | 'dragging'
  | 'resizing'
  | 'rotating'
  | 'box-selecting'
  | 'panning';

// ===== Resize Handle =====
export type ResizeHandle =
  | 'n' | 'ne' | 'e' | 'se'
  | 's' | 'sw' | 'w' | 'nw';

// ===== Pointer State =====
export interface PointerState {
  x: number;
  y: number;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}

// ===== Drag Data =====
export interface DragData {
  widgetIds: string[];
  overlayId: string;
  sceneId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  offsetX: number;
  offsetY: number;
}

// ===== Resize Data =====
export interface ResizeData {
  widgetId: string;
  overlayId: string;
  sceneId: string;
  handle: ResizeHandle;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  originalX: number;
  originalY: number;
  originalWidth: number;
  originalHeight: number;
  keepAspectRatio: boolean;
  centerResize: boolean;
}

// ===== Rotate Data =====
export interface RotateData {
  widgetId: string;
  overlayId: string;
  sceneId: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  originalAngle: number;
  centerX: number;
  centerY: number;
  snapAngle: boolean;
}

// ===== Selection Box =====
export interface SelectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ===== Box Selection Data =====
export interface BoxSelectionData {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  additive: boolean;
}
