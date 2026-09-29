// ═══════════════════════════════════════════════
// RosaeFinity Points System
// ═══════════════════════════════════════════════

const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const POINTS_FILE = path.join(DATA_DIR, "points-users.json");
const CONFIG_FILE = path.join(DATA_DIR, "points-config.json");

// ══ Internal State ═══════════════════════════
let users = {};         // { "username": { points, level, name, firstSeen, lastSeen } }
let config = {          // fallback defaults
  currencyName: "Points",
  pointsGift: 3,
  pointsLike: 1,
  pointsFollow: 5,
  pointsComment: 1,
  pointsShare: 2,
  pointsSubscribe: 10,
  subBonus: 0,
  levelPoints: 50,
  levelMultiplier: 1.03,
};
let challengeActive = false;

// ══ Init ════════════════════════════════════
function initPointsSystem() {
  ensureDataDir();
  loadUsers();
  loadConfig();
  challengeActive = !!localStorageGet("rosaefinity_points_challenge");
  console.log(`[POINTS] System initialized — ${Object.keys(users).length} users tracked`);
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ══ User Data Persistence ══════════════════
function loadUsers() {
  try {
    if (fs.existsSync(POINTS_FILE)) {
      users = JSON.parse(fs.readFileSync(POINTS_FILE, "utf-8"));
    }
  } catch (e) {
    console.error("[POINTS] Error loading users:", e.message);
    users = {};
  }
}

function saveUsers() {
  try {
    ensureDataDir();
    fs.writeFileSync(POINTS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (e) {
    console.error("[POINTS] Error saving users:", e.message);
  }
}

// ══ Config Load/Save ═══════════════════════
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      config = { ...config, ...saved };
    } else {
      // Try to read from localStorage-set config (passed from renderer)
      syncConfigFromSetup();
    }
  } catch (e) {
    console.error("[POINTS] Error loading config:", e.message);
    syncConfigFromSetup();
  }
}

function saveConfig() {
  try {
    ensureDataDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
  } catch (e) {
    console.error("[POINTS] Error saving config:", e.message);
  }
}

// Sync config passed from Setup page (via IPC)
function syncConfigFromSetup(setupData) {
  if (setupData) {
    config.currencyName  = setupData.currencyName || "Points";
    config.pointsGift    = setupData.pointsGift || 3;
    config.pointsLike    = setupData.pointsLike || 1;
    config.pointsFollow  = setupData.pointsFollow || 5;
    config.pointsComment = setupData.pointsComment || 1;
    config.pointsShare   = setupData.pointsShare || 2;
    config.pointsSubscribe = setupData.pointsSubscribe || 10;
    config.subBonus      = setupData.subBonus || 0;
    config.levelPoints   = setupData.levelPoints || 50;
    config.levelMultiplier = setupData.levelMultiplier || 1.03;
    saveConfig();
    return true;
  }
  return false;
}

// ══ Points Operations ═══════════════════════
function ensureUser(username, nickname) {
  const key = (username || "").toLowerCase().trim();
  if (!key) return null;
  if (!users[key]) {
    users[key] = {
      name: nickname || username,
      points: 0,
      level: 1,
      bonusPoints: 0,
      firstSeen: Date.now(),
      lastSeen: Date.now(),
      giftCount: 0,
      likeCount: 0,
      followCount: 0,
      commentCount: 0,
      shareCount: 0,
      totalSpent: 0,
    };
  } else {
    users[key].lastSeen = Date.now();
    if (nickname && !users[key].name) users[key].name = nickname;
  }
  return users[key];
}

function awardPoints(type, username, nickname, isSubscriber = false) {
  if (challengeActive) return { points: 0, total: 0, level: 1, reason: "Challenge mode active" };

  let earned = 0;
  switch (type) {
    case "gift":    earned = config.pointsGift; break;
    case "like":    earned = config.pointsLike; break;
    case "follow":  earned = config.pointsFollow; break;
    case "comment": earned = config.pointsComment; break;
    case "share":   earned = config.pointsShare; break;
    case "subscribe": earned = config.pointsSubscribe; break;
    default: return { points: 0, total: 0, level: 1 };
  }

  // Subscriber bonus
  if (isSubscriber && config.subBonus > 0) {
    const bonus = Math.round(earned * (config.subBonus / 100));
    earned += bonus;
  }

  const user = ensureUser(username, nickname);
  if (!user) return { points: 0, total: 0, level: 1 };

  user.points += earned;
  user.bonusPoints = (user.bonusPoints || 0) + (isSubscriber && config.subBonus > 0 ? Math.round(earned * (config.subBonus / 100)) : 0);
  user.lastSeen = Date.now();

  // Track event counts
  if (type === "gift")    user.giftCount = (user.giftCount || 0) + 1;
  if (type === "like")    user.likeCount = (user.likeCount || 0) + 1;
  if (type === "follow")  user.followCount = (user.followCount || 0) + 1;
  if (type === "comment") user.commentCount = (user.commentCount || 0) + 1;
  if (type === "share")   user.shareCount = (user.shareCount || 0) + 1;

  // Calculate new level
  const newLevel = calculateLevel(user.points);
  const leveledUp = newLevel > user.level;
  user.level = newLevel;

  saveUsers();
  return { points: earned, total: user.points, level: user.level, leveledUp, bonusPoints: earned - (type === "gift" ? config.pointsGift : config.pointsLike) };
}

