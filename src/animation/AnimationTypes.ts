// =============================================
// RosaeFinity Animation Engine — Type Definitions
// v3.1 Architecture Spec (Frozen)
// =============================================

// ===== Easing =====
export type EasingType =
  | 'linear'
  | 'ease'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'spring'
  | 'bounce'
  | 'elastic'
  | 'back'
  | 'expo'
  | 'cubic'
  | 'quart'
  | 'quint';

// ===== Animation Category =====
export type AnimationCategory = 'entry' | 'exit' | 'loop' | 'event';

// ===== Animation Direction =====
export type AnimationDirection = 'normal' | 'reverse' | 'alternate' | 'alternate-reverse';

// ===== Fill Mode =====
export type AnimationFillMode = 'none' | 'forwards' | 'backwards' | 'both';

// ===== Keyframe =====
export interface AnimationKeyframe {
  properties: Record<string, string>;
}

// ===== Animation Definition =====
export interface AnimationDefinition {
  id?: string;
  keyframes: AnimationKeyframe[];
  duration: number;
  easing: EasingType;
  delay: number;
  repeat: number; // 0 = once, -1 = infinite, N = N+1 times
  direction: AnimationDirection;
  fillMode: AnimationFillMode;
  gpuAccelerated: boolean;
  category?: AnimationCategory;
}

// ===== Animation State =====
export type AnimationState = 'idle' | 'running' | 'paused' | 'completed' | 'cancelled';

// ===== Animation Instance =====
export interface AnimationInstance {
  id: string;
  definition: AnimationDefinition;
  state: AnimationState;
  startTime: number;
  currentTime: number;
  progress: number;
  iteration: number;
  targetElement: HTMLElement;
  onComplete?: () => void;
  onCancel?: () => void;
}

// ===== Animation Diagnostics =====
export interface AnimationDiagnostics {
  runningCount: number;
  queuedCount: number;
  completedCount: number;
  droppedFrames: number;
  averageFps: number;
  frameTime: number;
  totalAnimations: number;
}

// ===== Queue Entry =====
export interface QueueEntry {
  id: string;
  definition: AnimationDefinition;
  targetElement: HTMLElement;
  priority: number;
  onComplete?: () => void;
}

// ===== Animation Group =====
export interface AnimationGroup {
  id: string;
  name: string;
  instances: AnimationInstance[];
  startTime: number;
  state: AnimationState;
}

// ===== Animation Preset Entry =====
export interface AnimationPresetEntry {
  id: string;
  name: string;
  category: AnimationCategory;
  description: string;
  icon: string;
  definition: AnimationDefinition;
}
