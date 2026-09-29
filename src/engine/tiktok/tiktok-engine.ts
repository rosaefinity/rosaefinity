// =============================================
// RosaeFinity â€” TikTok Engine Bootstrap
// Central singleton that initializes and wires
// all TikTok engines together.
// =============================================

import { TikTokConnectionManager } from './connection-manager.js';
import { EventPipeline } from './event-pipeline.js';
import { GiftComboEngine } from './gift-combo-engine.js';
import { ViewerEngine } from './viewer-engine.js';
import { CommentEngine } from './comment-engine.js';
import { ActionExecutor } from './action-executor.js';
import type { TikTokEvent, TikTokEventType, ConnectionState, ConnectionHealth, GiftCombo } from './types';

// â”€â”€ Engine Callbacks â”€â”€
interface EngineCallbacks {
  onEvent?: (event: TikTokEvent) => void;
  onStateChange?: (state: ConnectionState, screenId: string) => void;
  onHealthUpdate?: (health: ConnectionHealth) => void;
  onComboStart?: (combo: GiftCombo) => void;
  onComboEnd?: (combo: GiftCombo) => void;
  onError?: (error: string, screenId: string) => void;
}

// â”€â”€ Engine Stats â”€â”€
export interface EngineStats {
  connection: ConnectionHealth;
  pipeline: ReturnType<EventPipeline['getStats']>;
  combos: ReturnType<GiftComboEngine['getStats']>;
  viewers: ReturnType<ViewerEngine['getStats']>;
  comments: ReturnType<CommentEngine['getStats']>;
  actions: ReturnType<ActionExecutor['getStats']>;
}

class TikTokEngine {
  private connectionManager: TikTokConnectionManager | null = null;
  private eventPipeline: EventPipeline | null = null;
  private giftComboEngine: GiftComboEngine | null = null;
  private viewerEngine: ViewerEngine | null = null;
  private commentEngine: CommentEngine | null = null;
  private actionExecutor: ActionExecutor | null = null;
  private callbacks: EngineCallbacks = {};
  private initialized = false;
  private activeScreenId = 'screen-0';

  /** Initialize all engines (call once at startup) */
  initialize(callbacks: EngineCallbacks = {}): void {
    if (this.initialized) return;
    this.callbacks = callbacks;

    // â”€â”€ Connection Manager â”€â”€
    this.connectionManager = new TikTokConnectionManager(
      { screenId: this.activeScreenId },
      {
        onStateChange: (state, screenId) => {
          this.callbacks.onStateChange?.(state, screenId);
        },
        onHealthUpdate: (health) => {
          this.callbacks.onHealthUpdate?.(health);
        },
        onError: (error, screenId) => {
          this.callbacks.onError?.(error, screenId);
        },
      },
    );

    // â”€â”€ Event Pipeline â”€â”€
    this.eventPipeline = new EventPipeline({
      onEvent: (event) => this.handlePipelineEvent(event),
    });

    // â”€â”€ Gift Combo Engine â”€â”€
    this.giftComboEngine = new GiftComboEngine({}, {
      onComboStart: (combo) => this.callbacks.onComboStart?.(combo),
      onComboEnd: (combo) => this.callbacks.onComboEnd?.(combo),
    });

    // â”€â”€ Viewer Engine â”€â”€
    this.viewerEngine = new ViewerEngine();

    // â”€â”€ Comment Engine â”€â”€
    this.commentEngine = new CommentEngine();

    // â”€â”€ Action Executor â”€â”€
    this.actionExecutor = new ActionExecutor();

    this.initialized = true;
  }

  /** Connect to a TikTok username */
  async connect(username: string, screenId?: string): Promise<void> {
    if (screenId) this.activeScreenId = screenId;
    if (!this.connectionManager) this.initialize();
    await this.connectionManager!.connect(username);
  }

  /** Called when backend reports successful connection */
  handleConnected(data: { screenId: string; username: string; roomId?: string; viewerCount?: number }): void {
    this.connectionManager?.handleConnected(data);
  }

  /** Called when backend reports disconnection */
  handleDisconnected(data: { screenId: string; reason?: string }): void {
    this.connectionManager?.handleDisconnected(data);
  }

  /** Disconnect from TikTok */
  disconnect(): void {
    this.connectionManager?.disconnect();
  }

  /** Get connection state */
  getState(): ConnectionState {
    return this.connectionManager?.getState() || 'disconnected';
  }

  /** Get connection health */
  getHealth(): ConnectionHealth {
    return this.connectionManager?.getHealth() || {
      state: 'disconnected', latency: 0, uptime: 0, reconnectCount: 0,
      lastEventAt: 0, lastHeartbeatAt: 0, eventsPerSecond: 0,
      droppedEvents: 0, duplicateEvents: 0, roomId: null, roomTitle: null, viewerCount: 0,
    };
  }

