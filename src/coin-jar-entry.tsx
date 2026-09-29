// ─────────────────────────────────────────────────────
// RosaeFinity — Coin Jar Browser Source Entry
// Standalone React entry for the Coin Jar overlay.
// Connects to the existing SSE server and renders
// the CoinJarProRenderer with real gift events.
// ─────────────────────────────────────────────────────

import React from 'react';
import { createRoot } from 'react-dom/client';
import { CoinJarProRenderer } from './overlays/coin-jar-pro/CoinJarProRenderer';
import type { CoinJarProConfig } from './overlays/coin-jar-pro/types';
import { defaultCoinJarProConfig } from './overlays/coin-jar-pro/types';
import type { OverlayEvent, OverlayEventSource } from './overlays/types';
import { getSSEBaseUrl } from './lib/browser-source-url';

// ─── URL params ───────────────────────────────────────

const params = new URLSearchParams(window.location.search);
const debugMode = params.get('debug') === '1';
const requestedScreen = params.get('screen') || '';

// ─── SSE → OverlayEventSource adapter ─────────────────

function createSSEEventSource(screen: string): OverlayEventSource {
  const subscribers = new Set<(event: OverlayEvent) => void>();
  let es: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryCount = 0;
  const MAX_RETRIES = 50;

  function connect() {
    const baseUrl = getSSEBaseUrl();
    const url = `${baseUrl}/events?screen=${encodeURIComponent(screen)}`;
    es = new EventSource(url);

    es.onopen = () => {
      retryCount = 0;
    };

    es.onmessage = (e) => {
      // Skip empty heartbeat messages
      if (!e.data || e.data.trim() === '') {
        return;
      }
      try {
        const data = JSON.parse(e.data);

        // Handle different event types properly:
        // - 'gift' events pass through directly for falling gift animation
        // - 'coin-jar-state' / 'coin-jar-gift' are wrapped as 'custom' for state hydration
        // - other types wrap as 'custom'
        let event: OverlayEvent;
        if (data.type === 'gift') {
          // Standard gift event - pass through for falling animation
          event = data as OverlayEvent;
        } else if (data.type === 'coin-jar-state' || data.type === 'coin-jar-gift') {
          // State hydration events
          event = {
            type: 'custom',
            data: data as Record<string, unknown>,
          };
        } else {
          // Other events wrap as custom
          event = {
            type: 'custom',
            data: data as Record<string, unknown>,
          };
        }

        subscribers.forEach((cb) => {
          try { cb(event); } catch (err) { /* subscriber error — silently ignore */ }
        });
      } catch (err) {
        // Parse error — silently ignore
      }
    };

    es.onerror = () => {
      es?.close();
      es = null;
      if (retryCount < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 30000);
        retryCount++;
        retryTimer = setTimeout(connect, delay);
      }
    };
  }

  connect();

  return {
    subscribe: (callback: (event: OverlayEvent) => void) => {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
        if (subscribers.size === 0) {
          es?.close();
          es = null;
          if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
        }
      };
    },
  };
}

// ─── Load persisted state from localStorage ───────────

function loadPersistedState(): { config: CoinJarProConfig; currentAmount: number } {
  try {
    const raw = localStorage.getItem('rf-coin-jar');
    if (raw) {
      const parsed = JSON.parse(raw);
      const state = parsed?.state;
      if (state?.config && typeof state.config.goalCoins === 'number') {
        return {
          config: { ...defaultCoinJarProConfig, ...state.config },
          currentAmount: state.currentAmount || 0,
        };
      }
    }
  } catch { /* fall through to defaults */ }
  return { config: { ...defaultCoinJarProConfig }, currentAmount: 0 };
}

// ─── Responsive viewport hook ──────────────────────────
// Uses ResizeObserver to track the actual browser source viewport size.
// TikTok LIVE Studio can embed this at any size — the renderer adapts.

function useViewportSize(): { width: number; height: number } {
  const [size, setSize] = React.useState<{ width: number; height: number }>(() => ({
    width: window.innerWidth || 400,
    height: window.innerHeight || 500,
  }));

  React.useEffect(() => {
    const onResize = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };

    // ResizeObserver on body for precise tracking
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(onResize);
      ro.observe(document.body);
      // Also listen to window resize as fallback (covers iframe resizes)
      window.addEventListener('resize', onResize);
      return () => {
        ro.disconnect();
        window.removeEventListener('resize', onResize);
      };
    }
    // Fallback: window resize only
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return size;
}

// ─── App ──────────────────────────────────────────────

const CoinJarApp: React.FC = () => {
  const persisted = React.useMemo(() => loadPersistedState(), []);
  const eventSource = React.useMemo(() => createSSEEventSource(requestedScreen), [requestedScreen]);
  const [config, setConfig] = React.useState<CoinJarProConfig>(persisted.config);
  const viewport = useViewportSize();

  // Subscribe to SSE for config updates and gift events
  React.useEffect(() => {
    const unsub = eventSource.subscribe((event: OverlayEvent) => {
      const raw = event as unknown as { type: string; data: Record<string, unknown> };
      const d = raw.data;
      if (!d) return;

      // Apply config updates from SSE state messages
      if (d.type === 'coin-jar-state' && d.config) {
        setConfig((prev) => ({ ...prev, ...(d.config as Partial<CoinJarProConfig>) }));
      }
    });
    return unsub;
  }, [eventSource]);

  return (
    <CoinJarProRenderer
      config={config}
      mode="browser-source"
      events={eventSource}
      initialTotalCoins={persisted.currentAmount}
      size={viewport}
    />
  );
};

// ─── Mount ────────────────────────────────────────────

const root = createRoot(document.getElementById('root')!);
root.render(<CoinJarApp />);
