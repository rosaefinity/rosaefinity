// =============================================
// Interaction Events — Typed event bus for
// interaction layer state changes.
// =============================================

import type {
  DragData, ResizeData, RotateData, BoxSelectionData, SelectionBox, InteractionMode,
} from "./interaction-types";

export interface InteractionEventMap {
  "interaction:start": { mode: InteractionMode };
  "interaction:update": { mode: InteractionMode };
  "interaction:end": { mode: InteractionMode };

  "drag:start": DragData;
  "drag:update": DragData;
  "drag:end": { widgetIds: string[]; overlayId: string; sceneId: string };

  "resize:start": ResizeData;
  "resize:update": ResizeData;
  "resize:end": { widgetId: string; overlayId: string; sceneId: string };

  "rotate:start": RotateData;
  "rotate:update": RotateData;
  "rotate:end": { widgetId: string; overlayId: string; sceneId: string };

  "selection:box": { box: SelectionBox; additive: boolean };
  "selection:changed": { selectedWidgetIds: string[] };
}

export type InteractionEventType = keyof InteractionEventMap;
export type InteractionEventHandler<T extends InteractionEventType> =
  (data: InteractionEventMap[T]) => void;

class InteractionEventBus {
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  on<T extends InteractionEventType>(event: T, handler: InteractionEventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as (data: unknown) => void);
    return () => {
      this.listeners.get(event)?.delete(handler as (data: unknown) => void);
    };
  }

  off<T extends InteractionEventType>(event: T, handler: InteractionEventHandler<T>): void {
    this.listeners.get(event)?.delete(handler as (data: unknown) => void);
  }

  emit<T extends InteractionEventType>(event: T, data: InteractionEventMap[T]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[InteractionEvents] Error in handler for "${event}":`, err);
        }
      }
    }
  }

  clear(event?: InteractionEventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: InteractionEventType): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

export const interactionEvents = new InteractionEventBus();
