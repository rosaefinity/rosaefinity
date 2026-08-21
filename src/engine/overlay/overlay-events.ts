// =============================================
// Overlay Event Bus — Generic event system for
// the entire overlay engine subsystem.
//
// Subscribers: Persistence, Renderer, History,
// Analytics, Cloud Sync, future plugins.
// =============================================

import type { Overlay, Scene, Widget } from "../../types/overlay-types";

// ===== Event Map =====
export interface OverlayEventMap {
  // Overlay lifecycle
  "overlay:created": { overlay: Overlay };
  "overlay:deleted": { overlayId: string };
  "overlay:updated": { overlay: Overlay };
  "overlay:changed": { overlayId: string };

  // Scene lifecycle
  "scene:created": { overlayId: string; scene: Scene };
  "scene:deleted": { overlayId: string; sceneId: string };
  "scene:updated": { overlayId: string; scene: Scene };
  "scene:switched": { overlayId: string; sceneId: string };

  // Widget lifecycle
  "widget:created": { overlayId: string; sceneId: string; widget: Widget };
  "widget:deleted": { overlayId: string; sceneId: string; widgetId: string };
  "widget:updated": { overlayId: string; sceneId: string; widget: Widget };
}

export type OverlayEventType = keyof OverlayEventMap;
export type OverlayEventHandler<T extends OverlayEventType> = (data: OverlayEventMap[T]) => void;

// ===== Event Bus Implementation =====
class OverlayEventBus {
  private listeners: Map<string, Set<((data: unknown) => void)>> = new Map();

  on<T extends OverlayEventType>(event: T, handler: OverlayEventHandler<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler as (data: unknown) => void);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(handler as (data: unknown) => void);
    };
  }

  off<T extends OverlayEventType>(event: T, handler: OverlayEventHandler<T>): void {
    this.listeners.get(event)?.delete(handler as (data: unknown) => void);
  }

  emit<T extends OverlayEventType>(event: T, data: OverlayEventMap[T]): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(data);
        } catch (err) {
          console.error(`[OverlayEvents] Error in handler for "${event}":`, err);
        }
      }
    }
  }

  removeAllListeners(event?: OverlayEventType): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  listenerCount(event: OverlayEventType): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

// Singleton instance — shared across all overlay subsystems
export const overlayEvents = new OverlayEventBus();
