import { useEffect, useRef } from "react";
import { useAppStore } from "../store/app-store";
import { useTikTokStore } from "../store/tiktok-store";
import { useOverlayStore } from "../lib/overlay-store";
import { useAuthStore } from "../store/auth-store";
import { dispatchTikTokEvent } from "../store/event-dispatch";
import { api, isElectron, safeInvoke } from "../services/electron-service";
import { getBrowserSourceHost } from "../lib/browser-source-url";
import { initWorkflowRuntime } from "../workflow/runtime/workflow-runtime";
import { getOverlayRuntimeManager } from "../overlay-runtime";
import { checkSSEHealth, startSSEMonitor, stopSSEMonitor } from "../lib/overlay-bus";
import { initializeTTS, getCurrentProfileTTSSettings, applyCurrentProfileTTSSettings, stopTTS, getTTSService } from "../services/tts";

// ── requestIdleCallback with setTimeout fallback ──
const whenIdle = (cb: () => void, timeoutMs = 2000): (() => void) => {
  if (typeof requestIdleCallback !== 'undefined') {
    let cancelled = false;
    const id = requestIdleCallback(() => {
      if (!cancelled) cb();
    }, { timeout: timeoutMs });
    return () => { cancelled = true; cancelIdleCallback(id); };
  }
  // Fallback: setTimeout with same timeout
  let timer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  timer = setTimeout(() => {
    if (!cancelled) cb();
  }, timeoutMs);
  return () => { cancelled = true; if (timer) clearTimeout(timer); };
};

