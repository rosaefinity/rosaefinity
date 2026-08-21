// =============================================
// RosaeFinity â€” TikTok Connection Manager
// Centralized connection with auto-reconnect,
// heartbeat, health monitoring, quality tracking.
// =============================================

import type { ConnectionConfig, ConnectionHealth, ConnectionState } from './types';

const DEFAULT_CONFIG: ConnectionConfig = {
  screenId: 'screen-0',
  username: '',
  reconnectAttempts: 10,
  reconnectDelayMs: 2000,
  maxReconnectDelayMs: 30000,
  heartbeatIntervalMs: 30000,
  connectionTimeoutMs: 15000,
};

interface ConnectionCallbacks {
  onStateChange?: (state: ConnectionState, screenId: string) => void;
  onEvent?: (event: any) => void;
  onError?: (error: string, screenId: string) => void;
  onHealthUpdate?: (health: ConnectionHealth) => void;
}

export class TikTokConnectionManager {
  private config: ConnectionConfig;
  private state: ConnectionState = 'disconnected';
  private health: ConnectionHealth;
  private callbacks: ConnectionCallbacks;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private eventTimestamps: number[] = [];
  private startTime = 0;

  constructor(config: Partial<ConnectionConfig> = {}, callbacks: ConnectionCallbacks = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.callbacks = callbacks;
    this.health = this.createDefaultHealth();
  }

  // â”€â”€ Public API â”€â”€

  async connect(username: string): Promise<void> {
    this.config.username = username;
    this.startTime = Date.now();

    this.setState('connecting');

    try {
      // Use Electron IPC to connect
      const a = (window as any).electronAPI;
      if (a) {
        console.log(`[TIKTOK-FLOW] 04 ConnectionManager.connect() called`);
        console.log(`[TIKTOK-FLOW] 05 connectTikTokScreen() called screenId=${this.config.screenId}`);
        a.connectTikTokScreen(this.config.screenId, username);
        console.log(`[TIKTOK-FLOW] 06 IPC request sent`);
        // Wait for backend response via onConnected callback
        // Don't set connected here â€” wait for tiktok:connected event
      } else {
        // Browser fallback â€” simulate connection
        this.setState('connected');
        this.startHeartbeat();
      }
    } catch (err: any) {
      this.setState('error');
      this.callbacks.onError?.(err.message, this.config.screenId);
      this.scheduleReconnect();
    }
  }

  /** Called when backend reports successful connection */
  handleConnected(data: { screenId: string; username: string; roomId?: string; viewerCount?: number }): void {
    if (data.screenId !== this.config.screenId) return;
    this.setState('connected');
    this.health.reconnectCount = 0;
    this.startHeartbeat();
  }

  /** Called when backend reports disconnection */
  handleDisconnected(data: { screenId: string; reason?: string }): void {
    if (data.screenId !== this.config.screenId) return;
    this.stopHeartbeat();
    this.setState('disconnected');
    if (data.reason) {
      this.callbacks.onError?.(data.reason, this.config.screenId);
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    this.clearReconnect();

    const a = (window as any).electronAPI;
    if (a) {
      a.disconnectTikTokScreen(this.config.screenId);
    }

    this.setState('disconnected');
    this.health.reconnectCount = 0;
  }

  getState(): ConnectionState {
    return this.state;
  }

  getHealth(): ConnectionHealth {
    return {
      ...this.health,
      state: this.state,
      uptime: this.startTime > 0 ? Date.now() - this.startTime : 0,
      eventsPerSecond: this.calculateEPS(),
    };
  }

  // â”€â”€ Internal â”€â”€

  private setState(state: ConnectionState): void {
    if (this.state === state) return;
    const prev = this.state;
    this.state = state;
    console.log(`[TIKTOK-FLOW] CM state: ${prev} â†’ ${state} screenId=${this.config.screenId}`);
    this.callbacks.onStateChange?.(state, this.config.screenId);
    this.callbacks.onHealthUpdate?.(this.getHealth());
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      this.health.lastHeartbeatAt = Date.now();
      this.callbacks.onHealthUpdate?.(this.getHealth());
    }, this.config.heartbeatIntervalMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.health.reconnectCount >= this.config.reconnectAttempts) {
      this.setState('error');
      this.callbacks.onError?.('Max reconnect attempts reached', this.config.screenId);
      return;
    }

    this.clearReconnect();
    const delay = Math.min(
      this.config.reconnectDelayMs * Math.pow(1.5, this.health.reconnectCount),
      this.config.maxReconnectDelayMs,
    );
    const jitter = delay * 0.1 * Math.random();

    this.reconnectTimer = setTimeout(() => {
      this.health.reconnectCount++;
      this.setState('reconnecting');
      this.connect(this.config.username);
    }, delay + jitter);
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private calculateEPS(): number {
    const now = Date.now();
    const oneSecondAgo = now - 1000;
    this.eventTimestamps = this.eventTimestamps.filter(t => t > oneSecondAgo);
    return this.eventTimestamps.length;
  }

  private createDefaultHealth(): ConnectionHealth {
    return {
      state: 'disconnected',
      latency: 0,
      uptime: 0,
      reconnectCount: 0,
      lastEventAt: 0,
      lastHeartbeatAt: 0,
      eventsPerSecond: 0,
      droppedEvents: 0,
      duplicateEvents: 0,
      roomId: null,
      roomTitle: null,
      viewerCount: 0,
    };
  }
}
