import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../store/app-store";
import { useObsConnection } from "../hooks/use-obs-connection";
import { useAuthStore } from "../store/auth-store";
import { useLicenseStore } from "../store/license-store";
import { useTikTokStore, selectScreenStatus, selectScreenUsername, selectScreenViewerCount, selectScreenStats, selectScreenRoomId, selectScreenIsReconnecting, selectScreenReconnectAttempts, selectScreenLastError, selectScreenIsRateLimited, selectScreenServerRetryUntil } from "../store/tiktok-store";
import { api } from "../services/electron-service";
import { toast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Settings, Save, Download, Upload, CheckCircle2, XCircle, Copy } from "lucide-react";
import { getOverlayWidgetUrl } from "../lib/browser-source-url";
import { SCREEN_IDS, type Action } from "../types";
import { OBS_LOCAL_HOST, OBS_LOCAL_PORT } from "../lib/obs-local";
import { TTSChatSettings } from "../components/tts/TTSChatSettings";
import { db, reopenDatabase, importGoals, importOverlays, importMediaLibrary } from "../lib/db";
import { collectProfileMediaAssetsFromDexie, persistImportedMediaRows, importActionPackWithDexie } from "../lib/action-pack-io";
import { isActionPack } from "../lib/action-media-pack";
import { useGoalStore } from "../store/goal-store";
import { useThemeStore } from "../theme/ThemeStore";
import { useCoinJarStore } from "../store/coin-jar-store";
import { useOverlayStore as useOverlayInstanceStore } from "../lib/overlay-store";
import { useOverlayStore as useActiveOverlayStore } from "../state/overlayStore";
import { exportProfilePackage, importProfilePackage, isProfilePackage } from "../lib/profile-portability";

type Section = "tiktok" | "points" | "levels" | "obs" | "streamerbot" | "minecraft" | "spotify" | "songrequest" | "overlayscreens" | "reset" | "account" | "importexport" | "advanced" | "license" | "tts";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "tiktok", label: "TikTok Connection", icon: "🎵" },
  { id: "points", label: "Points System", icon: "⭐" },
  { id: "levels", label: "Level Settings", icon: "📈" },
  { id: "obs", label: "OBS Connection", icon: "🎬" },
  { id: "streamerbot", label: "Streamer.bot", icon: "🤖" },
  { id: "minecraft", label: "Minecraft", icon: "⛏️" },
  { id: "spotify", label: "Spotify", icon: "🎵" },
  { id: "songrequest", label: "Song Request", icon: "🎶" },
  { id: "overlayscreens", label: "Overlay Screens", icon: "📺" },
  { id: "reset", label: "Reset Points", icon: "🔄" },
  { id: "account", label: "Account", icon: "👤" },
  { id: "importexport", label: "Import/Export", icon: "📦" },
  { id: "advanced", label: "Advanced", icon: "⚙️" },
  { id: "tts", label: "TTS Chat", icon: "🔊" },
];

