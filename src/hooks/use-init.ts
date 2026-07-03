import { useEffect, useRef } from "react";
import { useAppStore } from "../store/app-store";
import { dispatchTikTokEvent } from "../store/event-dispatch";
import { api, isElectron } from "../services/electron-service";

export function useInit() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    if (!isElectron()) return;
    initialized.current = true;

    const a = api();
    if (!a) return;

    const cleanups: (() => void)[] = [];

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
      a.spotifySetConfig({ clientId: setupConfig.spotifyClientId, redirectUri: "http://127.0.0.1:8890/callback" });
    }

    // ── TikTok event listeners (per-screen routing) ──
    cleanups.push(
      a.onConnected((data) => {
        useAppStore.getState().setScreenConnected(data.screenId, data.username);
      }),
      a.onDisconnected((data) => {
        useAppStore.getState().setScreenDisconnected(data.screenId);
      }),
      a.onEvent((data) => {
        dispatchTikTokEvent(data);
      }),
      a.onViewers((data) => {
        useAppStore.getState().setScreenStats(data.screenId, { views: data.viewerCount });
      }),
      a.onError((data) => {
        console.warn(`[Init] TikTok error (${data.screenId}):`, data.message);
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
    a.spotifyStatus().then((status) => {
      if (status?.authenticated) {
        useAppStore.getState().setSpotifyConnected(true);
        a.spotifyPlayback().then((pb) => {
          if (pb?.name) {
            useAppStore.getState().setSpotifyNowPlaying({
              name: pb.name, artist: pb.artist, albumArt: pb.albumArt || "",
              progressMs: pb.progressMs || 0, durationMs: pb.durationMs || 0, isPlaying: pb.isPlaying || false,
            });
          }
        }).catch(() => {});
      }
    }).catch(() => {});

    // ── Check connection statuses ──
    a.obsStatus().then((s) => useAppStore.getState().setObsConnected(s?.connected || false)).catch(() => {});
    a.sbStatus().then((s) => useAppStore.getState().setSbConnected(s?.connected || false)).catch(() => {});

    // ── License sync ──
    a.licenseStatus().then((status) => {
      if (status) {
        useAppStore.getState().setLicenseInfo({
          isPro: status.isPro || false, plan: status.plan || "free",
          limits: status.limits || { actions: 5, customSounds: 3, streamProfiles: 1 },
        });
      }
    }).catch(() => {});

    // ── Hydrate action media from Dexie ──
    useAppStore.getState().hydrateMedia();

    // ── Sync per-screen usernames to backend ──
    const { screenTikTokNames } = useAppStore.getState();
    for (const [screenId, name] of Object.entries(screenTikTokNames)) {
      if (name) a.syncPointsConfig({ ...setupConfig, tikTokName: name });
    }

    return () => { cleanups.forEach((fn) => fn()); };
  }, []);
}
