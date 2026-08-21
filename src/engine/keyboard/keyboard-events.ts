// =============================================
// Keyboard Events — Typed event bus for
// keyboard and shortcut events.
// =============================================

import type { KeyEvent } from "./shortcut-types";

export interface KeyboardEventMap {
  "keyboard:down": KeyEvent;
  "keyboard:up": KeyEvent;
  "shortcut:executed": { shortcutId: string; description: string; event: KeyEvent };
  "shortcut:blocked": { shortcutId: string; reason: string };
}

export type KeyboardEventType = keyof KeyboardEventMap;
export type KeyboardEventHandler<T extends KeyboardEventType> =
  (data: KeyboardEventMap[T]) => void;

class KeyboardEventBus {
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  on<T extends KeyboardEventType>(event: T, handler: KeyboardEventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as (data: unknown) => void);
    return () => {
      this.listeners.get(event)?.delete(handler as (data: unknown) => void);
    };
  }

  off<T extends KeyboardEventType>(event: T, handler: KeyboardEventHandler<T>): void {
    this.listeners.get(event)?.delete(handler as (data: unknown) => void);
  }

  emit<T extends KeyboardEventType>(event: T, data: KeyboardEventMap[T]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[KeyboardEvents] Error in handler for "${event}":`, err);
        }
      }
    }
  }

  clear(event?: KeyboardEventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: KeyboardEventType): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

export const keyboardEvents = new KeyboardEventBus();
