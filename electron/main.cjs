// =============================================
// RosaeFinity - electron/main.cjs
// Electron Main Process (v2 — full backend)
// =============================================

const { app, BrowserWindow, ipcMain, nativeTheme, Menu, Tray, shell, desktopCapturer, session } = require("electron");
const path = require("path");
const { exec } = require("child_process");
const http = require("http");
const fs = require("fs");
const { muatGiftTikTok } = require("./backend/gift-api.cjs");

// ── STEP 11: Main process error handlers (top-level) ──
process.on("uncaughtException", error => {
  console.error("[MAIN-FATAL] uncaughtException", error);
  console.error("[MAIN-FATAL] stack:", error.stack);
});

process.on("unhandledRejection", reason => {
  console.error("[MAIN-FATAL] unhandledRejection", reason);
});

// ── Backend Modules ─────────────────────────
const pointsSystem  = require("./backend/points-system.cjs");
const obsController = require("./backend/obs-controller.cjs");
const streamerbot   = require("./backend/streamerbot.cjs");
const minecraft     = require("./backend/minecraft.cjs");
const licenseSystem = require("./backend/license-system.cjs");
const spotify       = require("./backend/spotify.cjs");
const authSystem    = require("./backend/auth-system.cjs");
const { startGlobalHook, stopGlobalHook, isHookRunning } = require("./backend/global-input-hook.cjs");
const { getTikTokService } = require("./backend/tiktok-service.cjs");

// ── Phase 2: Stability Modules ──────────────
const { Logger } = require("./logger.cjs");
const { MemoryManager } = require("./memory-manager.cjs");
const { ServiceMonitor } = require("./service-monitor.cjs");

const isDev = process.env.NODE_ENV === "development" || process.argv.includes("--dev");

// ── State ───────────────────────────────────
let mainWindow          = null;
let overlayWindow       = null;
let tray                = null;
let isQuitting          = false;

// ── Crash tracking ──────────────────────────
let rendererCrashCount  = 0;
const MAX_RENDERER_CRASHES = 5;
const CRASH_RESET_MS    = 5 * 60 * 1000; // Reset crash count after 5 min stability

const MAX_RECONNECT_ATTEMPTS = 5;

// ── Per-screen connections (keyed by screenId) ──
// Now managed by TikTokService in electron/backend/tiktok-service.cjs
// This Map is kept for backwards compatibility with disconnectAllScreens()
const connections = new Map();
function getOrCreateScreenState(screenId) {
  if (!connections.has(screenId)) {
    connections.set(screenId, {
      tiktokConnection: null,
      isConnected: false,
      lastConnectedUser: null,
      reconnectTimeout: null,
      reconnectAttempts: 0,
      _reconnectLocked: false,
      isReconnecting: false,
    });
  }
  return connections.get(screenId);
}
function disconnectAllScreens() {
  const service = getTikTokServiceInstance();
  service.shutdown();
}

// ── Capture ────────────────────────────────
let _capturePendingSourceId = null;
const RECONNECT_DELAY_MS    = 3000;

// ── SSE Overlay Server ─────────────────────
const SSE_PORT = 18890;
let sseClients = [];

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter(res => {
    try { res.write(payload); return true; } catch (_) { return false; }
  });
}

function startSSEServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${SSE_PORT}`);

    // ── SSE stream endpoint ──
    if (url.pathname === "/events" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });
      res.write(":\n\n"); // initial comment to flush headers
      sseClients.push(res);
      req.on("close", () => { sseClients = sseClients.filter(c => c !== res); });
      return;
    }

    // ── Overlay widget HTML ──
    if (url.pathname === "/overlay-widget.html" || url.pathname === "/overlay-widget") {
      const htmlPath = isDev
        ? path.join(__dirname, "../public/overlay-widget.html")
        : path.join(__dirname, "../dist/overlay-widget.html");
      try {
        const html = fs.readFileSync(htmlPath, "utf-8");
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-cache",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(html);
      } catch (_) {
        res.writeHead(404); res.end("Overlay not found");
      }
      return;
    }

    // ── Broadcast event via GET (for external tools) ──
    if (url.pathname === "/event" && req.method === "GET") {
      try {
        const data = JSON.parse(decodeURIComponent(url.searchParams.get("data") || "{}"));
        broadcastSSE(data);
        // Also forward to Electron overlay window and renderer
        sendToOverlay("overlay:action", data);
        sendToRenderer("overlay:event", data);
      } catch (_) {}
      res.writeHead(200, { "Access-Control-Allow-Origin": "*" });
      res.end("ok");
      return;
    }

    // ── Broadcast event via POST ──
    if (url.pathname === "/event" && req.method === "POST") {
      let body = "";
      req.on("data", c => { body += c; });
      req.on("end", () => {
        try {
          const data = JSON.parse(body);
          broadcastSSE(data);
          sendToOverlay("overlay:action", data);
          sendToRenderer("overlay:event", data);
        } catch (_) {}
        res.writeHead(200, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" });
        res.end("ok");
      });
      return;
    }

    // ── CORS preflight ──
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      });
      res.end();
      return;
    }

    res.writeHead(404); res.end("Not found");
  });

  server.listen(SSE_PORT, "127.0.0.1", () => {
    console.log(`[RF] Overlay SSE server running on http://127.0.0.1:${SSE_PORT}`);
    console.log(`[RF]   → OBS/TikTok Studio: http://127.0.0.1:${SSE_PORT}/overlay-widget.html`);
    console.log(`[RF]   → SSE stream:        http://127.0.0.1:${SSE_PORT}/events`);
  });
  server.on("error", (err) => {
    console.error(`[RF] SSE server error on port ${SSE_PORT}:`, err.message);
  });
}

