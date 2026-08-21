// =============================================
// Editor Event Bus — Typed event system for
// transient editor state changes.
//
// Follows the same pattern as OverlayEventBus.
// Subscribers: Editor UI, History Manager, future plugins.
// =============================================

import type { EditorState } from "./editor-state";

// ===== Event Map =====
export interface EditorEventMap {
  "selection:changed": {
    selectedOverlayId: string | null;
    selectedSceneId: string | null;
    selectedWidgetIds: string[];
  };
  "viewport:changed": {
    zoom: number;
    panX: number;
    panY: number;
  };
  "tool:changed": {
    tool: EditorState["activeTool"];
  };
  "clipboard:changed": {
    clipboardWidgetIds: string[];
  };
  "preferences:changed": {
    gridVisible: boolean;
    snapToGrid: boolean;
    rulerVisible: boolean;
  };
}

export type EditorEventType = keyof EditorEventMap;
export type EditorEventHandler<T extends EditorEventType> = (data: EditorEventMap[T]) => void;

// ===== Event Bus Implementation =====
class EditorEventBus {
  private listeners: Map<string, Set<((data: unknown) => void)>> = new Map();

  /**
   * Subscribe to an editor event. Returns an unsubscribe function.
   */
  on<T extends EditorEventType>(event: T, handler: EditorEventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as (data: unknown) => void);

    return () => {
      this.listeners.get(event)?.delete(handler as (data: unknown) => void);
    };
  }

  /**
   * Unsubscribe from an editor event.
   */
  off<T extends EditorEventType>(event: T, handler: EditorEventHandler<T>): void {
    this.listeners.get(event)?.delete(handler as (data: unknown) => void);
  }

  /**
   * Emit an editor event to all subscribers.
   */
  emit<T extends EditorEventType>(event: T, data: EditorEventMap[T]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[EditorEvents] Error in handler for "${event}":`, err);
        }
      }
    }
  }

  /**
   * Remove all listeners for a specific event, or all events.
   */
  clear(event?: EditorEventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get the number of listeners for an event.
   */
  listenerCount(event: EditorEventType): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

// Singleton instance — shared across all editor subsystems
export const editorEvents = new EditorEventBus();
