import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../store/app-store";
import { Button } from "../components/ui/button";
import { cn } from "../lib/utils";
import {
  Monitor, Smartphone, Square, ExternalLink, RotateCcw, Settings2,
  ChevronDown, Lightbulb, Sparkles, Wifi, WifiOff, Eye, Maximize2,
  AlertTriangle, CheckCircle2
} from "lucide-react";
import { getOverlayModule } from "../overlays/registry";
import { GiftAlertRenderer } from "../overlays/gift-alert/GiftAlertRenderer";
import type { RendererProps } from "../overlays/types";

type AspectRatio = "16:9" | "9:16" | "1:1";

export function OverlayPage() {
  const { screenConnections, setupConfig, actions } = useAppStore();
  const connectedScreens = Object.values(screenConnections).filter(c => c.isLive);
  const isAnyLive = connectedScreens.length > 0;
  const liveUsernames = connectedScreens.map(c => `@${c.username}`).join(", ") || "None";
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [showSettings, setShowSettings] = useState(false);
  const [showTips, setShowTips] = useState(true);
  const [previewConfig, setPreviewConfig] = useState({
    theme: "dark" as const,
    primaryColor: "#7C3AED",
    secondaryColor: "#EC4899",
    transparency: 0.9,
    scale: 1,
    borderRadius: 12,
    animationSpeed: "normal" as const,
  });

  // Get the Gift Alert module for preview
  const giftAlertModule = getOverlayModule("gift-alert");

  // Load saved aspect ratio from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("rf_overlay_aspectRatio");
    if (saved && ["16:9", "9:16", "1:1"].includes(saved)) {
      setAspectRatio(saved as AspectRatio);
    }
  }, []);

  // Save aspect ratio when changed
  const handleAspectRatioChange = (ratio: AspectRatio) => {
    setAspectRatio(ratio);
    localStorage.setItem("rf_overlay_aspectRatio", ratio);
  };

  const ratioDimensions = { "16:9": { width: 320, height: 180 }, "9:16": { width: 180, height: 320 }, "1:1": { width: 250, height: 250 } };
  const dims = ratioDimensions[aspectRatio];

  // Preview config for Gift Alert renderer
  const giftAlertConfig = giftAlertModule?.defaultConfig || {};

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-primary-light" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Stream Overlay</h1>
              <p className="text-xs text-white/40">Preview and configure your stream overlay</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" title="Open in new window"><ExternalLink className="w-4 h-4" /></Button>
            <Button variant="ghost" size="icon-sm" title="Refresh"><RotateCcw className="w-4 h-4" /></Button>
          </div>
        </div>
      </motion.div>

      {/* Status Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-white/[0.06] bg-card p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isAnyLive ? "bg-green/20" : "bg-red/20"}`}>
              {isAnyLive ? <CheckCircle2 className="w-5 h-5 text-green" /> : <AlertTriangle className="w-5 h-5 text-red" />}
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Overlay Status</h3>
              <p className="text-xs text-white/40">{isAnyLive ? `Receiving from ${liveUsernames}` : "Not connected to TikTok Live"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${isAnyLive ? "bg-green/20 border border-green/30 text-green" : "bg-red/20 border border-red/30 text-red"}`}>
              {isAnyLive ? <span className="w-1.5 h-1.5 rounded-full bg-green animate-pulse" /> : null}
              {isAnyLive ? "LIVE" : "OFFLINE"}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="p-3 rounded-xl bg-white/[0.03]">
            <p className="text-2xl font-bold text-white">{actions.filter(a => a.enabled).length}</p>
            <p className="text-xs text-white/40">Active Actions</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03]">
            <p className="text-2xl font-bold text-white">{setupConfig.tikTokName || "—"}</p>
            <p className="text-xs text-white/40">TikTok Username</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03]">
            <p className="text-2xl font-bold text-white">{setupConfig.obsIp}:{setupConfig.obsPort}</p>
            <p className="text-xs text-white/40">OBS WebSocket</p>
          </div>
          <div className="p-3 rounded-xl bg-white/[0.03]">
            <p className="text-2xl font-bold text-white">Ready</p>
            <p className="text-xs text-white/40">Overlay Engine</p>
          </div>
        </div>
      </motion.div>

      {/* Aspect Ratio Selector */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl border border-white/[0.06] bg-card p-4 mb-6">
        <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Preview Aspect Ratio</p>
        <div className="flex gap-2">
          {(["16:9", "9:16", "1:1"] as AspectRatio[]).map((ratio) => (
            <button
              key={ratio}
              onClick={() => handleAspectRatioChange(ratio)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all",
                aspectRatio === ratio
                  ? "bg-primary/20 border border-primary/30 text-primary-light"
                  : "bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08]"
              )}
            >
              {ratio === "16:9" && <Monitor className="w-4 h-4" />}
              {ratio === "9:16" && <Smartphone className="w-4 h-4" />}
              {ratio === "1:1" && <Square className="w-4 h-4" />}
              {ratio}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Preview Area */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-white/[0.06] bg-card p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Live Preview</h3>
          <div className="flex items-center gap-2">
            <Button variant="glass" size="sm" className="gap-1.5">
              <Maximize2 className="w-3.5 h-3.5" /> Open Fullscreen
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={aspectRatio}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ width: dims.width, height: dims.height }}
              className="relative rounded-xl border border-white/[0.08] shadow-2xl overflow-hidden bg-gradient-to-br from-card to-[#1a1a24]"
            >
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <div className="text-center" style={{ opacity: previewConfig.transparency, transform: `scale(${previewConfig.scale})`, borderRadius: previewConfig.borderRadius }}>
                  <div className="w-full h-full bg-background/90 rounded-xl border border-white/[0.1] flex items-center justify-center relative overflow-hidden">
                    {giftAlertModule ? (
                      // Render the actual Gift Alert renderer with preview event
                      <GiftAlertRenderer
                        config={giftAlertConfig}
                        mode="preview"
                        size={{ width: dims.width, height: dims.height }}
                      />
                    ) : (
                      <div className="text-center">
                        <WifiOff className="w-12 h-12 text-white/20 mx-auto mb-3" />
                        <p className="text-sm font-medium text-white/70 mb-1">Overlay Preview</p>
                        <p className="text-xs text-white/40">Gift Alert module not registered</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Quick Settings Toggle */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={() => setShowSettings(!showSettings)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl hover:bg-white/[0.03] transition-colors border border-white/[0.04]"
      >
        <div className="flex items-center gap-3">
          <Settings2 className="w-5 h-5 text-white/40" />
          <span className="text-sm font-medium text-white/70">Quick Settings</span>
        </div>
        <ChevronDown className={cn("w-5 h-5 text-white/30 transition-transform", showSettings && "rotate-180")} />
      </motion.button>

      {/* Quick Settings Panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 rounded-2xl border border-white/[0.06] bg-card p-4 overflow-hidden"
          >
            <div className="space-y-4">
              <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Overlay Appearance</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Theme</label>
                  <select
                    value={previewConfig.theme}
                    onChange={(e) => setPreviewConfig({ ...previewConfig, theme: e.target.value as any })}
                    className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40"
                  >
                    <option value="dark">Dark</option>
                    <option value="light">Light</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Primary Color</label>
                  <input type="color" value={previewConfig.primaryColor} onChange={(e) => setPreviewConfig({ ...previewConfig, primaryColor: e.target.value })} className="w-full h-9 rounded-xl border border-white/[0.08] bg-transparent cursor-pointer" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Secondary Color</label>
                  <input type="color" value={previewConfig.secondaryColor} onChange={(e) => setPreviewConfig({ ...previewConfig, secondaryColor: e.target.value })} className="w-full h-9 rounded-xl border border-white/[0.08] bg-transparent cursor-pointer" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Border Radius: {previewConfig.borderRadius}px</label>
                  <input type="range" min="0" max="32" value={previewConfig.borderRadius} onChange={(e) => setPreviewConfig({ ...previewConfig, borderRadius: parseInt(e.target.value) })} className="w-full h-2 accent-primary" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Transparency: {Math.round(previewConfig.transparency * 100)}%</label>
                  <input type="range" min="0" max="1" step="0.05" value={previewConfig.transparency} onChange={(e) => setPreviewConfig({ ...previewConfig, transparency: parseFloat(e.target.value) })} className="w-full h-2 accent-primary" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Scale: {Math.round(previewConfig.scale * 100)}%</label>
                  <input type="range" min="0.5" max="2" step="0.05" value={previewConfig.scale} onChange={(e) => setPreviewConfig({ ...previewConfig, scale: parseFloat(e.target.value) })} className="w-full h-2 accent-primary" />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Animation Speed</label>
                  <select
                    value={previewConfig.animationSpeed}
                    onChange={(e) => setPreviewConfig({ ...previewConfig, animationSpeed: e.target.value as any })}
                    className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40"
                  >
                    <option value="slow">Slow</option>
                    <option value="normal">Normal</option>
                    <option value="fast">Fast</option>
                  </select>
                </div>
              </div>
              <Button variant="secondary" className="w-full gap-2" onClick={() => setPreviewConfig({ theme: "dark", primaryColor: "#7C3AED", secondaryColor: "#EC4899", transparency: 0.9, scale: 1, borderRadius: 12, animationSpeed: "normal" })}>
                <RotateCcw className="w-3.5 h-3.5" /> Reset to Default
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tips */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-6 rounded-2xl border border-white/[0.06] bg-card overflow-hidden">
        <button onClick={() => setShowTips(!showTips)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors">
          <div className="flex items-center gap-3">
            <Lightbulb className="w-5 h-5 text-warning" />
            <span className="text-sm font-medium text-white/70">Tips & Usage</span>
          </div>
          <ChevronDown className={cn("w-5 h-5 text-white/30 transition-transform", showTips && "rotate-180")} />
        </button>
        <AnimatePresence>
          {showTips && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="p-4 border-t border-white/[0.04]">
              <div className="space-y-3">
                {[
                  "Use 16:9 for landscape streams, 9:16 for TikTok/Reels, 1:1 for square",
                  "Add the overlay URL as a Browser Source in OBS Studio",
                  "Enable 'Control audio via OBS' in Browser Source properties",
                  "Test each action before going live using the Test button",
                  "Adjust transparency for better readability on your stream layout",
                  "Custom colors help match your brand identity",
                ].map((tip, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-5 h-5 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] text-primary-light font-semibold shrink-0">{i + 1}</div>
                    <p className="text-xs text-white/50 leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

export default OverlayPage;