// ── Robotjs (optional) ──────────────────────
let robot = null;
try { robot = require("robotjs"); } catch (_) { /* not available */ }

// ── nut-js (modern alternative to robotjs) ───
let nutKeyboard = null;
let nutKey = null;
try {
  const nut = require("@nut-tree-fork/nut-js");
  nutKeyboard = nut.keyboard;
  nutKey = nut.Key;
} catch (_) { /* not available */ }

// =============================================
//  PATH RESOLUTION (Phase 1 — production black screen fix)
// =============================================

function resolveIndexHtml() {
  const strategies = [
    // Standard: dist/index.html relative to project root
    path.join(__dirname, "..", "dist", "index.html"),
    // Asar unpacked: resourcesPath
    path.join(process.resourcesPath || "", "dist", "index.html"),
    // App path
    path.join(app.getAppPath(), "dist", "index.html"),
    // Current working directory
    path.join(process.cwd(), "dist", "index.html"),
  ];

  for (const p of strategies) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }

  return null; // No valid path found
}

function resolveErrorHtml() {
  const strategies = [
    path.join(__dirname, "error.html"),
    path.join(app.getAppPath(), "electron", "error.html"),
  ];

  for (const p of strategies) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }

  return null;
}

function loadErrorPage(reason) {
  const errorPath = resolveErrorHtml();
  if (errorPath && mainWindow && !mainWindow.isDestroyed()) {
    const params = new URLSearchParams({
      version: app.getVersion(),
      platform: process.platform,
      cwd: process.cwd(),
      expected: path.join(__dirname, "..", "dist", "index.html"),
      reason: reason || "unknown",
    });
    mainWindow.loadFile(errorPath);
  }
}

// =============================================
//  WINDOW MANAGEMENT
// =============================================
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    minWidth: 1200, minHeight: 700,
    backgroundColor: "#0a0a0f",
    titleBarStyle: "hidden",
    titleBarOverlay: { color: "#0a0a0f", symbolColor: "#ffffff", height: 36 },
    icon: path.join(__dirname, "..", "public", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      sandbox: false,
    },
    show: false,
  });

  // ── Diagnostics ──
  mainWindow.webContents.on("did-start-loading", () => {
    console.log("[ELECTRON] did-start-loading");
  });

  mainWindow.webContents.on("did-finish-load", () => {
    console.log("[ELECTRON] did-finish-load");

    // Step 6: Verify the actual DOM
    mainWindow.webContents.executeJavaScript(`
      JSON.stringify({
        readyState: document.readyState,
        title: document.title,
        rootExists: !!document.getElementById("root"),
        rootHTML: document.getElementById("root")?.innerHTML?.slice(0, 2000),
        bodyHTML: document.body?.innerHTML?.slice(0, 2000),
        bodyText: document.body?.innerText?.slice(0, 1000)
      })
    `).then(result => {
      console.log("[ELECTRON-DOM]", result);
    }).catch(error => {
      console.error("[ELECTRON-DOM-ERROR]", error);
    });

    // Step 7: Check computed visibility
    mainWindow.webContents.executeJavaScript(`
      (() => {
        const root = document.getElementById("root");
        if (root) {
          const style = getComputedStyle(root);
          const rootStyle = {
            display: style.display,
            visibility: style.visibility,
            opacity: style.opacity,
            height: style.height,
            width: style.width,
            position: style.position,
            overflow: style.overflow
          };
          const rootRect = root.getBoundingClientRect().toJSON();

          let firstDescendant = null;
          if (root.firstElementChild) {
            const descStyle = getComputedStyle(root.firstElementChild);
            firstDescendant = {
              tagName: root.firstElementChild.tagName,
              display: descStyle.display,
              visibility: descStyle.visibility,
              opacity: descStyle.opacity,
              rect: root.firstElementChild.getBoundingClientRect().toJSON()
            };
          }

          return JSON.stringify({ rootStyle, rootRect, firstDescendant });
        }
        return "root-not-found";
      })()
    `).then(result => {
      console.log("[ROOT-VISIBILITY]", result);
    }).catch(error => {
      console.error("[ROOT-VISIBILITY-ERROR]", error);
    });
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    console.error("[ELECTRON] did-fail-load", {
      errorCode,
      errorDescription,
      validatedURL
    });
    if (!isDev) {
      loadErrorPage(`load-failed-${errorCode}`);
    }
  });

  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    rendererCrashCount++;
    console.error("[ELECTRON] render-process-gone", details);

    if (rendererCrashCount < MAX_RENDERER_CRASHES) {
      console.log(`[RF] Auto-restarting renderer in 2s (attempt ${rendererCrashCount}/${MAX_RENDERER_CRASHES})`);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.reload();
        }
      }, 2000);
    } else {
      console.error("[RF] Max renderer crashes reached — showing error page");
      loadErrorPage("max-crashes-reached");
    }
  });

  mainWindow.webContents.on("unresponsive", () => {
    console.error("[ELECTRON] renderer UNRESPONSIVE");
    console.error("[RENDERER] UNRESPONSIVE");
  });

  mainWindow.webContents.on("responsive", () => {
    console.log("[ELECTRON] renderer responsive");
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log("[RENDERER-CONSOLE]", {
      level,
      message,
      line,
      sourceId
    });
  });

  // ── Load content ──
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = resolveIndexHtml();
    if (indexPath) {
      mainWindow.loadFile(indexPath);
    } else {
      console.error("[RF] CRITICAL: index.html not found at any expected path");
      loadErrorPage("index.html-not-found");
    }
  }

  // ── Show when ready (prevent white flash) ──
  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  });

  // ── Phase 1: Close handler (graceful shutdown) ──
  mainWindow.on("closed", () => {
    mainWindow = null;
    if (overlayWindow) overlayWindow.close();
    disconnectAllScreens();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // ── Reset crash count after 5 min of stability ──
  if (rendererCrashCount > 0) {
    setTimeout(() => {
      if (rendererCrashCount > 0) rendererCrashCount--;
    }, CRASH_RESET_MS);
  }
}

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) { overlayWindow.focus(); return; }
  overlayWindow = new BrowserWindow({
    width: 500, height: 300, x: 50, y: 50,
    transparent: true, frame: false,
    alwaysOnTop: true, skipTaskbar: true, resizable: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  // In dev, serve overlay from public/ via the Vite dev server
  if (isDev) {
    overlayWindow.loadURL("http://localhost:5173/overlay-widget.html");
  } else {
    overlayWindow.loadFile(path.join(__dirname, "../dist/overlay-widget.html"));
  }
  overlayWindow.on("closed", () => { overlayWindow = null; });
}

function createTray() {
  try {
    tray = new Tray(path.join(__dirname, "..", "public", "icon.ico"));
    const ctx = Menu.buildFromTemplate([
      { label: "Show RosaeFinity", click: () => mainWindow?.show() },
      { label: "Quit", click: () => app.quit() },
    ]);
    tray.setToolTip("RosaeFinity");
    tray.setContextMenu(ctx);
    tray.on("double-click", () => mainWindow?.show());
  } catch (_) { /* icon missing — not fatal */ }
}

// ── Helpers ─────────────────────────────────
function sendToRenderer(ch, data) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(ch, data);
}
function sendToOverlay(ch, data) {
  if (overlayWindow && !overlayWindow.isDestroyed()) overlayWindow.webContents.send(ch, data);
}

