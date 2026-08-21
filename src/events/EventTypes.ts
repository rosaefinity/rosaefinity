// =============================================
// RosaeFinity Event Bus V2 — Type Definitions
// v3.1 Architecture Spec (Frozen)
// =============================================

// ===== Event Source =====
export type EventSourceType = 'tiktok' | 'system' | 'custom' | 'test' | 'internal';

// ===== Event Priority =====
export type EventPriority = 0 | 1 | 2; // 0 = normal, 1 = high, 2 = critical

// ===== Overlay Event =====
export interface OverlayEvent {
  id: string;
  type: string;
  source: EventSourceType;
  priority: EventPriority;
  timestamp: number;
  data: Record<string, unknown>;
  screenId?: string;
  namespace?: string;
  cancelable: boolean;
  _cancelled?: boolean;
}

// ===== Event Filter =====
export interface EventFilter {
  types?: string[];
  sources?: EventSourceType[];
  minPriority?: EventPriority;
  namespaces?: string[];
  predicate?: (event: OverlayEvent) => boolean;
}

// ===== Event Subscription =====
export interface EventSubscription {
  id: string;
  callback: (event: OverlayEvent) => void;
  filter: EventFilter;
  throttleMs: number;
  debounceMs: number;
  once: boolean;
  priority: number;
}

// ===== Event Middleware =====
export type EventMiddleware = (
  event: OverlayEvent,
  next: (event: OverlayEvent | null) => void,
) => void;

// ===== Event Diagnostics =====
export interface EventDiagnostics {
  eventsPerSecond: number;
  dispatchLatencyMs: number;
  droppedEvents: number;
  subscriberCount: number;
  queueSize: number;
  historySize: number;
  totalEvents: number;
  totalDispatches: number;
}

// ===== Queue Entry =====
export interface QueueEntry {
  event: OverlayEvent;
  enqueuedAt: number;
}
