import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../store/app-store";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import {
  Search, Trash2, Play, Pause, Image, Video, Music,
  FileText, Folder, Grid, List, X, Upload, Eye, Download
} from "lucide-react";

type MediaType = "all" | "image" | "video" | "audio" | "gif";

interface MediaItem {
  id: string;
  name: string;
  type: "image" | "video" | "audio";
  source: "action" | "sound" | "custom";
  file: string;
  fileName: string;
  actionId?: string;
  actionName?: string;
  createdAt?: string;
}

const CATEGORY_TABS: { value: MediaType; label: string; icon: typeof Image }[] = [
  { value: "all", label: "All", icon: Folder },
  { value: "image", label: "Images", icon: Image },
  { value: "video", label: "Videos", icon: Video },
  { value: "audio", label: "Audio", icon: Music },
];

export function MediaLibraryPage() {
  const { actions, customSounds } = useAppStore();
  const [activeCategory, setActiveCategory] = useState<MediaType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  // Build media list from actions and sounds
  const mediaItems = useMemo<MediaItem[]>(() => {
    const items: MediaItem[] = [];

    // Collect media from actions
    for (const action of actions) {
      if (action.sound && action.soundFile) {
        items.push({
          id: `${action.id}_sound`,
          name: action.soundFileName || `${action.name} - Sound`,
          type: "audio",
          source: "action",
          file: action.soundFile,
          fileName: action.soundFileName || "",
          actionId: action.id,
          actionName: action.name,
        });
      }
      if (action.video && action.videoFile) {
        items.push({
          id: `${action.id}_video`,
          name: action.videoFileName || `${action.name} - Video`,
          type: "video",
          source: "action",
          file: action.videoFile,
          fileName: action.videoFileName || "",
          actionId: action.id,
          actionName: action.name,
        });
      }
      if (action.image && action.imageFile) {
        const isGif = action.imageFileName?.toLowerCase().endsWith(".gif") || false;
        items.push({
          id: `${action.id}_image`,
          name: action.imageFileName || `${action.name} - Image`,
          type: isGif ? "image" : "image",
          source: "action",
          file: action.imageFile,
          fileName: action.imageFileName || "",
          actionId: action.id,
          actionName: action.name,
        });
      }
    }

    // Collect media from custom sounds
    for (const sound of customSounds) {
      if (sound.file) {
        items.push({
          id: sound.id,
          name: sound.name,
          type: "audio",
          source: "sound",
          file: sound.file,
          fileName: sound.fileName || "",
        });
      }
    }

    return items;
  }, [actions, customSounds]);

  // Filter by category and search
  const filteredItems = useMemo(() => {
    return mediaItems.filter(item => {
      const matchesCategory = activeCategory === "all" || item.type === activeCategory;
      const matchesSearch = !searchQuery ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.actionName?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      return matchesCategory && matchesSearch;
    });
  }, [mediaItems, activeCategory, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: mediaItems.length,
    images: mediaItems.filter(i => i.type === "image").length,
    videos: mediaItems.filter(i => i.type === "video").length,
    audio: mediaItems.filter(i => i.type === "audio").length,
  }), [mediaItems]);

  const playAudio = (item: MediaItem) => {
    if (playingId === item.id) {
      setPlayingId(null);
      return;
    }
    if (item.type === "audio") {
      const audio = new Audio(item.file);
      audio.volume = 0.8;
      audio.play().then(() => setPlayingId(item.id)).catch(console.error);
      audio.onended = () => setPlayingId(null);
    }
  };

  const formatFileSize = (dataUrl: string): string => {
    if (!dataUrl) return "0 B";
    const base64 = dataUrl.split(",")[1] || "";
    const bytes = Math.round((base64.length * 3) / 4);
    if (bytes >= 1_048_576) return (bytes / 1_048_576).toFixed(1) + " MB";
    if (bytes >= 1_024) return (bytes / 1_024).toFixed(1) + " KB";
    return bytes + " B";
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "image": return <Image className="w-4 h-4" />;
      case "video": return <Video className="w-4 h-4" />;
      case "audio": return <Music className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "image": return "text-purple bg-purple/20";
      case "video": return "text-blue bg-blue/20";
      case "audio": return "text-green bg-green/20";
      default: return "text-white/50 bg-white/10";
    }
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Media Library</h1>
            <p className="text-xs text-white/40">Manage all your images, videos, GIFs, and audio files</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/[0.04] rounded-lg border border-white/[0.08] p-0.5">
              <button onClick={() => setViewMode("grid")} className={cn("p-1.5 rounded-md transition-all", viewMode === "grid" ? "bg-primary/20 text-primary-light" : "text-white/40 hover:text-white/60")}>
                <Grid className="w-4 h-4" />
              </button>
              <button onClick={() => setViewMode("list")} className={cn("p-1.5 rounded-md transition-all", viewMode === "list" ? "bg-primary/20 text-primary-light" : "text-white/40 hover:text-white/60")}>
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Bar */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
        className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total", value: stats.total, color: "text-white" },
          { label: "Images", value: stats.images, color: "text-purple" },
          { label: "Videos", value: stats.videos, color: "text-blue" },
          { label: "Audio", value: stats.audio, color: "text-green" },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-white/[0.06] text-center">
            <p className={cn("text-lg font-bold", s.color)}>{s.value}</p>
            <p className="text-[10px] text-white/40">{s.label}</p>
          </div>
        ))}
      </motion.div>

      {/* Search + Filter */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input type="text" placeholder="Search media..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-10 pr-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/40" />
        </div>
        <div className="flex gap-1 bg-white/[0.04] rounded-xl border border-white/[0.08] p-1">
          {CATEGORY_TABS.map(tab => (
            <button key={tab.value} onClick={() => setActiveCategory(tab.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                activeCategory === tab.value
                  ? "bg-primary/20 text-primary-light border border-primary/30"
                  : "text-white/50 hover:text-white/80 hover:bg-white/[0.04]"
              )}>
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Media Grid/List */}
      {filteredItems.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="rounded-2xl border border-white/[0.06] bg-card p-12 text-center">
          <Folder className="w-16 h-16 text-white/10 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white/60 mb-2">No media found</h3>
          <p className="text-sm text-white/30 max-w-md mx-auto">
            {mediaItems.length === 0
              ? "Upload images, videos, or sounds in the Actions or Sounds pages to see them here."
              : "No media matches your search or filter criteria."
            }
          </p>
        </motion.div>
      ) : viewMode === "grid" ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filteredItems.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => setSelectedItem(item)}
              className="group rounded-xl border border-white/[0.06] bg-card overflow-hidden hover:border-white/[0.12] transition-all cursor-pointer">
              {/* Preview */}
              <div className="aspect-square bg-white/[0.02] flex items-center justify-center relative overflow-hidden">
                {item.type === "image" ? (
                  <img src={item.file} alt={item.name} className="w-full h-full object-cover" />
                ) : item.type === "video" ? (
                  <video src={item.file} className="w-full h-full object-cover" muted />
                ) : (
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", getTypeColor(item.type))}>
                    {getTypeIcon(item.type)}
                  </div>
                )}
                {/* Overlay on hover */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center text-white hover:bg-white/30 transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                  {item.type === "audio" && (
                    <button onClick={(e) => { e.stopPropagation(); playAudio(item); }}
                      className="w-8 h-8 rounded-lg bg-primary/40 flex items-center justify-center text-white hover:bg-primary/60 transition-colors">
                      {playingId === item.id ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                {/* Type badge */}
                <div className="absolute top-2 right-2">
                  <span className={cn("px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase", getTypeColor(item.type))}>
                    {item.type}
                  </span>
                </div>
              </div>
              {/* Info */}
              <div className="p-2.5">
                <p className="text-xs font-medium text-white/80 truncate">{item.name}</p>
                <p className="text-[10px] text-white/30 mt-0.5">{formatFileSize(item.file)}</p>
                {item.actionName && (
                  <p className="text-[10px] text-primary/60 mt-0.5 truncate">Used in: {item.actionName}</p>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        /* List View */
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          className="rounded-2xl border border-white/[0.06] bg-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Preview</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Source</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Size</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-white/40 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} onClick={() => setSelectedItem(item)}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer transition-colors">
                  <td className="px-4 py-2">
                    <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center overflow-hidden">
                      {item.type === "image" ? (
                        <img src={item.file} alt="" className="w-full h-full object-cover" />
                      ) : item.type === "video" ? (
                        <video src={item.file} className="w-full h-full object-cover" muted />
                      ) : (
                        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", getTypeColor(item.type))}>
                          {getTypeIcon(item.type)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-white/80">{item.name}</p>
                    {item.actionName && <p className="text-[10px] text-white/30">Used in: {item.actionName}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold uppercase", getTypeColor(item.type))}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/50 capitalize">{item.source}</td>
                  <td className="px-4 py-3 text-xs text-white/50">{formatFileSize(item.file)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.type === "audio" && (
                        <button onClick={(e) => { e.stopPropagation(); playAudio(item); }}
                          className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-primary/20 text-white/60 hover:text-primary-light flex items-center justify-center transition-all">
                          {playingId === item.id ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedItem(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", getTypeColor(selectedItem.type))}>
                    {getTypeIcon(selectedItem.type)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{selectedItem.name}</h3>
                    <p className="text-[10px] text-white/40">{formatFileSize(selectedItem.file)} · {selectedItem.type}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedItem(null)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Preview Content */}
              <div className="flex-1 flex items-center justify-center p-6 bg-black/20 min-h-[300px]">
                {selectedItem.type === "image" ? (
                  <img src={selectedItem.file} alt={selectedItem.name} className="max-w-full max-h-[50vh] object-contain rounded-lg" />
                ) : selectedItem.type === "video" ? (
                  <video src={selectedItem.file} controls autoPlay className="max-w-full max-h-[50vh] rounded-lg" />
                ) : (
                  <div className="text-center">
                    <div className={cn("w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4", getTypeColor(selectedItem.type))}>
                      {playingId === selectedItem.id ? (
                        <Pause className="w-8 h-8" />
                      ) : (
                        <Music className="w-8 h-8" />
                      )}
                    </div>
                    <Button onClick={() => playAudio(selectedItem)} className="gap-2">
                      {playingId === selectedItem.id ? (
                        <><Pause className="w-4 h-4" /> Pause</>
                      ) : (
                        <><Play className="w-4 h-4" /> Play Sound</>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-white/[0.06] flex items-center justify-between">
                <div className="text-xs text-white/40">
                  {selectedItem.actionName && <span>Used in: <span className="text-primary/60">{selectedItem.actionName}</span></span>}
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => {
                    const a = document.createElement("a");
                    a.href = selectedItem.file;
                    a.download = selectedItem.fileName || selectedItem.name;
                    a.click();
                  }} className="gap-1.5">
                    <Download className="w-3.5 h-3.5" /> Download
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
export default MediaLibraryPage;