function friendlyError(err, username) {
  if (!err) return "Koneksi gagal.";
  let msg = typeof err === "object" ? (err.info || err.message || err.error || JSON.stringify(err)) : String(err);
  const m = msg.toLowerCase();
  if (m.includes("falling back to")) return msg;
  if (m.includes("not live") || m.includes("isn't live") || m.includes("live has ended"))
    return `@${username} sedang tidak live saat ini.`;
  if (m.includes("not found") || m.includes("404") || m.includes("user not found"))
    return `Username @${username} tidak ditemukan.`;
  if (m.includes("429") || m.includes("rate limit")) return "Terlalu banyak percobaan. Tunggu beberapa detik.";
  if (m.includes("enotfound") || m.includes("network") || m.includes("econnrefused"))
    return "Tidak ada koneksi internet.";
  if (m.includes("euler api") || (m.includes("euler") && !m.includes("falling")))
    return "Gagal mendapatkan token TikTok. Coba lagi.";
  return msg;
}

// =============================================
//  KEYSTROKE SIMULATION
// =============================================
async function sendKeystroke(keys, holdMs = 100, eventData) {
  if (!keys) return false;

  // Resolve placeholders from eventData
  let resolvedKeys = keys;
  if (eventData) {
    resolvedKeys = resolvedKeys
      .replace(/\{username\}/gi, eventData.user || "")
      .replace(/\{nickname\}/gi, eventData.nickname || "")
      .replace(/\{giftname\}/gi, eventData.giftName || "")
      .replace(/\{repeatcount\}/gi, String(eventData.repeatCount || ""))
      .replace(/\{coins\}/gi, String(eventData.diamondCount || ""))
      .replace(/\{likecount\}/gi, String(eventData.likeCount || ""))
      .replace(/\{totallikecount\}/gi, String(eventData.totalLikeCount || ""))
      .replace(/\{comment\}/gi, eventData.comment || "")
      .replace(/\{submonth\}/gi, String(eventData.subMonth || ""));
  }

  console.log(`[Keystroke] Attempting to send: "${resolvedKeys}" (hold: ${holdMs}ms)`);

  // Try nut-js first (modern, native Node.js)
  if (nutKeyboard && nutKey) {
    try {
      const parts = resolvedKeys.split("+").map(k => k.trim());
      const modifiers = [];
      let key = null;
      for (const p of parts) {
        const l = p.toLowerCase();
        if (["control", "shift", "alt", "meta", "command"].includes(l)) modifiers.push(l === "command" ? "meta" : l);
        else key = p;
      }
      // Map key to nut-js Key enum
      const keyMapNut = {
        "ENTER": nutKey.Enter, "TAB": nutKey.Tab, "ESCAPE": nutKey.Escape, "ESC": nutKey.Escape,
        "BACKSPACE": nutKey.Backspace, "DELETE": nutKey.Delete, "DEL": nutKey.Delete,
        "SPACE": nutKey.Space, "SPACEBAR": nutKey.Space,
        "UP": nutKey.Up, "DOWN": nutKey.Down, "LEFT": nutKey.Left, "RIGHT": nutKey.Right,
        "ARROWUP": nutKey.Up, "ARROWDOWN": nutKey.Down, "ARROWLEFT": nutKey.Left, "ARROWRIGHT": nutKey.Right,
        "HOME": nutKey.Home, "END": nutKey.End, "PAGEUP": nutKey.PageUp, "PAGEDOWN": nutKey.PageDown,
        "PGUP": nutKey.PageUp, "PGDN": nutKey.PageDown,
        "F1": nutKey.F1, "F2": nutKey.F2, "F3": nutKey.F3, "F4": nutKey.F4, "F5": nutKey.F5,
        "F6": nutKey.F6, "F7": nutKey.F7, "F8": nutKey.F8, "F9": nutKey.F9, "F10": nutKey.F10, "F11": nutKey.F11, "F12": nutKey.F12,
        // Letters A-Z
        "A": nutKey.A, "B": nutKey.B, "C": nutKey.C, "D": nutKey.D, "E": nutKey.E, "F": nutKey.F,
        "G": nutKey.G, "H": nutKey.H, "I": nutKey.I, "J": nutKey.J, "K": nutKey.K, "L": nutKey.L,
        "M": nutKey.M, "N": nutKey.N, "O": nutKey.O, "P": nutKey.P, "Q": nutKey.Q, "R": nutKey.R,
        "S": nutKey.S, "T": nutKey.T, "U": nutKey.U, "V": nutKey.V, "W": nutKey.W, "X": nutKey.X,
        "Y": nutKey.Y, "Z": nutKey.Z,
        // Numbers 0-9
        "0": nutKey.Num0, "1": nutKey.Num1, "2": nutKey.Num2, "3": nutKey.Num3, "4": nutKey.Num4,
        "5": nutKey.Num5, "6": nutKey.Num6, "7": nutKey.Num7, "8": nutKey.Num8, "9": nutKey.Num9,
      };

      const nutKeyCode = keyMapNut[key?.toUpperCase()] || nutKey[key] || key;
      if (nutKeyCode) {
        // Press modifiers
        for (const mod of modifiers) {
          if (mod === "control") await nutKeyboard.pressKey(nutKey.LeftControl);
          else if (mod === "shift") await nutKeyboard.pressKey(nutKey.LeftShift);
          else if (mod === "alt") await nutKeyboard.pressKey(nutKey.LeftAlt);
          else if (mod === "meta") await nutKeyboard.pressKey(nutKey.LeftMeta);
        }
        // Press main key
        await nutKeyboard.pressKey(nutKeyCode);
        // Hold
        await new Promise(r => setTimeout(r, holdMs));
        // Release main key
        await nutKeyboard.releaseKey(nutKeyCode);
        // Release modifiers (reverse order)
        for (const mod of [...modifiers].reverse()) {
          if (mod === "control") await nutKeyboard.releaseKey(nutKey.LeftControl);
          else if (mod === "shift") await nutKeyboard.releaseKey(nutKey.LeftShift);
          else if (mod === "alt") await nutKeyboard.releaseKey(nutKey.LeftAlt);
          else if (mod === "meta") await nutKeyboard.releaseKey(nutKey.LeftMeta);
        }
        console.log("[Keystroke] Sent via nut-js successfully");
        return true;
      }
    } catch (err) {
      console.warn("[Keystroke] nut-js failed:", err.message);
    }
  } else {
    console.log("[Keystroke] nut-js not available");
  }

  // Try robotjs
  if (robot) {
    try {
      const parts = resolvedKeys.split("+").map(k => k.trim());
      const modifiers = [];
      let key = null;
      for (const p of parts) {
        const l = p.toLowerCase();
        if (["ctrl", "shift", "alt", "meta", "command"].includes(l)) modifiers.push(l === "command" ? "meta" : l);
        else key = p;
      }
      if (key) {
        for (const mod of modifiers) robot.keyToggle(mod, "down");
        robot.keyToggle(key, "down");
        setTimeout(() => {
          robot.keyToggle(key, "up");
          for (const mod of modifiers) robot.keyToggle(mod, "up");
        }, holdMs);
        console.log("[Keystroke] Sent via robotjs successfully");
        return true;
      }
    } catch (err) {
      console.warn("[Keystroke] robotjs failed:", err.message);
    }
  } else {
    console.log("[Keystroke] robotjs not available");
  }

  // Windows PowerShell SendKeys (most reliable on Windows)
  const keyMap = {
    ENTER: "{ENTER}", TAB: "{TAB}", ESCAPE: "{ESC}", ESC: "{ESC}",
    BACKSPACE: "{BACKSPACE}", BKSP: "{BACKSPACE}",
    DELETE: "{DELETE}", DEL: "{DELETE}",
    SPACE: " ", SPACEBAR: " ",
    UP: "{UP}", DOWN: "{DOWN}", LEFT: "{LEFT}", RIGHT: "{RIGHT}",
    ARROWUP: "{UP}", ARROWDOWN: "{DOWN}", ARROWLEFT: "{LEFT}", ARROWRIGHT: "{RIGHT}",
    HOME: "{HOME}", END: "{END}", PAGEUP: "{PGUP}", PAGEDOWN: "{PGDN}",
    PGUP: "{PGUP}", PGDN: "{PGDN}",
    F1: "{F1}", F2: "{F2}", F3: "{F3}", F4: "{F4}", F5: "{F5}",
    F6: "{F6}", F7: "{F7}", F8: "{F8}", F9: "{F9}", F10: "{F10}", F11: "{F11}", F12: "{F12}",
  };
  const modMap = { ctrl: "^", control: "^", shift: "+", shiftkey: "+", alt: "%", altkey: "%" };

  function comboToPsKeys(combo) {
    const parts = combo.split("+").map(p => p.trim());
    const mainKey = parts.pop().toUpperCase();
    const modifiers = parts.map(p => p.toLowerCase());
    const specialKey = keyMap[mainKey] || keyMap[mainKey.toUpperCase()];
    let psKey = specialKey || mainKey;
    let result = psKey;
    // Keep modifiers in original order (Ctrl+Shift+L → ^+L, not +^L)
    modifiers.forEach(mod => {
      const mc = modMap[mod];
      if (mc) result = mc + result;
    });
    return result;
  }

  const sequences = resolvedKeys.split(/\s+/).filter(s => s.length > 0);
  let psSendKeys = "";
  sequences.forEach(seq => {
    if (seq.includes("+")) {
      psSendKeys += comboToPsKeys(seq);
    } else {
      const upper = seq.toUpperCase();
      const sk = keyMap[upper];
      if (sk) psSendKeys += sk;
      else if (upper.length === 1) psSendKeys += upper;
      else seq.split("").forEach(ch => { const u = ch.toUpperCase(); psSendKeys += (keyMap[u] || u); });
    }
  });

  const psCmd = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${psSendKeys.replace(/'/g, "''")}')"`;

  console.log(`[Keystroke] Executing PowerShell command: ${psCmd}`);

  return new Promise((resolve) => {
    exec(psCmd, { timeout: 5000 }, (err) => {
      if (err) {
        console.error("[Keystroke] PowerShell SendKeys failed:", err.message);
        // Fallback: Electron sendInputEvent (only works for focused Electron window)
        if (mainWindow && !mainWindow.isDestroyed()) {
          console.log("[Keystroke] Falling back to Electron sendInputEvent");
          sequences.forEach((seq, i) => {
            setTimeout(() => {
              try {
                const kc = seq.toUpperCase();
                mainWindow.webContents.sendInputEvent({ type: "keyDown", keyCode: kc });
                setTimeout(() => mainWindow.webContents.sendInputEvent({ type: "keyUp", keyCode: kc }), holdMs);
              } catch (_) {}
            }, i * holdMs);
          });
          resolve(true);
        } else {
          resolve(false);
        }
      } else {
        console.log("[Keystroke] Sent via PowerShell SendKeys successfully");
        resolve(true);
      }
    });
  });
}

// =============================================
//  TIKTOK SERVICE ADAPTER (per-screen)
// =============================================
let tiktokService = null;

function getTikTokServiceInstance() {
  if (!tiktokService) {
    tiktokService = getTikTokService();
    // Forward service events to renderer and overlay
    tiktokService.on("event", (event) => {
      const { type, screenId, ...data } = event;
      if (type === "connected") {
        sendToRenderer("tiktok:connected", { screenId, ...data });
        sendToOverlay("overlay:connected", { screenId, username: data.username });
      } else if (type === "disconnected") {
        sendToRenderer("tiktok:disconnected", { screenId, reason: data.reason });
        sendToOverlay("overlay:disconnected", { screenId });
      } else if (type === "error") {
        sendToRenderer("tiktok:error", { screenId, message: data.message });
      } else if (type === "reconnecting") {
        sendToRenderer("tiktok:reconnecting", { screenId, attempt: data.attempt });
      } else if (type === "viewer-update") {
        sendToRenderer("tiktok:viewers", { screenId, viewerCount: data.viewerCount });
      } else {
        // All other events (gift, like, comment, follow, share, subscribe, member)
        sendToRenderer("tiktok:event", { type, screenId, ...data });
        sendToOverlay("overlay:event", { type, screenId, ...data });
      }
    });
  }
  return tiktokService;
}

async function connectTikTok(screenId, username) {
  try {
    const service = getTikTokServiceInstance();
    await service.connect(screenId, username);
  } catch (err) {
    console.error(`[TIKTOK] connect failed for ${screenId}:`, err.message);
  }
}

function disconnectTikTok(screenId) {
  const service = getTikTokServiceInstance();
  service.disconnect(screenId).catch((err) => {
    console.error(`[TIKTOK] disconnect failed for ${screenId}:`, err.message);
  });
}

function manualReconnect(screenId, username) {
  const service = getTikTokServiceInstance();
  // Reset any lock and reconnect
  service.disconnect(screenId).then(() => {
    service.connect(screenId, username).catch((err) => {
      console.error(`[TIKTOK] manual reconnect failed for ${screenId}:`, err.message);
    });
  });
}

// =============================================
//  IPC HANDLERS
// =============================================

// ── TikTok (per-screen) ──
ipcMain.on("tiktok:connect", (_, { screenId, username }) => manualReconnect(screenId, username));
ipcMain.on("tiktok:disconnect", (_, { screenId }) => { disconnectTikTok(screenId); sendToRenderer("tiktok:disconnected", { screenId }); });

// ── Overlay ──
ipcMain.on("overlay:open", () => createOverlayWindow());
ipcMain.on("overlay:close", () => { if (overlayWindow) overlayWindow.close(); });
ipcMain.on("overlay:send", (_, data) => {
  sendToOverlay("overlay:action", data);
  broadcastSSE(data);
});

// ── Keystroke ──
ipcMain.on("keystroke:send", async (_, { keys, holdMs, eventData }) => {
  console.log(`[Keystroke IPC] on called: keys="${keys}", holdMs=${holdMs}, eventData=${JSON.stringify(eventData)}`);
  await sendKeystroke(keys, holdMs, eventData);
});
// Also handle invoke-style (used by ActionsPage testAction)
ipcMain.handle("send-keystroke", async (_, keys, holdMs, eventData) => {
  console.log(`[Keystroke IPC] invoke called: keys="${keys}", holdMs=${holdMs}, eventData=${JSON.stringify(eventData)}`);
  return await sendKeystroke(keys, holdMs || 100, eventData || null);
});

// ── Global Input Hook (keyboard + mouse capture) ──
ipcMain.handle("global-hook:start", (_, screen) => {
  console.log("[GlobalHook] Starting global input hook for screen:", screen);
  const started = startGlobalHook((type, data) => {
    // Forward events to renderer via IPC
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("global-hook:event", { type, ...data, screen: screen || "1" });
    }
    // Also broadcast to SSE for Browser Source
    broadcastSSE({
      type: "keystroke",
      source: "global-hook",
      event: type,
      ...data,
      screen: screen || "1",
      timestamp: Date.now(),
    });
  });
  return { success: started, running: isHookRunning() };
});

