// ═══════════════════════════════════════════════
// RosaeFinity Authentication System
// Uses backend API (http://localhost:3000/api/v1/*)
// for email/password and Google authentication.
// Stream profiles remain local.
// ═══════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const http = require("http");
const { app } = require("electron");
const { apiUrl } = require("./api-config.cjs");

const LEGACY_DATA_DIR = path.join(__dirname, "data");
const LEGACY_SESSION_FILE = path.join(LEGACY_DATA_DIR, "session.json");
const LEGACY_STREAM_PROFILES_FILE = path.join(LEGACY_DATA_DIR, "stream-profiles.json");

function getDataDir() {
  return path.join(app.getPath("userData"), "rosaefinity");
}

function getDataFile(name) {
  return path.join(getDataDir(), name);
}

function isValidJsonFile(file, validator) {
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    return validator(value);
  } catch (_) {
    return false;
  }
}

function isValidSession(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const knownFields = ["accessToken", "refreshToken", "token", "userId", "expiresAt", "rememberMe"];
  if (!knownFields.some((field) => Object.prototype.hasOwnProperty.call(value, field))) return false;
  return (
    (value.accessToken === undefined || value.accessToken === null || typeof value.accessToken === "string") &&
    (value.refreshToken === undefined || value.refreshToken === null || typeof value.refreshToken === "string") &&
    (value.token === undefined || value.token === null || typeof value.token === "string") &&
    (value.userId === undefined || value.userId === null || typeof value.userId === "string") &&
    (value.expiresAt === undefined || value.expiresAt === null || typeof value.expiresAt === "number") &&
    (value.rememberMe === undefined || typeof value.rememberMe === "boolean")
  );
}

function isValidProfile(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return false;
  if (typeof profile.id !== "string" || profile.id.length === 0) return false;
  return (
    (profile.name === undefined || typeof profile.name === "string") &&
    (profile.tiktokUsername === undefined || typeof profile.tiktokUsername === "string") &&
    (profile.overlaySettings === undefined || (profile.overlaySettings && typeof profile.overlaySettings === "object" && !Array.isArray(profile.overlaySettings))) &&
    (profile.alertsSettings === undefined || (profile.alertsSettings && typeof profile.alertsSettings === "object" && !Array.isArray(profile.alertsSettings))) &&
    (profile.actions === undefined || Array.isArray(profile.actions)) &&
    (profile.events === undefined || Array.isArray(profile.events)) &&
    (profile.createdAt === undefined || typeof profile.createdAt === "number") &&
    (profile.updatedAt === undefined || typeof profile.updatedAt === "number")
  );
}

function isValidStreamProfiles(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.values(value).every((profiles) => (
    Array.isArray(profiles) && profiles.every(isValidProfile)
  ));
}

function copyFileIfDestinationMissing(sourceFile, destinationFile, label) {
  const tempFile = `${destinationFile}.${process.pid}.${Date.now()}.tmp`;
  try {
    fs.copyFileSync(sourceFile, tempFile, fs.constants.COPYFILE_EXCL);
    // A hard link is an exclusive create in the same directory. Unlike rename,
    // it cannot replace a destination created after the existence check.
    fs.linkSync(tempFile, destinationFile);
    fs.rmSync(tempFile, { force: true });
    console.log(`[AUTH] Migrated legacy ${label} storage`);
  } catch (error) {
    try { fs.rmSync(tempFile, { force: true }); } catch (_) {}
    console.warn(`[AUTH] Failed to migrate ${label} storage: ${error.code || "filesystem error"}`);
  }
}

function copyLegacyFileIfNeeded(legacyFile, destinationFile, validator, label) {
  try {
    if (!fs.existsSync(legacyFile)) return;
    if (fs.existsSync(destinationFile)) {
      console.warn(`[AUTH] Storage conflict for ${label}; keeping existing userData file`);
      return;
    }
    if (!isValidJsonFile(legacyFile, validator)) {
      console.warn(`[AUTH] Ignoring malformed legacy ${label} file`);
      return;
    }
    copyFileIfDestinationMissing(legacyFile, destinationFile, label);
  } catch (error) {
    console.warn(`[AUTH] Failed to inspect legacy ${label} storage: ${error.code || "filesystem error"}`);
  }
}

