// ═══════════════════════════════════════════════
// RosaeFinity License / Subscription System
// ═══════════════════════════════════════════════

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "data");
const LICENSE_FILE = path.join(DATA_DIR, "license.json");

// Plans
const PLANS = {
  FREE: "free",
  PRO: "pro",
};

const PLAN_LIMITS = {
  [PLANS.FREE]: { actions: 5, customSounds: 3, profiles: 1, overlayScreens: 2, maxPointsUsers: 2500 },
  [PLANS.PRO]:  { actions: Infinity, customSounds: Infinity, profiles: Infinity, overlayScreens: 8, maxPointsUsers: 100000 },
};

let licenseData = {
  plan: PLANS.FREE,
  activated: false,
  licenseKey: null,
  email: null,
  expiresAt: null,
  activatedAt: null,
};

function initLicense() {
  ensureDataDir();
  loadLicense();
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadLicense() {
  try {
    if (fs.existsSync(LICENSE_FILE)) {
      const saved = JSON.parse(fs.readFileSync(LICENSE_FILE, "utf-8"));
      licenseData = { ...licenseData, ...saved };
      console.log(`[LICENSE] Plan: ${licenseData.plan}${licenseData.activated ? ' (activated)' : ' (free)'}`);
    }
  } catch (e) {
    console.error("[LICENSE] Error loading:", e.message);
  }
}

function saveLicense() {
  try {
    ensureDataDir();
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(licenseData, null, 2), "utf-8");
  } catch (e) {
    console.error("[LICENSE] Error saving:", e.message);
  }
}

function getPlan() {
  return licenseData.plan;
}

function isPro() {
  return licenseData.plan === PLANS.PRO && licenseData.activated;
}

function getLimit(key) {
  const plan = isPro() ? PLANS.PRO : PLANS.FREE;
  return PLAN_LIMITS[plan][key] || Infinity;
}

function getPlanLimits() {
  return isPro() ? PLAN_LIMITS[PLANS.PRO] : PLAN_LIMITS[PLANS.FREE];
}

function activateLicense(key, email) {
  // In production: validate key against server
  // For now: accept any key format "ROSAE-XXXX-XXXX-XXXX"
  if (!key || typeof key !== "string") {
    return { success: false, error: "Invalid license key" };
  }

  const cleanKey = key.trim().toUpperCase();
  const keyPattern = /^ROSAE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

  if (!keyPattern.test(cleanKey)) {
    return { success: false, error: "Format key salah! Gunakan: ROSAE-XXXX-XXXX-XXXX" };
  }

  // Simple checksum validation
  const parts = cleanKey.split("-");
  const combined = parts.slice(1).join("");
  let checksum = 0;
  for (let i = 0; i < combined.length; i++) {
    checksum = (checksum + combined.charCodeAt(i)) % 100;
  }

  if (checksum % 2 !== 0) {
    return { success: false, error: "License key tidak valid" };
  }

  // Activate
  licenseData.plan = PLANS.PRO;
  licenseData.activated = true;
  licenseData.licenseKey = cleanKey;
  licenseData.email = email || null;
  licenseData.activatedAt = Date.now();
  licenseData.expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000; // 1 year

  saveLicense();
  console.log(`[LICENSE] ✅ Pro activated: ${cleanKey} (${email || 'no email'})`);

  return { success: true, plan: PLANS.PRO, expiresAt: licenseData.expiresAt };
}

function deactivateLicense() {
  licenseData = {
    plan: PLANS.FREE,
    activated: false,
    licenseKey: null,
    email: null,
    expiresAt: null,
    activatedAt: null,
  };
  saveLicense();
  console.log("[LICENSE] Deactivated — back to Free");
  return { success: true, plan: PLANS.FREE };
}

function checkLicense() {
  // Check if expired
  if (licenseData.expiresAt && Date.now() > licenseData.expiresAt) {
    console.log("[LICENSE] ⚠️ License expired");
    deactivateLicense();
    return { valid: false, plan: PLANS.FREE, reason: "expired" };
  }

  return {
    valid: licenseData.activated,
    plan: licenseData.plan,
    isPro: isPro(),
    limits: getPlanLimits(),
    licenseKey: licenseData.licenseKey ? maskKey(licenseData.licenseKey) : null,
    expiresAt: licenseData.expiresAt,
  };
}

function maskKey(key) {
  if (!key || key.length < 15) return null;
  return key.substring(0, 6) + "****" + key.substring(10);
}

function validateActionLimit(currentActionCount) {
  const limit = getLimit("actions");
  if (currentActionCount >= limit) {
    return {
      allowed: false,
      message: `🔒 Free plan dibatasi ${limit} actions. Upgrade ke Pro untuk unlimited!`,
      limit,
    };
  }
  return { allowed: true, message: null, limit };
}

function validateSoundLimit(currentSoundCount) {
  const limit = getLimit("customSounds");
  if (currentSoundCount >= limit) {
    return {
      allowed: false,
      message: `🔒 Free plan dibatasi ${limit} custom sounds. Upgrade ke Pro untuk unlimited!`,
      limit,
    };
  }
  return { allowed: true, message: null, limit };
}

function getUserData() {
  return {
    ...checkLicense(),
    userCount: 0,
    features: {
      unlimited: isPro(),
    },
  };
}

module.exports = {
  initLicense,
  getPlan,
  isPro,
  activateLicense,
  deactivateLicense,
  checkLicense,
  getLimit,
  getPlanLimits,
  validateActionLimit,
  validateSoundLimit,
  getUserData,
  PLANS,
  PLAN_LIMITS,
};