ipcMain.handle("global-hook:stop", () => {
  console.log("[GlobalHook] Stopping global input hook");
  stopGlobalHook();
  return { success: true };
});

ipcMain.handle("global-hook:status", () => {
  return { running: isHookRunning() };
});

// ── Gifts ──
ipcMain.on("gift:request", async () => {
  const gifts = await muatGiftTikTok();
  sendToRenderer("gift:list", gifts);
});
ipcMain.on("gift:refresh", async () => {
  const gifts = await muatGiftTikTok(true);
  sendToRenderer("gift:list", gifts);
});

// ── Window Controls ──
ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:maximize", () => { if (mainWindow) mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
ipcMain.on("window:close", () => mainWindow?.close());
ipcMain.on("open:external", (_, url) => shell.openExternal(url));

// ── System Theme ──
ipcMain.handle("get-system-theme", () => nativeTheme.shouldUseDarkColors ? "dark" : "light");
nativeTheme.on("updated", () => {
  sendToRenderer("system-theme-changed", nativeTheme.shouldUseDarkColors ? "dark" : "light");
});
ipcMain.handle("get-app-version", () => app.getVersion());
ipcMain.handle("get-platform", () => process.platform);

// ── Points System ──
ipcMain.on("points:syncConfig", (_, data) => pointsSystem.syncConfigFromSetup(data));
ipcMain.on("points:award", (_, { type, username, nickname, isSubscriber }) => {
  const r = pointsSystem.awardPoints(type, username, nickname, isSubscriber);
  sendToRenderer("points:awarded", { username, ...r, type });
});
ipcMain.handle("points:getAll", () => pointsSystem.getAllUsers());
ipcMain.handle("points:getUser", (_, username) => pointsSystem.getUser(username));
ipcMain.handle("points:getTop", (_, limit) => pointsSystem.getTopUsers(limit));
ipcMain.handle("points:getCount", () => pointsSystem.getUserCount());
ipcMain.on("points:resetAll", () => { pointsSystem.resetAllPoints(); sendToRenderer("points:reset", { success: true }); });
ipcMain.on("points:halve", (_, percent) => { pointsSystem.halvePoints(percent); sendToRenderer("points:halved", { success: true, percent }); });
ipcMain.on("points:toggleChallenge", (_, active) => pointsSystem.toggleChallenge(active));
ipcMain.handle("points:deduct", (_, { username, amount }) => pointsSystem.deductPoints(username, amount));

