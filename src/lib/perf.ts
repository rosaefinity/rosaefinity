// =============================================
// RosaeFinity — Performance Utilities
// Throttle, debounce, RAF batching, memo helpers.
// =============================================

/** Throttle: at most once per `ms` */
export function throttle<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (timer) { clearTimeout(timer); timer = null; }
      last = now;
      fn(...args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn(...args);
      }, remaining);
    }
  }) as T;
}

/** Debounce: wait `ms` after last call */
export function debounce<T extends (...args: any[]) => any>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return ((...args: any[]) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, ms);
  }) as T;
}

/** RAF batch: batch multiple calls into single animation frame */
export function rafBatch(fn: () => void): () => void {
  let scheduled = false;
  return () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      fn();
    });
  };
}

/** Batch updates: collect calls and flush periodically */
export function batchUpdates(intervalMs = 16): { push: (item: any) => void; flush: () => any[]; onFlush: (cb: (items: any[]) => void) => void } {
  let buffer: any[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let flushCallback: ((items: any[]) => void) | null = null;

  return {
    push(item: any) {
      buffer.push(item);
      if (!timer) {
        timer = setTimeout(() => {
          const items = buffer;
          buffer = [];
          timer = null;
          flushCallback?.(items);
        }, intervalMs);
      }
    },
    flush() {
      const items = buffer;
      buffer = [];
      if (timer) { clearTimeout(timer); timer = null; }
      return items;
    },
    onFlush(cb) { flushCallback = cb; },
  };
}

/** Memory-safe memo: caches last N results */
export function memoize<T extends (...args: any[]) => any>(fn: T, maxSize = 10): T {
  const cache = new Map<string, { result: any; timestamp: number }>();
  const TTL = 60000; // 1 minute

  return ((...args: any[]) => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    if (cached && Date.now() - cached.timestamp < TTL) {
      return cached.result;
    }
    const result = fn(...args);
    cache.set(key, { result, timestamp: Date.now() });
    // Evict oldest if over size
    if (cache.size > maxSize) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    return result;
  }) as T;
}

/** Performance measurement */
export function measure(name: string): { end: () => number } {
  const start = performance.now();
  return {
    end: () => {
      const duration = performance.now() - start;
      if (duration > 16) { // Log slow operations
        console.warn(`[Perf] ${name}: ${duration.toFixed(1)}ms`);
      }
      return duration;
    },
  };
}

/** FPS counter */
export class FPSCounter {
  private frames: number[] = [];
  private rafId: number | null = null;
  private currentFPS = 0;

  start(): void {
    const loop = () => {
      const now = performance.now();
      this.frames.push(now);
      // Keep last 60 frames
      while (this.frames.length > 60) this.frames.shift();
      // Calculate FPS
      if (this.frames.length > 1) {
        const elapsed = this.frames[this.frames.length - 1] - this.frames[0];
        this.currentFPS = Math.round(((this.frames.length - 1) / elapsed) * 1000);
      }
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop(): void {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }

  getFPS(): number { return this.currentFPS; }
}

/** Event throughput tracker */
export class ThroughputTracker {
  private events: number[] = [];
  private windowMs = 1000;

  record(): void {
    this.events.push(Date.now());
    const cutoff = Date.now() - this.windowMs;
    this.events = this.events.filter(t => t > cutoff);
  }

  getPerSecond(): number {
    const cutoff = Date.now() - this.windowMs;
    return this.events.filter(t => t > cutoff).length;
  }

  getPerMinute(): number {
    return this.getPerSecond() * 60;
  }

  reset(): void {
    this.events = [];
  }
}
