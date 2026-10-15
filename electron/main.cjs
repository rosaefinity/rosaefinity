// =============================================
// RosaeFinity - electron/main.cjs
// Electron Main Process (v2 — full backend)
// =============================================
// Boot diagnostics — debug only
if (process.env.RF_DEBUG === "1" || process.argv.includes("--dev")) {
  console.log("[TIKTOK-MAIN-BOOT]", __filename);
  console.log("[TIKTOK-MAIN-PID]", process.pid);
}

const { app, BrowserWindow, ipcMain, nativeTheme, Menu, Tray, shell, desktopCapturer, session, screen } = require("electron");
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
const updateManager = require("./backend/update-manager.cjs");
const { getTikTokService } = require("./backend/tiktok-service.cjs");
const localTTS = require("./backend/local-tts.cjs");
const { createMediaRegistry } = require("./backend/media-registry.cjs");

// ── FIX 1+2: In-process media registry for /media/{mediaId} ──
// Media bytes arrive from the renderer via IPC after Dexie resolution.
// The HTTP route never accepts filesystem paths from clients.
const mediaRegistry = createMediaRegistry();
const MEDIA_HTTP_PORT = 18890;

// ── Phase 2: Stability Modules ──────────────
const { Logger } = require("./logger.cjs");
const { MemoryManager } = require("./memory-manager.cjs");
const { ServiceMonitor } = require("./service-monitor.cjs");

const isDev = process.env.NODE_ENV === "development" || process.argv.includes("--dev");
const isDebug = isDev || process.env.RF_DEBUG === "1";

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
let storedGoalConfig = null; // Latest Goal Progress config for browser sources

// ── v3.1 Instance-based browser source registry ──
// Maps browserSourceId → OverlayInstance (synced from renderer via IPC)
const overlayInstancesByBrowserSourceId = new Map();

function broadcastSSE(data) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  sseClients = sseClients.filter(res => {
    try { res.write(payload); return true; } catch (_) { return false; }
  });
}

function startSSEServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${SSE_PORT}`);

      // ── UNIVERSAL REQUEST LOGGER (debug only) ──
      if (isDebug) {
        const ua = req.headers["user-agent"] || "unknown";
        const referer = req.headers["referer"] || "none";
        const origin = req.headers["origin"] || "none";
        console.log("[HTTP-IN] " + req.method + " " + url.pathname + " UA=" + ua.substring(0, 80) + " REFERER=" + referer.substring(0, 60));
      }

      // ── Main App HTML (desktop UI) - serves dist/index.html for production ──
      if ((url.pathname === "/" || url.pathname === "/index.html") && req.method === "GET") {
        if (!isDev) {
          // Production: serve dist/index.html so /assets/* resolves correctly via HTTP
          const htmlStrategies = [
            path.join(__dirname, "../dist/index.html"),
            path.join(process.resourcesPath || "", "dist", "index.html"),
            path.join(app.getAppPath(), "dist", "index.html"),
            path.join(process.cwd(), "dist", "index.html"),
          ];

          let served = false;
          for (const htmlPath of htmlStrategies) {
            try {
              if (!fs.existsSync(htmlPath)) continue;
              const html = fs.readFileSync(htmlPath, "utf-8");
              if (isDebug) {
                console.log('[SERVER] Serving desktop UI index.html', {
                  requestedUrl: req.url,
                  resolvedFilePath: htmlPath,
                  contentLength: html.length,
                  timestamp: Date.now(),
                });
              }
              res.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8",
                "Cache-Control": "no-cache",
                "Access-Control-Allow-Origin": "*",
              });
              res.end(html);
              served = true;
              break;
            } catch (_) {}
          }
          if (!served) {
            console.error('[SERVER] index.html not found in any strategy', { strategies: htmlStrategies });
            res.writeHead(404); res.end("App not found");
          }
          return;
        }
        // Dev mode: let Vite dev server handle / via proxy (or return 404 so mainWindow loads from Vite directly)
        // We intentionally don't serve index.html here in dev mode.
      }

      // ── SSE stream endpoint ──
      if (url.pathname === "/events" && req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });
        res.write(":\n\n"); // initial comment to flush headers
        // Push stored Goal Progress config to newly connected client
        if (storedGoalConfig) {
          res.write(`data: ${JSON.stringify({ type: 'goal-config-update', config: storedGoalConfig })}\n\n`);
        }
        sseClients.push(res);
        req.on("close", () => { sseClients = sseClients.filter(c => c !== res); });
        return;
      }

      // ── Health check endpoint ──
      if (url.pathname === "/health") {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify({
          status: "ok",
          sseClients: sseClients.length,
          uptime: process.uptime(),
          timestamp: Date.now(),
          media: mediaRegistry.stats(),
        }));
        return;
      }

      // ── Local media endpoint (FIX 1+2) ──
      // Serves only media previously registered via IPC (Dexie-resolved).
      // Unknown ids → 404. No filesystem path acceptance.
      if (url.pathname.startsWith("/media/") && req.method === "GET") {
        const rawId = decodeURIComponent(url.pathname.slice("/media/".length));
        const entry = mediaRegistry.get(rawId);
        if (!entry) {
          if (isDebug) {
            console.log("[HTTP-MEDIA]", JSON.stringify({
              mediaId: rawId,
              status: 404,
              reason: "not-registered",
            }));
          }
          res.writeHead(404, {
            "Content-Type": "text/plain; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          });
          res.end("Media not found");
          return;
        }

        const size = entry.size;
        const rangeHeader = req.headers.range;
        const headersBase = {
          "Content-Type": entry.contentType,
          "Accept-Ranges": "bytes",
          "Access-Control-Allow-Origin": "*",
          // mediaId is content-hashed on re-register; safe to cache long-term
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-RF-Media-Hash": entry.hash,
        };

        if (rangeHeader) {
          const m = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
          if (m) {
            let start = m[1] === "" ? Math.max(0, size - Number(m[2])) : Number(m[1]);
            let end = m[2] === "" ? size - 1 : Number(m[2]);
            if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || end >= size || start > end) {
              res.writeHead(416, {
                "Content-Range": `bytes */${size}`,
                ...headersBase,
              });
              res.end();
              return;
            }
            const chunk = entry.buffer.subarray(start, end + 1);
            res.writeHead(206, {
              ...headersBase,
              "Content-Range": `bytes ${start}-${end}/${size}`,
              "Content-Length": chunk.length,
            });
            res.end(chunk);
            return;
          }
        }

        res.writeHead(200, {
          ...headersBase,
          "Content-Length": size,
        });
        res.end(entry.buffer);
        return;
      }

      // ── Overlay widget HTML ──
    if (url.pathname === "/overlay-widget.html" || url.pathname === "/overlay-widget") {
      const htmlPath = isDev
        ? path.join(__dirname, "../public/overlay-widget.html")
        : path.join(__dirname, "../dist/overlay-widget.html");
      try {
        const fileExists = fs.existsSync(htmlPath);
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

    // ── Coin Jar Browser Source HTML ──
    if (url.pathname === "/coin-jar.html" || url.pathname === "/coin-jar") {
      if (isDev) {
        // Dev mode: serve coin-jar.html with dev entry point (references /src/ paths)
        const devHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RosaeFinity Coin Jar</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      background: transparent;
      overflow: hidden;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }
    #root { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/coin-jar-entry.tsx"></script>
</body>
</html>`;
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(devHtml);
      } else {
        // Production mode: serve built coin-jar.html
        const htmlStrategies = [
          path.join(__dirname, "../dist/coin-jar.html"),
          path.join(process.resourcesPath || "", "dist", "coin-jar.html"),
          path.join(app.getAppPath(), "dist", "coin-jar.html"),
          path.join(process.cwd(), "dist", "coin-jar.html"),
        ];

        let served = false;
        for (const htmlPath of htmlStrategies) {
          try {
            if (!fs.existsSync(htmlPath)) continue;
            const html = fs.readFileSync(htmlPath, "utf-8");
            res.writeHead(200, {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store, no-cache, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(html);
            served = true;
            break;
          } catch (_) {}
        }
        if (!served) {
          console.error('[COIN-JAR-SSE] coin-jar.html not found in any strategy', {
            strategies: htmlStrategies,
            timestamp: Date.now(),
          });
          res.writeHead(404); res.end("Coin Jar overlay not found");
        }
      }
      return;
    }

    // ── Goals overlay ──
    // EXACT same pattern as Coin Jar Pro: dev inline HTML + Vite module proxy.
    if (url.pathname === "/goals-widget.html" || url.pathname === "/goals-widget") {
      if (isDev) {
        // Dev mode: serve goals-widget.html with dev entry point (references /src/ paths)
        const devHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>RosaeFinity Goal Progress</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100%; height: 100%;
      background: transparent;
      overflow: hidden;
      font-family: 'Segoe UI', system-ui, sans-serif;
    }
    #root { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/goals/goal-entry.tsx"></script>
</body>
</html>`;
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store, no-cache, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(devHtml);
      } else {
        // Production mode: serve built goals-widget.html
        const htmlStrategies = [
          path.join(__dirname, "../dist/goals-widget.html"),
          path.join(process.resourcesPath || "", "dist", "goals-widget.html"),
          path.join(app.getAppPath(), "dist", "goals-widget.html"),
          path.join(process.cwd(), "dist", "goals-widget.html"),
        ];
        let served = false;
        for (const htmlPath of htmlStrategies) {
          try {
            if (!fs.existsSync(htmlPath)) continue;
            const html = fs.readFileSync(htmlPath, "utf-8");
            res.writeHead(200, {
              "Content-Type": "text/html; charset=utf-8",
              "Cache-Control": "no-store, no-cache, must-revalidate",
              "Pragma": "no-cache",
              "Expires": "0",
              "Access-Control-Allow-Origin": "*",
            });
            res.end(html);
            served = true;
            break;
          } catch (_) {}
        }
        if (!served) {
          res.writeHead(404); res.end("Goals overlay not found");
        }
      }
      return;
    }

    // ── Instance-based overlay: serve HTML shell ──
    {
      const match = url.pathname.match(/^\/overlay\/([a-z0-9-]+)(?:\.html)?$/);
      if (match && req.method === "GET") {
        const browserSourceId = match[1];
        const htmlPath = isDev
          ? path.join(__dirname, "../overlay-entry.html")
          : path.join(__dirname, "../dist/overlay-entry.html");
        try {
          let html = fs.readFileSync(htmlPath, "utf-8");
          // Inject browserSourceId so BrowserSourceApp can read it from window global
          html = html.replace('<head>', `<head><script>window.__ROSAEFINITY_BROWSER_SOURCE_ID__="${browserSourceId}";</script>`);
          res.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store, no-cache, must-revalidate",
            "Access-Control-Allow-Origin": "*",
          });
          res.end(html);
        } catch (_) {
          res.writeHead(404); res.end("Overlay entry not found");
        }
        return;
      }
    }

    // ── Instance-based overlay: config JSON ──
    {
      const match = url.pathname.match(/^\/overlay\/([a-z0-9-]+)\/config$/);
      if (match && req.method === "GET") {
        const browserSourceId = match[1];
        const instance = overlayInstancesByBrowserSourceId.get(browserSourceId);
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        });
        if (instance) {
          res.end(JSON.stringify({ moduleId: instance.moduleId, config: instance.config, instanceId: instance.id }));
        } else {
          res.writeHead(404, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
          res.end(JSON.stringify({ error: "Instance not found", browserSourceId }));
        }
        return;
      }
    }

    // ── Instance-based overlay: SSE events ──
    {
      const match = url.pathname.match(/^\/overlay\/([a-z0-9-]+)\/events$/);
      if (match && req.method === "GET") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
          "Access-Control-Allow-Origin": "*",
        });
        res.write(":\n\n");
        sseClients.push(res);
        req.on("close", () => { sseClients = sseClients.filter(c => c !== res); });
        return;
      }
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
          if (data?.type === "media-complete") {
            // Media-complete relay is a critical production path — keep error logging
          }
          broadcastSSE(data);
          sendToOverlay("overlay:action", data);
          sendToRenderer("overlay:event", data);
          if (data?.type === "media-complete") {
            // Media-complete relay is a critical production path — keep error logging
          }
        } catch (error) {
          console.error("[MEDIA-COMPLETE-RELAY][SERVER-ERROR]", JSON.stringify({ error: error instanceof Error ? error.message : String(error), timestamp: Date.now() }));
        }
        res.writeHead(200, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS" });
        res.end("ok");
      });
      return;
    }

    // ── Goal Progress config endpoints ──
    if (url.pathname === "/goal-config" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify(storedGoalConfig || {}));
      return;
    }
    if (url.pathname === "/goal-config" && req.method === "POST") {
      let body = "";
      req.on("data", c => { body += c; });
      req.on("end", () => {
        try {
          storedGoalConfig = JSON.parse(body);
          // Broadcast to all connected SSE clients
          broadcastSSE({ type: 'goal-config-update', config: storedGoalConfig });
        } catch (_) {}
        res.writeHead(200, { "Access-Control-Allow-Origin": "*" });
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

    // ── Production: serve public files from dist/ ──
    // Handles /assets/* (bundled JS/CSS) and root-level public files (logos, favicon)
    if (url.pathname.startsWith("/assets/") || /\.(png|svg|ico|jpg|jpeg|gif|woff2?|ttf|eot)$/.test(url.pathname)) {
      const assetPath = url.pathname.replace(/^\//, '');
      const distStrategies = [
        path.join(__dirname, "../dist", assetPath),
        path.join(process.resourcesPath || "", "dist", assetPath),
        path.join(app.getAppPath(), "dist", assetPath),
        path.join(process.cwd(), "dist", assetPath),
      ];
      for (const filePath of distStrategies) {
        try {
          if (!fs.existsSync(filePath)) continue;
          const ext = path.extname(filePath).toLowerCase();
          const contentType = {
            '.js': 'application/javascript; charset=utf-8',
            '.css': 'text/css; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.svg': 'image/svg+xml',
            '.woff2': 'font/woff2',
            '.woff': 'font/woff',
          }[ext] || 'application/octet-stream';
          const data = fs.readFileSync(filePath);
          res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=31536000, immutable',
          });
          res.end(data);
          return;
        } catch (_) {}
      }
      res.writeHead(404); res.end('Asset not found');
      return;
    }

    // ── Dev mode: proxy /assets/ to Vite dev server ──
    // coin-jar.html references /assets/ paths in production build
    if (isDev && url.pathname.startsWith("/assets/")) {
      const viteUrl = `http://127.0.0.1:5173${url.pathname}${url.search}`;
      http.get(viteUrl, (proxyRes) => {
        const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        });
        proxyRes.pipe(res);
      }).on('error', () => {
        res.writeHead(502);
        res.end('Vite dev server not available for asset proxy');
      });
      return;
    }

    // ── Dev mode: proxy /src/* and /node_modules/* to Vite dev server ──
    // coin-jar.html and goals-widget.html in dev mode reference /src/ paths
    if (isDev && (url.pathname.startsWith("/src/") || url.pathname.startsWith("/node_modules/"))) {
      const viteUrl = `http://127.0.0.1:5173${url.pathname}${url.search}`;
      http.get(viteUrl, (proxyRes) => {
        const contentType = proxyRes.headers['content-type'] || 'application/octet-stream';
        res.writeHead(proxyRes.statusCode || 200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        });
        proxyRes.pipe(res);
      }).on('error', () => {
        res.writeHead(502);
        res.end('Vite dev server not available for source proxy');
      });
      return;
    }

    // ── Diagnostic test endpoints ──
    if (url.pathname === "/goals-test.html") {
      if (isDebug) console.log("[GOALS-SERVE] /goals-test.html requested by", req.headers["user-agent"]?.substring(0, 60));
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(`<!DOCTYPE html>
<html><body style="margin:0;background:red;">
<div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;font-size:48px;font-family:sans-serif;color:white;font-weight:bold;">
GOALS STATIC TEST
</div>
</body></html>`);
      return;
    }
    if (url.pathname === "/goals-js-test.html") {
      if (isDebug) console.log("[GOALS-SERVE] /goals-js-test.html requested by", req.headers["user-agent"]?.substring(0, 60));
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache",
        "Access-Control-Allow-Origin": "*",
      });
      res.end(`<!DOCTYPE html>
<html><body style="margin:0;background:transparent;">
<div id="test" style="position:fixed;inset:0;background:rgba(0,0,255,.15);color:white;font-size:40px;display:flex;align-items:center;justify-content:center;font-family:monospace;">
HTML OK — WAITING FOR JS
</div>
<script>
document.getElementById("test").textContent = "HTML + INLINE JS OK";
</script>
</body></html>`);
      return;
    }

    res.writeHead(404); res.end("Not found");
  });

  server.listen(SSE_PORT, "127.0.0.1", () => {
    if (isDebug) {
      console.log(`[SERVER] HTTP server listening on 127.0.0.1:${SSE_PORT}`);
      console.log(`[RF] Overlay SSE server running on http://127.0.0.1:${SSE_PORT}`);
      console.log(`[RF]   → OBS/TikTok Studio: http://127.0.0.1:${SSE_PORT}/overlay-widget.html`);
      console.log(`[RF]   → SSE stream:        http://127.0.0.1:${SSE_PORT}/events`);
      console.log(`[RF]   → Desktop UI:        http://127.0.0.1:${SSE_PORT}/`);
    }
    resolve();
  });
  server.on("error", (err) => {
    console.error(`[RF] SSE server error on port ${SSE_PORT}:`, err.message);
    reject(err);
  });
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