// ── OBS Controller ──
ipcMain.on("obs:setConfig", (_, config) => obsController.setConfig(config));
ipcMain.handle("obs:connect", async () => await obsController.connect());
ipcMain.handle("obs:disconnect", () => { obsController.disconnect(); return { success: true }; });
ipcMain.handle("obs:test", async (_, { ip, port, password }) => await obsController.testConnection(ip, port, password));
ipcMain.handle("obs:status", () => ({ connected: obsController.isConnected() }));
ipcMain.handle("obs:switchScene", async (_, { sceneName }) => await obsController.switchScene(sceneName));
ipcMain.handle("obs:getScenes", async () => await obsController.getSceneList());
ipcMain.handle("obs:toggleSource", async (_, { sceneName, sourceName }) => await obsController.toggleSource(sceneName, sourceName));

// ── Streamer.bot ──
ipcMain.on("sb:setConfig", (_, config) => streamerbot.setConfig(config));
ipcMain.handle("sb:connect", async () => await streamerbot.connect());
ipcMain.handle("sb:disconnect", () => { streamerbot.disconnect(); return { success: true }; });
ipcMain.handle("sb:test", async (_, { address, port, endpoint }) => await streamerbot.testConnection(address, port, endpoint));
ipcMain.handle("sb:status", () => ({ connected: streamerbot.isConnected() }));
ipcMain.on("sb:trigger", (_, { actionName, eventData }) => streamerbot.triggerAction(actionName, eventData));

