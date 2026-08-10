import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { filterTabs } from "../services/api";
import { cn } from "../lib/utils";
import { useFavoritesStore } from "../store/favorites-store";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { getOverlayModules, getOverlaysByCategory } from "../overlays/registry";
import type { AnyOverlayModule, OverlayCategory } from "../overlays/types";
import {
  Image as ImageIcon, Eye, Link2, FlaskConical, SlidersHorizontal,
  Star, StarOff, Play, CheckCircle2, Circle, Info, LayoutGrid,
  Gift, Bell, Target, Gamepad2, Sparkles, Trophy, Music,
  TrendingUp, Crown, Search
} from "lucide-react";

const iconMap: Record<string, React.ElementType> = { "layout-grid": LayoutGrid, gift: Gift, bell: Bell, target: Target, "gamepad-2": Gamepad2, sparkles: Sparkles, trophy: Trophy, music: Music, "trending-up": TrendingUp, crown: Crown, star: Star };

// Convert registry module to Gallery overlay format
function moduleToOverlay(mod: AnyOverlayModule) {
  return {
    id: mod.id,
    name: mod.name,
    description: mod.description,
    thumbnail: mod.thumbnail || "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=400&h=225&fit=crop",
    category: mod.category,
    tags: mod.tags,
    isPremium: false,
    isNew: false,
    isPopular: false,
    isActive: false,
    isFavorite: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    previewUrl: "",
    config: mod.defaultConfig || {},
  };
}

