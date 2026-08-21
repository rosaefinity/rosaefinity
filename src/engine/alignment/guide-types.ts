// =============================================
// Guide Types — Shared types for the alignment
// guide system.
// =============================================

// ===== Guide Axis =====
export type GuideAxis = 'x' | 'y';

// ===== Guide Source =====
export type GuideSource = 'canvas-center' | 'widget-edge' | 'widget-center' | 'custom';

// ===== Guide =====
export interface Guide {
  id: string;
  axis: GuideAxis;
  position: number;
  source: GuideSource;
}

// ===== Guide Candidate =====
export interface GuideCandidate {
  position: number;
  distance: number;
  guide: Guide;
}

// ===== Guide Calculation Result =====
export interface GuideCalculationResult {
  snappedX: number;
  snappedY: number;
  activeGuidesX: Guide[];
  activeGuidesY: Guide[];
}

// ===== Guide Manager Config =====
export interface GuideManagerConfig {
  enabled: boolean;
  threshold: number;
  showCanvasCenter: boolean;
  showWidgetEdges: boolean;
  showWidgetCenters: boolean;
}
