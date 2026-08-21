// ─────────────────────────────────────────────────────
// RosaeFinity Overlay System — Diagnostics
// v3.1 Architecture Spec (Frozen)
//
// Per-overlay and global diagnostic tracking.
// Lightweight — zero overhead when debug mode is off.
// ─────────────────────────────────────────────────────

export interface OverlayDiagnosticsData {
  instanceId: string;
  moduleId: string;
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  frameDrops: number;
  animationCount: number;
  mounted: boolean;
  visible: boolean;
  lastUpdateTime: number;
}

export interface GlobalDiagnosticsData {
  mountedOverlays: number;
  visibleOverlays: number;
  totalRenders: number;
  averageRenderTime: number;
  totalFrameDrops: number;
  totalAnimations: number;
}

// ─── Per-Overlay Tracker ───

const overlayDiagnostics = new Map<string, OverlayDiagnosticsData>();

export function initOverlayDiagnostics(instanceId: string, moduleId: string): void {
  overlayDiagnostics.set(instanceId, {
    instanceId,
    moduleId,
    renderCount: 0,
    lastRenderTime: 0,
    averageRenderTime: 0,
    frameDrops: 0,
    animationCount: 0,
    mounted: true,
    visible: true,
    lastUpdateTime: Date.now(),
  });
}

export function recordRender(instanceId: string, renderTimeMs: number): void {
  const data = overlayDiagnostics.get(instanceId);
  if (!data) return;

  data.renderCount++;
  data.lastRenderTime = renderTimeMs;
  data.averageRenderTime = (data.averageRenderTime * (data.renderCount - 1) + renderTimeMs) / data.renderCount;
  data.lastUpdateTime = Date.now();

  // Detect frame drops (>16.67ms for 60fps)
  if (renderTimeMs > 16.67) {
    data.frameDrops++;
  }
}

export function recordAnimation(instanceId: string): void {
  const data = overlayDiagnostics.get(instanceId);
  if (data) data.animationCount++;
}

export function setOverlayVisible(instanceId: string, visible: boolean): void {
  const data = overlayDiagnostics.get(instanceId);
  if (data) data.visible = visible;
}

export function destroyOverlayDiagnostics(instanceId: string): void {
  const data = overlayDiagnostics.get(instanceId);
  if (data) data.mounted = false;
  // Keep data for post-mortem analysis, remove after 30s
  setTimeout(() => overlayDiagnostics.delete(instanceId), 30000);
}

export function getOverlayDiagnostics(instanceId: string): OverlayDiagnosticsData | undefined {
  return overlayDiagnostics.get(instanceId);
}

// ─── Global Diagnostics ───

export function getGlobalDiagnostics(): GlobalDiagnosticsData {
  const all = Array.from(overlayDiagnostics.values());
  const mounted = all.filter(d => d.mounted);
  const totalRenders = mounted.reduce((sum, d) => sum + d.renderCount, 0);
  const totalTime = mounted.reduce((sum, d) => sum + d.averageRenderTime * d.renderCount, 0);

  return {
    mountedOverlays: mounted.length,
    visibleOverlays: mounted.filter(d => d.visible).length,
    totalRenders,
    averageRenderTime: totalRenders > 0 ? totalTime / totalRenders : 0,
    totalFrameDrops: mounted.reduce((sum, d) => sum + d.frameDrops, 0),
    totalAnimations: mounted.reduce((sum, d) => sum + d.animationCount, 0),
  };
}

export function getAllOverlayDiagnostics(): OverlayDiagnosticsData[] {
  return Array.from(overlayDiagnostics.values());
}
