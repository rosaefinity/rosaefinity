// ─────────────────────────────────────────────────────
// RosaeFinity Browser Source — EventSource
//
// DEPRECATED for Browser Source runtime.
// BrowserSourceApp now uses useSSEConnection exclusively
// (ONE EventSource per Browser Source identity).
//
// This class remains for any non-BrowserSource consumers
// that need an OverlayEventSource without React.
// Do NOT create a second SSE connection from BrowserSourceApp.
// ─────────────────────────────────────────────────────

import type { OverlayEvent, OverlayEventSource } from '../overlays/types';
import { getSSEBaseUrl } from '../lib/browser-source-url';

const CHANNEL_NAME = 'rosaefinity-overlay';

/**
 * BrowserEventSource — OverlayEventSource adapter.
 *
 * @deprecated Browser Source runtime uses useSSEConnection only.
 * Prefer a stable subscriber bus fed by that single connection.
 */
export class BrowserEventSource implements OverlayEventSource {
  private listeners = new Set<(event: OverlayEvent) => void>();
  private channel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private storageHandler: ((e: StorageEvent) => void) | null = null;
  private sseUrl: string;
  private browserSourceId: string;
  private connected = false;

  constructor(browserSourceId: string, sseUrl?: string) {
    this.sseUrl = sseUrl || getSSEBaseUrl();
    this.browserSourceId = browserSourceId;
    this.connect();
  }

  subscribe(callback: (event: OverlayEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0) {
        this.destroy();
      }
    };
  }

  destroy(): void {
    this.channel?.close();
    this.channel = null;

    this.eventSource?.close();
    this.eventSource = null;

    if (this.storageHandler) {
      window.removeEventListener('storage', this.storageHandler);
      this.storageHandler = null;
    }

    this.listeners.clear();
    this.connected = false;
  }

  private connect(): void {
    if (this.connected) return;

    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (e) => {
        this.emit(e.data as OverlayEvent);
      };
    } catch {
      // BroadcastChannel not supported
    }

    try {
      const url = `${this.sseUrl}/overlay/${this.browserSourceId}/events`;
      this.eventSource = new EventSource(url);
      this.eventSource.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as OverlayEvent;
          this.emit(event);
        } catch {
          // Ignore malformed events
        }
      };
      this.eventSource.onerror = () => {
        // Native EventSource auto-reconnects
      };
    } catch {
      // EventSource not available
    }

    this.storageHandler = (e: StorageEvent) => {
      if (e.key === 'rf_overlay_events' && e.newValue) {
        try {
          const event = JSON.parse(e.newValue) as OverlayEvent;
          this.emit(event);
        } catch {
          // Ignore malformed
        }
      }
    };
    window.addEventListener('storage', this.storageHandler);

    this.connected = true;
  }

  private emit(event: OverlayEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[BrowserEventSource] Listener error:', error);
      }
    }
  }
}
