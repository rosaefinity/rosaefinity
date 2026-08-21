import { useEffect, useRef } from "react";
import { useAppStore } from "../store/app-store";
import { useTikTokStore } from "../store/tiktok-store";
import { useOverlayStore } from "../lib/overlay-store";
import { dispatchTikTokEvent } from "../store/event-dispatch";
import { api, isElectron, safeInvoke } from "../services/electron-service";
import { getBrowserSourceHost } from "../lib/browser-source-url";
import { initWorkflowRuntime } from "../workflow/runtime/workflow-runtime";
import { getOverlayRuntimeManager } from "../overlay-runtime";
import { checkSSEHealth, startSSEMonitor, stopSSEMonitor } from "../lib/overlay-bus";

export function useInit() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (!isElectron()) return;

    const a = api();
    if (!a) return;

    const cleanups: (() => void)[] = [];

    // Defer heavy initialization to the next animation frame so that
    // Framer Motion's initial opacity={0} → opacity={1} animation in
    // AppLayout/AuthPage completes before Zustand store updates trigger
    // re-renders. Without this, Electron-only IPC calls fire during the
    // first paint, causing re-renders that leave content stuck at opacity 0.
    let rafId = 0;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      initialized.current = true;

      // ── Initialize Overlay Runtime ──
      const overlayRuntime = getOverlayRuntimeManager();
      overlayRuntime.initialize();

      // ── Load Overlay Instances from Dexie ──
      useOverlayStore.getState().loadInstances().catch((err) => {
        console.error('[Init] Failed to load overlay instances:', err);
      });

      // ── Initialize Workflow Runtime ──
      initWorkflowRuntime({
        onExecutionStart: (_exec) => {},
        onExecutionComplete: (_exec) => {},
        onExecutionError: (workflowId, error) => {
          console.error(`[Workflow] Error: ${workflowId} - ${error}`);
        },
      });

      // ── Sync saved config to backend modules ──
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

      // ── TikTok event listeners (per-screen routing) ──
      // TikTok connection now runs entirely in main process (electron/backend/tiktok-service.cjs)
      // Renderer only receives normalized events via IPC
      cleanups.push(
        a.onConnected((data) => {
          console.log(`[TIKTOK] connected screenId=${data.screenId} username=${data.username}`);
          useAppStore.getState().setScreenConnected(data.screenId, data.username);
          useTikTokStore.getState().setScreenConnected(data.screenId, {
            username: data.username,
            roomId: data.roomId || '',
            viewerCount: data.viewerCount || 0,
          });
        }),
        a.onDisconnected((data) => {
          console.log(`[TIKTOK] disconnected screenId=${data.screenId} reason=${data.reason || 'unknown'}`);
          useAppStore.getState().setScreenDisconnected(data.screenId);
          useTikTokStore.getState().setScreenDisconnected(data.screenId);
        }),
        a.onEvent((data) => {
          const eventType = data.type || 'chat';
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
          console.warn(`[TIKTOK] ERROR screenId=${data.screenId} message=${data.message}`);
        }),
      );

      // ── Gift list listener ──
      cleanups.push(
        a.onGiftList((gifts) => {
          if (Array.isArray(gifts)) {
            useAppStore.getState().setTikTokGifts(gifts);
          }
        }),
      );

      // ── Load gifts ──
      a.requestGifts();

      // ── Check Spotify status ──
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
          });
        }
      });

      // ── Check connection statuses ──
      safeInvoke(a.obsStatus).then((result) => {
        if (result.success) useAppStore.getState().setObsConnected(result.data?.connected || false);
      });
      safeInvoke(a.sbStatus).then((result) => {
        if (result.success) useAppStore.getState().setSbConnected(result.data?.connected || false);
      });

      // ── Check SSE/Overlay status ──
      checkSSEHealth().catch(() => {});
      startSSEMonitor();

      // ── License sync ──
      safeInvoke(a.licenseStatus).then((result) => {
        if (result.success && result.data) {
          useAppStore.getState().setLicenseInfo({
            isPro: result.data.isPro || false, plan: result.data.plan || "free",
            limits: result.data.limits || { actions: 5, customSounds: 3, streamProfiles: 1 },
          });
        }
      });

      // ── Hydrate action media from Dexie ──
      useAppStore.getState().hydrateMedia();

      // ── Sync TikTok config to backend ──
      if (setupConfig.tikTokName) {
        a.syncPointsConfig(setupConfig);
      }

    }); // end requestAnimationFrame callback

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      cleanups.forEach((fn) => fn());
      stopSSEMonitor();
    };
  }, []);
}
