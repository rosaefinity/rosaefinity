import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../store/app-store";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { cn } from "../lib/utils";
import {
  Plus, Search, Edit, Trash2, ChevronDown, Gift, User, Heart,
  MessageSquare, Share2, UserPlus, Star, Zap, Loader2, X,
  AlertTriangle, CheckCircle2, Globe, Settings, Minus
} from "lucide-react";

const triggerTypes = [
  { value: "gift", label: "🎁 Any Gift", icon: Gift },
  { value: "specificgift", label: "🎁 Specific Gift", icon: Gift },
  { value: "giftcoins", label: "💰 Gift ≥ Coins", icon: AlertTriangle },
  { value: "follow", label: "👤 Follow", icon: UserPlus },
  { value: "like", label: "❤️ Likes", icon: Heart },
  { value: "comment", label: "💬 Comment", icon: MessageSquare },
  { value: "command", label: "💬 Command (/cmd)", icon: Globe },
  { value: "join", label: "👋 Join", icon: Share2 },
  { value: "firstactivity", label: "⚡ First Activity", icon: Zap },
  { value: "subscribe", label: "⭐ Subscribe", icon: Star },
];

const whoTriggers = [
  { value: "any", label: "Anyone" },
  { value: "anyfollower", label: "Followers Only" },
  { value: "anysubscriber", label: "Subscribers Only" },
  { value: "anymoderator", label: "Moderators Only" },
  { value: "topgifter", label: "Top Gifters" },
  { value: "specificuser", label: "Specific User" },
];

const GIFT_EMOJI: Record<string, string> = {
  'rose': '🌹', 'lion': '🦁', 'heart': '❤️', 'love': '🥰',
  'gg': '👍', 'tiktok': '📱', 'galaxy': '🌌', 'swan': '🦢',
  'train': '🚂', 'cake': '🎂', 'confetti': '🎊', 'perfume': '🧴',
  'corgi': '🐕', 'whale': '🐋', 'jets': '✈️', 'chicken': '🍗',
  'ice cream': '🍦', 'bouquet': '💐', 'cap': '🧢', 'necklace': '📿',
  'gold': '🥇', 'team': '👥', 'doughnut': '🍩', 'interstellar': '🚀',
  'money': '💰', 'amazing': '🌟', 'awesome': '😎', 'birthday': '🎉',
  'community': '🎪', 'boxing': '🥊', 'hands': '🤲', 'finger': '👉',
  'friendship': '🤝', 'pump': '💪', 'flying': '✈️',
};

function getGiftEmoji(name: string) {
  if (!name) return '🎁';
  const n = name.toLowerCase();
  for (const [key, emoji] of Object.entries(GIFT_EMOJI)) {
    if (n.includes(key)) return emoji;
  }
  return '🎁';
}

