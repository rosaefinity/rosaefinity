// ─────────────────────────────────────────────────────
// RosaeFinity Browser Source — Root Application
// v3.1 Architecture Spec (Frozen)
//
// ONE EventSource per Browser Source mount.
// Parent re-renders must not recreate SSE connections.
// ─────────────────────────────────────────────────────

import React, { useEffect, useState, useCallback, useMemo, useRef, Suspense } from 'react';
import type { AnyOverlayModule, BaseOverlayConfig, OverlayEvent, OverlayEventSource } from '../overlays/types';
import { loadModule } from '../overlays/registry';
import { getSSEBaseUrl } from '../lib/browser-source-url';
import { createOverlayConfig } from '../overlays/createConfig';
import { BrowserSourceContext, type BrowserSourceRuntimeContext } from './BrowserSourceContext';
import { useSSEConnection } from './useSSEConnection';
import { useFPSMonitor } from './useFPSMonitor';
import { DebugPanel } from './DebugPanel';
import { LoadingUI, ErrorUI, MissingOverlayUI } from './FallbackUI';
import { overlayDebugLog } from '../lib/overlay-debug';

// ─── URL Parameter + Global Injection Parsing ───

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

  const pathMatch = window.location.pathname.match(/^\/overlay\/([a-f0-9-]+)(?:\.html)?$/);
  const pathBrowserSourceId = pathMatch ? pathMatch[1] : null;
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
        overlayDebugLog('[OVERLAY-RUNTIME-DIAG] BrowserSourceApp loaded module:', overlayId, '→', mod.name);
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

function getDefaultConfig(mod: AnyOverlayModule): BaseOverlayConfig {
  return createOverlayConfig(mod);
}

interface DebugDiagnostics {
  lastEventTime: number;
  lastEventType: string;
  eventLatency: number;
}

const EMPTY_DIAGNOSTICS: DebugDiagnostics = {
  lastEventTime: 0,
  lastEventType: '',
  eventLatency: 0,
};

// ─── Main App ───

