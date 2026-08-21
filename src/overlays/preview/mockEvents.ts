// ─────────────────────────────────────────────────────
// RosaeFinity Overlay Preview — Mock Event System
// Centralized fake events for all overlay types
// ─────────────────────────────────────────────────────

import type { OverlayEvent, OverlayEventSource } from '../types';

// ═══════════════════════════════════════════════════════
// MOCK EVENT DATA
// ═══════════════════════════════════════════════════════

/** Base shape for mock events (without transport metadata) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockEventBase = Record<string, any>;

/**
 * Gift events for Gift Alert, Gift Feed, Gift Queue, Gift Combo, Gift Goal
 */
export const mockGiftEvents: MockEventBase[] = [
  { type: 'gift', username: 'LunaLovegood', giftName: 'Rose', diamonds: 1, repeatCount: 10 },
  { type: 'gift', username: 'StreamSniper', giftName: 'TikTok Logo', diamonds: 99, repeatCount: 1 },
  { type: 'gift', username: 'BigSpender', giftName: 'Lion', diamonds: 29999, repeatCount: 1 },
  { type: 'gift', username: 'GiftQueen', giftName: 'Universe', diamonds: 34999, repeatCount: 1 },
  { type: 'gift', username: 'CuteCat', giftName: 'GG', diamonds: 500, repeatCount: 3 },
  { type: 'gift', username: 'GamerPro', giftName: 'Concert', diamonds: 5000, repeatCount: 2 },
  { type: 'gift', username: 'AnimeFan', giftName: 'Galaxy', diamonds: 1999, repeatCount: 1 },
  { type: 'gift', username: 'KPopStan', giftName: 'Sports Car', diamonds: 2999, repeatCount: 1 },
  { type: 'gift', username: 'RoseCollector', giftName: 'Rose', diamonds: 1, repeatCount: 5 },
  { type: 'gift', username: 'Legend', giftName: 'Interstellar', diamonds: 9999, repeatCount: 1 },
];

/**
 * Chat events for Chat Box, Floating Comments
 */
export const mockChatEvents: MockEventBase[] = [
  { type: 'comment', username: 'LunaLovegood', message: 'Hello everyone! 🌙' },
  { type: 'comment', username: 'StreamSniper', message: 'Amazing stream!' },
  { type: 'comment', username: 'IndonesiaFan', message: 'Indonesia ❤️🇮🇩' },
  { type: 'comment', username: 'BigSpender', message: 'Best streamer ever!' },
  { type: 'comment', username: 'GiftQueen', message: 'Love your content 😍' },
  { type: 'comment', username: 'CuteCat', message: 'So funny! 😂' },
  { type: 'comment', username: 'GamerPro', message: 'What game is this?' },
  { type: 'comment', username: 'AnimeFan', message: 'Nice play!' },
  { type: 'comment', username: 'KPopStan', message: 'BTS forever! 💜' },
  { type: 'comment', username: 'RoseCollector', message: 'Keep it up!' },
];

/**
 * Follow events
 */
export const mockFollowEvents: MockEventBase[] = [
  { type: 'follow', username: 'NewFollower1' },
  { type: 'follow', username: 'NewFollower2' },
  { type: 'follow', username: 'NewFollower3' },
];

/**
 * Like events
 */
export const mockLikeEvents: MockEventBase[] = [
  { type: 'like', username: 'Liker1', count: 5, totalLikes: 100 },
  { type: 'like', username: 'Liker2', count: 10, totalLikes: 110 },
  { type: 'like', username: 'Liker3', count: 3, totalLikes: 113 },
];

/**
 * Share events
 */
export const mockShareEvents: MockEventBase[] = [
  { type: 'share', username: 'Sharer1' },
  { type: 'share', username: 'Sharer2' },
];

/**
 * Goal progress events for Gift Goal
 */
export const mockGoalEvents: MockEventBase[] = [
  { type: 'goal-progress', goalType: 'gift', current: 20, target: 100 },
  { type: 'goal-progress', goalType: 'gift', current: 40, target: 100 },
  { type: 'goal-progress', goalType: 'gift', current: 60, target: 100 },
  { type: 'goal-progress', goalType: 'gift', current: 80, target: 100 },
  { type: 'goal-progress', goalType: 'gift', current: 100, target: 100 },
];

