import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../store/app-store";
import { useAuthStore } from "../store/auth-store";
import { api } from "../services/electron-service";
import { Button } from "../components/ui/button";
import { SCREEN_IDS } from "../types";
import { Settings, Save, Download, Upload, RefreshCw, CheckCircle2, XCircle, Zap } from "lucide-react";

type Section = "tiktok" | "points" | "levels" | "obs" | "streamerbot" | "minecraft" | "spotify" | "songrequest" | "reset" | "account" | "importexport" | "advanced" | "license";

const SECTIONS: { id: Section; label: string; icon: string }[] = [
  { id: "tiktok", label: "TikTok Connection", icon: "🎵" },
  { id: "points", label: "Points System", icon: "⭐" },
  { id: "levels", label: "Level Settings", icon: "📈" },
  { id: "obs", label: "OBS Connection", icon: "🎬" },
  { id: "streamerbot", label: "Streamer.bot", icon: "🤖" },
  { id: "minecraft", label: "Minecraft", icon: "⛏️" },
  { id: "spotify", label: "Spotify", icon: "🎵" },
  { id: "songrequest", label: "Song Request", icon: "🎶" },
  { id: "reset", label: "Reset Points", icon: "🔄" },
  { id: "account", label: "Account", icon: "👤" },
  { id: "importexport", label: "Import/Export", icon: "📦" },
  { id: "advanced", label: "Advanced", icon: "⚙️" },
  { id: "license", label: "Pro License", icon: "🌟" },
];

