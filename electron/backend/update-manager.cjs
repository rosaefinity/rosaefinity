// =============================================
// RosaeFinity — Auto Update Manager
// Uses electron-updater for production auto-updates.
// Only active in production builds; no-ops in development.
//
// Event contract (preload listens to these exact channels):
//   update:status            string  — idle|checking|available|not-available|
//                                      downloading|downloaded|installing|error|cancelled
//   update:available         { version, releaseDate?, releaseNotes? }
//   update:not-available     { version }
//   update:downloading       { version? }          (alias of status downloading)
//   update:progress          { percent, bytesPerSecond, transferred, total }
//   update:downloaded        { version, releaseDate?, releaseNotes? }
//   update:error             { message, code? }
//   update:release-notes     string
// =============================================

const { autoUpdater, CancellationToken } = require('electron-updater');
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const log = require('electron-log');

// Configure logging
autoUpdater.logger = log;
try {
  autoUpdater.logger.transports.file.level = 'info';
} catch (_) { /* transports may be unavailable in tests */ }

// ── State ──────────────────────────────────
let mainWindow = null;
let isChecking = false;
let isInitialized = false;
let downloadCancellationToken = null;
let downloadGeneration = 0;
let activeDownloadAttempt = null;
let downloadDrainTimer = null;
let downloadRecoveryTimer = null;

// Untagged updater events cannot prove quiescence. These windows are only
// conservative recovery policies, not proof that old events have stopped.
const DOWNLOAD_EVENT_DRAIN_MS = 1500;
const DOWNLOAD_RECOVERY_TIMEOUT_MS = 30000;

/** Canonical channels — must match src/services/update/types.ts + UpdatePage */
const VALID_CHANNELS = new Set(['stable', 'beta', 'nightly']);

const DEFAULT_PREFERENCES = {
  channel: 'stable',
  autoCheck: true,
  autoDownload: false, // consent: user must click Download
  checkIntervalHours: 4,
  silent: false, // consent: never silent-install by default
};

let preferences = { ...DEFAULT_PREFERENCES };
let ignoredVersions = [];
let lastCheckedAt = null;
let currentUpdateInfo = null;
let currentProgress = null;
let lastError = null;

/** Authoritative status shared by live events and update:get-info */
let currentStatus = 'idle';

function isDev() {
  return (
    process.env.NODE_ENV === 'development' ||
    process.argv.includes('--dev') ||
    process.env.RF_UPDATER_DISABLED === '1'
  );
}

function sanitizeChannel(value) {
  if (value === 'dev') return 'nightly'; // legacy alias
  return VALID_CHANNELS.has(value) ? value : 'stable';
}

function sanitizePreferences(raw) {
  const prefs = { ...DEFAULT_PREFERENCES };
  if (!raw || typeof raw !== 'object') return prefs;
  prefs.channel = sanitizeChannel(raw.channel);
  prefs.autoCheck = raw.autoCheck !== false;
  prefs.autoDownload = raw.autoDownload === true; // default false
  const hours = Number(raw.checkIntervalHours);
  prefs.checkIntervalHours = Number.isFinite(hours) && hours > 0 ? hours : 4;
  prefs.silent = raw.silent === true; // default false
  return prefs;
}

function sanitizeIgnored(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v) => typeof v === 'string' && v.length > 0);
}

// ── Persistence (userData/update-prefs.json) ──
function prefsFilePath() {
  try {
    return path.join(app.getPath('userData'), 'update-prefs.json');
  } catch (_) {
    return null;
  }
}

function loadPersistedPrefs() {
  const file = prefsFilePath();
  if (!file) return;
  try {
    if (!fs.existsSync(file)) return;
    const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
    preferences = sanitizePreferences(raw?.preferences ?? raw);
    ignoredVersions = sanitizeIgnored(raw?.ignoredVersions);
    log.info('[UPDATE] Loaded preferences from', file);
  } catch (err) {
    log.warn('[UPDATE] Corrupt update-prefs.json — using defaults', err.message);
    preferences = { ...DEFAULT_PREFERENCES };
    ignoredVersions = [];
  }
}

