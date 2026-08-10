// =============================================
// RosaeFinity â€” Overlay Runtime Manager
// Centralized overlay lifecycle, scheduling,
// priority, queue, transitions, cleanup.
// =============================================

import type { OverlayInstance, OverlayEvent, OverlayQueueItem, OverlayPriority, OverlayStats } from './types.js';
import { getOverlayType } from './registry.js';
import { LayerRenderer } from './layer-renderer.js';
import { getBrowserSourceRuntime } from './browser-source-runtime.js';

const PRIORITY_MAP: Record<OverlayPriority, number> = {
  critical: 0,
  high: 1,
  normal: 5,
  low: 9,
};

interface RuntimeConfig {
  maxConcurrent: number;
  defaultDuration: number;
  transitionMs: number;
  autoCleanup: boolean;
}

const DEFAULT_CONFIG: RuntimeConfig = {
  maxConcurrent: 10,
  defaultDuration: 5000,
  transitionMs: 300,
  autoCleanup: true,
};

interface RuntimeCallbacks {
  onOverlayShow?: (overlay: OverlayInstance) => void;
  onOverlayHide?: (overlay: OverlayInstance) => void;
  onOverlayUpdate?: (overlay: OverlayInstance) => void;
}

export class OverlayRuntimeManager {
  private config: RuntimeConfig;
  private layerRenderer: LayerRenderer;
  private queue: OverlayQueueItem[] = [];
  private active = new Map<string, { overlay: OverlayInstance; timer: ReturnType<typeof setTimeout> | null }>();
  private callbacks: RuntimeCallbacks;
  private stats: OverlayStats = { activeCount: 0, queueSize: 0, totalRendered: 0, avgRenderTime: 0, memoryUsage: 0 };
  private renderTimes: number[] = [];

  constructor(config: Partial<RuntimeConfig> = {}, callbacks: RuntimeCallbacks = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.layerRenderer = new LayerRenderer();
    this.callbacks = callbacks;
  }

  /** Initialize the overlay runtime */
  initialize(): void {
    const browserRuntime = getBrowserSourceRuntime();
    browserRuntime.initialize();
  }

  /** Show an overlay from an event */
  showOverlay(event: OverlayEvent): OverlayInstance | null {
    const typeDef = getOverlayType(event.type);
    if (!typeDef) return null;

    // Create overlay instance
    const overlay: OverlayInstance = {
      id: `ov-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: event.type,
      name: typeDef.label,
      enabled: true,
      visible: true,
      zIndex: this.getNextZIndex(),
      position: { x: 0, y: 0, ...typeDef.defaultSize },
      rotation: 0,
      opacity: 1,
      scale: 1,
      locked: false,
      groupId: null,
      config: { ...typeDef.defaultConfig, ...event.config },
      animation: { ...typeDef.defaultAnimation },
      sceneId: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Apply variables to config
    this.applyVariables(overlay, event.variables);

    // Add to renderer
    this.layerRenderer.addOverlay(overlay);

    // Set auto-hide timer
    const duration = typeDef.maxDuration || this.config.defaultDuration;
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (duration > 0) {
      timer = setTimeout(() => {
        this.hideOverlay(overlay.id);
      }, duration);
    }

    this.active.set(overlay.id, { overlay, timer });
    this.stats.activeCount = this.active.size;
    this.stats.totalRendered++;

    // Broadcast to browser sources
    const browserRuntime = getBrowserSourceRuntime();
    browserRuntime.broadcast('overlay:show', {
      id: overlay.id,
      type: overlay.type,
      config: overlay.config,
      animation: overlay.animation,
    });

    this.callbacks.onOverlayShow?.(overlay);
    return overlay;
  }

  /** Hide an overlay */
  hideOverlay(overlayId: string): void {
    const entry = this.active.get(overlayId);
    if (!entry) return;

    if (entry.timer) clearTimeout(entry.timer);
    this.layerRenderer.removeOverlay(overlayId);
    this.active.delete(overlayId);
    this.stats.activeCount = this.active.size;

    // Broadcast hide
    const browserRuntime = getBrowserSourceRuntime();
    browserRuntime.broadcast('overlay:hide', { id: overlayId });

    this.callbacks.onOverlayHide?.(entry.overlay);
  }

  /** Hide all overlays */
  hideAll(): void {
    for (const [id] of this.active) {
      this.hideOverlay(id);
    }
  }

  /** Update overlay config */
  updateOverlay(overlayId: string, config: Record<string, unknown>): void {
    const entry = this.active.get(overlayId);
    if (entry) {
      entry.overlay.config = { ...entry.overlay.config, ...config };
      this.layerRenderer.updateOverlay(overlayId, { config: entry.overlay.config });
      this.callbacks.onOverlayUpdate?.(entry.overlay);

      // Broadcast update
      const browserRuntime = getBrowserSourceRuntime();
      browserRuntime.broadcast('overlay:update', { id: overlayId, config: entry.overlay.config });
    }
  }

  /** Get all active overlays */
  getActive(): OverlayInstance[] {
    return Array.from(this.active.values()).map(e => e.overlay);
  }

  /** Get layer renderer */
  getLayerRenderer(): LayerRenderer {
    return this.layerRenderer;
  }

  /** Get stats */
  getStats(): OverlayStats {
    const avgRenderTime = this.renderTimes.length > 0
      ? this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length
      : 0;
    return {
      ...this.stats,
      queueSize: this.queue.length,
      avgRenderTime,
    };
  }

  /** Cleanup */
  destroy(): void {
    this.hideAll();
    this.queue = [];
    this.layerRenderer = new LayerRenderer();
  }

  // â”€â”€ Private â”€â”€

  private applyVariables(overlay: OverlayInstance, variables: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(overlay.config)) {
      if (typeof value === 'string') {
        overlay.config[key] = value.replace(/\{\{(\w+)\}\}/g, (_, name) => {
          return String(variables[name] ?? `{${name}}`);
        });
      }
    }
  }

  private getNextZIndex(): number {
    return this.layerRenderer.getSortedOverlays().length + 100;
  }
}

// Singleton
let _manager: OverlayRuntimeManager | null = null;

export function getOverlayRuntimeManager(config?: Partial<RuntimeConfig>, callbacks?: RuntimeCallbacks): OverlayRuntimeManager {
  if (!_manager) _manager = new OverlayRuntimeManager(config, callbacks);
  return _manager;
}

export function resetOverlayRuntimeManager(): void {
  if (_manager) {
    _manager.destroy();
    _manager = null;
  }
}