export function AlertsPage() {
  const { events, actions, tikTokGifts, addEvent, updateEvent, deleteEvent, setTikTokGifts, getAlertsMasterEnabled, setAlertsMasterEnabled } = useAppStore();
  const alertsMasterEnabled = getAlertsMasterEnabled();
  const [showModal, setShowModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [formData, setFormData] = useState<Record<string, any>>({
    triggerType: "gift",
    whoTrigger: "any",
    actionName: "",
    actionNames: [],
    actionMode: "single", // "single" or "random"
    enabled: true,
    specificUser: "",
    giftName: "",
    minCoins: 1,
    minLikes: 100,
    keyword: "",
  });
  const [giftSearch, setGiftSearch] = useState("");
  const [selectedGift, setSelectedGift] = useState<string | null>(null);
  const [showGiftList, setShowGiftList] = useState(false);

  const filteredGifts = tikTokGifts
    .filter(g => g.name.toLowerCase().includes(giftSearch.toLowerCase()))
    .sort((a, b) => a.coins - b.coins || a.name.localeCompare(b.name));

  const resetForm = () => {
    setFormData({
      triggerType: "gift",
      whoTrigger: "any",
      actionName: "",
      actionNames: [],
      actionMode: "single",
      enabled: true,
      specificUser: "",
      giftName: "",
      minCoins: 1,
      minLikes: 100,
      keyword: "",
    });
    setSelectedGift(null);
  };

  const openCreateModal = () => {
    resetForm();
    setEditingEvent(null);
    setShowModal(true);
  };

  const openEditModal = (event: any) => {
    // Detect mode: random if actionNames has 2+ items, otherwise single
    const hasRandomActions = event.actionNames && event.actionNames.length > 1;
    const formDataWithDefaults = {
      ...event,
      actionNames: event.actionNames || (event.actionName ? [event.actionName] : []),
      actionMode: hasRandomActions ? "random" : "single",
    };
    setFormData(formDataWithDefaults);
    if (event.giftName) setSelectedGift(event.giftName);
    setEditingEvent(event);
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const isRandomMode = formData.actionMode === "random";

    if (isRandomMode) {
      // Validate random mode: at least 1, max 8 actions
      const selectedActions = formData.actionNames || [];
      if (selectedActions.length === 0) {
        alert("Please select at least one action");
        return;
      }
      if (selectedActions.length > 8) {
        alert("Maximum 8 random actions allowed");
        return;
      }
    } else {
      // Validate single mode: exactly 1 action
      if (!formData.actionName) {
        alert("Please select an action");
        return;
      }
    }

    if (formData.triggerType === "specificgift" && !selectedGift) {
      alert("Pilih gift");
      return;
    }

    const selectedActions = formData.actionNames || [];
    const data = {
      ...formData,
      // For random mode, set actionNames array; for single mode, clear it
      actionNames: isRandomMode ? selectedActions : [],
      // For backward compatibility, always set actionName
      actionName: isRandomMode ? (selectedActions[0] || "") : formData.actionName,
      giftName: formData.triggerType === "specificgift" ? selectedGift : formData.giftName,
      specificUser: formData.whoTrigger === "specificuser" ? formData.specificUser : "",
    };

    if (editingEvent) {
      updateEvent(editingEvent.id, data);
    } else {
      addEvent(data as any);
    }
    setShowModal(false);
  };

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Alerts / Events</h1>
            <p className="text-xs text-white/40">Link TikTok Live events to actions</p>
          </div>
          <Button onClick={openCreateModal} className="gap-2">
            <Plus className="w-4 h-4" /> Create Event
          </Button>
        </div>
      </motion.div>

      {/* Master Toggle */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-white/[0.06] bg-card p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-primary-light" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Master Alert Toggle</h3>
              <p className="text-xs text-white/40">Enable or disable all alerts for this profile</p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" checked={alertsMasterEnabled} onChange={e => setAlertsMasterEnabled(e.target.checked)} className="sr-only peer" />
            <div className="w-11 h-6 bg-white/[0.08] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full" />
          </label>
        </div>
      </motion.div>

      {/* Events Table */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-white/[0.06] bg-card overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input type="text" placeholder="Search events..." className="w-full h-9 pl-10 pr-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/40" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Trigger</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Who → Action</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider w-28">Controls</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-12 text-center text-white/30">
                    No events defined. Click 'Create Event' to start.
                  </td>
                </tr>
              ) : (
                events.map((ev, index) => {
                  const trigger = triggerTypes.find(t => t.value === ev.triggerType);
                  let triggerText = trigger?.label || ev.triggerType;
                  if (ev.triggerType === "specificgift" && ev.giftName) {
                    triggerText = `${getGiftEmoji(ev.giftName)} ${ev.giftName}`;
                  } else if (ev.triggerType === "giftcoins" && ev.minCoins) {
                    triggerText = `💰 Gift ≥ ${ev.minCoins} Coin`;
                  } else if (ev.triggerType === "like" && ev.minLikes) {
                    triggerText = `❤️ Tap ${ev.minLikes}+ Likes`;
                  } else if (ev.triggerType === "command" && ev.keyword) {
                    triggerText = `💬 /${ev.keyword}`;
                  }
                  const whoText = ev.whoTrigger && ev.whoTrigger !== "any" ? ev.whoTrigger : "Anyone";
                  return (
                    <motion.tr key={ev.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Badge variant={ev.enabled ? "outline" : "outline"} className="text-[10px]">{ev.enabled ? "ON" : "OFF"}</Badge>
                          <span className={`font-medium ${ev.enabled ? "text-white" : "text-white/40"}`}>{triggerText}</span>
                          {ev.triggerType === "giftcoins" && ev.minCoins && <span className="text-xs text-white/40">(≥{ev.minCoins} coins)</span>}
                          {ev.triggerType === "like" && ev.minLikes && <span className="text-xs text-white/40">(≥{ev.minLikes})</span>}
                          {ev.triggerType === "command" && ev.keyword && <span className="text-xs text-white/40">{`/${ev.keyword}`}</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white/40">{whoText}</span>
                          <span className="text-white/30">→</span>
                          {ev.actionNames && ev.actionNames.length > 1 ? (
                            <span className="font-medium text-white/70 flex items-center gap-1">
                              <span className="text-primary">🎲</span>
                              {ev.actionNames.length} actions
                            </span>
                          ) : (
                            <span className="font-medium text-white/70">{ev.actionName || "-"}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEditModal(ev)} title="Edit">
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" onClick={() => deleteEvent(ev.id)} title="Delete" className="text-danger/60 hover:text-danger">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                }
              ))}
              </tbody>
          </table>
        </div>
      </motion.div>

      {/* Event Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border border-white/[0.08] rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">{editingEvent ? "Edit Event" : "Create Event"}</h2>
                <button onClick={() => setShowModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-4 space-y-4">
                {/* Trigger Type */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Trigger Type</label>
                  <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                    {triggerTypes.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, triggerType: t.value });
                          setSelectedGift(null);
                        }}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-all",
                          formData.triggerType === t.value
                            ? "bg-primary/20 border border-primary/30 text-primary-light"
                            : "bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08]"
                        )}
                      >
                        <t.icon className="w-4 h-4" /> {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dynamic Fields */}
                <AnimatePresence mode="wait">
                  {formData.triggerType === "specificgift" && (
                    <motion.div key="specificgift" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <div className="space-y-3">
                        <label className="block text-xs font-medium text-white/50 mb-2">Select Gift</label>
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setShowGiftList(!showGiftList)}
                            className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-left text-white placeholder:text-white/20 flex items-center justify-between"
                          >
                            <span>{selectedGift ? `${getGiftEmoji(selectedGift)} ${selectedGift}` : "Click to select gift"}</span>
                            <ChevronDown className="w-4 h-4 text-white/40" />
                          </button>
                          <AnimatePresence>
                            {showGiftList && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                className="absolute z-50 top-full left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-[#1a1a24] border border-white/[0.08] rounded-xl shadow-2xl"
                              >
                                <div className="p-2 border-b border-white/[0.06]">
                                  <input
                                    type="text"
                                    placeholder="Search gifts..."
                                    value={giftSearch}
                                    onChange={(e) => setGiftSearch(e.target.value)}
                                    className="w-full h-8 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none"
                                  />
                                </div>
                                <div className="grid grid-cols-2 gap-2 p-2">
                                  {filteredGifts.length === 0 ? (
                                    <div className="col-span-2 text-center text-white/30 py-4">No gifts found</div>
                                  ) : (
                                    filteredGifts.map((g) => (
                                      <button
                                        key={g.name}
                                        type="button"
                                        onClick={() => {
                                          setSelectedGift(g.name);
                                          setShowGiftList(false);
                                        }}
                                        className={cn(
                                          "flex flex-col items-center gap-1 p-3 rounded-xl text-left transition-all",
                                          selectedGift === g.name
                                            ? "bg-primary/20 border border-primary/30"
                                            : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08]"
                                        )}
                                      >
                                        <span className="text-2xl">{getGiftEmoji(g.name)}</span>
                                        <span className="text-[10px] font-medium truncate w-full">{g.name}</span>
                                        <span className="text-[10px] text-yellow-400 font-semibold">{g.coins.toLocaleString()} coins</span>
                                      </button>
                                    ))
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    </motion.div>
                  )}
                  {(formData.triggerType === "gift" || formData.triggerType === "giftcoins") && (
                    <motion.div key="giftcoins" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-2">Minimum Coins</label>
                        <input
                          type="number"
                          min="1"
                          max="100000"
                          value={formData.minCoins}
                          onChange={(e) => setFormData({ ...formData, minCoins: parseInt(e.target.value) || 1 })}
                          className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40"
                        />
                      </div>
                    </motion.div>
                  )}
                  {formData.triggerType === "like" && (
                    <motion.div key="like" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-2">Minimum Likes</label>
                        <input
                          type="number"
                          min="1"
                          max="10000"
                          value={formData.minLikes}
                          onChange={(e) => setFormData({ ...formData, minLikes: parseInt(e.target.value) || 100 })}
                          className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40"
                        />
                      </div>
                    </motion.div>
                  )}
                  {formData.triggerType === "command" && (
                    <motion.div key="command" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-2">Command Keyword (without /)</label>
                        <input
                          type="text"
                          value={formData.keyword}
                          onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                          placeholder="e.g., play, skip, song"
                          className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/40"
                        />
                      </div>
                    </motion.div>
                  )}
                  {formData.whoTrigger === "specificuser" && (
                    <motion.div key="specificuser" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                      <div>
                        <label className="block text-xs font-medium text-white/50 mb-2">TikTok Username (without @)</label>
                        <input
                          type="text"
                          value={formData.specificUser}
                          onChange={(e) => setFormData({ ...formData, specificUser: e.target.value })}
                          placeholder="username"
                          className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/40"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Who Trigger */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Who Can Trigger</label>
                  <div className="grid grid-cols-2 gap-2">
                    {whoTriggers.map((w) => (
                      <button
                        key={w.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, whoTrigger: w.value })}
                        className={cn(
                          "px-3 py-2 rounded-xl text-sm font-medium transition-all",
                          formData.whoTrigger === w.value
                            ? "bg-primary/20 border border-primary/30 text-primary-light"
                            : "bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08]"
                        )}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Mode Toggle */}
                <div>
                  <label className="block text-xs font-medium text-white/50 mb-2">Action Mode</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, actionMode: "single", actionNames: [] })}
                      className={cn(
                        "px-3 py-2 rounded-xl text-sm font-medium transition-all",
                        formData.actionMode === "single"
                          ? "bg-primary/20 border border-primary/30 text-primary-light"
                          : "bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08]"
                      )}
                    >
                      ⚡ Trigger this action
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, actionMode: "random", actionName: "" })}
                      className={cn(
                        "px-3 py-2 rounded-xl text-sm font-medium transition-all",
                        formData.actionMode === "random"
                          ? "bg-primary/20 border border-primary/30 text-primary-light"
                          : "bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08]"
                      )}
                    >
                      🎲 Random action
                    </button>
                  </div>
                </div>

                {/* Single Action Select */}
                {formData.actionMode === "single" && (
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-2">Action to Trigger *</label>
                    <select
                      value={formData.actionName}
                      onChange={(e) => setFormData({ ...formData, actionName: e.target.value })}
                      className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40"
                      required
                    >
                      <option value="">-- Select Action --</option>
                      {actions.map((a) => (
                        <option key={a.id} value={a.name} disabled={!a.enabled}>
                          {a.enabled ? "" : "[DISABLED] "}{a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Random Action Multi-Select */}
                {formData.actionMode === "random" && (
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-2">
                      🎲 Trigger one of these actions (random) *
                      <span className="text-white/30 ml-2">(1-8 actions)</span>
                    </label>
                    <div className="max-h-48 overflow-y-auto border border-white/[0.08] rounded-xl bg-white/[0.02] p-2 space-y-1">
                      {actions.length === 0 ? (
                        <p className="text-xs text-white/30 text-center py-2">No actions available</p>
                      ) : (
                        actions.map((a) => {
                          const isSelected = (formData.actionNames || []).includes(a.name);
                          return (
                            <label
                              key={a.id}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all",
                                isSelected ? "bg-primary/20 border border-primary/30" : "hover:bg-white/[0.04]",
                                !a.enabled && "opacity-50"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                disabled={!a.enabled}
                                onChange={(e) => {
                                  const currentNames = formData.actionNames || [];
                                  let newNames;
                                  if (e.target.checked) {
                                    if (currentNames.length >= 8) {
                                      alert("Maximum 8 random actions allowed");
                                      return;
                                    }
                                    newNames = [...currentNames, a.name];
                                  } else {
                                    newNames = currentNames.filter((n: string) => n !== a.name);
                                  }
                                  setFormData({ ...formData, actionNames: newNames });
                                }}
                                className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-primary"
                              />
                              <span className="text-sm text-white/70">
                                {!a.enabled && "[DISABLED] "}{a.name}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                    {(formData.actionNames || []).length > 0 && (
                      <p className="text-xs text-white/40 mt-2">
                        Selected: {(formData.actionNames || []).length}/8
                      </p>
                    )}
                  </div>
                )}

                {/* Enabled Toggle */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-primary"
                    />
                    <span className="text-sm text-white/70">Enabled</span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.06]">
                  <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
                  <Button type="submit" className="gap-2">
                    {editingEvent ? "Update Event" : "Create Event"}
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AlertsPage;