function replaceJsonFile(file, value, label) {
  const tempFile = `${file}.${process.pid}.${Date.now()}.tmp`;
  const backupFile = `${file}.${process.pid}.${Date.now()}.bak`;
  let backupCreated = false;
  let installed = false;
  try {
    fs.writeFileSync(tempFile, JSON.stringify(value, null, 2), "utf8");
    if (fs.existsSync(file)) {
      fs.renameSync(file, backupFile);
      backupCreated = true;
    }
    // Exclusive link creation avoids replacing a file created after the check.
    fs.linkSync(tempFile, file);
    installed = true;
  } catch (error) {
    if (!installed && backupCreated && !fs.existsSync(file)) {
      try {
        fs.renameSync(backupFile, file);
        backupCreated = false;
      } catch (_) {
        // Keep the backup when Windows locks or otherwise rejects restoration.
      }
    }
    try { fs.rmSync(tempFile, { force: true }); } catch (_) {}
    console.error(`[AUTH] Error saving ${label}:`, error.code || "storage error");
    return;
  }

  // Installation succeeded; cleanup failures must not roll back the new file.
  try {
    fs.rmSync(tempFile, { force: true });
  } catch (cleanupError) {
    console.warn(`[AUTH] Failed to clean up ${label} temporary file: ${cleanupError.code || "filesystem error"}`);
  }
  if (backupCreated) {
    try {
      fs.rmSync(backupFile, { force: true });
    } catch (cleanupError) {
      console.warn(`[AUTH] Failed to clean up ${label} backup: ${cleanupError.code || "filesystem error"}`);
    }
  }
}

function ensureDataDir() {
  const dataDir = getDataDir();
  fs.mkdirSync(dataDir, { recursive: true });
  copyLegacyFileIfNeeded(
    LEGACY_SESSION_FILE,
    getDataFile("session.json"),
    isValidSession,
    "session",
  );
  copyLegacyFileIfNeeded(
    LEGACY_STREAM_PROFILES_FILE,
    getDataFile("stream-profiles.json"),
    isValidStreamProfiles,
    "stream profiles",
  );
  return dataDir;
}

function sessionFilePath() {
  return getDataFile("session.json");
}

function streamProfilesFilePath() {
  return getDataFile("stream-profiles.json");
}

// ══ Stream Profile Limits ════════════════════════
const PROFILE_LIMITS = {
  free: 1,
  pro: 10,
};

// ══ Internal State ═════════════════════════════════
let sessionData = {
  accessToken: null,
  refreshToken: null,
  userId: null,
  expiresAt: null,
  rememberMe: false,
};

// In-memory cache of the authenticated backend user
let cachedBackendUser = null;

let streamProfiles = {};
let currentStreamProfileId = null;

// ══ Helpers ══════════════════════════════════════════
function generateId() {
  const crypto = require("crypto");
  return crypto.randomBytes(12).toString("hex");
}

function generateProfileId() {
  return "spf_" + generateId();
}

// ══ HTTP Client ══════════════════════════════════════
/**
 * Make an HTTP request to the backend API.
 * Returns { ok: true, status, data } or { ok: false, status, error, data? }
 * NEVER logs passwords, tokens, or sensitive data.
 */
function apiRequest(method, endpoint, body, accessToken) {
  return new Promise((resolve) => {
    const url = new URL(`${apiUrl}${endpoint}`);
    const postData = body ? JSON.stringify(body) : null;

    const headers = {
      "Content-Type": "application/json",
      ...(postData ? { "Content-Length": Buffer.byteLength(postData) } : {}),
      ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {}),
    };

    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method,
        headers,
        timeout: 15000,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => { data += chunk; });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            resolve({ ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: parsed });
          } catch {
            resolve({ ok: false, status: res.statusCode, error: "Invalid response from server" });
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, status: 0, error: "Backend server unreachable" });
    });

    req.on("error", (err) => {
      resolve({ ok: false, status: 0, error: `Backend server unavailable: ${err.message}` });
    });

    if (postData) req.write(postData);
    req.end();
  });
}