function persistPrefs() {
  const file = prefsFilePath();
  if (!file) return;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({ preferences, ignoredVersions }, null, 2),
      'utf8',
    );
  } catch (err) {
    log.warn('[UPDATE] Failed to persist preferences', err.message);
  }
}

// ── Authoritative state transitions ──
function setStatus(status, extra = {}) {
  currentStatus = status;
  if (extra.progress !== undefined) currentProgress = extra.progress;
  if (extra.info !== undefined) currentUpdateInfo = extra.info;
  if (extra.latestVersion !== undefined) {
    // latestVersion derived from info when present
  }
  if (extra.error !== undefined) lastError = extra.error;
  if (extra.releaseNotes !== undefined && currentUpdateInfo) {
    currentUpdateInfo = { ...currentUpdateInfo, releaseNotes: extra.releaseNotes };
  }
  sendToRenderer('status', currentStatus);
}

function getLatestVersion() {
  return currentUpdateInfo?.version || null;
}

function isIgnoredVersion(version) {
  return typeof version === 'string' && ignoredVersions.includes(version);
}

function applyAvailable(info) {
  if (isIgnoredVersion(info?.version)) {
    log.info('[UPDATE] Ignoring version', info.version);
    currentUpdateInfo = null;
    setStatus('not-available');
    sendToRenderer('not-available', { version: info.version });
    return false;
  }
  currentUpdateInfo = {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes || '',
  };
  lastCheckedAt = Date.now();
  lastError = null;
  setStatus('available', { info: currentUpdateInfo });
  sendToRenderer('available', currentUpdateInfo);
  if (currentUpdateInfo.releaseNotes) {
    sendToRenderer('release-notes', currentUpdateInfo.releaseNotes);
  }
}

function canApplyDownloadEvent(states = ['downloading']) {
  return (
    activeDownloadAttempt &&
    activeDownloadAttempt.generation === downloadGeneration &&
    states.includes(activeDownloadAttempt.state)
  );
}

function completeActiveDownloadAttempt(state, generation = downloadGeneration) {
  if (activeDownloadAttempt?.generation === generation) {
    activeDownloadAttempt.state = state;
  }
}

function beginDownloadErrorRecovery(generation) {
  if (activeDownloadAttempt?.generation !== generation) return;
  activeDownloadAttempt.state = 'failed';
  if (downloadRecoveryTimer) clearTimeout(downloadRecoveryTimer);
  downloadRecoveryTimer = setTimeout(() => {
    if (activeDownloadAttempt?.generation === generation && activeDownloadAttempt.state === 'failed') {
      beginDownloadDrain(generation);
    }
    downloadRecoveryTimer = null;
  }, DOWNLOAD_RECOVERY_TIMEOUT_MS);
}

function clearDownloadTimers() {
  if (downloadDrainTimer) clearTimeout(downloadDrainTimer);
  if (downloadRecoveryTimer) clearTimeout(downloadRecoveryTimer);
  downloadDrainTimer = null;
  downloadRecoveryTimer = null;
}

function beginDownloadDrain(generation) {
  if (activeDownloadAttempt?.generation !== generation) return;
  activeDownloadAttempt.state = 'draining';
  if (downloadDrainTimer) clearTimeout(downloadDrainTimer);
  downloadDrainTimer = setTimeout(() => {
    if (activeDownloadAttempt?.generation === generation) {
      activeDownloadAttempt = null;
    }
    downloadDrainTimer = null;
  }, DOWNLOAD_EVENT_DRAIN_MS);
}

function isDownloadUnavailable() {
  return ['cancelling', 'failed', 'completed', 'draining'].includes(activeDownloadAttempt?.state);
}

function isDownloadActive() {
  return canApplyDownloadEvent(['downloading', 'awaiting-downloaded-event']);
}

