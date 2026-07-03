// ═══════════════════════════════════════════════
// RosaeFinity Spotify Controller
// Spotify Web API — OAuth PKCE + Queue Management
// ═══════════════════════════════════════════════

const https = require("https");
const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const TOKEN_FILE = path.join(DATA_DIR, "spotify-tokens.json");

// ══ Configuration ═══════════════════════════
const SPOTIFY_CONFIG = {
  // Built-in Client ID — user langsung bisa login tanpa buat app sendiri
  clientId: "1b7e5c8f9a2d4e6f8a0b3c5d7e9f1a2b",
  redirectUri: "http://127.0.0.1:8890/callback",
  scopes: [
    "user-read-playback-state",
    "user-modify-playback-state",
    "user-read-currently-playing",
    "playlist-read-private",
    "user-read-playback-position",
    "user-library-read",
  ],
};

// ══ Internal State ══════════════════════════
let tokens = { accessToken: null, refreshToken: null, expiresAt: 0 };
let codeVerifier = null;
let localServer = null;
let songQueue = [];           // [{ user, nickname, track: { name, artist, uri, albumArt, durationMs }, timestamp }]
let currentlyPlaying = null;  // { name, artist, albumArt, progressMs, durationMs, isPlaying, uri }

// ══ Helpers ═════════════════════════════════
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function base64URLEncode(buffer) {
  return buffer.toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest();
}

// ══ Token Persistence (like points-system user data) ══
function loadTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) {
      tokens = { ...tokens, ...JSON.parse(fs.readFileSync(TOKEN_FILE, "utf-8")) };
      console.log(`[SPOTIFY] Tokens loaded — expiresAt: ${new Date(tokens.expiresAt).toLocaleString()}`);
    }
  } catch (e) {
    console.error("[SPOTIFY] Error loading tokens:", e.message);
  }
}

function saveTokens() {
  try {
    ensureDataDir();
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2), "utf-8");
    console.log("[SPOTIFY] Tokens saved");
  } catch (e) {
    console.error("[SPOTIFY] Error saving tokens:", e.message);
  }
}

function clearTokens() {
  tokens = { accessToken: null, refreshToken: null, expiresAt: 0 };
  try {
    if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
    console.log("[SPOTIFY] Tokens cleared");
  } catch (_) {}
}