  /** Push a raw TikTok event into the pipeline */
  pushEvent(type: TikTokEventType, data: Record<string, unknown>): void {
    if (!this.eventPipeline) this.initialize();
    this.eventPipeline!.push(type, this.activeScreenId, data);
  }

  /** Get all engine stats */
  getStats(): EngineStats {
    return {
      connection: this.getHealth(),
      pipeline: this.eventPipeline?.getStats() || { processed: 0, deduped: 0, cooldownBlocked: 0, dropped: 0, queueSize: 0, dedupSize: 0 },
      combos: this.giftComboEngine?.getStats() || { activeCount: 0, totalCoins: 0, totalGifts: 0, biggestCombo: 0 },
      viewers: this.viewerEngine?.getStats() || { current: 0, peak: 0, total: 0, joinRate: 0, leaveRate: 0, movingAverage5m: 0, movingAverage30m: 0, sessionStart: 0, joinHistory: [], leaveHistory: [] },
      comments: this.commentEngine?.getStats() || { recentUsers: 0, spamUsers: 0, duplicateCacheSize: 0 },
      actions: this.actionExecutor?.getStats() || { executed: 0, failed: 0, timedOut: 0, cancelled: 0, queueSize: 0, runningCount: 0, executedIdsSize: 0 },
    };
  }

  /** Get active gift combos */
  getActiveCombos(): GiftCombo[] {
    return this.giftComboEngine?.getAllActiveCombos() || [];
  }

  /** Get viewer stats */
  getViewerStats() {
    return this.viewerEngine?.getStats();
  }

  /** Update viewer count */
  updateViewerCount(count: number): void {
    this.viewerEngine?.updateViewerCount(count);
  }

  /** Clear all cooldowns */
  clearCooldowns(): void {
    this.eventPipeline?.clearCooldowns();
  }

  /** Clear event pipeline queue and dedup cache */
  clearPipelineQueue(): void {
    this.eventPipeline?.clearQueue();
    this.eventPipeline?.clearCooldowns();
  }

  /** Clear comment engine duplicate/spam state */
  clearCommentEngine(): void {
    this.commentEngine = new CommentEngine();
  }

  /** Cleanup */
  destroy(): void {
    this.connectionManager?.disconnect();
    this.eventPipeline?.clearQueue();
    this.giftComboEngine?.endAllCombos();
    this.viewerEngine?.reset();
    this.initialized = false;
  }

  // â”€â”€ Private: Pipeline Event Handler â”€â”€
  private handlePipelineEvent(event: TikTokEvent): void {
    // Process through sub-engines based on event type
    switch (event.type) {
      case 'gift':
        this.handleGiftEvent(event);
        break;
      case 'comment':
      case 'chat':
        this.handleCommentEvent(event);
        break;
      case 'viewer-update':
        this.handleViewerEvent(event);
        break;
      case 'join':
        this.handleJoinEvent(event);
        break;
    }

    // Dispatch to action executor
    if (this.actionExecutor) {
      this.actionExecutor.submit(event);
    }

    // Notify listeners
    this.callbacks.onEvent?.(event);
  }

  private handleGiftEvent(event: TikTokEvent): void {
    if (!this.giftComboEngine) return;
    const combo = this.giftComboEngine.processGift(event);
    if (combo && combo.comboCount > 1) {
      // Update event data with combo info
      event.data.comboCount = combo.comboCount;
      event.data.totalComboCoins = combo.totalCoins;
    }
  }

  private handleCommentEvent(event: TikTokEvent): void {
    if (!this.commentEngine) return;
    const processed = this.commentEngine.processComment(event.data);
    if (processed) {
      event.data.isSpam = processed.isSpam;
      event.data.isDuplicate = processed.isDuplicate;
      event.data.sentiment = processed.sentiment;
      // Drop spam/duplicate events from further processing
      if (processed.isSpam || processed.isDuplicate) {
        event.processed = true;
      }
    }
  }

  private handleViewerEvent(event: TikTokEvent): void {
    const count = (event.data.viewerCount || event.data.totalUser || 0) as number;
    if (count > 0) {
      this.viewerEngine?.updateViewerCount(count);
    }
  }

  private handleJoinEvent(_event: TikTokEvent): void {
    // Join events update viewer count via the viewer engine
  }
}

// â”€â”€ Singleton â”€â”€
let _engine: TikTokEngine | null = null;

export function getTikTokEngine(): TikTokEngine {
  if (!_engine) {
    _engine = new TikTokEngine();
  }
  return _engine;
}

export function resetTikTokEngine(): void {
  if (_engine) {
    _engine.destroy();
    _engine = null;
  }
}
