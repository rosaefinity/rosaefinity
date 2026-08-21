// ─────────────────────────────────────────────────────
// RosaeFinity Browser Source — FPS Monitor Hook
// v3.1 Architecture Spec (Frozen)
// ─────────────────────────────────────────────────────

import { useEffect, useRef, useState, useCallback } from 'react';

const LOW_FPS_THRESHOLD = 30;
const MEASUREMENT_INTERVAL_MS = 1000;

/**
 * FPS monitor hook for browser source overlays.
 * Tracks frames per second and triggers performance mode when FPS drops.
 *
 * @param enabled - Whether to track FPS (disable in production for zero overhead)
 * @param onLowPerformance - Callback when FPS drops below threshold
 */
export function useFPSMonitor(
  enabled: boolean = true,
  onLowPerformance?: () => void,
): { fps: number; performanceMode: boolean } {
  const [fps, setFps] = useState(0);
  const [performanceMode, setPerformanceMode] = useState(false);

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const rafRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onLowPerformanceRef = useRef(onLowPerformance);
  const lowFpsCountRef = useRef(0);

  onLowPerformanceRef.current = onLowPerformance;

  const tick = useCallback(() => {
    frameCountRef.current += 1;
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setFps(0);
      setPerformanceMode(false);
      return;
    }

    lastTimeRef.current = performance.now();
    frameCountRef.current = 0;
    lowFpsCountRef.current = 0;

    // Start frame counting
    rafRef.current = requestAnimationFrame(tick);

    // Measure FPS every second
    intervalRef.current = setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;
      const currentFps = Math.round((frameCountRef.current / elapsed) * 1000);

      setFps(currentFps);
      frameCountRef.current = 0;
      lastTimeRef.current = now;

      // Track consecutive low FPS
      if (currentFps < LOW_FPS_THRESHOLD && currentFps > 0) {
        lowFpsCountRef.current += 1;
        if (lowFpsCountRef.current >= 3 && !performanceMode) {
          setPerformanceMode(true);
          onLowPerformanceRef.current?.();
        }
      } else {
        lowFpsCountRef.current = 0;
        // Recover from performance mode after 5 seconds of good FPS
        if (performanceMode && currentFps >= LOW_FPS_THRESHOLD) {
          setPerformanceMode(false);
        }
      }
    }, MEASUREMENT_INTERVAL_MS);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, tick, performanceMode]);

  return { fps, performanceMode };
}
