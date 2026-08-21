// =============================================
// RosaeFinity — TikTok Service Adapter (Main Process)
// Isolates tiktok-live-connector behind a stable interface
// Runs ONLY in Electron main process
// =============================================

const { EventEmitter } = require("events");

const CONNECT_TIMEOUT_MS = 15000;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_BASE_DELAY_MS = 2000;
const MAX_RECONNECT_DELAY_MS = 30000;
const HEARTBEAT_INTERVAL_MS = 30000;

// TikTok event type mapping from tiktok-live-connector
const WEB_CAST_EVENT = {
  GIFT: "gift",
  LIKE: "like",
  ROOM_USER: "roomUser",
  SUBSCRIBE: "subscribe",
  COMMENT: "comment",
  FOLLOW: "follow",
  SHARE: "share",
  MEMBER: "member",
  CONTROL: "control",
};

const CONTROL_EVENT = {
  STREAM_END: "streamEnd",
  DISCONNECTED: "disconnected",
};

class TikTokService extends EventEmitter {
  constructor() {
    super();
    this.screens = new Map(); // screenId -> { connection, state, config }
    this.TikTokLiveConnection = null;
    this.WebcastEvent = null;
    this.ControlEvent = null;
    this._moduleLoaded = false;
  }

  /** Load tiktok-live-connector dynamically (lazy load) */
  async _ensureModule() {
    if (this._moduleLoaded) return;
    try {
      const mod = await import("tiktok-live-connector");
      this.TikTokLiveConnection = mod.TikTokLiveConnection;
      this.WebcastEvent = mod.WebcastEvent;
      this.ControlEvent = mod.ControlEvent;
      this._moduleLoaded = true;
      console.log("[TIKTOK] Service module loaded");
    } catch (e) {
      console.error("[TIKTOK] Failed to load tiktok-live-connector:", e.message);
      throw new Error("tiktok-live-connector not available");
    }
  }

  /** Get or create screen state */
  _getScreenState(screenId) {
    if (!this.screens.has(screenId)) {
      this.screens.set(screenId, {
        connection: null,
        state: "idle", // idle | connecting | connected | reconnecting | disconnected | error
        username: null,
        roomId: null,
        reconnectAttempts: 0,
        reconnectTimer: null,
        heartbeatTimer: null,
        isManualDisconnect: false,
      });
    }
    return this.screens.get(screenId);
  }

  /** Clear reconnect timer */
  _clearReconnectTimer(screenState) {
    if (screenState.reconnectTimer) {
      clearTimeout(screenState.reconnectTimer);
      screenState.reconnectTimer = null;
    }
  }

  /** Clear heartbeat timer */
  _clearHeartbeatTimer(screenState) {
    if (screenState.heartbeatTimer) {
      clearInterval(screenState.heartbeatTimer);
      screenState.heartbeatTimer = null;
    }
  }