/**
 * Keystroke events for Keystroke overlay
 */
export const mockKeystrokeEvents: MockEventBase[] = [
  { type: 'hotkey', keys: 'CTRL' },
  { type: 'hotkey', keys: 'SHIFT' },
  { type: 'hotkey', keys: 'A' },
  { type: 'hotkey', keys: 'S' },
  { type: 'hotkey', keys: 'D' },
  { type: 'hotkey', keys: 'F' },
  { type: 'hotkey', keys: 'SPACE' },
  { type: 'hotkey', keys: 'ENTER' },
];

/**
 * Emoji events for Emoji Rain
 */
export const mockEmojiEvents: MockEventBase[] = [
  { type: 'comment', username: 'EmojiFan1', message: '😂😂😂😂😂' },
  { type: 'comment', username: 'EmojiFan2', message: '😍😍😍' },
  { type: 'comment', username: 'EmojiFan3', message: '🔥🔥🔥🔥' },
  { type: 'comment', username: 'EmojiFan4', message: '💯💯💯' },
  { type: 'comment', username: 'EmojiFan5', message: '🎉🎉🎉🎉🎉' },
];

/**
 * Pinned comment events
 */
export const mockPinnedCommentEvents: MockEventBase[] = [
  { type: 'comment', username: 'ModUser', message: 'Welcome to the stream! Rules: Be kind, no spam.' },
  { type: 'comment', username: 'Streamer', message: 'Thanks for watching! Don\'t forget to follow!' },
];

/**
 * Floating comment events (short messages)
 */
export const mockFloatingCommentEvents: MockEventBase[] = [
  { type: 'comment', username: 'QuickFan1', message: 'Nice!' },
  { type: 'comment', username: 'QuickFan2', message: 'Awesome!' },
  { type: 'comment', username: 'QuickFan3', message: '👏' },
  { type: 'comment', username: 'QuickFan4', message: 'GG!' },
  { type: 'comment', username: 'QuickFan5', message: 'Love it!' },
];

// ═══════════════════════════════════════════════════════
// EVENT SEQUENCES BY OVERLAY TYPE
// ═══════════════════════════════════════════════════════

/**
 * Get mock events for a specific overlay module ID
 */
export function getMockEventsForOverlay(overlayId: string): MockEventBase[] {
  switch (overlayId) {
    case 'gift-alert':
    case 'gift-feed':
    case 'gift-queue':
    case 'gift-combo':
      return mockGiftEvents;
    case 'chat-box':
    case 'floating-comments':
      return mockChatEvents;
    case 'emoji-rain':
      return mockEmojiEvents;
    case 'pinned-comment':
      return mockPinnedCommentEvents;
    case 'gift-goal':
      return mockGoalEvents;
    case 'keystroke':
      return mockKeystrokeEvents;
    default:
      // Default to chat events for unknown overlays
      return mockChatEvents;
  }
}

/**
 * Get all mock event types for a given overlay
 */
export function getMockEventTypesForOverlay(overlayId: string): OverlayEvent['type'][] {
  switch (overlayId) {
    case 'gift-alert':
    case 'gift-feed':
    case 'gift-queue':
    case 'gift-combo':
      return ['gift'];
    case 'chat-box':
      return ['comment'];
    case 'floating-comments':
      return ['comment'];
    case 'emoji-rain':
      return ['comment'];
    case 'pinned-comment':
      return ['comment'];
    case 'gift-goal':
      return ['goal-progress'];
    case 'keystroke':
      return ['hotkey'];
    default:
      return ['comment'];
  }
}

// ═══════════════════════════════════════════════════════
// MOCK EVENT SOURCE IMPLEMENTATION
// ═══════════════════════════════════════════════════════

interface MockEventSourceOptions {
  overlayId: string;
  intervalMs?: number;
  autoStart?: boolean;
  loop?: boolean;
}

/**
 * Creates a mock event source that emits fake events for preview
 */
