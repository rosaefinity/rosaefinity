// ═══════════════════════════════════════════════
// RosaeFinity Streamer.bot Integration
// WebSocket client for Streamer.bot action triggers
// ═══════════════════════════════════════════════

const WebSocket = require("ws");

let connection = null;
let connected = false;
let currentActionId = null;

const SB_CONFIG = {
  address: "127.0.0.1",
  port: 8080,
  endpoint: "/",
};

// ══ Connection ═════════════════════════════
function setConfig(config) {
  SB_CONFIG.address = config.sbAddress || SB_CONFIG.address;
  SB_CONFIG.port = config.sbPort || SB_CONFIG.port;
  SB_CONFIG.endpoint = config.sbEndpoint || SB_CONFIG.endpoint;
}

async function connect() {
  return new Promise((resolve) => {
    if (connection) disconnect();

    let url = `ws://${SB_CONFIG.address}:${SB_CONFIG.port}`;
    if (SB_CONFIG.endpoint && SB_CONFIG.endpoint !== "/") {
      url += SB_CONFIG.endpoint.startsWith("/") ? SB_CONFIG.endpoint : "/" + SB_CONFIG.endpoint;
    }

    console.log(`[SB] Connecting to ${url}...`);

    try {
      connection = new WebSocket(url);
      const timeout = setTimeout(() => {
        if (connection) {
          try { connection.close(); } catch (_) {}
          connection = null;
        }
        console.log("[SB] Connection timeout");
        resolve({ success: false, error: "Connection timeout" });
      }, 4000);

      connection.on("open", () => {
        clearTimeout(timeout);
        connected = true;
        console.log("[SB] ✅ Connected to Streamer.bot");

        // Send "action:list" to verify auth
        sendAction({ action: "action:list" });

        resolve({ success: true });
      });

      connection.on("message", (raw) => {
        try {
          const msg = raw.toString();
          const data = JSON.parse(msg);
          console.log("[SB] Message:", JSON.stringify(data).slice(0, 300));
        } catch (_) {
          console.log("[SB] Raw message:", raw.toString().slice(0, 200));
        }
      });

      connection.on("close", () => {
        connected = false;
        console.log("[SB] Disconnected");
        connection = null;
      });

      connection.on("error", (err) => {
        clearTimeout(timeout);
        console.error("[SB] Error:", err.message);
        if (!connected) {
          resolve({ success: false, error: err.message });
        }
      });
    } catch (e) {
      console.error("[SB] Connection error:", e.message);
      resolve({ success: false, error: e.message });
    }
  });
}

function disconnect() {
  if (connection) {
    try { connection.close(); } catch (_) {}
    connection = null;
  }
  connected = false;
}

// ══ Trigger Action ═════════════════════════
function triggerAction(actionName, eventData = {}) {
  if (!connected || !connection) {
    console.log("[SB] Not connected — cannot trigger action");
    return { success: false, error: "Not connected" };
  }

  // Streamer.bot WebSocket API format
  const payload = {
    action: actionName,
    ...(eventData && Object.keys(eventData).length > 0 ? { data: eventData } : {}),
  };

  try {
    connection.send(JSON.stringify(payload));
    console.log(`[SB] Triggered action: ${actionName}`, eventData ? JSON.stringify(eventData).slice(0, 150) : "");
    return { success: true };
  } catch (e) {
    console.error("[SB] Send error:", e.message);
    return { success: false, error: e.message };
  }
}

// Internal: send raw action object
function sendAction(actionObj) {
  if (!connection) return;
  try {
    connection.send(JSON.stringify(actionObj));
  } catch (_) {}
}

// ══ Status ═════════════════════════════════
function isConnected() {
  return connected;
}

// ══ Test Connection ════════════════════════
async function testConnection(address, port, endpoint) {
  return new Promise((resolve) => {
    let url = `ws://${address || SB_CONFIG.address}:${port || SB_CONFIG.port}`;
    const ep = endpoint !== undefined ? endpoint : SB_CONFIG.endpoint;
    if (ep && ep !== "/") {
      url += ep.startsWith("/") ? ep : "/" + ep;
    }

    let resolved = false;
    let ws;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (ws) try { ws.close(); } catch (_) {}
        resolve({ success: false, error: "Connection timed out" });
      }
    }, 4000);

    try {
      ws = new WebSocket(url);
      ws.on("open", () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ success: true, error: null });
          if (ws) try { ws.close(); } catch (_) {}
        }
      });
      ws.on("error", (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve({ success: false, error: err.message });
        }
      });
    } catch (e) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ success: false, error: e.message });
      }
    }
  });
}

module.exports = {
  setConfig,
  connect,
  disconnect,
  triggerAction,
  isConnected,
  testConnection,
};
