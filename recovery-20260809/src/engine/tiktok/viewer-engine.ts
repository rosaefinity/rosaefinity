// =============================================
// RosaeFinity â€” Viewer Engine
// Current/peak/total, join/leave rates,
// moving averages, history tracking.
// =============================================

import type { ViewerStats } from './types';

export class ViewerEngine {
  private stats: ViewerStats;
  private joinBuffer: number[] = [];
  private leaveBuffer: number[] = [];

  constructor() {
    this.stats = {
      current: 0,
      peak: 0,
      total: 0,
      joinRate: 0,
      leaveRate: 0,
      movingAverage5m: 0,
      movingAverage30m: 0,
      sessionStart: Date.now(),
      joinHistory: [],
      leaveHistory: [],
    };
  }

  /** Update viewer count */
  updateViewerCount(count: number): void {
    const previous = this.stats.current;
    this.stats.current = count;
    this.stats.peak = Math.max(this.stats.peak, count);

    if (count > previous) {
      const joins = count - previous;
      this.stats.total += joins;
      this.recordJoin(joins);
    } else if (count < previous) {
      const leaves = previous - count;
      this.recordLeave(leaves);
    }

    this.updateRates();
    this.updateMovingAverages();
  }

  /** Record joins */
  private recordJoin(count: number): void {
    this.joinBuffer.push(count);
    this.stats.joinHistory.push(count);
    // Keep last 30 minutes of history (1 per second = 1800 entries)
    if (this.stats.joinHistory.length > 1800) {
      this.stats.joinHistory.shift();
    }
  }

  /** Record leaves */
  private recordLeave(count: number): void {
    this.leaveBuffer.push(count);
    this.stats.leaveHistory.push(count);
    if (this.stats.leaveHistory.length > 1800) {
      this.stats.leaveHistory.shift();
    }
  }

  /** Update join/leave rates (per minute) */
  private updateRates(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean buffers
    // Simple approach: count events in last minute from history
    const recentJoins = this.stats.joinHistory.slice(-60).reduce((sum, v) => sum + v, 0);
    const recentLeaves = this.stats.leaveHistory.slice(-60).reduce((sum, v) => sum + v, 0);

    this.stats.joinRate = recentJoins;
    this.stats.leaveRate = recentLeaves;
  }

  /** Update moving averages */
  private updateMovingAverages(): void {
    const history = this.stats.joinHistory;
    if (history.length === 0) return;

    // 5-minute moving average
    const last5m = history.slice(-300); // 5 min at 1/sec
    this.stats.movingAverage5m = last5m.length > 0
      ? last5m.reduce((sum, v) => sum + v, 0) / last5m.length
      : 0;

    // 30-minute moving average
    const last30m = history.slice(-1800);
    this.stats.movingAverage30m = last30m.length > 0
      ? last30m.reduce((sum, v) => sum + v, 0) / last30m.length
      : 0;
  }

  /** Get current stats */
  getStats(): ViewerStats {
    return { ...this.stats };
  }

  /** Reset for new session */
  reset(): void {
    this.stats = {
      current: 0,
      peak: 0,
      total: 0,
      joinRate: 0,
      leaveRate: 0,
      movingAverage5m: 0,
      movingAverage30m: 0,
      sessionStart: Date.now(),
      joinHistory: [],
      leaveHistory: [],
    };
    this.joinBuffer = [];
    this.leaveBuffer = [];
  }
}