// ══ Persistence ══════════════════════════════════════
function loadSession() {
  try {
    ensureDataDir();
    const sessionFile = sessionFilePath();
    const streamProfilesFile = streamProfilesFilePath();
    if (fs.existsSync(sessionFile)) {
      const loaded = JSON.parse(fs.readFileSync(sessionFile, "utf-8"));
      sessionData = {
        accessToken: loaded.accessToken || null,
        refreshToken: loaded.refreshToken || loaded.token || null, // fallback for old format
        userId: loaded.userId || null,
        expiresAt: loaded.expiresAt || null,
        rememberMe: loaded.rememberMe || false,
      };
    }
    if (fs.existsSync(streamProfilesFile)) {
      streamProfiles = JSON.parse(fs.readFileSync(streamProfilesFile, "utf-8"));
    }
    console.log("[AUTH] Session data loaded");
  } catch (e) {
    console.error("[AUTH] Error loading session:", e.code || "storage error");
  }
}

function saveSession() {
  try {
    ensureDataDir();
    replaceJsonFile(sessionFilePath(), sessionData, "session");
  } catch (e) {
    console.error("[AUTH] Error saving session:", e.code || "storage error");
  }
}

function saveStreamProfiles() {
  try {
    ensureDataDir();
    replaceJsonFile(streamProfilesFilePath(), streamProfiles, "stream profiles");
  } catch (e) {
    console.error("[AUTH] Error saving stream profiles:", e.code || "storage error");
  }
}

// ══ User Mapping ══════════════════════════════════════
/**
 * Map a backend API user object to the format expected by the frontend.
 * Backend actual: {id, email, username, role, avatar, ...}
 * Frontend: {id, email, name, provider, plan, ...}
 */
function mapBackendUser(backendUser) {
  if (!backendUser) return null;
  return {
    id: backendUser.id,
    email: backendUser.email,
    name: backendUser.username || backendUser.displayName || backendUser.email?.split("@")[0] || "User",
    avatar: backendUser.avatar || null,
    provider: backendUser.authProvider || "email",
    plan: backendUser.role === "admin" ? "pro" : backendUser.accountType || "free",
    createdAt: backendUser.createdAt || new Date().toISOString(),
    lastLogin: backendUser.lastLogin || new Date().toISOString(),
  };
}

// ══ Session Management ═══════════════════════════════
function createLocalSession(accessToken, refreshToken, userId, rememberMe) {
  const expiresAt = rememberMe
    ? Date.now() + 30 * 24 * 60 * 60 * 1000
    : Date.now() + 7 * 24 * 60 * 60 * 1000;

  sessionData = {
    accessToken,
    refreshToken,
    userId,
    expiresAt,
    rememberMe,
  };
  cachedBackendUser = null; // clear cache on new session
  saveSession();
  return { expiresAt };
}

function validateLocalSession() {
  if (!sessionData.accessToken || !sessionData.userId || !sessionData.expiresAt) {
    return { valid: false };
  }
  if (Date.now() > sessionData.expiresAt) {
    clearSession();
    return { valid: false, reason: "expired" };
  }
  return {
    valid: true,
    userId: sessionData.userId,
    accessToken: sessionData.accessToken,
  };
}

function clearSession() {
  sessionData = { accessToken: null, refreshToken: null, userId: null, expiresAt: null, rememberMe: false };
  cachedBackendUser = null;
  saveSession();
}