// ── Native Windows SendInput (for reliable multi-modifier combos) ───
let nativeSendInput = null;
try {
  const nativeModulePath = require.resolve("./backend/sendinput-native.cjs");
  nativeSendInput = require(nativeModulePath);

  // NATIVE-MODULE-IDENTITY: prove which file the Action path loads
  if (isDebug) {
    console.log("[NATIVE-MODULE-IDENTITY]", JSON.stringify({
      file: "sendinput-native.cjs",
      resolvedPath: nativeModulePath,
      moduleInstanceId: `nat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      processPid: process.pid,
      processArch: process.arch,
      processExecPath: process.execPath,
      dirname: __dirname,
    }));

    // NATIVE-WIRING-1: Verify module loaded and exports exist
    const exportedKeys = Object.keys(nativeSendInput || {});
    console.log("[NATIVE-WIRING-1]", JSON.stringify({
      moduleLoaded: !!nativeSendInput,
      exportedKeys,
    }));
  }

  // Verify critical exports exist
  if (!nativeSendInput.sendNativeKeystroke) {
    if (isDebug) console.error("[NATIVE-WIRING-ERROR]", JSON.stringify({
      error: "sendNativeKeystroke export missing",
      exportedKeys,
    }));
    nativeSendInput = null;
  } else if (!nativeSendInput.parseComboToVK) {
    if (isDebug) console.error("[NATIVE-WIRING-ERROR]", JSON.stringify({
      error: "parseComboToVK export missing",
      exportedKeys,
    }));
    nativeSendInput = null;
  } else {
    if (isDebug) console.log("[SendInput-Native] Loaded successfully");
  }
} catch (err) {
  if (isDebug) console.error("[NATIVE-WIRING-ERROR]", JSON.stringify({
    error: err.message,
    stack: err.stack,
  }));
  if (isDebug) console.warn("[SendInput-Native] Failed to load:", err.message);
  nativeSendInput = null;
}

// RUNTIME-KEYBOARD-VERSION: Prove which keyboard variable name is in use
if (isDebug) console.log("[RUNTIME-KEYBOARD-VERSION]", JSON.stringify({
  nativeVariable: "nativeSendInput",
  hasNativeModule: !!nativeSendInput,
  moduleType: nativeSendInput ? typeof nativeSendInput : "null",
}));

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
    // width/height mean the web contents size (not OS frame) — avoids
    // content-size vs bounds desync with titleBarStyle hidden
    useContentSize: true,
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
      zoomFactor: 1,
    },
    show: false,
  });

  // ── Viewport sync ──
  // Windows + titleBarStyle/titleBarOverlay can leave Chromium's renderer
  // viewport stuck at Electron default 800x600 while getBounds() reports a
  // large OS window. setContentSize is then a no-op (Electron already thinks
  // content is large). Force a real resize so Chromium re-lays out.
  const MAIN_CONTENT_W = 1400;
  const MAIN_CONTENT_H = 900;

  const readRendererViewport = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return Promise.resolve(null);
    return mainWindow.webContents
      .executeJavaScript(
        `JSON.stringify({ w: window.innerWidth, h: window.innerHeight, outerW: window.outerWidth, outerH: window.outerHeight })`,
      )
      .then((s) => {
        try { return JSON.parse(s); } catch { return null; }
      })
      .catch(() => null);
  };

  const forceChromiumResize = (targetW, targetH) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      const b = mainWindow.getBounds();
      // setBounds on the OS window forces Windows to re-send size to Chromium
      // even when getContentBounds() already reports a large size (the bug:
      // Electron bounds/content can look correct while innerWidth stays 800x600).
      const w = Math.max(b.width, targetW + 16);
      const h = Math.max(b.height, targetH + 39);
      mainWindow.setBounds({ x: b.x, y: b.y, width: w, height: h });
      setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        try { mainWindow.setContentSize(targetW, targetH); } catch (_) {}
        try { mainWindow.webContents.setZoomFactor(1); } catch (_) {}
        // Zoom nudge forces Chromium reflow when bounds already "match"
        try {
          mainWindow.webContents.setZoomFactor(0.98);
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              try { mainWindow.webContents.setZoomFactor(1); } catch (_) {}
            }
          }, 30);
        } catch (_) {}
      }, 40);
    } catch (err) {
      console.error("[ELECTRON-VIEWPORT] force resize failed", err);
    }
  };

  const syncMainWindowViewport = async (reason) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      const bounds = mainWindow.getBounds();
      const content = mainWindow.getContentBounds();
      const renderer = await readRendererViewport();
      const rw = renderer?.w || 0;
      const rh = renderer?.h || 0;

      const targetW = Math.max(content.width, bounds.width - 20, MAIN_CONTENT_W, 1200);
      const targetH = Math.max(content.height, bounds.height - 48, MAIN_CONTENT_H, 700);

      // Chromium viewport stuck while OS window is large — the reported bug
      const rendererStuck = (rw > 0 && rw < 1000 && bounds.width > 1000) ||
        (rw > 0 && rh > 0 && (rw < bounds.width - 80 || rh < bounds.height - 80));
      const contentSmall = content.width < 1000 || content.height < 650;

      if (isDebug) {
        console.log("[ELECTRON-VIEWPORT]", reason, {
          bounds,
          content,
          renderer,
          targetW,
          targetH,
          rendererStuck,
          contentSmall,
        });
      }

      if (rendererStuck || contentSmall) {
        forceChromiumResize(targetW, targetH);
        setTimeout(async () => {
          if (!mainWindow || mainWindow.isDestroyed()) return;
          const r2 = await readRendererViewport();
          if (isDebug) console.log("[ELECTRON-VIEWPORT] after-nudge", reason, r2);
          if (r2 && (r2.w < 1000 || r2.h < 650 || r2.w < mainWindow.getBounds().width - 80)) {
            // Reload renderer so Chromium re-reads the real window size
            if (isDebug) console.log("[ELECTRON-VIEWPORT] reloading renderer to resync viewport");
            try { mainWindow.webContents.reload(); } catch (_) {}
          }
        }, 250);
      }
    } catch (err) {
      console.error("[ELECTRON-VIEWPORT] sync failed", err);
    }
  };

  mainWindow.once("ready-to-show", () => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
    setTimeout(() => { syncMainWindowViewport("ready-to-show"); }, 80);
    setTimeout(() => { syncMainWindowViewport("ready-to-show-late"); }, 500);
  });

  // Windows maximize + titleBarStyle:hidden/titleBarOverlay can leave Chromium's
  // innerWidth at the Electron default 800x600 while getContentBounds() reports
  // the full work area (e.g. 1920x1032). setContentSize is a no-op because
  // Electron already believes content is large. Force OS bounds + zoom reflow.
  const fixMaximizedRendererViewport = (reason) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    try {
      let wa = null;
      try {
        const display = screen.getDisplayMatching(mainWindow.getBounds());
        wa = display.workArea;
      } catch (_) {
        wa = null;
      }
      const content = mainWindow.getContentBounds();
      const targetW = Math.max(wa?.width || 0, content.width, MAIN_CONTENT_W, 1200);
      const targetH = Math.max(wa?.height || 0, content.height, MAIN_CONTENT_H, 700);
      const frameW = 16;
      const frameH = 39;
      const bounds = mainWindow.getBounds();

      if (isDebug) {
        console.log("[ELECTRON-VIEWPORT] fix-maximized", reason, {
          bounds,
          content,
          wa,
          targetW,
          targetH,
        });
      }

      // 1px OS nudge — forces Windows to re-send size to Chromium
      mainWindow.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: bounds.width + 2,
        height: bounds.height + 2,
      });
      setTimeout(() => {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        try {
          mainWindow.setContentSize(targetW, targetH);
          mainWindow.setBounds({
            x: wa ? wa.x - Math.floor(frameW / 2) : bounds.x,
            y: wa ? wa.y - Math.floor(frameH / 2) : bounds.y,
            width: targetW + frameW,
            height: targetH + frameH,
          });
        } catch (_) {}
        try {
          mainWindow.webContents.setZoomFactor(1.02);
          setTimeout(() => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              try { mainWindow.webContents.setZoomFactor(1); } catch (_) {}
              readRendererViewport().then((r) => {
                if (isDebug) console.log("[ELECTRON-VIEWPORT] fix-maximized-verify", reason, r);
              });
            }
          }, 40);
        } catch (_) {}
      }, 30);
    } catch (err) {
      console.error("[ELECTRON-VIEWPORT] fix-maximized failed", err);
    }
  };

  mainWindow.on("maximize", () => setTimeout(() => fixMaximizedRendererViewport("maximize"), 60));
  mainWindow.on("unmaximize", () => setTimeout(() => syncMainWindowViewport("unmaximize"), 80));
  mainWindow.on("resize", () => setTimeout(() => syncMainWindowViewport("resize"), 150));
  mainWindow.webContents.on("did-finish-load", () => {
    setTimeout(() => syncMainWindowViewport("did-finish-load"), 200);
  });

  // ── Diagnostics ──
  mainWindow.webContents.on("did-start-loading", () => {
    if (isDebug) console.log("[ELECTRON] did-start-loading");
  });

  mainWindow.webContents.on("did-finish-load", () => {
    if (!isDebug) return;
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
  });

  mainWindow.webContents.on("responsive", () => {
    if (isDebug) console.log("[ELECTRON] renderer responsive");
  });

  // RENDERER-CONSOLE: Only in debug mode to avoid leaking arbitrary renderer logs
  if (isDebug) {
    mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
      console.log("[RENDERER-CONSOLE]", {
        level,
        message,
        line,
        sourceId
      });
    });
  }

  // ── Load content ──
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    // Load via HTTP server so /assets/* resolves correctly
    const productionUrl = `http://127.0.0.1:${SSE_PORT}/`;
    if (isDebug) console.log("[ELECTRON] Loading production UI from", productionUrl);
    mainWindow.loadURL(productionUrl);
    if (isDebug) console.log("[ELECTRON] Production UI load initiated");
  }

  // ── Show when ready (prevent white flash) ──
  // Viewport sync is registered above (ready-to-show + maximize/resize).
  // Do not register a second ready-to-show show() handler here.

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
// Serialize ALL keyboard injection (native SendInput + nut-js + robotjs + SendKeys).
// Concurrent Action/test IPC calls can otherwise interleave modifier DOWN/UP
// and leave Ctrl/Shift/Alt stuck in the foreground app (e.g. Notepad).
let keystrokeQueue = Promise.resolve();

/**
 * Run a keyboard task after any previously queued keystroke finishes.
 * Failed tasks do not block later tasks.
 */
function enqueueKeystroke(task) {
  const run = keystrokeQueue.then(() => task(), () => task());
  keystrokeQueue = run.then(() => undefined, () => undefined);
  return run;
}

async function sendKeystroke(keys, holdMs = 100, eventData, rfKeyId) {
  if (!keys) return false;
  // Queue the entire injection path so Action A completes fully
  // (including modifier UP) before Action B begins.
  return enqueueKeystroke(() => sendKeystrokeBody(keys, holdMs, eventData, rfKeyId));
}

// RF-KEY counters (per process) for duplicate-invocation audit
const rfKeyCounters = {
  ipcHandle: 0,
  sendKeystroke: 0,
  nativeSequence: 0,
  lastRfKeyId: null,
};

/**
 * Log foreground window immediately before keyboard work (diagnose only).
 */
function logForegroundForRfKey(stage, rfKeyId) {
  let fg = null;
  try {
    if (nativeSendInput && typeof nativeSendInput.getForegroundWindow === "function") {
      fg = nativeSendInput.getForegroundWindow();
    }
  } catch (err) {
    fg = { error: err.message };
  }
  if (isDebug) console.log("[RF-KEY-FOREGROUND]", JSON.stringify({ stage, id: rfKeyId || null, foreground: fg }));
  return fg;
}

/**
 * Read Windows Ctrl state (diagnostic only — never used to fake-release).
 */
function logRfCtrlState(stage, rfKeyId) {
  let state = null;
  try {
    if (nativeSendInput && typeof nativeSendInput.readAsyncKeyState === "function") {
      const s = nativeSendInput.readAsyncKeyState(0x11);
      state = { value: s.hex, pressed: s.pressed, toggle: s.toggleSinceLastCall };
    }
  } catch (err) {
    state = { error: err.message };
  }
  if (isDebug) console.log("[RF-CTRL-STATE]", JSON.stringify({ stage, id: rfKeyId || null, ...state }));
  return state;
}

/**
 * Monitor for delayed keyboard sequences after Action completes (500ms).
 * Uses a lightweight marker: any further sendKeystroke/native logs will show
 * as additional RF-KEY-TRACE / NATIVE-KEY-SEQUENCE with a different id.
 */
function startRfKeyAfterMonitor(rfKeyId, keys) {
  const start = Date.now();
  const timer = setInterval(() => {
    const elapsed = Date.now() - start;
    if (elapsed >= 500) {
      clearInterval(timer);
      if (isDebug) console.log("[RF-KEY-AFTER]", JSON.stringify({
        elapsedMs: elapsed,
        source: "monitor-end",
        keys,
        id: rfKeyId,
        note: "If additional NATIVE-KEY-SEQUENCE / RF-KEY-TRACE appeared during this window, report them",
      }));
      return;
    }
  }, 100);
  // unref so monitor does not keep Electron alive
  if (typeof timer.unref === "function") timer.unref();
}

async function sendKeystrokeBody(keys, holdMs = 100, eventData, rfKeyId) {
  const rfKey = rfKeyId || `RF-KEY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  rfKeyCounters.sendKeystroke += 1;
  rfKeyCounters.lastRfKeyId = rfKey;

  if (isDebug) console.log("[RF-KEY-TRACE]", JSON.stringify({
    stage: "sendKeystroke",
    id: rfKey,
    keys,
    holdMs,
    sendKeystrokeCallCount: rfKeyCounters.sendKeystroke,
  }));

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

  if (isDebug) console.log(`[Keystroke] sending "${resolvedKeys}" (hold: ${holdMs}ms) rfKey=${rfKey}`);

  // Route ALL modifier combinations through native Windows SendInput
  // Execution order:
  // 1. Any combo with 1+ modifiers → native Windows SendInput (koffi FFI) FIRST
  // 2. 0 modifiers → nut-js pressKey/releaseKey
  // 3. Fallback → robotjs → SendKeys
  // A successful native SendInput MUST return immediately (no fallback after success).
  if (nativeSendInput) {
    const keymap = require("./backend/keystroke-keymap.cjs");
    const nutSequences = resolvedKeys.split(/\s+/).filter(s => s.length > 0);
    let hasAnyModifier = false;
    for (const seq of nutSequences) {
      const { modifiers } = keymap.parseKeystrokeCombo(seq);
      if (modifiers.length >= 1) {
        hasAnyModifier = true;
        break;
      }
    }

    if (hasAnyModifier) {
      if (isDebug) console.log("[Keystroke] modifier combo → native SendInput", rfKey);
      try {
        const result = await nativeSendInput.sendNativeKeystroke(resolvedKeys, holdMs);
        rfKeyCounters.nativeSequence += 1;
        if (isDebug) {
          logForegroundForRfKey("after-native-send", rfKey);
          logRfCtrlState("after-native-0ms", rfKey);
        }
        if (result) {
          if (isDebug) console.log("[Keystroke] native SendInput success", rfKey);
          return true;
        }
        if (isDebug) console.log("[Keystroke] native SendInput returned false, falling back");
      } catch (err) {
        console.warn("[Keystroke] Native SendInput failed:", err.message);
      }
    }
  }

  // Try nut-js for 0-modifier keys ONLY (modifier combos already handled by SendInput above)
  // If SendInput was unavailable or failed, this is the fallback for modifier combos too.
  if (nutKeyboard && nutKey) {
    try {
      const keymap = require("./backend/keystroke-keymap.cjs");
      const nutSequences = resolvedKeys.split(/\s+/).filter(s => s.length > 0);
      if (isDebug) console.log(`[Keystroke-DIAG] nutSequences to process: ${JSON.stringify(nutSequences)}`);
      let allSucceeded = true;

      for (const seq of nutSequences) {
        const { modifiers, main } = keymap.parseKeystrokeCombo(seq);
        const nutKeyName = keymap.mapTokenToNutKeyName(main, nutKey);
        const nutKeyCode = nutKeyName ? nutKey[nutKeyName] : undefined;
        const MOD_TO_NUT = {
          control: () => nutKey.LeftControl,
          shift: () => nutKey.LeftShift,
          alt: () => nutKey.LeftAlt,
          meta: () => nutKey.LeftMeta,
        };
        const modKeyCodes = [];
        const modKeyNames = [];
        for (const mod of modifiers) {
          const resolve = MOD_TO_NUT[mod];
          if (!resolve) continue;
          const code = resolve();
          if (code != null) {
            modKeyCodes.push(code);
            modKeyNames.push(mod);
          }
        }
        const allKeys = [...new Set([...modKeyCodes, nutKeyCode])];
        const allNames = [...new Set([...modKeyNames, nutKeyName])];

        // Log for 0-modifier keys (modifier combos already logged by SendInput path)
        if (modKeyCodes.length === 0) {
          if (isDebug) console.log("[KEYTRACE-3]", JSON.stringify({
            seq,
            mainKey: main,
            modifiers,
            modifierNames: modKeyNames,
            modifierCodes: modKeyCodes,
            mainNutKeyName: nutKeyName,
            mainKeyCode: nutKeyCode,
            pressSequence: allNames,
            pressCodes: allKeys,
            releaseSequence: [...allNames].reverse(),
            backend: "nut-js",
          }));
        } else {
          if (isDebug) console.log("[MODIFIER-FORENSIC]", JSON.stringify({
            seq,
            parsedModifiers: modifiers,
            mainKey: main,
            modifierKeys: modKeyNames,
            modifierCodes: modKeyCodes,
            mainNutKeyName: nutKeyName,
            mainKeyCode: nutKeyCode,
            pressSequence: allNames,
            pressCodes: allKeys,
            releaseSequence: [...allNames].reverse(),
            backend: "nut-js-fallback",
          }));
        }

        if (isDebug) console.log(`[Keystroke-DIAG] seq="${seq}" -> modifiers=[${modifiers.join(',')}] main="${main}"`);
        if (!main) continue;
        if (isDebug) console.log(`[Keystroke-DIAG] main="${main}" -> nutKeyName="${nutKeyName}"`);
        if (nutKeyCode == null) {
          console.warn("[Keystroke] unmapped key for nut-js:", main);
          allSucceeded = false;
          continue;
        }
        if (isDebug) console.log(`[Keystroke-DIAG] nutKeyCode for "${nutKeyName}": ${nutKeyCode}`);

        if (modKeyCodes.length === 0) {
          // Single key (no modifiers): hold via press/release
          await nutKeyboard.pressKey(nutKeyCode);
          try {
            await new Promise(r => setTimeout(r, holdMs));
          } finally {
            await nutKeyboard.releaseKey(nutKeyCode);
          }
        } else {
          // Fallback for modifier combos (only reached if SendInput failed)
          // try/finally: release EVERY key we successfully pressed, even if hold/release throws
          console.log(`[Keystroke-DIAG] Fallback: pressKey(${allKeys.join(', ')}) for "${seq}"`);
          const pressedNutKeys = [];
          try {
            for (const k of allKeys) {
              await nutKeyboard.pressKey(k);
              pressedNutKeys.push(k);
            }
            await new Promise(r => setTimeout(r, holdMs));
          } finally {
            while (pressedNutKeys.length > 0) {
              const k = pressedNutKeys.pop();
              try {
                await nutKeyboard.releaseKey(k);
              } catch (relErr) {
                console.warn("[Keystroke] nut-js release failed:", relErr.message);
              }
            }
          }
        }
      }

      if (allSucceeded) {
        console.log("[Keystroke] Sent via nut-js successfully");
        console.log("[RF-KEY-PATH]", JSON.stringify({
          path: "nut-js",
          outcome: "success",
          id: rfKey,
          resolvedKeys,
        }));
        return true;
      }
      console.log("[Keystroke] nut-js had failures, falling back");
      console.log("[RF-KEY-PATH]", JSON.stringify({
        path: "nut-js",
        outcome: "partial-failure-will-fallback",
        id: rfKey,
        resolvedKeys,
      }));
    } catch (err) {
      console.warn("[Keystroke] nut-js failed:", err.message);
      // Fall through to robotjs/SendKeys
    }
  } else {
    if (isDebug) console.log("[Keystroke] nut-js not available");
  }

  // Try robotjs (for single key and single modifier combos if nut-js unavailable)
  if (robot) {
    try {
      const keymap = require("./backend/keystroke-keymap.cjs");
      const robotSequences = resolvedKeys.split(/\s+/).filter(s => s.length > 0);
      if (isDebug) console.log(`[Keystroke-DIAG] FALLBACK: robotjs path, robotSequences: ${JSON.stringify(robotSequences)}`);
      let allSucceeded = true;
      for (const seq of robotSequences) {
        const { modifiers, main } = keymap.parseKeystrokeCombo(seq);
        if (isDebug) console.log(`[Keystroke-DIAG] robotjs seq="${seq}" -> modifiers=[${modifiers.join(',')}] main="${main}"`);
        if (!main) continue;
        const robotKey = keymap.mapTokenToRobotjsName(main);
        if (isDebug) console.log(`[Keystroke-DIAG] robotjs main="${main}" -> robotKey="${robotKey}"`);
        if (!robotKey) {
          console.warn("[Keystroke] unmapped key for robotjs:", main);
          allSucceeded = false;
          continue;
        }
        if (modifiers.length === 0) {
          // Single key — await hold so the keystroke queue cannot start the
          // next action while this key is still down.
          robot.keyToggle(robotKey, "down");
          try {
            await new Promise(r => setTimeout(r, holdMs));
          } finally {
            robot.keyToggle(robotKey, "up");
          }
        } else if (modifiers.length === 1) {
          // Single modifier — try/finally releases main + modifier even on throw
          const pressedRobotKeys = [];
          try {
            for (const mod of modifiers) {
              robot.keyToggle(mod, "down");
              pressedRobotKeys.push(mod);
            }
            robot.keyToggle(robotKey, "down");
            pressedRobotKeys.push(robotKey);
            await new Promise(r => setTimeout(r, holdMs));
          } finally {
            while (pressedRobotKeys.length > 0) {
              const k = pressedRobotKeys.pop();
              try { robot.keyToggle(k, "up"); } catch (_) {}
            }
          }
        } else {
          // 2+ modifiers should have been handled by native SendInput
          // If we reach here, native SendInput wasn't available - try robotjs
          if (isDebug) console.log("[Keystroke-DIAG] 2+ modifiers with robotjs fallback (SendInput unavailable)");
          try {
            const pressedRobotKeys = [];
            try {
              for (const mod of modifiers) {
                robot.keyToggle(mod, "down");
                pressedRobotKeys.push(mod);
              }
              robot.keyToggle(robotKey, "down");
              pressedRobotKeys.push(robotKey);
              await new Promise(r => setTimeout(r, holdMs));
            } finally {
              while (pressedRobotKeys.length > 0) {
                const k = pressedRobotKeys.pop();
                try { robot.keyToggle(k, "up"); } catch (_) {}
              }
            }
          } catch (e) {
            console.warn("[Keystroke] robotjs multi-modifier failed:", e.message);
            allSucceeded = false;
          }
        }
      }
      if (allSucceeded) {
        if (isDebug) console.log("[Keystroke] Sent via robotjs successfully");
        if (isDebug) console.log("[RF-KEY-PATH]", JSON.stringify({
          path: "robotjs",
          outcome: "success",
          id: rfKey,
          resolvedKeys,
        }));
        return true;
      }
    } catch (err) {
      console.warn("[Keystroke] robotjs failed:", err.message);
    }
  } else {
    if (isDebug) console.log("[Keystroke] robotjs not available");
  }

  // Windows PowerShell SendKeys (fallback for numpad/special cases)
  // Note: SendKeys has no first-class numpad keys — numpad requires nut-js.
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
    const parts = combo.split("+").map(p => p.trim()).filter(Boolean);
    if (parts.length === 0) return "";
    // Modifier-only tokens (Ctrl / Shift / Alt) must not be typed as letters.
    const MOD_ONLY = {
      CTRL: "^",
      CONTROL: "^",
      SHIFT: "+",
      ALT: "%",
      META: "~",
      COMMAND: "~",
      CMD: "~",
    };
    const modAliases = {
      ctrl: "^",
      control: "^",
      shift: "+",
      shiftkey: "+",
      alt: "%",
      altkey: "%",
      meta: "~",
      command: "~",
      cmd: "~",
    };
    // If every part is a modifier, emit modifier prefixes only (no literal key text).
    const allMods = parts.every(p => modAliases[p.toLowerCase()] || MOD_ONLY[p.toUpperCase()]);
    if (allMods) {
      // Stable order: Ctrl, Shift, Alt, Meta
      const order = ["ctrl", "control", "shift", "alt", "meta", "command", "cmd"];
      const sorted = [...parts].sort(
        (a, b) => order.indexOf(a.toLowerCase()) - order.indexOf(b.toLowerCase())
      );
      return sorted.map(p => modAliases[p.toLowerCase()] || MOD_ONLY[p.toUpperCase()]).join("");
    }
    const mainRaw = parts[parts.length - 1];
    const modParts = parts.slice(0, -1);
    // Resolve main key via keymap so "Comma" → "," not "COMMA"
    let psKey = null;
    try {
      const km = require("./backend/keystroke-keymap.cjs");
      psKey = km.mapTokenToSendKeys(mainRaw);
    } catch (_) { /* keymap optional */ }
    if (psKey == null) {
      const mainKey = mainRaw.toUpperCase();
      psKey = keyMap[mainKey] || (mainRaw.length === 1 ? mainRaw : mainKey);
    }
    let result = psKey;
    // Keep modifiers in stable order (Ctrl, Shift, Alt) as SendKeys prefixes.
    const order = ["ctrl", "control", "shift", "alt", "meta", "command", "cmd"];
    const sortedMods = [...modParts].sort(
      (a, b) => order.indexOf(a.toLowerCase()) - order.indexOf(b.toLowerCase())
    );
    sortedMods.forEach(mod => {
      const mc = modMap[mod] || modAliases[mod.toLowerCase()];
      if (mc) result = mc + result;
    });
    return result;
  }

  const fallbackSequences = resolvedKeys.split(/\s+/).filter(s => s.length > 0);
  if (isDebug) console.log(`[Keystroke-DIAG] FALLBACK: SendKeys path, fallbackSequences: ${JSON.stringify(fallbackSequences)}`);

  // KEY-FINAL-2: Log IPC payload and modifier analysis
  if (isDebug) console.log("[KEY-FINAL-2]", JSON.stringify({
    IPCPayload: { keys: resolvedKeys, holdMs, eventData: eventData ? { user: eventData.user, giftName: eventData.giftName } : null },
    fallbackSequences,
    normalizedModifiers: fallbackSequences.map(seq => {
      const parts = seq.split('+').map(p => p.trim()).filter(Boolean);
      const MOD_ALIASES = { control: 'control', ctrl: 'control', shift: 'shift', alt: 'alt', meta: 'meta', command: 'meta', cmd: 'meta' };
      return parts.filter(p => MOD_ALIASES[p.toLowerCase()]).map(p => MOD_ALIASES[p.toLowerCase()]);
    }),
    modifierCount: fallbackSequences.map(seq => {
      const parts = seq.split('+').map(p => p.trim()).filter(Boolean);
      const MOD_ALIASES = { control: 'control', ctrl: 'control', shift: 'shift', alt: 'alt', meta: 'meta', command: 'meta', cmd: 'meta' };
      return parts.filter(p => MOD_ALIASES[p.toLowerCase()]).length;
    }),
  }));

  // KEY-FINAL-3: Log selected path
  if (isDebug) console.log("[KEY-FINAL-3]", JSON.stringify({
    selectedPath: "SendKeys",
    sendKeysFallback: true,
    fallbackSequences,
  }));

  // Use comboToPsKeys for EACH sequence to properly parse + modifiers
  let psSendKeys = "";
  fallbackSequences.forEach(seq => {
    const psKeys = comboToPsKeys(seq);
    psSendKeys += psKeys;
  });

  if (isDebug) console.log(`[Keystroke-DIAG] SendKeys result: "${psSendKeys}"`);
  // KEYTRACE-5: SendKeys result
  if (isDebug) console.log("[KEYTRACE-5]", JSON.stringify({
    sendKeysString: psSendKeys,
    backend: "PowerShell-SendKeys",
  }));

  const psCmd = `powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${psSendKeys.replace(/'/g, "''")}')"`;

  if (isDebug) console.log(`[Keystroke] Executing PowerShell command: ${psCmd}`);

  // KEY-FINAL-4: Log exact SendKeys value
  if (isDebug) console.log("[KEY-FINAL-4]", JSON.stringify({
    exactSendKeysValue: psSendKeys,
    command: psCmd,
  }));

  // KEY-FOCUS: Log window focus state
  let activeWindowInfo = "unknown";
  try {
    activeWindowInfo = mainWindow && !mainWindow.isDestroyed() ? "main-window-exists" : "no-main-window";
  } catch (_) {
    activeWindowInfo = "error-checking-window";
  }
  if (isDebug) console.log("[KEY-FOCUS]", JSON.stringify({
    activeWindow: activeWindowInfo,
    targetWindow: "foreground (SendKeys targets active window)",
    foregroundWindow: "unknown (Windows determines)",
    note: "SendKeys sends to the currently focused window",
  }));

  return new Promise((resolve) => {
    exec(psCmd, { timeout: 5000 }, (err, stdout, stderr) => {
      // KEY-FINAL-5: Log execution result
      if (isDebug) console.log("[KEY-FINAL-5]", JSON.stringify({
        executionMethod: "PowerShell-SendKeys",
        command: psCmd,
        exitCode: err ? err.code : 0,
        stdout: stdout ? stdout.trim() : "",
        stderr: (stderr ? stderr.trim() : (err && err.message ? err.message : "")),
        success: !err,
      }));

      if (err) {
        console.error("[Keystroke] PowerShell SendKeys failed:", err.message);
        // Fallback: Electron sendInputEvent (only works for focused Electron window)
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (isDebug) console.log("[Keystroke] Falling back to Electron sendInputEvent");
          fallbackSequences.forEach((seq, i) => {
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
        if (isDebug) console.log("[Keystroke] Sent via PowerShell SendKeys successfully");
        if (isDebug) console.log("[RF-KEY-PATH]", JSON.stringify({
          path: "sendkeys",
          outcome: "success",
          id: rfKey,
          resolvedKeys: psSendKeys,
        }));
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
      if (isDebug) console.log(`[TIKTOK-DISCONNECT-TRACE][EVENT]`, JSON.stringify({
        screenId,
        eventType: type,
        reason: data.reason || null,
        timestamp: Date.now(),
      }));
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
        // FIX (LIVE Action parity): combo tick gifts are ACTION-only.
        // They reach the renderer so dispatchTikTokEvent can run Actions
        // immediately, but they are NOT broadcast to overlay/SSE so gift
        // animations and browser-source gift feeds keep final-only behavior.
        const isComboTickGift = type === 'gift' && data && data.isComboTick === true;

        if (isComboTickGift) {
          if (isDebug) console.log('[GIFT-ACTION-PARITY] main-forward combo-tick ACTION-only', JSON.stringify({
            source: 'LIVE_GIFT',
            type,
            screenId,
            giftId: data.giftId,
            giftName: data.giftName,
            repeatCount: data.repeatCount,
            combo: data.combo,
            repeatEnd: data.repeatEnd,
            isComboTick: true,
            sentToRenderer: true,
            sentToOverlay: false,
            sentToSSE: false,
            timestamp: Date.now(),
          }));
          sendToRenderer("tiktok:event", { type, screenId, ...data });
          return;
        }


        sendToRenderer("tiktok:event", { type, screenId, ...data });
        sendToOverlay("overlay:event", { type, screenId, ...data });
        // CRITICAL: Broadcast gift events to SSE so Browser Sources receive them
        // Without this, Browser Sources only get coin-jar-gift (counter updates)
        // but never get the 'gift' events that trigger falling gift animations.
        broadcastSSE({ type, screenId, ...data });

        // [REAL-GIFT-DEBUG][MAIN-FORWARD] Event forwarded to all channels
        if (isDebug && type === 'gift') {
          console.log('[REAL-GIFT-DEBUG][MAIN-FORWARD]', JSON.stringify({
            type, screenId,
            giftId: data.giftId, giftName: data.giftName,
            giftImageUrl: data.giftImageUrl || '(empty)',
            isComboTick: false,
            sentToRenderer: true,
            sentToOverlay: true,
            sentToSSE: true,
          }));
        }
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

async function manualReconnect(screenId, username) {
  const service = getTikTokServiceInstance();
  try {
    return await service.connect(screenId, username);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// =============================================
//  IPC HANDLERS
// =============================================

// ── TikTok (per-screen) ──
console.log("[TIKTOK-IPC-REGISTER] registering tiktok:connect and tiktok:disconnect");
ipcMain.handle("tiktok:connect", async (_, { screenId, username }) => {
  if (isDebug) console.log(`[TIKTOK-IPC] tiktok:connect invoked screenId=${screenId} username=${username}`);
  const result = await manualReconnect(screenId, username);
  // Return the actual connection result from the service: { success, alreadyConnected, alreadyConnecting, error, isRateLimit, cooldownRemainingMs, roomId, viewerCount }
  return result;
});
ipcMain.handle("tiktok:disconnect", async (_, { screenId }) => {
  const service = getTikTokServiceInstance();
  const beforeState = service.getState(screenId);
  if (isDebug) console.log(`[TIKTOK-DISCONNECT-TRACE][MAIN]`, JSON.stringify({
    screenId,
    beforeStatus: beforeState.state,
    beforeUsername: beforeState.username,
    beforeRoomId: beforeState.roomId,
  }));
  await service.disconnect(screenId).catch((err) => {
    console.error(`[TIKTOK-IPC] tiktok:disconnect failed for ${screenId}:`, err.message);
  });
  const afterState = service.getState(screenId);
  if (isDebug) console.log(`[TIKTOK-DISCONNECT-TRACE][MAIN]`, JSON.stringify({
    screenId,
    afterStatus: afterState.state,
    afterUsername: afterState.username,
    afterRoomId: afterState.roomId,
    success: true,
  }));
  return { success: true };
});
if (isDebug) {
  console.log("[TIKTOK-IPC-REGISTERED] tiktok:connect registered");
  console.log("[TIKTOK-IPC-REGISTERED] tiktok:disconnect registered");
}

// ── Overlay ──
ipcMain.on("overlay:open", () => createOverlayWindow());
ipcMain.on("overlay:close", () => { if (overlayWindow) overlayWindow.close(); });
ipcMain.on("overlay:send", (_, data) => {
  sendToOverlay("overlay:action", data);
  broadcastSSE(data);
});

// ── Goal Progress config (from renderer on startup) ──
ipcMain.on("goal:config", (_, config) => {
  storedGoalConfig = config;
  console.log("[GOAL-STARTUP] storedGoalConfig initialized from renderer:", JSON.stringify({
    textColor: config?.textColor,
    barColor: config?.barColor,
    showPercentage: config?.showPercentage,
    showNumbers: config?.showNumbers,
  }));
  // Broadcast to ALL already-connected SSE clients (fixes race condition)
  if (config && sseClients.length > 0) {
    broadcastSSE({ type: 'goal-config-update', config });
    console.log("[GOAL-STARTUP] broadcast config to", sseClients.length, "SSE clients");
  }
});

// ── v3.1 Overlay Instance Sync (browser source config resolution) ──
// Config-changed broadcasts are limited to instances whose moduleId/config
// actually changed. Unrelated Browser Sources must not refetch/rerender.
const overlayConfigSignatures = new Map(); // browserSourceId -> signature

function instanceConfigSignature(inst) {
  try {
    return JSON.stringify({
      moduleId: inst.moduleId,
      config: inst.config,
      configVersion: inst.configVersion,
    });
  } catch (_) {
    return `unserializable:${inst.moduleId}:${Date.now()}`;
  }
}

ipcMain.on("overlay:sync-instances", (_, instances) => {
  overlayInstancesByBrowserSourceId.clear();
  for (const inst of instances) {
    if (inst.browserSourceId) {
      overlayInstancesByBrowserSourceId.set(inst.browserSourceId, inst);
    }
  }
  console.log("[OVERLAY-SYNC] synced", instances.length, "instances,", overlayInstancesByBrowserSourceId.size, "with browserSourceId");
});

// ── Immediate instance sync: renderer pushes instances right after Dexie load ──
// Populate the map first (config-fetch race fix), then broadcast ONLY for
// instances whose signature changed since the last push/sync.
ipcMain.on("overlay:push-instances", (_, instances) => {
  for (const inst of instances) {
    if (inst.browserSourceId) {
      overlayInstancesByBrowserSourceId.set(inst.browserSourceId, inst);
    }
  }

  const changedBrowserSourceIds = [];
  for (const inst of instances) {
    if (!inst.browserSourceId) continue;
    const sig = instanceConfigSignature(inst);
    const prev = overlayConfigSignatures.get(inst.browserSourceId);
    if (prev !== sig) {
      overlayConfigSignatures.set(inst.browserSourceId, sig);
      // First-seen instances still need a notify (startup race), but
      // identical re-pushes of unchanged configs are silent.
      changedBrowserSourceIds.push(inst.browserSourceId);
    }
  }

  console.log("[OVERLAY-SYNC] pushed", instances.length, "instances,", overlayInstancesByBrowserSourceId.size, "total with browserSourceId,", changedBrowserSourceIds.length, "config-changed");
  for (const browserSourceId of changedBrowserSourceIds) {
    broadcastSSE({ type: 'overlay-config-changed', browserSourceId });
  }
});

ipcMain.on("overlay:updated", (_, instance) => {
  if (instance && instance.browserSourceId) {
    const sig = instanceConfigSignature(instance);
    const prev = overlayConfigSignatures.get(instance.browserSourceId);
    overlayInstancesByBrowserSourceId.set(instance.browserSourceId, instance);
    if (prev !== sig) {
      overlayConfigSignatures.set(instance.browserSourceId, sig);
      console.log("[OVERLAY-SYNC] updated instance:", instance.moduleId, instance.browserSourceId.substring(0, 8));
      // Only the affected Browser Source refetches config
      broadcastSSE({ type: 'overlay-config-changed', browserSourceId: instance.browserSourceId });
    } else {
      console.log("[OVERLAY-SYNC] updated instance (no config change):", instance.moduleId, instance.browserSourceId.substring(0, 8));
    }
  }
});

ipcMain.on("overlay:deleted", (_, instanceId) => {
  for (const [bsid, inst] of overlayInstancesByBrowserSourceId) {
    if (inst.id === instanceId) {
      overlayInstancesByBrowserSourceId.delete(bsid);
      overlayConfigSignatures.delete(bsid);
      console.log("[OVERLAY-SYNC] deleted instance:", bsid.substring(0, 8));
      break;
    }
  }
});
let overlayTokenModule = null;
let overlaySyncModule = null;
try {
  overlayTokenModule = require("./backend/overlay-token.cjs");
  overlaySyncModule = require("./backend/overlay-sync.cjs");
  console.log("[ELECTRON-IPC] Overlay modules loaded successfully");
} catch (err) {
  console.error("[ELECTRON-IPC] Failed to load overlay modules:", err.message);
}

ipcMain.handle("overlay:generate-token", async (_, userId) => {
  console.log("[ELECTRON-IPC] overlay:generate-token called, userId:", userId);
  if (!overlayTokenModule) {
    console.error("[ELECTRON-IPC] overlay:generate-token handler not available");
    return { success: false, error: "Overlay module not loaded" };
  }

  // PRIMARY: Request token from backend (ensures JWT_SECRET match)
  const tokenUrl = `${apiUrl}/overlay/token`;
  console.log("[OVERLAY-TOKEN-IPC] requesting token from server:", tokenUrl);

  try {
    const result = await new Promise((resolve, reject) => {
      const https = require("https");
      const http = require("http");
      const urlObj = new URL(tokenUrl);
      const client = urlObj.protocol === "https:" ? https : http;
      const body = JSON.stringify({ userId });
      const req = client.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
        path: urlObj.pathname,
        method: "POST",
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
        timeout: 5000,
      }, (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON from server")); }
        });
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
      req.write(body);
      req.end();
    });

    if (result?.success && result.token) {
      console.log("[OVERLAY-AUTH-TRACE] TOKEN SOURCE: RAILWAY SERVER (correct)");
      console.log("[OVERLAY-AUTH-TRACE] token length:", result.token.length);
      const url = overlayTokenModule.getOverlayUrl(result.token);
      console.log("[OVERLAY-AUTH-TRACE] FINAL PRODUCTION URL =", url);
      return { success: true, token: result.token, url };
    }
    console.log("[OVERLAY-AUTH-TRACE] server returned failure:", result?.error);
  } catch (err) {
    console.log("[OVERLAY-AUTH-TRACE] server request FAILED:", err.message);
    console.log("[OVERLAY-AUTH-TRACE] FALLING BACK TO LOCAL GENERATION (will fail verification if JWT_SECRET differs!)");
  }

  // FALLBACK: Generate locally (will fail verification if Railway JWT_SECRET differs!)
  const jwtSecret = process.env.JWT_SECRET || "default-secret-change-me";
  console.log("[OVERLAY-AUTH-TRACE] TOKEN SOURCE: LOCAL FALLBACK (WILL FAIL VERIFICATION)");
  console.log("[OVERLAY-AUTH-TRACE] JWT_SECRET env set:", !!process.env.JWT_SECRET);
  console.log("[OVERLAY-AUTH-TRACE] local secret length:", jwtSecret.length, "isDefault:", jwtSecret === "default-secret-change-me");
  const token = overlayTokenModule.generateOverlayToken(userId, jwtSecret);
  const url = overlayTokenModule.getOverlayUrl(token);
  console.log("[OVERLAY-AUTH-TRACE] FINAL PRODUCTION URL (LOCAL) =", url);
  return { success: true, token, url };
});

ipcMain.handle("overlay:push-state", async (_, { token, goals }) => {
  if (!overlaySyncModule) {
    console.error("[ELECTRON-IPC] overlay:push-state handler not available");
    return { success: false, error: "Overlay sync module not loaded" };
  }
  const success = await overlaySyncModule.pushGoalState(token, goals, apiUrl);
  return { success };
});

// ── Keystroke ──
ipcMain.on("keystroke:send", async (_, { keys, holdMs, eventData, rfKeyId }) => {
  if (isDebug) console.log(`[Keystroke IPC] on called: keys="${keys}", holdMs=${holdMs}, rfKeyId=${rfKeyId || "none"}`);
  await sendKeystroke(keys, holdMs, eventData, rfKeyId);
});
// Also handle invoke-style (used by ActionsPage testAction)
ipcMain.handle("send-keystroke", async (_, keys, holdMs, eventData, rfKeyId) => {
  rfKeyCounters.ipcHandle += 1;
  if (isDebug) console.log("[Keystroke IPC] invoke", JSON.stringify({ keys, holdMs: holdMs || 100, rfKeyId: rfKeyId || null }));
  const result = await sendKeystroke(keys, holdMs || 100, eventData || null, rfKeyId);
  if (isDebug) console.log("[Keystroke IPC] result", JSON.stringify({ result, rfKeyId: rfKeyId || null }));
  return result;
});

// ── Diagnostic: Direct native SendInput test from Electron main process ──
// This allows testing nativeSendInput WITHOUT going through the Action execution path.
// Used to distinguish between:
//   A. Native SendInput itself is broken
//   B. Action execution path is broken
ipcMain.handle("diagnostic:native-keystroke-test", async (_, { keys, holdMs }) => {
  console.log("[DIAG-NATIVE-TEST] Direct native keystroke test requested");
  console.log("[DIAG-NATIVE-TEST] Keys:", keys, "HoldMs:", holdMs || 100);

  if (!nativeSendInput) {
    console.log("[DIAG-NATIVE-TEST] nativeSendInput module NOT available");
    return { success: false, error: "nativeSendInput module not available" };
  }

  try {
    const result = await nativeSendInput.sendNativeKeystroke(keys, holdMs || 100);
    console.log("[DIAG-NATIVE-TEST] Result:", result);
    return { success: result, keys };
  } catch (err) {
    console.log("[DIAG-NATIVE-TEST] Error:", err.message);
    return { success: false, error: err.message };
  }
});

// Packaged runtime diagnostic
ipcMain.handle("diagnostic:packaged-runtime", async () => {
  console.log(`[DIAG-PKG] diagnostic:packaged-runtime called`);
  try {
    const result = {
      processType: process.type,
      platform: process.platform,
      arch: process.arch,
      cwd: process.cwd(),
      dirname: __dirname,
      resourcesPath: process.resourcesPath,
      appPath: require('electron').app.getAppPath(),
      isPackaged: require('electron').app.isPackaged,
      nutKeyboard: !!nutKeyboard,
      nutKey: !!nutKey,
      robot: !!robot,
      keystrokeKeymapExists: false,
      nutKeyValues: {},
      robotjsValues: {},
    };

    // Check nutKey values
    if (nutKey) {
      result.nutKeyValues = {
        NumPad1: nutKey.NumPad1,
        Num1: nutKey.Num1,
        NumPadAdd: nutKey.NumPadAdd,
        Add: nutKey.Add,
        NumPadEnter: nutKey.NumPadEnter,
        Enter: nutKey.Enter,
        F5: nutKey.F5,
      };
    }

    // Check robotjs
    if (robot) {
      result.robotjsValues = {
        hasNumpad: typeof robot.keyToggle === 'function',
      };
    }

    // Check keystroke-keymap.cjs
    try {
      const keymap = require("./backend/keystroke-keymap.cjs");
      result.keystrokeKeymapExists = true;
      result.keymapTest = {
        Numpad1: keymap.mapTokenToNutKeyName('Numpad1', nutKey),
        F5: keymap.mapTokenToNutKeyName('F5', nutKey),
        CtrlNumpad1: keymap.parseKeystrokeCombo('Ctrl+Numpad1'),
      };
    } catch (e) {
      result.keystrokeKeymapError = e.message;
    }

    console.log(`[DIAG-PKG] result:`, JSON.stringify(result, null, 2));
    return { success: true, ...result };
  } catch (err) {
    console.error("[DIAG-PKG] error:", err);
    return { success: false, error: err.message, stack: err.stack };
  }
});

// Diagnostic: test keystroke execution in packaged
ipcMain.handle("diagnostic:test-packaged-keystroke", async (_, keys, holdMs) => {
  console.log(`[DIAG-PKG-KEY] test-packaged-keystroke called keys="${keys}" holdMs=${holdMs}`);
  try {
    const result = await sendKeystroke(keys, holdMs || 100, null);
    console.log(`[DIAG-PKG-KEY] sendKeystroke returned: ${result}`);
    return { success: result, keys, holdMs };
  } catch (err) {
    console.error("[DIAG-PKG-KEY] error:", err);
    return { success: false, error: err.message, stack: err.stack };
  }
});



// Auto-run diagnostic on startup
setTimeout(async () => {
  console.log('[DIAGNOSTIC-AUTO] Starting nut-js Numpad tests...');
  if (nutKeyboard && nutKey) {
    const tests = ['NumPad1', 'NumPadAdd', 'NumPadEnter', 'Enter', 'Num1'];
    for (const keyName of tests) {
      try {
        const nutKeyCode = nutKey[keyName];
        if (nutKeyCode == null) {
          console.log(`[DIAGNOSTIC-AUTO] ${keyName}: nutKey.${keyName} = undefined`);
        } else {
          console.log(`[DIAGNOSTIC-AUTO] ${keyName}: nutKey.${keyName} = ${nutKeyCode}`);
          await nutKeyboard.pressKey(nutKeyCode);
          await new Promise(r => setTimeout(r, 100));
          await nutKeyboard.releaseKey(nutKeyCode);
          console.log(`[DIAGNOSTIC-AUTO] ${keyName}: PRESS/RELEASE successful`);
        }
      } catch (err) {
        console.error(`[DIAGNOSTIC-AUTO] ${keyName} ERROR:`, err.message);
      }
    }
    console.log('[DIAGNOSTIC-AUTO] Available NumPad keys in nutKey:', Object.keys(nutKey).filter(k => k.includes('NumPad') || k.includes('Add') || k.includes('Subtract') || k.includes('Multiply') || k.includes('Divide') || k.includes('Decimal') || k === 'Enter'));
  } else {
    console.log('[DIAGNOSTIC-AUTO] nut-js not available');
  }
}, 3000);

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
// ── FIX 1+2: Register Dexie-resolved media for local HTTP serving ──
ipcMain.handle("media:register", async (_, payload) => {
  try {
    const result = mediaRegistry.register(payload || {});
    console.log("[MEDIA-REGISTER]", JSON.stringify({
      mediaId: result.mediaId || (payload && payload.mediaId) || null,
      success: !!result.success,
      cached: !!result.cached,
      size: result.size || 0,
      contentType: result.contentType || null,
      code: result.code || null,
    }));
    if (result.success) {
      return {
        ...result,
        mediaUrl: mediaRegistry.absoluteUrlFor(result.mediaId, MEDIA_HTTP_PORT || SSE_PORT),
      };
    }
    return result;
  } catch (err) {
    console.error("[MEDIA-REGISTER] error", err);
    return {
      success: false,
      error: err && err.message ? err.message : String(err),
      code: "REGISTER_EXCEPTION",
    };
  }
});

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
ipcMain.handle("points:clearAll", () => { pointsSystem.clearAllPoints(); return { success: true }; });

// ── OBS Controller ──
// Mirror controller.connected (single authoritative flag) to the renderer
// so Setup and Create Action always share the same OBS connection state.
if (typeof obsController.onStatusChange === "function") {
  obsController.onStatusChange((status) => {
    sendToRenderer("obs:status-changed", { connected: !!status?.connected });
  });
}
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

// ── Local TTS (Piper) ──
localTTS.registerIPC();

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

// ── License V2 (backend-proxied via Worker API) ──
ipcMain.handle("licenseV2:status", async (_, userId) => {
  return adminApiRequest("GET", "/license/status");
});
ipcMain.handle("licenseV2:activate", async (_, { userId, licenseKey, email, deviceId }) => {
  return adminApiRequest("POST", "/license/activate", { licenseKey, email, deviceId });
});
ipcMain.handle("licenseV2:deactivate", async (_, userId) => {
  return adminApiRequest("POST", "/license/deactivate", {});
});

// ── Device management (backend-proxied via Worker API) ──
ipcMain.handle("device:register", async (_, { userId, name, platform, appVersion, machineFingerprint }) => {
  return adminApiRequest("POST", "/devices/register", { deviceId: machineFingerprint, name, platform, appVersion, machineFingerprint });
});
ipcMain.handle("device:list", async (_, userId) => {
  return adminApiRequest("GET", "/devices");
});
ipcMain.handle("device:remove", async (_, { userId, machineId }) => {
  return adminApiRequest("POST", "/devices/deactivate", { deviceId: machineId });
});

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

  createTray();
  // Start SSE server first and wait for it to be ready
  await startSSEServer();

  // In development, clear the session cache BEFORE creating the main window.
  // This prevents the main window from loading with stale Vite pre-bundle hashes,
  // which can cause 504 (Gateway Timeout) or 404 errors during development.
  if (isDev && session && session.defaultSession) {
    try {
      console.log("[ELECTRON-DEV] Awaiting session cache clear on startup...");
      await session.defaultSession.clearCache();
      console.log("[ELECTRON-DEV] Session cache cleared successfully.");
    } catch (err) {
      console.error("[ELECTRON-DEV] Failed to clear session cache during startup:", err);
    }
  }

  console.log("[ELECTRON] SSE server ready, creating main window");

  createMainWindow();

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

  // ── Auto-update manager ──
  updateManager.registerIPC();
  updateManager.init(mainWindow);
  logger.info("Auto-update manager initialized");

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
  localTTS.cleanup();
  if (memoryManager) await memoryManager.cleanupAll();
  updateManager.shutdown();
});

// ── Phase 1: Global error handlers ──
process.on("uncaughtException", (error) => {
  console.error("[RF] Uncaught exception:", error.message);
  console.error("[RF] Stack:", error.stack);
});

process.on("unhandledRejection", (reason) => {
  console.error("[RF] Unhandled promise rejection:", reason);
});
