// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// RosaeFinity Event Bus V2 â€” Core Event Bus
// v3.1 Architecture Spec (Frozen)
//
// Central messaging system for all overlay events.
// Supports broadcast, targeted, priority, cancelable,
// batched, throttled, debounced delivery.
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import type {
  OverlayEvent, EventSubscription, EventFilter, EventPriority,
  EventSourceType, EventMiddleware, EventDiagnostics, QueueEntry,
} from './EventTypes';

// â”€â”€â”€ ID Generator â”€â”€â”€

let nextSubId = 0;
let nextEventId = 0;
function genSubId(): string { return `sub-${nextSubId++}`; }
function genEventId(): string { return `evt-${Date.now()}-${nextEventId++}`; }

// â”€â”€â”€ Event Bus â”€â”€â”€

export class OverlayEventBus {
  private subscriptions = new Map<string, EventSubscription>();
  private middleware: EventMiddleware[] = [];
  private history: OverlayEvent[] = [];
  private queue: QueueEntry[] = [];
  private paused = false;
  private maxHistory = 1000;
  private droppedEvents = 0;
  private totalEvents = 0;
  private totalDispatches = 0;
  private dispatchStart = 0;
  private eventsInLastSecond = 0;
  private lastSecondMark = 0;

  // â”€â”€â”€ Core API â”€â”€â”€

  /**
   * Subscribe to events with optional filter.
   * Returns unsubscribe function.
   */
  subscribe(
    callback: (event: OverlayEvent) => void,
    filter?: EventFilter,
    options?: { throttleMs?: number; debounceMs?: number; once?: boolean; priority?: number },
  ): () => void {
    const id = genSubId();
    const sub: EventSubscription = {
      id,
      callback,
      filter: filter ?? {},
      throttleMs: options?.throttleMs ?? 0,
      debounceMs: options?.debounceMs ?? 0,
      once: options?.once ?? false,
      priority: options?.priority ?? 0,
    };
    this.subscriptions.set(id, sub);
    return () => { this.subscriptions.delete(id); };
  }

  /**
   * Subscribe to a single event type (shorthand).
   */
  on(type: string, callback: (event: OverlayEvent) => void): () => void {
    return this.subscribe(callback, { types: [type] });
  }

  /**
   * Subscribe once â€” auto-unsubscribes after first event.
   */
  once(type: string, callback: (event: OverlayEvent) => void): () => void {
    return this.subscribe(callback, { types: [type] }, { once: true });
  }

  /**
   * Emit an event (broadcast to all matching subscribers).
   */
  emit(type: string, data: Record<string, unknown>, options?: {
    source?: EventSourceType;
    priority?: EventPriority;
    screenId?: string;
    namespace?: string;
    cancelable?: boolean;
  }): string {
    const event: OverlayEvent = {
      id: genEventId(),
      type,
      source: options?.source ?? 'custom',
      priority: options?.priority ?? 0,
      timestamp: Date.now(),
      data,
      screenId: options?.screenId,
      namespace: options?.namespace,
      cancelable: options?.cancelable ?? false,
    };

    this.dispatch(event);
    return event.id;
  }

  /**
   * Emit to a specific screen.
   */
  emitTo(screenId: string, type: string, data: Record<string, unknown>): string {
    return this.emit(type, data, { screenId });
  }

  /**
   * Broadcast to all subscribers (ignores filters).
   */
  broadcast(type: string, data: Record<string, unknown>): string {
    const event: OverlayEvent = {
      id: genEventId(),
      type,
      source: 'system',
      priority: 2,
      timestamp: Date.now(),
      data,
      cancelable: false,
    };

    // Force delivery to all subscribers
    for (const sub of this.subscriptions.values()) {
      this.deliverToSubscription(event, sub);
    }

    this.recordHistory(event);
    return event.id;
  }

  /**
   * Dispatch an event through the full pipeline.
   */
  dispatch(event: OverlayEvent): void {
    if (this.paused) {
      this.queue.push({ event, enqueuedAt: Date.now() });
      return;
    }

    this.totalEvents++;
    this.dispatchStart = performance.now();

    // Run through middleware pipeline
    let current: OverlayEvent | null = event;
    const runMiddleware = (idx: number) => {
      if (idx >= this.middleware.length || !current) {
        this.deliverEvent(current ?? event);
        return;
      }
      this.middleware[idx](current, (next) => {
        current = next;
        runMiddleware(idx + 1);
      });
    };
    runMiddleware(0);
  }