// ── Minecraft ──
ipcMain.on("mc:setConfig", (_, config) => minecraft.setConfig(config));
ipcMain.handle("mc:test", async (_, { ip, port, password, mode }) => await minecraft.testConnection(ip, port, password, mode));
ipcMain.handle("mc:status", () => ({ config: minecraft.config }));
ipcMain.handle("mc:execute", async (_, { command }) => await minecraft.executeCommand(command));
ipcMain.handle("mc:server", async () => await minecraft.getServerStatus());
ipcMain.handle("mc:players", async () => await minecraft.getOnlinePlayers());

// ── License ──
ipcMain.handle("license:status", () => licenseSystem.checkLicense());
ipcMain.handle("license:activate", (_, { key, email }) => licenseSystem.activateLicense(key, email));
ipcMain.handle("license:deactivate", () => licenseSystem.deactivateLicense());
ipcMain.handle("license:plan", () => licenseSystem.getPlan());
ipcMain.handle("license:isPro", () => licenseSystem.isPro());
ipcMain.handle("license:limits", () => licenseSystem.getPlanLimits());
ipcMain.handle("license:validateAction", (_, count) => licenseSystem.validateActionLimit(count));
ipcMain.handle("license:validateSound", (_, count) => licenseSystem.validateSoundLimit(count));
ipcMain.handle("license:userData", () => licenseSystem.getUserData());

// ── Auth ──
ipcMain.handle("auth:register", (_, { email, password, name }) => authSystem.registerEmail(email, password, name));
ipcMain.handle("auth:login", (_, { email, password, rememberMe }) => authSystem.loginEmail(email, password, rememberMe));
ipcMain.handle("auth:google", (_, googleData) => authSystem.loginGoogle(googleData));
ipcMain.handle("auth:logout", () => authSystem.logout());
ipcMain.handle("auth:currentUser", () => authSystem.getCurrentUser());
ipcMain.handle("auth:validateSession", () => authSystem.validateSession());

