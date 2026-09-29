// ─────────────────────────────────────────────────────
// RosaeFinity Browser Source — Root Application
// v3.1 Architecture Spec (Frozen)
//
// This is the root React component for ALL browser sources.
// It reads URL params, loads the overlay module, connects
// to SSE, and renders the overlay component.
// ─────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react';
import type { AnyOverlayModule, BaseOverlayConfig, OverlayEvent, OverlayEventSource } from '../overlays/types';
import { loadModule } from '../overlays/registry';
import { BrowserEventSource } from './EventSource';
import { getSSEBaseUrl } from '../lib/browser-source-url';
import { createOverlayConfig } from '../overlays/createConfig';
import { BrowserSourceContext, type BrowserSourceRuntimeContext, type ConnectionStatus } from './BrowserSourceContext';
import { useSSEConnection } from './useSSEConnection';
import { useFPSMonitor } from './useFPSMonitor';
import { DebugPanel } from './DebugPanel';
import { LoadingUI, ErrorUI, MissingOverlayUI, ConnectionStatusUI, StatusDot } from './FallbackUI';

// ─── URL Parameter + Global Injection Parsing ───
// Browser sources are loaded via /overlay/<browserSourceId> which injects
// globals via script tags. We read those first, then fall back to URL params.

interface URLParams {
  overlayId: string | null;
  instanceId: string | null;
  browserSourceId: string | null;
  screenId: string | null;
  sceneId: string | null;
  previewMode: boolean;
  theme: 'dark' | 'light' | 'auto';
  debugMode: boolean;
}

declare global {
  interface Window {
    __ROSAEFINITY_BROWSER_SOURCE_ID__?: string;
    __ROSAEFINITY_SSE_URL__?: string;
    __ROSAEFINITY_CONFIG_URL__?: string;
  }
}

function parseURLParams(): URLParams {
  const params = new URLSearchParams(window.location.search);

  // PRIMARY: Extract from URL pathname (process-isolated, never overwritten by other pages)
  const pathMatch = window.location.pathname.match(/^\/overlay\/([a-f0-9-]+)(?:\.html)?$/);
  const pathBrowserSourceId = pathMatch ? pathMatch[1] : null;

  // FALLBACK: window global injected by server (vulnerable to overwrite in shared browsing contexts)
  const injectedBrowserSourceId = window.__ROSAEFINITY_BROWSER_SOURCE_ID__ || null;

  return {
    overlayId: params.get('overlay'),
    instanceId: params.get('instance') ?? params.get('instanceId'),
    browserSourceId: pathBrowserSourceId ?? injectedBrowserSourceId ?? params.get('browserSourceId'),
    screenId: params.get('screen'),
    sceneId: params.get('scene'),
    previewMode: params.get('preview') === 'true',
    theme: (params.get('theme') as 'dark' | 'light' | 'auto') || 'dark',
    debugMode: params.get('debug') === 'true',
  };
}

// ─── Overlay Error Boundary ───

interface OverlayErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class OverlayErrorBoundary extends React.Component<
  { children: React.ReactNode; overlayId: string },
  OverlayErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; overlayId: string }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): OverlayErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error(`[BrowserSource] Overlay "${this.props.overlayId}" crashed:`, error, errorInfo);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return <ErrorUI message={this.state.error?.message ?? 'Unknown rendering error'} />;
    }
    return this.props.children;
  }
}

// ─── Loading Overlay Module ───

interface UseOverlayModuleResult {
  module: AnyOverlayModule | null;
  loading: boolean;
  error: string | null;
}

function useOverlayModule(overlayId: string | null): UseOverlayModuleResult {
  const [state, setState] = useState<UseOverlayModuleResult>({
    module: null,
    loading: overlayId !== null,
    error: null,
  });

  useEffect(() => {
    if (!overlayId) {
      setState({ module: null, loading: false, error: null });
      return;
    }

    let cancelled = false;

    loadModule(overlayId).then(mod => {
      if (cancelled) return;
      if (mod) {
        console.log('[OVERLAY-RUNTIME-DIAG] BrowserSourceApp loaded module:', overlayId, '→', mod.name);
        setState({ module: mod, loading: false, error: null });
      } else {
        console.error('[OVERLAY-RUNTIME-DIAG] BrowserSourceApp FAILED to load module:', overlayId, '→ NOT FOUND');
        setState({ module: null, loading: false, error: `Overlay "${overlayId}" not found` });
      }
    }).catch(err => {
      if (cancelled) return;
      console.error('[OVERLAY-RUNTIME-DIAG] BrowserSourceApp module load ERROR:', overlayId, err);
      setState({ module: null, loading: false, error: err instanceof Error ? err.message : 'Failed to load overlay' });
    });

    return () => { cancelled = true; };
  }, [overlayId]);

  return state;
}