function retryUnavailableResult() {
  return {
    success: false,
    error: 'Download retry is temporarily unavailable while the updater finishes cancelling. Try again in a moment.',
  };
}

function applyProgress(progress, allowUnowned = false) {
  if (!allowUnowned && !canApplyDownloadEvent()) return;
  currentProgress = {
    percent: progress.percent,
    bytesPerSecond: progress.bytesPerSecond,
    transferred: progress.transferred,
    total: progress.total,
  };
  if (currentStatus !== 'downloading') {
    currentStatus = 'downloading';
    sendToRenderer('status', currentStatus);
    sendToRenderer('downloading', { version: getLatestVersion() });
  }
  sendToRenderer('progress', currentProgress);
}

function applyDownloaded(info, allowUnowned = false) {
  if (!allowUnowned && !canApplyDownloadEvent(['downloading', 'awaiting-downloaded-event'])) return;
  if (!allowUnowned) completeActiveDownloadAttempt('completed');
  currentUpdateInfo = {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes || '',
  };
  currentProgress = null;
  lastCheckedAt = Date.now();
  lastError = null;
  setStatus('downloaded', { info: currentUpdateInfo, progress: null });
  sendToRenderer('downloaded', currentUpdateInfo);
  if (currentUpdateInfo.releaseNotes) {
    sendToRenderer('release-notes', currentUpdateInfo.releaseNotes);
  }
  // Installation remains explicit through the update:install IPC handler.
}

function applyError(err, generation = downloadGeneration, fromUpdaterEvent = false) {
  const message = err?.message || String(err);
  const code = err?.code;
  // Cancellation is finalized by startDownload() using its token. A global
  // cancellation error has no attempt identity, so ignoring it prevents an
  // old attempt from cancelling a newer retry.
  if (/cancel/i.test(message) || code === 'ERR_CANCELED' || code === 'cancelled') {
    if (fromUpdaterEvent) return;
    applyCancelled(generation);
    return;
  }
  const hasActiveDownload = canApplyDownloadEvent(['downloading', 'awaiting-downloaded-event']);
  if (fromUpdaterEvent && activeDownloadAttempt && !hasActiveDownload) return;
  if (hasActiveDownload) {
    if (fromUpdaterEvent) {
      beginDownloadErrorRecovery(generation);
    } else {
      completeActiveDownloadAttempt('failed', generation);
    }
  }
  lastError = message;
  currentProgress = null;
  setStatus('error', { error: message, progress: null });
  sendToRenderer('error', { message, code });
}

function applyCancelled(generation = downloadGeneration) {
  if (generation !== downloadGeneration) return;
  completeActiveDownloadAttempt('cancelled', generation);
  downloadCancellationToken = null;
  currentProgress = null;
  lastError = null;
  // Safe idle/available after cancel — user can download again
  const next = currentUpdateInfo ? 'available' : 'idle';
  setStatus(next, { progress: null });
  sendToRenderer('status', next);
}

function toUpdaterChannel(channel) {
  const ch = sanitizeChannel(channel);
  if (ch === 'beta') return 'beta';
  if (ch === 'nightly') return 'nightly';
  return null; // stable → electron-updater default (latest)
}

