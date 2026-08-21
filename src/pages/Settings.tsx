import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../store/app-store";
import { useAuthStore } from "../store/auth-store";
import { useTikTokStore, selectScreenStatus, selectScreenUsername, selectScreenViewerCount, selectScreenStats, selectScreenRoomId, selectScreenIsReconnecting, selectScreenReconnectAttempts, selectScreenLastError } from "../store/tiktok-store";
import { api } from "../services/electron-service";
import { toast } from "../components/Toast";
import { Button } from "../components/ui/button";
import { Settings, Save, Download, Upload, CheckCircle2, XCircle, Copy } from "lucide-react";
import { getOverlayWidgetUrl } from "../lib/browser-source-url";

type Section = "tiktok" | "points" | "levels" | "obs" | "streamerbot" | "minecraft" | "spotify" | "songrequest" | "overlayscreens" | "reset" | "account" | "importexport" | "advanced" | "license";

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
  { id: "license", label: "Pro License", icon: "🌟" },
];

export function SettingsPage() {
  // ══ Zustand — all settings live here and auto-persist via persist middleware ══
  const setupConfig = useAppStore(s => s.setupConfig);
  const updateSetupConfig = useAppStore(s => s.updateSetupConfig);
  const pointsConfig = useAppStore(s => s.pointsConfig);
  const updatePointsConfig = useAppStore(s => s.updatePointsConfig);
  const actions = useAppStore(s => s.actions);
  const { user } = useAuthStore();

  // TikTok store for connection management
  const tikTokStatus = useTikTokStore(selectScreenStatus("screen-0"));
  const tikTokUsername = useTikTokStore(selectScreenUsername("screen-0"));
  const tikTokViewerCount = useTikTokStore(selectScreenViewerCount("screen-0"));
  const tikTokStats = useTikTokStore(selectScreenStats("screen-0"));
  const tikTokRoomId = useTikTokStore(selectScreenRoomId("screen-0"));
  const tikTokIsReconnecting = useTikTokStore(selectScreenIsReconnecting("screen-0"));
  const tikTokReconnectAttempts = useTikTokStore(selectScreenReconnectAttempts("screen-0"));
  const tikTokLastError = useTikTokStore(selectScreenLastError("screen-0"));

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

  const showPw = (key: string) => showPasswords[key] || false;
  const togglePw = (key: string) => setShowPasswords(p => ({ ...p, [key]: !p[key] }));

  /** Helper: update a single field in setupConfig — auto-persists via Zustand persist middleware */
  const setField = <K extends keyof typeof setupConfig>(key: K, value: (typeof setupConfig)[K]) => {
    updateSetupConfig({ [key]: value });
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
      console.log(`[TIKTOK-UI] Settings connect requested for screen-0: ${username}`);
      const a = api();
      a?.connectTikTokScreen("screen-0", username).catch((err: unknown) => {
        console.error(`[TIKTOK-UI] connect failed:`, err);
      });
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

  // Test OBS
  const testOBS = async () => {
    setObsStatus("testing");
    const a = api();
    if (a) {
      try {
        a.obsSetConfig({ obsIp: setupConfig.obsIp, obsPort: setupConfig.obsPort, obsPassword: setupConfig.obsPassword });
        const result = await a.obsTest({ ip: setupConfig.obsIp, port: setupConfig.obsPort, password: setupConfig.obsPassword });
        setObsStatus(result?.success ? "ok" : "fail");
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

  // Import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      toast("Please select a JSON file", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);

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

  // Export
  const handleExport = () => {
    const data = {
      setupConfig,
      pointsConfig,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rosaeFinity-settings-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sectionContent = () => {
    switch (activeSection) {
      // ═══ TIKTOK ════════════════════════════════════════════
      case "tiktok": {
        const isConnected = tikTokStatus === "connected";
        const isReconnecting = tikTokIsReconnecting;
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
                      console.log(`[TIKTOK-UI] Disconnect clicked`);
                      const a = api();
                      a?.disconnectTikTokScreen("screen-0");
                    }}>
                    Disconnect
                  </Button>
                ) : (
                  <Button size="sm"
                    onClick={() => {
                      console.log(`[TIKTOK-UI] Connect clicked`);
                      const username = setupConfig.tikTokName.trim();
                      if (!username) return;
                      console.log(`[TIKTOK-UI] calling connectTikTokScreen("screen-0", "${username}")`);
                      const a = api();
                      a?.connectTikTokScreen("screen-0", username);
                    }}
                    disabled={!setupConfig.tikTokName.trim()}>
                    Connect
                  </Button>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-success shadow-[0_0_6px_rgba(34,197,94,0.6)]" : isReconnecting ? "bg-amber animate-pulse" : "bg-white/20"}`} />
                  <span className="text-white/50">
                    {isConnected
                      ? `Connected${tikTokUsername ? ` as ${tikTokUsername}` : ""}`
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
                  <span className={`text-xs font-medium ${isConnected ? "text-green" : "text-white/30"}`}>
                    {isConnected ? "● Connected" : "● Offline"}
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
            <p className="text-sm text-white/50">Control OBS via WebSocket. OBS 28+ required.</p>
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
              {obsStatus === "ok" && <span className="flex items-center gap-1 text-green text-sm"><CheckCircle2 className="w-4 h-4" /> Connected</span>}
              {obsStatus === "fail" && <span className="flex items-center gap-1 text-red text-sm"><XCircle className="w-4 h-4" /> Failed</span>}
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
                const screenActions = actions.filter(a => (a.overlayScreen || a.screen || "Screen 1") === `Screen ${n}`);
                const url = getOverlayWidgetUrl(n);
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
                      <div className="flex items-center gap-1.5">
                        <span className="w-12 h-7 px-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-xs text-white/50 text-center flex items-center justify-center">8</span>
                        <span className="text-[10px] text-white/30">max</span>
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
      case "account":
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
                <p className="text-sm text-yellow-400 font-semibold mt-1">{user?.plan === "pro" ? "Pro" : "Free"}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <p className="text-xs text-white/40">Name</p>
                <p className="text-sm text-white/50 mt-1">{user?.name || "—"}</p>
              </div>
            </div>
          </div>
        );

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
