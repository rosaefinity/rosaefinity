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

    // ── Load Overlay Instances IMMEDIATELY (not deferred) ──
    // This pushes instances to Electron main process before Browser Source
    // /config requests can arrive, eliminating the config-fetch retry race.
    useOverlayStore.getState().loadInstances().catch((err) => {
      console.error('[Init] Failed to load overlay instances:', err);
    });

    rafId = requestAnimationFrame(() => {
      rafId = 0;
      initialized.current = true;

      // ── Initialize Overlay Runtime ──
      const overlayRuntime = getOverlayRuntimeManager();
      overlayRuntime.initialize();

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
          console.log(`[TIKTOK-LIFECYCLE-TRACE] renderer received connected`, JSON.stringify({
            source: "renderer-onConnected",
            screenId: data.screenId,
            username: data.username,
            roomId: data.roomId,
            viewerCount: data.viewerCount,
            timestamp: Date.now(),
            currentStoreState: useTikTokStore.getState().screens[data.screenId],
          }));
          useAppStore.getState().setScreenConnected(data.screenId, data.username);
          useTikTokStore.getState().setScreenConnected(data.screenId, {
            username: data.username,
            roomId: data.roomId || '',
            viewerCount: data.viewerCount || 0,
          });
        }),
        a.onDisconnected((data) => {
          const beforeStore = useTikTokStore.getState().screens[data.screenId];
          console.log(`[TIKTOK-DISCONNECT-TRACE][STORE]`, JSON.stringify({
            screenId: data.screenId,
            reason: data.reason || 'unknown',
            beforeStatus: beforeStore?.status,
            beforeUsername: beforeStore?.username,
            beforeRoomId: beforeStore?.roomId,
            timestamp: Date.now(),
          }));
          useAppStore.getState().setScreenDisconnected(data.screenId);
          useTikTokStore.getState().setScreenDisconnected(data.screenId);
          const afterStore = useTikTokStore.getState().screens[data.screenId];
          console.log(`[TIKTOK-DISCONNECT-TRACE][STORE]`, JSON.stringify({
            screenId: data.screenId,
            afterStatus: afterStore?.status,
            afterUsername: afterStore?.username,
            afterRoomId: afterStore?.roomId,
            action: "setScreenDisconnected called",
          }));
        }),
        a.onEvent((data) => {
          const eventType = data.type || 'chat';
          // STEP 5 DIAGNOSTIC: Log renderer event delivery
          if (eventType === 'gift') {
            console.log(`[TIKTOK-RENDERER-EVENT]`, JSON.stringify({ type: eventType, screenId: data.screenId, giftName: data.giftName, giftId: data.giftId, user: data.user, diamondCount: data.diamondCount }));
          }
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
          console.log(`[TIKTOK-LIFECYCLE-TRACE] renderer received reconnecting`, JSON.stringify({
            source: "renderer-onReconnecting",
            screenId: data.screenId,
            attempt: data.attempt,
            timestamp: Date.now(),
            currentStoreState: useTikTokStore.getState().screens[data.screenId],
          }));
          useTikTokStore.getState().setScreenReconnecting(data.screenId, true, data.attempt);
        }),
        a.onError((data) => {
          console.log(`[TIKTOK-LIFECYCLE-TRACE] renderer received error`, JSON.stringify({
            source: "renderer-onError",
            screenId: data.screenId,
            message: data.message,
            timestamp: Date.now(),
            currentStoreState: useTikTokStore.getState().screens[data.screenId],
          }));
        }),
        a.onRateLimited?.((data) => {
          const now = Date.now();
          console.log(`[TIKTOK-CONNECT-TRACE] renderer received rate-limited event`, JSON.stringify({
            screenId: data.screenId,
            serverRetryAfterMs: data.serverRetryAfterMs,
            serverRetryUntil: data.serverRetryUntil,
            serverRetryUntilReadable: data.serverRetryUntil ? new Date(data.serverRetryUntil).toISOString() : null,
            preStoreState: useTikTokStore.getState().screens[data.screenId],
          }));
          // Use serverRetryUntil as the single authoritative deadline
          useTikTokStore.getState().setScreenRateLimited(data.screenId, true, data.serverRetryUntil);
          console.log(`[TIKTOK-CONNECT-TRACE] renderer store updated`, JSON.stringify({
            screenId: data.screenId,
            postStoreState: useTikTokStore.getState().screens[data.screenId],
          }));
        }),
        a.onCooldownExpired?.((data) => {
          const now = Date.now();
          const preStoreState = useTikTokStore.getState().screens[data.screenId];
          const serverRetryUntil = preStoreState?.serverRetryUntil;
          const isRateLimited = preStoreState?.isRateLimited;
          const remainingMs = serverRetryUntil ? Math.max(0, serverRetryUntil - now) : null;

          console.log(`[TIKTOK-CONNECT-TRACE] renderer received cooldown-expired event`, JSON.stringify({
            screenId: data.screenId,
            serverRetryUntil: data.serverRetryUntil,
            serverStillRateLimited: data.serverStillRateLimited,
            preStoreState,
          }));

          console.log(`[TIKTOK-RATE-LIMIT-CLEAR-TRACE]`, JSON.stringify({
            source: "renderer-onCooldownExpired",
            screenId: data.screenId,
            now,
            serverRetryUntilBeforeClear: serverRetryUntil,
            remainingMs,
            isRateLimitedBeforeClear: isRateLimited,
            reason: `serverStillRateLimited=${data.serverStillRateLimited}, willClear=${!data.serverStillRateLimited}`,
            serverStillRateLimited: data.serverStillRateLimited,
          }));

          // Only clear rate limit if server says it's ready AND the deadline has actually passed
          if (!data.serverStillRateLimited && (!serverRetryUntil || serverRetryUntil <= now)) {
            useTikTokStore.getState().setScreenRateLimited(data.screenId, false, null);
            console.log(`[TIKTOK-CONNECT-TRACE] renderer store cleared`, JSON.stringify({
              screenId: data.screenId,
              postStoreState: useTikTokStore.getState().screens[data.screenId],
            }));
          } else {
            console.log(`[TIKTOK-RATE-LIMIT-CLEAR-TRACE] BLOCKED - deadline not reached`, JSON.stringify({
              screenId: data.screenId,
              now,
              serverRetryUntil,
              serverStillRateLimited: data.serverStillRateLimited,
              reason: "cooldown not actually expired, keeping rate limit active",
            }));
          }
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
      // NOTE: PRO status is determined by useLicenseStore (backend API).
      // The local Electron license system (V1) is NOT used for PRO determination.
      // Removed V1 licenseStatus() call to prevent local license.json from
      // overriding the backend-authoritative PRO status.

      // ── Hydrate action media from Dexie ──
      useAppStore.getState().hydrateMedia();

      // ── Sync TikTok config to backend ──
      if (setupConfig.tikTokName) {
        a.syncPointsConfig(setupConfig);
      }

      // ── TEMPORARY: Add test event + action for runtime verification ──
      // DISABLED to prevent renderer crashes
      // const testEventId = crypto.randomUUID();
      // const testActionId = crypto.randomUUID();
      // const testAction = {
      //   id: testActionId,
      //   name: "Test Action - Rose Gift",
      //   screen: "1",
      //   duration: 5,
      //   sound: true,
      //   soundFile: "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT",
      //   video: false,
      //   image: false,
      //   keystroke: false,
      //   minecraft: false,
      //   enabled: true,
      //   displayDuration: 5,
      //   createdAt: new Date().toISOString(),
      //   updatedAt: new Date().toISOString(),
      // };
      // const testEvent = {
      //   id: testEventId,
      //   triggerType: "specificgift" as const,
      //   whoTrigger: "any" as const,
      //   giftName: "Rose",
      //   actionName: testAction.name,
      //   enabled: true,
      //   createdAt: new Date().toISOString(),
      //   updatedAt: new Date().toISOString(),
      // };
      // useAppStore.getState().addEvent(testEvent);
      // useAppStore.getState().addAction(testAction);
      // console.log(`[TEMP-TEST] Added test event for "Rose" gift and test action`);

      // ── TEMPORARY: Auto-inject test GIFT event for runtime verification ──
      // Only runs after a short delay to let UI load and connect
      // DISABLED to prevent renderer crashes
      // setTimeout(() => {
      //   if (a.injectTikTokTestEvent) {
      //     console.log(`[TEMP-TEST] Auto-injecting test GIFT event for runtime verification`);
      //     a.injectTikTokTestEvent("screen-0", {
      //       type: "gift",
      //       user: "test_user",
      //       nickname: "TestUser",
      //       giftName: "Rose",
      //       giftId: 1,
      //       repeatCount: 1,
      //       diamondCount: 1,
      //     })
      //       .then((result: unknown) => console.log(`[TEMP-TEST] Result:`, result))
      //       .catch((err: unknown) => console.error(`[TEMP-TEST] Error:`, err));
      //   }
      // }, 5000);

    }); // end requestAnimationFrame callback

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      cleanups.forEach((fn) => fn());
      stopSSEMonitor();
    };
  }, []);
}