export function BrowserSourceApp(): React.ReactElement {
  const urlParams = useMemo(() => parseURLParams(), []);

  const [serverConfig, setServerConfig] = useState<{ moduleId: string; config: BaseOverlayConfig; instanceId?: string } | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  const effectiveOverlayId = urlParams.overlayId || serverConfig?.moduleId || null;
  const { module: overlayModule, loading: moduleLoading, error: moduleError } = useOverlayModule(effectiveOverlayId);

  // ── Config fetch (retries until moduleId available) ──
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
          if (!data.moduleId) {
            retryCount++;
            setTimeout(fetchConfig, RETRY_DELAY_MS);
            return;
          }
          setServerConfig({
            moduleId: data.moduleId,
            config: data.config || {},
            // Overlay instance identity (from main-process instance map) —
            // lets shared renderers (GoalProgressRenderer) filter SSE events
            // by goalId without any URL/?instance= changes.
            instanceId: data.instanceId,
          });
          // [GOAL-INSTANCE-MAP-FORENSIC] Temporary diagnostics — Task 1.
          // instanceId null ⇒ old main.cjs (config endpoint lacks it) ⇒
          // renderer filter stays inactive ⇒ SSE contamination.
          if (urlParams.debugMode) {
            const cfgAny = (data.config ?? {}) as any;
            console.log('[GOAL-INSTANCE-MAP-FORENSIC]', JSON.stringify({
              browserSourceId: urlParams.browserSourceId,
              instanceId: data.instanceId ?? null,
              moduleId: data.moduleId ?? null,
              configCurrent: cfgAny?.current ?? null,
              configTarget: cfgAny?.target ?? null,
              configGoalType: cfgAny?.goalType ?? null,
            }));
          }
          setConfigLoading(false);
        })
        .catch(() => {
          if (cancelled) return;
          retryCount++;
          setTimeout(fetchConfig, RETRY_DELAY_MS);
        });
    }

    fetchConfig();
    return () => { cancelled = true; };
  }, [urlParams.browserSourceId]);

  const [instanceConfig, setInstanceConfig] = useState<BaseOverlayConfig | null>(null);

  // ── Debug-only diagnostics (refs + state only when ?debug=true) ──
  const diagnosticsRef = useRef<DebugDiagnostics>(EMPTY_DIAGNOSTICS);
  const [debugDiagnostics, setDebugDiagnostics] = useState<DebugDiagnostics>(EMPTY_DIAGNOSTICS);

  const updateDebugDiagnostics = useCallback((event: OverlayEvent) => {
    if (!urlParams.debugMode) return;
    const now = Date.now();
    const latency = 'timestamp' in event && typeof event.timestamp === 'number'
      ? now - (event.timestamp as number)
      : 0;
    const next: DebugDiagnostics = {
      lastEventTime: now,
      lastEventType: event.type,
      eventLatency: latency,
    };
    diagnosticsRef.current = next;
    setDebugDiagnostics(next);
  }, [urlParams.debugMode]);

  // ── Stable renderer event bus (no second EventSource) ──
  // Renderers (CoinJar, GoalProgress, …) subscribe here.
  // Events fan out from the single useSSEConnection.
  const rendererSubscribersRef = useRef(new Set<(event: OverlayEvent) => void>());
  const rendererEventSource: OverlayEventSource = useMemo(() => ({
    subscribe: (callback: (event: OverlayEvent) => void) => {
      rendererSubscribersRef.current.add(callback);
      return () => {
        rendererSubscribersRef.current.delete(callback);
      };
    },
  }), []);

  const fetchOwnConfig = useCallback(() => {
    const browserSourceId = urlParams.browserSourceId;
    if (!browserSourceId) return;
    const configUrl = window.__ROSAEFINITY_CONFIG_URL__
      || `${getSSEBaseUrl()}/overlay/${browserSourceId}/config`;
    fetch(configUrl)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.moduleId) {
          setServerConfig({ moduleId: data.moduleId, config: data.config || {}, instanceId: data.instanceId });
        }
      })
      .catch(() => {});
  }, [urlParams.browserSourceId]);

  // ── Single SSE event handler ──
  // Fan-out to overlay subscribers always.
  // Config refetch ONLY when this browserSourceId changed.
  // Parent eventState updates ONLY in debug mode.
  const handleEvent = useCallback((event: OverlayEvent) => {
    for (const cb of rendererSubscribersRef.current) {
      try {
        cb(event);
      } catch (error) {
        console.error('[BrowserSource] renderer subscriber error:', error);
      }
    }

    const data = event as unknown as Record<string, unknown>;
    if (data?.type === 'overlay-config-changed' && urlParams.browserSourceId) {
      const changedBrowserSourceId = data.browserSourceId as string;
      if (changedBrowserSourceId === urlParams.browserSourceId) {
        fetchOwnConfig();
      }
      // Unrelated overlay config changes: ignore — do not re-render this source
      return;
    }

    if (urlParams.debugMode) {
      updateDebugDiagnostics(event);
    }
  }, [urlParams.browserSourceId, urlParams.debugMode, fetchOwnConfig, updateDebugDiagnostics]);

  // ── ONE EventSource per Browser Source identity ──
  const sseInstanceId = urlParams.instanceId || urlParams.browserSourceId;
  const sse = useSSEConnection(sseInstanceId, handleEvent, urlParams.debugMode);

  // ── FPS: ref in production; rare performanceMode flips only ──
  const { fpsRef, performanceMode } = useFPSMonitor(urlParams.debugMode);

  // ── Config merge ──
  useEffect(() => {
    if (!overlayModule) return;

    if (serverConfig?.config && Object.keys(serverConfig.config).length > 0) {
      const defaults = getDefaultConfig(overlayModule);
      setInstanceConfig({ ...defaults, ...serverConfig.config } as BaseOverlayConfig);
    } else if (!instanceConfig) {
      setInstanceConfig(getDefaultConfig(overlayModule));
    }
  }, [overlayModule, serverConfig, instanceConfig]);

  // ── Render timing: debug only ──
  const [renderTime, setRenderTime] = useState(0);
  useEffect(() => {
    if (!urlParams.debugMode) return;
    const start = performance.now();
    const frame = requestAnimationFrame(() => {
      setRenderTime(performance.now() - start);
    });
    return () => cancelAnimationFrame(frame);
  });

  // ── Runtime context ──
  // Production path stays stable: only connectionStatus/reconnectCount may change.
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
    lastEventTime: urlParams.debugMode ? debugDiagnostics.lastEventTime : 0,
    lastEventType: urlParams.debugMode ? debugDiagnostics.lastEventType : '',
    fps: urlParams.debugMode ? fpsRef.current : 0,
    fpsRef,
    renderTime: urlParams.debugMode ? renderTime : 0,
    eventLatency: urlParams.debugMode ? debugDiagnostics.eventLatency : 0,
    performanceMode: urlParams.debugMode ? performanceMode : false,
    runtimeVersion: '1.0.0',
  }), [
    urlParams,
    sse.connectionStatus,
    sse.reconnectCount,
    debugDiagnostics,
    fpsRef,
    renderTime,
    performanceMode,
  ]);

  if (moduleLoading || configLoading) {
    return (
      <BrowserSourceContext.Provider value={contextValue}>
        <LoadingUI />
      </BrowserSourceContext.Provider>
    );
  }

  if (configError && !overlayModule) {
    return (
      <BrowserSourceContext.Provider value={contextValue}>
        <ErrorUI message={configError} />
        {urlParams.debugMode && <DebugPanel />}
      </BrowserSourceContext.Provider>
    );
  }

  if (moduleError || !overlayModule) {
    return (
      <BrowserSourceContext.Provider value={contextValue}>
        <MissingOverlayUI overlayId={effectiveOverlayId ?? 'unknown'} />
        {urlParams.debugMode && <DebugPanel />}
      </BrowserSourceContext.Provider>
    );
  }

  if (!instanceConfig) {
    return (
      <BrowserSourceContext.Provider value={contextValue}>
        <LoadingUI />
      </BrowserSourceContext.Provider>
    );
  }

  const Renderer = overlayModule.renderer;

  // Instance identity for shared per-instance renderers (GoalProgressRenderer).
  // Resolution order: explicit ?instance= param (optional, unchanged) →
  // overlay instance id from the existing /overlay/{bsid}/config fetch.
  // URLs stay `/overlay/{browserSourceId}` — no URL architecture change.
  const rendererInstanceId = urlParams.instanceId ?? serverConfig?.instanceId ?? null;

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
              instanceId={rendererInstanceId}
            />
          </Suspense>
        </OverlayErrorBoundary>
      </div>
      {urlParams.debugMode && <DebugPanel />}
    </BrowserSourceContext.Provider>
  );
}
