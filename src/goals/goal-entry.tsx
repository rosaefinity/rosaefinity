// =============================================
// RosaeFinity — Goal Browser Source Entry
// Standalone React entry for the Goal overlay.
// Connects to the SSE server and renders the GoalProgressRenderer.
// =============================================

import React from 'react';
import { createRoot } from 'react-dom/client';
import { GoalProgressRenderer } from '../overlays/goal-progress/GoalProgressRenderer';
import { defaultGoalProgressConfig } from '../overlays/goal-progress/types';
import type { GoalProgressConfig } from '../overlays/goal-progress/types';
import type { OverlayEvent, OverlayEventSource } from '../overlays/types';
import { getSSEBaseUrl } from '../lib/browser-source-url';

// ─── SSE connection ─────────────────────────────────

function createSSEEventSource(): OverlayEventSource {
  const subscribers = new Set<(event: OverlayEvent) => void>();
  let es: EventSource | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryCount = 0;

  function connect() {
    const baseUrl = getSSEBaseUrl();
    const url = `${baseUrl}/events`;
    es = new EventSource(url);
    es.onopen = () => { retryCount = 0; };
    es.onmessage = (e) => {
      if (!e.data || e.data.trim() === '') return;
      try {
        const data = JSON.parse(e.data);
        const event: OverlayEvent = data.type === 'goal-progress'
          ? {
              type: 'goal-progress',
              current: data.current ?? 0,
              target: data.target ?? 0,
              goalType: data.goalType,
              barColor: data.barColor,
              gradientColor: data.gradientColor,
              textColor: data.textColor,
              backgroundColor: data.backgroundColor,
            }
          : { type: 'custom', data };
        subscribers.forEach((cb) => {
          try { cb(event); } catch { /* subscriber error */ }
        });
      } catch { /* parse error */ }
    };
    es.onerror = () => {
      es?.close();
      es = null;
      if (retryCount < 50) {
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

// ─── App ──────────────────────────────────────────────

const GoalApp: React.FC = () => {
  const eventSource = React.useMemo(() => createSSEEventSource(), []);

  const [config, setConfig] = React.useState<GoalProgressConfig>(() => {
    // Initial load: try localStorage first (fast, local)
    try {
      const raw = localStorage.getItem('rf-goal-config');
      if (raw) return { ...defaultGoalProgressConfig, ...JSON.parse(raw) };
    } catch { /* fall through */ }
    return { ...defaultGoalProgressConfig };
  });

  // Fetch latest config from Electron server on mount (cross-process reliable)
  // Retry if server hasn't received config from renderer yet (startup race)
  React.useEffect(() => {
    const baseUrl = getSSEBaseUrl();
    let attempts = 0;
    const maxAttempts = 5;
    function tryFetch() {
      attempts++;
      fetch(`${baseUrl}/goal-config`)
        .then(r => r.json())
        .then(serverConfig => {
          if (serverConfig && Object.keys(serverConfig).length > 0) {
            const merged = { ...defaultGoalProgressConfig, ...serverConfig };
            setConfig(merged);
          } else if (attempts < maxAttempts) {
            // Server may not have received config from renderer yet, retry
            setTimeout(tryFetch, 1000);
          }
        })
        .catch(() => {
          if (attempts < maxAttempts) setTimeout(tryFetch, 1000);
        });
    }
    tryFetch();
  }, []);

  // Live-update config from SSE (broadcast by overlay-store when Customize saves)
  React.useEffect(() => {
    const unsub = eventSource.subscribe((event: OverlayEvent) => {
      if (event.type === 'custom' && (event as any).data?.type === 'goal-config-update') {
        const incoming = (event as any).data.config;
        if (incoming) {
          const merged = { ...defaultGoalProgressConfig, ...incoming };
          setConfig(merged);
        }
      }
    });
    return unsub;
  }, [eventSource]);

  return (
    <div style={{ containerType: 'inline-size', width: '100%', height: '100%' }}>
    <GoalProgressRenderer
      config={config}
      mode="browser-source"
      events={eventSource}
    />
    </div>
  );
};

// ─── Mount (clean, same pattern as CoinJar) ──────────

const root = createRoot(document.getElementById('root')!);
root.render(<GoalApp />);
