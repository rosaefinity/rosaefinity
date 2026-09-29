// ─────────────────────────────────────────────────────
// RosaeFinity — Coin Jar Pro Demo Event Source
// Manages demo animation loop with state machine
// Prevents overlapping animations, handles cleanup
// ─────────────────────────────────────────────────────

import type { OverlayEvent, OverlayEventSource } from '../types';
import { getGifts, getGiftsSync, getGiftImageUrl, type TikTokGift } from '../../services/gift-service';

/**
 * Resolve gift image URL from the catalog (same path as real TikTok gifts).
 * Returns the real CDN image URL if available, empty string otherwise.
 */
function resolveDemoGiftImageUrl(giftName: string): string {
  const catalog = getGiftsSync();
  if (!catalog) return '';
  const entry = catalog.find(g => g.name.toLowerCase().trim() === giftName.toLowerCase().trim());
  if (!entry) return '';
  return getGiftImageUrl(entry);
}

// Demo gift configurations — only include gifts with verified working image URLs
// Rose is preferred because it's already verified to work in production
const DEMO_GIFTS = [
  { username: 'PreviewUser', giftName: 'Rose', diamonds: 10, repeatCount: 1 },
];

// Resolve demo gifts to real catalog entries at runtime
function resolveDemoGifts(catalog: TikTokGift[]): typeof DEMO_GIFTS {
  if (!catalog || catalog.length === 0) return DEMO_GIFTS;

  // Try to find real catalog entries for our demo gift names
  const resolved = DEMO_GIFTS.map(demo => {
    const entry = catalog.find(g => g.name.toLowerCase().trim() === demo.giftName.toLowerCase().trim());
    if (entry) {
      return { ...demo, giftName: entry.name, diamonds: entry.coins };
    }
    return demo; // fallback to hardcoded
  });

  return resolved;
}

let resolvedDemoGifts: typeof DEMO_GIFTS = DEMO_GIFTS;

const DEMO_INITIAL_DELAY_MS = 1500;
// Cycle: waiting(1500) -> triggering -> animating(~2500) -> complete(2000) -> waiting(1000) -> next = ~7500ms total per gift
const POST_ANIMATION_HOLD_MS = 2000; // Hold the completed state visually
const WAITING_BETWEEN_CYCLES_MS = 1000; // Brief pause before next gift

type DemoPhase = 'idle' | 'waiting' | 'triggering' | 'animating' | 'complete';

