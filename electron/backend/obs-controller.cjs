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

// Status listeners — single authoritative flag is `connected`, mirrored to renderer
const statusListeners = new Set();

function onStatusChange(cb) {
  if (typeof cb !== "function") return () => {};
  statusListeners.add(cb);
  return () => statusListeners.delete(cb);
}

function emitStatusChange() {
  const payload = { connected };
  for (const cb of statusListeners) {
    try { cb(payload); } catch (_) { /* listener errors must not break controller */ }
  }
}

function setConnected(next) {
  const value = !!next;
  if (connected === value) return;
  connected = value;
  emitStatusChange();
}

// Default local OBS endpoint. Users may override IP/port in Settings.
const OBS_LOCAL_HOST = "127.0.0.1";
const OBS_LOCAL_PORT = 4455;

const OBS_CONFIG = {
  ip: OBS_LOCAL_HOST,
  port: OBS_LOCAL_PORT,
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
// Accepts configured IP/port from Settings (defaults 127.0.0.1:4455).
// Password updates only when the key is present as a string (never wiped
// by a config payload that omits it).
function setConfig(config) {
  if (!config) return;
  if (typeof config.obsIp === "string" && config.obsIp.trim()) {
    OBS_CONFIG.ip = config.obsIp.trim();
  }
  const port = Number(config.obsPort);
  if (Number.isFinite(port) && port >= 1 && port <= 65535) {
    OBS_CONFIG.port = port;
  }
  if (typeof config.obsPassword === "string") {
    OBS_CONFIG.password = config.obsPassword;
  }
}

async function connect() {
  return new Promise((resolve) => {
    if (connection) disconnect();

    const url = `ws://${OBS_CONFIG.ip}:${OBS_CONFIG.port}`;
    if (OBS_DEBUG) console.log(`[OBS] Connecting to ${url}...`);

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
            // Identified successfully — this is the authoritative connected state
            setConnected(true);
            console.log("[OBS] ✅ Connected & identified");
            resolve({ success: true });
          }

          if (msg.op === 7) {
            // Request response - high frequency, gate behind debug
            if (OBS_DEBUG) console.log("[OBS] Request response:", JSON.stringify(msg.d).slice(0, 200));
          }
        } catch (e) {
          console.error("[OBS] Message parse error:", e.message);
        }
      });

      connection.on("open", () => {
        // Wait for Hello (op 0) from server — handled in message handler
      });

      connection.on("close", () => {
        setConnected(false);
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
  setConnected(false);
}

function cleanup() {
  if (connection) {
    try { connection.close(); } catch (_) {}
    connection = null;
  }
  setConnected(false);
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
          const status = resp.d.requestStatus;
          // OBS v5: requestStatus.result===false means the request failed
          // even though the WebSocket frame itself arrived.
          if (status && status.result === false) {
            resolve({
              success: false,
              error: status.comment || `OBS request failed (code ${status.code})`,
              code: status.code,
            });
            return;
          }
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
// Normalize OBS GetSceneList payloads to a stable IPC shape.
// OBS WebSocket v5 responseData.scenes[] uses `sceneName` (not `name`).
// sendRequest may wrap as { data: responseData } or fall back to the raw
// op-7 envelope — both must parse.
function extractSceneNames(payload) {
  if (!payload || typeof payload !== "object") return [];
  const candidates = [];
  if (Array.isArray(payload.scenes)) candidates.push(payload.scenes);
  if (payload.data && Array.isArray(payload.data.scenes)) candidates.push(payload.data.scenes);
  if (payload.responseData && Array.isArray(payload.responseData.scenes)) {
    candidates.push(payload.responseData.scenes);
  }
  for (const list of candidates) {
    const names = list
      .map((s) => {
        if (typeof s === "string") return s;
        if (!s || typeof s !== "object") return null;
        return s.sceneName ?? s.name ?? null;
      })
      .filter((n) => typeof n === "string" && n.length > 0);
    if (names.length > 0) return names;
  }
  // Legitimate empty list only when we saw a scenes array and it was empty
  if (Array.isArray(payload.scenes) || (payload.data && Array.isArray(payload.data.scenes))) {
    return [];
  }
  return [];
}

const OBS_DEBUG = process.env.RF_OBS_DEBUG === "1" || process.env.RF_OBS_DEBUG === "true";

async function switchScene(sceneName) {
  return sendRequest("SetCurrentProgramScene", { sceneName });
}

async function getSceneList() {
  const result = await sendRequest("GetSceneList");
  if (!result.success) {
    if (OBS_DEBUG) {
      console.log("[OBS-SCENES]", JSON.stringify({ success: false, error: result.error }));
    }
    return {
      success: false,
      error: result.error || "Failed to load OBS scenes",
      scenes: [],
    };
  }

  const payload = result.data || {};
  // If sendRequest fell back to the op-7 envelope, responseData holds the scenes
  const effective = payload.responseData && payload.scenes === undefined && payload.data === undefined
    ? payload
    : payload;

  const status = payload.requestStatus || payload.responseData?.requestStatus;
  if (status && status.result === false) {
    const error = status.comment || `OBS GetSceneList failed (code ${status.code})`;
    if (OBS_DEBUG) {
      console.log("[OBS-SCENES]", JSON.stringify({ success: false, error, code: status.code }));
    }
    return { success: false, error, scenes: [] };
  }

  const scenes = extractSceneNames(effective);
  const currentScene =
    effective.currentProgramSceneName ??
    effective.responseData?.currentProgramSceneName ??
    null;

  if (OBS_DEBUG) {
    console.log("[OBS-SCENES]", JSON.stringify({
      success: true,
      sceneCount: scenes.length,
      scenes: scenes.slice(0, 20),
      currentScene,
    }));
  }

  // Stable shape for renderer: scenes is always string[]
  return { success: true, scenes, currentScene };
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
// "Test Connection" must leave OBS actually connected.
// Uses the configured IP/port (defaults 127.0.0.1:4455).
async function testConnection(ip, port, password) {
  setConfig({
    obsIp: ip,
    obsPort: port,
    obsPassword: typeof password === "string" ? password : OBS_CONFIG.password,
  });
  return connect();
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
  onStatusChange,
};