// ── Admin (proxied to backend API) ──
const { apiUrl } = require("./backend/api-config.cjs");
async function adminApiRequest(method, endpoint, body) {
  // Use validateSession which handles token refresh automatically
  let token = null;
  try {
    const session = await authSystem.validateSession();
    if (session && session.valid && session.token) token = session.token;
  } catch {}
  return new Promise((resolve) => {
    const url = new URL(`${apiUrl}${endpoint}`);
    const postData = body ? JSON.stringify(body) : null;
    const headers = {
      "Content-Type": "application/json",
      ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {}),
      ...(token ? { "Authorization": `Bearer ${token}` } : {}),
    };
    const req = http.request({ hostname: url.hostname, port: url.port, path: url.pathname + url.search, method, headers, timeout: 15000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try { resolve({ success: res.statusCode >= 200 && res.statusCode < 300, data: JSON.parse(data) }); }
        catch { resolve({ success: false, error: "Invalid response" }); }
      });
    });
    req.on("timeout", () => { req.destroy(); resolve({ success: false, error: "Request timeout" }); });
    req.on("error", (err) => { resolve({ success: false, error: err.message }); });
    if (postData) req.write(postData);
    req.end();
  });
}
ipcMain.handle("admin:searchUsers", (_, query) => adminApiRequest("GET", `/admin/users?q=${encodeURIComponent(query || "")}`));
ipcMain.handle("admin:userDetail", (_, userId) => adminApiRequest("GET", `/admin/users/${userId}`));
ipcMain.handle("admin:extendLicense", (_, userId, days) => adminApiRequest("POST", `/admin/users/${userId}/extend`, { days }));
ipcMain.handle("admin:downgradeUser", (_, userId) => adminApiRequest("POST", `/admin/users/${userId}/downgrade`));

// ── Stream Profiles ──
ipcMain.handle("auth:profileLimit", () => {
  const user = authSystem.getCurrentUserSync();
  if (!user) return { limit: 1, current: 0 };
  const profiles = authSystem.getUserStreamProfiles(user.id);
  return { limit: authSystem.getProfileLimit(user.id), current: profiles.length };
});
ipcMain.handle("auth:getProfiles", () => {
  const user = authSystem.getCurrentUserSync();
  return user ? authSystem.getUserStreamProfiles(user.id) : [];
});
ipcMain.handle("auth:createProfile", (_, profileData) => {
  const user = authSystem.getCurrentUserSync();
  return user ? authSystem.createStreamProfile(user.id, profileData) : { success: false, error: "Not logged in" };
});
ipcMain.handle("auth:updateProfile", (_, { profileId, updates }) => {
  const user = authSystem.getCurrentUserSync();
  return user ? authSystem.updateStreamProfile(user.id, profileId, updates) : { success: false, error: "Not logged in" };
});
ipcMain.handle("auth:deleteProfile", (_, { profileId }) => {
  const user = authSystem.getCurrentUserSync();
  return user ? authSystem.deleteStreamProfile(user.id, profileId) : { success: false, error: "Not logged in" };
});
ipcMain.handle("auth:setCurrentProfile", (_, { profileId }) => authSystem.setCurrentStreamProfile(profileId));
ipcMain.handle("auth:getCurrentProfile", () => {
  const user = authSystem.getCurrentUserSync();
  return user ? authSystem.getCurrentStreamProfile(user.id) : null;
});
ipcMain.handle("auth:exportProfile", (_, { profileId }) => {
  const user = authSystem.getCurrentUserSync();
  return user ? authSystem.exportStreamProfile(user.id, profileId) : { success: false, error: "Not logged in" };
});
ipcMain.handle("auth:importProfile", (_, profileData) => {
  const user = authSystem.getCurrentUserSync();
  return user ? authSystem.importStreamProfile(user.id, profileData) : { success: false, error: "Not logged in" };
});

// ── Spotify ──
ipcMain.on("spotify:setConfig", (_, config) => spotify.setConfig(config));

