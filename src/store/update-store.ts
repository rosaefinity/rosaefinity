// =============================================
// RosaeFinity â€” Update Store (Zustand)
// Manages update state, preferences, version info.
// All IPC communication goes through api().
// =============================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UpdateChannel, UpdateStatus, UpdateProgress, UpdateInfo, UpdatePreferences } from '../services/update/types';
import { api, isElectron } from '../services/electron-service';

interface UpdateStore {
  // â”€â”€ State â”€â”€
  status: UpdateStatus;
  currentVersion: string;
  latestVersion: string | null;
  channel: UpdateChannel;
  progress: UpdateProgress | null;
  currentInfo: UpdateInfo | null;
  releaseNotes: string;
  lastCheckedAt: number | null;
  lastInstalledAt: number | null;
  ignoredVersions: string[];
  preferences: UpdatePreferences;
  error: string | null;
  isInitialized: boolean;

  // â”€â”€ Actions â”€â”€
  initialize: () => Promise<void>;
  checkForUpdates: (silent?: boolean) => Promise<void>;
  downloadUpdate: () => Promise<void>;
  installUpdate: () => Promise<void>;
  cancelDownload: () => Promise<void>;
  setChannel: (channel: UpdateChannel) => Promise<void>;
  setPreferences: (prefs: Partial<UpdatePreferences>) => Promise<void>;
  skipVersion: (version: string) => Promise<void>;
  unskipVersion: (version: string) => Promise<void>;
  clearError: () => void;
}

const DEFAULT_PREFERENCES: UpdatePreferences = {
  channel: 'stable',
  autoCheck: true,
  autoDownload: false,
  checkIntervalHours: 4,
  silent: false,
};

export const useUpdateStore = create<UpdateStore>()(
  persist(
    (set, get) => ({
      // â”€â”€ Initial state â”€â”€
      status: 'idle',
      currentVersion: '',
      latestVersion: null,
      channel: 'stable',
      progress: null,
      currentInfo: null,
      releaseNotes: '',
      lastCheckedAt: null,
      lastInstalledAt: null,
      ignoredVersions: [],
      preferences: DEFAULT_PREFERENCES,
      error: null,
      isInitialized: false,

      // â”€â”€ Initialize â”€â”€
      initialize: async () => {
        if (get().isInitialized) return;
        if (!isElectron()) {
          set({ isInitialized: true });
          return;
        }

        const a = api();
        if (a?.getAppVersion) {
          try {
            set({ currentVersion: await a.getAppVersion() });
          } catch (_) {
            // Update info remains authoritative when the version IPC is unavailable.
          }
        }
        if (!a) {
          set({ isInitialized: true });
          return;
        }

        try {
          // Load current info from main process
          const info = await a.updateGetInfo();
          const prefs = await a.updateGetPreferences();
          const ignored = await a.updateGetIgnored();

          set({
            status: info.status as UpdateStatus,
            currentVersion: info.currentVersion,
            latestVersion: info.latestVersion,
            channel: info.channel as UpdateChannel,
            progress: info.progress,
            currentInfo: info.currentInfo,
            lastCheckedAt: info.lastCheckedAt,
            preferences: prefs as UpdatePreferences,
            ignoredVersions: ignored,
            isInitialized: true,
          });

          // Subscribe to update events
          a.onUpdateStatus((status) => {
            const s = status as UpdateStatus;
            set((state) => ({
              status: s,
              error: s === 'error' ? state.error : null,
            }));
          });

          a.onUpdateProgress((progress) => {
            set({ progress });
          });

          a.onUpdateAvailable((info) => {
            set({ currentInfo: info, latestVersion: info.version });
          });

          a.onUpdateNotAvailable((data) => {
            set({ latestVersion: data.version, error: null, progress: null });
          });

          a.onUpdateDownloaded((info) => {
            set({
              currentInfo: info,
              latestVersion: info.version,
              lastInstalledAt: Date.now(),
              progress: null,
            });
          });

          a.onUpdateError((data) => {
            set({ error: data.message, progress: null });
          });

          a.onUpdateReleaseNotes((notes) => {
            set({ releaseNotes: notes });
          });
        } catch (err: any) {
          set({ error: err.message, isInitialized: true });
        }
      },

      // â”€â”€ Check for updates â”€â”€
      checkForUpdates: async (silent = false) => {
        const a = api();
        if (!a) return;

        set({ error: null });
        try {
          const result = await a.updateCheck({ silent });
          if (!result.success && result.error) {
            set({ error: result.error });
          }
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      // â”€â”€ Download â”€â”€
      downloadUpdate: async () => {
        const a = api();
        if (!a) return;

        set({ error: null });
        try {
          const result = await a.updateDownload();
          if (!result.success && result.error) {
            set({ error: result.error });
          }
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      // â”€â”€ Install â”€â”€
      installUpdate: async () => {
        const a = api();
        if (!a) return;

        set({ error: null });
        try {
          const result = await a.updateInstall();
          if (!result.success && result.error) {
            set({ error: result.error });
          }
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      // â”€â”€ Cancel â”€â”€
      cancelDownload: async () => {
        const a = api();
        if (!a) return;
        try {
          await a.updateCancel();
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      // â”€â”€ Set channel â”€â”€
      setChannel: async (channel) => {
        const a = api();
        if (!a) return;

        try {
          await a.updateSetChannel(channel);
          set({ channel, preferences: { ...get().preferences, channel } });
        } catch (err: any) {
          set({ error: err.message });
        }
      },

      // â”€â”€ Set preferences â”€â”€
      setPreferences: async (prefs) => {
        const a = api();
        const newPrefs = { ...get().preferences, ...prefs };
        set({ preferences: newPrefs });

        if (a) {
          try {
            await a.updateSetPreferences(newPrefs);
          } catch (err: any) {
            set({ error: err.message });
          }
        }
      },

      // â”€â”€ Skip version â”€â”€
      skipVersion: async (version) => {
        const a = api();
        const ignored = [...get().ignoredVersions, version];
        set({ ignoredVersions: ignored });

        if (a) {
          try {
            await a.updateSkipVersion(version);
          } catch (err: any) {
            set({ error: err.message });
          }
        }
      },

      // â”€â”€ Unskip version â”€â”€
      unskipVersion: async (version) => {
        const a = api();
        const ignored = get().ignoredVersions.filter(v => v !== version);
        set({ ignoredVersions: ignored });

        if (a) {
          try {
            await a.updateUnskipVersion(version);
          } catch (err: any) {
            set({ error: err.message });
          }
        }
      },

      // â”€â”€ Clear error â”€â”€
      clearError: () => set({ status: 'idle', error: null }),
    }),
    {
      name: 'rf-update-store',
      partialize: (state) => ({
        currentVersion: state.currentVersion,
        channel: state.channel,
        lastCheckedAt: state.lastCheckedAt,
        lastInstalledAt: state.lastInstalledAt,
        ignoredVersions: state.ignoredVersions,
        preferences: state.preferences,
      }),
    }
  )
);
