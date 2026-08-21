// =============================================
// Overlay Runtime — Type Definitions
// Types for the overlay runtime system.
// =============================================

// ===== Overlay Priority =====
export type OverlayPriority = 'critical' | 'high' | 'normal' | 'low';

// ===== Overlay Type =====
export type OverlayType = string;

// ===== Overlay Type Definition =====
export interface OverlayTypeDefinition {
  type: OverlayType;
  label: string;
  description: string;
  category: string;
  icon: string;
  defaultSize: { width: number; height: number };
  defaultConfig: Record<string, unknown>;
  defaultAnimation: AnimationConfig;
  maxDuration?: number;
  isAlert?: boolean;
  isGoal?: boolean;
  isWidget?: boolean;
}

// ===== Animation Config =====
export interface AnimationConfig {
  enter: {
    type: string;
    from: Record<string, number>;
    to: Record<string, number>;
    duration: number;
    delay: number;
  };
  exit: {
    type: string;
    from: Record<string, number>;
    to: Record<string, number>;
    duration: number;
    delay: number;
  };
  duration: number;
  easing: string;
}

// ===== Overlay Instance =====
export interface OverlayInstance {
  id: string;
  type: OverlayType;
  name: string;
  enabled: boolean;
  visible: boolean;
  zIndex: number;
  position: { x: number; y: number; width?: number; height?: number };
  rotation: number;
  opacity: number;
  scale: number;
  locked: boolean;
  groupId: string | null;
  config: Record<string, unknown>;
  animation: AnimationConfig;
  sceneId?: string;
  createdAt?: number;
  updatedAt?: number;
}

// ===== Overlay Event =====
export interface OverlayEvent {
  type: string;
  config: Record<string, unknown>;
  priority: OverlayPriority;
  screenId?: string;
  timestamp: number;
  variables?: Record<string, unknown>;
}

// ===== Overlay Queue Item =====
export interface OverlayQueueItem {
  overlay: OverlayInstance;
  priority: OverlayPriority;
  enqueuedAt: number;
}

// ===== Overlay Stats =====
export interface OverlayStats {
  activeCount: number;
  queueSize: number;
  totalRendered: number;
  avgRenderTime: number;
  memoryUsage: number;
}

// ===== Overlay Scene =====
export interface OverlayScene {
  id: string;
  name: string;
  description?: string;
  overlayIds: string[];
  overlays: OverlayInstance[];
  visible: boolean;
  hotkey: string | null;
  isActive: boolean;
  createdAt?: number;
  updatedAt?: number;
}

// ===== Layer Group =====
export interface LayerGroup {
  id: string;
  name: string;
  overlayIds: string[];
  locked: boolean;
  visible: boolean;
}
