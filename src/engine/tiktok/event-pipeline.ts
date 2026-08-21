// =============================================
// RosaeFinity â€” Event Pipeline
// Validation â†’ Dedup â†’ Priority â†’ Cooldown â†’ Action
// Single pipeline for all TikTok events.
// =============================================

import type { TikTokEvent, TikTokEventType, EventPriority } from './types';
import { EVENT_PRIORITY, PRIORITY_ORDER } from './types';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// â”€â”€ Dedup Cache â”€â”€
class DedupCache {
  private seen = new Map<string, number>();
  private ttlMs: number;

  constructor(ttlMs = 5000) {
    this.ttlMs = ttlMs;
  }

  isDuplicate(key: string): boolean {
    this.cleanup();
    if (this.seen.has(key)) return true;
    this.seen.set(key, Date.now());
    return false;
  }

  private cleanup(): void {
    const cutoff = Date.now() - this.ttlMs;
    for (const [key, ts] of this.seen) {
      if (ts < cutoff) this.seen.delete(key);
    }
  }

  get size(): number {
    return this.seen.size;
  }
}

// â”€â”€ Cooldown Manager â”€â”€
class CooldownManager {
  private cooldowns = new Map<string, number>();

  isOnCooldown(key: string, cooldownMs: number): boolean {
    const lastFired = this.cooldowns.get(key) || 0;
    return Date.now() - lastFired < cooldownMs;
  }

  record(key: string): void {
    this.cooldowns.set(key, Date.now());
  }

  reset(key: string): void {
    this.cooldowns.delete(key);
  }

  resetAll(): void {
    this.cooldowns.clear();
  }
}

// â”€â”€ Event Pipeline â”€â”€
interface PipelineConfig {
  dedupWindowMs: number;
  maxQueueSize: number;
  cooldowns: Partial<Record<TikTokEventType, number>>;
  onEvent: (event: TikTokEvent) => void;
}

const DEFAULT_COOLDOWNS: Partial<Record<TikTokEventType, number>> = {
  'gift': 0,            // No cooldown for gifts
  'gift-combo': 1000,   // 1s between combo updates
  'follow': 5000,       // 5s between follow actions
  'share': 5000,        // 5s between share actions
  'join': 1000,         // 1s between join processing
  'like': 2000,         // 2s between like actions
  'comment': 1000,      // 1s between comment processing
  'subscribe': 0,       // No cooldown for subs
  'viewer-update': 5000, // 5s between viewer updates
};

export class EventPipeline {
  private dedup: DedupCache;
  private cooldowns: CooldownManager;
  private queue: TikTokEvent[] = [];
  private config: PipelineConfig;
  private processing = false;
  private stats = { processed: 0, deduped: 0, cooldownBlocked: 0, dropped: 0 };

  constructor(config: Partial<PipelineConfig> & { onEvent: (event: TikTokEvent) => void }) {
    this.config = {
      dedupWindowMs: 5000,
      maxQueueSize: 1000,
      cooldowns: DEFAULT_COOLDOWNS,
      ...config,
    };
    this.dedup = new DedupCache(this.config.dedupWindowMs);
    this.cooldowns = new CooldownManager();
  }

  /** Push a raw event into the pipeline */
  push(type: TikTokEventType, screenId: string, data: Record<string, unknown>): void {
    // 1. Validate
    if (!type || !screenId) return;

    // 2. Dedup
    const dedupKey = this.buildDedupKey(type, data);
    if (this.dedup.isDuplicate(dedupKey)) {
      this.stats.deduped++;
      return;
    }

    // 3. Check cooldown
    const cooldownMs = this.config.cooldowns[type] || 0;
    if (cooldownMs > 0 && this.cooldowns.isOnCooldown(type, cooldownMs)) {
      this.stats.cooldownBlocked++;
      return;
    }

    // 4. Create event
    const event: TikTokEvent = {
      id: generateId(),
      type,
      priority: EVENT_PRIORITY[type] || 'normal',
      screenId,
      timestamp: Date.now(),
      data,
      processed: false,
      retryCount: 0,
    };

    // 5. Queue with priority
    this.insertByPriority(event);

    // 6. Process
    this.processQueue();
  }

  /** Insert event maintaining priority order */
  private insertByPriority(event: TikTokEvent): void {
    const eventPriority = PRIORITY_ORDER[event.priority];

    // Find insertion point
    let insertAt = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (PRIORITY_ORDER[this.queue[i].priority] > eventPriority) {
        insertAt = i;
        break;
      }
    }

    this.queue.splice(insertAt, 0, event);

    // Drop lowest priority if queue full
    while (this.queue.length > this.config.maxQueueSize) {
      const last = this.queue[this.queue.length - 1];
      this.queue.pop();
      this.stats.dropped++;
    }
  }

  /** Process next event from queue */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const event = this.queue.shift()!;
      if (event.processed) continue;

      // Record cooldown
      this.cooldowns.record(event.type);

      // Process
      event.processed = true;
      this.stats.processed++;

      // Dispatch
      this.config.onEvent(event);
    }

    this.processing = false;
  }

  /** Build dedup key from event type and data */
  private buildDedupKey(type: TikTokEventType, data: Record<string, unknown>): string {
    // For gifts: user+giftId+timestamp (rounded to 1s)
    if (type === 'gift') {
      const userId = data.userId || data.user_id || '';
      const giftId = data.giftId || data.gift_id || '';
      const ts = Math.floor(Date.now() / 1000);
      return `gift:${userId}:${giftId}:${ts}`;
    }
    // For comments: user+comment (exact match within window)
    if (type === 'comment') {
      const userId = data.userId || data.user_id || '';
      const comment = data.comment || data.data || '';
      return `comment:${userId}:${comment}`;
    }
    // For follows/shares: user only
    if (type === 'follow' || type === 'share') {
      const userId = data.userId || data.user_id || '';
      return `${type}:${userId}`;
    }
    // Default: type + timestamp
    return `${type}:${Date.now()}`;
  }

  /** Get pipeline stats */
  getStats() {
    return { ...this.stats, queueSize: this.queue.length, dedupSize: this.dedup.size };
  }

  /** Clear cooldowns */
  clearCooldowns(): void {
    this.cooldowns.resetAll();
  }

  /** Clear queue */
  clearQueue(): void {
    this.queue = [];
  }
}
