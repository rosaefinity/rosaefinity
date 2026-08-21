// =============================================
// Alignment Events — Typed event bus for
// alignment and distribution operations.
// =============================================

import type { AlignmentDirection, DistributionDirection } from "./alignment-types";

export interface AlignmentEventMap {
  "alignment:started": { direction: AlignmentDirection; widgetCount: number };
  "alignment:completed": { direction: AlignmentDirection; widgetCount: number };
  "distribution:started": { direction: DistributionDirection; widgetCount: number };
  "distribution:completed": { direction: DistributionDirection; widgetCount: number };
  "guides:changed": { guideCount: number };
}

export type AlignmentEventType = keyof AlignmentEventMap;
export type AlignmentEventHandler<T extends AlignmentEventType> =
  (data: AlignmentEventMap[T]) => void;

class AlignmentEventBus {
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  on<T extends AlignmentEventType>(event: T, handler: AlignmentEventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as (data: unknown) => void);
    return () => {
      this.listeners.get(event)?.delete(handler as (data: unknown) => void);
    };
  }

  emit<T extends AlignmentEventType>(event: T, data: AlignmentEventMap[T]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[AlignmentEvents] Error in handler for "${event}":`, err);
        }
      }
    }
  }

  clear(event?: AlignmentEventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: AlignmentEventType): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

export const alignmentEvents = new AlignmentEventBus();
