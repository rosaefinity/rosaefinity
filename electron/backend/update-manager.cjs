// =============================================
// RosaeFinity — Auto Update Manager
// Uses electron-updater for production auto-updates.
// Only active in production builds; no-ops in development.
// =============================================

const { autoUpdater } = require('electron-updater');
const { app, BrowserWindow, ipcMain } = require('electron');
const log = require('electron-log');

// Configure logging
autoUpdater.logger = log;
autoUpdater.logger.transports.file.level = 'info';

// State
let mainWindow = null;
let isChecking = false;

// Preferences (persisted via IPC to renderer store)
let preferences = {
  channel: 'stable',
  autoCheck: true,
  autoDownload: false,
  checkIntervalHours: 4,
  silent: false,
};

let ignoredVersions = [];
let lastCheckedAt = null;
let currentUpdateInfo = null;

// ── Initialize ──

function init(mainWindowRef) {
  mainWindow = mainWindowRef;

  const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
  if (isDev) {
    log.info('[UPDATE] Development mode — auto-update disabled');
    return;
  }

  // Auto-updater events
  autoUpdater.on('checking-for-update', () => {
    log.info('[UPDATE] Checking for update...');
    sendToRenderer('update-status', 'checking');
  });

  autoUpdater.on('update-available', (info) => {
    log.info('[UPDATE] Update available:', info.version);
    currentUpdateInfo = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes || '',
    };
    sendToRenderer('update-available', currentUpdateInfo);
    sendToRenderer('update-release-notes', info.releaseNotes || '');

    if (preferences.autoDownload) {
      autoUpdater.downloadUpdate();
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    log.info('[UPDATE] No update available. Current:', app.getVersion(), 'Latest:', info?.version);
    lastCheckedAt = Date.now();
    sendToRenderer('update-not-available', { version: info?.version || app.getVersion() });
  });

  autoUpdater.on('download-progress', (progress) => {
    const p = {
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond,
      transferred: progress.transferred,
      total: progress.total,
    };
    sendToRenderer('update-progress', p);
    log.info(`[UPDATE] Download progress: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    log.info('[UPDATE] Update downloaded:', info.version);
    currentUpdateInfo = {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes || '',
    };
    lastCheckedAt = Date.now();
    sendToRenderer('update-downloaded', currentUpdateInfo);

    // Auto-install if silent mode
    if (preferences.silent) {
      autoUpdater.quitAndInstall();
    }
  });

  autoUpdater.on('error', (err) => {
    log.error('[UPDATE] Error:', err);
    sendToRenderer('update-error', { message: err.message, code: err.code });
  });

  // Schedule auto-check if enabled
  if (preferences.autoCheck) {
    scheduleAutoCheck();
  }

  log.info('[UPDATE] Auto-update manager initialized. Version:', app.getVersion());
}

// ── IPC Handlers ──

function registerIPC() {
  ipcMain.handle('update:check', async (_event, opts) => {
    if (isChecking) return { success: false, error: 'Already checking' };
    isChecking = true;
    try {
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    } finally {
      isChecking = false;
    }
  });

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('update:install', async () => {
    try {
      autoUpdater.quitAndInstall();
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('update:cancel', async () => {
    try {
      autoUpdater.autoDownload = false;
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('update:set-channel', async (_event, channel) => {
    preferences.channel = channel;
    autoUpdater.channel = channel;
    return { success: true };
  });

  ipcMain.handle('update:set-preferences', async (_event, prefs) => {
    preferences = { ...preferences, ...prefs };
    autoUpdater.autoDownload = preferences.autoDownload;
    autoUpdater.channel = preferences.channel;
    if (preferences.autoCheck) {
      scheduleAutoCheck();
    }
    return { success: true };
  });

  ipcMain.handle('update:get-info', async () => {
    return {
      status: currentUpdateInfo ? 'available' : 'idle',
      currentVersion: app.getVersion(),
      latestVersion: currentUpdateInfo?.version || null,
      channel: preferences.channel,
      progress: null,
      currentInfo: currentUpdateInfo,
      lastCheckedAt,
    };
  });

  ipcMain.handle('update:get-preferences', async () => {
    return preferences;
  });

  ipcMain.handle('update:skip-version', async (_event, version) => {
    if (!ignoredVersions.includes(version)) {
      ignoredVersions.push(version);
    }
    return { success: true };
  });

  ipcMain.handle('update:unskip-version', async (_event, version) => {
    ignoredVersions = ignoredVersions.filter(v => v !== version);
    return { success: true };
  });

  ipcMain.handle('update:get-ignored', async () => {
    return ignoredVersions;
  });
}

// ── Helpers ──

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(`update:${channel}`, data);
  }
}

let autoCheckTimer = null;
function scheduleAutoCheck() {
  if (autoCheckTimer) clearInterval(autoCheckTimer);
  if (!preferences.autoCheck) return;

  const intervalMs = preferences.checkIntervalHours * 60 * 60 * 1000;
  autoCheckTimer = setInterval(() => {
    if (!isChecking && !process.argv.includes('--dev')) {
      autoUpdater.checkForUpdates().catch(() => {});
    }
  }, intervalMs);
}

function shutdown() {
  if (autoCheckTimer) clearInterval(autoCheckTimer);
}

module.exports = { init, registerIPC, shutdown };
