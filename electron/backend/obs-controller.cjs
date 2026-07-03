// ═══════════════════════════════════════════════
// RosaeFinity OBS Controller
// Uses obs-websocket-js v5 protocol (WebSocket raw)
// ═══════════════════════════════════════════════

const WebSocket = require("ws");
const crypto = require("crypto");

let connection = null;
let connected = false;
let reconnectTimer = null;
let requestId = 1;

const OBS_CONFIG = {
  ip: "127.0.0.1",
  port: 4567,
  password: "",
};

// ══ Helpers ════════════════════════════════
function base64Encode(str) {
  return Buffer.from(str, "utf-8").toString("base64");
}

function sha256Hex(str) {
  return crypto.createHash("sha256").update(str, "utf-8").digest("hex");
}

function sha256Base64(str) {
  return crypto.createHash("sha256").update(str, "utf-8").digest("base64");
}

// OBS WebSocket v5 challenge-response:
//   secret = base64(sha256(password + salt))
//   auth   = base64(sha256(secret + challenge))
function computeObsAuth(password, challenge, salt) {
  const secret = sha256Base64(password + salt);
  return sha256Base64(secret + challenge);
}

// ══ Connection ═════════════════════════════
function setConfig(config) {
  OBS_CONFIG.ip = config.obsIp || OBS_CONFIG.ip;
  OBS_CONFIG.port = config.obsPort || OBS_CONFIG.port;
  OBS_CONFIG.password = config.obsPassword || OBS_CONFIG.password;
}

async function connect() {
  return new Promise((resolve) => {
    if (connection) disconnect();

    const url = `ws://${OBS_CONFIG.ip}:${OBS_CONFIG.port}`;
    console.log(`[OBS] Connecting to ${url}...`);

    try {
      connection = new WebSocket(url);

      const timeout = setTimeout(() => {
        console.log("[OBS] Connection timeout");
        cleanup();
        resolve({ success: false, error: "Connection timeout" });
      }, 4000);

      let helloReceived = false;

      connection.on("message", (raw) => {
        try {
          const msg = JSON.parse(raw.toString());

          if (msg.op === 0 && !helloReceived) {
            // Hello message — OBS WebSocket v5 handshake
            helloReceived = true;
            clearTimeout(timeout);

            const d = msg.d || {};
            let authString = null;

            // If the server requires authentication, compute the challenge response
            if (d.authentication && OBS_CONFIG.password) {
              authString = computeObsAuth(
                OBS_CONFIG.password,
                d.authentication.challenge || "",
                d.authentication.salt || "",
              );
              console.log("[OBS] Auth required — computed challenge response");
            } else if (d.authentication && !OBS_CONFIG.password) {
              console.log("[OBS] Auth required but no password set");
              cleanup();
              resolve({ success: false, error: "OBS WebSocket requires a password" });
              return;
            }

            // Send Identify message (v5 op 1)
            const identify = {
              op: 1,
              d: {
                rpcVersion: 1,
                authentication: authString,
              },
            };
            connection.send(JSON.stringify(identify));
          }

          if (msg.op === 2) {
            // Identified successfully
            connected = true;
            console.log("[OBS] ✅ Connected & identified");
            resolve({ success: true });
          }

          if (msg.op === 7) {
            // Request response
            console.log("[OBS] Request response:", JSON.stringify(msg.d).slice(0, 200));
          }
        } catch (e) {
          console.error("[OBS] Message parse error:", e.message);
        }
      });

      connection.on("open", () => {
        // Wait for Hello (op 0) from server — handled in message handler
      });

      connection.on("close", () => {
        connected = false;
        console.log("[OBS] Connection closed");
        scheduleReconnect();
      });

      connection.on("error", (err) => {
        clearTimeout(timeout);
        console.error("[OBS] WebSocket error:", err.message);
        if (!connected) {
          cleanup();
          resolve({ success: false, error: err.message });
        }
      });
    } catch (e) {
      console.error("[OBS] Connection error:", e.message);
      resolve({ success: false, error: e.message });
    }
  });
}

function disconnect() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (connection) {
    try { connection.close(); } catch (_) {}
    connection = null;
  }
  connected = false;
}

function cleanup() {
  if (connection) {
    try { connection.close(); } catch (_) {}
    connection = null;
  }
  connected = false;
}

function scheduleReconnect() {
  // Don't auto-reconnect — let the user/manual trigger
}

// ══ OBS Commands ═══════════════════════════
function sendRequest(requestType, requestData = {}) {
  return new Promise((resolve) => {
    if (!connected || !connection) {
      resolve({ success: false, error: "Not connected to OBS" });
      return;
    }

    const reqId = requestId++;
    const msg = {
      "op": 6,
      "d": {
        "requestType": requestType,
        "requestId": String(reqId),
        "requestData": requestData,
      },
    };

    // Listen for response
    const handler = (raw) => {
      try {
        const resp = JSON.parse(raw.toString());
        if (resp.op === 7 && resp.d && resp.d.requestId === String(reqId)) {
          connection.removeListener("message", handler);
          resolve({ success: true, data: resp.d.responseData || resp.d });
        }
      } catch (_) {}
    };

    connection.on("message", handler);
    connection.send(JSON.stringify(msg));

    // Timeout
    setTimeout(() => {
      connection.removeListener("message", handler);
      resolve({ success: false, error: "Request timeout" });
    }, 5000);
  });
}

// ══ Scene Management ═══════════════════════
async function switchScene(sceneName) {
  return sendRequest("SetCurrentProgramScene", { sceneName });
}

async function getSceneList() {
  return sendRequest("GetSceneList");
}

async function getCurrentScene() {
  return sendRequest("GetCurrentProgramScene");
}

// ══ Source Management ══════════════════════
async function setSourceVisibility(sceneName, sourceName, visible) {
  return sendRequest("SetSceneItemEnabled", {
    sceneName,
    sceneItemId: null, // We need the item ID — first find it
    sceneItemEnabled: visible,
  });
}

async function getSceneItemId(sceneName, sourceName) {
  const result = await sendRequest("GetSceneItemList", { sceneName });
  if (result.success && result.data && result.data.sceneItems) {
    const item = result.data.sceneItems.find(i =>
      i.sourceName && i.sourceName.toLowerCase() === sourceName.toLowerCase()
    );
    if (item) return item.sceneItemId;
  }
  return null;
}

async function toggleSource(sceneName, sourceName) {
  const itemId = await getSceneItemId(sceneName, sourceName);
  if (itemId === null) return { success: false, error: "Source not found" };
  return sendRequest("SetSceneItemEnabled", {
    sceneName,
    sceneItemId: itemId,
    sceneItemEnabled: true, // Toggle on for now — could track state
  });
}

// ══ Audio ══════════════════════════════════
async function setVolume(sourceName, volumeMul) {
  return sendRequest("SetInputVolume", {
    inputName: sourceName,
    inputVolumeMul: volumeMul,
  });
}

// ══ Status ═════════════════════════════════
function isConnected() {
  return connected;
}

function getConfig() {
  return { ...OBS_CONFIG };
}

// ══ Test Connection ════════════════════════
async function testConnection(ip, port, password) {
  return new Promise((resolve) => {
    const url = `ws://${ip || OBS_CONFIG.ip}:${port || OBS_CONFIG.port}`;
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
  switchScene,
  getSceneList,
  getCurrentScene,
  setSourceVisibility,
  getSceneItemId,
  toggleSource,
  setVolume,
  isConnected,
  getConfig,
  testConnection,
};