// ══ Deduct Points (for Spotify commands, etc.) ══
function deductPoints(username, amount) {
  if (challengeActive) return { success: false, points: 0, total: 0, reason: "Challenge mode active" };

  const user = getUser(username);
  if (!user) return { success: false, points: 0, total: 0, reason: "User not found" };
  if (user.points < amount) return { success: false, points: 0, total: user.points, reason: "Insufficient points" };

  user.points -= amount;
  user.level = calculateLevel(user.points);
  user.lastSeen = Date.now();
  saveUsers();

  return { success: true, deducted: amount, total: user.points, level: user.level };
}

function calculateLevel(totalPoints) {
  const base = config.levelPoints || 50;
  const mult = config.levelMultiplier || 1.03;
  let level = 1;
  let required = base;
  let cumulative = 0;

  while (cumulative + required <= totalPoints) {
    cumulative += required;
    level++;
    required = Math.round(base * Math.pow(mult, level - 1));
    if (level > 100) break; // safety cap
  }
  return level;
}

function getLevelForPoints(points) {
  return calculateLevel(points);
}

function getPointsForLevel(level) {
  const base = config.levelPoints || 50;
  const mult = config.levelMultiplier || 1.03;
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += Math.round(base * Math.pow(mult, i - 1));
  }
  return total;
}

// ══ Query Functions ═════════════════════════
function getAllUsers() {
  return users;
}

function getUser(username) {
  const key = (username || "").toLowerCase().trim();
  return users[key] || null;
}

function getUserPoints(username) {
  const user = getUser(username);
  return user ? user.points : 0;
}

function getUserLevel(username) {
  const user = getUser(username);
  return user ? user.level : 1;
}

function getTopUsers(limit = 10) {
  return Object.entries(users)
    .sort(([, a], [, b]) => b.points - a.points)
    .slice(0, limit)
    .map(([key, val]) => ({ username: key, ...val }));
}

function getUserCount() {
  return Object.keys(users).length;
}

// ══ Reset Functions ═════════════════════════
function resetAllPoints() {
  Object.keys(users).forEach(key => {
    users[key].points = 0;
    users[key].level = 1;
    users[key].bonusPoints = 0;
  });
  saveUsers();
  return true;
}

function halvePoints(percent = 50) {
  const ratio = Math.max(0, Math.min(100, percent)) / 100;
  Object.keys(users).forEach(key => {
    users[key].points = Math.round(users[key].points * (1 - ratio));
    users[key].level = calculateLevel(users[key].points);
  });
  saveUsers();
  return true;
}

function toggleChallenge(active) {
  challengeActive = active;
  if (active) {
    localStorageSet("rosaefinity_points_challenge", "active");
  } else {
    localStorageRemove("rosaefinity_points_challenge");
  }
}

// ══ Clear All Points Data (for account isolation on logout) ══
function clearAllPoints() {
  users = {};
  challengeActive = false;
  localStorageRemove("rosaefinity_points_challenge");
  saveUsers();
  console.log("[POINTS] All points data cleared for account isolation");
}

// ══ Helper: IPC-safe localStorage access ═════
// (fallback for when fs is used directly)
function localStorageGet(key) {
  try {
    const f = path.join(DATA_DIR, "_localstorage.json");
    if (fs.existsSync(f)) {
      const all = JSON.parse(fs.readFileSync(f, "utf-8"));
      return all[key];
    }
  } catch (_) {}
  return null;
}

function localStorageSet(key, val) {
  try {
    ensureDataDir();
    const f = path.join(DATA_DIR, "_localstorage.json");
    let all = {};
    if (fs.existsSync(f)) all = JSON.parse(fs.readFileSync(f, "utf-8"));
    all[key] = val;
    fs.writeFileSync(f, JSON.stringify(all, null, 2), "utf-8");
  } catch (_) {}
}

function localStorageRemove(key) {
  try {
    const f = path.join(DATA_DIR, "_localstorage.json");
    if (fs.existsSync(f)) {
      let all = JSON.parse(fs.readFileSync(f, "utf-8"));
      delete all[key];
      fs.writeFileSync(f, JSON.stringify(all, null, 2), "utf-8");
    }
  } catch (_) {}
}

module.exports = {
  initPointsSystem,
  syncConfigFromSetup,
  awardPoints,
  deductPoints,
  calculateLevel,
  getLevelForPoints,
  getPointsForLevel,
  getAllUsers,
  getUser,
  getUserPoints,
  getUserLevel,
  getTopUsers,
  getUserCount,
  resetAllPoints,
  halvePoints,
  toggleChallenge,
  clearAllPoints,
  saveUsers,
  loadConfig,
  saveConfig,
  get config() { return config; },
  get users() { return users; },
  get challengeActive() { return challengeActive; },
};