export function OverlayGallery() {
  const [activeTab, setActiveTab] = useState<OverlayCategory>("all");
  const [selectedOverlay, setSelectedOverlay] = useState<any>(null);
  const { isFavorite, toggle } = useFavoritesStore();

  // Get all modules from registry
  const allModules = useMemo(() => getOverlayModules(), []);

  // Convert modules to overlay format
  const overlays = useMemo(() => allModules.map(moduleToOverlay), [allModules]);

  const filtered = overlays.filter(o => {
    if (activeTab === "all") return true;
    if (activeTab === "favorite") return isFavorite(o.id);
    if (activeTab === "premium") return o.isPremium;
    if (activeTab === "trending") return o.isPopular;
    return o.category === activeTab;
  });

  const previewOverlay = selectedOverlay || overlays[0] || null;

  return (
    <div className="flex h-full">
      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center border border-primary/30">
              <ImageIcon className="w-4 h-4 text-primary-light" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Overlay Gallery</h1>
              <p className="text-xs text-white/40">Browse, customize, and manage your stream overlays</p>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {filterTabs.map((tab) => {
              const Icon = iconMap[tab.icon] || LayoutGrid;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={cn("relative flex items-center gap-1.5 px-3.5 h-8 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0", isActive ? "text-white" : "text-white/40 hover:text-white/60")}>
                  {isActive && <motion.div layoutId="ft" className="absolute inset-0 rounded-lg bg-primary/20 border border-primary/30" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                  <div className="relative z-10 flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" />{tab.label}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4"><Search className="w-6 h-6 text-white/20" /></div>
              <h3 className="text-sm font-semibold text-white mb-1">No overlays found</h3>
              <p className="text-xs text-white/40 text-center max-w-xs">Try a different filter category or check if overlay modules are registered.</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-3">
                {filtered.map((overlay, i) => {
                  const fav = isFavorite(overlay.id);
                  const badge = overlay.isPremium ? { v: "premium" as const, l: "PRO" } : overlay.isNew ? { v: "new" as const, l: "NEW" } : overlay.isPopular ? { v: "popular" as const, l: "POPULAR" } : { v: "free" as const, l: "FREE" };
                  return (
                    <motion.div key={overlay.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                      className="group relative rounded-2xl border border-white/[0.06] bg-card overflow-hidden hover:border-primary/30 hover:shadow-[0_0_30px_rgba(124,58,237,0.15)] hover:scale-[1.005] transition-all duration-300">
                      <div className="flex">
                        <div className="relative w-48 shrink-0 overflow-hidden">
                          <img src={overlay.thumbnail} alt={overlay.name} className="w-full h-full object-cover" loading="lazy" />
                          <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button onClick={() => setSelectedOverlay(overlay)} className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/20">
                              <Play className="w-4 h-4 text-white ml-0.5" />
                            </button>
                          </div>
                          <div className="absolute top-3 left-3">
                            <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg backdrop-blur-md border text-[10px] font-medium ${overlay.isActive ? "bg-success/20 border-success/30 text-success" : "bg-white/[0.06] border-white/[0.1] text-white/40"}`}>
                              {overlay.isActive ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Circle className="w-2.5 h-2.5" />}
                              {overlay.isActive ? "Active" : "Inactive"}
                            </div>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 p-4 flex flex-col justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5">
                              <h3 className="text-sm font-semibold text-white truncate">{overlay.name}</h3>
                              <Badge variant={badge.v} className="text-[10px] px-1.5 py-0 shrink-0">{badge.l}</Badge>
                            </div>
                            <p className="text-xs text-white/40 line-clamp-2 leading-relaxed mb-3">{overlay.description}</p>
                            <div className="flex flex-wrap gap-1.5">
                              {overlay.tags.map(t => <span key={t} className="px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] text-white/30 capitalize">{t}</span>)}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col items-center justify-center gap-1.5 px-4 border-l border-white/[0.06] bg-white/[0.02]">
                          {[
                            { icon: Eye, label: "Preview", action: () => setSelectedOverlay(overlay) },
                            { icon: Link2, label: "Copy URL" },
                            { icon: FlaskConical, label: "Test" },
                            { icon: SlidersHorizontal, label: "Customize" },
                          ].map((a) => (
                            <button key={a.label} onClick={a.action} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/[0.06] transition-all" title={a.label}>
                              <a.icon className="w-3.5 h-3.5" />
                            </button>
                          ))}
                          <div className="w-8 h-[1px] bg-white/[0.06] my-0.5" />
                          <button onClick={() => toggle(overlay.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${fav ? "text-warning" : "text-white/30 hover:text-warning/60"}`}>
                            {fav ? <Star className="w-3.5 h-3.5 fill-warning" /> : <StarOff className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </AnimatePresence>
          )}
        </div>
      </div>

      {/* Preview Panel */}
      <div className="w-[340px] h-full bg-background/95 backdrop-blur-xl border-l border-white/[0.04] flex flex-col shrink-0 overflow-hidden">
        <div className="px-4 py-4 border-b border-white/[0.04]">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-white">Preview</h2>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon-sm"><Eye className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
          {previewOverlay ? (
            <p className="text-xs text-white/60 truncate">{previewOverlay.name}</p>
          ) : (
            <p className="text-xs text-white/30">No overlay selected</p>
          )}
        </div>

        {/* Preview Box */}
        <div className="flex-1 flex items-center justify-center p-4 bg-[#050505] border-b border-white/[0.04]">
          {previewOverlay ? (
            <motion.div key={previewOverlay.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="relative w-[280px] h-[158px] rounded-xl border border-white/[0.08] shadow-2xl bg-gradient-to-br from-card to-[#1a1a24] flex items-center justify-center overflow-hidden">
              <div className="text-center px-4">
                <Play className="w-8 h-8 text-primary/30 mx-auto mb-2" />
                <p className="text-sm font-medium text-white/70">{previewOverlay.name}</p>
                <p className="text-xs text-white/30 mt-1">Preview Window</p>
              </div>
            </motion.div>
          ) : (
            <div className="w-[280px] h-[158px] rounded-xl border border-white/[0.08] bg-gradient-to-br from-card to-[#1a1a24] flex items-center justify-center">
              <div className="text-center px-4 text-white/30">
                <p className="text-sm font-medium mb-1">No overlay available</p>
                <p className="text-xs">Register overlay modules to see previews</p>
              </div>
            </div>
          )}
        </div>

        {/* Quick Settings */}
        <div className="p-4 space-y-3 overflow-y-auto">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider mb-3">Quick Settings</p>
          {previewOverlay ? [
            { label: "Transparency", value: "90%" },
            { label: "Scale", value: "100%" },
            { label: "Border Radius", value: "12px" },
            { label: "Animation Speed", value: "Normal" },
          ].map((s) => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-xs text-white/40">{s.label}</span>
              <span className="text-xs text-white/60">{s.value}</span>
            </div>
          )) : (
            <p className="text-xs text-white/30">Select an overlay to customize</p>
          )}
        </div>
      </div>
    </div>
  );
}