// ══ Generic Spotify API Request (like minecraft's serverTapRequest) ══
function spotifyApiRequest(method, endpoint, body = null) {
  return new Promise(async (resolve) => {
    // Ensure we have a valid token
    if (!tokens.accessToken) {
      resolve({ success: false, error: "Not authenticated", statusCode: 401 });
      return;
    }

    // Refresh if expired (with 5min buffer)
    if (tokens.expiresAt && Date.now() > tokens.expiresAt - 300000) {
      console.log("[SPOTIFY] Token expired, refreshing...");
      const refreshed = await refreshAccessToken();
      if (!refreshed) {
        resolve({ success: false, error: "Token refresh failed", statusCode: 401 });
        return;
      }
    }

    const options = {
      hostname: "api.spotify.com",
      path: `/v1${endpoint}`,
      method: method,
      headers: {
        "Authorization": `Bearer ${tokens.accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "RosaeFinity/1.0",
      },
      timeout: 8000,
    };

    let bodyString = "";
    if (body) {
      bodyString = JSON.stringify(body);
      options.headers["Content-Length"] = Buffer.byteLength(bodyString);
    }

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode === 401) {
            // Token might have expired — try refresh once
            console.log("[SPOTIFY] 401 — refreshing token and retrying...");
            refreshAccessToken().then(refreshed => {
              if (refreshed) {
                // Retry the request
                spotifyApiRequest(method, endpoint, body).then(resolve);
              } else {
                resolve({ success: false, error: "Authentication failed", statusCode: 401, data: parsed });
              }
            });
            return;
          }
          resolve({ success: res.statusCode < 400, data: parsed, statusCode: res.statusCode });
        } catch (e) {
          resolve({ success: res.statusCode < 400, raw: data, statusCode: res.statusCode });
        }
      });
    });

    req.on("error", (err) => resolve({ success: false, error: err.message }));
    req.on("timeout", () => { req.destroy(); resolve({ success: false, error: "Request timeout" }); });

    if (bodyString) req.write(bodyString);
    req.end();
  });
}

// ══ Spotify Token API (https POST to accounts.spotify.com) ══
function spotifyTokenRequest(formData) {
  return new Promise((resolve) => {
    const bodyString = Object.entries(formData)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join("&");

    const options = {
      hostname: "accounts.spotify.com",
      path: "/api/token",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(bodyString),
      },
      timeout: 8000,
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          resolve({ success: res.statusCode < 400, data: JSON.parse(data), statusCode: res.statusCode });
        } catch (e) {
          resolve({ success: false, error: e.message, raw: data });
        }
      });
    });

    req.on("error", (err) => resolve({ success: false, error: err.message }));
    req.on("timeout", () => { req.destroy(); resolve({ success: false, error: "Request timeout" }); });

    req.write(bodyString);
    req.end();
  });
}

// ══ OAuth PKCE ══════════════════════════════

// Generate code verifier (random 43-128 chars)
function generateCodeVerifier() {
  const buffer = crypto.randomBytes(64);
  return base64URLEncode(buffer).substring(0, 128);
}

// Generate code challenge (SHA256 of verifier → base64url)
function generateCodeChallenge(verifier) {
  return base64URLEncode(sha256(verifier));
}

// Get authorization URL for the OAuth PKCE flow
function getAuthUrl(clientId) {
  const client = clientId || SPOTIFY_CONFIG.clientId;
  if (!client) return null;

  codeVerifier = generateCodeVerifier();
  const challenge = generateCodeChallenge(codeVerifier);

  const params = new URLSearchParams({
    client_id: client,
    response_type: "code",
    redirect_uri: SPOTIFY_CONFIG.redirectUri,
    code_challenge_method: "S256",
    code_challenge: challenge,
    scope: SPOTIFY_CONFIG.scopes.join(" "),
  });

  return { url: `https://accounts.spotify.com/authorize?${params.toString()}`, verifier: codeVerifier, clientId: client };
}

// Exchange authorization code for tokens
async function exchangeCode(code, verifier, clientId) {
  const result = await spotifyTokenRequest({
    client_id: clientId,
    grant_type: "authorization_code",
    code: code,
    redirect_uri: SPOTIFY_CONFIG.redirectUri,
    code_verifier: verifier,
  });

  if (result.success && result.data) {
    const d = result.data;
    tokens.accessToken = d.access_token;
    tokens.refreshToken = d.refresh_token || tokens.refreshToken;
    tokens.expiresAt = Date.now() + (d.expires_in || 3600) * 1000;
    saveTokens();
    console.log("[SPOTIFY] ✅ OAuth code exchanged successfully");
    return { success: true };
  }

  console.error("[SPOTIFY] ❌ OAuth code exchange failed:", result.data || result.error);
  return { success: false, error: result.data?.error_description || result.error || "Exchange failed" };
}

// Refresh access token
async function refreshAccessToken() {
  if (!tokens.refreshToken) {
    console.log("[SPOTIFY] No refresh token available");
    return false;
  }

  const clientId = SPOTIFY_CONFIG.clientId;
  if (!clientId) return false;

  const result = await spotifyTokenRequest({
    client_id: clientId,
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
  });

  if (result.success && result.data) {
    const d = result.data;
    tokens.accessToken = d.access_token;
    if (d.refresh_token) tokens.refreshToken = d.refresh_token;
    tokens.expiresAt = Date.now() + (d.expires_in || 3600) * 1000;
    saveTokens();
    console.log("[SPOTIFY] ✅ Token refreshed");
    return true;
  }

  console.error("[SPOTIFY] ❌ Token refresh failed:", result.data?.error_description || result.error);
  clearTokens();
  return false;
}

// ══ Config ══════════════════════════════════
function setConfig(config) {
  if (config.spotifyClientId) SPOTIFY_CONFIG.clientId = config.spotifyClientId;
}

// ══ Authentication Status ═══════════════════
function isAuthenticated() {
  return !!(tokens.accessToken && tokens.expiresAt > Date.now());
}

function getAuthStatus() {
  return {
    authenticated: isAuthenticated(),
    expiresAt: tokens.expiresAt,
    hasRefreshToken: !!tokens.refreshToken,
    queueLength: songQueue.length,
    nowPlaying: currentlyPlaying,
  };
}

// ══ Test Connection ═════════════════════════
async function testConnection() {
  return new Promise(async (resolve) => {
    const result = await spotifyApiRequest("GET", "/me");
    if (result.success) {
      resolve({
        success: true,
        data: result.data,
        info: `✅ Connected as ${result.data.display_name || result.data.id || "Spotify user"}`,
      });
    } else {
      resolve({ success: false, error: result.error || "Not authenticated" });
    }
  });
}

// ══ Search Tracks ═══════════════════════════
async function searchTracks(query, limit = 10) {
  const q = encodeURIComponent(query);
  const result = await spotifyApiRequest("GET", `/search?q=${q}&type=track&limit=${limit}`);

  if (result.success && result.data?.tracks?.items) {
    const tracks = result.data.tracks.items.map(t => ({
      id: t.id,
      name: t.name,
      artist: t.artists?.map(a => a.name).join(", ") || "Unknown",
      album: t.album?.name || "",
      albumArt: t.album?.images?.[0]?.url || "",
      uri: t.uri,
      durationMs: t.duration_ms || 0,
      explicit: t.explicit || false,
      previewUrl: t.preview_url || null,
    }));
    return { success: true, tracks };
  }

  return { success: false, error: result.error || "No results", tracks: [] };
}

// ══ Playback State ══════════════════════════
async function getPlaybackState() {
  const result = await spotifyApiRequest("GET", "/me/player");

  if (result.success && result.data) {
    const d = result.data;
    currentlyPlaying = {
      name: d.item?.name || "Unknown",
      artist: d.item?.artists?.map(a => a.name).join(", ") || "Unknown",
      albumArt: d.item?.album?.images?.[0]?.url || "",
      album: d.item?.album?.name || "",
      progressMs: d.progress_ms || 0,
      durationMs: d.item?.duration_ms || 0,
      isPlaying: d.is_playing || false,
      uri: d.item?.uri || "",
      device: d.device?.name || "",
    };
    return { success: true, ...currentlyPlaying };
  }

  // If nothing is playing, return null state but not error
  if (result.statusCode === 204) {
    currentlyPlaying = null;
    return { success: true, isPlaying: false, name: "Nothing Playing", artist: "", albumArt: "" };
  }

  currentlyPlaying = null;
  return { success: false, error: result.error || "Could not get playback state" };
}

// ══ Get Devices ═════════════════════════════
async function getDevices() {
  const result = await spotifyApiRequest("GET", "/me/player/devices");
  if (result.success && result.data?.devices) {
    return { success: true, devices: result.data.devices };
  }
  return { success: false, error: result.error || "Could not get devices", devices: [] };
}

// ══ Add to Queue ════════════════════════════
async function addToQueue(uri) {
  const encodedUri = encodeURIComponent(uri);
  const result = await spotifyApiRequest("POST", `/me/player/queue?uri=${encodedUri}`);
  return result;
}

// ══ Skip Track ══════════════════════════════
async function skipTrack() {
  const result = await spotifyApiRequest("POST", "/me/player/next");
  return result;
}

// ══ Internal Queue Management ═══════════════

function getQueue() {
  return { queue: [...songQueue], nowPlaying: currentlyPlaying };
}

// Add a song to the internal request queue (validation happens in script.js)
function pushToQueue(entry) {
  songQueue.push({
    ...entry,
    timestamp: Date.now(),
  });
  // Sort: newest first (for UI display)
  songQueue.sort((a, b) => b.timestamp - a.timestamp);
  return { success: true, queueLength: songQueue.length };
}

// Remove a user's tracks from queue (for !revoke)
function removeUserFromQueue(username) {
  const key = username.toLowerCase().trim();
  const before = songQueue.length;
  songQueue = songQueue.filter(e => e.user?.toLowerCase().trim() !== key);
  const removed = before - songQueue.length;
  return { success: true, removed, queueLength: songQueue.length };
}

// Remove the first queued item (after it's been added to Spotify)
function shiftQueue() {
  return songQueue.shift() || null;
}

// Clear entire queue
function clearQueue() {
  songQueue = [];
  return { success: true };
}

// ══ Init ════════════════════════════════════
function initSpotify() {
  ensureDataDir();
  loadTokens();
  console.log(`[SPOTIFY] Initialized — ${isAuthenticated() ? "authenticated" : "not authenticated"}`);
}

// Init on load
initSpotify();

// ══ Local HTTP Server for OAuth Callback ═══
// NOTE: Not used anymore — we intercept the redirect directly in main.js via
//       BrowserWindow.webContents.session.webRequest.onBeforeRequest
//       Kept here for reference / future alternative flows.
function startOAuthServer() {
  return new Promise((resolve) => {
    resolve({ success: false, error: "Deprecated — use main.js intercept instead" });
  });
}

module.exports = {
  setConfig,
  testConnection,
  isAuthenticated,
  getAuthStatus,
  getAuthUrl,
  exchangeCode,
  refreshAccessToken,
  startOAuthServer,
  searchTracks,
  addToQueue,
  skipTrack,
  getPlaybackState,
  getDevices,
  getQueue,
  pushToQueue,
  removeUserFromQueue,
  shiftQueue,
  clearQueue,
  get currentlyPlaying() { return currentlyPlaying; },
  get config() { return { ...SPOTIFY_CONFIG }; },
  get tokens() { return { authenticated: !!tokens.accessToken, hasRefresh: !!tokens.refreshToken }; },
};
