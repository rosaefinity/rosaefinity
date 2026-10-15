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
const MIN_RATE_LIMIT_COOLDOWN_MS = 5_000;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 30_000;
const MAX_RATE_LIMIT_COOLDOWN_MS = 60_000;

// Debug flag for high-frequency forensic logs
const TIKTOK_SERVICE_DEBUG = process.env.RF_DEBUG === "1" || process.env.NODE_ENV === "development";

// Monotonically increasing connection attempt ID for lifecycle tracking
let _nextAttemptId = 1;

// Monotonically increasing signing request ID for HTTP request tracing
let _nextSigningRequestId = 1;

// TikTok event type mapping from tiktok-live-connector
const WEB_CAST_EVENT = {
  GIFT: "gift",
  LIKE: "like",
  ROOM_USER: "roomUser",
  SUBSCRIBE: "subscribe",
  COMMENT: "chat",
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
      if (TIKTOK_SERVICE_DEBUG) console.log("[TIKTOK-CONNECT] package loaded", { name: "tiktok-live-connector", version: mod.VERSION || "unknown" });
      console.log("[TIKTOK-CONNECT] module path", { path: require.resolve("tiktok-live-connector").replace(/\\/g, "/") });
    } catch (e) {
      console.error("[TIKTOK-CONNECT] Failed to load tiktok-live-connector:", e.message);
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
        rateLimited: false,
        cooldownTimer: null,
        // Server-enforced rate limit deadline (the SINGLE authoritative deadline)
        serverRetryUntil: null,
        // Last connection attempt ID for lifecycle tracking
        lastAttemptId: null,
        // Rate-limit deduplication: attemptId of the connection attempt whose rate limit was already handled
        handledRateLimitAttemptId: null,
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

  /** Clear cooldown timer */
  _clearCooldownTimer(screenState) {
    if (screenState.cooldownTimer) {
      clearTimeout(screenState.cooldownTimer);
      screenState.cooldownTimer = null;
    }
  }

  /** Enter rate-limit cooldown state
   *  Uses serverRetryUntil as the SINGLE authoritative deadline for both
   *  backend connection guard and UI display. No separate UI cooldown timer.
   *  @param {string} screenId
   *  @param {object} screenState
   *  @param {number} serverRetryAfterMs - The REAL server retry-after in ms (e.g. 285000)
   *  @param {object} auditInfo - Additional audit info for logging (must include attemptId)
   *  @returns {boolean} - true if cooldown was entered, false if invalid/skipped
   */
  _enterRateLimitCooldown(screenId, screenState, serverRetryAfterMs, auditInfo = {}) {
    const now = Date.now();
    const attemptId = auditInfo.attemptId ?? screenState.lastAttemptId;

    // VALIDATION: Reject invalid cooldown values
    if (
      serverRetryAfterMs === null ||
      serverRetryAfterMs === undefined ||
      isNaN(serverRetryAfterMs) ||
      !Number.isFinite(serverRetryAfterMs) ||
      serverRetryAfterMs <= 0
    ) {
      console.log(`[TIKTOK-RATE-LIMIT-INVALID] rejected invalid serverRetryAfterMs`, JSON.stringify({
        screenId,
        attemptId,
        serverRetryAfterMs,
        source: auditInfo.source || "unknown",
        reason: "serverRetryAfterMs is null, undefined, NaN, non-finite, or <= 0",
        errorMessage: auditInfo.errorMessage,
      }));
      return false;
    }

    const serverRetryUntil = now + serverRetryAfterMs;

    // VALIDATION: Ensure deadline is a finite future timestamp
    // This is the REQUIRED INVARIANT: Number.isFinite(serverRetryUntil) && serverRetryUntil > Date.now()
    if (!Number.isFinite(serverRetryUntil) || serverRetryUntil <= now) {
      console.log(`[TIKTOK-RATE-LIMIT-INVALID] rejected expired/non-finite deadline`, JSON.stringify({
        screenId,
        attemptId,
        serverRetryAfterMs,
        serverRetryUntil: new Date(serverRetryUntil).toISOString(),
        now: new Date(now).toISOString(),
        source: auditInfo.source || "unknown",
        reason: !Number.isFinite(serverRetryUntil) ? "serverRetryUntil is non-finite" : "serverRetryUntil <= Date.now() — deadline already expired",
        errorMessage: auditInfo.errorMessage,
      }));
      return false;
    }

    // SANITY WARNING: Log suspiciously long durations (> 24h) but still honor them
    // Genuine server rate limits (e.g., EulerStream daily account limits) can exceed 24 hours
    if (serverRetryAfterMs > 86400000) {
      console.log(`[TIKTOK-RATE-LIMIT-SANITY-WARNING] long cooldown accepted`, JSON.stringify({
        screenId,
        attemptId,
        serverRetryAfterMs,
        serverRetryAfterReadable: `${Math.ceil(serverRetryAfterMs / 1000)}s (${Math.round(serverRetryAfterMs / 3600000 * 10) / 10}h)`,
        serverRetryUntil: new Date(serverRetryUntil).toISOString(),
        now: new Date(now).toISOString(),
        source: auditInfo.source || "unknown",
        reason: "serverRetryAfterMs > 24h — accepting valid future deadline from server",
        errorMessage: auditInfo.errorMessage,
      }));
    }

    // DEDUPLICATION: If this exact attemptId already had its rate limit handled, ignore
    if (screenState.handledRateLimitAttemptId === attemptId) {
      console.log(`[TIKTOK-RATE-LIMIT-DEDUP] skipping duplicate for attemptId=${attemptId}`, JSON.stringify({
        screenId,
        attemptId,
        existingHandledAttemptId: screenState.handledRateLimitAttemptId,
        serverRetryUntil: screenState.serverRetryUntil ? new Date(screenState.serverRetryUntil).toISOString() : null,
        auditInfo,
      }));
      return false;
    }

    // Mark this attemptId as handled
    screenState.handledRateLimitAttemptId = attemptId;

    // The server-enforced deadline — when the sign server will actually accept requests again
    // This is the SINGLE authoritative deadline used by both backend and UI
    screenState.serverRetryUntil = serverRetryUntil;
    screenState.rateLimited = true;
    screenState.state = "error";

    console.log(`[TIKTOK-CONNECT-TRACE] rate limit state entered`, JSON.stringify({
      screenId,
      attemptId: screenState.lastAttemptId,
      serverRetryAfterMs,
      serverRetryAfterReadable: `${Math.ceil(serverRetryAfterMs / 1000)}s`,
      serverRetryUntil: new Date(serverRetryUntil).toISOString(),
      now: new Date(now).toISOString(),
      ...auditInfo,
    }));

    // Cancel any pending reconnect
    this._clearReconnectTimer(screenState);

    console.log(`[TIKTOK-RATE-LIMIT-AUDIT] cooldown decision`, JSON.stringify({
      screenId,
      attemptId: screenState.lastAttemptId,
      rawServerRetryAfterMs: serverRetryAfterMs,
      serverRetryUntil: new Date(serverRetryUntil).toISOString(),
      serverRetryAfterReadable: `${Math.ceil(serverRetryAfterMs / 1000)}s`,
      ...auditInfo,
    }));

    // Emit rate-limit state to renderer — serverRetryUntil is the single deadline
    this._emitEvent({
      type: "rate-limited",
      screenId,
      serverRetryUntil,
      serverRetryAfterMs,
      timestamp: now,
    });

    // Set timer to emit cooldown-expired when serverRetryUntil actually expires
    this._clearCooldownTimer(screenState);
    const cooldownExpiresAt = now + serverRetryAfterMs;
    screenState.cooldownTimer = setTimeout(() => {
      const nowAtExpiry = Date.now();
      console.log(`[TIKTOK-RATE-LIMIT-CLEAR-TRACE]`, JSON.stringify({
        source: "backend-cooldown-timer-expired",
        screenId,
        now: nowAtExpiry,
        serverRetryUntilBeforeClear: screenState.serverRetryUntil,
        remainingMs: screenState.serverRetryUntil ? Math.max(0, screenState.serverRetryUntil - nowAtExpiry) : null,
        isRateLimitedBeforeClear: screenState.rateLimited,
        reason: "cooldown timer naturally expired",
      }));
      screenState.rateLimited = false;
      screenState.serverRetryUntil = null;
      screenState.handledRateLimitAttemptId = null;
      screenState.cooldownTimer = null;
      screenState.state = "disconnected";
      console.log(`[TIKTOK-RATE-LIMIT] server retry window expired`, {
        screenId,
        timestamp: new Date().toISOString(),
      });
      this._emitEvent({
        type: "cooldown-expired",
        screenId,
        serverRetryUntil: null,
        serverStillRateLimited: false,
        timestamp: nowAtExpiry,
      });
    }, serverRetryAfterMs);

    return true;
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
  async connect(screenId, username, source = 'manual') {
    // Generate monotonically increasing attempt ID
    const attemptId = _nextAttemptId++;
    console.log(`[TIKTOK-CONNECT-TRACE] connect() entered`, JSON.stringify({
      attemptId,
      screenId,
      username,
      source,
      timestamp: new Date().toISOString(),
    }));

    await this._ensureModule();

    const screenState = this._getScreenState(screenId);
    const cleanUsername = username.replace(/^@/, "").trim();
    screenState.lastAttemptId = attemptId;

    console.log(`[TIKTOK-CONNECT-TRACE] pre-guard state`, JSON.stringify({
      attemptId,
      screenId,
      connectionState: screenState.state,
      rateLimited: screenState.rateLimited,
      serverRetryUntil: screenState.serverRetryUntil,
      serverRetryUntilReadable: screenState.serverRetryUntil ? new Date(screenState.serverRetryUntil).toISOString() : null,
      hasActiveConnection: !!screenState.connection,
      lastAttemptId: screenState.lastAttemptId,
      reconnectAttempts: screenState.reconnectAttempts,
      now: Date.now(),
      nowIso: new Date().toISOString(),
    }));

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

    // Rate-limit cooldown guard — use serverRetryUntil as the SINGLE authoritative deadline
    const now = Date.now();
    const serverStillRateLimited = screenState.serverRetryUntil && now < screenState.serverRetryUntil;

    if (serverStillRateLimited) {
      const serverRemainingMs = screenState.serverRetryUntil - now;
      console.log(`[TIKTOK-CONNECT-TRACE] rate-limit guard BLOCKED`, JSON.stringify({
        attemptId,
        screenId,
        blockedReason: "server rate limit active",
        connectionState: screenState.state,
        serverRetryUntil: new Date(screenState.serverRetryUntil).toISOString(),
        serverRemainingMs,
        serverRemainingSec: Math.ceil(serverRemainingMs / 1000),
      }));
      return {
        success: false,
        error: `Rate limit active. Try again in ${Math.ceil(serverRemainingMs / 1000)} seconds.`,
        cooldownRemainingMs: serverRemainingMs,
        isRateLimit: true,
      };
    }

    console.log(`[TIKTOK-CONNECT-TRACE] rate-limit guard PASSED`, JSON.stringify({
      attemptId,
      screenId,
      reason: screenState.serverRetryUntil ? 'serverRetryUntil in the past' : 'no serverRetryUntil set',
    }));

    // Disconnect existing connection if different user
    if (screenState.connection) {
      await this.disconnect(screenId);
    }

    // Clear any stale server retry deadline on successful connect attempt
    screenState.serverRetryUntil = null;
    screenState.rateLimited = false;
    screenState.handledRateLimitAttemptId = null;
    screenState.username = cleanUsername;
    screenState.isManualDisconnect = false;
    screenState.state = "connecting";
    screenState.reconnectAttempts = 0;

    console.log(`[TIKTOK-CONNECT-TRACE] signing request starting`, JSON.stringify({ attemptId, screenId, username: cleanUsername }));

    console.log(`[TIKTOK-CONNECT] creating connection`, { screenId, username: cleanUsername, attemptId });

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
            console.log(`[TIKTOK-LIFECYCLE-TRACE] connection timeout`, JSON.stringify({
              source: "connection-timeout",
              screenId,
              attemptId,
              timestamp: Date.now(),
              currentStatus: screenState.state,
              username: screenState.username,
              roomId: screenState.roomId,
              isConnected: screenState.state === "connected",
              isConnecting: screenState.state === "connecting",
              rateLimited: screenState.rateLimited,
              serverRetryUntil: screenState.serverRetryUntil,
              reconnectAttempts: screenState.reconnectAttempts,
              reconnectScheduled: !!screenState.reconnectTimer,
              timeoutMs: CONNECT_TIMEOUT_MS,
            }));
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
        console.log(`[TIKTOK-CONNECT] creating TikTokLiveConnection for @${cleanUsername}`);
        connection = new this.TikTokLiveConnection(cleanUsername, {
          // NOTE: enableExtendedGiftInfo removed — it calls fetchAvailableGifts()
          // BEFORE the WebSocket, blocking the entire connection if the gift API fails.
          // Gift metadata is fetched AFTER connection is established (non-blocking).
          requestPollingIntervalMs: 2000,
        });

        screenState.connection = connection;

        // ── Signing request tracing ──
        const signingRequestId = _nextSigningRequestId++;
        console.log(`[TIKTOK-SIGN-REQUEST]`, JSON.stringify({
          signingRequestId,
          attemptId,
          screenId,
          username: cleanUsername,
          timestamp: Date.now(),
          timestampIso: new Date().toISOString(),
          trigger: source,
          reconnectAttempt: screenState.reconnectAttempts,
          rateLimited: screenState.rateLimited,
          serverRetryUntil: screenState.serverRetryUntil,
          serverRetryUntilIso: screenState.serverRetryUntil ? new Date(screenState.serverRetryUntil).toISOString() : null,
        }));

        const connectPromise = connection.connect().then((viewerState) => {
          if (resolved) return;
          resolved = true;
          cleanup();

          // [TIKTOK-DISCONNECT-TRACE][SERVICE] Guard: if disconnect() was called
          // while connect() was still pending, do NOT overwrite the disconnected state.
          if (screenState.state === "disconnected" || screenState.isManualDisconnect) {
            console.log(`[TIKTOK-DISCONNECT-TRACE][SERVICE]`, JSON.stringify({
              screenId,
              attemptId,
              reason: "connect promise resolved AFTER disconnect — discarding",
              screenState: screenState.state,
              isManualDisconnect: screenState.isManualDisconnect,
              timestamp: Date.now(),
            }));
            // Clean up the stale connection object
            try { connection.disconnect(); } catch (_) {}
            return;
          }

          screenState.state = "connected";
          screenState.roomId = viewerState.roomId || null;
          screenState.reconnectAttempts = 0;
          this._startHeartbeat(screenId);

          console.log(`[TIKTOK-LIFECYCLE-TRACE] connection established`, JSON.stringify({
            source: "connection-success",
            screenId,
            attemptId,
            timestamp: Date.now(),
            currentStatus: "connected",
            username: cleanUsername,
            roomId: viewerState.roomId,
            isConnected: true,
            isConnecting: false,
            rateLimited: screenState.rateLimited,
            serverRetryUntil: screenState.serverRetryUntil,
            reconnectAttempts: screenState.reconnectAttempts,
            reconnectScheduled: false,
          }));
          console.log(`[TIKTOK-CONNECT-TRACE] connection SUCCESS`, JSON.stringify({ attemptId, screenId, roomId: viewerState.roomId, viewers: viewerState.viewerCount || 0 }));
          console.log(`[TIKTOK-CONNECT] connected`, { screenId, roomId: viewerState.roomId, viewers: viewerState.viewerCount || 0 });

          // Emit connected event
          this._emitEvent({
            type: "connected",
            screenId,
            username: cleanUsername,
            roomId: viewerState.roomId,
            viewerCount: viewerState.viewerCount || 0,
            timestamp: Date.now(),
          });

          // Post-connect: fetch gift metadata in background (non-blocking)
          this._fetchGiftsInBackground(connection, screenId, cleanUsername);

          resolve({ success: true, roomId: viewerState.roomId, viewerCount: viewerState.viewerCount || 0 });
        }).catch((err) => {
          if (resolved) return;
          resolved = true;
          cleanup();

          screenState.connection = null;
          screenState.state = "error";

          const msg = this._friendlyError(err, cleanUsername);
          const errorClassification = this._classifyError(err, screenState);
          const isRateLimit = errorClassification === 'rate-limit';

          if (TIKTOK_SERVICE_DEBUG) {
            const responseHeaders = err?.response?.headers || {};
            const rawResponseBody = err?.response?.data;
            let responseBody = null;
            if (rawResponseBody) {
              try {
                const str = typeof rawResponseBody === 'string' ? rawResponseBody : JSON.stringify(rawResponseBody);
                responseBody = str.substring(0, 100);
              } catch (_) {
                responseBody = '[unparseable]';
              }
            }
            console.log(`[TIKTOK-SIGN-RESPONSE]`, JSON.stringify({
              signingRequestId,
              attemptId,
              screenId,
              username: cleanUsername,
              status: err?.response?.status || err?.status || null,
              headers: {
                'retry-after': responseHeaders['retry-after'] || responseHeaders['Retry-After'] || null,
                'x-ratelimit-reset': responseHeaders['x-ratelimit-reset'] || null,
              },
              body: responseBody,
              errorMessage: (err?.message || '').substring(0, 100),
            }));
          }

          console.log(`[TIKTOK-CONNECT-TRACE] connection FAILED`, JSON.stringify({
            attemptId,
            screenId,
            isRateLimit,
            errorClassification,
            errorName: err?.constructor?.name,
            errorMessage: (err?.message || '').substring(0, 200),
            errorStatus: err?.status,
            errorStatusCode: err?.statusCode,
            retryAfter: err?.retryAfter,
            responseStatus: err?.response?.status,
            responseHeaders: err?.response?.headers,
          }));
          console.error(`[TIKTOK-CONNECT] final failure`, { screenId, error: msg, isRateLimit, attemptId });

          // RAW ERROR DUMP — before any masking
          console.log(`[TIKTOK-SIGN-AUDIT] raw connect failure`, JSON.stringify({
            attemptId,
            screenId,
            name: err?.constructor?.name,
            message: err?.message?.substring(0, 300),
            info: err?.info?.substring(0, 300),
            code: err?.code,
            status: err?.status,
            statusCode: err?.statusCode,
            retryAfter: err?.retryAfter,
            resetTime: err?.resetTime,
            responseStatus: err?.response?.status,
            responseHeaders: err?.response?.headers,
            constructorName: err?.constructor?.name,
            stack: err?.stack?.substring(0, 500),
          }));

          console.log(`[TIKTOK-RECONNECT-AUDIT] error received (catch)`, {
            screenId,
            attemptId,
            errorName: err?.constructor?.name,
            errorMessage: (err?.message || "").substring(0, 150),
            friendlyMessage: msg,
            isRateLimit,
            errorClassification,
          });

          this._emitEvent({
            type: "error",
            screenId,
            message: msg,
            isRateLimit,
            classification: errorClassification,
            timestamp: Date.now(),
          });

          // Log reconnect decision for catch path
          const isTransportAlive = screenState.state === "connected" && screenState.roomId != null;
          const shouldReconnect = !screenState.isManualDisconnect && this._shouldReconnect(msg);

          console.log(`[TIKTOK-RECONNECT-DECISION]`, JSON.stringify({
            screenId,
            attemptId,
            currentState: screenState.state,
            errorMessage: (err?.message || '').substring(0, 150),
            errorName: err?.constructor?.name,
            errorClassification,
            isTransportAlive,
            isAlreadyConnected: screenState.state === "connected",
            willReconnect: shouldReconnect && !isRateLimit,
            reason: isRateLimit ? "rate-limit detected — entering cooldown" : (shouldReconnect ? "transient error, will retry" : "error not recoverable or manual disconnect"),
          }));

          if (isRateLimit) {
            // Detailed error shape logging for comparison with on("error") path
            console.log(`[TIKTOK-RATE-LIMIT-TRACE] ERROR SHAPE (.catch path)`, JSON.stringify({
              attemptId,
              screenId,
              constructorName: err?.constructor?.name,
              name: err?.name,
              message: err?.message?.substring(0, 300),
              info: err?.info?.substring(0, 300),
              code: err?.code,
              status: err?.status,
              statusCode: err?.statusCode,
              retryAfter: err?.retryAfter,
              retryAfterType: typeof err?.retryAfter,
              resetTime: err?.resetTime,
              resetTimeType: typeof err?.resetTime,
              hasResponse: !!err?.response,
              responseStatus: err?.response?.status,
              responseHeaders: err?.response?.headers,
              ownKeys: err ? Object.keys(err) : [],
              responseOwnKeys: err?.response ? Object.keys(err.response) : [],
              stack: err?.stack?.substring(0, 300),
            }));

            const rawInfo = this._extractRawRateLimitInfo(err);
            console.log(`[TIKTOK-CONNECT-TRACE] rate limit detected (catch)`, JSON.stringify({
              attemptId,
              screenId,
              errorName: err?.constructor?.name,
              rawServerRetryAfterMs: rawInfo.rawServerRetryAfterMs,
              rawSource: rawInfo.source,
              headers: rawInfo.headers,
              willBlockUntil: rawInfo.rawServerRetryAfterMs
                ? new Date(Date.now() + rawInfo.rawServerRetryAfterMs).toISOString()
                : null,
              willBlockForReadable: rawInfo.rawServerRetryAfterMs
                ? `${Math.ceil(rawInfo.rawServerRetryAfterMs / 1000)}s`
                : null,
              rawErrorMessage: (err?.message || '').substring(0, 300),
              rawErrorInfo: (err?.info || '').substring(0, 300),
            }));

            const entered = this._enterRateLimitCooldown(screenId, screenState, rawInfo.rawServerRetryAfterMs, {
              source: rawInfo.source,
              attemptId,
            });

            if (!entered) {
              console.log(`[TIKTOK-RATE-LIMIT-INVALID] cooldown not entered, preserving error`, {
                screenId,
                rawServerRetryAfterMs: rawInfo.rawServerRetryAfterMs,
              });
            }

            console.log(`[TIKTOK-RATE-LIMIT] automatic reconnect blocked (catch)`, { screenId, attemptId });
            reject(new Error(msg));
            return;
          }

          // For non-rate-limit errors, check if we should reconnect
          if (shouldReconnect) {
            this._scheduleReconnect(screenId, cleanUsername);
          }

          reject(new Error(msg));
        });

        // Race connection against timeout
        Promise.race([connectPromise, timeoutPromise]).catch(() => {});

        // ── Event Handlers ──
        // Catch-all: log EVERY decoded protobuf message type (proves connector receives gifts)
        // Gated behind debug flag - extremely high frequency
        if (TIKTOK_SERVICE_DEBUG) {
          connection.on("decodedData", (method, decoded, raw) => {
            console.log(`[TIKTOK-DECODED]`, JSON.stringify({
              screenId,
              method,
              hasData: !!decoded,
              dataKeys: decoded ? Object.keys(decoded).slice(0, 8) : null,
            }));
          });
        }

        // GIFT — log exact event name for diagnostic (debug only)
        const giftEventName = this.WebcastEvent.GIFT; // Declare outside debug block
        if (TIKTOK_SERVICE_DEBUG) {
          console.log(`[TIKTOK-GIFT-LISTENER-REG]`, JSON.stringify({
            screenId,
            giftEventName,
            webcastEventKeys: this.WebcastEvent ? Object.keys(this.WebcastEvent) : null,
            webcastEventType: typeof this.WebcastEvent,
          }));
        }

        connection.on(giftEventName, (data) => {
          // FIX (LIVE Action parity): Do NOT drop combo ticks before emit.
          // Combo ticks are emitted with isComboTick=true so ACTION dispatch
          // can fire immediately (same as Test Action). Accounting (coins /
          // goals / stats) continues to use only final/non-tick gifts.
          const { classifyGiftActionTick } = require("./gift-action-tick.cjs");
          const giftClass = classifyGiftActionTick(data);
          const isComboGift = giftClass.isComboGift;
          const isRepeatNotEnded = giftClass.isRepeatNotEnded;
          const isComboTick = giftClass.isComboTick;

          if (TIKTOK_SERVICE_DEBUG) {
            if (isComboTick) {
              console.log(`[TIKTOK-GIFT-COMBO-TICK] emit for ACTION only (no accounting)`, {
                screenId,
                giftId: data.giftId,
                repeatEnd: data.repeatEnd,
                combo: data.gift?.combo,
                repeatCount: data.repeatCount,
              });
            } else {
              console.log(`[TIKTOK-GIFT-PASS] gift passes for accounting+actions`, {
                screenId,
                giftId: data.giftId,
                isComboGift,
                repeatEnd: data.repeatEnd,
              });
            }
          }

          const normalized = this._normalizeGiftEvent(screenId, cleanUsername, data);
          this._emitEvent(normalized);
        });

        // LIKE
        const likeEventName = this.WebcastEvent.LIKE;
        connection.on(likeEventName, (data) => {
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

        // COMMENT (chat)
        if (this.WebcastEvent.CHAT) {
          connection.on(this.WebcastEvent.CHAT, (data) => {
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
          connection.on(this.ControlEvent.STREAM_END, (closeCode, closeReason) => {
            console.log(`[TIKTOK-LIFECYCLE-TRACE] connection close event`, JSON.stringify({
              source: "control-event-stream-end",
              screenId,
              attemptId: screenState.lastAttemptId,
              timestamp: Date.now(),
              currentStatus: screenState.state,
              username: screenState.username,
              roomId: screenState.roomId,
              isConnected: screenState.state === "connected",
              isConnecting: screenState.state === "connecting",
              rateLimited: screenState.rateLimited,
              serverRetryUntil: screenState.serverRetryUntil,
              reconnectAttempts: screenState.reconnectAttempts,
              reconnectScheduled: !!screenState.reconnectTimer,
              closeCode: closeCode ?? null,
              closeReason: closeReason ?? "Stream ended",
            }));
            console.log(`[TIKTOK] screen=${screenId} stream ended closeCode=${closeCode} closeReason=${closeReason}`);
            this._handleDisconnect(screenId, `Stream ended (code: ${closeCode}, reason: ${closeReason})`);
          });

          connection.on(this.ControlEvent.DISCONNECTED, (closeCode, closeReason) => {
            console.log(`[TIKTOK-LIFECYCLE-TRACE] connection close event`, JSON.stringify({
              source: "control-event-disconnected",
              screenId,
              attemptId: screenState.lastAttemptId,
              timestamp: Date.now(),
              currentStatus: screenState.state,
              username: screenState.username,
              roomId: screenState.roomId,
              isConnected: screenState.state === "connected",
              isConnecting: screenState.state === "connecting",
              rateLimited: screenState.rateLimited,
              serverRetryUntil: screenState.serverRetryUntil,
              reconnectAttempts: screenState.reconnectAttempts,
              reconnectScheduled: !!screenState.reconnectTimer,
              closeCode: closeCode ?? null,
              closeReason: closeReason ?? "Disconnected",
            }));
            console.log(`[TIKTOK] screen=${screenId} disconnected closeCode=${closeCode} closeReason=${closeReason}`);
            this._handleDisconnect(screenId, `Disconnected (code: ${closeCode}, reason: ${closeReason})`);
          });
        }

        // ERROR
        connection.on("error", (err) => {
          const msg = this._friendlyError(err, cleanUsername);
          const rawMsg = err?.message || err?.info || String(err);

          // DIAGNOSTIC: Log full error shape to identify "retry-after" bug
          console.log(`[TIKTOK-RETRY] error shape`, {
            screenId,
            errorName: err?.constructor?.name,
            errorMessage: err?.message?.substring(0, 200),
            errorInfo: err?.info?.substring(0, 200),
            errorCode: err?.code,
            errorStatus: err?.status,
            hasResponse: !!err?.response,
            responseHeaders: err?.response?.headers,
            errorKeys: err ? Object.keys(err) : [],
            errorCause: err?.cause,
            stack: err?.stack?.substring(0, 400),
          });

          console.log(`[TIKTOK-LIFECYCLE-TRACE] connection error`, JSON.stringify({
            source: "connection-on-error",
            screenId,
            attemptId: screenState.lastAttemptId,
            timestamp: Date.now(),
            currentStatus: screenState.state,
            username: screenState.username,
            roomId: screenState.roomId,
            isConnected: screenState.state === "connected",
            isConnecting: screenState.state === "connecting",
            rateLimited: screenState.rateLimited,
            serverRetryUntil: screenState.serverRetryUntil,
            reconnectAttempts: screenState.reconnectAttempts,
            reconnectScheduled: !!screenState.reconnectTimer,
            errorName: err?.constructor?.name,
            errorMessage: (err?.message || '').substring(0, 300),
            errorStack: err?.stack?.substring(0, 500),
          }));

          console.error(`[TIKTOK-CONNECT] error event`, {
            screenId,
            friendly: msg,
            raw: rawMsg?.substring(0, 200),
            stack: err?.stack?.substring(0, 300),
          });

          // Classify error for proper lifecycle handling
          const errorClassification = this._classifyError(err, screenState);
          const isRateLimit = errorClassification === 'rate-limit';
          const isAuxiliary = errorClassification === 'auxiliary';

          // Log connection health at time of error
          const isTransportAlive = screenState.state === "connected" && screenState.roomId != null;
          console.log(`[TIKTOK-CONNECTION-HEALTH] error occurred`, JSON.stringify({
            screenId,
            attemptId: screenState.lastAttemptId,
            connectionState: screenState.state,
            roomId: screenState.roomId,
            isTransportAlive,
            hasRoomId: !!screenState.roomId,
            isConnected: screenState.state === "connected",
            isConnecting: screenState.state === "connecting",
            rateLimited: screenState.rateLimited,
            reconnectAttempts: screenState.reconnectAttempts,
          }));

          // Emit error event to renderer
          this._emitEvent({
            type: "error",
            screenId,
            message: msg,
            classification: errorClassification,
            timestamp: Date.now(),
          });

          // Handle auxiliary errors (e.g., "Failed to fetch room gifts")
          // These are non-fatal and should NOT disrupt a healthy connection
          if (isAuxiliary) {
            console.log(`[TIKTOK-AUXILIARY-ERROR] non-fatal auxiliary error`, JSON.stringify({
              screenId,
              attemptId: screenState.lastAttemptId,
              errorMessage: (err?.message || '').substring(0, 300),
              errorName: err?.constructor?.name,
              connectionState: screenState.state,
              isTransportAlive,
              willReconnect: false,
              reason: "auxiliary error during healthy connection - keeping connection alive",
            }));

            // If connection is healthy, just log and return - DO NOT reconnect
            if (screenState.state === "connected") {
              console.log(`[TIKTOK-RECONNECT-DECISION] blocked`, JSON.stringify({
                screenId,
                attemptId: screenState.lastAttemptId,
                currentState: screenState.state,
                errorMessage: (err?.message || '').substring(0, 150),
                errorName: err?.constructor?.name,
                errorClassification,
                isTransportAlive,
                isAlreadyConnected: true,
                willReconnect: false,
                reason: "auxiliary error on healthy connection - keeping connection alive",
              }));
              return;
            }
            // If not connected yet, fall through to normal handling
          }

          // Only schedule reconnect for network/transient errors, not auth/user errors
          // Rate-limit errors must NEVER trigger automatic reconnect
          if (isRateLimit) {
            // Detailed error shape logging for comparison with .catch() path
            console.log(`[TIKTOK-RATE-LIMIT-TRACE] ERROR SHAPE (on error path)`, JSON.stringify({
              attemptId: screenState.lastAttemptId,
              screenId,
              constructorName: err?.constructor?.name,
              name: err?.name,
              message: err?.message?.substring(0, 300),
              info: err?.info?.substring(0, 300),
              code: err?.code,
              status: err?.status,
              statusCode: err?.statusCode,
              retryAfter: err?.retryAfter,
              retryAfterType: typeof err?.retryAfter,
              resetTime: err?.resetTime,
              resetTimeType: typeof err?.resetTime,
              hasResponse: !!err?.response,
              responseStatus: err?.response?.status,
              responseHeaders: err?.response?.headers,
              ownKeys: err ? Object.keys(err) : [],
              responseOwnKeys: err?.response ? Object.keys(err.response) : [],
              stack: err?.stack?.substring(0, 300),
              connectionState: screenState.state,
            }));

            // Only handle rate-limit errors AFTER connection is established.
            // During "connecting" phase, the .catch() handler on connection.connect()
            // receives the full SignatureRateLimitError with retryAfter/resetTime.
            // The on("error") fires SYNCHRONOUSLY with a plain Object wrapper.
            if (screenState.state !== "connected") {
              console.log(`[TIKTOK-RATE-LIMIT] on("error") rate-limit ignored during "${screenState.state}" — .catch() will handle`, {
                screenId,
                attemptId: screenState.lastAttemptId,
                state: screenState.state,
              });
              return;
            }

            const rawInfo = this._extractRawRateLimitInfo(err);
            console.log(`[TIKTOK-RATE-LIMIT-AUDIT] detected (reconnect)`, JSON.stringify({
              attemptId: screenState.lastAttemptId,
              screenId,
              errorName: err?.constructor?.name,
              rawServerRetryAfterMs: rawInfo.rawServerRetryAfterMs,
              rawSource: rawInfo.source,
              attempt: screenState.reconnectAttempts,
            }));

            // Log reconnect decision
            console.log(`[TIKTOK-RECONNECT-DECISION] blocked`, JSON.stringify({
              screenId,
              attemptId: screenState.lastAttemptId,
              currentState: screenState.state,
              errorMessage: (err?.message || '').substring(0, 150),
              errorName: err?.constructor?.name,
              errorClassification,
              isTransportAlive,
              isAlreadyConnected: screenState.state === "connected",
              willReconnect: false,
              reason: "rate-limit detected — entering cooldown",
            }));

            // Enter cooldown state — deduplication happens inside _enterRateLimitCooldown
            const entered = this._enterRateLimitCooldown(screenId, screenState, rawInfo.rawServerRetryAfterMs, {
              source: rawInfo.source,
              attemptId: screenState.lastAttemptId,
            });

            if (!entered) {
              console.log(`[TIKTOK-RATE-LIMIT-INVALID] cooldown not entered, preserving error`, {
                screenId,
                rawServerRetryAfterMs: rawInfo.rawServerRetryAfterMs,
              });
            }

            console.log(`[TIKTOK-RATE-LIMIT] automatic reconnect blocked`, {
              screenId,
              rawServerRetryAfterMs: rawInfo.rawServerRetryAfterMs,
              message: "Entering cooldown state, no automatic reconnect",
            });
            return;
          }

          // For other errors, check if we should reconnect
          const shouldReconnect = !screenState.isManualDisconnect && this._shouldReconnect(msg);

          // Log reconnect decision for ALL paths
          console.log(`[TIKTOK-RECONNECT-DECISION]`, JSON.stringify({
            screenId,
            attemptId: screenState.lastAttemptId,
            currentState: screenState.state,
            errorMessage: (err?.message || '').substring(0, 150),
            errorName: err?.constructor?.name,
            errorClassification,
            isTransportAlive,
            isAlreadyConnected: screenState.state === "connected",
            willReconnect: shouldReconnect,
            reason: shouldReconnect ? "transient error, will retry" : "error not recoverable or manual disconnect",
          }));

          if (shouldReconnect) {
            this._scheduleReconnect(screenId, cleanUsername);
          }

          // CRITICAL: Log if the error caused a state transition to disconnected
          // Check if we should trigger a disconnect
          if (screenState.state === "connected" || screenState.state === "connecting") {
            console.log(`[TIKTOK-LIFECYCLE-TRACE] error may cause disconnect`, JSON.stringify({
              source: "connection-on-error-potential-disconnect",
              screenId,
              attemptId: screenState.lastAttemptId,
              timestamp: Date.now(),
              currentStatus: screenState.state,
              username: screenState.username,
              roomId: screenState.roomId,
              isConnected: screenState.state === "connected",
              isConnecting: screenState.state === "connecting",
              rateLimited: screenState.rateLimited,
              serverRetryUntil: screenState.serverRetryUntil,
              reconnectAttempts: screenState.reconnectAttempts,
              reconnectScheduled: !!screenState.reconnectTimer,
              errorName: err?.constructor?.name,
              errorMessage: (err?.message || '').substring(0, 300),
              errorStack: err?.stack?.substring(0, 500),
              willDisconnect: !screenState.isManualDisconnect && !isRateLimit && this._shouldReconnect(msg) === false,
            }));
          }
        });

      } catch (err) {
        if (resolved) return;
        resolved = true;
        cleanup();

        screenState.connection = null;
        screenState.state = "error";

        const msg = this._friendlyError(err, cleanUsername);
        const errorClassification = this._classifyError(err, screenState);
        const isRateLimit = errorClassification === 'rate-limit';
        console.error(`[TIKTOK] screen=${screenId} init ERROR: ${msg}`);

          if (TIKTOK_SERVICE_DEBUG) {
            const outerResponseHeaders = err?.response?.headers || {};
            const outerRawBody = err?.response?.data;
            let outerBody = null;
            if (outerRawBody) {
              try {
                const str = typeof outerRawBody === 'string' ? outerRawBody : JSON.stringify(outerRawBody);
                outerBody = str.substring(0, 100);
              } catch (_) { outerBody = '[unparseable]'; }
            }
            console.log(`[TIKTOK-SIGN-RESPONSE]`, JSON.stringify({
              signingRequestId: typeof signingRequestId !== 'undefined' ? signingRequestId : null,
              attemptId,
              screenId,
              username: cleanUsername,
              path: 'outer-catch',
              status: err?.response?.status || err?.status || null,
              headers: {
                'retry-after': outerResponseHeaders['retry-after'] || outerResponseHeaders['Retry-After'] || null,
                'x-ratelimit-reset': outerResponseHeaders['x-ratelimit-reset'] || null,
              },
              body: outerBody,
              errorMessage: (err?.message || '').substring(0, 100),
            }));
          }

        if (TIKTOK_SERVICE_DEBUG) {
          // Detailed error shape logging for outer catch
          console.log(`[TIKTOK-RATE-LIMIT-TRACE] ERROR SHAPE (outer catch)`, JSON.stringify({
            attemptId,
            screenId,
            constructorName: err?.constructor?.name,
            name: err?.name,
            message: err?.message?.substring(0, 100),
            info: err?.info?.substring(0, 100),
            code: err?.code,
            status: err?.status,
            statusCode: err?.statusCode,
            retryAfter: err?.retryAfter,
            retryAfterType: typeof err?.retryAfter,
            resetTime: err?.resetTime,
            resetTimeType: typeof err?.resetTime,
            hasResponse: !!err?.response,
            responseStatus: err?.response?.status,
            responseHeaders: err?.response?.headers,
            ownKeys: err ? Object.keys(err) : [],
            responseOwnKeys: err?.response ? Object.keys(err.response) : [],
            stack: err?.stack?.substring(0, 300),
          }));

          console.log(`[TIKTOK-RECONNECT-AUDIT] error received (catch)`, {
            screenId,
            errorName: err?.constructor?.name,
            errorMessage: (err?.message || "").substring(0, 150),
            friendlyMessage: msg,
            isRateLimit,
            errorClassification,
          });
        }

        this._emitEvent({
          type: "error",
          screenId,
          message: msg,
          isRateLimit,
          classification: errorClassification,
          timestamp: Date.now(),
        });

        // Log reconnect decision for outer catch path
        const isTransportAlive = screenState.state === "connected" && screenState.roomId != null;
        const shouldReconnect = !screenState.isManualDisconnect && this._shouldReconnect(msg);

        console.log(`[TIKTOK-RECONNECT-DECISION]`, JSON.stringify({
          screenId,
          attemptId,
          currentState: screenState.state,
          errorMessage: (err?.message || '').substring(0, 150),
          errorName: err?.constructor?.name,
          errorClassification,
          isTransportAlive,
          isAlreadyConnected: screenState.state === "connected",
          willReconnect: shouldReconnect && !isRateLimit,
          reason: isRateLimit ? "rate-limit detected — entering cooldown" : (shouldReconnect ? "transient error, will retry" : "error not recoverable or manual disconnect"),
        }));

        if (isRateLimit) {
          const rawInfo = this._extractRawRateLimitInfo(err);
          console.log(`[TIKTOK-RATE-LIMIT-AUDIT] detected (init-catch)`, JSON.stringify({
            attemptId: screenState.lastAttemptId,
            screenId,
            errorName: err?.constructor?.name,
            rawServerRetryAfterMs: rawInfo.rawServerRetryAfterMs,
            rawSource: rawInfo.source,
          }));

          const entered = this._enterRateLimitCooldown(screenId, screenState, rawInfo.rawServerRetryAfterMs, {
            source: rawInfo.source,
            attemptId: screenState.lastAttemptId,
          });

          if (!entered) {
            console.log(`[TIKTOK-RATE-LIMIT-INVALID] cooldown not entered, preserving error`, {
              screenId,
              rawServerRetryAfterMs: rawInfo.rawServerRetryAfterMs,
            });
          }

          console.log(`[TIKTOK-RATE-LIMIT] automatic reconnect blocked (init-catch)`, { screenId });
          reject(new Error(msg));
          return; // Do not reconnect on rate limit
        }

        // For non-rate-limit errors, check if we should reconnect
        if (shouldReconnect) {
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

    if (TIKTOK_SERVICE_DEBUG) {
      console.log(`[TIKTOK-LIFECYCLE-TRACE] service disconnect called`, JSON.stringify({
        source: "backend-disconnect-manual",
        screenId,
        attemptId: screenState.lastAttemptId,
        timestamp: Date.now(),
        currentStatus: screenState.state,
        username: screenState.username,
        roomId: screenState.roomId,
        isConnected: screenState.state === "connected",
        isConnecting: screenState.state === "connecting",
        rateLimited: screenState.rateLimited,
        serverRetryUntil: screenState.serverRetryUntil,
        reconnectAttempts: screenState.reconnectAttempts,
        reconnectScheduled: !!screenState.reconnectTimer,
        reason: "manual disconnect requested",
      }));
    }

    this._clearReconnectTimer(screenState);
    this._clearHeartbeatTimer(screenState);
    this._clearCooldownTimer(screenState);
    if (TIKTOK_SERVICE_DEBUG) {
      console.log(`[TIKTOK-RATE-LIMIT-CLEAR-TRACE]`, JSON.stringify({
        source: "backend-disconnect",
        screenId,
        now: Date.now(),
        serverRetryUntilBeforeClear: screenState.serverRetryUntil,
        remainingMs: screenState.serverRetryUntil ? Math.max(0, screenState.serverRetryUntil - Date.now()) : null,
        isRateLimitedBeforeClear: screenState.rateLimited,
        reason: "manual disconnect requested",
      }));
    }
    screenState.rateLimited = false;
    screenState.serverRetryUntil = null;

    if (screenState.connection) {
      try {
        screenState.connection.disconnect();
      } catch (_) {}
      screenState.connection = null;
    }

    const wasConnected = screenState.state === "connected";
    const wasConnecting = screenState.state === "connecting";
    screenState.state = "disconnected";
    screenState.username = null;
    screenState.roomId = null;
    screenState.reconnectAttempts = 0;

    // [TIKTOK-DISCONNECT-TRACE][SERVICE] Always emit disconnected so the renderer store updates
    if (TIKTOK_SERVICE_DEBUG) {
      console.log(`[TIKTOK-DISCONNECT-TRACE][SERVICE]`, JSON.stringify({
        screenId,
        wasConnected,
        wasConnecting,
        afterState: screenState.state,
        emittingEvent: true,
        timestamp: Date.now(),
      }));
    }
    this._emitEvent({
      type: "disconnected",
      screenId,
      reason: wasConnected ? "Manual disconnect" : (wasConnecting ? "Disconnect during connect" : "Manual disconnect"),
      timestamp: Date.now(),
    });

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
      rateLimited: screenState.rateLimited,
      serverRetryUntil: screenState.serverRetryUntil,
      serverRetryRemainingMs: screenState.serverRetryUntil ? Math.max(0, screenState.serverRetryUntil - Date.now()) : 0,
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

    // DEFENSE-IN-DEPTH: Never schedule reconnect if rate-limited
    if (screenState.rateLimited) {
      if (TIKTOK_SERVICE_DEBUG) console.log(`[TIKTOK-RATE-LIMIT] reconnect blocked`, { screenId });
      return;
    }

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

    if (TIKTOK_SERVICE_DEBUG) console.log(`[TIKTOK] screen=${screenId} reconnecting in ${Math.round(delay + jitter)}ms (attempt ${screenState.reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);

    this._emitEvent({
      type: "reconnecting",
      screenId,
      attempt: screenState.reconnectAttempts,
      timestamp: Date.now(),
    });

    screenState.reconnectTimer = setTimeout(() => {
      // Re-check rate-limit before actually connecting
      const currentState = this._getScreenState(screenId);
      if (currentState.rateLimited) {
        if (TIKTOK_SERVICE_DEBUG) console.log(`[TIKTOK-RATE-LIMIT] reconnect blocked`, { screenId });
        return;
      }
      this.connect(screenId, username).catch((err) => {
        console.error(`[TIKTOK] screen=${screenId} reconnect failed:`, err.message);
      });
    }, delay + jitter);
  }

  /** Handle disconnection */
  _handleDisconnect(screenId, reason) {
    const screenState = this._getScreenState(screenId);
    const wasConnected = screenState.state === "connected";

    if (TIKTOK_SERVICE_DEBUG) {
      console.log(`[TIKTOK-LIFECYCLE-TRACE] service disconnect called`, JSON.stringify({
        source: "service-handleDisconnect",
        screenId,
        attemptId: screenState.lastAttemptId,
        timestamp: Date.now(),
        currentStatus: screenState.state,
        username: screenState.username,
        roomId: screenState.roomId,
        isConnected: wasConnected,
        isConnecting: screenState.state === "connecting",
        rateLimited: screenState.rateLimited,
        serverRetryUntil: screenState.serverRetryUntil,
        reconnectAttempts: screenState.reconnectAttempts,
        reconnectScheduled: !!screenState.reconnectTimer,
        reason,
      }));
    }

    this._clearHeartbeatTimer(screenState);
    this._clearReconnectTimer(screenState);
    screenState.connection = null;
    screenState.state = "disconnected";

    if (wasConnected) {
      this._emitEvent({
        type: "disconnected",
        screenId,
        reason,
        timestamp: Date.now(),
      });
    }

    // Schedule reconnect if not manual and not rate-limited
    if (!screenState.isManualDisconnect && !screenState.rateLimited && screenState.username) {
      if (TIKTOK_SERVICE_DEBUG) {
        console.log(`[TIKTOK-LIFECYCLE-TRACE] reconnect scheduled`, JSON.stringify({
          source: "service-handleDisconnect-scheduleReconnect",
          screenId,
          timestamp: Date.now(),
          reason: "auto-reconnect after disconnect",
          username: screenState.username,
        }));
      }
      this._scheduleReconnect(screenId, screenState.username);
    } else if (TIKTOK_SERVICE_DEBUG) {
      console.log(`[TIKTOK-LIFECYCLE-TRACE] reconnect NOT scheduled`, JSON.stringify({
        source: "service-handleDisconnect-scheduleReconnect",
        screenId,
        timestamp: Date.now(),
        isManualDisconnect: screenState.isManualDisconnect,
        rateLimited: screenState.rateLimited,
        hasUsername: !!screenState.username,
        reason: "conditions not met for auto-reconnect",
      }));
    }
  }

  /**
   * Fetch gift metadata in background after connection is established.
   * Non-blocking: failures here do NOT affect the live connection.
   * Implements bounded retry for auxiliary data loading.
   * Uses connection.fetchAvailableGifts() - independent metadata fetch, does NOT reconnect.
   */
  async _fetchGiftsInBackground(connection, screenId, username) {
    const screenState = this._getScreenState(screenId);

    // Bounded retry config for auxiliary data
    const MAX_GIFT_FETCH_RETRIES = 3;
    const GIFT_FETCH_BASE_DELAY_MS = 5000;
    const MAX_GIFT_FETCH_DELAY_MS = 30000;

    let retryCount = 0;

    const attemptFetch = async () => {
      // Stop if connection is no longer healthy
      const currentState = this._getScreenState(screenId);
      if (currentState.state !== "connected" || currentState.connection !== connection) {
        console.log(`[TIKTOK-GIFT-METADATA-RETRY]`, JSON.stringify({
          screenId,
          retryAttempt: retryCount + 1,
          maxRetries: MAX_GIFT_FETCH_RETRIES,
          connectionStatus: currentState.state,
          roomId: currentState.roomId,
          success: false,
          errorMessage: "connection no longer healthy - stopping retry",
        }));
        return;
      }

      try {
        console.log(`[TIKTOK-GIFT-METADATA-RETRY]`, JSON.stringify({
          screenId,
          retryAttempt: retryCount + 1,
          maxRetries: MAX_GIFT_FETCH_RETRIES,
          connectionStatus: currentState.state,
          roomId: currentState.roomId,
          success: undefined, // pending
        }));
        const gifts = await connection.fetchAvailableGifts();
        const count = Array.isArray(gifts) ? gifts.length : (gifts ? Object.keys(gifts).length : 0);
        console.log(`[TIKTOK-GIFT-METADATA-RETRY]`, JSON.stringify({
          screenId,
          retryAttempt: retryCount + 1,
          maxRetries: MAX_GIFT_FETCH_RETRIES,
          connectionStatus: currentState.state,
          roomId: currentState.roomId,
          success: true,
          errorMessage: null,
          giftCount: count,
        }));
        this._emitEvent({
          type: "gifts-loaded",
          screenId,
          giftCount: count,
          timestamp: Date.now(),
        });
        return; // Success - stop retrying
      } catch (err) {
        const errorMsg = err?.message || String(err);
        console.log(`[TIKTOK-GIFT-METADATA-RETRY]`, JSON.stringify({
          screenId,
          retryAttempt: retryCount + 1,
          maxRetries: MAX_GIFT_FETCH_RETRIES,
          connectionStatus: currentState.state,
          roomId: currentState.roomId,
          success: false,
          errorMessage: errorMsg,
        }));

        retryCount++;

        // Emit warning to renderer for first failure
        if (retryCount === 1) {
          this._emitEvent({
            type: "warning",
            screenId,
            message: `Gift metadata unavailable: ${errorMsg}`,
            classification: "auxiliary",
            timestamp: Date.now(),
          });
        }

        // Check if we should retry
        if (retryCount < MAX_GIFT_FETCH_RETRIES) {
          // Verify connection is still healthy before scheduling retry
          const verifyState = this._getScreenState(screenId);
          if (verifyState.state !== "connected" || verifyState.connection !== connection) {
            console.log(`[TIKTOK-GIFT-METADATA-RETRY]`, JSON.stringify({
              screenId,
              retryAttempt: retryCount + 1,
              maxRetries: MAX_GIFT_FETCH_RETRIES,
              connectionStatus: verifyState.state,
              roomId: verifyState.roomId,
              success: false,
              errorMessage: "connection closed - aborting retry",
            }));
            return;
          }

          const delay = Math.min(
            GIFT_FETCH_BASE_DELAY_MS * Math.pow(2, retryCount - 1),
            MAX_GIFT_FETCH_DELAY_MS
          );
          const jitter = delay * 0.1 * Math.random();
          const totalDelay = delay + jitter;

          await new Promise(resolve => setTimeout(resolve, totalDelay));
          return attemptFetch();
        } else {
          // Max retries reached - emit final warning but keep connection alive
          this._emitEvent({
            type: "warning",
            screenId,
            message: `Gift metadata unavailable after ${MAX_GIFT_FETCH_RETRIES} attempts. Live connection unaffected.`,
            classification: "auxiliary",
            timestamp: Date.now(),
          });
        }
      }
    };

    // Start the fetch with retry logic
    attemptFetch();
  }

  /** Normalize error messages */
  _friendlyError(err, username) {
    if (!err) return "Koneksi gagal.";
    let msg = typeof err === "object" ? (err.info || err.message || err.error || JSON.stringify(err)) : String(err);
    const m = msg.toLowerCase();

    // Log raw error before masking for debugging
    console.log(`[TIKTOK-CONNECT] raw error for @${username}:`, {
      type: err?.constructor?.name,
      message: err?.message?.substring(0, 200),
      info: err?.info?.substring(0, 200),
      code: err?.code,
      status: err?.status,
    });

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

  /** Extract raw rate-limit info from error for audit logging.
   *  Returns the raw server retry-after value WITHOUT capping.
   *  Priority: err.resetTime (absolute epoch ms) > err.retryAfter (relative ms) > headers
   */
  _extractRawRateLimitInfo(err) {
    let rawServerRetryAfterMs = null;
    let source = "none";
    let headers = null;
    const now = Date.now();

    if (TIKTOK_SERVICE_DEBUG) {
      console.log(`[TIKTOK-RATE-LIMIT-TRACE] error properties`, JSON.stringify({
        constructorName: err?.constructor?.name,
        retryAfter: err?.retryAfter,
        retryAfterType: typeof err?.retryAfter,
        resetTime: err?.resetTime,
        resetTimeType: typeof err?.resetTime,
        hasResponse: !!err?.response,
        responseStatus: err?.response?.status,
        responseHeaders: err?.response?.headers,
        now,
        nowIso: new Date(now).toISOString(),
      }));
    }

    // 1. PREFER err.resetTime (absolute epoch timestamp in ms from SignatureRateLimitError)
    // The library sets resetTime = parseInt(headers["x-ratelimit-reset"]) * 1e3
    // This is already an absolute epoch ms - we convert to relative duration
    if (typeof err?.resetTime === "number" && err.resetTime > 0) {
      // Validate it's a reasonable future timestamp (not in the past, not absurdly far)
      if (err.resetTime > now && err.resetTime < now + 86400000 * 365) { // within 1 year
        rawServerRetryAfterMs = err.resetTime - now;
        source = "resetTime-property";
        if (TIKTOK_SERVICE_DEBUG) {
          console.log(`[TIKTOK-RATE-LIMIT-TRACE] resetTime used`, JSON.stringify({
            inputValue: err.resetTime,
            inputType: typeof err.resetTime,
            source: "err.resetTime (absolute epoch ms from library)",
            unit: "converted to relative ms: resetTime - now",
            outputValue: rawServerRetryAfterMs,
            outputSec: Math.ceil(rawServerRetryAfterMs / 1000),
            serverRetryUntilIso: new Date(err.resetTime).toISOString(),
          }));
        }
      } else if (TIKTOK_SERVICE_DEBUG) {
        console.log(`[TIKTOK-RATE-LIMIT-TRACE] resetTime invalid/ignored`, JSON.stringify({
          resetTime: err.resetTime,
          now,
          reason: err.resetTime <= now ? "in the past" : "unreasonably far in future",
        }));
      }
    }

    // 2. Try SignatureRateLimitError.retryAfter (relative duration in ms from library)
    // Library: calculateRetryAfter = parseInt(headers["retry-after"] || "0") * 1e3
    // So err.retryAfter is ALREADY in milliseconds
    if (rawServerRetryAfterMs === null && typeof err?.retryAfter === "number" && err.retryAfter > 0) {
      rawServerRetryAfterMs = err.retryAfter;
      source = "retryAfter-property";
      if (TIKTOK_SERVICE_DEBUG) {
        console.log(`[TIKTOK-RATE-LIMIT-TRACE] retry-after raw`, JSON.stringify({
          inputValue: err.retryAfter,
          inputType: typeof err.retryAfter,
          source: "err.retryAfter (already * 1000 by library)",
          interpretation_if_relative_sec: `${err.retryAfter / 1000} seconds from now → ${new Date(now + err.retryAfter).toISOString()}`,
          interpretation_if_absolute_epoch_ms: `${err.retryAfter} ms → ${new Date(err.retryAfter).toISOString()} (if absolute timestamp in ms)`,
          interpretation_if_absolute_epoch_sec_times1000: `${err.retryAfter / 1000} seconds since epoch → ${new Date(err.retryAfter / 1000 * 1000).toISOString()} (if server sent epoch sec, library multiplied by 1000)`,
          note: "Library did: parseInt(retry-after-header) * 1e3. If header was a Unix epoch in seconds, library incorrectly treated it as relative duration.",
        }));
      }
    }

    // 3. Try response headers (FALLBACK — only if err.retryAfter not present)
    if (rawServerRetryAfterMs === null) {
      const hdrs = err?.response?.headers;
      if (hdrs) {
        headers = {
          "retry-after": hdrs["retry-after"] || hdrs["Retry-After"],
          "x-ratelimit-reset": hdrs["x-ratelimit-reset"],
          "x-log-id": hdrs["x-log-id"],
          "x-agent-id": hdrs["x-agent-id"],
        };
        if (TIKTOK_SERVICE_DEBUG) {
          console.log(`[TIKTOK-RATE-LIMIT-TRACE] raw HTTP headers`, JSON.stringify({
            "retry-after": hdrs["retry-after"] || hdrs["Retry-After"],
            "x-ratelimit-reset": hdrs["x-ratelimit-reset"],
            "x-log-id": hdrs["x-log-id"],
            "x-agent-id": hdrs["x-agent-id"],
          }));
        }

        const retryAfterRaw = hdrs["retry-after"] || hdrs["Retry-After"];
        const retryAfter = parseInt(retryAfterRaw || "0", 10);
        if (TIKTOK_SERVICE_DEBUG) {
          console.log(`[TIKTOK-RATE-LIMIT-TRACE] retry-after header parsed`, JSON.stringify({
            rawHeaderValue: retryAfterRaw,
            parsedInt: retryAfter,
            inputValue: retryAfter,
            inputType: "number (parsed from string)",
            source: "retry-after-header",
            unit: "treated as seconds, multiplied by 1000",
            outputValue: retryAfter * 1000,
            isReasonableRelativeDuration: retryAfter > 0 && retryAfter < 86400,
            isLikelyUnixEpoch: retryAfter > 1000000000,
            warning: retryAfter > 86400 ? "retry-after > 86400 (24h) — likely NOT a relative duration. Possible Unix epoch in seconds." : null,
          }));
        }

        if (retryAfter > 0) {
          rawServerRetryAfterMs = retryAfter * 1000;
          source = "retry-after-header";
        } else {
          const resetTimeRaw = hdrs["x-ratelimit-reset"];
          const resetTime = parseInt(resetTimeRaw || "0", 10);
          if (TIKTOK_SERVICE_DEBUG) {
            console.log(`[TIKTOK-RATE-LIMIT-TRACE] x-ratelimit-reset header parsed`, JSON.stringify({
              rawHeaderValue: resetTimeRaw,
              parsedInt: resetTime,
              inputValue: resetTime,
              inputType: "number (parsed from string)",
              source: "x-ratelimit-reset-header",
              unit: "treated as seconds, multiplied by 1000",
              outputValue: resetTime * 1000,
              isLikelyUnixEpoch: resetTime > 1000000000,
              isReasonableRelativeDuration: resetTime > 0 && resetTime < 86400,
              warning: resetTime > 86400 ? "x-ratelimit-reset > 86400 — likely a Unix epoch, NOT a relative duration." : null,
            }));
          }
          if (resetTime > 0) {
            rawServerRetryAfterMs = resetTime * 1000;
            source = "x-ratelimit-reset-header";
          }
        }
      }
    }

    if (TIKTOK_SERVICE_DEBUG) {
      console.log(`[TIKTOK-RATE-LIMIT-TRACE] extracted raw info`, JSON.stringify({
        rawServerRetryAfterMs,
        rawServerRetryAfterSec: rawServerRetryAfterMs ? Math.ceil(rawServerRetryAfterMs / 1000) : null,
        source,
        headers,
        derived_serverRetryUntil: rawServerRetryAfterMs ? new Date(now + rawServerRetryAfterMs).toISOString() : null,
        derived_remainingReadable: rawServerRetryAfterMs ? `${Math.ceil(rawServerRetryAfterMs / 1000)}s` : null,
      }));
    }

    return { rawServerRetryAfterMs, source, headers };
  }

  /** Classify error type for reconnect decision
   *  Returns: 'fatal' | 'transient' | 'auxiliary' | 'rate-limit' | 'unknown'
   */
  _classifyError(err, screenState) {
    if (!err) return 'unknown';
    const msg = (err.message || err.info || String(err)).toLowerCase();
    const name = (err.constructor?.name || "").toLowerCase();

    // Rate limit errors
    if (this._isRateLimitError(err)) return 'rate-limit';

    // Auxiliary data errors - non-fatal, don't affect live connection
    // These happen AFTER connection is established during background operations
    if (
      msg.includes("failed to fetch room gifts") ||
      msg.includes("fetchavailablegifts") ||
      msg.includes("gift metadata") ||
      msg.includes("extended gift info")
    ) {
      return 'auxiliary';
    }

    // Fatal connection errors - require full reconnect
    if (
      msg.includes("not live") ||
      msg.includes("isn't live") ||
      msg.includes("live has ended") ||
      msg.includes("not found") ||
      msg.includes("404") ||
      msg.includes("user not found") ||
      msg.includes("username tidak ditemukan") ||
      msg.includes("invalid username") ||
      msg.includes("unauthorized") ||
      msg.includes("authentication") ||
      msg.includes("signature") && msg.includes("failed")
    ) {
      return 'fatal';
    }

    // Transient network errors - can retry
    if (
      msg.includes("falling back") ||
      msg.includes("no more sources") ||
      msg.includes("error while connecting") ||
      msg.includes("network") ||
      msg.includes("econnrefused") ||
      msg.includes("enotfound") ||
      msg.includes("timeout") ||
      msg.includes("econnreset") ||
      msg.includes("etimedout") ||
      msg.includes("euler api") ||
      (msg.includes("euler") && !msg.includes("falling"))
    ) {
      return 'transient';
    }

    return 'unknown';
  }

  /** Detect rate-limit errors from the RAW error object (before friendly conversion) */
  _isRateLimitError(err) {
    if (!err) return false;
    const name = (err.constructor?.name || "").toLowerCase();
    const msg = (err.message || err.info || "").toLowerCase();
    const status = String(err.status || err.code || "");
    const errStr = JSON.stringify(err).toLowerCase();

    return (
      name.includes("ratelimit") ||
      name.includes("rate_limit") ||
      msg.includes("rate limit") ||
      msg.includes("rate-limited") ||
      msg.includes("too many connections") ||
      msg.includes("too many requests") ||
      msg.includes("try again later") ||
      msg.includes("429") ||
      status === "429" ||
      errStr.includes("rate limit") ||
      errStr.includes("ratelimit")
    );
  }

  /** Safely extract rate-limit cooldown delay from raw error object.
   *  Returns the RAW server retry-after value WITHOUT capping.
   *  The capping for UI display is done in _enterRateLimitCooldown.
   *  The serverRetryUntil uses the raw value to respect the real server deadline.
   */
  _getRateLimitDelay(err) {
    let rawServerDelayMs = null;
    let source = "fallback";

    // Try SignatureRateLimitError.retryAfter (from tiktok-live-connector)
    if (typeof err?.retryAfter === "number" && err.retryAfter > 0) {
      rawServerDelayMs = err.retryAfter;
      source = "retryAfter";
    }
    // Try response headers
    if (rawServerDelayMs === null) {
      const headers = err?.response?.headers;
      if (headers) {
        const retryAfter = parseInt(headers["retry-after"] || headers["Retry-After"] || "0", 10);
        if (retryAfter > 0) {
          rawServerDelayMs = retryAfter * 1000;
          source = "retry-after";
        } else {
          const resetTime = parseInt(headers["x-ratelimit-reset"] || "0", 10);
          if (resetTime > 0) {
            rawServerDelayMs = resetTime * 1000;
            source = "x-ratelimit-reset";
          }
        }
      }
    }

    // Use DEFAULT if no raw value found
    if (rawServerDelayMs === null) {
      rawServerDelayMs = DEFAULT_RATE_LIMIT_COOLDOWN_MS;
      source = "default";
    }

    console.log(`[TIKTOK-RATE-LIMIT] raw delay extracted`, JSON.stringify({
      rawServerDelayMs,
      source,
      rawServerDelayReadable: `${Math.ceil(rawServerDelayMs / 1000)}s`,
    }));

    return rawServerDelayMs;
  }

  /**
   * Resolve session/dedup identity for a normalized TikTok event.
   *
   * roomId precedence (authoritative connection state, never invented):
   *   1. data.common.roomId — per-message identity from TikTok protobuf
   *   2. screenState.roomId — the REAL connection roomId captured at
   *      connect() success (viewerState.roomId). This is the same value
   *      Settings displays as tikTokRoomId (e.g. "7691962768422079252").
   *      Used when decoded events omit/empty common.roomId (runtime-observed).
   *
   * msgId: data.common.msgId when present. Never invented — Goal dedup
   * falls back to deterministic keys when msgId is null.
   *
   * Logs [GOAL-ROOM-PROPAGATION] so runtime can prove the connection
   * roomId reaches the normalized event consumed by Goal Tracker.
   */
  _resolveEventIdentity(screenId, data, eventType) {
    const connectionRoomId = this._getScreenState(screenId)?.roomId || null;
    const eventRoomId = data?.common?.roomId || null;
    const roomId = eventRoomId || connectionRoomId || null;
    const msgId = data?.common?.msgId || null;
    const source = eventRoomId
      ? 'event-common'
      : (connectionRoomId ? 'connection-state' : 'none');
    console.log('[GOAL-ROOM-PROPAGATION]', JSON.stringify({
      eventType,
      roomId,
      source,
      screenId,
    }));
    return { roomId, msgId };
  }

  /** Event normalization methods
   *  Field mapping for tiktok-live-connector@2.4.0 protobuf data:
   *    data.giftId          → string  (top-level)
   *    data.repeatCount     → number  (top-level)
   *    data.repeatEnd       → number  (top-level: 0=not ended, 1=ended)
   *    data.gift?.name      → string  (gift name, e.g. "Rose")
   *    data.gift?.diamondCount → number (coin/diamond value)
   *    data.gift?.type      → number  (gift type from TikTok)
   *    data.gift?.combo     → boolean (is combo gift)
   *    data.user?.id        → string  (user ID)
   *    data.user?.nickname  → string  (display name)
   */
  _normalizeGiftEvent(screenId, username, data) {
    // Extract real image URL from raw TikTok protobuf: data.gift.image.urlList[0]
    const rawImageUrl = data.gift?.image?.urlList?.[0] || data.gift?.icon?.urlList?.[0] || '';

    const identity = this._resolveEventIdentity(screenId, data, 'gift');

    // Classify combo tick at normalization time so all downstream consumers get it
    const isComboGift = data.gift?.combo === true || data.combo === true;
    const repeatEnd = data.repeatEnd;
    const isRepeatNotEnded = repeatEnd === 0 || repeatEnd === false || repeatEnd === '0';
    const isComboTick = isComboGift && isRepeatNotEnded;

    const normalized = {
      type: "gift",
      screenId,
      // Session + dedup identity (protobuf common.* with connection fallback)
      roomId: identity.roomId,
      msgId: identity.msgId,
      user: data.user?.displayId || data.user?.idStr || data.user?.uniqueId || "someone",
      nickname: data.user?.nickname || "",
      giftName: data.gift?.name || data.giftDetails?.giftName || data.giftName || "Gift",
      giftId: data.giftId || data.gift?.id,
      repeatCount: data.repeatCount || 1,
      repeatCountCumulative: isComboGift,
      repeatEnd: repeatEnd,
      combo: isComboGift,
      isComboTick: isComboTick,
      diamondCount: data.gift?.diamondCount ?? data.giftDetails?.diamondCount ?? data.diamondCount ?? 0,
      giftImageUrl: rawImageUrl,
      timestamp: Date.now(),
    };

    if (TIKTOK_SERVICE_DEBUG) {
      console.log('[COIN-JAR-GIFT-TRACE][NORMALIZED]', JSON.stringify({
        screenId,
        type: normalized.type,
        giftId: normalized.giftId,
        giftName: normalized.giftName,
        diamondCount: normalized.diamondCount,
        repeatCount: normalized.repeatCount,
        repeatEnd: normalized.repeatEnd,
        combo: normalized.combo,
        isComboTick: normalized.isComboTick,
        giftImageUrl: normalized.giftImageUrl || '(empty)',
        roomId: normalized.roomId,
        msgId: normalized.msgId,
      }));
    }

    return normalized;
  }

  _normalizeLikeEvent(screenId, username, data) {
    // AUDITED tiktok-live-proto v3 WebcastLikeMessage semantics:
    //   data.count → incremental batch size (likes in THIS message)
    //   data.total → cumulative room likes (string-typed in proto)
    //   data.user  → raw User proto (displayId / idStr / nickname; NO uniqueId)
    //   data.common.msgId / data.common.roomId → dedup + session identity
    // Previous code read data.likeCount/data.totalLikeCount which DO NOT EXIST
    // on raw protobuf — every like normalized as likeCount=1, totalLikeCount=0.
    const likeCount = Number(data.count) || 1;
    const totalLikeCount = Number(data.total) || 0;
    const identity = this._resolveEventIdentity(screenId, data, 'like');
    const normalized = {
      type: "like",
      screenId,
      roomId: identity.roomId,
      msgId: identity.msgId,
      user: data.user?.displayId || data.user?.idStr || data.user?.uniqueId || "someone",
      nickname: data.user?.nickname || "",
      likeCount,
      totalLikeCount,
      timestamp: Date.now(),
    };
    if (TIKTOK_SERVICE_DEBUG) {
      console.log('[GOAL-LIKE-NORMALIZED]', JSON.stringify({
        roomId: normalized.roomId,
        count: likeCount,
        total: totalLikeCount,
        user: normalized.user,
        msgId: normalized.msgId,
        screenId,
        rawCount: data.count,
        rawTotal: data.total,
      }));
    }
    return normalized;
  }

  _normalizeSubscribeEvent(screenId, username, data) {
    const identity = this._resolveEventIdentity(screenId, data, 'subscribe');
    return {
      type: "subscribe",
      screenId,
      roomId: identity.roomId,
      msgId: identity.msgId,
      user: data.user?.displayId || data.user?.idStr || data.user?.uniqueId || "someone",
      nickname: data.user?.nickname || "",
      timestamp: Date.now(),
    };
  }

  _normalizeCommentEvent(screenId, username, data) {
    const identity = this._resolveEventIdentity(screenId, data, 'comment');
    return {
      type: "comment",
      screenId,
      roomId: identity.roomId,
      msgId: identity.msgId,
      user: data.user?.displayId || data.user?.idStr || data.user?.uniqueId || "someone",
      nickname: data.user?.nickname || data.nickname || "",
      comment: data.content || "",
      timestamp: Date.now(),
    };
  }

  _normalizeFollowEvent(screenId, username, data) {
    // AUDITED: follow arrives as WebcastSocialMessage (raw protobuf).
    // User proto has displayId/idStr — NOT uniqueId (uniqueId only exists
    // after legacy simplifyObject). roomId falls back to connection state.
    const identity = this._resolveEventIdentity(screenId, data, 'follow');
    return {
      type: "follow",
      screenId,
      roomId: identity.roomId,
      msgId: identity.msgId,
      user: data.user?.displayId || data.user?.idStr || data.user?.uniqueId || "someone",
      nickname: data.user?.nickname || "",
      timestamp: Date.now(),
    };
  }

  _normalizeShareEvent(screenId, username, data) {
    const identity = this._resolveEventIdentity(screenId, data, 'share');
    return {
      type: "share",
      screenId,
      roomId: identity.roomId,
      msgId: identity.msgId,
      user: data.user?.displayId || data.user?.idStr || data.user?.uniqueId || "someone",
      nickname: data.user?.nickname || "",
      timestamp: Date.now(),
    };
  }

  _normalizeMemberEvent(screenId, username, data) {
    const identity = this._resolveEventIdentity(screenId, data, 'member');
    return {
      type: "member",
      screenId,
      roomId: identity.roomId,
      msgId: identity.msgId,
      user: data.user?.displayId || data.user?.idStr || data.user?.uniqueId || "someone",
      nickname: data.user?.nickname || "",
      timestamp: Date.now(),
    };
  }

  /** Shutdown all connections */
  shutdown() {
    for (const [screenId, screenState] of this.screens) {
      this._clearCooldownTimer(screenState);
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