// ══ User Registration & Login ═════════════════════════
async function registerEmail(email, password, name) {
  console.log("[AUTH] registerEmail called");

  if (!email || !email.includes("@")) {
    return { success: false, error: "Email tidak valid" };
  }
  if (!password || password.length < 6) {
    return { success: false, error: "Password minimal 6 karakter" };
  }

  console.log("[AUTH] backend register request started");
  const result = await apiRequest("POST", "/auth/register", {
    email: email.toLowerCase().trim(),
    password,
    displayName: name || email.split("@")[0],
  });

  if (!result.ok) {
    const raw = result.data?.error || result.error || "Registrasi gagal";
    const errorMsg = typeof raw === "object" ? (raw.message || raw.code || "Registrasi gagal") : String(raw);
    console.log("[AUTH] backend register failed:", errorMsg);
    return { success: false, error: errorMsg };
  }

  const { user: backendUser, accessToken, refreshToken } = result.data.data || result.data;
  const user = mapBackendUser(backendUser);

  console.log("[AUTH] backend register succeeded, authenticated user:", user.email);
  createLocalSession(accessToken, refreshToken, user.id, false);

  return {
    success: true,
    user,
    session: { token: accessToken, expiresAt: sessionData.expiresAt },
  };
}

async function loginEmail(email, password, rememberMe = false) {
  console.log("[AUTH] loginEmail called");

  if (!email || !email.includes("@")) {
    return { success: false, error: "Email tidak valid" };
  }
  if (!password) {
    return { success: false, error: "Password harus diisi" };
  }

  console.log("[AUTH] backend login request started");
  const result = await apiRequest("POST", "/auth/login", {
    email: email.toLowerCase().trim(),
    password,
    rememberMe,
  });

  if (!result.ok) {
    const raw = result.data?.error || result.error || "Email atau password salah";
    const errorMsg = typeof raw === "object" ? (raw.message || raw.code || "Email atau password salah") : String(raw);
    console.log("[AUTH] backend login failed:", errorMsg);
    return { success: false, error: errorMsg };
  }

  const { user: backendUser, accessToken, refreshToken } = result.data.data || result.data;
  const user = mapBackendUser(backendUser);

  console.log("[AUTH] backend login succeeded, authenticated user:", user.email);
  createLocalSession(accessToken, refreshToken, user.id, rememberMe);

  // Cache the backend user for getCurrentUser
  cachedBackendUser = backendUser;

  return {
    success: true,
    user,
    session: { token: accessToken, expiresAt: sessionData.expiresAt },
  };
}

async function loginGoogle(googleData) {
  console.log("[AUTH] loginGoogle called");
  // Delegate to backend — backend has loginWithProvider('google', ...)
  const result = await apiRequest("POST", "/auth/login/google", {
    accessToken: googleData.accessToken,
    idToken: googleData.idToken || undefined,
  });

  if (!result.ok) {
    const raw = result.data?.error || result.error || "Google login gagal";
    const errorMsg = typeof raw === "object" ? (raw.message || raw.code || "Google login gagal") : String(raw);
    console.log("[AUTH] backend google login failed:", errorMsg);
    return { success: false, error: errorMsg };
  }

  const { user: backendUser, accessToken, refreshToken } = result.data.data || result.data;
  const user = mapBackendUser(backendUser);

  console.log("[AUTH] backend google login succeeded, authenticated user:", user.email);
  createLocalSession(accessToken, refreshToken, user.id, true);

  cachedBackendUser = backendUser;

  return {
    success: true,
    user,
    session: { token: accessToken, expiresAt: sessionData.expiresAt },
  };
}

async function logout() {
  console.log("[AUTH] logout called");

  // Attempt to invalidate backend session
  if (sessionData.accessToken) {
    console.log("[AUTH] invalidating backend session");
    await apiRequest("POST", "/auth/logout", null, sessionData.accessToken);
  }

  clearSession();
  console.log("[AUTH] local session cleared");
  return { success: true };
}

