// ═══════════════════════════════════════════════
// RosaeFinity Authentication System
// Supports: Google OAuth, Email/Password, Session Management
// ═══════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "data");
const AUTH_FILE = path.join(DATA_DIR, "auth.json");
const SESSION_FILE = path.join(DATA_DIR, "session.json");
const STREAM_PROFILES_FILE = path.join(DATA_DIR, "stream-profiles.json");

// ══ Stream Profile Limits ══════════════════════════
const PROFILE_LIMITS = {
  free: 1,   // Free plan: 1 stream profile
  pro: 10,   // Pro plan: 10 stream profiles
};

// ══ Internal State ═════════════════════════════════
let authData = {
  users: {},           // { email: { id, email, passwordHash, name, avatar, provider, createdAt, lastLogin } }
  currentUser: null,   // Currently logged in user email
};

let sessionData = {
  token: null,
  userId: null,
  expiresAt: null,
  rememberMe: false,
};

let streamProfiles = {}; // { userId: [ { id, name, tiktokUsername, overlaySettings, alertsSettings, actions, createdAt, updatedAt } ] }

let currentStreamProfileId = null;

// ══ Helpers ══════════════════════════════════════════
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(":");
  const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return hash === verifyHash;
}

function generateToken() {
  return crypto.randomBytes(32).toString("hex");
}

function generateUserId() {
  return "usr_" + crypto.randomBytes(12).toString("hex");
}

function generateProfileId() {
  return "spf_" + crypto.randomBytes(12).toString("hex");
}

// ══ Persistence ══════════════════════════════════════
function loadAuth() {
  try {
    ensureDataDir();
    if (fs.existsSync(AUTH_FILE)) {
      authData = JSON.parse(fs.readFileSync(AUTH_FILE, "utf-8"));
    }
    if (fs.existsSync(SESSION_FILE)) {
      sessionData = JSON.parse(fs.readFileSync(SESSION_FILE, "utf-8"));
    }
    if (fs.existsSync(STREAM_PROFILES_FILE)) {
      streamProfiles = JSON.parse(fs.readFileSync(STREAM_PROFILES_FILE, "utf-8"));
    }
    console.log("[AUTH] Auth data loaded");
  } catch (e) {
    console.error("[AUTH] Error loading:", e.message);
  }
}

function saveAuth() {
  try {
    ensureDataDir();
    fs.writeFileSync(AUTH_FILE, JSON.stringify(authData, null, 2), "utf-8");
  } catch (e) {
    console.error("[AUTH] Error saving auth:", e.message);
  }
}

function saveSession() {
  try {
    ensureDataDir();
    fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), "utf-8");
  } catch (e) {
    console.error("[AUTH] Error saving session:", e.message);
  }
}

function saveStreamProfiles() {
  try {
    ensureDataDir();
    fs.writeFileSync(STREAM_PROFILES_FILE, JSON.stringify(streamProfiles, null, 2), "utf-8");
  } catch (e) {
    console.error("[AUTH] Error saving stream profiles:", e.message);
  }
}

// ══ Session Management ═══════════════════════════════
function createSession(userId, rememberMe = false) {
  const token = generateToken();
  const expiresAt = rememberMe
    ? Date.now() + 30 * 24 * 60 * 60 * 1000  // 30 days
    : Date.now() + 24 * 60 * 60 * 1000;       // 1 day

  sessionData = {
    token,
    userId,
    expiresAt,
    rememberMe,
  };
  saveSession();
  return { token, expiresAt };
}

function validateSession() {
  if (!sessionData.token || !sessionData.userId || !sessionData.expiresAt) {
    return { valid: false };
  }
  if (Date.now() > sessionData.expiresAt) {
    clearSession();
    return { valid: false, reason: "expired" };
  }
  return { valid: true, userId: sessionData.userId, token: sessionData.token };
}

function clearSession() {
  sessionData = { token: null, userId: null, expiresAt: null, rememberMe: false };
  saveSession();
  authData.currentUser = null;
  saveAuth();
}

function getCurrentUser() {
  const session = validateSession();
  if (!session.valid) return null;
  const user = Object.values(authData.users).find(u => u.id === session.userId);
  return user || null;
}