// ─── Fallback Instance Config ───

function getDefaultConfig(mod: AnyOverlayModule): BaseOverlayConfig {
  return createOverlayConfig(mod);
}

// ─── Main App ───

export function BrowserSourceApp(): React.ReactElement {
  // ── Parse URL params (stable, never changes) ──
  const urlParams = useMemo(() => parseURLParams(), []);

  // ── Config from SSE server (when loaded via /overlay/<browserSourceId>) ──
  const [serverConfig, setServerConfig] = useState<{ moduleId: string; config: BaseOverlayConfig } | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Determine the effective overlay ID: URL param > server config moduleId > null
  const effectiveOverlayId = urlParams.overlayId || serverConfig?.moduleId || null;

  // ── Load overlay module ──
  const { module: overlayModule, loading: moduleLoading, error: moduleError } = useOverlayModule(effectiveOverlayId);

  // ── Fetch config from SSE server when browserSourceId is present ──
  // Retry until moduleId is found (cache may be empty on app startup)
  useEffect(() => {
    if (!urlParams.browserSourceId) return;

    let cancelled = false;
    let retryCount = 0;
    const MAX_RETRIES = 15;
    const RETRY_DELAY_MS = 1000;

    const configUrl = window.__ROSAEFINITY_CONFIG_URL__
      || `${getSSEBaseUrl()}/overlay/${urlParams.browserSourceId}/config`;

    setConfigLoading(true);

    function fetchConfig() {
      if (cancelled || retryCount >= MAX_RETRIES) {
        if (!cancelled) {
          setConfigError('Config not available after maximum retries');
          setConfigLoading(false);
        }
        return;
      }

      fetch(configUrl)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (cancelled) return;

          // If moduleId is null, the cache hasn't been populated yet — retry
          if (!data.moduleId) {
            retryCount++;
            setTimeout(fetchConfig, RETRY_DELAY_MS);
            return;
          }

          setServerConfig({
            moduleId: data.moduleId,
            config: data.config || {},
          });
          setConfigLoading(false);
        })
        .catch(err => {
          if (cancelled) return;
          retryCount++;
          setTimeout(fetchConfig, RETRY_DELAY_MS);
        });
    }

    fetchConfig();

    return () => { cancelled = true; };
  }, [urlParams.browserSourceId]);

  // ── State ──
  const [instanceConfig, setInstanceConfig] = useState<BaseOverlayConfig | null>(null);
  const [renderTime, setRenderTime] = useState(0);

  // ── Event handling ──
  const lastEventRef = useRef<OverlayEvent | null>(null);
  const [eventState, setEventState] = useState<{ lastEventTime: number; lastEventType: string; eventLatency: number }>({
    lastEventTime: 0,
    lastEventType: '',
    eventLatency: 0,
  });

  const handleEvent = useCallback((event: OverlayEvent) => {
    lastEventRef.current = event;
    const now = Date.now();
    const latency = 'timestamp' in event && typeof event.timestamp === 'number' ? now - event.timestamp : 0;
    setEventState({ lastEventTime: now, lastEventType: event.type, eventLatency: latency });

    // Handle overlay config change notification — re-fetch /config
    const data = event as unknown as Record<string, unknown>;
    if (data?.type === 'overlay-config-changed' && urlParams.browserSourceId) {
      const changedBrowserSourceId = data.browserSourceId as string;
      if (changedBrowserSourceId === urlParams.browserSourceId) {
        const configUrl = window.__ROSAEFINITY_CONFIG_URL__
          || `${getSSEBaseUrl()}/overlay/${urlParams.browserSourceId}/config`;
        fetch(configUrl)
          .then(res => res.ok ? res.json() : null)
          .then(data => {
            if (data?.moduleId) {
              setServerConfig({ moduleId: data.moduleId, config: data.config || {} });
            }
          })
          .catch(() => {});
      }
    }
  }, [urlParams.browserSourceId]);

  // ── SSE connection (use browserSourceId or instanceId) ──
  const sseInstanceId = urlParams.instanceId || urlParams.browserSourceId;
  const sse = useSSEConnection(sseInstanceId, handleEvent);

  // ── Event source for renderer (OverlayEventSource interface) ──
  const eventSourceRef = useRef<BrowserEventSource | null>(null);
  const rendererEventSource: OverlayEventSource = useMemo(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.destroy();
    }
    const eventSourceId = urlParams.instanceId || urlParams.browserSourceId;
    if (eventSourceId) {
      eventSourceRef.current = new BrowserEventSource(eventSourceId, getSSEBaseUrl());
      return eventSourceRef.current;
    }
    // Fallback: no-op event source — NO events will be received
    return { subscribe: () => () => {} };
  }, [urlParams.instanceId]);

  // ── FPS monitor ──
  const { fps, performanceMode } = useFPSMonitor(true);

  // ── Cleanup event source on unmount ──
  useEffect(() => {
    return () => {
      eventSourceRef.current?.destroy();
    };
  }, []);

  // ── Set config: prefer server config, fall back to module defaults ──
  useEffect(() => {
    if (!overlayModule) return;

    if (serverConfig?.config && Object.keys(serverConfig.config).length > 0) {
      // Merge server config with module defaults to fill missing fields
      const defaults = getDefaultConfig(overlayModule);
      setInstanceConfig({ ...defaults, ...serverConfig.config } as BaseOverlayConfig);
    } else if (!instanceConfig) {
      setInstanceConfig(getDefaultConfig(overlayModule));
    }
  }, [overlayModule, serverConfig, instanceConfig]);

  // ── Render timing ──
  useEffect(() => {
    const start = performance.now();
    requestAnimationFrame(() => {
      setRenderTime(performance.now() - start);
    });
  });

  // ── Runtime context ──
  const contextValue: BrowserSourceRuntimeContext = useMemo(() => ({
    overlayId: urlParams.overlayId,
    instanceId: urlParams.instanceId,
    screenId: urlParams.screenId,
    previewMode: urlParams.previewMode,
    browserSourceMode: true,
    debugMode: urlParams.debugMode,
    theme: urlParams.theme,
    connectionStatus: sse.connectionStatus,
    reconnectCount: sse.reconnectCount,
    lastEventTime: eventState.lastEventTime,
    lastEventType: eventState.lastEventType,
    fps,
    renderTime,
    eventLatency: eventState.eventLatency,
    performanceMode,
    runtimeVersion: '1.0.0',
  }), [
    urlParams, sse.connectionStatus, sse.reconnectCount,
    eventState, fps, renderTime, performanceMode,
  ]);

  // ── Loading state ──
  if (moduleLoading || configLoading) {
    return (
      <BrowserSourceContext.Provider value={contextValue}>
        <LoadingUI />
      </BrowserSourceContext.Provider>
    );
  }

  // ── Error: config fetch failed ──
  if (configError && !overlayModule) {
    return (
      <BrowserSourceContext.Provider value={contextValue}>
        <ErrorUI message={configError} />
        {urlParams.debugMode && <DebugPanel />}
      </BrowserSourceContext.Provider>
    );
  }

  // ── Error: module not found ──
  if (moduleError || !overlayModule) {
    return (
      <BrowserSourceContext.Provider value={contextValue}>
        <MissingOverlayUI overlayId={effectiveOverlayId ?? 'unknown'} />
        {urlParams.debugMode && <DebugPanel />}
      </BrowserSourceContext.Provider>
    );
  }

  // ── Error: no config ──
  if (!instanceConfig) {
    return (
      <BrowserSourceContext.Provider value={contextValue}>
        <LoadingUI />
      </BrowserSourceContext.Provider>
    );
  }

  // ── Render overlay ──
  const Renderer = overlayModule.renderer;

  return (
    <BrowserSourceContext.Provider value={contextValue}>
      <div
        style={{
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          background: 'transparent',
        }}
      >
        <OverlayErrorBoundary overlayId={urlParams.overlayId ?? 'unknown'}>
          <Suspense fallback={<LoadingUI />}>
            <Renderer
              config={instanceConfig}
              mode="browser-source"
              events={rendererEventSource}
              instanceId={urlParams.instanceId}
            />
          </Suspense>
        </OverlayErrorBoundary>
      </div>

      {/* Debug panel (only when ?debug=true) */}
      {urlParams.debugMode && <DebugPanel />}
    </BrowserSourceContext.Provider>
  );
}