// ══ Token Refresh ════════════════════════════════════
async function refreshAccessToken() {
  if (!sessionData.refreshToken) {
    return false;
  }

  console.log("[AUTH] refreshing access token");
  const result = await apiRequest("POST", "/auth/refresh", {
    refreshToken: sessionData.refreshToken,
  });

  if (!result.ok) {
    console.log("[AUTH] token refresh failed, clearing session");
    clearSession();
    return false;
  }

  const { user: backendUser, accessToken, refreshToken } = result.data.data || result.data;
  sessionData.accessToken = accessToken;
  sessionData.refreshToken = refreshToken;
  sessionData.userId = backendUser.id;
  sessionData.expiresAt = Date.now() + (sessionData.rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000;
  cachedBackendUser = backendUser;
  saveSession();

  console.log("[AUTH] token refreshed successfully");
  return true;
}

// ══ Get Current User (sync — local session only) ═══
/**
 * Returns the currently authenticated user from the local session cache.
 * Does NOT make backend calls. Use for stream profile handlers.
 * Returns null if no valid session exists.
 */
function getCurrentUserSync() {
  const session = validateLocalSession();
  if (!session.valid) return null;

  // Use cached backend user if available
  if (cachedBackendUser) {
    return mapBackendUser(cachedBackendUser);
  }

  // Minimal user from session data
  if (session.userId) {
    return {
      id: session.userId,
      email: "",
      name: "User",
      provider: "email",
      plan: "free",
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
  }
  return null;
}

// ══ Get Current User (async — validates against backend) ═════════════════════════
async function getCurrentUser() {
  const session = validateLocalSession();
  if (!session.valid) {
    return null;
  }

  // Try backend /me endpoint with current access token
  let result = await apiRequest("GET", "/auth/me", null, session.accessToken);

  // If token expired (401), try refreshing
  if (result.status === 401 && sessionData.refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      result = await apiRequest("GET", "/auth/me", null, sessionData.accessToken);
    }
  }

  if (result.ok && result.data?.data) {
    cachedBackendUser = result.data.data;
    return mapBackendUser(result.data.data);
  }

  // If backend is unreachable, use cached user (if any)
  if (cachedBackendUser) {
    console.log("[AUTH] backend unreachable, using cached user data");
    return mapBackendUser(cachedBackendUser);
  }

  // Fallback: return minimal user from session data
  if (session.userId) {
    return {
      id: session.userId,
      email: "",
      name: "User",
      provider: "email",
      plan: "free",
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };
  }

  return null;
}

// ══ Validate Session ════════════════════════════════════
async function validateSession() {
  const local = validateLocalSession();
  if (!local.valid) {
    return { valid: false, reason: local.reason || "no session" };
  }

  // Validate against backend
  const result = await apiRequest("GET", "/auth/me", null, local.accessToken);

  if (result.ok) {
    return { valid: true, userId: local.userId, token: local.accessToken };
  }

  // If 401, try refresh
  if (result.status === 401 && sessionData.refreshToken) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      return { valid: true, userId: sessionData.userId, token: sessionData.accessToken };
    }
  }

  // Backend unreachable but local session is not expired — still valid locally
  if (result.status === 0) {
    console.log("[AUTH] backend unreachable, session valid locally");
    return { valid: true, userId: local.userId, token: local.accessToken };
  }

  // Backend explicitly rejected the session
  clearSession();
  return { valid: false, reason: "session invalidated by server" };
}

// ══ Stream Profiles (unchanged — local storage) ═════════════════════════
function getProfileLimit(userId) {
  return PROFILE_LIMITS.free;
}

function getUserStreamProfiles(userId) {
  return streamProfiles[userId] || [];
}

