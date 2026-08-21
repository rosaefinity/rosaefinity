// ─────────────────────────────────────────────────────
// RosaeFinity Overlay Preview — Preview Hooks
// Reusable hooks for preview components
// ─────────────────────────────────────────────────────

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { AnyOverlayModule, RendererProps, BaseOverlayConfig } from '../types';
import { usePreviewContext } from './PreviewProvider';
import { createOverlayConfig } from '../createConfig';

// ═══════════════════════════════════════════════════════
// INTERSECTION OBSERVER HOOK
// ═══════════════════════════════════════════════════════

export interface UsePreviewContainerOptions {
  /** Minimum visibility threshold to trigger (0-1) */
  threshold?: number;
  /** Root margin for intersection observer */
  rootMargin?: string;
  /** Whether to track visibility */
  enabled?: boolean;
}

/**
 * Hook for tracking preview container visibility using IntersectionObserver
 * Returns a ref to attach to the container and current visibility state
 */
export function usePreviewContainer(
  overlayId: string,
  options: UsePreviewContainerOptions = {}
): { ref: React.RefObject<HTMLDivElement>; isVisible: boolean; registerVisibility: (visible: boolean) => void } {
  const { threshold = 0.1, rootMargin = '50px', enabled = true } = options;
  const { registerPreview, isPreviewVisible } = usePreviewContext();
  const [isVisible, setIsVisible] = useState(true);
  const elementRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const overlayIdRef = useRef(overlayId);

  // Update overlay ID ref
  useEffect(() => {
    overlayIdRef.current = overlayId;
  }, [overlayId]);

  // Register visibility changes
  const registerVisibility = useCallback((visible: boolean) => {
    registerPreview(overlayIdRef.current, visible);
    setIsVisible(visible);
  }, [registerPreview]);

  // Set up intersection observer
  useEffect(() => {
    if (!enabled) return;

    const element = elementRef.current;
    if (!element) return;

    // Initial check
    const rect = element.getBoundingClientRect();
    const initiallyVisible = rect.width > 0 && rect.height > 0;
    setIsVisible(initiallyVisible);
    registerPreview(overlayId, initiallyVisible);

    // Create observer
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const visible = entry.isIntersecting;
          registerVisibility(visible);
        });
      },
      { threshold, rootMargin }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [overlayId, enabled, threshold, rootMargin, registerVisibility]);

  // Also check visibility on resize
  useEffect(() => {
    if (!enabled) return;

    const checkVisibility = () => {
      const element = elementRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const visible = rect.width > 0 && rect.height > 0;
      if (visible !== isVisible) {
        registerVisibility(visible);
      }
    };

    const resizeObserver = new ResizeObserver(checkVisibility);
    resizeObserver.observe(elementRef.current!);

    return () => resizeObserver.disconnect();
  }, [enabled, isVisible, registerVisibility]);

  return { ref: elementRef, isVisible, registerVisibility };
}

// ═══════════════════════════════════════════════════════
// RENDERER PROPS HOOK
// ═══════════════════════════════════════════════════════

export interface UseRendererPropsOptions {
  /** Custom config override */
  config?: BaseOverlayConfig;
  /** Custom size override */
  size?: { width: number; height: number };
  /** Custom events override */
  events?: any;
  /** Preview mode */
  mode?: 'preview' | 'browser-source';
}

/**
 * Hook to create renderer props for an overlay module
 */
export function useRendererProps(
  module: AnyOverlayModule,
  options: UseRendererPropsOptions = {}
): RendererProps {
  const { config, size, events, mode = 'preview' } = options;
  const { getEventSource } = usePreviewContext();

  return useMemo(() => ({
    config: config ?? createOverlayConfig(module),
    mode,
    events: events ?? getEventSource(module.metadata.id),
    size,
  }), [config, module.defaultConfig, mode, events, size, module.metadata.id, getEventSource]);
}

// ═══════════════════════════════════════════════════════
// PERFORMANCE MONITORING HOOK
// ═══════════════════════════════════════════════════════

export interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  minRenderTime: number;
  maxRenderTime: number;
}

export interface UsePerformanceMonitorOptions {
  /** Enable monitoring */
  enabled?: boolean;
  /** Sample size for averaging */
  sampleSize?: number;
  /** Callback when metrics update */
  onMetricsUpdate?: (metrics: PerformanceMetrics) => void;
}

/**
 * Hook for monitoring render performance of preview components
 */
