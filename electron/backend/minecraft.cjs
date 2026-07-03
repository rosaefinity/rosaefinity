// ═══════════════════════════════════════════════
// RosaeFinity Minecraft Controller
// ServerTap REST API v0.5.x — uses /v1/* endpoints
// ═══════════════════════════════════════════════

const http = require("http");

let connected = false;

const MC_CONFIG = {
  mode: "servertap",
  player: "",
  ip: "127.0.0.1",
  port: 4567,
  password: "change_me",
};

// ══ Config ════════════════════════════════
function setConfig(config) {
  MC_CONFIG.mode     = config.mcMode || MC_CONFIG.mode;
  MC_CONFIG.player   = config.mcPlayer || MC_CONFIG.player;
  MC_CONFIG.ip       = config.mcIp || MC_CONFIG.ip;
  MC_CONFIG.port     = config.mcPort || MC_CONFIG.port;
  MC_CONFIG.password = config.mcPassword || MC_CONFIG.password;
}

// ══ ServerTap v0.5.x REST API ═════════════
function serverTapRequest(method, apiPath, body = null, formEncode = false) {
  return new Promise((resolve) => {
    const options = {
      hostname: MC_CONFIG.ip,
      port: MC_CONFIG.port,
      path: apiPath,
      method: method,
      headers: {
        "User-Agent": "RosaeFinity/1.0",
      },
      timeout: 5000,
    };

    if (MC_CONFIG.password) {
      options.headers["key"] = MC_CONFIG.password;
    }

    // ServerTap /v1/server/exec uses x-www-form-urlencoded
    let bodyString = "";
    if (body) {
      if (formEncode) {
        bodyString = Object.entries(body)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join("&");
        options.headers["Content-Type"] = "application/x-www-form-urlencoded";
      } else {
        bodyString = JSON.stringify(body);
        options.headers["Content-Type"] = "application/json";
      }
      options.headers["Content-Length"] = Buffer.byteLength(bodyString);
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ success: true, data: parsed, statusCode: res.statusCode });
        } catch (e) {
          resolve({ success: res.statusCode < 400, raw: data, statusCode: res.statusCode });
        }
      });
    });

    req.on("error", (err) => {
      resolve({ success: false, error: err.message });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve({ success: false, error: "Request timeout" });
    });

    if (bodyString) {
      req.write(bodyString);
    }
    req.end();
  });
}

// ══ Execute Command ════════════════════════
async function executeCommand(command) {
  if (!command) return { success: false, error: "No command specified" };

  // Bersihin leading "/" biar user bebas mau pake "/" atau enggak
  command = command.replace(/^\/*/, "");

  if (MC_CONFIG.mode === "servertap") {
    // ServerTap v0.5.x: POST /v1/server/exec (form-urlencoded)
    const result = await serverTapRequest("POST", "/v1/server/exec", {
      command: command,
    }, true); // formEncode = true

    console.log(`[MC] Executed: /${command} →`, result.success ? "OK" : result.error);
    return result;
  } else {
    return { success: false, error: "Mod mode not implemented" };
  }
}

// ══ Server Status ═════════════════════════
async function getServerStatus() {
  if (MC_CONFIG.mode === "servertap") {
    return serverTapRequest("GET", "/v1/server");
  }
  return { success: false, error: "Mod mode not supported" };
}

async function getOnlinePlayers() {
  if (MC_CONFIG.mode === "servertap") {
    const result = await serverTapRequest("GET", "/v1/players");
    if (result.success && result.data) {
      return { success: true, players: Array.isArray(result.data) ? result.data : [] };
    }
    return result;
  }
  return { success: false, error: "Mod mode not supported" };
}

async function getPlugins() {
  if (MC_CONFIG.mode === "servertap") {
    return serverTapRequest("GET", "/v1/plugins");
  }
  return { success: false, error: "Mod mode not supported" };
}

// ══ Test Connection ════════════════════════
async function testConnection(ip, port, password, mode) {
  const testIp       = ip       || MC_CONFIG.ip;
  const testPort     = port     || MC_CONFIG.port;
  const testPassword = password || MC_CONFIG.password;
  const testMode     = mode     || MC_CONFIG.mode;

  if (testMode === "servertap") {
    return new Promise((resolve) => {
      const options = {
        hostname: testIp,
        port: testPort,
        path: "/v1/server",
        method: "GET",
        timeout: 4000,
      };
      if (testPassword) {
        options.headers = { key: testPassword };
      }

      const req = http.request(options, (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          if (res.statusCode === 200) {
            try {
              const parsed = JSON.parse(data);
              resolve({
                success: true,
                error: null,
                data: parsed,
                info: `✅ Server: ${parsed.name || parsed.type || "Minecraft"} | Players: ${parsed.onlinePlayers || 0}/${parsed.maxPlayers || "?"} | TPS: ${parsed.tps || "?"}`,
              });
            } catch (e) {
              resolve({ success: true, error: null, info: "✅ ServerTap responded" });
            }
          } else if (res.statusCode === 401 || res.statusCode === 403) {
            resolve({ success: false, error: "Authentication failed — wrong password" });
          } else {
            resolve({ success: false, error: `HTTP ${res.statusCode}` });
          }
        });
      });

      req.on("error", (err) => {
        resolve({ success: false, error: err.message });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({ success: false, error: "Connection timed out" });
      });

      req.end();
    });
  }

  return { success: false, error: "Mod mode test not implemented" };
}

function isConnected() { return connected; }

module.exports = {
  setConfig,
  executeCommand,
  getServerStatus,
  getOnlinePlayers,
  getPlugins,
  testConnection,
  isConnected,
  get config() { return { ...MC_CONFIG }; },
};
