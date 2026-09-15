// ═══════════════════════════════════════════════
// Overlay Event Bus — BroadcastChannel + SSE relay
// ═══════════════════════════════════════════════

import { getSSEBaseUrl } from './browser-source-url';

const CHANNEL_NAME = "rosaefinity-overlay";
let channel: BroadcastChannel | null = null;

// SSE connection state
let sseConnected = false;
let sseRetryCount = 0;
let sseRetryTimer: ReturnType<typeof setTimeout> | null = null;
let sseMonitorTimer: ReturnType<typeof setInterval> | null = null;
const MAX_SSE_RETRIES = 5;
const SSE_MONITOR_INTERVAL = 15_000; // 15 seconds

const SSE_URL = getSSEBaseUrl();

function getChannel(): BroadcastChannel | null {
  if (!channel) {
    try { channel = new BroadcastChannel(CHANNEL_NAME); }
    catch { channel = null; }
  }
  return channel;
}

// ─── SSE connection management ─────────────────
function updateSSEState(connected: boolean) {
  if (sseConnected === connected) return;
  sseConnected = connected;

  // Dispatch state change event for UI to consume
  window.dispatchEvent(new CustomEvent("rosae:sse-state", {
    detail: { connected, retryCount: sseRetryCount }
  }));
}

function attemptSSERetry() {
  if (sseRetryCount >= MAX_SSE_RETRIES) {
    console.warn("[Overlay] SSE relay max retries reached. Check if SSE server is running on port 18890.");
    return;
  }

  sseRetryCount++;
  sseRetryTimer = setTimeout(async () => {
    try {
      const response = await fetch(`${SSE_URL}/health`, { method: "GET" });
      if (response.ok) {
        sseRetryCount = 0;
        updateSSEState(true);
      } else {
        attemptSSERetry();
      }
    } catch {
      attemptSSERetry();
    }
  }, Math.min(1000 * Math.pow(2, sseRetryCount), 30000)); // Exponential backoff, max 30s
}

// ─── Kirim event ke overlay ─────────────────
export function sendToOverlay(data: any) {
  console.log('[ACTION-TRACE] overlay dispatch sent', JSON.stringify({
    type: data.type,
    actionName: data.actionName,
    screen: data.screen,
    channels: ["BroadcastChannel", "CustomEvent", "localStorage", "SSE"],
    timestamp: Date.now(),
  }));

  // 1. BroadcastChannel (same-process, instant)
  const ch = getChannel();
  if (ch) {
    try { ch.postMessage(data); }
    catch (e) { console.warn("[Overlay] BroadcastChannel error:", e); }
  }

  // 2. CustomEvent (in-page)
  window.dispatchEvent(new CustomEvent("rosae:overlay-event", { detail: data }));

  // 3. localStorage (OBS polling fallback)
  try {
    localStorage.setItem("rf_overlay_test", JSON.stringify(data));
    localStorage.setItem("rf_overlay_test_time", String(Date.now()));
  } catch {}

  // 4. SSE relay (cross-process — TikTok Live Studio, OBS in different context)
  try {
    fetch(`${SSE_URL}/event`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    .then(response => {
      if (!response.ok) throw new Error(`SSE server error: ${response.status}`);
      updateSSEState(true);
      sseRetryCount = 0;
    })
    .catch(error => {
      console.warn("[Overlay] SSE relay failed:", error.message);
      updateSSEState(false);
      if (!sseRetryTimer) attemptSSERetry();
    });
  } catch {}
}

// ─── Check SSE health ─────────────────────────
export async function checkSSEHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${SSE_URL}/health`, { method: "GET" });
    const connected = response.ok;
    updateSSEState(connected);
    return connected;
  } catch {
    updateSSEState(false);
    return false;
  }
}

// ─── Get SSE connection state ─────────────────
export function getSSEConnectionState() {
  return { connected: sseConnected, retryCount: sseRetryCount };
}

// ─── Test alert ─────────────────────────────
export function testOverlayAlert(eventType: string = "gift") {
  sendToOverlay({
    eventType,
    actionName: "Test Alert",
    timestamp: Date.now(),
  });
}

// ─── Periodic SSE health monitor ────────────
export function startSSEMonitor() {
  if (sseMonitorTimer) return; // already running
  sseMonitorTimer = setInterval(() => {
    checkSSEHealth();
  }, SSE_MONITOR_INTERVAL);
}

export function stopSSEMonitor() {
  if (sseMonitorTimer) {
    clearInterval(sseMonitorTimer);
    sseMonitorTimer = null;
  }
}