  /** Start heartbeat for a screen */
  _startHeartbeat(screenId) {
    const screenState = this._getScreenState(screenId);
    this._clearHeartbeatTimer(screenState);
    screenState.heartbeatTimer = setInterval(() => {
      this.emit("health", { screenId, timestamp: Date.now() });
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** Emit normalized event to renderer via IPC */
  _emitEvent(event) {
    this.emit("event", event);
  }

  /** Connect to a TikTok username for a specific screen */
  async connect(screenId, username) {
    await this._ensureModule();

    const screenState = this._getScreenState(screenId);
    const cleanUsername = username.replace(/^@/, "").trim();

    if (!cleanUsername) {
      throw new Error("Username is required");
    }

    // Duplicate connection protection
    if (screenState.state === "connected" && screenState.username === cleanUsername) {
      console.log(`[TIKTOK] screen=${screenId} already connected to @${cleanUsername}`);
      return { success: true, alreadyConnected: true };
    }

    if (screenState.state === "connecting") {
      console.log(`[TIKTOK] screen=${screenId} connection already in progress`);
      return { success: true, alreadyConnecting: true };
    }

    // Disconnect existing connection if different user
    if (screenState.connection) {
      await this.disconnect(screenId);
    }

    screenState.username = cleanUsername;
    screenState.isManualDisconnect = false;
    screenState.state = "connecting";
    screenState.reconnectAttempts = 0;

    console.log(`[TIKTOK] screen=${screenId} connect START @${cleanUsername}`);

    return new Promise((resolve, reject) => {
      // Create connection with timeout
      let connection;
      let resolved = false;
      let timeoutHandle;

      const cleanup = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        this._clearReconnectTimer(screenState);
      };

      const timeoutPromise = new Promise((_, rejectTimeout) => {
        timeoutHandle = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            cleanup();
            if (connection) {
              try { connection.disconnect(); } catch (_) {}
              screenState.connection = null;
            }
            screenState.state = "error";
            reject(new Error(`Connection timeout after ${CONNECT_TIMEOUT_MS}ms`));
          }
        }, CONNECT_TIMEOUT_MS);
      });

      try {
        connection = new this.TikTokLiveConnection(cleanUsername, {
          enableExtendedGiftInfo: true,
          requestPollingIntervalMs: 2000,
        });

        screenState.connection = connection;

        const connectPromise = connection.connect().then((viewerState) => {
          if (resolved) return;
          resolved = true;
          cleanup();

          screenState.state = "connected";
          screenState.roomId = viewerState.roomId || null;
          screenState.reconnectAttempts = 0;
          this._startHeartbeat(screenId);

          console.log(`[TIKTOK] screen=${screenId} connect SUCCESS roomId=${viewerState.roomId} viewers=${viewerState.viewerCount || 0}`);

          // Emit connected event
          this._emitEvent({
            type: "connected",
            screenId,
            username: cleanUsername,
            roomId: viewerState.roomId,
            viewerCount: viewerState.viewerCount || 0,
            timestamp: Date.now(),
          });

          resolve({ success: true, roomId: viewerState.roomId, viewerCount: viewerState.viewerCount || 0 });
        }).catch((err) => {
          if (resolved) return;
          resolved = true;
          cleanup();

          screenState.connection = null;
          screenState.state = "error";

          const msg = this._friendlyError(err, cleanUsername);
          console.error(`[TIKTOK] screen=${screenId} connect ERROR: ${msg}`);

          this._emitEvent({
            type: "error",
            screenId,
            message: msg,
            timestamp: Date.now(),
          });

          // Schedule reconnect if not manual disconnect
          if (!screenState.isManualDisconnect) {
            this._scheduleReconnect(screenId, cleanUsername);
          }

          reject(new Error(msg));
        });

        // Race connection against timeout
        Promise.race([connectPromise, timeoutPromise]).catch(() => {});

        // ── Event Handlers ──
        // GIFT
        connection.on(this.WebcastEvent.GIFT, (data) => {
          if (data.giftType === 1 && !data.repeatEnd) return; // Skip combo updates mid-stream
          this._emitEvent(this._normalizeGiftEvent(screenId, cleanUsername, data));
        });

        // LIKE
        connection.on(this.WebcastEvent.LIKE, (data) => {
          this._emitEvent(this._normalizeLikeEvent(screenId, cleanUsername, data));
        });

        // ROOM_USER (viewer count)
        connection.on(this.WebcastEvent.ROOM_USER, (data) => {
          this._emitEvent({
            type: "viewer-update",
            screenId,
            viewerCount: data.viewerCount || 0,
            timestamp: Date.now(),
          });
        });

        // SUBSCRIBE
        connection.on(this.WebcastEvent.SUBSCRIBE, (data) => {
          this._emitEvent(this._normalizeSubscribeEvent(screenId, cleanUsername, data));
        });

        // COMMENT
        if (this.WebcastEvent.COMMENT) {
          connection.on(this.WebcastEvent.COMMENT, (data) => {
            this._emitEvent(this._normalizeCommentEvent(screenId, cleanUsername, data));
          });
        }

        // FOLLOW
        if (this.WebcastEvent.FOLLOW) {
          connection.on(this.WebcastEvent.FOLLOW, (data) => {
            this._emitEvent(this._normalizeFollowEvent(screenId, cleanUsername, data));
          });
        }

        // SHARE
        if (this.WebcastEvent.SHARE) {
          connection.on(this.WebcastEvent.SHARE, (data) => {
            this._emitEvent(this._normalizeShareEvent(screenId, cleanUsername, data));
          });
        }

        // MEMBER/JOIN
        if (this.WebcastEvent.MEMBER) {
          connection.on(this.WebcastEvent.MEMBER, (data) => {
            this._emitEvent(this._normalizeMemberEvent(screenId, cleanUsername, data));
          });
        }

        // CONTROL EVENTS
        if (this.ControlEvent) {
          connection.on(this.ControlEvent.STREAM_END, () => {
            console.log(`[TIKTOK] screen=${screenId} stream ended`);
            this._handleDisconnect(screenId, "Stream ended");
          });

          connection.on(this.ControlEvent.DISCONNECTED, () => {
            console.log(`[TIKTOK] screen=${screenId} disconnected`);
            this._handleDisconnect(screenId, "Disconnected");
          });
        }

        // ERROR
        connection.on("error", (err) => {
          const msg = this._friendlyError(err, cleanUsername);
          console.error(`[TIKTOK] screen=${screenId} error: ${msg}`);

          this._emitEvent({
            type: "error",
            screenId,
            message: msg,
            timestamp: Date.now(),
          });

          // Only schedule reconnect for network/transient errors, not auth/user errors
          if (!screenState.isManualDisconnect && this._shouldReconnect(msg)) {
            this._scheduleReconnect(screenId, cleanUsername);
          }
        });

      } catch (err) {
        if (resolved) return;
        resolved = true;
        cleanup();

        screenState.connection = null;
        screenState.state = "error";

        const msg = this._friendlyError(err, cleanUsername);
        console.error(`[TIKTOK] screen=${screenId} init ERROR: ${msg}`);

        this._emitEvent({
          type: "error",
          screenId,
          message: msg,
          timestamp: Date.now(),
        });

        if (!screenState.isManualDisconnect) {
          this._scheduleReconnect(screenId, cleanUsername);
        }

        reject(new Error(msg));
      }
    });
  }

  /** Disconnect a specific screen */
  async disconnect(screenId) {
    const screenState = this._getScreenState(screenId);
    screenState.isManualDisconnect = true;

    this._clearReconnectTimer(screenState);
    this._clearHeartbeatTimer(screenState);

    if (screenState.connection) {
      try {
        screenState.connection.disconnect();
      } catch (_) {}
      screenState.connection = null;
    }

    const wasConnected = screenState.state === "connected";
    screenState.state = "disconnected";
    screenState.username = null;
    screenState.roomId = null;
    screenState.reconnectAttempts = 0;

    if (wasConnected) {
      this._emitEvent({
        type: "disconnected",
        screenId,
        reason: "Manual disconnect",
        timestamp: Date.now(),
      });
    }

    console.log(`[TIKTOK] screen=${screenId} disconnect`);
  }

  /** Get connection state for a screen */
  getState(screenId) {
    const screenState = this._getScreenState(screenId);
    return {
      state: screenState.state,
      username: screenState.username,
      roomId: screenState.roomId,
      reconnectAttempts: screenState.reconnectAttempts,
    };
  }

  /** Get all screen states */
  getAllStates() {
    const states = {};
    for (const [screenId, state] of this.screens) {
      states[screenId] = this.getState(screenId);
    }
    return states;
  }

  /** Check if a screen is connected */
  isConnected(screenId) {
    const screenState = this._getScreenState(screenId);
    return screenState.state === "connected";
  }

  /** Schedule reconnect with exponential backoff */
  _scheduleReconnect(screenId, username) {
    const screenState = this._getScreenState(screenId);

    if (screenState.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.log(`[TIKTOK] screen=${screenId} max reconnect attempts reached`);
      screenState.state = "error";
      this._emitEvent({
        type: "error",
        screenId,
        message: `Gagal connect setelah ${MAX_RECONNECT_ATTEMPTS} percobaan.`,
        timestamp: Date.now(),
      });
      return;
    }

    if (screenState.isManualDisconnect) return;

    this._clearReconnectTimer(screenState);
    screenState.state = "reconnecting";
    screenState.reconnectAttempts++;

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * Math.pow(1.5, screenState.reconnectAttempts - 1),
      MAX_RECONNECT_DELAY_MS
    );
    const jitter = delay * 0.1 * Math.random();

    console.log(`[TIKTOK] screen=${screenId} reconnecting in ${Math.round(delay + jitter)}ms (attempt ${screenState.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    this._emitEvent({
      type: "reconnecting",
      screenId,
      attempt: screenState.reconnectAttempts,
      timestamp: Date.now(),
    });

    screenState.reconnectTimer = setTimeout(() => {
      this.connect(screenId, username).catch((err) => {
        console.error(`[TIKTOK] screen=${screenId} reconnect failed:`, err.message);
      });
    }, delay + jitter);
  }

  /** Handle disconnection */
  _handleDisconnect(screenId, reason) {
    const screenState = this._getScreenState(screenId);
    const wasConnected = screenState.state === "connected";

    this._clearHeartbeatTimer(screenState);
    screenState.state = "disconnected";

    if (wasConnected) {
      this._emitEvent({
        type: "disconnected",
        screenId,
        reason,
        timestamp: Date.now(),
      });
    }

    // Schedule reconnect if not manual
    if (!screenState.isManualDisconnect && screenState.username) {
      this._scheduleReconnect(screenId, screenState.username);
    }
  }

  /** Normalize error messages */
  _friendlyError(err, username) {
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

  /** Determine if error should trigger reconnect */
  _shouldReconnect(msg) {
    const m = msg.toLowerCase();
    if (m.includes("falling back") || m.includes("no more sources") || m.includes("error while connecting")) return true;
    if (m.includes("sedang tidak live") || m.includes("tidak ditemukan") || m.includes("tidak ada koneksi")) return false;
    if (m.includes("rate limit") || m.includes("429")) return false;
    return true; // Default: reconnect on unknown errors
  }

  /** Event normalization methods */
  _normalizeGiftEvent(screenId, username, data) {
    return {
      type: "gift",
      screenId,
      user: data.user?.uniqueId || data.uniqueId || "someone",
      nickname: data.user?.nickname || data.nickname || "",
      giftName: data.giftDetails?.giftName || data.giftName || "Gift",
      giftId: data.giftId,
      repeatCount: data.repeatCount || 1,
      diamondCount: data.giftDetails?.diamondCount || data.diamondCount || 0,
      timestamp: Date.now(),
    };
  }

  _normalizeLikeEvent(screenId, username, data) {
    return {
      type: "like",
      screenId,
      user: data.user?.uniqueId || data.uniqueId || "someone",
      nickname: data.user?.nickname || data.nickname || "",
      likeCount: data.likeCount || 1,
      totalLikeCount: data.totalLikeCount || 0,
      timestamp: Date.now(),
    };
  }

  _normalizeSubscribeEvent(screenId, username, data) {
    return {
      type: "subscribe",
      screenId,
      user: data.user?.uniqueId || "someone",
      nickname: data.user?.nickname || "",
      timestamp: Date.now(),
    };
  }

  _normalizeCommentEvent(screenId, username, data) {
    return {
      type: "comment",
      screenId,
      user: data.user?.uniqueId || data.uniqueId || "someone",
      nickname: data.user?.nickname || data.nickname || "",
      comment: data.comment || data.message || "",
      timestamp: Date.now(),
    };
  }

  _normalizeFollowEvent(screenId, username, data) {
    return {
      type: "follow",
      screenId,
      user: data.user?.uniqueId || "someone",
      nickname: data.user?.nickname || "",
      timestamp: Date.now(),
    };
  }

  _normalizeShareEvent(screenId, username, data) {
    return {
      type: "share",
      screenId,
      user: data.user?.uniqueId || "someone",
      nickname: data.user?.nickname || "",
      timestamp: Date.now(),
    };
  }

  _normalizeMemberEvent(screenId, username, data) {
    return {
      type: "member",
      screenId,
      user: data.user?.uniqueId || "someone",
      nickname: data.user?.nickname || "",
      timestamp: Date.now(),
    };
  }

  /** Shutdown all connections */
  shutdown() {
    for (const [screenId] of this.screens) {
      this.disconnect(screenId);
    }
    this.screens.clear();
    console.log("[TIKTOK] Service shutdown complete");
  }
}

// Singleton instance
let _service = null;

function getTikTokService() {
  if (!_service) {
    _service = new TikTokService();
  }
  return _service;
}

module.exports = { TikTokService, getTikTokService };