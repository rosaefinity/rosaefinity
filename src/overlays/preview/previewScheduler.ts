// ─────────────────────────────────────────────────────
// RosaeFinity Overlay Preview — Preview Scheduler
// Manages preview animations and performance optimization
// ─────────────────────────────────────────────────────

import { useEffect, useRef, useCallback, useMemo } from 'react';
import type { OverlayEventSource, OverlayEvent } from '../types';

// ═══════════════════════════════════════════════════════
// PREVIEW SCHEDULER
// ═══════════════════════════════════════════════════════

/**
 * Configuration for preview scheduling
 */
export interface PreviewSchedulerConfig {
  /** Minimum interval between frames (ms) */
  minFrameInterval?: number;
  /** Maximum number of concurrent previews animating */
  maxConcurrentPreviews?: number;
  /** Enable visibility-based pausing */
  pauseWhenHidden?: boolean;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Threshold for intersection observer */
  threshold?: number;
}

/**
 * Preview scheduler state
 */
interface PreviewSchedulerState {
  activePreviews: Set<string>;
  visiblePreviews: Set<string>;
  frameRequestId: number | null;
  lastFrameTime: number;
}

/**
 * Creates a preview scheduler for managing multiple overlay previews
 */
export function createPreviewScheduler(config: PreviewSchedulerConfig = {}) {
  const {
    minFrameInterval = 16, // ~60fps
    maxConcurrentPreviews = 10,
    pauseWhenHidden = true,
    rootMargin = '100px',
    threshold = 0.1,
  } = config;

  const state: PreviewSchedulerState = {
    activePreviews: new Set(),
    visiblePreviews: new Set(),
    frameRequestId: null,
    lastFrameTime: 0,
  };

  const observers = new Map<string, IntersectionObserver>();
  const animationCallbacks = new Map<string, (deltaTime: number) => void>();
  const previewElements = new Map<string, HTMLElement>();

  /**
   * Register a preview for scheduling
   */
  function registerPreview(
    overlayId: string,
    element: HTMLElement,
    animationCallback: (deltaTime: number) => void
  ): () => void {
    state.activePreviews.add(overlayId);
    animationCallbacks.set(overlayId, animationCallback);
    previewElements.set(overlayId, element);

    // Set up intersection observer for visibility tracking
    if (pauseWhenHidden) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              state.visiblePreviews.add(overlayId);
            } else {
              state.visiblePreviews.delete(overlayId);
            }
          });
        },
        { rootMargin, threshold }
      );

      observer.observe(element);
      observers.set(overlayId, observer);
    } else {
      state.visiblePreviews.add(overlayId);
    }

    // Start animation loop if not running
    if (!state.frameRequestId) {
      startAnimationLoop();
    }

    // Return cleanup function
    return () => unregisterPreview(overlayId);
  }

  /**
   * Unregister a preview
   */
  function unregisterPreview(overlayId: string): void {
    state.activePreviews.delete(overlayId);
    state.visiblePreviews.delete(overlayId);
    animationCallbacks.delete(overlayId);
    previewElements.delete(overlayId);

    const observer = observers.get(overlayId);
    if (observer) {
      observer.disconnect();
      observers.delete(overlayId);
    }

    // Stop animation loop if no active previews
    if (state.activePreviews.size === 0 && state.frameRequestId) {
      cancelAnimationFrame(state.frameRequestId);
      state.frameRequestId = null;
    }
  }

  /**
   * Animation loop
   */
  function startAnimationLoop(): void {
    const now = performance.now();
    const deltaTime = now - state.lastFrameTime;
    state.lastFrameTime = now;

    // Throttle frame rate
    if (deltaTime < minFrameInterval) {
      state.frameRequestId = requestAnimationFrame(startAnimationLoop);
      return;
    }

    // Run animation callbacks for visible previews
    state.visiblePreviews.forEach((overlayId) => {
      const callback = animationCallbacks.get(overlayId);
      if (callback) {
        try {
          callback(deltaTime);
        } catch (error) {
          console.warn(`[PreviewScheduler] Animation error for ${overlayId}:`, error);
        }
      }
    });

    // Continue loop if there are active previews
    if (state.activePreviews.size > 0) {
      state.frameRequestId = requestAnimationFrame(startAnimationLoop);
    } else {
      state.frameRequestId = null;
    }
  }

  /**
   * Get current scheduler stats
   */
  function getStats() {
    return {
      activeCount: state.activePreviews.size,
      visibleCount: state.visiblePreviews.size,
      isRunning: !!state.frameRequestId,
    };
  }

  /**
   * Pause all animations
   */
  function pauseAll(): void {
    state.visiblePreviews.clear();
  }

  /**
   * Resume all animations
   */
  function resumeAll(): void {
    state.activePreviews.forEach((id) => state.visiblePreviews.add(id));
  }

  /**
   * Cleanup all resources
   */
  function destroy(): void {
    if (state.frameRequestId) {
      cancelAnimationFrame(state.frameRequestId);
      state.frameRequestId = null;
    }

    observers.forEach((observer) => observer.disconnect());
    observers.clear();
    animationCallbacks.clear();
    previewElements.clear();
    state.activePreviews.clear();
    state.visiblePreviews.clear();
  }

  return {
    registerPreview,
    unregisterPreview,
    getStats,
    pauseAll,
    resumeAll,
    destroy,
  };
}

