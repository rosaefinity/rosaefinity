// =============================================
// RosaeFinity â€” Gift Combo Engine
// Streak tracking, combo timer, extension,
// expiration, aggregation, no duplicate execution.
// =============================================

import type { GiftCombo, TikTokEvent } from './types';

interface ComboConfig {
  comboWindowMs: number;     // Time window to extend combo (default: 5s)
  comboTimeoutMs: number;    // Max combo duration (default: 30s)
  autoExtendMs: number;      // Extension per new gift (default: 3s)
}

const DEFAULT_COMBO_CONFIG: ComboConfig = {
  comboWindowMs: 5000,
  comboTimeoutMs: 30000,
  autoExtendMs: 3000,
};

interface ComboCallbacks {
  onComboStart?: (combo: GiftCombo) => void;
  onComboExtend?: (combo: GiftCombo) => void;
  onComboEnd?: (combo: GiftCombo) => void;
}

export class GiftComboEngine {
  private activeCombos = new Map<string, GiftCombo>();
  private config: ComboConfig;
  private callbacks: ComboCallbacks;
  private expirationTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(config: Partial<ComboConfig> = {}, callbacks: ComboCallbacks = {}) {
    this.config = { ...DEFAULT_COMBO_CONFIG, ...config };
    this.callbacks = callbacks;
  }

  /** Process a gift event */
  processGift(event: TikTokEvent): GiftCombo | null {
    const userId = (event.data.userId || event.data.user_id || '') as string;
    const username = (event.data.username || event.data.uniqueId || '') as string;
    const nickname = (event.data.nickname || event.data.nickname || '') as string;
    const giftId = (event.data.giftId || event.data.gift_id || '') as string;
    const giftName = (event.data.giftName || event.data.gift_name || 'Unknown') as string;
    const coinCount = (event.data.diamondCount || event.data.diamond_count || event.data.coinCount || 1) as number;

    const comboKey = `${userId}:${giftId}`;
    const existing = this.activeCombos.get(comboKey);

    if (existing) {
      // Extend existing combo
      existing.comboCount++;
      existing.giftCount++;
      existing.totalCoins += coinCount;
      existing.comboLastAt = Date.now();
      existing.isExtended = true;

      // Extend expiration
      this.extendCombo(comboKey, existing);

      this.callbacks.onComboExtend?.(existing);
      return existing;
    }

    // New combo
    const combo: GiftCombo = {
      id: `combo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      userId,
      username,
      nickname,
      giftId,
      giftName,
      giftCount: 1,
      totalCoins: coinCount,
      comboCount: 1,
      comboStartedAt: Date.now(),
      comboLastAt: Date.now(),
      comboExpiresAt: Date.now() + this.config.comboTimeoutMs,
      isExtended: false,
    };

    this.activeCombos.set(comboKey, combo);
    this.setExpirationTimer(comboKey, combo);

    this.callbacks.onComboStart?.(combo);
    return combo;
  }

  /** Get active combo for a user+gift */
  getActiveCombo(userId: string, giftId: string): GiftCombo | undefined {
    return this.activeCombos.get(`${userId}:${giftId}`);
  }

  /** Get all active combos */
  getAllActiveCombos(): GiftCombo[] {
    return Array.from(this.activeCombos.values());
  }

  /** Force end a combo */
  forceEndCombo(userId: string, giftId: string): void {
    const key = `${userId}:${giftId}`;
    const combo = this.activeCombos.get(key);
    if (combo) {
      this.endCombo(key, combo);
    }
  }

  /** End all combos */
  endAllCombos(): void {
    for (const [key, combo] of this.activeCombos) {
      this.endCombo(key, combo);
    }
  }

  /** Get combo stats */
  getStats() {
    const combos = Array.from(this.activeCombos.values());
    return {
      activeCount: combos.length,
      totalCoins: combos.reduce((sum, c) => sum + c.totalCoins, 0),
      totalGifts: combos.reduce((sum, c) => sum + c.giftCount, 0),
      biggestCombo: combos.reduce((max, c) => Math.max(max, c.comboCount), 0),
    };
  }

  // â”€â”€ Private â”€â”€

  private extendCombo(key: string, combo: GiftCombo): void {
    // Clear existing timer
    const existingTimer = this.expirationTimers.get(key);
    if (existingTimer) clearTimeout(existingTimer);

    // Set new expiration
    combo.comboExpiresAt = Date.now() + this.config.comboTimeoutMs;
    this.setExpirationTimer(key, combo);
  }

  private setExpirationTimer(key: string, combo: GiftCombo): void {
    const remaining = combo.comboExpiresAt - Date.now();

    const timer = setTimeout(() => {
      this.endCombo(key, combo);
    }, remaining);

    this.expirationTimers.set(key, timer);
  }

  private endCombo(key: string, combo: GiftCombo): void {
    this.activeCombos.delete(key);
    const timer = this.expirationTimers.get(key);
    if (timer) clearTimeout(timer);
    this.expirationTimers.delete(key);

    this.callbacks.onComboEnd?.(combo);
  }
}
