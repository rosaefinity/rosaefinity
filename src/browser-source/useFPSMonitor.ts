// ─────────────────────────────────────────────────────
// RosaeFinity Browser Source — FPS Monitor Hook
// v3.1 Architecture Spec (Frozen)
//
// Production: FPS is stored in a ref — zero React re-renders.
// Debug (?debug=true): performanceMode may flip rarely; FPS
// display is polled by DebugPanel from the ref.
// ─────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';

const LOW_FPS_THRESHOLD = 30;
const MEASUREMENT_INTERVAL_MS = 1000;

export interface UseFPSMonitorReturn {
  /** Latest FPS value; does not trigger re-renders. */
  fpsRef: { current: number };
  /** True only when sustained low FPS is detected (rare state change). */
  performanceMode: boolean;
}

/**
 * Tracks FPS without re-rendering the overlay tree every second.
 *
 * @param enabled - enable only for debug/diagnostics
 */
export function useFPSMonitor(enabled: boolean): UseFPSMonitorReturn {
  const [performanceMode, setPerformanceMode] = useState(false);
  const fpsRef = useRef(0);
  const performanceModeRef = useRef(false);

  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lowFpsCountRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      fpsRef.current = 0;
      performanceModeRef.current = false;
      setPerformanceMode(false);
      return;
    }

    lastTimeRef.current = performance.now();
    frameCountRef.current = 0;
    lowFpsCountRef.current = 0;

    const tick = (): void => {
      frameCountRef.current += 1;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    intervalRef.current = setInterval(() => {
      const now = performance.now();
      const elapsed = now - lastTimeRef.current;
      const currentFps = Math.round((frameCountRef.current / elapsed) * 1000);

      // Ref only — does NOT re-render BrowserSourceApp
      fpsRef.current = currentFps;
      frameCountRef.current = 0;
      lastTimeRef.current = now;

      let nextPerfMode = performanceModeRef.current;
      if (currentFps < LOW_FPS_THRESHOLD && currentFps > 0) {
        lowFpsCountRef.current += 1;
        if (lowFpsCountRef.current >= 3) {
          nextPerfMode = true;
        }
      } else {
        lowFpsCountRef.current = 0;
        if (currentFps >= LOW_FPS_THRESHOLD) {
          nextPerfMode = false;
        }
      }

      if (nextPerfMode !== performanceModeRef.current) {
        performanceModeRef.current = nextPerfMode;
        setPerformanceMode(nextPerfMode);
      }
    }, MEASUREMENT_INTERVAL_MS);

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled]);

  return { fpsRef, performanceMode };
}
