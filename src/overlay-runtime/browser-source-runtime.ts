// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Browser Source Runtime
// postMessage, BroadcastChannel, EventSource
// abstraction for overlay communication.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

import type { MessageHandler } from '../overlays/types';
import { getSSEBaseUrl } from '../lib/browser-source-url';

const CHANNEL_NAME = 'rosae-overlay';

// ── Transport Interface ──
interface Transport {
  name: string;
  connect(url: string): void;
  disconnect(): void;
  send(data: unknown): void;
  onMessage(handler: MessageHandler): () => void;
  isConnected(): boolean;
}

// ── BroadcastChannel Transport ──
class BroadcastTransport implements Transport {
  name = 'BroadcastChannel';
  private channel: BroadcastChannel | null = null;
  private handlers = new Set<MessageHandler>();

  connect(_url: string): void {
    try {
      this.channel = new BroadcastChannel('rosae-overlay');
      this.channel.onmessage = (e) => {
        for (const handler of this.handlers) {
          handler(e.data);
        }
      };
    } catch {}
  }

  disconnect(): void {
    this.channel?.close();
    this.channel = null;
  }

  send(data: unknown): void {
    this.channel?.postMessage(data);
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  isConnected(): boolean {
    return this.channel !== null;
  }
}

// â”€â”€ postMessage Transport (iframe) â”€â”€
class PostMessageTransport implements Transport {
  name = 'postMessage';
  private targetOrigin = '*';
  private handlers = new Set<MessageHandler>();

  constructor() {
    window.addEventListener('message', (e) => {
      if (e.data?.source === 'rosae-overlay') {
        for (const handler of this.handlers) {
          handler(e.data.payload);
        }
      }
    });
  }

  connect(_url: string): void {}
  disconnect(): void {}

  send(data: unknown): void {
    window.parent.postMessage({ source: 'rosae-overlay', payload: data }, this.targetOrigin);
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  isConnected(): boolean { return true; }
}

// â”€â”€ SSE Transport â”€â”€
class SSETransport implements Transport {
  name = 'SSE';
  private eventSource: EventSource | null = null;
  private handlers = new Set<MessageHandler>();
  private url = '';

  connect(url: string): void {
    this.url = url;
    try {
      this.eventSource = new EventSource(url);
      this.eventSource.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          for (const handler of this.handlers) {
            handler(data);
          }
        } catch {}
      };
      this.eventSource.onerror = () => {
        // Auto-reconnect is built into EventSource
      };
    } catch {}
  }

  disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  send(_data: unknown): void {
    // SSE is receive-only; use fetch for sending
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}

// â”€â”€ Browser Source Runtime â”€â”€
export class BrowserSourceRuntime {
  private transports: Transport[] = [];
  private handlers = new Map<string, Set<MessageHandler>>();
  private initialized = false;

  /** Initialize with available transports */
  initialize(): void {
    if (this.initialized) return;

    // Get the SSE URL using the centralized helper
    const sseUrl = getSSEBaseUrl();

    // Add transports in priority order
    this.transports.push(new BroadcastTransport());
    this.transports.push(new PostMessageTransport());
    this.transports.push(new SSETransport());

    // Connect all transports
    for (const transport of this.transports) {
      transport.connect(sseUrl);
      transport.onMessage((data) => this.handleMessage(data));
    }

    this.initialized = true;
  }

  /** Send event to all browser sources */
  broadcast(eventType: string, data: Record<string, unknown>): void {
    const message = { type: eventType, data, timestamp: Date.now() };
    for (const transport of this.transports) {
      if (transport.isConnected()) {
        transport.send(message);
      }
    }
  }

  /** Subscribe to events from a specific type */
  subscribe(eventType: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
    return () => this.handlers.get(eventType)?.delete(handler);
  }

  /** Get connected transports */
  getTransportStatus(): { name: string; connected: boolean }[] {
    return this.transports.map(t => ({ name: t.name, connected: t.isConnected() }));
  }

  /** Cleanup */
  destroy(): void {
    for (const transport of this.transports) {
      transport.disconnect();
    }
    this.handlers.clear();
    this.initialized = false;
  }

  // â”€â”€ Private â”€â”€
  private handleMessage(data: unknown): void {
    const msg = data as { type?: string; data?: unknown };
    if (msg.type && this.handlers.has(msg.type)) {
      for (const handler of this.handlers.get(msg.type)!) {
        handler(msg.data);
      }
    }
    // Also emit to wildcard subscribers
    if (msg.type && this.handlers.has('*')) {
      for (const handler of this.handlers.get('*')!) {
        handler(data);
      }
    }
  }
}

// Singleton
let _runtime: BrowserSourceRuntime | null = null;

export function getBrowserSourceRuntime(): BrowserSourceRuntime {
  if (!_runtime) _runtime = new BrowserSourceRuntime();
  return _runtime;
}