// ══ User Registration & Login ═════════════════════════
function registerEmail(email, password, name) {
  const normalizedEmail = email.toLowerCase().trim();
  
  if (!normalizedEmail.includes("@")) {
    return { success: false, error: "Email tidak valid" };
  }
  if (password.length < 6) {
    return { success: false, error: "Password minimal 6 karakter" };
  }
  if (authData.users[normalizedEmail]) {
    return { success: false, error: "Email sudah terdaftar" };
  }

  const userId = generateUserId();
  const passwordHash = hashPassword(password);
  
  const user = {
    id: userId,
    email: normalizedEmail,
    passwordHash,
    name: name || normalizedEmail.split("@")[0],
    avatar: null,
    provider: "email",
    createdAt: Date.now(),
    lastLogin: Date.now(),
  };

  authData.users[normalizedEmail] = user;
  authData.currentUser = normalizedEmail;
  saveAuth();

  const session = createSession(userId, false);
  return { success: true, user, session };
}

function loginEmail(email, password, rememberMe = false) {
  const normalizedEmail = email.toLowerCase().trim();
  const user = authData.users[normalizedEmail];

  if (!user) {
    return { success: false, error: "Email tidak ditemukan" };
  }
  if (user.provider !== "email") {
    return { success: false, error: `Akun ini menggunakan login ${user.provider}. Gunakan tombol ${user.provider}.` };
  }
  if (!verifyPassword(password, user.passwordHash)) {
    return { success: false, error: "Password salah" };
  }

  user.lastLogin = Date.now();
  authData.currentUser = normalizedEmail;
  saveAuth();

  const session = createSession(user.id, rememberMe);
  return { success: true, user, session };
}

function loginGoogle(googleData) {
  // googleData: { id, email, name, picture, accessToken }
  const normalizedEmail = googleData.email.toLowerCase().trim();
  
  let user = authData.users[normalizedEmail];
  const isNewUser = !user;

  if (isNewUser) {
    user = {
      id: generateUserId(),
      email: normalizedEmail,
      passwordHash: null,
      name: googleData.name,
      avatar: googleData.picture,
      provider: "google",
      googleId: googleData.id,
      accessToken: googleData.accessToken,
      createdAt: Date.now(),
      lastLogin: Date.now(),
    };
    authData.users[normalizedEmail] = user;
  } else {
    // Update existing user with Google data
    user.name = googleData.name;
    user.avatar = googleData.picture;
    user.provider = "google";
    user.googleId = googleData.id;
    user.accessToken = googleData.accessToken;
    user.lastLogin = Date.now();
  }

  authData.currentUser = normalizedEmail;
  saveAuth();

  const session = createSession(user.id, true); // Google login = remember me
  return { success: true, user, session, isNewUser };
}

function logout() {
  clearSession();
  return { success: true };
}

// ══ Stream Profiles ═══════════════════════════════════
function getProfileLimit(userId) {
  // Check user's plan (Free/Pro) - integrate with license system
  const user = Object.values(authData.users).find(u => u.id === userId);
  if (!user) return PROFILE_LIMITS.free;
  
  // For now, check license system
  // In production, this would come from license-system.js
  // For simplicity, we'll use a user property or check license
  // Default to free
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

  // If this is the first profile, set as current
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

  // If deleted profile was current, switch to first available
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

// ══ Profile Data Export/Import ════════════════════════
function exportStreamProfile(userId, profileId) {
  const profiles = getUserStreamProfiles(userId);
  const profile = profiles.find(p => p.id === profileId);
  if (!profile) return { success: false, error: "Profile tidak ditemukan" };
  return { success: true, profile };
}

function importStreamProfile(userId, profileData) {
  // Remove ID to create new profile
  const { id, createdAt, updatedAt, ...data } = profileData;
  return createStreamProfile(userId, data);
}

// ══ Initialize ═══════════════════════════════════════
function initAuth() {
  loadAuth();
  
  // Validate existing session on startup
  const session = validateSession();
  if (session.valid) {
    console.log("[AUTH] ✅ Valid session restored for user:", session.userId);
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
  validateSession,
  createSession,
  clearSession,
  
  // Stream Profiles
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