export function usePerformanceMonitor(
  options: UsePerformanceMonitorOptions = {}
): PerformanceMetrics & { reset: () => void } {
  const { enabled = false, sampleSize = 50, onMetricsUpdate } = options;
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    minRenderTime: Infinity,
    maxRenderTime: 0,
  });
  const renderTimesRef = useRef<number[]>([]);
  const renderStartRef = useRef(0);
  const enabledRef = useRef(enabled);

  // Update enabled ref
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Start timing
  const startTiming = useCallback(() => {
    if (!enabledRef.current) return;
    renderStartRef.current = performance.now();
  }, []);

  // End timing
  const endTiming = useCallback(() => {
    if (!enabledRef.current) return;

    const renderTime = performance.now() - renderStartRef.current;
    renderTimesRef.current.push(renderTime);

    // Trim to sample size
    if (renderTimesRef.current.length > sampleSize) {
      renderTimesRef.current.shift();
    }

    const times = renderTimesRef.current;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const avg = times.reduce((a, b) => a + b, 0) / times.length;

    const newMetrics: PerformanceMetrics = {
      renderCount: metrics.renderCount + 1,
      lastRenderTime: renderTime,
      averageRenderTime: avg,
      minRenderTime: min,
      maxRenderTime: max,
    };

    setMetrics(newMetrics);
    onMetricsUpdate?.(newMetrics);
  }, [metrics.renderCount, sampleSize, onMetricsUpdate]);

  // Reset metrics
  const reset = useCallback(() => {
    renderTimesRef.current = [];
    setMetrics({
      renderCount: 0,
      lastRenderTime: 0,
      averageRenderTime: 0,
      minRenderTime: Infinity,
      maxRenderTime: 0,
    });
  }, []);

  // Wrap in effect for automatic timing (for use with React.memo components)
  useEffect(() => {
    if (!enabled) return;

    let frameId: number;
    const measure = () => {
      startTiming();
      frameId = requestAnimationFrame(() => {
        endTiming();
      });
    };

    // Measure on each frame (or use a different strategy)
    measure();

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [enabled, startTiming, endTiming]);

  return { ...metrics, reset, startTiming, endTiming };
}

// ═══════════════════════════════════════════════════════
// PREVIEW ANIMATION HOOK
// ═══════════════════════════════════════════════════════

export interface UsePreviewAnimationOptions {
  /** Animation callback */
  onFrame: (deltaTime: number, timestamp: number) => void;
  /** Whether animation is enabled */
  enabled?: boolean;
  /** Target FPS (default: 60) */
  targetFPS?: number;
}

/**
 * Hook for running preview animations with frame rate control
 */
export function usePreviewAnimation(
  options: UsePreviewAnimationOptions
): { isRunning: boolean; start: () => void; stop: () => void } {
  const { onFrame, enabled = true, targetFPS = 60 } = options;
  const [isRunning, setIsRunning] = useState(false);
  const frameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const frameIntervalRef = useRef(1000 / targetFPS);
  const onFrameRef = useRef(onFrame);
  const enabledRef = useRef(enabled);

  // Update refs
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  const frameInterval = 1000 / targetFPS;

  const animate = useCallback((timestamp: number) => {
    if (!enabledRef.current || !isRunning) return;

    const deltaTime = timestamp - lastTimeRef.current;

    // Throttle to target FPS
    if (deltaTime >= frameInterval) {
      lastTimeRef.current = timestamp;
      try {
        onFrameRef.current(deltaTime, timestamp);
      } catch (error) {
        console.warn('[usePreviewAnimation] Frame callback error:', error);
      }
    }

    frameIdRef.current = requestAnimationFrame(animate);
  }, [isRunning, frameInterval]);

  const start = useCallback(() => {
    if (!enabledRef.current || isRunning) return;
    lastTimeRef.current = performance.now();
    setIsRunning(true);
    frameIdRef.current = requestAnimationFrame(animate);
  }, [isRunning, animate]);

  const stop = useCallback(() => {
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    }
    setIsRunning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => stop();
  }, [stop]);

  // Auto-start/stop based on enabled
  useEffect(() => {
    if (enabled && !isRunning) {
      start();
    } else if (!enabled && isRunning) {
      stop();
    }
  }, [enabled, isRunning, start, stop]);

  return { isRunning, start, stop };
}

// ═══════════════════════════════════════════════════════
// EVENT SIMULATION HOOK
// ═══════════════════════════════════════════════════════

export interface UseEventSimulationOptions {
  /** Event source to send events to */
  eventSource?: any;
  /** Overlay ID for mock events */
  overlayId?: string;
  /** Interval between events */
  intervalMs?: number;
  /** Whether simulation is enabled */
  enabled?: boolean;
  /** Event types to simulate */
  eventTypes?: string[];
}

/**
 * Hook for simulating events in preview
 */
export function useEventSimulation(options: UseEventSimulationOptions = {}) {
  const { eventSource, overlayId, intervalMs = 2000, enabled = true, eventTypes } = options;
  const [isSimulating, setIsSimulating] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = useCallback(() => {
    if (isSimulating || !enabled) return;

    if (eventSource && eventSource.emit) {
      // Custom event source with emit method
      setIsSimulating(true);
      intervalRef.current = setInterval(() => {
        // Would emit custom events here
      }, intervalMs);
    } else if (overlayId) {
      // Use mock event system
      setIsSimulating(true);
      // Events are handled by PreviewProvider automatically
    }
  }, [eventSource, overlayId, intervalMs, enabled, isSimulating]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsSimulating(false);
  }, []);

  useEffect(() => {
    if (enabled) {
      start();
    } else {
      stop();
    }
    return stop;
  }, [enabled, start, stop]);

  return { isSimulating, start, stop };
}

// ═══════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════

export default {
  usePreviewContainer,
  useRendererProps,
  usePerformanceMonitor,
  usePreviewAnimation,
  useEventSimulation,
};