function createStreamProfile(userId, profileData) {
  const limit = getProfileLimit(userId);
  const currentProfiles = getUserStreamProfiles(userId);

  if (currentProfiles.length >= limit) {
    return {
      success: false,
      error: `Batas stream profile tercapai (${limit}). Upgrade ke Pro untuk lebih banyak.`,
      limit,
      current: currentProfiles.length,
    };
  }

  const profile = {
    id: generateProfileId(),
    name: profileData.name || "Stream Profile " + (currentProfiles.length + 1),
    tiktokUsername: profileData.tiktokUsername || "",
    overlaySettings: profileData.overlaySettings || getDefaultOverlaySettings(),
    alertsSettings: profileData.alertsSettings || getDefaultAlertsSettings(),
    actions: profileData.actions || [],
    events: profileData.events || [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  if (!streamProfiles[userId]) {
    streamProfiles[userId] = [];
  }
  streamProfiles[userId].push(profile);
  saveStreamProfiles();

  if (!currentStreamProfileId) {
    currentStreamProfileId = profile.id;
  }

  return { success: true, profile };
}

function updateStreamProfile(userId, profileId, updates) {
  const profiles = getUserStreamProfiles(userId);
  const index = profiles.findIndex(p => p.id === profileId);

  if (index === -1) {
    return { success: false, error: "Stream profile tidak ditemukan" };
  }

  profiles[index] = { ...profiles[index], ...updates, updatedAt: Date.now() };
  saveStreamProfiles();
  return { success: true, profile: profiles[index] };
}

function deleteStreamProfile(userId, profileId) {
  const profiles = getUserStreamProfiles(userId);
  const index = profiles.findIndex(p => p.id === profileId);

  if (index === -1) {
    return { success: false, error: "Stream profile tidak ditemukan" };
  }

  profiles.splice(index, 1);
  saveStreamProfiles();

  if (currentStreamProfileId === profileId) {
    currentStreamProfileId = profiles.length > 0 ? profiles[0].id : null;
  }

  return { success: true };
}

function setCurrentStreamProfile(profileId) {
  currentStreamProfileId = profileId;
  return { success: true, currentProfileId: profileId };
}

function getCurrentStreamProfile(userId) {
  if (!currentStreamProfileId) return null;
  const profiles = getUserStreamProfiles(userId);
  return profiles.find(p => p.id === currentStreamProfileId) || null;
}

function getDefaultOverlaySettings() {
  return {
    theme: "dark",
    position: "top-right",
    animation: "slide",
    fontSize: 14,
    showAvatar: true,
    showUsername: true,
    showGiftImage: true,
    duration: 5,
  };
}

function getDefaultAlertsSettings() {
  return {
    gift: { enabled: true, minCoins: 0, duration: 5, sound: "", color: "#e0306a" },
    follow: { enabled: true, duration: 4, sound: "", color: "#4e7bff" },
    like: { enabled: false, minCount: 100, duration: 3, sound: "", color: "#e0306a" },
    share: { enabled: true, duration: 4, sound: "", color: "#3ecf8e" },
    comment: { enabled: false, keyword: "", duration: 4, sound: "", color: "#f0a020" },
    subscribe: { enabled: true, duration: 5, sound: "", color: "#a855f7" },
  };
}

function exportStreamProfile(userId, profileId) {
  const profiles = getUserStreamProfiles(userId);
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return { success: false, error: "Profile tidak ditemukan" };
  return { success: true, profile };
}

function importStreamProfile(userId, profileData) {
  const { id, createdAt, updatedAt, ...data } = profileData;
  return createStreamProfile(userId, data);
}

// ══ Initialize ═══════════════════════════════════════
function initAuth() {
  loadSession();

  const session = validateLocalSession();
  if (session.valid) {
    console.log("[AUTH] Valid session restored");
  } else {
    console.log("[AUTH] No valid session, user needs to login");
  }
}

module.exports = {
  initAuth,
  registerEmail,
  loginEmail,
  loginGoogle,
  logout,
  getCurrentUser,
  getCurrentUserSync,
  validateSession,
  createSession: createLocalSession,
  clearSession,

  // Stream Profiles (local — unchanged)
  getProfileLimit,
  getUserStreamProfiles,
  createStreamProfile,
  updateStreamProfile,
  deleteStreamProfile,
  setCurrentStreamProfile,
  getCurrentStreamProfile,
  exportStreamProfile,
  importStreamProfile,

  // Constants
  PROFILE_LIMITS,
};
