// ─────────────────────────────────────────────────────
// RosaeFinity Browser Source — Runtime Context
// v3.1 Architecture Spec (Frozen)
// ─────────────────────────────────────────────────────

import { createContext, useContext } from 'react';

// ─── Connection State ───

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

// ─── Browser Source Runtime Context ───

export interface BrowserSourceRuntimeContext {
  // ── Identity ──
  overlayId: string | null;
  instanceId: string | null;
  screenId: string | null;

  // ── Mode ──
  previewMode: boolean;
  browserSourceMode: boolean;
  debugMode: boolean;

  // ── Theme ──
  theme: 'dark' | 'light' | 'auto';

  // ── Connection ──
  connectionStatus: ConnectionStatus;
  reconnectCount: number;
  lastEventTime: number;
  lastEventType: string;

  // ── Performance ──
  fps: number;
  renderTime: number;
  eventLatency: number;
  performanceMode: boolean;

  // ── Runtime ──
  runtimeVersion: string;
}

// ─── Default Context ───

const DEFAULT_CONTEXT: BrowserSourceRuntimeContext = {
  overlayId: null,
  instanceId: null,
  screenId: null,
  previewMode: false,
  browserSourceMode: true,
  debugMode: false,
  theme: 'dark',
  connectionStatus: 'connecting',
  reconnectCount: 0,
  lastEventTime: 0,
  lastEventType: '',
  fps: 0,
  renderTime: 0,
  eventLatency: 0,
  performanceMode: false,
  runtimeVersion: '1.0.0',
};

export const BrowserSourceContext = createContext<BrowserSourceRuntimeContext>(DEFAULT_CONTEXT);

/**
 * Hook to access the Browser Source runtime context.
 * Must be used within a BrowserSourceApp.
 */
export function useBrowserSourceContext(): BrowserSourceRuntimeContext {
  return useContext(BrowserSourceContext);
}