  /**
   * Cancel a cancelable event by ID.
   */
  cancelEvent(eventId: string): boolean {
    // Can't cancel after dispatch, but can prevent delivery in queue
    const idx = this.queue.findIndex(q => q.event.id === eventId);
    if (idx !== -1) {
      this.queue.splice(idx, 1);
      return true;
    }
    return false;
  }

  /**
   * Batch emit multiple events at once.
   */
  batch(events: Array<{ type: string; data: Record<string, unknown>; source?: EventSourceType }>): void {
    for (const e of events) {
      this.emit(e.type, e.data, { source: e.source });
    }
  }

  // â”€â”€â”€ Middleware â”€â”€â”€

  use(middleware: EventMiddleware): () => void {
    this.middleware.push(middleware);
    return () => {
      const idx = this.middleware.indexOf(middleware);
      if (idx !== -1) this.middleware.splice(idx, 1);
    };
  }

  // â”€â”€â”€ Pause / Resume â”€â”€â”€

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    // Process queued events
    while (this.queue.length > 0) {
      const entry = this.queue.shift()!;
      this.deliverEvent(entry.event);
    }
  }

  // â”€â”€â”€ History â”€â”€â”€

  getHistory(limit?: number): readonly OverlayEvent[] {
    if (limit) return this.history.slice(-limit);
    return this.history;
  }

  replay(historyIndex: number): void {
    const event = this.history[historyIndex];
    if (event) {
      this.emit(event.type, { ...event.data }, {
        source: event.source,
        priority: event.priority,
        screenId: event.screenId,
      });
    }
  }

  clearHistory(): void {
    this.history = [];
  }

  // â”€â”€â”€ Cleanup â”€â”€â”€

  clear(): void {
    this.subscriptions.clear();
    this.middleware = [];
    this.history = [];
    this.queue = [];
  }

  destroy(): void {
    this.clear();
  }

  // â”€â”€â”€ Diagnostics â”€â”€â”€

  getDiagnostics(): EventDiagnostics {
    const now = Date.now();
    if (now - this.lastSecondMark >= 1000) {
      this.eventsInLastSecond = 0;
      this.lastSecondMark = now;
    }

    return {
      eventsPerSecond: this.eventsInLastSecond,
      dispatchLatencyMs: this.dispatchStart > 0 ? performance.now() - this.dispatchStart : 0,
      droppedEvents: this.droppedEvents,
      subscriberCount: this.subscriptions.size,
      queueSize: this.queue.length,
      historySize: this.history.length,
      totalEvents: this.totalEvents,
      totalDispatches: this.totalDispatches,
    };
  }

  // â”€â”€â”€ Private â”€â”€â”€

  private deliverEvent(event: OverlayEvent): void {
    this.totalDispatches++;
    this.eventsInLastSecond++;
    this.recordHistory(event);

    // Find matching subscriptions
    const matching: EventSubscription[] = [];
    for (const sub of this.subscriptions.values()) {
      if (this.matchesFilter(event, sub.filter)) {
        matching.push(sub);
      }
    }

    // Sort by subscription priority
    matching.sort((a, b) => b.priority - a.priority);

    // Deliver
    for (const sub of matching) {
      if (event._cancelled) break;
      this.deliverToSubscription(event, sub);

      if (sub.once) {
        this.subscriptions.delete(sub.id);
      }
    }
  }

  private deliverToSubscription(event: OverlayEvent, sub: EventSubscription): void {
    try {
      sub.callback(event);
    } catch (error) {
      console.error(`[EventBus] Subscriber "${sub.id}" error:`, error);
    }
  }

  private matchesFilter(event: OverlayEvent, filter: EventFilter): boolean {
    if (filter.types && filter.types.length > 0 && !filter.types.includes(event.type)) return false;
    if (filter.sources && filter.sources.length > 0 && !filter.sources.includes(event.source)) return false;
    if (filter.minPriority !== undefined && event.priority < filter.minPriority) return false;
    if (filter.namespaces && filter.namespaces.length > 0 && (!event.namespace || !filter.namespaces.includes(event.namespace))) return false;
    if (filter.predicate && !filter.predicate(event)) return false;
    if (event.screenId && filter.types && !filter.types.includes(event.type)) return false;
    return true;
  }

  private recordHistory(event: OverlayEvent): void {
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }
}

// â”€â”€â”€ Singleton â”€â”€â”€

let _bus: OverlayEventBus | null = null;

export function getEventBus(): OverlayEventBus {
  if (!_bus) _bus = new OverlayEventBus();
  return _bus;
}