// ═══════════════════════════════════════════════════════
// REACT HOOK FOR PREVIEW SCHEDULER
// ═══════════════════════════════════════════════════════

/**
 * Hook to use the global preview scheduler
 */
export function usePreviewScheduler(config?: PreviewSchedulerConfig) {
  const schedulerRef = useRef<ReturnType<typeof createPreviewScheduler> | null>(null);

  if (!schedulerRef.current) {
    schedulerRef.current = createPreviewScheduler(config);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (schedulerRef.current) {
        schedulerRef.current.destroy();
        schedulerRef.current = null;
      }
    };
  }, []);

  return schedulerRef.current;
}

/**
 * Hook to register a preview with the scheduler
 */
export function usePreviewAnimation(
  overlayId: string,
  animationCallback: (deltaTime: number) => void,
  options?: { enabled?: boolean; element?: HTMLElement | null }
) {
  const { enabled = true, element: externalElement } = options ?? {};
  const scheduler = usePreviewScheduler();
  const elementRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(animationCallback);

  // Update callback ref
  useEffect(() => {
    callbackRef.current = animationCallback;
  }, [animationCallback]);

  // Register with scheduler
  useEffect(() => {
    if (!enabled) return;

    const element = externalElement ?? elementRef.current;
    if (!element) return;

    const cleanup = scheduler.registerPreview(overlayId, element, (deltaTime) => {
      callbackRef.current(deltaTime);
    });

    return cleanup;
  }, [overlayId, enabled, externalElement, scheduler]);

  return elementRef;
}

// ═══════════════════════════════════════════════════════
// PREVIEW EVENT SCHEDULER
// ═══════════════════════════════════════════════════════

/**
 * Schedules mock events for previews with configurable timing
 */
export function createPreviewEventScheduler() {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const eventSources = new Map<string, OverlayEventSource>();

  /**
   * Schedule a series of events for an overlay
   */
  function scheduleEvents(
    overlayId: string,
    events: Omit<OverlayEvent, 'id' | 'timestamp' | 'source' | 'priority' | 'cancelable' | 'data' | 'screenId'>[],
    intervalMs: number,
    onEvent: (event: OverlayEvent) => void,
    loop: boolean = true
  ): () => void {
    let index = 0;

    const emitNext = () => {
      if (index >= events.length) {
        if (loop) {
          index = 0;
        } else {
          stop();
          return;
        }
      }

      const baseEvent = events[index];
      index++;

      const event = {
        ...baseEvent,
        id: `scheduled-${overlayId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        source: 'preview',
        priority: baseEvent.type === 'gift' ? 1 : 0,
        cancelable: false,
        data: baseEvent as Record<string, unknown>,
        screenId: undefined,
      } as OverlayEvent;

      onEvent(event);

      const timerId = setTimeout(emitNext, intervalMs);
      timers.set(overlayId, timerId);
    };

    const stop = () => {
      const timerId = timers.get(overlayId);
      if (timerId) {
        clearTimeout(timerId);
        timers.delete(overlayId);
      }
    };

    // Start immediately
    emitNext();

    return stop;
  }

  /**
   * Stop scheduled events for an overlay
   */
  function stopEvents(overlayId: string): void {
    const timerId = timers.get(overlayId);
    if (timerId) {
      clearTimeout(timerId);
      timers.delete(overlayId);
    }
  }

  /**
   * Stop all scheduled events
   */
  function stopAll(): void {
    timers.forEach((timerId) => clearTimeout(timerId));
    timers.clear();
  }

  return {
    scheduleEvents,
    stopEvents,
    stopAll,
  };
}

// Global event scheduler instance
export const previewEventScheduler = createPreviewEventScheduler();

export default {
  createPreviewScheduler,
  usePreviewScheduler,
  usePreviewAnimation,
  createPreviewEventScheduler,
  previewEventScheduler,
};