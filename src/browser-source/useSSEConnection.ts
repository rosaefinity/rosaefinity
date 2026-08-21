// ─────────────────────────────────────────────────────
// RosaeFinity Browser Source — SSE Connection Hook
// v3.1 Architecture Spec (Frozen)
// ─────────────────────────────────────────────────────

import { useEffect, useRef, useCallback, useState } from 'react';
import type { OverlayEvent } from '../overlays/types';
import type { ConnectionStatus } from './BrowserSourceContext';
import { getSSEBaseUrl } from '../lib/browser-source-url';

// ─── Configuration ───

interface SSEConnectionConfig {
  maxReconnectAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  heartbeatInterval: number;
  heartbeatTimeout: number;
}

const DEFAULT_CONFIG: SSEConnectionConfig = {
  maxReconnectAttempts: 10,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  heartbeatInterval: 30000,
  heartbeatTimeout: 10000,
};

// ─── Hook Return Type ───

export interface UseSSEConnectionReturn {
  connectionStatus: ConnectionStatus;
  reconnectCount: number;
  lastEventTime: number;
  lastEventType: string;
  eventLatency: number;
  reconnect: () => void;
}

// ─── Development Logging ───

function devLog(message: string): void {
  if (import.meta.env?.DEV) {
    console.debug(`[SSE] ${message}`);
  }
}

function devWarn(message: string): void {
  if (import.meta.env?.DEV) {
    console.warn(`[SSE] ${message}`);
  }
}

/**
 * SSE connection hook with auto-reconnect, heartbeat, and exponential backoff.
 *
 * Connects to the SSE event stream for a specific overlay instance.
 * Handles reconnection automatically on disconnect.
 *
 * @param instanceId - The overlay instance ID to subscribe to
 * @param onEvent - Callback for each received event
 * @param config - Optional configuration overrides
 */
export function useSSEConnection(
  instanceId: string | null,
  onEvent: (event: OverlayEvent) => void,
  config?: Partial<SSEConnectionConfig>,
): UseSSEConnectionReturn {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [reconnectCount, setReconnectCount] = useState(0);
  const [lastEventTime, setLastEventTime] = useState(0);
  const [lastEventType, setLastEventType] = useState('');
  const [eventLatency, setEventLatency] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const onEventRef = useRef(onEvent);
  const mountedRef = useRef(true);

  // Keep callback ref current
  onEventRef.current = onEvent;

  const cleanup = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
    }

    heartbeatTimerRef.current = setInterval(() => {
      if (!eventSourceRef.current || eventSourceRef.current.readyState !== EventSource.OPEN) {
        devWarn('Heartbeat check: connection not open');
        return;
      }

      // Start heartbeat timeout
      heartbeatTimeoutRef.current = setTimeout(() => {
        devWarn('Heartbeat timeout — connection may be dead');
        // EventSource will auto-reconnect, but we update status
        setConnectionStatus('reconnecting');
      }, mergedConfig.heartbeatTimeout);
    }, mergedConfig.heartbeatInterval);
  }, [mergedConfig]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatTimerRef.current) {
      clearInterval(heartbeatTimerRef.current);
      heartbeatTimerRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!instanceId || !mountedRef.current) return;

    cleanup();

    const sseUrl = `${getSSEBaseUrl()}/overlay/${instanceId}/events`;
    devLog(`Connecting to ${sseUrl}`);

    setConnectionStatus('connecting');

    try {
      const es = new EventSource(sseUrl);
      eventSourceRef.current = es;

      es.onopen = () => {
        if (!mountedRef.current) return;
        devLog('Connected');
        setConnectionStatus('connected');
        attemptRef.current = 0;
        setReconnectCount(0);
        startHeartbeat();
      };

      es.onmessage = (e) => {
        if (!mountedRef.current) return;

        // Clear heartbeat timeout (connection is alive)
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
          heartbeatTimeoutRef.current = null;
        }

        try {
          const event = JSON.parse(e.data) as OverlayEvent;
          const now = Date.now();

          setLastEventTime(now);
          setLastEventType(event.type);

          // Calculate event latency if timestamp available
          if ('timestamp' in event && typeof event.timestamp === 'number') {
            setEventLatency(now - event.timestamp);
          }

          onEventRef.current(event);
        } catch {
          // Ignore malformed events
        }
      };

      es.onerror = () => {
        if (!mountedRef.current) return;
        stopHeartbeat();

        if (es.readyState === EventSource.CLOSED) {
          devLog('Connection closed');
          setConnectionStatus('disconnected');
          scheduleReconnect();
        } else if (es.readyState === EventSource.CONNECTING) {
          devLog('Reconnecting...');
          setConnectionStatus('reconnecting');
        }
      };
    } catch (error) {
      devWarn(`Failed to create EventSource: ${error}`);
      setConnectionStatus('disconnected');
      scheduleReconnect();
    }
  }, [instanceId, cleanup, startHeartbeat, stopHeartbeat]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return;
    if (attemptRef.current >= mergedConfig.maxReconnectAttempts) {
      devWarn(`Max reconnect attempts (${mergedConfig.maxReconnectAttempts}) reached`);
      setConnectionStatus('disconnected');
      return;
    }

    const delay = Math.min(
      mergedConfig.baseDelay * Math.pow(mergedConfig.backoffMultiplier, attemptRef.current),
      mergedConfig.maxDelay,
    );

    devLog(`Reconnecting in ${delay}ms (attempt ${attemptRef.current + 1})`);
    attemptRef.current += 1;
    setReconnectCount(attemptRef.current);

    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect, mergedConfig]);

  const reconnect = useCallback(() => {
    attemptRef.current = 0;
    connect();
  }, [connect]);

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [connect, cleanup]);

  return {
    connectionStatus,
    reconnectCount,
    lastEventTime,
    lastEventType,
    eventLatency,
    reconnect,
  };
}
