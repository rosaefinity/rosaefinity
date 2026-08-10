// =============================================
// RosaeFinity â€” Comment Engine
// Rate limiting, spam detection, duplicate
// filtering, Unicode/emoji support.
// =============================================

import type { ProcessedComment } from './types';

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface CommentConfig {
  rateLimitPerSecond: number;
  rateLimitPerMinute: number;
  spamThreshold: number;
  duplicateWindowMs: number;
  minLength: number;
  maxLength: number;
}

const DEFAULT_CONFIG: CommentConfig = {
  rateLimitPerSecond: 5,
  rateLimitPerMinute: 60,
  spamThreshold: 3,
  duplicateWindowMs: 10000,
  minLength: 1,
  maxLength: 500,
};

export class CommentEngine {
  private config: CommentConfig;
  private recentComments = new Map<string, number[]>(); // userId â†’ timestamps
  private duplicateCache = new Map<string, number>(); // cache key â†’ timestamp
  private spamCounts = new Map<string, number>(); // userId â†’ count

  constructor(config: Partial<CommentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Process a comment event */
  processComment(data: Record<string, unknown>): ProcessedComment | null {
    const userId = (data.userId || data.user_id || '') as string;
    const username = (data.username || data.uniqueId || '') as string;
    const nickname = (data.nickname || '') as string;
    const comment = (data.comment || data.data || '') as string;

    // Validate
    if (!comment || comment.length < this.config.minLength) return null;
    if (comment.length > this.config.maxLength) {
      // Truncate long comments
      return this.createProcessedComment(userId, username, nickname, comment.substring(0, this.config.maxLength), false, true);
    }

    // Rate limit
    if (this.isRateLimited(userId)) return null;

    // Spam detection
    if (this.isSpam(userId)) return this.createProcessedComment(userId, username, nickname, comment, true, false);

    // Duplicate detection
    if (this.isDuplicate(userId, comment)) return this.createProcessedComment(userId, username, nickname, comment, false, true);

    // Record
    this.recordComment(userId);
    this.recordDuplicate(userId, comment);

    return this.createProcessedComment(userId, username, nickname, comment, false, false);
  }

  /** Check if user is rate limited */
  private isRateLimited(userId: string): boolean {
    const now = Date.now();
    const timestamps = this.recentComments.get(userId) || [];

    // Clean old timestamps
    const recent = timestamps.filter(t => now - t < 1000);
    const recentMinute = timestamps.filter(t => now - t < 60000);

    if (recent.length >= this.config.rateLimitPerSecond) return true;
    if (recentMinute.length >= this.config.rateLimitPerMinute) return true;

    return false;
  }

  /** Check if user is spamming */
  private isSpam(userId: string): boolean {
    const count = this.spamCounts.get(userId) || 0;
    if (count >= this.config.spamThreshold) return true;

    // Increment
    this.spamCounts.set(userId, count + 1);

    // Decay spam count over time
    if (count > 0 && Math.random() < 0.1) {
      this.spamCounts.set(userId, Math.max(0, count - 1));
    }

    return false;
  }

  /** Check for duplicate comments */
  private isDuplicate(userId: string, comment: string): boolean {
    const key = `${userId}:${comment}`;
    const lastSeen = this.duplicateCache.get(key);
    if (lastSeen && Date.now() - lastSeen < this.config.duplicateWindowMs) {
      return true;
    }
    return false;
  }

  /** Record comment timestamp */
  private recordComment(userId: string): void {
    const timestamps = this.recentComments.get(userId) || [];
    timestamps.push(Date.now());
    // Keep last 60 seconds
    this.recentComments.set(userId, timestamps.filter(t => Date.now() - t < 60000));
  }

  /** Record duplicate cache */
  private recordDuplicate(userId: string, comment: string): void {
    const key = `${userId}:${comment}`;
    this.duplicateCache.set(key, Date.now());
    // Cleanup old entries
    if (this.duplicateCache.size > 10000) {
      const cutoff = Date.now() - this.config.duplicateWindowMs;
      for (const [k, v] of this.duplicateCache) {
        if (v < cutoff) this.duplicateCache.delete(k);
      }
    }
  }

  /** Create processed comment */
  private createProcessedComment(
    userId: string, username: string, nickname: string,
    comment: string, isSpam: boolean, isDuplicate: boolean,
  ): ProcessedComment {
    return {
      id: generateId(),
      userId,
      username,
      nickname,
      comment,
      timestamp: Date.now(),
      isSpam,
      isDuplicate,
      sentiment: this.analyzeSentiment(comment),
    };
  }

  /** Simple sentiment analysis */
  private analyzeSentiment(comment: string): 'positive' | 'neutral' | 'negative' {
    const lower = comment.toLowerCase();
    const positives = ['love', 'great', 'amazing', 'awesome', 'beautiful', 'best', 'cool', 'fire', 'gg', 'nice', 'good', 'â¤ï¸', 'ðŸ”¥', 'ðŸ˜', 'ðŸŽ‰', 'ðŸ‘', 'ðŸ’ª'];
    const negatives = ['hate', 'bad', 'ugly', 'worst', 'boring', 'stupid', 'fail', 'trash', 'ðŸ‘Ž'];

    let score = 0;
    for (const p of positives) if (lower.includes(p)) score++;
    for (const n of negatives) if (lower.includes(n)) score--;

    if (score > 0) return 'positive';
    if (score < 0) return 'negative';
    return 'neutral';
  }

  /** Get stats */
  getStats() {
    return {
      recentUsers: this.recentComments.size,
      spamUsers: Array.from(this.spamCounts.values()).filter(c => c >= this.config.spamThreshold).length,
      duplicateCacheSize: this.duplicateCache.size,
    };
  }
}
