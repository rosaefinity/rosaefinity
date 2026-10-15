// ─────────────────────────────────────────────────────
// RosaeFinity Browser Source — SSE Connection Hook
// v3.1 Architecture Spec (Frozen)
//
// ONE EventSource per Browser Source identity.
// Recreates ONLY when instanceId/browserSourceId changes.
// Parent re-renders, FPS ticks, and event diagnostics must
// NOT recreate the connection.
// ─────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react';
import type { OverlayEvent } from '../overlays/types';
import type { ConnectionStatus } from './BrowserSourceContext';
import { getSSEBaseUrl } from '../lib/browser-source-url';
import { overlayDebugLog } from '../lib/overlay-debug';
import { recordEventSourceCreated, recordEventSourceClosed } from './sse-lifecycle';

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;
const BACKOFF_MULTIPLIER = 2;

export interface UseSSEConnectionReturn {
  connectionStatus: ConnectionStatus;
  reconnectCount: number;
}

/**
 * Connects exactly one EventSource to /overlay/:id/events.
 *
 * @param instanceId - browserSourceId or instanceId (connection identity)
 * @param onEvent - latest callback via ref; identity changes do not reconnect
 * @param debug - when true, emits [SSE-LIFECYCLE] diagnostics
 */
export function useSSEConnection(
  instanceId: string | null,
  onEvent: (event: OverlayEvent) => void,
  debug = false,
): UseSSEConnectionReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [reconnectCount, setReconnectCount] = useState(0);

  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const debugRef = useRef(debug);
  debugRef.current = debug;

  useEffect(() => {
    if (!instanceId) {
      setConnectionStatus('disconnected');
      return;
    }

    let cancelled = false;
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const sseUrl = `${getSSEBaseUrl()}/overlay/${instanceId}/events`;

    const logLifecycle = (action: string): void => {
      if (!debugRef.current) return;
      overlayDebugLog('[SSE-LIFECYCLE]', JSON.stringify({
        browserSourceId: instanceId,
        action,
        url: sseUrl,
        timestamp: Date.now(),
      }));
    };

    const connect = (): void => {
      if (cancelled) return;

      es = new EventSource(sseUrl);
      recordEventSourceCreated(instanceId);
      logLifecycle('created');

      es.onopen = () => {
        if (cancelled) return;
        attempt = 0;
        setConnectionStatus('connected');
        setReconnectCount(0);
        logLifecycle('open');
      };

      es.onmessage = (e) => {
        if (cancelled) return;
        try {
          const event = JSON.parse(e.data) as OverlayEvent;
          onEventRef.current(event);
        } catch {
          // Ignore malformed events
        }
      };

      es.onerror = () => {
        if (cancelled || !es) return;

        if (es.readyState === EventSource.CLOSED) {
          logLifecycle('error-closed');
          setConnectionStatus('disconnected');

          if (attempt >= MAX_RECONNECT_ATTEMPTS) {
            overlayDebugLog('[SSE-LIFECYCLE] max reconnect attempts', instanceId);
            return;
          }

          const delay = Math.min(
            BASE_DELAY_MS * Math.pow(BACKOFF_MULTIPLIER, attempt),
            MAX_DELAY_MS,
          );
          attempt += 1;
          setReconnectCount(attempt);
          logLifecycle(`reconnect-scheduled:${attempt}:${delay}ms`);
          reconnectTimer = setTimeout(connect, delay);
        } else if (es.readyState === EventSource.CONNECTING) {
          setConnectionStatus('reconnecting');
          logLifecycle('reconnecting');
        }
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (es) {
        es.close();
        es = null;
        recordEventSourceClosed(instanceId);
        logLifecycle('closed');
      }
    };
  }, [instanceId]);

  return {
    connectionStatus,
    reconnectCount,
  };
}
