import { useEffect, useRef } from "react";
import { useAppStore } from "../store/app-store";
import { useTikTokStore } from "../store/tiktok-store";
import { useOverlayStore } from "../lib/overlay-store";
import { dispatchTikTokEvent } from "../store/event-dispatch";
import { api, isElectron, safeInvoke } from "../services/electron-service";
import { getBrowserSourceHost } from "../lib/browser-source-url";
import { getTikTokEngine } from "../engine/tiktok";
import { initWorkflowRuntime } from "../workflow/runtime/workflow-runtime";
import { getOverlayRuntimeManager } from "../overlay-runtime";
import { checkSSEHealth, startSSEMonitor, stopSSEMonitor } from "../lib/overlay-bus";

export function useInit() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (!isElectron()) return;
    initialized.current = true;

    const a = api();
    if (!a) return;

    const cleanups: (() => void)[] = [];

    // â”€â”€ Initialize TikTok Engine â”€â”€
    const engine = getTikTokEngine();
    engine.initialize({
      onEvent: (event) => {
        // Legacy compatibility: also dispatch through old system
        dispatchTikTokEvent({ ...event.data, type: event.type, screenId: event.screenId });
      },
      onStateChange: (state, screenId) => {
        if (state === 'connected') {
          useAppStore.getState().setScreenConnected(screenId, '');
        } else if (state === 'disconnected') {
          useAppStore.getState().setScreenDisconnected(screenId);
        }
      },
      onHealthUpdate: (health) => {
        useAppStore.getState().setScreenStats('screen-0', { views: health.viewerCount });
      },
    });

    // â”€â”€ Initialize Overlay Runtime â”€â”€
    const overlayRuntime = getOverlayRuntimeManager();
    overlayRuntime.initialize();

    // â”€â”€ Load Overlay Instances from Dexie â”€â”€
    // CRITICAL: Load overlay instances on app startup and sync to main process
    // This enables the SSE config endpoint to serve actual overlay data
    useOverlayStore.getState().loadInstances().catch((err) => {
      console.error('[Init] Failed to load overlay instances:', err);
    });

    // â”€â”€ Initialize Workflow Runtime â”€â”€
    initWorkflowRuntime({
      onExecutionStart: (_exec) => {
        // Workflow started
      },
      onExecutionComplete: (_exec) => {
        // Workflow completed
      },
      onExecutionError: (workflowId, error) => {
        console.error(`[Workflow] Error: ${workflowId} - ${error}`);
      },
    });

    // â”€â”€ Sync saved config to backend modules â”€â”€
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

    // â”€â”€ TikTok event listeners (per-screen routing) â”€â”€
    cleanups.push(
      a.onConnected((data) => {
        console.log(`[TIKTOK-FLOW] 17 renderer received connected event`);
        console.log(`[TIKTOK-FLOW] 18 updating TikTok store screenId=${data.screenId} username=${data.username}`);
        // Update BOTH stores â€” app-store for internal state, tiktok-store for UI
        useAppStore.getState().setScreenConnected(data.screenId, data.username);
        useTikTokStore.getState().setScreenConnected(data.screenId, {
          username: data.username,
          roomId: data.roomId || '',
          viewerCount: data.viewerCount || 0,
        });
        engine.handleConnected(data);
        console.log(`[TIKTOK-FLOW] 19 UI status = connected`);
      }),
      a.onDisconnected((data) => {
        console.log(`[TIKTOK-FLOW] DISCONNECTED renderer received reason=${data.reason || 'unknown'}`);
        useAppStore.getState().setScreenDisconnected(data.screenId);
        useTikTokStore.getState().setScreenDisconnected(data.screenId);
        engine.handleDisconnected(data);
      }),
      a.onEvent((data) => {
        // Route through engine pipeline for validation, dedup, priority
        const eventType = data.type || 'chat';
        engine.pushEvent(eventType as any, data);
        // Legacy fallback for backward compatibility
        dispatchTikTokEvent(data);
      }),
      a.onViewers((data) => {
        engine.updateViewerCount(data.viewerCount);
        useAppStore.getState().setScreenStats(data.screenId, { views: data.viewerCount });
      }),
      a.onStats((data) => {
        // Backend sends authoritative stats â€” update app-store with valid Stats fields
        const { screenId, stats } = data;
        useAppStore.getState().setScreenStats(screenId, {
          gifts: stats.gifts,
          likes: stats.likes,
          follows: stats.follows,
        });
      }),
      a.onReconnecting((data) => {
        // Update tiktok-store reconnection state
        useTikTokStore.getState().setScreenReconnecting(data.screenId, true, data.attempt);
      }),
      a.onError((data) => {
        console.warn(`[TIKTOK-FLOW] ERROR renderer received error screenId=${data.screenId} message=${data.message}`);
      }),
    );

    // â”€â”€ Gift list listener â”€â”€
    cleanups.push(
      a.onGiftList((gifts) => {
        if (Array.isArray(gifts)) {
          useAppStore.getState().setTikTokGifts(gifts);
        }
      }),
    );

    // â”€â”€ Load gifts â”€â”€
    a.requestGifts();

    // â”€â”€ Check Spotify status â”€â”€
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

    // â”€â”€ Check connection statuses â”€â”€
    safeInvoke(a.obsStatus).then((result) => {
      if (result.success) useAppStore.getState().setObsConnected(result.data?.connected || false);
    });
    safeInvoke(a.sbStatus).then((result) => {
      if (result.success) useAppStore.getState().setSbConnected(result.data?.connected || false);
    });

    // â”€â”€ Check SSE/Overlay status â”€â”€
    checkSSEHealth().catch(() => {});
    startSSEMonitor();

    // â”€â”€ License sync â”€â”€
    safeInvoke(a.licenseStatus).then((result) => {
      if (result.success && result.data) {
        useAppStore.getState().setLicenseInfo({
          isPro: result.data.isPro || false, plan: result.data.plan || "free",
          limits: result.data.limits || { actions: 5, customSounds: 3, streamProfiles: 1 },
        });
      }
    });

    // â”€â”€ Hydrate action media from Dexie â”€â”€
    useAppStore.getState().hydrateMedia();

    // â”€â”€ Sync TikTok config to backend â”€â”€
    if (setupConfig.tikTokName) {
      a.syncPointsConfig(setupConfig);
    }

    return () => {
      cleanups.forEach((fn) => fn());
      stopSSEMonitor();
    };
  }, []);
}
