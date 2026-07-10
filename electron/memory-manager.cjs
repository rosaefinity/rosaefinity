// =============================================
// RosaeFinity — Memory & Resource Manager (Phase 2)
// Tracks intervals, timeouts, IPC listeners, disposables
// Monitors memory usage, prevents leaks
// =============================================

const { ipcMain } = require("electron");

class MemoryManager {
  constructor(logger) {
    this.logger = logger;
    this.intervals = new Map();
    this.timeouts = new Map();
    this.ipcListeners = new Map();
    this.disposables = new Map();
    this.monitorInterval = null;

    // Thresholds
    this.HEAP_THRESHOLD = 500 * 1024 * 1024;   // 500MB
    this.EXTERNAL_THRESHOLD = 200 * 1024 * 1024; // 200MB
  }

  // ── Interval tracking ──
  safeSetInterval(name, fn, ms) {
    if (this.intervals.has(name)) {
      clearInterval(this.intervals.get(name));
      this.logger.debug(`Cleared duplicate interval: ${name}`);
    }
    const id = setInterval(fn, ms);
    this.intervals.set(name, id);
    return id;
  }

  clearInterval(name) {
    if (this.intervals.has(name)) {
      clearInterval(this.intervals.get(name));
      this.intervals.delete(name);
    }
  }

  // ── Timeout tracking ──
  safeSetTimeout(name, fn, ms) {
    if (this.timeouts.has(name)) {
      clearTimeout(this.timeouts.get(name));
    }
    const id = setTimeout(() => {
      this.timeouts.delete(name);
      fn();
    }, ms);
    this.timeouts.set(name, id);
    return id;
  }

  clearTimeout(name) {
    if (this.timeouts.has(name)) {
      clearTimeout(this.timeouts.get(name));
      this.timeouts.delete(name);
    }
  }

  // ── IPC listener tracking (dedup) ──
  safeIpcOn(channel, handler) {
    if (this.ipcListeners.has(channel)) {
      ipcMain.removeListener(channel, this.ipcListeners.get(channel));
      this.logger.debug(`Removed duplicate IPC listener: ${channel}`);
    }
    this.ipcListeners.set(channel, handler);
    ipcMain.on(channel, handler);
  }

  safeIpcHandle(channel, handler) {
    // Remove existing handler if any
    try {
      ipcMain.removeHandler(channel);
    } catch (_) {}
    ipcMain.handle(channel, handler);
  }

  // ── Disposable resource tracking ──
  registerDisposable(name, disposeFn) {
    this.disposables.set(name, disposeFn);
  }

  async dispose(name) {
    if (this.disposables.has(name)) {
      try {
        await this.disposables.get(name)();
        this.disposables.delete(name);
        this.logger.debug(`Disposed resource: ${name}`);
      } catch (err) {
        this.logger.error(`Failed to dispose resource: ${name}`, { error: err.message });
      }
    }
  }

  // ── Memory monitoring ──
  startMonitor() {
    this.monitorInterval = setInterval(() => {
      try {
        const mem = process.memoryUsage();
        const heapMB = mem.heapUsed / 1024 / 1024;
        const externalMB = mem.external / 1024 / 1024;

        if (mem.heapUsed > this.HEAP_THRESHOLD) {
          this.logger.warning("Heap memory threshold exceeded", {
            heapMB: heapMB.toFixed(1),
            thresholdMB: (this.HEAP_THRESHOLD / 1024 / 1024).toFixed(0),
          });
          if (global.gc) {
            global.gc();
            this.logger.debug("Forced garbage collection");
          }
        }

        if (mem.external > this.EXTERNAL_THRESHOLD) {
          this.logger.warning("External memory threshold exceeded", {
            externalMB: externalMB.toFixed(1),
            thresholdMB: (this.EXTERNAL_THRESHOLD / 1024 / 1024).toFixed(0),
          });
        }
      } catch (_) {}
    }, 30000); // Check every 30 seconds
  }

  stopMonitor() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
  }

  // ── Stats ──
  getStats() {
    try {
      const mem = process.memoryUsage();
      return {
        heapUsed: (mem.heapUsed / 1024 / 1024).toFixed(1) + "MB",
        heapTotal: (mem.heapTotal / 1024 / 1024).toFixed(1) + "MB",
        external: (mem.external / 1024 / 1024).toFixed(1) + "MB",
        rss: (mem.rss / 1024 / 1024).toFixed(1) + "MB",
        activeIntervals: this.intervals.size,
        activeTimeouts: this.timeouts.size,
        activeIpcListeners: this.ipcListeners.size,
        activeDisposables: this.disposables.size,
      };
    } catch (_) {
      return { error: "Failed to get memory stats" };
    }
  }

  // ── Full cleanup ──
  async cleanupAll() {
    this.logger.info("Cleaning up all resources");

    // Clear intervals
    this.intervals.forEach((id) => clearInterval(id));
    this.intervals.clear();

    // Clear timeouts
    this.timeouts.forEach((id) => clearTimeout(id));
    this.timeouts.clear();

    // Remove IPC listeners
    this.ipcListeners.forEach((handler, channel) => {
      try {
        ipcMain.removeListener(channel, handler);
      } catch (_) {}
    });
    this.ipcListeners.clear();

    // Dispose resources
    for (const [name] of this.disposables) {
      await this.dispose(name);
    }
    this.disposables.clear();

    // Stop monitor
    this.stopMonitor();

    this.logger.info("All resources cleaned up");
  }
}

module.exports = { MemoryManager };