export function createMockEventSource(options: MockEventSourceOptions): OverlayEventSource {
  const { overlayId, intervalMs = 2000, autoStart = true, loop = true } = options;
  let subscribers: ((event: OverlayEvent) => void)[] = [];
  let currentIndex = 0;
  let timerId: ReturnType<typeof setInterval> | null = null;
  const events = getMockEventsForOverlay(overlayId);

  function emitNextEvent(): void {
    if (events.length === 0) return;

    const mockEvent = events[currentIndex];
    const event = {
      ...mockEvent,
      id: `mock-${overlayId}-${Date.now()}-${currentIndex}`,
      timestamp: Date.now(),
      source: 'mock',
      priority: 0,
      cancelable: false,
      data: mockEvent,
      screenId: undefined,
    } as unknown as OverlayEvent;

    subscribers.forEach(cb => cb(event));

    currentIndex = (currentIndex + 1) % events.length;

    // Stop if not looping and we've gone through all events
    if (!loop && currentIndex === 0 && timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function start(): void {
    if (timerId) return;
    // Emit first event immediately
    emitNextEvent();
    timerId = setInterval(emitNextEvent, intervalMs);
  }

  function stop(): void {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  const source: OverlayEventSource = {
    subscribe(callback: (event: OverlayEvent) => void): () => void {
      subscribers.push(callback);
      if (autoStart && subscribers.length === 1) {
        start();
      }
      // Return unsubscribe function
      return () => {
        subscribers = subscribers.filter(cb => cb !== callback);
        if (subscribers.length === 0) {
          stop();
        }
      };
    },
  };

  // Auto-start if requested
  if (autoStart) {
    start();
  }

  // Cleanup on unload (optional, for memory safety)
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', stop);
  }

  return source;
}

/**
 * Create a one-shot test event source (emits single event then stops)
 */
export function createTestEventSource(overlayId: string, eventIndex: number = 0): OverlayEventSource {
  const events = getMockEventsForOverlay(overlayId);
  const mockEvent = events[eventIndex] || events[0];

  let subscribers: ((event: OverlayEvent) => void)[] = [];

  const event = {
    ...mockEvent,
    id: `test-${overlayId}-${Date.now()}`,
    timestamp: Date.now(),
    source: 'test',
    priority: 0,
    cancelable: false,
    data: mockEvent,
    screenId: undefined,
  } as unknown as OverlayEvent;

  return {
    subscribe(callback: (event: OverlayEvent) => void): () => void {
      subscribers.push(callback);
      // Emit immediately
      setTimeout(() => {
        subscribers.forEach(cb => cb(event));
      }, 500);
      return () => {
        subscribers = subscribers.filter(cb => cb !== callback);
      };
    },
  };
}

// ═══════════════════════════════════════════════════════
// PREVIEW EVENT PROVIDER (for batch emission)
// ═══════════════════════════════════════════════════════

/**
 * Emits a batch of events immediately for preview testing
 */
export function emitPreviewEvents(overlayId: string, eventSource: OverlayEventSource, count: number = 5): void {
  const events = getMockEventsForOverlay(overlayId);
  const eventCount = Math.min(count, events.length);

  for (let i = 0; i < eventCount; i++) {
    const mockEvent = events[i];
    const event = {
      ...mockEvent,
      id: `preview-${overlayId}-${Date.now()}-${i}`,
      timestamp: Date.now() + i * 100,
      source: 'preview',
      priority: 0,
      cancelable: false,
      data: mockEvent,
      screenId: undefined,
    } as unknown as OverlayEvent;

    // Note: We can't directly emit to the source since it's subscribe-only
    // This is a utility for manual triggering if needed
  }
}

export default {
  getMockEventsForOverlay,
  getMockEventTypesForOverlay,
  createMockEventSource,
  createTestEventSource,
  emitPreviewEvents,
  // Raw event arrays for direct access
  mockGiftEvents,
  mockChatEvents,
  mockFollowEvents,
  mockLikeEvents,
  mockShareEvents,
  mockGoalEvents,
  mockKeystrokeEvents,
  mockEmojiEvents,
  mockPinnedCommentEvents,
  mockFloatingCommentEvents,
};