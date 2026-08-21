// Diagnostic script — captures renderer output
const { app, BrowserWindow } = require("electron");
const path = require("path");

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      sandbox: false,
    },
    show: false,
    backgroundColor: "#0a0a0f",
  });

  // Capture ALL renderer console messages
  win.webContents.on("console-message", (e, level, msg, line, sourceId) => {
    const prefix = ["[INFO]", "[WARN]", "[ERROR]"][level] || "[LOG]";
    console.log(`[RENDERER ${prefix}] ${msg} (${sourceId}:${line})`);
  });

  // Capture page load failures
  win.webContents.on("did-fail-load", (e, code, desc, url) => {
    console.log(`[LOAD-FAIL] ${code}: ${desc} URL=${url}`);
  });

  // Capture renderer crashes
  win.webContents.on("render-process-gone", (e, details) => {
    console.log(`[CRASH] ${details.reason}: ${details.exitCode}`);
  });

  // After page loads, inject diagnostics
  win.webContents.on("did-finish-load", () => {
    console.log(`[DIAG] Page loaded. URL=${win.webContents.getURL()}`);
    console.log(`[DIAG] isLoading=${win.webContents.isLoading()}`);

    // Wait for React to mount, then check DOM
    setTimeout(() => {
      win.webContents.executeJavaScript(`
        (function() {
          const root = document.getElementById("root");
          const body = document.body;
          const html = document.documentElement;

          function getStyles(el) {
            if (!el) return null;
            const cs = window.getComputedStyle(el);
            return {
              display: cs.display,
              visibility: cs.visibility,
              opacity: cs.opacity,
              width: cs.width,
              height: cs.height,
              position: cs.position,
              zIndex: cs.zIndex,
              transform: cs.transform,
              filter: cs.filter,
              backgroundColor: cs.backgroundColor,
              color: cs.color,
              overflow: cs.overflow,
            };
          }

          return {
            readyState: document.readyState,
            rootExists: !!root,
            rootChildren: root ? root.childElementCount : 0,
            rootInnerHTML: root ? root.innerHTML.substring(0, 1000) : null,
            htmlStyles: getStyles(html),
            bodyStyles: getStyles(body),
            rootStyles: getStyles(root),
            firstChildStyles: root && root.firstElementChild ? getStyles(root.firstElementChild) : null,
            route: window.location.hash,
            electronAPI: !!window.electronAPI,
            title: document.title,
          };
        })()
      `).then(result => {
        console.log("[DIAG] DOM STATE:", JSON.stringify(result, null, 2));
      }).catch(err => {
        console.log("[DIAG-ERR]", err.message);
      });
    }, 5000); // Wait 5s for React to fully mount
  });

  win.loadURL("http://localhost:5173");
  win.webContents.openDevTools();
  win.once("ready-to-show", () => win.show());

  // Auto-quit after 15s
  setTimeout(() => {
    console.log("[DIAG] Auto-quit after 15s");
    app.quit();
  }, 15000);
});

app.on("window-all-closed", () => app.quit());