ipcMain.handle("spotify:auth", async (_, { clientId }) => {
  const authInfo = spotify.getAuthUrl(clientId);
  if (!authInfo) return { success: false, error: "Client ID required" };

  return new Promise((resolve) => {
    let done = false;
    const authWindow = new BrowserWindow({
      width: 600, height: 750,
      title: "RosaeFinity — Spotify Login",
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    const pollTimer = setInterval(() => {
      try {
        const url = authWindow.webContents.getURL();
        if (!url || url === "about:blank") return;
        if (url.includes("127.0.0.1:8890/callback")) {
          clearInterval(pollTimer); done = true;
          const u = new URL(url);
          const code = u.searchParams.get("code");
          const error = u.searchParams.get("error");
          try { authWindow.close(); } catch (_) {}
          if (error) resolve({ success: false, error });
          else if (code) spotify.exchangeCode(code, authInfo.verifier, authInfo.clientId).then(resolve);
          else resolve({ success: false, error: "No authorization code" });
        }
      } catch (_) {}
    }, 1000);

    authWindow.webContents.on("did-fail-load", (_, __, ___, url) => {
      if (done || !url || !url.includes("127.0.0.1:8890/callback")) return;
      clearInterval(pollTimer); done = true;
      const u = new URL(url);
      const code = u.searchParams.get("code");
      try { authWindow.close(); } catch (_) {}
      if (code) spotify.exchangeCode(code, authInfo.verifier, authInfo.clientId).then(resolve);
      else resolve({ success: false, error: "No code in redirect" });
    });

    authWindow.on("closed", () => { clearInterval(pollTimer); if (!done) { done = true; resolve({ success: false, error: "Window closed" }); } });
    authWindow.loadURL(authInfo.url);
  });
});

ipcMain.handle("spotify:exchange", async (_, { code, verifier, clientId }) => await spotify.exchangeCode(code, verifier, clientId));
ipcMain.handle("spotify:status", () => spotify.getAuthStatus());
ipcMain.handle("spotify:test", async () => await spotify.testConnection());
ipcMain.handle("spotify:search", async (_, { query, limit }) => await spotify.searchTracks(query, limit || 10));
ipcMain.handle("spotify:addToQueue", async (_, { uri }) => await spotify.addToQueue(uri));
ipcMain.handle("spotify:skip", async () => await spotify.skipTrack());
ipcMain.handle("spotify:playback", async () => await spotify.getPlaybackState());
ipcMain.handle("spotify:devices", async () => await spotify.getDevices());
ipcMain.handle("spotify:queue", () => spotify.getQueue());
ipcMain.handle("spotify:pushQueue", (_, { user, nickname, track }) => spotify.pushToQueue({ user, nickname, track }));
ipcMain.handle("spotify:removeUser", (_, { username }) => spotify.removeUserFromQueue(username));
ipcMain.handle("spotify:clearQueue", () => spotify.clearQueue());

// ═════════════════════════════════════════════
//  SCREEN CAPTURE
// ═════════════════════════════════════════════

ipcMain.handle("capture:getSources", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
      thumbnailSize: { width: 320, height: 180 },
    });
    return sources.map(s => ({
      id: s.id,
      name: s.name,
      thumbnailDataURL: s.thumbnail.toDataURL(),
      display_id: s.display_id,
      appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
    }));
  } catch (err) {
    console.error("[RF] capture:getSources error:", err);
    return [];
  }
});

ipcMain.handle("capture:setSource", (_, sourceId) => {
  _capturePendingSourceId = sourceId;
  return { success: true };
});

// ═════════════════════════════════════════════
//  PHASE 2: DIAGNOSTICS & LOGGING
// ═════════════════════════════════════════════

ipcMain.handle("diagnostics:get", () => {
  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    platform: `${process.platform} ${process.arch}`,
    uptime: process.uptime(),
    memory: memoryManager ? memoryManager.getStats() : {},
    services: serviceMonitor ? serviceMonitor.getStatus() : {},
    ipcListeners: memoryManager ? [...memoryManager.ipcListeners.keys()] : [],
    sseStatus: sseClients.length > 0 ? "connected" : "idle",
  };
});

ipcMain.handle("logs:export", () => {
  return logger ? logger.exportLogs() : "";
});

ipcMain.handle("service:restart", async (_, serviceName) => {
  if (!serviceMonitor) return { success: false, error: "Service monitor not initialized" };
  try {
    await serviceMonitor.manualRestart(serviceName);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// =============================================
//  APP LIFECYCLE
// =============================================
app.whenReady().then(async () => {
  // ── Phase 2: Initialize stability modules ──
  const logger = new Logger();
  const memoryManager = new MemoryManager(logger);
  const serviceMonitor = new ServiceMonitor(logger, memoryManager);

  logger.info("Application starting", { version: app.getVersion() });

  createMainWindow();
  createTray();
  startSSEServer();

  // Set main window for service monitor notifications
  serviceMonitor.setMainWindow(mainWindow);

  // ── Register services for monitoring ──
  serviceMonitor.register("sse-server", {
    healthCheck: () => {
      return new Promise((resolve) => {
        const http = require("http");
        const req = http.get(`http://127.0.0.1:${SSE_PORT}/events`, { timeout: 2000 }, (res) => {
          res.resume();
          resolve(true);
        });
        req.on("error", () => resolve(false));
        req.on("timeout", () => { req.destroy(); resolve(false); });
      });
    },
    restart: async () => {
      // SSE server restart is handled by the existing server
      logger.info("SSE server restart requested");
    },
    isCritical: true,
  });

  serviceMonitor.register("global-hook", {
    healthCheck: () => Promise.resolve(isHookRunning() || true), // Not always needed
    restart: async () => {
      logger.info("Global hook restart requested");
    },
    isCritical: false,
  });

  serviceMonitor.start();
  memoryManager.startMonitor();
  logger.info("Phase 2 stability modules initialized");

  // Init backend systems
  licenseSystem.initLicense();
  authSystem.initAuth();
  pointsSystem.initPointsSystem();
  logger.info("Backend loaded: points, obs, streamerbot, minecraft, spotify, license, auth");

  // Pre-fetch gifts in background
  muatGiftTikTok().then(gifts => console.log(`[RF] ${gifts.length} gifts loaded`)).catch(() => {});

  // ── Register display media handler for screen capture ──
  session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
    if (_capturePendingSourceId) {
      const allSources = desktopCapturer.getSourcesSync({ types: ["window", "screen"] });
      const match = allSources.find(s => s.id === _capturePendingSourceId);
      if (match) {
        _capturePendingSourceId = null;
        callback({ video: match, audio: "loopback" });
        return;
      }
    }
    _capturePendingSourceId = null;
    callback({ cancel: true });
  });
  console.log("[RF] Display media handler registered for screen capture");

  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createMainWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

// ── Phase 1+2: Graceful shutdown ──
app.on("before-quit", async (e) => {
  if (isQuitting) return;
  isQuitting = true;
  if (logger) logger.info("Application shutting down gracefully");
  disconnectAllScreens();
  if (memoryManager) await memoryManager.cleanupAll();
});

// ── Phase 1: Global error handlers ──
process.on("uncaughtException", (error) => {
  console.error("[RF] Uncaught exception:", error.message);
  console.error("[RF] Stack:", error.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error("[RF] Unhandled promise rejection:", reason);
});
