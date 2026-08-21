// =============================================
// Clipboard Events — Typed event bus for
// clipboard operations.
// =============================================

export interface ClipboardEventMap {
  "clipboard:copy": { widgetIds: string[]; count: number };
  "clipboard:cut": { widgetIds: string[]; count: number };
  "clipboard:paste": { widgetIds: string[]; count: number };
}

export type ClipboardEventType = keyof ClipboardEventMap;
export type ClipboardEventHandler<T extends ClipboardEventType> =
  (data: ClipboardEventMap[T]) => void;

class ClipboardEventBus {
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  on<T extends ClipboardEventType>(event: T, handler: ClipboardEventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as (data: unknown) => void);
    return () => {
      this.listeners.get(event)?.delete(handler as (data: unknown) => void);
    };
  }

  emit<T extends ClipboardEventType>(event: T, data: ClipboardEventMap[T]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[ClipboardEvents] Error in handler for "${event}":`, err);
        }
      }
    }
  }

  clear(event?: ClipboardEventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: ClipboardEventType): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

export const clipboardEvents = new ClipboardEventBus();