export function useInit() {
  const initialized = useRef(false);
  const idleCancels = useRef<(() => void)[]>([]);

  useEffect(() => {
    if (initialized.current) return;
    if (!isElectron()) return;

    const a = api();
    if (!a) return;

    const cleanups: (() => void)[] = [];

    // ── Phase 1: IMMEDIATE — Overlay instances (Browser Source race fix) ──
    // This MUST run immediately to populate overlayInstancesByBrowserSourceId
    // before Browser Source /config requests can arrive.
    const authStore = useAuthStore.getState();
    const currentUserId = authStore.currentUser?.id;

    // [FORENSIC-ACTIONS-INIT] Post-rehydration, pre-initialization
    const initStore = useAppStore.getState();
    console.log('[FORENSIC-ACTIONS-INIT]', JSON.stringify({
      actionCount: initStore.actions?.length ?? 0,
      actionIds: initStore.actions?.map((a: Action) => a.id) ?? [],
      currentProfileId: initStore.currentProfileId,
      profileActionCounts: initStore.streamProfiles?.map((p: StreamProfile) => ({
        profileId: p.id,
        profileName: p.name,
        actionCount: p.actions?.length ?? 0,
        actionIds: p.actions?.map((a: Action) => a.id) ?? [],
      })) ?? [],
    }));

    if (currentUserId) {
      const currentProfileId = useAppStore.getState().currentProfileId;
      // Legacy migration deferred to idle (non-blocking)
      idleCancels.current.push(whenIdle(() => {
        useOverlayStore.getState().migrateLegacyOverlays(currentUserId, currentProfileId).catch(() => {});
      }, 3000));
      useOverlayStore.getState().loadInstances(currentUserId, currentProfileId).catch((err) => {
        console.error('[Init] Failed to load overlay instances:', err);
      });
    } else {
      useOverlayStore.getState().loadInstances().catch((err) => {
        console.error('[Init] Failed to load overlay instances:', err);
      });
    }

    // ── Phase 2: RAF — Event listeners + lightweight config sync ──
    // Framer Motion animation completes before Zustand set() triggers re-renders.
    let rafId = 0;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      initialized.current = true;

      // ── TikTok event listeners (per-screen routing) ──
      // These are just listener registrations — lightweight, no blocking work.
      cleanups.push(
        a.onConnected((data) => {
          useAppStore.getState().setScreenConnected(data.screenId, data.username);
          useTikTokStore.getState().setScreenConnected(data.screenId, {
            username: data.username,
            roomId: data.roomId || '',
            viewerCount: data.viewerCount || 0,
          });
        }),
        a.onDisconnected((data) => {
          useAppStore.getState().setScreenDisconnected(data.screenId);
          useTikTokStore.getState().setScreenDisconnected(data.screenId);
        }),
        a.onEvent((data) => {
          dispatchTikTokEvent(data);
        }),
        a.onViewers((data) => {
          useAppStore.getState().setScreenStats(data.screenId, { views: data.viewerCount });
        }),
        a.onStats((data) => {
          const { screenId, stats } = data;
          useAppStore.getState().setScreenStats(screenId, {
            gifts: stats.gifts,
            likes: stats.likes,
            follows: stats.follows,
          });
        }),
        a.onReconnecting((data) => {
          useTikTokStore.getState().setScreenReconnecting(data.screenId, true, data.attempt);
        }),
        a.onError((data) => {
          console.error(`[TIKTOK] Error on ${data.screenId}:`, data.message);
        }),
        a.onRateLimited?.((data) => {
          useTikTokStore.getState().setScreenRateLimited(data.screenId, true, data.serverRetryUntil);
        }),
        a.onCooldownExpired?.((data) => {
          const preStoreState = useTikTokStore.getState().screens[data.screenId];
          const serverRetryUntil = preStoreState?.serverRetryUntil;
          const now = Date.now();
          if (!data.serverStillRateLimited && (!serverRetryUntil || serverRetryUntil <= now)) {
            useTikTokStore.getState().setScreenRateLimited(data.screenId, false, null);
          }
        }),
      );

      // ── TTS Chat: Listen for comment events ──
      // This runs as an additional side effect alongside existing dispatchTikTokEvent
      cleanups.push(
        a.onEvent((data) => {
          // Only process comment events for TTS
          if (data.type === 'comment') {
            // Import dynamically to avoid circular deps
            import('../services/tts').then(({ handleTTSCommentEvent }) => {
              handleTTSCommentEvent(data);
            }).catch(() => {});
          }
        }),
      );

      // ── TTS Chat: Initialize TTS service ──
      // Lightweight initialization, non-blocking
      idleCancels.current.push(whenIdle(async () => {
        try {
          const ttsSettings = getCurrentProfileTTSSettings();
          await initializeTTS(ttsSettings, {
            onQueueChange: () => {
              // Could trigger UI updates if needed
            },
          });
          console.log('[TTS] Service initialized');
        } catch (err) {
          console.warn('[TTS] Initialization failed (non-fatal):', err);
        }
      }, 2000));

      // ── Gift list listener ──
      cleanups.push(
        a.onGiftList((gifts) => {
          if (Array.isArray(gifts)) {
            useAppStore.getState().setTikTokGifts(gifts);
          }
        }),
      );

      // ── Profile sync event listener ──
      const handleProfileSynced = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        if (!detail?.localId || !detail?.serverId) return;
        useAppStore.getState().updateProfile(detail.localId, { serverId: detail.serverId } as any);
      };
      window.addEventListener('rosae:profile-synced', handleProfileSynced);
      cleanups.push(() => window.removeEventListener('rosae:profile-synced', handleProfileSynced));

      // ── Sync saved config to backend modules (lightweight IPC) ──
      const { setupConfig } = useAppStore.getState();
      if (setupConfig.obsIp) {
        a.obsSetConfig({ obsIp: setupConfig.obsIp, obsPort: setupConfig.obsPort, obsPassword: setupConfig.obsPassword });
      }
      if (setupConfig.sbAddress) {
        a.sbSetConfig({ sbAddress: setupConfig.sbAddress, sbPort: setupConfig.sbPort, sbEndpoint: setupConfig.sbEndpoint });
      }
      if (setupConfig.mcIp) {
        a.mcSetConfig({ mcMode: setupConfig.mcMode, mcPlayer: setupConfig.mcPlayer, mcIp: setupConfig.mcIp, mcPort: setupConfig.mcPort, mcPassword: setupConfig.mcPassword });
      }
      if (setupConfig.spotifyClientId) {
        a.spotifySetConfig({ clientId: setupConfig.spotifyClientId, redirectUri: `http://127.0.0.1:18890/callback` });
      }
      if (setupConfig.tikTokName) {
        a.syncPointsConfig(setupConfig);
      }

      // ── Phase 3: IDLE — Deferred background initialization ──
      // All non-critical work runs after the UI is interactive.
      // Each task uses requestIdleCallback (with setTimeout fallback).
      // Cleanup via idleCancels ref prevents stale account operations after logout.

      // 3a: Overlay + Workflow runtime (needed for event processing, not first paint)
      idleCancels.current.push(whenIdle(() => {
        const overlayRuntime = getOverlayRuntimeManager();
        overlayRuntime.initialize();
        initWorkflowRuntime({
          onExecutionStart: (_exec) => {},
          onExecutionComplete: (_exec) => {},
          onExecutionError: (workflowId, error) => {
            console.error(`[Workflow] Error: ${workflowId} - ${error}`);
          },
        });
      }, 3000));

      // 3b: Load gifts from TikTok service
      idleCancels.current.push(whenIdle(() => {
        a.requestGifts();
      }, 1000));

      // 3c: Connection status checks (OBS, SB, Spotify) — UI indicators only
      idleCancels.current.push(whenIdle(() => {
        safeInvoke(a.obsStatus).then((result) => {
          if (result.success) useAppStore.getState().setObsConnected(result.data?.connected || false);
        }).catch(() => {});
        safeInvoke(a.sbStatus).then((result) => {
          if (result.success) useAppStore.getState().setSbConnected(result.data?.connected || false);
        }).catch(() => {});
        safeInvoke(a.spotifyStatus).then((result) => {
          if (result.success && result.data?.authenticated) {
            useAppStore.getState().setSpotifyConnected(true);
            safeInvoke(a.spotifyPlayback).then((pbResult) => {
              if (pbResult.success && pbResult.data?.name) {
                const pb = pbResult.data;
                useAppStore.getState().setSpotifyNowPlaying({
                  name: pb.name, artist: pb.artist, albumArt: pb.albumArt || "",
                  progressMs: pb.progressMs || 0, durationMs: pb.durationMs || 0, isPlaying: pb.isPlaying || false,
                });
              }
            }).catch(() => {});
          }
        }).catch(() => {});
      }, 2000));

      // 3d: SSE health check + monitor
      idleCancels.current.push(whenIdle(() => {
        checkSSEHealth().catch(() => {});
        startSSEMonitor();
      }, 2000));

      // 3e: Hydrate action media from Dexie (N+1 queries — deferred)
      idleCancels.current.push(whenIdle(() => {
        useAppStore.getState().hydrateMedia();
      }, 2000));

      // 3f: Custom sounds hydration + legacy migration
      idleCancels.current.push(whenIdle(() => {
        const currentProfileId = useAppStore.getState().currentProfileId;
        if (currentProfileId) {
          useAppStore.getState().migrateLegacyCustomSounds(currentProfileId).catch(() => {});
          useAppStore.getState().hydrateCustomSounds(currentProfileId).catch(() => {});
        }
      }, 2500));

      // 3g: Cloud profile sync — network call, fully async
      idleCancels.current.push(whenIdle(() => {
        (async () => {
          try {
            const appStore = useAppStore.getState();
            const authStoreState = (await import('../store/auth-store')).useAuthStore.getState();
            const userId = authStoreState.currentUser?.id;

            if (!userId) {
              console.log('[INIT] No authenticated user, skipping cloud profile sync');
              return;
            }

            appStore._setRehydrating(false);

            const { fetchProfiles } = await import('../services/profile-api');
            const cloud = await fetchProfiles();
            const cloudProfiles = cloud.profiles || [];

            if (cloudProfiles.length > 0) {
              await appStore.pullCloudProfiles(userId);
              console.log('[INIT] Loaded', cloudProfiles.length, 'cloud profiles');
            } else if (appStore.streamProfiles.length > 0) {
              await appStore.migrateLocalProfilesToCloud(userId);
              console.log('[INIT] Migrated local profiles to cloud');
            }

            // [REAL-PROFILE-INIT-ACTIONS] Post-init profile state
            const initState = useAppStore.getState();
            console.log('[REAL-PROFILE-INIT-ACTIONS]', JSON.stringify({
              profiles: initState.streamProfiles.map(p => ({
                profileId: p.id,
                profileName: p.name,
                actionCount: p.actions?.length ?? 0,
                actionIds: p.actions?.map((a: Action) => a.id) ?? [],
              })),
              currentProfileId: initState.currentProfileId,
              topLevelActionCount: initState.actions.length,
              topLevelActionIds: initState.actions.map((a: Action) => a.id),
            }));

            const { profileSyncProcessor } = await import('../services/profile-sync-processor');
            profileSyncProcessor.start(userId);
            console.log('[INIT] Profile sync processor started');
          } catch (err) {
            console.warn('[INIT] Cloud profile sync failed (continuing with local):', err);
          } finally {
            useAppStore.getState()._setRehydrating(false);
          }
        })();
      }, 3000));

    }); // end requestAnimationFrame callback

    // ── TTS Chat: Handle profile switching ──
    // When profile changes, apply new TTS settings
    const handleProfileChange = () => {
      applyCurrentProfileTTSSettings();
    };
    window.addEventListener('rosae:profile-changed', handleProfileChange);
    cleanups.push(() => window.removeEventListener('rosae:profile-changed', handleProfileChange));

    // ── Cleanup ──
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      // Cancel all pending idle callbacks
      idleCancels.current.forEach((cancel) => cancel());
      idleCancels.current = [];
      cleanups.forEach((fn) => fn());
      stopSSEMonitor();
      // Stop TTS on cleanup
      stopTTS();
    };
  }, []);
}
