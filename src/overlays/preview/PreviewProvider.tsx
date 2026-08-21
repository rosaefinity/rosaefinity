// ─────────────────────────────────────────────────────
// RosaeFinity Overlay Preview — Preview Provider
// Context provider for mock event system and preview state
// ─────────────────────────────────────────────────────

import React, { createContext, useContext, useMemo, useRef, useCallback, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { OverlayEventSource, OverlayEvent } from '../types';
import {
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
} from './mockEvents';

// ═══════════════════════════════════════════════════════
// MOCK EVENT SOURCE IMPLEMENTATION
// ═══════════════════════════════════════════════════════

/** Base shape for mock events (without transport metadata) */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockEventBase = Record<string, any>;

interface MockEventConfig {
  intervalMs: number;
  events: MockEventBase[];
  eventTypeMap: Record<string, OverlayEvent['type'][]>;
}

/**
 * Default mock event intervals for different overlay types
 */
const MOCK_EVENT_INTERVALS: Record<string, number> = {
  'gift-alert': 2000,
  'gift-feed': 1500,
  'gift-queue': 1500,
  'gift-combo': 3000,
  'gift-goal': 4000,
  'chat-box': 1000,
  'floating-comments': 800,
  'emoji-rain': 1200,
  'pinned-comment': 5000,
  'keystroke': 600,
};

/**
 * Event type mappings for each overlay category
 */
const EVENT_TYPE_MAP: Record<string, OverlayEvent['type'][]> = {
  gifts: ['gift'],
  chat: ['comment'],
  alerts: ['follow', 'like', 'share'],
};

/**
 * Get mock events for a specific overlay ID
 */
function getMockEventsForOverlay(overlayId: string): MockEventBase[] {
  switch (overlayId) {
    case 'gift-alert':
    case 'gift-feed':
    case 'gift-queue':
    case 'gift-combo':
      return mockGiftEvents;
    case 'gift-goal':
      return mockGoalEvents;
    case 'chat-box':
      return mockChatEvents;
    case 'floating-comments':
      return mockFloatingCommentEvents;
    case 'emoji-rain':
      return mockEmojiEvents;
    case 'pinned-comment':
      return mockPinnedCommentEvents;
    case 'keystroke':
      return mockKeystrokeEvents;
    default:
      // Default to chat events for unknown overlays
      return mockChatEvents;
  }
}

/**
 * Create a mock event source for an overlay
 */
function createMockEventSource(overlayId: string, intervalMs: number): OverlayEventSource {
  const events = getMockEventsForOverlay(overlayId);
  let eventIndex = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const subscribers = new Set<(event: OverlayEvent) => void>();

  const emitEvent = () => {
    if (events.length === 0 || subscribers.size === 0) return;

    const baseEvent = events[eventIndex % events.length];
    eventIndex++;

    const overlayEvent = {
      ...baseEvent,
      id: `mock-${overlayId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      source: 'mock',
      priority: baseEvent.type === 'gift' ? 1 : 0,
      cancelable: false,
      data: baseEvent as Record<string, unknown>,
      screenId: undefined,
    } as unknown as OverlayEvent;

    subscribers.forEach((callback) => {
      try {
        callback(overlayEvent);
      } catch (error) {
        console.warn(`[MockEventSource] Error in subscriber for ${overlayId}:`, error);
      }
    });
  };

  return {
    subscribe: (callback: (event: OverlayEvent) => void) => {
      subscribers.add(callback);

      // Start interval on first subscriber
      if (subscribers.size === 1 && !intervalId) {
        emitEvent(); // Emit immediately
        intervalId = setInterval(emitEvent, intervalMs);
      }

      // Return unsubscribe function
      return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0 && intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      };
    },
  };
}

// ═══════════════════════════════════════════════════════
// PREVIEW CONTEXT
// ═══════════════════════════════════════════════════════

interface PreviewContextValue {
  /** Get or create a mock event source for an overlay */
  getEventSource: (overlayId: string, intervalMs?: number) => OverlayEventSource | undefined;
  /** Register a preview for visibility tracking */
  registerPreview: (overlayId: string, isVisible: boolean) => void;
  /** Check if a preview is currently visible */
  isPreviewVisible: (overlayId: string) => boolean;
  /** Get all registered preview visibility states */
  getAllPreviewVisibility: () => Record<string, boolean>;
}

const PreviewContext = createContext<PreviewContextValue | null>(null);

/**
 * Hook to access the preview context
 */
export function usePreviewContext(): PreviewContextValue {
  const context = useContext(PreviewContext);
  if (!context) {
    throw new Error('usePreviewContext must be used within a PreviewProvider');
  }
  return context;
}

// ═══════════════════════════════════════════════════════
// PREVIEW PROVIDER COMPONENT
// ═══════════════════════════════════════════════════════

interface PreviewProviderProps {
  children: ReactNode;
  /** Global mock event interval override (ms) */
  globalMockIntervalMs?: number;
  /** Disable all mock events globally */
  disableMockEvents?: boolean;
}

/**
 * PreviewProvider - Provides mock event system and preview state management
 *
 * This component:
 * - Manages mock event sources for all overlays
 * - Tracks preview visibility for performance optimization
 * - Provides a central point for configuring mock event behavior
 * - Automatically cleans up intervals on unmount
 */
export function PreviewProviderInner({
  children,
  globalMockIntervalMs,
  disableMockEvents = false,
}: PreviewProviderProps): React.ReactElement {
  // Store event sources by overlay ID
  const eventSourcesRef = useRef<Map<string, OverlayEventSource>>(new Map());
  // Store visibility state by overlay ID
  const visibilityRef = useRef<Map<string, boolean>>(new Map());
  // Force re-render when visibility changes
  const [, setRenderTrigger] = useState(0);

  const getEventSource = useCallback((overlayId: string, intervalMs?: number): OverlayEventSource | undefined => {
    if (disableMockEvents) return undefined;

    let source = eventSourcesRef.current.get(overlayId);

    if (!source) {
      const interval = intervalMs ?? globalMockIntervalMs ?? MOCK_EVENT_INTERVALS[overlayId] ?? 2000;
      source = createMockEventSource(overlayId, interval);
      eventSourcesRef.current.set(overlayId, source);
    }

    return source;
  }, [disableMockEvents, globalMockIntervalMs]);

  const registerPreview = useCallback((overlayId: string, isVisible: boolean) => {
    const prevVisible = visibilityRef.current.get(overlayId);
    if (prevVisible !== isVisible) {
      visibilityRef.current.set(overlayId, isVisible);
      setRenderTrigger((prev) => prev + 1);
    }
  }, []);

  const isPreviewVisible = useCallback((overlayId: string): boolean => {
    return visibilityRef.current.get(overlayId) ?? true; // Default to visible for SSR/initial render
  }, []);

  const getAllPreviewVisibility = useCallback((): Record<string, boolean> => {
    return Object.fromEntries(visibilityRef.current.entries());
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all intervals by unsubscribing from all sources
      eventSourcesRef.current.forEach((source) => {
        // Create a dummy subscriber to trigger cleanup
        const unsubscribe = source.subscribe(() => {});
        unsubscribe();
      });
      eventSourcesRef.current.clear();
      visibilityRef.current.clear();
    };
  }, []);

  const value = useMemo<PreviewContextValue>(() => ({
    getEventSource,
    registerPreview,
    isPreviewVisible,
    getAllPreviewVisibility,
  }), [getEventSource, registerPreview, isPreviewVisible, getAllPreviewVisibility]);

  return (
    <PreviewContext.Provider value={value}>
      {children}
    </PreviewContext.Provider>
  );
}

export const PreviewProvider = PreviewProviderInner;

export default PreviewProvider;