export function createCoinJarDemoEventSource(): OverlayEventSource {
  let subscribers: ((event: OverlayEvent) => void)[] = [];
  let phaseTimeoutRef: ReturnType<typeof setTimeout> | null = null;
  let isMounted = false;
  let animationComplete = false;
  let currentPhase: DemoPhase = 'idle';
  let currentGiftIndex = 0;

  // Resolve demo gifts to real catalog entries once catalog loads
  getGifts().then(catalog => {
    resolvedDemoGifts = resolveDemoGifts(catalog);
    console.log('[COIN-JAR-DEMO] Resolved demo gifts to catalog:', resolvedDemoGifts.map(g => g.giftName));
  });

  function setPhase(newPhase: DemoPhase) {
    if (!isMounted) return;
    console.log('[COIN-JAR-DEMO-FLOW] state=' + newPhase + ' subscribers=' + subscribers.length + ' isMounted=' + isMounted);
    currentPhase = newPhase;
  }

  function triggerDemoGift() {
    if (!isMounted) {
      console.log('[COIN-JAR-DEMO-FLOW] triggerDemoGift skipped - not mounted');
      return;
    }

    const gift = resolvedDemoGifts[currentGiftIndex];
    // Resolve image URL from catalog — same pipeline as real TikTok gifts
    const resolvedImageUrl = resolveDemoGiftImageUrl(gift.giftName);
    const mockEvent: OverlayEvent = {
      type: 'gift',
      ...gift,
      giftImageUrl: resolvedImageUrl || undefined,
    };

    console.log('[COIN-JAR-DEMO-FLOW] TRIGGER_DEMO_GIFT subscribers=' + subscribers.length + ' gift=' + gift.giftName + ' image=' + (resolvedImageUrl ? resolvedImageUrl.slice(0, 60) : 'EMPTY'));
    setPhase('animating');
    animationComplete = false;

    subscribers.forEach((cb, i) => {
      console.log('[COIN-JAR-DEMO-FLOW] sending to subscriber[' + i + ']');
      cb(mockEvent);
    });
    console.log('[COIN-JAR-DEMO-FLOW] emitted to ' + subscribers.length + ' subscribers');
  }

  // Called by renderer when visual animation actually completes
  function notifyAnimationComplete() {
    if (!isMounted) return;
    console.log('[COIN-JAR-DEMO] animation complete notified by renderer');
    animationComplete = true;

    // Move to complete phase, hold the visual state
    setPhase('complete');

    // Advance to next gift index for next cycle
    currentGiftIndex = (currentGiftIndex + 1) % DEMO_GIFTS.length;

    // Hold the completed state visually, then transition to waiting
    phaseTimeoutRef = setTimeout(() => {
      if (!isMounted) return;
      setPhase('waiting');
      startNextCycle();
    }, POST_ANIMATION_HOLD_MS);
  }

  function startNextCycle() {
    if (!isMounted) return;

    // Reset animation flag for next cycle
    animationComplete = false;

    // Brief waiting period before next gift
    phaseTimeoutRef = setTimeout(() => {
      if (!isMounted) return;

      // Start new cycle
      setPhase('triggering');
      triggerDemoGift();
    }, WAITING_BETWEEN_CYCLES_MS);
  }

  const source: OverlayEventSource = {
    subscribe(callback: (event: OverlayEvent) => void): () => void {
      console.log('[COIN-JAR-DEMO-FLOW] subscribe called, subscribers before=' + subscribers.length + ' isMounted=' + isMounted + ' currentPhase=' + currentPhase);
      subscribers.push(callback);

      // Auto-initialize on first subscribe
      if (!isMounted) {
        isMounted = true;
        console.log('[COIN-JAR-DEMO-FLOW] auto-initialized, isMounted=true');
      }

      if (subscribers.length === 1 && isMounted) {
        // First subscriber, start demo if not already running
        if (currentPhase === 'idle') {
          console.log('[COIN-JAR-DEMO-FLOW] starting demo loop');
          startDemoLoop();
        }
      }

      return () => {
        console.log('[COIN-JAR-DEMO-FLOW] unsubscribe, subscribers before=' + subscribers.length);
        subscribers = subscribers.filter(cb => cb !== callback);
        if (subscribers.length === 0) {
          console.log('[COIN-JAR-DEMO-FLOW] last subscriber removed, stopping demo loop');
          stopDemoLoop();
        }
      };
    },
  };

  function startDemoLoop() {
    if (!isMounted) return;

    setPhase('waiting');
    phaseTimeoutRef = setTimeout(() => {
      if (!isMounted) return;
      setPhase('triggering');
      triggerDemoGift();
    }, DEMO_INITIAL_DELAY_MS);
  }

  function stopDemoLoop() {
    if (phaseTimeoutRef) {
      clearTimeout(phaseTimeoutRef);
      phaseTimeoutRef = null;
    }
    currentPhase = 'idle';
    animationComplete = false;
  }

  return {
    ...source,
    // Internal methods for renderer to call
    _internal: {
      notifyAnimationComplete,
      isMounted: () => isMounted,
      getPhase: () => currentPhase,
    },
  } as OverlayEventSource & {
    _internal: {
      notifyAnimationComplete: () => void;
      isMounted: () => boolean;
      getPhase: () => DemoPhase;
    };
  };
}

// Initialize on import if needed
export function initializeCoinJarDemoSource(source: OverlayEventSource): void {
  if (source && typeof source === 'object' && '_internal' in source) {
    const internal = (source as any)._internal;
    if (internal && typeof internal.isMounted === 'function') {
      internal.isMounted = () => true;
    }
  }
}