// ── Initialize ──
function init(mainWindowRef) {
  mainWindow = mainWindowRef;
  if (isInitialized) return;
  isInitialized = true;

  loadPersistedPrefs();

  if (isDev()) {
    log.info('[UPDATE] Development mode — auto-update disabled (no provider calls)');
    // Still register IPC below for get-info / debug-inject / prefs
    return;
  }

  // Downloads are owned by startDownload() so ignored versions and retries are gated once.
  autoUpdater.autoDownload = false;
  const ch = toUpdaterChannel(preferences.channel);
  if (ch) autoUpdater.channel = ch;

  autoUpdater.on('checking-for-update', () => {
    log.info('[UPDATE] Checking for update...');
    setStatus('checking');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('[UPDATE] Update available:', info.version);
    applyAvailable(info);
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('[UPDATE] No update available. Current:', app.getVersion(), 'Latest:', info?.version);
    lastCheckedAt = Date.now();
    lastError = null;
    currentProgress = null;
    setStatus('not-available');
    sendToRenderer('not-available', { version: info?.version || app.getVersion() });
  });

  autoUpdater.on('download-progress', (progress) => {
    if (!canApplyDownloadEvent()) return;
    applyProgress(progress);
    log.info(`[UPDATE] Download progress: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    if (!canApplyDownloadEvent(['downloading', 'awaiting-downloaded-event'])) return;
    log.info('[UPDATE] Update downloaded:', info.version);
    applyDownloaded(info);
  });

  autoUpdater.on('error', (err) => {
    log.error('[UPDATE] Error:', err);
    applyError(err, downloadGeneration, true);
  });

  if (preferences.autoCheck) {
    scheduleAutoCheck();
  }

  log.info('[UPDATE] Auto-update manager initialized. Version:', app.getVersion(), 'Channel:', preferences.channel);
}

async function startDownload() {
  if (isDev()) {
    return { success: false, error: 'Updates disabled in development' };
  }
  if (isDownloadUnavailable()) {
    return retryUnavailableResult();
  }
  if (isDownloadActive() || currentStatus === 'downloading') {
    return { success: false, error: 'Download already in progress' };
  }
  if (isIgnoredVersion(currentUpdateInfo?.version)) {
    return { success: false, error: 'Update version is ignored' };
  }
  if (!currentUpdateInfo && currentStatus !== 'available' && currentStatus !== 'downloaded') {
    // Allow download after available; if only idle, still try check first via electron-updater
  }
  const token = new CancellationToken();
  const generation = downloadGeneration + 1;
  downloadGeneration = generation;
  try {
    downloadCancellationToken = token;
    activeDownloadAttempt = { generation, state: 'downloading' };
    setStatus('downloading', { progress: currentProgress ?? null });
    sendToRenderer('downloading', { version: getLatestVersion() });
    await autoUpdater.downloadUpdate(token);
    if (generation === downloadGeneration) {
      downloadCancellationToken = null;
      if (activeDownloadAttempt?.generation === generation && activeDownloadAttempt.state === 'downloading') {
        // Some updater versions emit update-downloaded separately. Keep this
        // generation as the only event owner until that event completes it.
        activeDownloadAttempt.state = 'awaiting-downloaded-event';
      }
      if (activeDownloadAttempt?.generation === generation && activeDownloadAttempt.state === 'completed') {
        beginDownloadDrain(generation);
      }
    }
    return { success: true };
  } catch (err) {
    if (token.isCancelled) {
      applyCancelled(generation);
      beginDownloadDrain(generation);
      return { success: false, error: 'Download cancelled' };
    }
    if (generation !== downloadGeneration) {
      return { success: false, error: 'Download superseded' };
    }
    downloadCancellationToken = null;
    applyError(err);
    beginDownloadDrain(generation);
    return { success: false, error: err.message };
  }
}

async function cancelDownload() {
  const token = downloadCancellationToken;
  const generation = downloadGeneration;
  if (!token) {
    // Nothing downloading — safe no-op
    return { success: true, cancelled: false, draining: isDownloadUnavailable() };
  }
  try {
    token.cancel();
  } catch (err) {
    log.warn('[UPDATE] cancel threw', err.message);
  }
  if (generation === downloadGeneration && downloadCancellationToken === token) {
    downloadCancellationToken = null;
    if (activeDownloadAttempt?.generation === generation) {
      activeDownloadAttempt.state = 'cancelling';
    }
    currentProgress = null;
    const next = currentUpdateInfo ? 'available' : 'idle';
    setStatus(next, { progress: null });
  }
  return { success: true, cancelled: true, draining: true };
}

// ── IPC Handlers ──
function registerIPC() {
  ipcMain.handle('update:check', async (_event, opts) => {
    if (isDev()) {
      return { success: false, error: 'Updates disabled in development' };
    }
    if (isChecking) return { success: false, error: 'Already checking' };
    isChecking = true;
    try {
      // Respect ignored versions
      const pending = await autoUpdater.checkForUpdates();
      const version = pending?.updateInfo?.version;
      if (isIgnoredVersion(version)) {
        log.info('[UPDATE] Ignoring version', version);
        setStatus('not-available');
        sendToRenderer('not-available', { version });
        return { success: true, ignored: true, version };
      }
      // If updater resolved but no event yet, leave status to events;
      // if still idle after check, report not-available
      if (currentStatus === 'idle') {
        setStatus('not-available');
        sendToRenderer('not-available', { version: app.getVersion() });
      }
      return { success: true, status: currentStatus, version: getLatestVersion() };
    } catch (err) {
      applyError(err);
      return { success: false, error: err.message };
    } finally {
      isChecking = false;
      lastCheckedAt = Date.now();
    }
  });

  ipcMain.handle('update:download', async () => {
    if (isDev()) {
      return { success: false, error: 'Updates disabled in development' };
    }
    return startDownload();
  });

  ipcMain.handle('update:install', async () => {
    if (isDev()) {
      return { success: false, error: 'Updates disabled in development' };
    }
    if (currentStatus !== 'downloaded') {
      return { success: false, error: 'No update ready to install' };
    }
    try {
      setStatus('installing');
      autoUpdater.quitAndInstall();
      return { success: true };
    } catch (err) {
      applyError(err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('update:cancel', async () => {
    return cancelDownload();
  });

  ipcMain.handle('update:set-channel', async (_event, channel) => {
    preferences.channel = sanitizeChannel(channel);
    persistPrefs();
    if (!isDev()) {
      try {
        const ch = toUpdaterChannel(preferences.channel);
        autoUpdater.channel = ch;
      } catch (_) {}
    }
    return { success: true, channel: preferences.channel };
  });

  ipcMain.handle('update:set-preferences', async (_event, prefs) => {
    const incoming = sanitizePreferences({ ...preferences, ...(prefs || {}) });
    // Preserve channel if not provided in prefs payload
    if (prefs && prefs.channel !== undefined) {
      incoming.channel = sanitizeChannel(prefs.channel);
    } else {
      incoming.channel = preferences.channel;
    }
    preferences = incoming;
    persistPrefs();
    if (!isDev()) {
      try {
        // Downloads are owned by startDownload() so ignored versions and retries are gated once.
        autoUpdater.autoDownload = false;
        const ch = toUpdaterChannel(preferences.channel);
        autoUpdater.channel = ch;
      } catch (_) {}
      if (preferences.autoCheck) scheduleAutoCheck();
    }
    return { success: true, preferences };
  });

  ipcMain.handle('update:get-info', async () => {
    return {
      status: currentStatus,
      currentVersion: app.getVersion(),
      latestVersion: getLatestVersion(),
      channel: preferences.channel,
      progress: currentProgress,
      currentInfo: currentUpdateInfo,
      lastCheckedAt,
      error: lastError,
      releaseNotes: currentUpdateInfo?.releaseNotes || '',
    };
  });

  ipcMain.handle('update:get-preferences', async () => {
    return { ...preferences };
  });

  ipcMain.handle('update:skip-version', async (_event, version) => {
    if (typeof version === 'string' && version && !ignoredVersions.includes(version)) {
      ignoredVersions.push(version);
      persistPrefs();
    }
    return { success: true, ignoredVersions: [...ignoredVersions] };
  });

  ipcMain.handle('update:unskip-version', async (_event, version) => {
    ignoredVersions = ignoredVersions.filter((v) => v !== version);
    persistPrefs();
    return { success: true, ignoredVersions: [...ignoredVersions] };
  });

  ipcMain.handle('update:get-ignored', async () => {
    return [...ignoredVersions];
  });

  // Dev-only: inject mock update state for runtime UI verification.
  // Never contacts the production GitHub provider.
  ipcMain.handle('update:debug-inject', async (_event, payload) => {
    if (!isDev()) {
      return { success: false, error: 'debug-inject disabled outside development' };
    }
    const p = payload || {};
    if (p.kind === 'available') {
      applyAvailable({
        version: p.version || '9.9.9',
        releaseDate: p.releaseDate,
        releaseNotes: p.releaseNotes || 'Debug notes',
      });
    } else if (p.kind === 'progress') {
      applyProgress({
        percent: Number(p.percent) || 0,
        bytesPerSecond: Number(p.bytesPerSecond) || 0,
        transferred: Number(p.transferred) || 0,
        total: Number(p.total) || 100,
      }, true);
    } else if (p.kind === 'downloaded') {
      applyDownloaded({
        version: p.version || '9.9.9',
        releaseDate: p.releaseDate,
        releaseNotes: p.releaseNotes || 'Debug notes',
      }, true);
    } else if (p.kind === 'error') {
      applyError(new Error(p.message || 'Debug error'));
    } else if (p.kind === 'not-available') {
      lastCheckedAt = Date.now();
      lastError = null;
      currentProgress = null;
      setStatus('not-available', { error: null, progress: null });
      sendToRenderer('not-available', { version: app.getVersion() });
    } else if (p.kind === 'checking') {
      setStatus('checking');
    } else if (p.kind === 'reset') {
      currentStatus = 'idle';
      currentProgress = null;
      currentUpdateInfo = null;
      lastError = null;
      sendToRenderer('status', 'idle');
    } else if (p.kind === 'prefs') {
      preferences = sanitizePreferences(p.preferences);
      persistPrefs();
    } else if (p.kind === 'skip') {
      ignoredVersions = sanitizeIgnored(p.versions);
      persistPrefs();
    }
    return { success: true, status: currentStatus };
  });
}

// ── Helpers ──
function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Channel contract: update:status, update:available, … (NOT update:update-status)
    mainWindow.webContents.send(`update:${channel}`, data);
  }
}

let autoCheckTimer = null;
function scheduleAutoCheck() {
  if (autoCheckTimer) clearInterval(autoCheckTimer);
  if (!preferences.autoCheck || isDev()) return;

  const intervalMs = preferences.checkIntervalHours * 60 * 60 * 1000;
  autoCheckTimer = setInterval(() => {
    if (!isChecking && !isDev()) {
      autoUpdater.checkForUpdates().catch(() => {});
    }
  }, intervalMs);
}

function shutdown() {
  if (autoCheckTimer) clearInterval(autoCheckTimer);
  autoCheckTimer = null;
  clearDownloadTimers();
}

// Test helpers (not used by production UI)
function _getInternalState() {
  return {
    status: currentStatus,
    progress: currentProgress,
    preferences: { ...preferences },
    ignoredVersions: [...ignoredVersions],
    latestVersion: getLatestVersion(),
    currentInfo: currentUpdateInfo,
    lastError,
  };
}

/** Reset in-memory state so tests can re-init and reload from disk. */
function _resetForTests() {
  clearDownloadTimers();
  isInitialized = false;
  isChecking = false;
  downloadCancellationToken = null;
  downloadGeneration = 0;
  activeDownloadAttempt = null;
  preferences = { ...DEFAULT_PREFERENCES };
  ignoredVersions = [];
  lastCheckedAt = null;
  currentUpdateInfo = null;
  currentProgress = null;
  lastError = null;
  currentStatus = 'idle';
}

module.exports = {
  init,
  registerIPC,
  shutdown,
  // exported for tests
  _getInternalState,
  _resetForTests,
  _sanitizePreferences: sanitizePreferences,
  _sanitizeChannel: sanitizeChannel,
  _sanitizeIgnored: sanitizeIgnored,
  _toUpdaterChannel: toUpdaterChannel,
};
