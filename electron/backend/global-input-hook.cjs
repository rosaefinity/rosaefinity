// ═══════════════════════════════════════════════════════════════
// RosaeFinity Global Input Hook
// Captures keyboard and mouse input for action configuration.
//
// Keyboard: Uses Electron's before-input-event (works when app window is focused)
// Mouse:    Polls libnut-win32.getMousePos() at configurable interval
//
// Known limitation: Keyboard capture only works when the Electron window
// has focus. This is sufficient for the action configuration use case.
// ═══════════════════════════════════════════════════════════════

let running = false;
let callback = null;
let mousePollTimer = null;
let lastMousePos = { x: 0, y: 0 };
let inputEventHandlers = [];

const MOUSE_POLL_INTERVAL_MS = 50; // 20 Hz mouse position polling

/**
 * Start the global input hook.
 * @param {Function} cb - callback(type, data) invoked for each input event
 * @returns {boolean} true if hook started successfully
 */
function startGlobalHook(cb) {
  if (running) return true;
  if (!cb || typeof cb !== 'function') return false;

  callback = cb;
  running = true;

  // ── Mouse polling ──
  try {
    const libnut = require('@nut-tree-fork/libnut-win32');
    const pos = libnut.getMousePos();
    lastMousePos = { x: pos.x, y: pos.y };

    mousePollTimer = setInterval(() => {
      try {
        const current = libnut.getMousePos();
        if (current.x !== lastMousePos.x || current.y !== lastMousePos.y) {
          const dx = current.x - lastMousePos.x;
          const dy = current.y - lastMousePos.y;
          lastMousePos = { x: current.x, y: current.y };
          safeCallback("mousemove", {
            x: current.x,
            y: current.y,
            dx,
            dy,
          });
        }
      } catch {
        // libnut error — ignore and continue
      }
    }, MOUSE_POLL_INTERVAL_MS);
  } catch (err) {
    console.error("[GlobalHook] Failed to start mouse polling:", err.message);
  }

  // ── Keyboard capture via Electron before-input-event ──
  // This requires the BrowserWindow to be available.
  // The caller (main.cjs) must register the event AFTER the window is created.
  // We provide a helper for main.cjs to call.
  setupKeyboardCapture();

  console.log("[GlobalHook] Started");
  return true;
}

/**
 * Register before-input-event handlers on all BrowserWindows.
 * Called internally and available for main.cjs to call after window creation.
 */
function setupKeyboardCapture() {
  try {
    const { BrowserWindow, app } = require("electron");

    const handler = (_window, event) => {
      if (!running || !callback) return;

      // event.type: "keyDown" | "keyUp"
      // event.key: the key name (e.g. "a", "Shift", "Control")
      // event.code: physical key code (e.g. "KeyA", "ShiftLeft")
      // event.alt, event.ctrl, event.shift, event.meta: modifier states
      // event.nativeKeyCode: Windows virtual key code

      const type = event.type === "keyDown" ? "keydown" : "keyup";
      const data = {
        key: event.key,
        code: event.code,
        keyCode: event.nativeKeyCode,
        alt: event.alt,
        ctrl: event.ctrl,
        shift: event.shift,
        meta: event.meta,
      };

      safeCallback(type, data);
    };

    // Attach to all existing windows
    BrowserWindow.getAllWindows().forEach(win => {
      if (!win.isDestroyed()) {
        win.webContents.on("before-input-event", handler);
        inputEventHandlers.push({ win, handler });
      }
    });

    // Attach to future windows
    app.on("browser-window-created", (_event, win) => {
      if (!running) return;
      win.webContents.on("before-input-event", handler);
      inputEventHandlers.push({ win, handler });
    });
  } catch (err) {
    console.error("[GlobalHook] Failed to setup keyboard capture:", err.message);
  }
}

/**
 * Stop the global input hook and clean up all resources.
 */
function stopGlobalHook() {
  if (!running) return;

  running = false;
  callback = null;

  // Stop mouse polling
  if (mousePollTimer) {
    clearInterval(mousePollTimer);
    mousePollTimer = null;
  }

  // Remove keyboard capture handlers
  inputEventHandlers.forEach(({ win, handler }) => {
    try {
      if (win && !win.isDestroyed()) {
        win.webContents.removeListener("before-input-event", handler);
      }
    } catch {
      // Window may already be destroyed — ignore
    }
  });
  inputEventHandlers = [];

  console.log("[GlobalHook] Stopped");
}

/**
 * Check if the hook is currently running.
 * @returns {boolean}
 */
function isHookRunning() {
  return running;
}

/**
 * Invoke the callback safely, swallowing errors.
 */
function safeCallback(type, data) {
  try {
    if (callback) callback(type, data);
  } catch (err) {
    console.error("[GlobalHook] Callback error:", err.message);
  }
}

module.exports = {
  startGlobalHook,
  stopGlobalHook,
  isHookRunning,
};