export function SettingsPage() {
  const { setupConfig, updateSetupConfig, pointsConfig, updatePointsConfig, screenConnections, screenTikTokNames, setScreenTikTokName } = useAppStore();
  const { user } = useAuthStore();
  // Baca hash dari URL untuk langsung ke section tertentu
  const getInitialSection = (): Section => {
    const hash = window.location.hash.replace("#", "") as Section;
    return SECTIONS.find(s => s.id === hash) ? hash : "tiktok";
  };
  const [activeSection, setActiveSection] = useState<Section>(getInitialSection);
  const [local, setLocal] = useState({ ...setupConfig });
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
  const [halvingPercent, setHalvingPercent] = useState(50);
  const [importFile, setImportFile] = useState<File | null>(null);

  const showPw = (key: string) => showPasswords[key] || false;
  const togglePw = (key: string) => setShowPasswords(p => ({ ...p, [key]: !p[key] }));

  // Save all settings
  const handleSave = () => {
    updateSetupConfig(local);
    updatePointsConfig({
      currencyName: local.currencyName,
      pointsGift: local.pointsGift,
      pointsLike: local.pointsLike,
      pointsFollow: local.pointsFollow,
      pointsComment: local.pointsComment,
      pointsShare: local.pointsShare,
      subBonus: local.subBonus,
      levelPoints: local.levelPoints,
      levelMultiplier: local.levelMultiplier,
    });
    // Sync config to backend modules
    const a = api();
    if (a) {
      a.syncPointsConfig(local);
      a.obsSetConfig({ obsIp: local.obsIp, obsPort: local.obsPort, obsPassword: local.obsPassword });
      a.sbSetConfig({ sbAddress: local.sbAddress, sbPort: local.sbPort, sbEndpoint: local.sbEndpoint });
      a.mcSetConfig({ mcMode: local.mcMode, mcPlayer: local.mcPlayer, mcIp: local.mcIp, mcPort: local.mcPort, mcPassword: local.mcPassword });
      if (local.spotifyClientId) {
        a.spotifySetConfig({ clientId: local.spotifyClientId, redirectUri: "http://127.0.0.1:8890/callback" });
      }
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Level preview
  const levelPreview: { level: number; required: number; cumulative: number }[] = [];
  if (local.levelPoints > 0) {
    let cumulative = 0;
    for (let lv = 1; lv <= 20; lv++) {
      const req = lv === 1 ? 0 : Math.round(local.levelPoints * Math.pow(local.levelMultiplier, lv - 2));
      cumulative += req;
      levelPreview.push({ level: lv, required: req, cumulative });
    }
  }

  // Test OBS
  const testOBS = async () => {
    setObsStatus("testing");
    updateSetupConfig(local);
    const a = api();
    if (a) {
      try {
        a.obsSetConfig({ obsIp: local.obsIp, obsPort: local.obsPort, obsPassword: local.obsPassword });
        const result = await a.obsTest({ ip: local.obsIp, port: local.obsPort, password: local.obsPassword });
        setObsStatus(result?.success ? "ok" : "fail");
      } catch { setObsStatus("fail"); }
    } else {
      setObsStatus(Math.random() > 0.3 ? "ok" : "fail");
    }
  };

  // Test Streamer.bot
  const testSB = async () => {
    setSbStatus("testing");
    updateSetupConfig(local);
    const a = api();
    if (a) {
      try {
        a.sbSetConfig({ sbAddress: local.sbAddress, sbPort: local.sbPort, sbEndpoint: local.sbEndpoint });
        const result = await a.sbTest({ address: local.sbAddress, port: local.sbPort, endpoint: local.sbEndpoint });
        setSbStatus(result?.success ? "ok" : "fail");
      } catch { setSbStatus("fail"); }
    } else {
      setSbStatus(Math.random() > 0.3 ? "ok" : "fail");
    }
  };

  // Test Minecraft
  const testMC = async () => {
    setMcStatus("testing");
    updateSetupConfig(local);
    const a = api();
    if (a) {
      try {
        a.mcSetConfig({ mcMode: local.mcMode, mcPlayer: local.mcPlayer, mcIp: local.mcIp, mcPort: local.mcPort, mcPassword: local.mcPassword });
        const result = await a.mcTest({ ip: local.mcIp, port: local.mcPort, password: local.mcPassword, mode: local.mcMode });
        setMcStatus(result?.success ? "ok" : "fail");
      } catch { setMcStatus("fail"); }
    } else {
      setMcStatus(Math.random() > 0.3 ? "ok" : "fail");
    }
  };

  // Connect Spotify
  const connectSpotify = async () => {
    setSpotifyStatus("connecting");
    updateSetupConfig(local);
    const a = api();
    if (a) {
      try {
        a.spotifySetConfig({ clientId: local.spotifyClientId, redirectUri: "http://127.0.0.1:8890/callback" });
        const result = await a.spotifyAuth({ clientId: local.spotifyClientId });
        setSpotifyStatus(result?.success ? "ok" : "fail");
      } catch { setSpotifyStatus("fail"); }
    } else {
      setSpotifyStatus(Math.random() > 0.4 ? "ok" : "fail");
    }
  };

  // Activate License
  const activateLicense = async () => {
    const a = api();
    if (a) {
      try {
        const result = await a.licenseActivate({ key: licenseKey.toUpperCase(), email: licenseEmail });
        if (result?.success) {
          setLicenseMsg("✅ Pro activated!");
          // Refresh license status
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
        }
      } catch {
        setLicenseMsg("❌ Activation failed");
      }
    } else {
      const pattern = /^ROSAE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
      if (!pattern.test(licenseKey.toUpperCase())) {
        setLicenseMsg("Format: ROSAE-XXXX-XXXX-XXXX");
        return;
      }
      setLicenseMsg("✅ Pro activated! (demo)");
    }
  };

  // Reset points
  const resetPoints = () => {
    const { resetAllPoints, halvePoints } = useAppStore.getState();
    if (confirm("Reset all points to 0?")) resetAllPoints();
  };

  const applyHalving = () => {
    const { halvePoints } = useAppStore.getState();
    halvePoints(halvingPercent);
  };

  // Import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.setupConfig) updateSetupConfig(data.setupConfig);
        if (data.pointsConfig) updatePointsConfig(data.pointsConfig);
        alert("Settings imported!");
      } catch { alert("Invalid file"); }
    };
    reader.readAsText(file);
  };

  // Export
  const handleExport = () => {
    const data = {
      setupConfig: local,
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
        const [globalTikTokName, setGlobalTikTokName] = useState("");
        const connectAll = () => {
          const a = api();
          if (a && globalTikTokName) {
            SCREEN_IDS.forEach(id => a.connectTikTokScreen(id, globalTikTokName));
          }
        };
        return (
          <div className="space-y-4">
            {/* Global connect-all section */}
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
              <h4 className="text-sm font-semibold text-primary-light mb-2">🌐 Connect All Screens at Once</h4>
              <p className="text-xs text-white/40 mb-3">Enter one username to connect all 8 screens simultaneously.</p>
              <div className="flex gap-2">
                <input type="text" value={globalTikTokName} onChange={(e) => setGlobalTikTokName(e.target.value)}
                  placeholder="tiktok_username"
                  className="flex-1 h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
                <Button size="sm" variant="default" onClick={connectAll} disabled={!globalTikTokName}>
                  <Zap className="w-4 h-4" /> Connect All 8 Screens
                </Button>
              </div>
              <p className="text-[10px] text-white/40 mt-1">Connects the same username to all 8 screens simultaneously.</p>
            </div>

            <div className="h-px bg-white/[0.06] my-4" />

            <h3 className="text-lg font-bold text-white">📺 Per-Screen Connections</h3>
            <p className="text-sm text-white/40">Or configure each screen independently.</p>
            {SCREEN_IDS.map((screenId) => {
              const conn = screenConnections[screenId];
              const localName = screenTikTokNames[screenId] || "";
              return (
                <div key={screenId} className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-white">Screen {screenId.split('-')[1]}</span>
                    {conn?.isLive ? (
                      <span className="text-xs font-medium px-2 py-0.5 rounded bg-green/20 text-green border border-green/30">
                        LIVE @{conn.username}
                      </span>
                    ) : (
                      <span className="text-xs text-white/30">Offline</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <input type="text" value={localName}
                      onChange={(e) => setScreenTikTokName(screenId, e.target.value)}
                      placeholder="tiktok_username"
                      disabled={conn?.isLive}
                      className="flex-1 h-9 px-3 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40 disabled:opacity-50" />
                    {conn?.isLive ? (
                      <Button size="sm" variant="danger"
                        onClick={() => api()?.disconnectTikTokScreen(screenId)}>
                        Disconnect
                      </Button>
                    ) : (
                      <Button size="sm"
                        onClick={() => {
                          const a = api();
                          if (a && localName) a.connectTikTokScreen(screenId, localName);
                        }}
                        disabled={!localName}>
                        Connect
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );

      } // close case "tiktok" block

      // ═══ POINTS ════════════════════════════════════════════
      case "points":
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-bold text-white">⭐ Points System</h3>
            <SettingRow label="Currency Name" desc="Nama poin kamu">
              <input type="text" value={local.currencyName} onChange={e => setLocal({ ...local, currencyName: e.target.value })}
                className="w-40 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
            </SettingRow>
            <SettingRow label="Points per Gift" desc="Poin setiap gift">
              <input type="number" value={local.pointsGift} onChange={e => setLocal({ ...local, pointsGift: Number(e.target.value) })}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <SettingRow label="Points per Like" desc="Poin setiap like">
              <input type="number" value={local.pointsLike} onChange={e => setLocal({ ...local, pointsLike: Number(e.target.value) })}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <SettingRow label="Points per Follow" desc="Poin setiap follow">
              <input type="number" value={local.pointsFollow} onChange={e => setLocal({ ...local, pointsFollow: Number(e.target.value) })}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <SettingRow label="Points per Comment" desc="Poin setiap komentar">
              <input type="number" value={local.pointsComment} onChange={e => setLocal({ ...local, pointsComment: Number(e.target.value) })}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <SettingRow label="Points per Share" desc="Poin setiap share">
              <input type="number" value={local.pointsShare} onChange={e => setLocal({ ...local, pointsShare: Number(e.target.value) })}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <SettingRow label="Points per Subscribe" desc="Poin setiap subscription">
              <input type="number" value={local.pointsSubscribe} onChange={e => setLocal({ ...local, pointsSubscribe: Number(e.target.value) })}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <SettingRow label="Subscriber Bonus" desc="Bonus % untuk subscriber (0 = no bonus)">
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={200} value={local.subBonus} onChange={e => setLocal({ ...local, subBonus: Number(e.target.value) })}
                  className="w-32" />
                <span className="text-sm text-white w-12">{local.subBonus}%</span>
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
              <input type="number" value={local.levelPoints} onChange={e => setLocal({ ...local, levelPoints: Number(e.target.value) })}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} />
            </SettingRow>
            <SettingRow label="Level Multiplier" desc="Faktor kenaikan tiap level (ex: 1.03 = +3%)">
              <input type="number" value={local.levelMultiplier} step={0.01}
                onChange={e => setLocal({ ...local, levelMultiplier: Number(e.target.value) })}
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
              <input type="text" value={local.obsIp} onChange={e => setLocal({ ...local, obsIp: e.target.value })}
                className="w-40 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
            </SettingRow>
            <SettingRow label="Port">
              <input type="number" value={local.obsPort} onChange={e => setLocal({ ...local, obsPort: Number(e.target.value) })}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} max={65535} />
            </SettingRow>
            <SettingRow label="Password">
              <div className="flex gap-2">
                <input type={showPw("obs") ? "text" : "password"} value={local.obsPassword}
                  onChange={e => setLocal({ ...local, obsPassword: e.target.value })}
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
              <input type="text" value={local.sbAddress} onChange={e => setLocal({ ...local, sbAddress: e.target.value })}
                className="w-40 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
            </SettingRow>
            <SettingRow label="Port">
              <input type="number" value={local.sbPort} onChange={e => setLocal({ ...local, sbPort: Number(e.target.value) })}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} max={65535} />
            </SettingRow>
            <SettingRow label="Endpoint">
              <input type="text" value={local.sbEndpoint} onChange={e => setLocal({ ...local, sbEndpoint: e.target.value })}
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
              <select value={local.mcMode} onChange={e => setLocal({ ...local, mcMode: e.target.value })}
                className="w-44 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40">
                <option value="servertap">ServerTap Plugin</option>
                <option value="mod">TikFinity Mod</option>
              </select>
            </SettingRow>
            <SettingRow label="Player Name">
              <input type="text" value={local.mcPlayer} onChange={e => setLocal({ ...local, mcPlayer: e.target.value })}
                className="w-40 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40"
                placeholder="Optional" />
            </SettingRow>
            <SettingRow label="IP Address">
              <input type="text" value={local.mcIp} onChange={e => setLocal({ ...local, mcIp: e.target.value })}
                className="w-40 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
            </SettingRow>
            <SettingRow label="Port">
              <input type="number" value={local.mcPort} onChange={e => setLocal({ ...local, mcPort: Number(e.target.value) })}
                className="w-24 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" min={1} max={65535} />
            </SettingRow>
            <SettingRow label="Password">
              <div className="flex gap-2">
                <input type={showPw("mc") ? "text" : "password"} value={local.mcPassword}
                  onChange={e => setLocal({ ...local, mcPassword: e.target.value })}
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
              <label className="switch"><input type="checkbox" checked={local.spotifyEnabled} onChange={e => setLocal({ ...local, spotifyEnabled: e.target.checked })} /><span className="slider" /></label>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div><p className="text-sm text-white/70">!play command</p><p className="text-xs text-white/40">Biaya: {local.playCost} points</p></div>
              <div className="flex items-center gap-3">
                <input type="number" value={local.playCost} onChange={e => setLocal({ ...local, playCost: Number(e.target.value) })} className="w-20 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none" min={0} />
                <label className="switch"><input type="checkbox" checked={local.playEnabled} onChange={e => setLocal({ ...local, playEnabled: e.target.checked })} /><span className="slider" /></label>
              </div>
            </div>
            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <div><p className="text-sm text-white/70">!skip command</p><p className="text-xs text-white/40">Biaya: {local.skipCost} points</p></div>
              <div className="flex items-center gap-3">
                <input type="number" value={local.skipCost} onChange={e => setLocal({ ...local, skipCost: Number(e.target.value) })} className="w-20 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none" min={0} />
                <label className="switch"><input type="checkbox" checked={local.skipEnabled} onChange={e => setLocal({ ...local, skipEnabled: e.target.checked })} /><span className="slider" /></label>
              </div>
            </div>
            <ToggleRow label="Allow !skip requested tracks" desc="Izinkan viewer skip lagu request" value={local.skipRequestedEnabled} onChange={v => setLocal({ ...local, skipRequestedEnabled: v })} />
            <ToggleRow label="Allow explicit content" desc="Izinkan lagu dengan konten eksplisit" value={local.explicitEnabled} onChange={v => setLocal({ ...local, explicitEnabled: v })} />
            <SettingRow label="Max Queue Overall" desc="Maksimal antrian total">
              <input type="number" value={local.maxQueueOverall} onChange={e => setLocal({ ...local, maxQueueOverall: Number(e.target.value) })} className="w-20 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none" min={1} max={50} />
            </SettingRow>
            <SettingRow label="Max Queue Per User" desc="Maksimal antrian per user">
              <input type="number" value={local.maxQueuePerUser} onChange={e => setLocal({ ...local, maxQueuePerUser: Number(e.target.value) })} className="w-20 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none" min={1} max={10} />
            </SettingRow>
            <ToggleRow label="Display Overlay Permanently" desc="Tampilkan overlay lagu terus menerus" value={local.overlayPermanent} onChange={v => setLocal({ ...local, overlayPermanent: v })} />
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
                <input type="number" value={halvingPercent} onChange={e => setHalvingPercent(Number(e.target.value))} className="w-20 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none" min={1} max={100} />
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
              <input type="text" value={local.tikTokLang} onChange={e => setLocal({ ...local, tikTokLang: e.target.value })}
                className="w-32 h-10 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" placeholder="id-ID" />
            </SettingRow>
            <ToggleRow label="Debug Mode" desc="Aktifkan logging debug untuk support" value={local.debugMode} onChange={v => setLocal({ ...local, debugMode: v })} />
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

            {/* Indonesian Payments */}
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
              <p className="text-sm font-bold text-white mb-3">🇮🇩 Pembayaran Indonesia</p>
              <div className="grid grid-cols-4 gap-3 mb-3">
                {[{ emoji: "💳", label: "DANA" }, { emoji: "📱", label: "QRIS" }, { emoji: "🏦", label: "BCA/Mandiri" }, { emoji: "🛍️", label: "Tokopedia" }].map(p => (
                  <div key={p.label} className="p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] text-center cursor-pointer hover:bg-white/[0.08]">
                    <div className="text-2xl mb-1">{p.emoji}</div>
                    <div className="text-[11px] font-semibold text-white">{p.label}</div>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-xl bg-amber/10 border border-amber/20">
                <p className="text-sm font-semibold text-amber">💰 Harga Pro: <strong>Rp 50.000</strong> / bulan</p>
                <p className="text-xs text-white/50 mt-1">Pembayaran via DANA / QRIS / Bank Transfer</p>
                <div className="flex gap-2 mt-3">
                  <Button size="sm" style={{ background: "#3b82f6" }}>💳 DANA</Button>
                  <Button size="sm" style={{ background: "#22c55e" }}>📱 QRIS</Button>
                  <Button size="sm" style={{ background: "#eab308" }}>🏦 Transfer</Button>
                </div>
              </div>
              <div className="mt-2 p-2 rounded-lg bg-white/[0.02] text-xs text-white/40">
                💬 Punya kode referral? Diskon 20%! Pakai kode: <strong className="text-amber">ROSAE20</strong>
              </div>
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
            {saved && <span className="text-sm text-green flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Saved!</span>}
            <Button onClick={handleSave} className="gap-2"><Save className="w-4 h-4" /> Save Changes</Button>
          </div>
        </div>
      </motion.div>

      <div className="flex gap-6">
        {/* Sidebar Navigation */}
        <div className="w-52 shrink-0 space-y-1">
          {SECTIONS.map(s => (
            <button key={s.id} onClick={() => { setActiveSection(s.id); window.location.hash = s.id; }}
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
