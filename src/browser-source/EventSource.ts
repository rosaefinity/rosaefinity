import type { OverlayEvent, OverlayEventSource } from '../overlays/types';
import { getSSEBaseUrl } from '../lib/browser-source-url';

const CHANNEL_NAME = 'rosaefinity-overlay';

/**
 * BrowserEventSource - Abstracts event delivery for browser source overlays.
 *
 * Implements OverlayEventSource interface with multiple transports:
 * 1. BroadcastChannel (same-process, zero latency)
 * 2. EventSource/SSE (cross-process: OBS, TikTok LIVE Studio)
 * 3. localStorage polling (fallback for restricted environments)
 *
 * Transport selection is automatic based on browser capabilities.
 * All transports deliver the same OverlayEvent type to subscribers.
 */
export class BrowserEventSource implements OverlayEventSource {
  private listeners = new Set<(event: OverlayEvent) => void>();
  private channel: BroadcastChannel | null = null;
  private eventSource: EventSource | null = null;
  private storageHandler: ((e: StorageEvent) => void) | null = null;
  private sseUrl: string;
  private browserSourceId: string;
  private connected = false;

  constructor(
    browserSourceId: string,
    sseUrl?: string
  ) {
    // Use dynamic SSE URL based on current hostname
    this.sseUrl = sseUrl || getSSEBaseUrl();
    this.browserSourceId = browserSourceId;
    this.connect();
  }

  /**
   * Subscribe to overlay events.
   * Returns an unsubscribe function.
   */
  subscribe(callback: (event: OverlayEvent) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0) {
        this.destroy();
      }
    };
  }

  /**
   * Clean up all connections.
   */
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

    // 1. BroadcastChannel - same process, zero latency
    try {
      this.channel = new BroadcastChannel(CHANNEL_NAME);
      this.channel.onmessage = (e) => {
        this.emit(e.data as OverlayEvent);
      };
    } catch {
      // BroadcastChannel not supported (e.g., Safari private mode)
    }

    // 2. EventSource/SSE - cross-process (OBS browser source, TikTok LIVE Studio)
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
        // EventSource auto-reconnects silently
      };
    } catch {
      // EventSource not available
    }

    // 3. localStorage polling fallback
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