export function SettingsPage() {
  // ══ Zustand — all settings live here and auto-persist via persist middleware ══
  const setupConfig = useAppStore(s => s.setupConfig);
  const updateSetupConfig = useAppStore(s => s.updateSetupConfig);
  const pointsConfig = useAppStore(s => s.pointsConfig);
  const updatePointsConfig = useAppStore(s => s.updatePointsConfig);
  const actions = useAppStore(s => s.actions);
  const { user } = useAuthStore();
  const { plan: licensePlan, status: licenseStatus, expiresAt, effectivePlan, isLifetimePro } = useLicenseStore();

  // Reactive expiration: re-render when subscription expires mid-session
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (licensePlan !== 'pro' || !expiresAt) return;
    const msUntilExpiry = expiresAt - Date.now();
    if (msUntilExpiry <= 0) return; // Already expired
    const timer = setTimeout(() => setNow(Date.now()), msUntilExpiry + 1000);
    return () => clearTimeout(timer);
  }, [licensePlan, expiresAt]);

  // TikTok store for connection management
  const tikTokStatus = useTikTokStore(selectScreenStatus("screen-0"));
  // Authoritative OBS connection state (shared with Create Action via Zustand)
  const { obsConnected } = useObsConnection();
  const tikTokUsername = useTikTokStore(selectScreenUsername("screen-0"));
  const tikTokViewerCount = useTikTokStore(selectScreenViewerCount("screen-0"));
  const tikTokStats = useTikTokStore(selectScreenStats("screen-0"));
  const tikTokRoomId = useTikTokStore(selectScreenRoomId("screen-0"));
  const tikTokIsReconnecting = useTikTokStore(selectScreenIsReconnecting("screen-0"));
  const tikTokReconnectAttempts = useTikTokStore(selectScreenReconnectAttempts("screen-0"));
  const tikTokLastError = useTikTokStore(selectScreenLastError("screen-0"));
  const tikTokIsRateLimited = useTikTokStore(selectScreenIsRateLimited("screen-0"));
  const tikTokServerRetryUntil = useTikTokStore(selectScreenServerRetryUntil("screen-0"));

  // Countdown timer for rate-limit cooldown — derives from authoritative serverRetryUntil
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownEndRef = useRef<number>(0);

  useEffect(() => {
    if (tikTokIsRateLimited && tikTokServerRetryUntil && tikTokServerRetryUntil > Date.now()) {
      // Use serverRetryUntil as the single authoritative deadline
      cooldownEndRef.current = tikTokServerRetryUntil;
      const initialRemaining = Math.max(0, Math.ceil((tikTokServerRetryUntil - Date.now()) / 1000));
      setCooldownRemaining(initialRemaining);
      console.log(`[TIKTOK-RATE-LIMIT-TRACE] UI remaining calculation`, JSON.stringify({
        screenId: 'screen-0',
        now: Date.now(),
        nowIso: new Date(Date.now()).toISOString(),
        inputValue: tikTokServerRetryUntil,
        inputValueIso: new Date(tikTokServerRetryUntil).toISOString(),
        source: "Zustand store (serverRetryUntil)",
        unit: "epoch milliseconds",
        outputValue: initialRemaining,
        outputUnit: "seconds (displayed in UI)",
        calculation: `(serverRetryUntil ${tikTokServerRetryUntil} - Date.now() ${Date.now()}) / 1000 = ${initialRemaining}`,
        sanityCheck: initialRemaining > 86400 ? "WARNING: > 24 hours display — serverRetryUntil is likely a wrong value" : "within 24h",
      }));
      console.log(`[TIKTOK-RATE-LIMIT-UI-AUDIT] state sync`, JSON.stringify({
        screenId: 'screen-0',
        serverRetryUntil: new Date(tikTokServerRetryUntil).toISOString(),
        serverRetryRemainingMs: tikTokServerRetryUntil - Date.now(),
        connectAllowed: false,
      }));
      const interval = setInterval(() => {
        const remaining = Math.max(0, Math.ceil((cooldownEndRef.current - Date.now()) / 1000));
        setCooldownRemaining(remaining);
        if (remaining <= 0) {
          clearInterval(interval);
          console.log(`[TIKTOK-RATE-LIMIT-UI-AUDIT] cooldown expired`, JSON.stringify({
            screenId: 'screen-0',
            connectAllowed: true,
          }));
        }
      }, 1000);
      return () => clearInterval(interval);
    } else {
      setCooldownRemaining(0);
    }
  }, [tikTokIsRateLimited, tikTokServerRetryUntil]);

  // Section navigation is managed by activeSection state, not URL hash.
  // HashRouter uses the hash for route matching, so we cannot use it for sub-navigation.
  const getInitialSection = (): Section => "tiktok";
  const [activeSection, setActiveSection] = useState<Section>(getInitialSection);
  const [saved, setSaved] = useState(false);
  const [obsStatus, setObsStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [sbStatus, setSbStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [mcStatus, setMcStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");
  const [spotifyStatus, setSpotifyStatus] = useState<"idle" | "connecting" | "ok" | "fail">("idle");
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseEmail, setLicenseEmail] = useState("");
  const [licenseMsg, setLicenseMsg] = useState("");
  const [showLevels, setShowLevels] = useState(false);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [isConnectingManual, setIsConnectingManual] = useState(false);
  const inFlightManualConnect = useRef(false);

  const showPw = (key: string) => showPasswords[key] || false;
  const togglePw = (key: string) => setShowPasswords(p => ({ ...p, [key]: !p[key] }));

  /** Helper: update a single field in setupConfig — auto-persists via Zustand persist middleware */
  const setField = <K extends keyof typeof setupConfig>(key: K, value: (typeof setupConfig)[K]) => {
    updateSetupConfig({ [key]: value });
    // Reverse-sync TikTok username to current Stream Profile
    if (key === "tikTokName" && typeof value === "string") {
      const currentProfileId = useAppStore.getState().currentProfileId;
      if (currentProfileId) {
        useAppStore.getState().updateProfile(currentProfileId, { tiktokUsername: value });
      }
    }
  };

  // ══ Backend Sync — called by "Save Changes" button ══
  const handleSave = async () => {
    // Validate required fields
    if (!setupConfig.tikTokName.trim()) {
      toast("TikTok username is required", "error");
      return;
    }
    if (setupConfig.pointsGift < 1 || setupConfig.pointsLike < 1 || setupConfig.pointsFollow < 1 ||
        setupConfig.pointsComment < 1 || setupConfig.pointsShare < 1 || setupConfig.pointsSubscribe < 1) {
      toast("Points values must be at least 1", "error");
      return;
    }
    if (setupConfig.levelPoints < 1) {
      toast("Base points must be at least 1", "error");
      return;
    }
    if (setupConfig.levelMultiplier < 1) {
      toast("Level multiplier must be at least 1", "error");
      return;
    }
    if (setupConfig.obsPort && (setupConfig.obsPort < 1 || setupConfig.obsPort > 65535)) {
      toast("OBS port must be between 1 and 65535", "error");
      return;
    }
    if (setupConfig.sbPort && (setupConfig.sbPort < 1 || setupConfig.sbPort > 65535)) {
      toast("Streamer.bot port must be between 1 and 65535", "error");
      return;
    }
    if (setupConfig.mcPort && (setupConfig.mcPort < 1 || setupConfig.mcPort > 65535)) {
      toast("Minecraft port must be between 1 and 65535", "error");
      return;
    }

    // Sync points config
    updatePointsConfig({
      currencyName: setupConfig.currencyName,
      pointsGift: setupConfig.pointsGift,
      pointsLike: setupConfig.pointsLike,
      pointsFollow: setupConfig.pointsFollow,
      pointsComment: setupConfig.pointsComment,
      pointsShare: setupConfig.pointsShare,
      subBonus: setupConfig.subBonus,
      levelPoints: setupConfig.levelPoints,
      levelMultiplier: setupConfig.levelMultiplier,
    });

    // Sync config to backend modules
    const a = api();
    if (a) {
      try {
        a.syncPointsConfig(setupConfig);
        // OBS host/port are user-configurable (defaults 127.0.0.1:4455)
        a.obsSetConfig({ obsIp: setupConfig.obsIp, obsPort: setupConfig.obsPort, obsPassword: setupConfig.obsPassword });
        a.sbSetConfig({ sbAddress: setupConfig.sbAddress, sbPort: setupConfig.sbPort, sbEndpoint: setupConfig.sbEndpoint });
        a.mcSetConfig({ mcMode: setupConfig.mcMode, mcPlayer: setupConfig.mcPlayer, mcIp: setupConfig.mcIp, mcPort: setupConfig.mcPort, mcPassword: setupConfig.mcPassword });
        if (setupConfig.spotifyClientId) {
          a.spotifySetConfig({ clientId: setupConfig.spotifyClientId, redirectUri: `http://127.0.0.1:18890/callback` });
        }
      } catch {
        // Backend sync failed — settings are still saved in Zustand
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast("Settings synced to backend!", "success");

    // Connect to TikTok LIVE (non-blocking, runs in main process)
    if (setupConfig.tikTokName.trim()) {
      const username = setupConfig.tikTokName.trim();
      const screenState = useTikTokStore.getState().screens['screen-0'];
      const isCurrentlyRateLimited = screenState?.isRateLimited
        && screenState?.serverRetryUntil
        && screenState.serverRetryUntil > Date.now();
      if (isCurrentlyRateLimited) {
        console.log(`[TIKTOK-UI] Save skipped connect — rate limit active`, JSON.stringify({
          screenId: 'screen-0',
          serverRetryUntil: new Date(screenState.serverRetryUntil!).toISOString(),
          remainingSec: Math.ceil((screenState.serverRetryUntil! - Date.now()) / 1000),
        }));
      } else {
        console.log(`[TIKTOK-UI] Settings connect requested for screen-0: ${username}`);
        const a = api();
        if (!a) {
          console.error('[TIKTOK-UI] electronAPI unavailable — TikTok LIVE requires desktop app');
        } else {
          a.connectTikTokScreen("screen-0", username).then((result: unknown) => {
            console.log(`[TIKTOK-UI] Settings save connect result:`, result);
            if (result && typeof result === 'object' && 'isRateLimit' in result && result.isRateLimit) {
              console.log(`[TIKTOK-RATE-LIMIT-CLEAR-TRACE]`, JSON.stringify({
                source: "settings-connect-result-rate-limited",
                screenId: "screen-0",
                now: Date.now(),
                serverRetryUntilBeforeClear: useTikTokStore.getState().screens['screen-0']?.serverRetryUntil,
                remainingMs: useTikTokStore.getState().screens['screen-0']?.serverRetryUntil
                  ? Math.max(0, useTikTokStore.getState().screens['screen-0'].serverRetryUntil! - Date.now())
                  : null,
                isRateLimitedBeforeClear: useTikTokStore.getState().screens['screen-0']?.isRateLimited,
                reason: "IPC connect returned rate-limit error, should NOT clear store",
              }));
            }
          }).catch((err: unknown) => {
            console.error(`[TIKTOK-UI] Settings save connect failed:`, err);
          });
        }
      }
    }
  };

  // Level preview
  const levelPreview: { level: number; required: number; cumulative: number }[] = [];
  if (setupConfig.levelPoints > 0) {
    let cumulative = 0;
    for (let lv = 1; lv <= 20; lv++) {
      const req = lv === 1 ? 0 : Math.round(setupConfig.levelPoints * Math.pow(setupConfig.levelMultiplier, lv - 2));
      cumulative += req;
      levelPreview.push({ level: lv, required: req, cumulative });
    }
  }

  // Test OBS — controller.testConnection leaves OBS actually connected.
  // Uses the configured IP/port from Settings (defaults 127.0.0.1:4455).
  const testOBS = async () => {
    setObsStatus("testing");
    const a = api();
    if (a) {
      try {
        a.obsSetConfig({ obsIp: setupConfig.obsIp, obsPort: setupConfig.obsPort, obsPassword: setupConfig.obsPassword });
        const result = await a.obsTest({ ip: setupConfig.obsIp, port: setupConfig.obsPort, password: setupConfig.obsPassword });
        const ok = !!result?.success;
        setObsStatus(ok ? "ok" : "fail");
        // Defensive: also push into the shared store (event path is primary)
        if (ok) useAppStore.getState().setObsConnected(true);
        if (result?.success) {
          toast("OBS connected successfully!", "success");
        } else {
          toast(result?.error || "OBS connection failed", "error");
        }
      } catch (e) {
        setObsStatus("fail");
        toast("OBS connection error: " + (e instanceof Error ? e.message : "Unknown error"), "error");
      }
    } else {
      setObsStatus("fail");
      toast("Electron API not available — run in Electron to test OBS", "error");
    }
  };

  // Test Streamer.bot
  const testSB = async () => {
    setSbStatus("testing");
    const a = api();
    if (a) {
      try {
        a.sbSetConfig({ sbAddress: setupConfig.sbAddress, sbPort: setupConfig.sbPort, sbEndpoint: setupConfig.sbEndpoint });
        const result = await a.sbTest({ address: setupConfig.sbAddress, port: setupConfig.sbPort, endpoint: setupConfig.sbEndpoint });
        setSbStatus(result?.success ? "ok" : "fail");
        if (result?.success) {
          toast("Streamer.bot connected successfully!", "success");
        } else {
          toast(result?.error || "Streamer.bot connection failed", "error");
        }
      } catch (e) {
        setSbStatus("fail");
        toast("Streamer.bot connection error: " + (e instanceof Error ? e.message : "Unknown error"), "error");
      }
    } else {
      setSbStatus("fail");
      toast("Electron API not available — run in Electron to test Streamer.bot", "error");
    }
  };

  // Test Minecraft
  const testMC = async () => {
    setMcStatus("testing");
    const a = api();
    if (a) {
      try {
        a.mcSetConfig({ mcMode: setupConfig.mcMode, mcPlayer: setupConfig.mcPlayer, mcIp: setupConfig.mcIp, mcPort: setupConfig.mcPort, mcPassword: setupConfig.mcPassword });
        const result = await a.mcTest({ ip: setupConfig.mcIp, port: setupConfig.mcPort, password: setupConfig.mcPassword, mode: setupConfig.mcMode });
        setMcStatus(result?.success ? "ok" : "fail");
        if (result?.success) {
          toast("Minecraft connected successfully!", "success");
        } else {
          toast(result?.error || "Minecraft connection failed", "error");
        }
      } catch (e) {
        setMcStatus("fail");
        toast("Minecraft connection error: " + (e instanceof Error ? e.message : "Unknown error"), "error");
      }
    } else {
      setMcStatus("fail");
      toast("Electron API not available — run in Electron to test Minecraft", "error");
    }
  };

  // Connect Spotify
  const connectSpotify = async () => {
    setSpotifyStatus("connecting");
    const a = api();
    if (a) {
      try {
        a.spotifySetConfig({ clientId: setupConfig.spotifyClientId, redirectUri: `http://127.0.0.1:18890/callback` });
        const result = await a.spotifyAuth({ clientId: setupConfig.spotifyClientId });
        setSpotifyStatus(result?.success ? "ok" : "fail");
        if (result?.success) {
          toast("Connected to Spotify!", "success");
        } else {
          toast(result?.error || "Spotify connection failed", "error");
        }
      } catch (e) {
        setSpotifyStatus("fail");
        toast("Spotify connection error: " + (e instanceof Error ? e.message : "Unknown error"), "error");
      }
    } else {
      setSpotifyStatus("fail");
      toast("Electron API not available — run in Electron to connect Spotify", "error");
    }
  };

  // Activate License
  const activateLicense = async () => {
    const pattern = /^ROSAE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
    if (!pattern.test(licenseKey.toUpperCase())) {
      setLicenseMsg("Invalid format. Use: ROSAE-XXXX-XXXX-XXXX");
      return;
    }

    const a = api();
    if (a) {
      try {
        setLicenseMsg("Activating...");
        const result = await a.licenseActivate({ key: licenseKey.toUpperCase(), email: licenseEmail });
        if (result?.success) {
          setLicenseMsg("✅ Pro activated!");
          toast("License activated successfully!", "success");
          const status = await a.licenseStatus();
          if (status) {
            useAppStore.getState().setLicenseInfo({
              isPro: status.isPro || false,
              plan: status.plan || "free",
              limits: status.limits || { actions: 5, customSounds: 3, streamProfiles: 1 },
            });
          }
        } else {
          setLicenseMsg("❌ " + (result?.error || "Activation failed"));
          toast(result?.error || "License activation failed", "error");
        }
      } catch (e) {
        setLicenseMsg("❌ Activation failed");
        toast("License activation error: " + (e instanceof Error ? e.message : "Unknown error"), "error");
      }
    } else {
      setLicenseMsg("Electron API not available — run in Electron to activate license");
      toast("Electron API not available", "error");
    }
  };

  // Reset points
  const resetPoints = () => {
    if (confirm("⚠️ Are you sure you want to reset ALL points to 0? This cannot be undone.")) {
      const { resetAllPoints } = useAppStore.getState();
      resetAllPoints();
      toast("All points have been reset to 0", "success");
    }
  };

  const applyHalving = () => {
    const percent = setupConfig.halvingPercent;
    if (percent < 1 || percent > 100) {
      toast("Halving percentage must be between 1 and 100", "error");
      return;
    }
    if (confirm(`Reduce all points by ${percent}%? This cannot be undone.`)) {
      const { halvePoints } = useAppStore.getState();
      halvePoints(percent);
      toast(`Points reduced by ${percent}%`, "success");
    }
  };

  // ── UUID validation for browserSourceId preservation ──
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // ── Import (v1 + v2 + v3) ──
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast("Please select a JSON file", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);

        // ── Detect version ──

        // ═══ V4: Complete portable profile package ═══
        if (isProfilePackage(data)) {
          const targetId = useAppStore.getState().currentProfileId;
          if (!targetId) throw new Error('No active destination profile');
          const imported = await importProfilePackage(data, targetId);
          const target = useAppStore.getState().streamProfiles.find((p) => p.id === targetId);
          if (!target) throw new Error('Destination profile no longer exists');
          const existingActionIds = new Set(target.actions.map((action) => action.id));
          const actionsForMediaPack = imported.actions.map((action) => {
            const sourceActionId = imported.package.profile.actions.find((candidate) => candidate.id === action.id)?.id ?? action.id;
            const enriched = { ...action } as Record<string, unknown>;
            for (const type of ['sound', 'video', 'image'] as const) {
              const row = imported.package.mediaFiles.find((candidate) => candidate.actionId === sourceActionId && candidate.type === type);
              if (row) enriched[`${type}MediaRef`] = row.mediaRef || row.id;
            }
            return enriched;
          });
          const prepared = await importActionPackWithDexie({
            format: 'rosaefinity-action-pack', version: 1, exportedAt: imported.package.exportedAt,
            actions: actionsForMediaPack,
            mediaAssets: imported.package.mediaAssets,
          }, existingActionIds);
          // importActionPackWithDexie remaps action/media IDs and creates safe pointer rows.
          const existingSoundIds = new Set(useAppStore.getState().customSounds.map((sound) => sound.id));
          const importedSounds = imported.customSounds.map((sound) => {
            if (!existingSoundIds.has(sound.id)) {
              existingSoundIds.add(sound.id);
              return sound;
            }
            let id = '';
            do {
              id = `snd_${Math.random().toString(36).slice(2, 10)}`;
            } while (existingSoundIds.has(id));
            existingSoundIds.add(id);
            return { ...sound, id };
          });
          try {
            await persistImportedMediaRows(prepared.mediaRows);
            await importMediaLibrary({
              sounds: importedSounds.map((sound) => ({
                id: sound.id,
                name: sound.name,
                file: sound.file,
                fileName: sound.fileName,
                profileId: targetId,
              })),
            });
            let profileCommitted = false;
            useAppStore.setState((state) => {
              const profile = state.streamProfiles.find((p) => p.id === targetId);
              if (!profile) return state;
              profileCommitted = true;
              const customSounds = [...state.customSounds, ...importedSounds];
              const importedActions = prepared.actions as Action[];
              const nextProfile = { ...profile, actions: [...profile.actions, ...importedActions], events: [...profile.events, ...imported.events], customSounds, updatedAt: new Date().toISOString() };
              return { streamProfiles: state.streamProfiles.map((item) => item.id === targetId ? nextProfile : item), actions: [...state.actions, ...importedActions], events: [...state.events, ...imported.events], customSounds };
            });
            if (!profileCommitted) throw new Error('Destination profile no longer exists');
          } catch (commitErr) {
            await db.mediaFiles.bulkDelete(prepared.mediaRows.map((row) => row.id)).catch(() => undefined);
            await db.sounds.bulkDelete(importedSounds.map((sound) => sound.id)).catch(() => undefined);
            throw commitErr;
          }
          toast(`Imported ${imported.actions.length} action(s), ${imported.events.length} event(s), and ${imported.package.mediaAssets.length} media asset(s)`, "success");
          return;
        }

        // ═══ V3: Portable per-profile import ═══
        if (data.format === 'rosaefinity-profile' && data.version === 3) {
          const errors: string[] = [];

          // 0. Restore mediaAssets to Dexie BEFORE applying profile actions
          //    so imported Action media references resolve immediately.
          //    Old v3 exports without mediaAssets skip this block entirely.
          if (Array.isArray(data.mediaAssets) && data.mediaAssets.length > 0) {
            try {
              const packLike = {
                format: "rosaefinity-action-pack" as const,
                version: 1 as const,
                exportedAt: data.exportedAt || new Date().toISOString(),
                actions: (data.profile?.actions as Array<Record<string, unknown>>) ?? [],
                mediaAssets: data.mediaAssets as Array<Record<string, unknown>>,
              };
              const existingIds = new Set(
                (useAppStore.getState().actions ?? []).map((a) => a.id),
              );
              // Restore media under original action ids from the export when free
              const mediaResult = await importActionPackWithDexie(packLike as any, existingIds);
              // Only persist media rows for assets whose actionId matches profile actions
              // (profile import keeps original action ids when free — merge-by-id path)
              const profileActionIds = new Set(
                ((data.profile?.actions as Array<{ id?: string }>) ?? []).map((a) => String(a.id ?? "")),
              );
              const rowsForProfile = mediaResult.mediaRows.filter(
                (r) => !r.actionId || profileActionIds.has(r.actionId) || !r.actionId,
              );
              await persistImportedMediaRows(rowsForProfile.length > 0 ? rowsForProfile : mediaResult.mediaRows);
              console.log("[MEDIA-IMPORT-PROFILE]", JSON.stringify({
                mediaAssets: data.mediaAssets.length,
                restored: mediaResult.restoredMediaAssets,
                reused: mediaResult.reusedMediaAssets,
              }));
            } catch (mediaErr) {
              errors.push(`Media: ${mediaErr instanceof Error ? mediaErr.message : 'unknown error'}`);
            }
          }

          // 1. Apply profile configuration to currently active profile
          try {
            useAppStore.getState().applyProfileImport(data.profile);
          } catch (err) {
            errors.push(`Profile: ${err instanceof Error ? err.message : 'unknown error'}`);
          }

          // 2. Goals — with DatabaseClosedError recovery
          let recoveredDb: Awaited<ReturnType<typeof reopenDatabase>> | null = null;
          if (Array.isArray(data.profile?.goals)) {
            try {
              const currentUserId = useAuthStore.getState().currentUser?.id;
              const currentProfileId = useAppStore.getState().currentProfileId;
              const goalsWithOwner = data.profile.goals.map((g: Record<string, unknown>) => ({
                ...g,
                userId: currentUserId,
              }));
              try {
                await importGoals(goalsWithOwner);
              } catch (dexieErr) {
                if (dexieErr instanceof Error && dexieErr.name === 'DatabaseClosedError') {
                  recoveredDb = await reopenDatabase();
                  await importGoals(goalsWithOwner, recoveredDb);
                } else {
                  throw dexieErr;
                }
              }
              await useGoalStore.getState().loadGoals();
            } catch (err) {
              errors.push(`Goals: ${err instanceof Error ? err.message : 'unknown error'}`);
            }
          }

          // 3. Overlays — remap profileId to active target profile
          if (Array.isArray(data.profile?.overlays)) {
            try {
              const currentUserId = useAuthStore.getState().currentUser?.id;
              const currentProfileId = useAppStore.getState().currentProfileId;
              const now = Date.now();

              const rows = data.profile.overlays.map((o: Record<string, unknown>) => ({
                id: o.id as string,
                name: o.name as string,
                moduleId: o.moduleId as string,
                enabled: o.enabled as number,
                browserSourceId: UUID_RE.test(o.browserSourceId as string)
                  ? (o.browserSourceId as string)
                  : crypto.randomUUID(),
                config: typeof o.config === 'string' ? o.config : JSON.stringify(o.config ?? {}),
                configVersion: (o.configVersion as number) ?? 1,
                createdAt: String(o.createdAt ?? now),
                updatedAt: String(o.updatedAt ?? now),
                userId: currentUserId,
                profileId: currentProfileId,
              }));
              try {
                await importOverlays(rows);
              } catch (dexieErr) {
                if (dexieErr instanceof Error && dexieErr.name === 'DatabaseClosedError') {
                  if (!recoveredDb) recoveredDb = await reopenDatabase();
                  await importOverlays(rows, recoveredDb);
                } else {
                  throw dexieErr;
                }
              }
              await useOverlayInstanceStore.getState().loadInstances();
            } catch (err) {
              errors.push(`Overlays: ${err instanceof Error ? err.message : 'unknown error'}`);
            }
          }

          if (errors.length > 0) {
            toast(`Imported with errors: ${errors.join('; ')}`, "error");
          } else {
            toast("Profile imported successfully!", "success");
          }
          return;
        }

        // [REAL-IMPORT-PARSED] Parsed JSON snapshot (legacy)
        if (data.version === 2 && Array.isArray(data.profiles)) {
          console.log('[REAL-IMPORT-PARSED]', JSON.stringify({
            profiles: data.profiles.map((p: Record<string, unknown>) => ({
              profileId: p.id,
              profileName: p.name,
              actionCount: (p.actions as unknown[])?.length ?? 0,
              actionIds: (p.actions as unknown[])?.map((a: Record<string, unknown>) => a.id) ?? [],
            })),
          }));
        }

        // ── Detect version ──
        if (data.version === 2) {
          // ═══ V2: Full portable backup ═══
          const errors: string[] = [];

          // 1. App config
          if (data.app?.setupConfig) {
            updateSetupConfig(data.app.setupConfig);
          }
          if (data.app?.pointsConfig) {
            updatePointsConfig(data.app.pointsConfig);
          }

          // 2. Profiles
          if (Array.isArray(data.profiles)) {
            try {
              useAppStore.getState().importProfilesByName(data.profiles);
            } catch (err) {
              errors.push(`Profiles: ${err instanceof Error ? err.message : 'unknown error'}`);
            }
          }

          // 3. Goals — with DatabaseClosedError recovery
          let recoveredDb: Awaited<ReturnType<typeof reopenDatabase>> | null = null;
          if (Array.isArray(data.goals)) {
            try {
              const currentUserId = useAuthStore.getState().currentUser?.id;
              const goalsWithUser = data.goals.map((g: Record<string, unknown>) => ({
                ...g,
                userId: currentUserId,
              }));
              try {
                await importGoals(goalsWithUser);
              } catch (dexieErr) {
                if (dexieErr instanceof Error && dexieErr.name === 'DatabaseClosedError') {
                  recoveredDb = await reopenDatabase();
                  await importGoals(goalsWithUser, recoveredDb);
                } else {
                  throw dexieErr;
                }
              }
              await useGoalStore.getState().loadGoals();
            } catch (err) {
              errors.push(`Goals: ${err instanceof Error ? err.message : 'unknown error'}`);
            }
          }

          // 4. Overlays — with DatabaseClosedError recovery (reuses recoveredDb if available)
          if (Array.isArray(data.overlays)) {
            try {
              const currentUserId = useAuthStore.getState().currentUser?.id;
              const now = Date.now();
              // Build a mapping from exported profile name → imported profile ID
              const importedProfiles = useAppStore.getState().streamProfiles;
              const profileNameToId = new Map<string, string>();
              for (const p of importedProfiles) {
                profileNameToId.set(p.name, p.id);
              }

              const rows = data.overlays.map((o: Record<string, unknown>) => ({
                id: o.id as string,
                name: o.name as string,
                moduleId: o.moduleId as string,
                enabled: o.enabled as number,
                // Preserve exported UUID browserSourceId exactly; only generate new UUID for legacy/missing values
                browserSourceId: UUID_RE.test(o.browserSourceId as string)
                  ? (o.browserSourceId as string)
                  : crypto.randomUUID(),
                config: typeof o.config === 'string' ? o.config : JSON.stringify(o.config ?? {}),
                configVersion: (o.configVersion as number) ?? 1,
                createdAt: String(o.createdAt ?? now),
                updatedAt: String(o.updatedAt ?? now),
                userId: currentUserId,
                profileId: (o._sourceProfileName as string)
                  ? (profileNameToId.get(o._sourceProfileName as string) ?? undefined)
                  : undefined,
              }));
              try {
                await importOverlays(rows);
              } catch (dexieErr) {
                if (dexieErr instanceof Error && dexieErr.name === 'DatabaseClosedError') {
                  if (!recoveredDb) recoveredDb = await reopenDatabase();
                  await importOverlays(rows, recoveredDb);
                } else {
                  throw dexieErr;
                }
              }
              await useOverlayInstanceStore.getState().loadInstances();
            } catch (err) {
              errors.push(`Overlays: ${err instanceof Error ? err.message : 'unknown error'}`);
            }
          }

          // 5. Theme
          if (data.theme) {
            try {
              if (data.theme.mode) useThemeStore.setState({ mode: data.theme.mode });
              if (data.theme.customTheme) useThemeStore.setState({ customTheme: data.theme.customTheme });
              // Restore registered themes (user-created custom themes)
              if (Array.isArray(data.theme.registeredThemes)) {
                for (const theme of data.theme.registeredThemes) {
                  useThemeStore.getState().registerTheme(theme);
                }
              }
              // Resolve currentThemeId → full theme object
              if (data.theme.currentThemeId) {
                const resolved = useThemeStore.getState().getTheme(data.theme.currentThemeId);
                if (resolved) {
                  useThemeStore.setState({ currentTheme: resolved });
                }
              }
            } catch (err) {
              errors.push(`Theme: ${err instanceof Error ? err.message : 'unknown error'}`);
            }
          }

          // 6. Coin Jar
          if (data.coinJar) {
            try {
              useCoinJarStore.setState({ config: data.coinJar });
            } catch (err) {
              errors.push(`Coin Jar: ${err instanceof Error ? err.message : 'unknown error'}`);
            }
          }

          // 7. UI preferences
          if (data.ui) {
            try {
              if (Array.isArray(data.ui.overlayFavorites)) {
                useOverlayInstanceStore.setState({ favoriteIds: new Set(data.ui.overlayFavorites) });
              }
              if (Array.isArray(data.ui.activeOverlays)) {
                useActiveOverlayStore.setState({ activeOverlays: data.ui.activeOverlays });
              }
              if (typeof data.ui.overlayAspectRatio === 'string') {
                localStorage.setItem('rf-overlay_aspectRatio', data.ui.overlayAspectRatio);
              }
            } catch (err) {
              errors.push(`UI: ${err instanceof Error ? err.message : 'unknown error'}`);
            }
          }

          if (errors.length > 0) {
            toast(`Imported with errors: ${errors.join('; ')}`, "error");
          } else {
            toast("Settings imported successfully!", "success");
          }
        } else {
          // ═══ V1: Legacy (setupConfig + pointsConfig only) ═══
          if (!data.setupConfig && !data.pointsConfig) {
            toast("Invalid settings file — missing setupConfig or pointsConfig", "error");
            return;
          }

          if (data.setupConfig) {
            if (typeof data.setupConfig.tikTokName !== "string") {
              toast("Invalid settings file — tikTokName must be a string", "error");
              return;
            }
            updateSetupConfig(data.setupConfig);
          }

          if (data.pointsConfig) {
            if (typeof data.pointsConfig.pointsGift !== "number" || data.pointsConfig.pointsGift < 1) {
              toast("Invalid settings file — pointsGift must be a positive number", "error");
              return;
            }
            updatePointsConfig(data.pointsConfig);
          }

          toast("Settings imported successfully!", "success");
        }
      } catch {
        toast("Invalid JSON file format", "error");
      }
    };
    reader.onerror = () => {
      toast("Failed to read file", "error");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Export (V3 — portable per-active-profile) ──
  const handleExport = async () => {
    try {
      const state = useAppStore.getState();
      const activeProfile = state.streamProfiles.find(p => p.id === state.currentProfileId);
      if (!activeProfile) {
        toast("No active profile to export", "error");
        return;
      }

      // Read Dexie data for profile-associated goals and overlays
      let activeDb = db;
      let goals: Awaited<ReturnType<typeof db.goals.toArray>> = [];
      let overlayRows: Awaited<ReturnType<typeof db.overlays.toArray>> = [];
      try {
        goals = await activeDb.goals.toArray();
        overlayRows = await activeDb.overlays.toArray();
      } catch (dexieErr) {
        const isClosed = dexieErr instanceof Error && dexieErr.name === 'DatabaseClosedError';
        if (isClosed) {
          console.warn('[EXPORT] Dexie closed, attempting recovery via fresh instance...');
          activeDb = await reopenDatabase();
          goals = await activeDb.goals.toArray();
          overlayRows = await activeDb.overlays.toArray();
        } else {
          throw dexieErr;
        }
      }

      // Sync active profile's top-level state back into profile object
      const syncedProfile = {
        ...activeProfile,
        actions: state.actions,
        events: state.events,
        alertsSettings: state.alertSettings,
        tiktokUsername: state.setupConfig.tikTokName,
      };

      // Filter goals to those referenced by active profile's actions
      const actionIds = new Set(syncedProfile.actions?.map(a => a.id) ?? []);
      const profileGoals = goals
        .filter(g => !g.actionId || actionIds.has(g.actionId))
        .map(({ userId, ...g }) => g);

      // Filter overlays to those belonging to this profile
      const profileOverlays = overlayRows
        .filter(o => o.profileId === state.currentProfileId)
        .map(({ userId, profileId, ...o }) => o);

      // Complete v4 package includes all action/event/library data and Dexie media bytes.
      const profilePackage = await exportProfilePackage(
        syncedProfile,
        syncedProfile.actions ?? [],
        syncedProfile.events ?? [],
        (state.customSounds ?? []).filter((sound) => sound.profileId === state.currentProfileId),
      );

      // Additive portable mediaAssets — large blobs stay out of action JSON;
      // they ride in mediaAssets for self-contained profile packages.
      let mediaAssets: Awaited<ReturnType<typeof collectProfileMediaAssetsFromDexie>> = [];
      try {
        mediaAssets = await collectProfileMediaAssetsFromDexie(
          (syncedProfile.actions ?? []) as Array<Record<string, unknown>>,
        );
      } catch (mediaErr) {
        console.warn("[EXPORT] mediaAssets collection failed (export continues without media):", mediaErr);
      }

      const exportData = {
        ...profilePackage,
        profile: {
          ...profilePackage.profile,
          goals: profileGoals,
          overlays: profileOverlays,
        },
        sourceProfile: {
          id: syncedProfile.id,
          name: syncedProfile.name,
        },
        mediaAssets: [...profilePackage.mediaAssets, ...mediaAssets.filter((asset) => !profilePackage.mediaAssets.some((existing) => existing.mediaId === asset.mediaId))],
        goals: profileGoals,
        overlays: profileOverlays,
      };
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rosaefinity-profile-${syncedProfile.name.replace(/\s+/g, '-')}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast("Profile exported!", "success");
    } catch (err) {
      console.error('[EXPORT] Failed:', err);
      toast("Export failed", "error");
    }
  };

  const sectionContent = () => {
    switch (activeSection) {
      // ═══ TIKTOK ════════════════════════════════════════════
      case "tiktok": {
        const isConnected = tikTokStatus === "connected";
        const isReconnecting = tikTokIsReconnecting;
        // Use serverRetryUntil as the single authoritative check
        const isRateLimited = tikTokIsRateLimited && tikTokServerRetryUntil && tikTokServerRetryUntil > Date.now();
        const serverRetryRemainingSec = isRateLimited ? Math.max(0, Math.ceil((tikTokServerRetryUntil! - Date.now()) / 1000)) : 0;

        // [TIKTOK-DISCONNECT-TRACE][UI] Render-time state audit
        console.log(`[TIKTOK-DISCONNECT-TRACE][STATE]`, JSON.stringify({
          screenId: "screen-0",
          tikTokStatus,
          isConnected,
          tikTokUsername,
          tikTokRoomId,
          isReconnecting: tikTokIsReconnecting,
          isRateLimited,
        }));

        // Log button state for audit
        console.log(`[TIKTOK-RATE-LIMIT-UI-AUDIT] button state`, JSON.stringify({
          screenId: "screen-0",
          disabled: !setupConfig.tikTokName.trim() || isRateLimited,
          reason: isRateLimited ? `server rate limit active, ${serverRetryRemainingSec}s remaining` : "ready",
          serverRetryUntil: tikTokServerRetryUntil ? new Date(tikTokServerRetryUntil).toISOString() : null,
        }));

        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">🎵 TikTok LIVE Connection</h3>
              <p className="text-sm text-white/50 mt-1">Connect to a TikTok LIVE session to receive events</p>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5 space-y-4">
              <label className="block text-sm font-medium text-white/70">TikTok Username</label>
              <input
                type="text"
                value={setupConfig.tikTokName}
                onChange={e => setField("tikTokName", e.target.value)}
                placeholder="Enter TikTok username (without @)"
                className="w-full px-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-lg text-white/90 placeholder:text-white/25 focus:outline-none focus:border-primary/40 transition-colors"
              />
              <div className="flex items-center gap-3">
                {isConnected ? (
                  <Button size="sm" variant="danger"
                    onClick={() => {
                      const beforeStatus = useTikTokStore.getState().screens["screen-0"];
                      console.log(`[TIKTOK-DISCONNECT-TRACE][UI]`, JSON.stringify({
                        screenId: "screen-0",
                        beforeStatus: beforeStatus?.status,
                        beforeUsername: beforeStatus?.username,
                        action: "Disconnect clicked",
                      }));
                      const a = api();
                      a?.disconnectTikTokScreen("screen-0")?.then(() => {
                        const afterStatus = useTikTokStore.getState().screens["screen-0"];
                        console.log(`[TIKTOK-DISCONNECT-TRACE][UI]`, JSON.stringify({
                          screenId: "screen-0",
                          afterStatus: afterStatus?.status,
                          afterUsername: afterStatus?.username,
                          action: "IPC returned success",
                        }));
                      })?.catch((err: unknown) => {
                        console.error(`[TIKTOK-UI] Disconnect failed:`, err);
                      });
                    }}>
                    Disconnect
                  </Button>
                ) : (
                  <Button size="sm"
                    onClick={async () => {
                      // FRONTEND COOLDOWN GUARD — uses same authoritative deadline as backend
                      if (isRateLimited) {
                        console.log(`[TIKTOK-CONNECT-GUARD] frontend blocked`, JSON.stringify({
                          screenId: "screen-0",
                          isRateLimited: true,
                          serverRetryUntil: tikTokServerRetryUntil ? new Date(tikTokServerRetryUntil).toISOString() : null,
                          serverRetryRemainingSec,
                        }));
                        return;
                      }

                      // Prevent duplicate manual Connect while a request is in-flight
                      if (inFlightManualConnect.current) {
                        console.log(`[TIKTOK-UI] Connect ignored — manual request already in progress`, {
                          screenId: "screen-0",
                        });
                        return;
                      }

                      // Mark manual connection as in-flight
                      inFlightManualConnect.current = true;
                      setIsConnectingManual(true);

                      console.log(`[TIKTOK-UI] Connect clicked`);
                      const username = setupConfig.tikTokName.trim();
                      if (!username) {
                        inFlightManualConnect.current = false;
                        setIsConnectingManual(false); // Release lock if username is empty
                        return;
                      }
                      const a = api();
                      if (!a) {
                        console.error('[TIKTOK-UI] electronAPI is not available — TikTok LIVE connection requires the RosaeFinity desktop app');
                        toast('TikTok LIVE connection is only available in the RosaeFinity desktop application.', 'error');
                        inFlightManualConnect.current = false;
                        setIsConnectingManual(false); // Release lock if API is unavailable
                        return;
                      }
                      console.log(`[TIKTOK-CONNECT-TRACE] connect button clicked`, JSON.stringify({
                        screenId: 'screen-0',
                        username,
                        preClickIsRateLimited: tikTokIsRateLimited,
                        preClickServerRetryUntil: tikTokServerRetryUntil,
                        preClickStoreState: useTikTokStore.getState().screens['screen-0'],
                      }));
                      console.log(`[TIKTOK-UI] invoking IPC tiktok:connect screenId=screen-0 username=${username}`);
                      try {
                        const result: unknown = await a.connectTikTokScreen("screen-0", username);
                        console.log(`[TIKTOK-CONNECT-TRACE] IPC result received`, JSON.stringify({ screenId: 'screen-0', result }));
                        const r = result as { success?: boolean; error?: string; isRateLimit?: boolean; cooldownRemainingMs?: number; alreadyConnected?: boolean; alreadyConnecting?: boolean } | undefined;

                        if (!r || r.success === false) {
                          // Service returned an explicit failure
                          if (
                            r &&
                            r.isRateLimit === true &&
                            typeof r.cooldownRemainingMs === "number" &&
                            Number.isFinite(r.cooldownRemainingMs) &&
                            r.cooldownRemainingMs > 0
                          ) {
                            // Defensive store sync: IPC response contains rate-limit cooldown in ms,
                            // convert to absolute deadline (epoch ms) for store
                            useTikTokStore.getState().setScreenRateLimited(
                              "screen-0",
                              true,
                              Date.now() + r.cooldownRemainingMs
                            );
                            toast(`Rate limited. Try again in ${Math.ceil(r.cooldownRemainingMs / 1000)}s`, 'error');
                          } else {
                            toast(r?.error || 'TikTok connection failed', 'error');
                          }
                        } else if (r && (r.alreadyConnected || r.alreadyConnecting)) {
                          console.log(`[TIKTOK-UI] Connection already active or in progress:`, r);
                        }
                        // Note: Successful connection triggers the 'connected' event
                      } catch (err: unknown) {
                        console.error(`[TIKTOK-UI] IPC error:`, err);
                        toast(`TikTok connection failed: ${err instanceof Error ? err.message : String(err)}`, 'error');
                      } finally {
                        // Finalize: Release manual UI lock, guaranteed
                        inFlightManualConnect.current = false;
                        setIsConnectingManual(false);
                      }
                    }}
                    disabled={!setupConfig.tikTokName.trim() || isRateLimited || tikTokStatus === "connecting" || isConnectingManual}>
                    {isRateLimited ? `Rate Limited — ${serverRetryRemainingSec}s` : "Connect"}
                  </Button>
                )}
                {/* TEMPORARY: Test event injection button */}
                {isConnected && (
                  <Button size="sm" variant="secondary" onClick={() => {
                    console.log(`[TIKTOK-TEST] Injecting test GIFT event`);
                    const a = api();
                    if (!a?.injectTikTokTestEvent) {
                      console.error('[TIKTOK-TEST] injectTikTokTestEvent not available');
                      return;
                    }
                    a.injectTikTokTestEvent("screen-0", {
                      type: "gift",
                      user: "test_user",
                      nickname: "TestUser",
                      giftName: "Rose",
                      giftId: 1,
                      repeatCount: 1,
                      diamondCount: 1,
                    })
                      .then((result: unknown) => console.log(`[TIKTOK-TEST] Result:`, result))
                      .catch((err: unknown) => console.error(`[TIKTOK-TEST] Error:`, err));
                  }}>
                    Test Gift
                  </Button>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-success shadow-[0_0_6px_rgba(34,197,94,0.6)]" : isRateLimited ? "bg-red animate-pulse" : isReconnecting ? "bg-amber animate-pulse" : "bg-white/20"}`} />
                  <span className="text-white/50">
                    {isConnected
                      ? `Connected${tikTokUsername ? ` as ${tikTokUsername}` : ""}`
                      : isRateLimited
                        ? `Rate limited — server retry in ${serverRetryRemainingSec}s`
                        : isReconnecting
                          ? `Reconnecting... (attempt ${tikTokReconnectAttempts})`
                          : tikTokLastError
                            ? `Error: ${tikTokLastError}`
                            : "Offline"}
                  </span>
                </div>
              </div>
            </div>

            {/* Connection Status Details */}
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-5">
              <h4 className="text-sm font-semibold text-white/70 mb-3">Connection Status</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-xs text-white/40">Status</span>
                  <span className={`text-xs font-medium ${isConnected ? "text-green" : isRateLimited ? "text-red" : "text-white/30"}`}>
                    {isConnected ? "● Connected" : isRateLimited ? `● Rate Limited (${cooldownRemaining}s)` : "● Offline"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-xs text-white/40">Room ID</span>
                  <span className="text-xs font-mono text-white/60">{tikTokRoomId || "—"}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-xs text-white/40">Viewer Count</span>
                  <span className="text-xs text-white/70">{tikTokViewerCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-xs text-white/40">Gift Count</span>
                  <span className="text-xs text-white/70">{tikTokStats.gifts.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-xs text-white/40">Like Count</span>
                  <span className="text-xs text-white/70">{tikTokStats.likes.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-xs text-white/40">Follow Count</span>
                  <span className="text-xs text-white/70">{tikTokStats.follows.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-xs text-white/40">Share Count</span>
                  <span className="text-xs text-white/70">{tikTokStats.shares.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                  <span className="text-xs text-white/40">Comment Count</span>
                  <span className="text-xs text-white/70">{tikTokStats.comments.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        );
      }

      // ═══ POINTS ════════════════════════════════════════════
      case "points":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">⭐ Points System</h3>
            <SettingRow label="Currency Name" desc="Nama poin kamu">
              <input type="text" value={setupConfig.currencyName} onChange={e => setField("currencyName", e.target.value)}
                className="w-40 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
            </SettingRow>
            <SettingRow label="Points per Gift" desc="Poin setiap gift">
              <input type="number" value={setupConfig.pointsGift} onChange={e => setField("pointsGift", Number(e.target.value))}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <SettingRow label="Points per Like" desc="Poin setiap like">
              <input type="number" value={setupConfig.pointsLike} onChange={e => setField("pointsLike", Number(e.target.value))}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <SettingRow label="Points per Follow" desc="Poin setiap follow">
              <input type="number" value={setupConfig.pointsFollow} onChange={e => setField("pointsFollow", Number(e.target.value))}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <SettingRow label="Points per Comment" desc="Poin setiap komentar">
              <input type="number" value={setupConfig.pointsComment} onChange={e => setField("pointsComment", Number(e.target.value))}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <SettingRow label="Points per Share" desc="Poin setiap share">
              <input type="number" value={setupConfig.pointsShare} onChange={e => setField("pointsShare", Number(e.target.value))}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <SettingRow label="Points per Subscribe" desc="Poin setiap subscription">
              <input type="number" value={setupConfig.pointsSubscribe} onChange={e => setField("pointsSubscribe", Number(e.target.value))}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <SettingRow label="Subscriber Bonus" desc="Bonus % untuk subscriber (0 = no bonus)">
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={200} value={setupConfig.subBonus} onChange={e => setField("subBonus", Number(e.target.value))}
                  className="w-32" />
                <span className="text-sm text-white w-12">{setupConfig.subBonus}%</span>
              </div>
            </SettingRow>
          </div>
        );

      // ═══ LEVELS ═══════════════════════════════════════════
      case "levels":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">📈 Level Settings</h3>
            <SettingRow label="Base Points" desc="Poin dasar untuk naik ke level 2">
              <input type="number" value={setupConfig.levelPoints} onChange={e => setField("levelPoints", Number(e.target.value))}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <SettingRow label="Level Multiplier" desc="Faktor kenaikan tiap level (ex: 1.03 = +3%)">
              <input type="number" value={setupConfig.levelMultiplier} step={0.01}
                onChange={e => setField("levelMultiplier", Number(e.target.value))}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <div>
              <Button variant="ghost" onClick={() => setShowLevels(!showLevels)} className="text-sm">
                {showLevels ? "▴ Hide Levels" : "▾ Show 20 Levels Preview"}
              </Button>
              {showLevels && (
                <div className="mt-3 max-h-60 overflow-y-auto rounded-xl border border-white/[0.06]">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-white/[0.06] text-white/50 text-xs">
                      <th className="p-3 text-left">Level</th>
                      <th className="p-3 text-left">Points Required</th>
                      <th className="p-3 text-left">Cumulative</th>
                    </tr></thead>
                    <tbody>
                      {levelPreview.map(l => (
                        <tr key={l.level} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                          <td className="p-3 text-white font-medium">{l.level}</td>
                          <td className="p-3 text-white/70">{l.level === 1 ? "0 (start)" : l.required.toLocaleString()}</td>
                          <td className="p-3 text-white/70">{l.cumulative.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );

      // ═══ OBS ════════════════════════════════════════════
      case "obs":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">🎬 OBS Connection</h3>
            <p className="text-sm text-white/50">
              Control OBS via WebSocket. OBS 28+ required. Defaults: 127.0.0.1:4455.
            </p>
            <SettingRow label="IP Address">
              <input type="text" value={setupConfig.obsIp} onChange={e => setField("obsIp", e.target.value)}
                className="w-40 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
            </SettingRow>
            <SettingRow label="Port">
              <input type="number" value={setupConfig.obsPort} onChange={e => setField("obsPort", Number(e.target.value))}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} max={65535} />
            </SettingRow>
            <SettingRow label="Password">
              <div className="flex gap-2">
                <input type={showPw("obs") ? "text" : "password"} value={setupConfig.obsPassword}
                  onChange={e => setField("obsPassword", e.target.value)}
                  className="w-40 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
                <button onClick={() => togglePw("obs")} className="text-white/40 hover:text-white/70 text-xl">{showPw("obs") ? "🙈" : "👁️"}</button>
              </div>
            </SettingRow>
            <div className="flex items-center gap-4">
              <Button onClick={testOBS} disabled={obsStatus === "testing"} className="gap-2">
                {obsStatus === "testing" ? "⏳ Testing..." : "🧪 Test Connection"}
              </Button>
              {/* Connected badge reflects the shared store flag (same as Create Action) */}
              {obsConnected && <span className="flex items-center gap-1 text-green text-sm"><CheckCircle2 className="w-4 h-4" /> Connected</span>}
              {!obsConnected && obsStatus === "fail" && <span className="flex items-center gap-1 text-red text-sm"><XCircle className="w-4 h-4" /> Failed</span>}
            </div>
          </div>
        );

      // ═══ STREAMER.BOT ═════════════════════════════════════
      case "streamerbot":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">🤖 Streamer.bot</h3>
            <p className="text-sm text-white/50">Trigger Streamer.bot actions from TikTok events.</p>
            <SettingRow label="Address">
              <input type="text" value={setupConfig.sbAddress} onChange={e => setField("sbAddress", e.target.value)}
                className="w-40 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
            </SettingRow>
            <SettingRow label="Port">
              <input type="number" value={setupConfig.sbPort} onChange={e => setField("sbPort", Number(e.target.value))}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} max={65535} />
            </SettingRow>
            <SettingRow label="Endpoint">
              <input type="text" value={setupConfig.sbEndpoint} onChange={e => setField("sbEndpoint", e.target.value)}
                className="w-40 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
            </SettingRow>
            <div className="flex items-center gap-4">
              <Button onClick={testSB} disabled={sbStatus === "testing"} className="gap-2">
                {sbStatus === "testing" ? "⏳ Testing..." : "🧪 Test Connection"}
              </Button>
              {sbStatus === "ok" && <span className="flex items-center gap-1 text-green text-sm"><CheckCircle2 className="w-4 h-4" /> Connected</span>}
              {sbStatus === "fail" && <span className="flex items-center gap-1 text-red text-sm"><XCircle className="w-4 h-4" /> Failed</span>}
            </div>
          </div>
        );

      // ═══ MINECRAFT ════════════════════════════════════════
      case "minecraft":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">⛏️ Minecraft Connection</h3>
            <p className="text-sm text-white/50">Execute Minecraft commands via ServerTap plugin or mod.</p>
            <SettingRow label="Mode">
              <select value={setupConfig.mcMode} onChange={e => setField("mcMode", e.target.value)}
                className="w-44 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40">
                <option value="servertap">ServerTap Plugin</option>
                <option value="mod">TikFinity Mod</option>
              </select>
            </SettingRow>
            <SettingRow label="Player Name">
              <input type="text" value={setupConfig.mcPlayer} onChange={e => setField("mcPlayer", e.target.value)}
                className="w-40 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40"
                placeholder="Optional" />
            </SettingRow>
            <SettingRow label="IP Address">
              <input type="text" value={setupConfig.mcIp} onChange={e => setField("mcIp", e.target.value)}
                className="w-40 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
            </SettingRow>
            <SettingRow label="Port">
              <input type="number" value={setupConfig.mcPort} onChange={e => setField("mcPort", Number(e.target.value))}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} max={65535} />
            </SettingRow>
            <SettingRow label="Password">
              <div className="flex gap-2">
                <input type={showPw("mc") ? "text" : "password"} value={setupConfig.mcPassword}
                  onChange={e => setField("mcPassword", e.target.value)}
                  className="w-40 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
                <button onClick={() => togglePw("mc")} className="text-white/40 hover:text-white/70 text-xl">{showPw("mc") ? "🙈" : "👁️"}</button>
              </div>
            </SettingRow>
            <div className="flex items-center gap-4">
              <Button onClick={testMC} disabled={mcStatus === "testing"} className="gap-2">
                {mcStatus === "testing" ? "⏳ Testing..." : "🧪 Test Connection"}
              </Button>
              {mcStatus === "ok" && <span className="flex items-center gap-1 text-green text-sm"><CheckCircle2 className="w-4 h-4" /> Connected</span>}
              {mcStatus === "fail" && <span className="flex items-center gap-1 text-red text-sm"><XCircle className="w-4 h-4" /> Failed</span>}
            </div>
          </div>
        );

      // ═══ SPOTIFY ═══════════════════════════════════════════
      case "spotify":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white" style={{ color: "#1DB954" }}>🎵 Spotify Connection</h3>
            <p className="text-sm text-white/50">Connect Spotify so viewers can request songs via chat commands.</p>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-between">
              <div>
                <p className="text-sm text-white/70">Status</p>
                <p className="text-xs text-white/40 mt-1">
                  {spotifyStatus === "idle" && "Not connected"}
                  {spotifyStatus === "connecting" && "Connecting..."}
                  {spotifyStatus === "ok" && "✅ Connected to Spotify"}
                  {spotifyStatus === "fail" && "❌ Connection failed"}
                </p>
              </div>
              <Button onClick={connectSpotify} disabled={spotifyStatus === "connecting"} variant="secondary">
                {spotifyStatus === "connecting" ? "⏳..." : "🔗 Connect Spotify"}
              </Button>
            </div>
          </div>
        );

      // ═══ SONG REQUEST ══════════════════════════════════════
      case "songrequest":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">🎶 Song Request Settings</h3>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div><p className="text-sm text-white/70">Enable Song Requests</p><p className="text-xs text-white/40">Aktifkan fitur song requests dari chat</p></div>
              <label className="switch"><input type="checkbox" checked={setupConfig.spotifyEnabled} onChange={e => setField("spotifyEnabled", e.target.checked)} /><span className="slider" /></label>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div><p className="text-sm text-white/70">!play command</p><p className="text-xs text-white/40">Biaya: {setupConfig.playCost} points</p></div>
              <div className="flex items-center gap-3">
                <input type="number" value={setupConfig.playCost} onChange={e => setField("playCost", Number(e.target.value))} className="w-20 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none" min={0} />
                <label className="switch"><input type="checkbox" checked={setupConfig.playEnabled} onChange={e => setField("playEnabled", e.target.checked)} /><span className="slider" /></label>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div><p className="text-sm text-white/70">!skip command</p><p className="text-xs text-white/40">Biaya: {setupConfig.skipCost} points</p></div>
              <div className="flex items-center gap-3">
                <input type="number" value={setupConfig.skipCost} onChange={e => setField("skipCost", Number(e.target.value))} className="w-20 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none" min={0} />
                <label className="switch"><input type="checkbox" checked={setupConfig.skipEnabled} onChange={e => setField("skipEnabled", e.target.checked)} /><span className="slider" /></label>
              </div>
            </div>
            <ToggleRow label="Allow !skip requested tracks" desc="Izinkan viewer skip lagu request" value={setupConfig.skipRequestedEnabled} onChange={v => setField("skipRequestedEnabled", v)} />
            <ToggleRow label="Allow explicit content" desc="Izinkan lagu dengan konten eksplisit" value={setupConfig.explicitEnabled} onChange={v => setField("explicitEnabled", v)} />
            <SettingRow label="Max Queue Overall" desc="Maksimal antrian total">
              <input type="number" value={setupConfig.maxQueueOverall} onChange={e => setField("maxQueueOverall", Number(e.target.value))} className="w-20 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none" min={1} max={50} />
            </SettingRow>
            <SettingRow label="Max Queue Per User" desc="Maksimal antrian per user">
              <input type="number" value={setupConfig.maxQueuePerUser} onChange={e => setField("maxQueuePerUser", Number(e.target.value))} className="w-20 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none" min={1} max={10} />
            </SettingRow>
            <ToggleRow label="Display Overlay Permanently" desc="Tampilkan overlay lagu terus menerus" value={setupConfig.overlayPermanent} onChange={v => setField("overlayPermanent", v)} />
          </div>
        );

      // ═══ OVERLAY SCREENS ═══════════════════════════════════════════
      case "overlayscreens":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white">📺 Overlay Screens</h3>
              <p className="text-sm text-white/50 mt-1">
                Configure overlay widget URLs for OBS or Live Studio. Add at least one screen as a Browser Source.
              </p>
            </div>
            <div className="divide-y divide-white/[0.04] rounded-xl border border-white/[0.06] overflow-hidden">
              {[1,2,3,4,5,6,7,8].map((n, i) => {
                const screenId = SCREEN_IDS[n - 1];
                const screenActions = actions.filter(a => (a.overlayScreen || a.screen || "Screen 1") === `Screen ${n}`);
                const maxQueue = setupConfig.overlayScreensMaxQueue?.[screenId] ?? 5;
                const url = getOverlayWidgetUrl(n, maxQueue);
                return (
                  <motion.div key={n} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                    <div className="w-20 shrink-0">
                      <span className="text-sm font-semibold text-white">Screen {n}</span>
                    </div>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <code className="text-xs text-accent/80 bg-white/[0.03] px-3 py-1.5 rounded-lg border border-white/[0.06] truncate font-mono select-all flex-1 min-w-0">
                        {url}
                      </code>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => { navigator.clipboard.writeText(url); toast("URL copied!", "success"); }}
                          className="shrink-0 px-2 py-1.5 text-[10px] rounded-lg bg-white/[0.04] hover:bg-accent/20 hover:text-accent text-white/50 transition-all font-medium"
                          title="Copy overlay URL">
                          <Copy className="w-3 h-3 inline mr-1" />Copy
                        </button>
                        <button onClick={() => window.open(url, '_blank')}
                          className="shrink-0 px-2 py-1.5 text-[10px] rounded-lg bg-white/[0.04] hover:bg-primary/20 hover:text-primary text-white/50 transition-all font-medium"
                          title="Open overlay in new tab to test">
                          🔗 Test
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] text-white/40">Max Queue:</label>
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={maxQueue}
                          onChange={e => setField("overlayScreensMaxQueue", { ...setupConfig.overlayScreensMaxQueue, [screenId]: parseInt(e.target.value) || 5 })}
                          className="w-16 h-7 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white outline-none focus:border-primary/40 text-center"
                        />
                      </div>
                      <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green/10 text-green border border-green/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-green" />
                        {screenActions.length > 0 ? `${screenActions.length} actions` : "Ready"}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        );

      // ═══ RESET ═══════════════════════════════════════════
      case "reset":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">🔄 Reset Points</h3>
            <div className="p-4 rounded-xl bg-red/10 border border-red/20">
              <p className="text-sm text-white/70 mb-2">Challenge Mode</p>
              <p className="text-xs text-white/40 mb-3">Reset semua poin ke 0 sementara untuk challenge</p>
              <Button onClick={resetPoints} variant="danger" className="gap-2">🔄 Reset All Points</Button>
            </div>
            <div className="p-4 rounded-xl bg-amber/10 border border-amber/20">
              <p className="text-sm text-white/70 mb-2">Halving</p>
              <p className="text-xs text-white/40 mb-3">Kurangi semua poin berdasarkan persentase</p>
              <div className="flex items-center gap-3">
                <input type="number" value={setupConfig.halvingPercent} onChange={e => setField("halvingPercent", Number(e.target.value))} className="w-20 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none" min={1} max={100} />
                <span className="text-sm text-white/50">%</span>
                <Button onClick={applyHalving} variant="secondary">Apply Halving</Button>
              </div>
            </div>
          </div>
        );

      // ═══ ACCOUNT ═══════════════════════════════════════
      case "account": {
        const displayPlan = effectivePlan() === 'pro' ? 'Pro' : 'Free';
        const expiryLabel = isLifetimePro()
          ? 'Lifetime'
          : expiresAt
            ? new Date(expiresAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
            : '—';
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">👤 Your Account</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/40">User ID</p>
                <p className="text-sm text-white font-mono mt-1">{user?.id || "—"}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/40">E-Mail</p>
                <p className="text-sm text-white mt-1">{user?.email || "—"}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/40">Plan</p>
                <p className="text-sm text-yellow-400 font-semibold mt-1">{displayPlan}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/40">Name</p>
                <p className="text-sm text-white/50 mt-1">{user?.name || "—"}</p>
              </div>
              {displayPlan === 'Pro' && (
                <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <p className="text-xs text-white/40">Expires</p>
                  <p className="text-sm text-white/50 mt-1">{expiryLabel}</p>
                </div>
              )}
            </div>
          </div>
        );
      }

      // ═══ IMPORT/EXPORT ═════════════════════════════════
      case "importexport":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">📦 Import / Export Settings</h3>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-sm text-white/70 mb-2">Export Settings</p>
              <p className="text-xs text-white/40 mb-3">Simpan semua pengaturan ke file JSON</p>
              <Button onClick={handleExport} className="gap-2"><Download className="w-4 h-4" /> Export Settings</Button>
            </div>
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-sm text-white/70 mb-2">Import Settings</p>
              <p className="text-xs text-white/40 mb-3">Muat pengaturan dari file JSON</p>
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] text-sm text-white hover:bg-white/[0.1] transition-colors">
                <Upload className="w-4 h-4" /> Choose File
                <input type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />
              </label>
            </div>
          </div>
        );

      // ═══ ADVANCED ═══════════════════════════════════════
      case "advanced":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">⚙️ Advanced Settings</h3>
            <SettingRow label="TikTok Language" desc="Language code for gifts localization">
              <input type="text" value={setupConfig.tikTokLang} onChange={e => setField("tikTokLang", e.target.value)}
                className="w-32 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" placeholder="id-ID" />
            </SettingRow>
            <ToggleRow label="Debug Mode" desc="Aktifkan logging debug untuk support" value={setupConfig.debugMode} onChange={v => setField("debugMode", v)} />
          </div>
        );

      // ═══ LICENSE ═══════════════════════════════════════
      case "tts":
        return <TTSChatSettings />;

      // ═══ LICENSE ═══════════════════════════════════════
      case "license":
        return (
          <div id="licenseProSection" className="space-y-6">
            <h3 className="text-lg font-bold text-white" style={{ color: "#f0a020" }}>🌟 RosaeFinity Pro</h3>

            {/* Plans Comparison */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs uppercase tracking-wider text-white/40 font-semibold">Free</p>
                <p className="text-2xl font-bold text-white mt-1">$0</p>
                <ul className="mt-3 space-y-2 text-xs text-white/60">
                  <li>⚡ 5 Actions</li>
                  <li>🔊 3 Custom Sounds</li>
                  <li>📺 2 Overlay Screens</li>
                  <li>👥 Up to 2.5k users</li>
                  <li className="text-white/30">❌ Premium Overlays</li>
                  <li className="text-white/30">❌ AI Voices</li>
                </ul>
                <p className="mt-4 text-xs text-center text-yellow-400">✅ Current Plan</p>
              </div>
              <div className="p-4 rounded-xl bg-gradient-to-br from-amber/5 to-transparent border border-amber/30 relative">
                <div className="absolute -top-2 right-3 text-[10px] bg-amber text-black px-2 py-0.5 rounded font-bold">POPULAR</div>
                <p className="text-xs uppercase tracking-wider text-amber font-semibold">Pro</p>
                <p className="text-2xl font-bold text-white mt-1">$5<span className="text-sm text-white/40">/mo</span></p>
                <ul className="mt-3 space-y-2 text-xs text-white/60">
                  <li>⚡ Unlimited Actions</li>
                  <li>🔊 Unlimited Sounds</li>
                  <li>📺 Up to 8 Screens</li>
                  <li>👥 Up to 100k users</li>
                  <li style={{ color: "#f0a020" }}>✅ Premium Overlays</li>
                  <li style={{ color: "#f0a020" }}>✅ AI Voices</li>
                </ul>
                <p className="mt-4 text-xs text-center text-amber">✨ Active</p>
              </div>
            </div>

            {/* Activation */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-sm text-white/70 mb-2">Already have a license key?</p>
              <div className="flex gap-2 mb-3">
                <input type="text" value={licenseKey} onChange={e => setLicenseKey(e.target.value.toUpperCase())} placeholder="ROSAE-XXXX-XXXX-XXXX"
                  className="flex-1 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white font-mono outline-none focus:border-primary/40 tracking-wider" />
                <input type="text" value={licenseEmail} onChange={e => setLicenseEmail(e.target.value)} placeholder="Email (optional)"
                  className="w-44 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
                <Button onClick={activateLicense}>Activate</Button>
              </div>
              {licenseMsg && <p className="text-sm text-yellow-400">{licenseMsg}</p>}
            </div>
          </div>
        );
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-white/60" />
            <h1 className="text-xl font-bold text-white">Setup</h1>
          </div>
          <div className="flex items-center gap-3">
            {saved && <span className="text-sm text-green flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Synced!</span>}
            <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Save Changes</Button>
          </div>
        </div>
      </motion.div>

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-52 shrink-0 space-y-1">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => setActiveSection(s.id)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
                activeSection === s.id
                  ? "bg-primary/20 border border-primary/30 text-primary-light"
                  : "text-white/60 hover:bg-white/[0.04] hover:text-white/80"
              }`}>
              <span>{s.icon}</span>
              <span className="truncate">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-[500px]">
          <motion.div key={activeSection} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2 }}
            className="rounded-2xl border border-white/[0.06] bg-card p-6">
            {sectionContent()}
          </motion.div>
        </div>
      </div>
    </div>
  );
}

// Sub-components
function SettingRow({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm text-white/70">{label}</p>
        {desc && <p className="text-xs text-white/40 mt-0.5">{desc}</p>}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
      <div>
        <p className="text-sm text-white/70">{label}</p>
        <p className="text-xs text-white/40 mt-0.5">{desc}</p>
      </div>
      <label className="switch">
        <input type="checkbox" checked={value} onChange={e => onChange(e.target.checked)} />
        <span className="slider" />
      </label>
    </div>
  );
}
export default SettingsPage;
