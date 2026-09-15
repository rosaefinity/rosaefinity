import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../store/app-store";
import { useLicenseStore } from "../store/license-store";
import { UpgradeDialog } from "../components/UpgradeDialog";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { showTestNotification } from "../components/TestNotification";
import { toast } from "../components/Toast";
import { getGifts, getGiftsSync, getGiftEmoji, getGiftImageUrl, type TikTokGift } from "../services/gift-service";
import { sendToOverlay } from "../lib/overlay-bus";
import { saveActionMedia, deleteActionMedia } from "../lib/db";
import { getOverlayWidgetUrl } from "../lib/browser-source-url";
import { normalizeScreenWithTrace as normalizeScreen } from "../lib/screen-normalizer";
import { executeAction } from "../store/event-dispatch";
import {
  Plus, Search, Play, Edit, Trash2, X, Copy, CheckCircle2,
  Music, Video, Image, Keyboard, Monitor, Gift, Heart, Bell,
  MessageSquare, Share2, UserPlus, Star, Zap, Globe,
  AlertTriangle, Volume2, Lock, ArrowRight, Sparkles
} from "lucide-react";

// ── SPECIAL KEYS & MODIFIERS (sama persis kaya Electron) ──────
const SPECIAL_KEYS = [
  "F1","F2","F3","F4","F5","F6","F7","F8","F9","F10","F11","F12",
  "Enter","Escape","Tab","Space","Backspace","Delete",
  "ArrowUp","ArrowDown","ArrowLeft","ArrowRight","Home","End","PageUp","PageDown",
];

const MODIFIERS = ["Ctrl","Shift","Alt"];

const EVENT_ICONS: Record<string, string> = {
  gift: "🎁", follow: "👤", comment: "💬", like: "❤️",
  share: "🔗", join: "👋", subscribe: "⭐", command: "💬",
  giftcoins: "💰", specificgift: "🎁", firstactivity: "⚡",
  subemote: "⭐", fansclub: "💎", shop: "🛒",
};

const TRIGGER_TYPES = [
  { value: "gift", label: "Gift" },
  { value: "giftcoins", label: "Gift (min. coins)" },
  { value: "specificgift", label: "Specific Gift" },
  { value: "like", label: "Sending likes (Tap)" },
  { value: "follow", label: "Follow" },
  { value: "share", label: "Share" },
  { value: "join", label: "Join" },
  { value: "firstactivity", label: "First user activity" },
  { value: "subscribe", label: "Subscribe" },
  { value: "comment", label: "Chat (any comment)" },
  { value: "command", label: "Commenting a command" },
  { value: "subemote", label: "Sending a subscriber emote" },
  { value: "fansclub", label: "Sending a fan club sticker" },
  { value: "shop", label: "TikTok Shop purchase" },
];

const WHO_TRIGGERS = [
  { value: "any", label: "👤 Everyone" },
  { value: "anyfollower", label: "👥 Any Follower" },
  { value: "anysubscriber", label: "⭐ Any Subscriber" },
  { value: "anymoderator", label: "🛡️ Any Moderator" },
  { value: "topgifter", label: "🏆 Top Gifter" },
  { value: "specificuser", label: "👤 A specific user" },
];

// ── MEDIA TOGGLE SUB-COMPONENT ─────────────────
function MediaToggle({ icon: Icon, label, color, formKey, form, setForm, children }: any) {
  return (
    <div className="border border-white/[0.06] rounded-xl p-3 space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={form[formKey]} onChange={e => setForm({...form, [formKey]: e.target.checked})}
          className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-primary" />
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-sm text-white/80">{label}</span>
      </label>
      {form[formKey] && <div className="ml-6">{children}</div>}
    </div>
  );
}

// ── GIFT CARD ──────────────────────────────────
function GiftCard({ gift, selected, onSelect }: { gift: TikTokGift; selected: boolean; onSelect: () => void }) {
  const [src, setSrc] = useState(gift.image || "");
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    if (!failed && gift.cdnImage) {
      setFailed(true);
      setSrc(gift.cdnImage);
    } else if (!failed && gift.giftId) {
      setFailed(true);
      setSrc(`https://p16-webcast.tiktokcdn.com/img/alisg/webcast-sg/resource/composed.${gift.giftId}.png~tplv-obj.webp`);
    } else {
      setSrc("");
    }
  };

  return (
    <button type="button" onClick={onSelect}
      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all text-left ${
        selected ? "bg-primary/20 border border-primary/30" : "bg-white/[0.04] border border-white/[0.08] hover:bg-white/[0.08]"
      }`}>
      <div className="w-10 h-10 flex items-center justify-center">
        {src ? (
          <img src={src} alt={gift.name} className="w-10 h-10 object-contain" onError={handleError} />
        ) : (
          <span className="text-2xl">{getGiftEmoji(gift.name)}</span>
        )}
      </div>
      <span className="text-[10px] font-medium truncate w-full text-center text-white/80">{gift.name}</span>
      <span className="flex items-center gap-0.5 text-[11px] font-extrabold bg-gradient-to-r from-yellow-200 via-amber-300 to-orange-400 bg-clip-text text-transparent drop-shadow-[0_0_6px_rgba(250,204,21,0.5)]">
        🪙 {gift.coins.toLocaleString()}
      </span>
    </button>
  );
}

// ── GIFT DATA — diambil live dari StreamToEarn ────────────────

export function ActionsPage() {
  const { actions, addAction, updateAction, deleteAction, duplicateAction, events, addEvent, updateEvent, deleteEvent } = useAppStore();
  const { plan, features } = useLicenseStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [allGifts, setAllGifts] = useState<TikTokGift[]>([]);
  const [loadingGifts, setLoadingGifts] = useState(true);

  // Load gifts from StreamToEarn
  useEffect(() => {
    getGifts().then(gifts => {
      setAllGifts(gifts);
      setLoadingGifts(false);
    });
  }, []);

  // Action Modal
  const [showActionModal, setShowActionModal] = useState(false);
  const [editingAction, setEditingAction] = useState<any>(null);
  const [actionForm, setActionForm] = useState<any>(getDefaultActionForm());

  // Event Modal
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [eventForm, setEventForm] = useState<any>(getDefaultEventForm());
  const [selectedGift, setSelectedGift] = useState<string>("");
  const [giftSearch, setGiftSearch] = useState("");
  const [showGiftPicker, setShowGiftPicker] = useState(false);

  const filteredGifts = allGifts.filter(g => !giftSearch || g.name.toLowerCase().includes(giftSearch.toLowerCase()));

  // Keystroke builder
  const [keystrokeBuffer, setKeystrokeBuffer] = useState<string[]>([]);
  const [pendingModifier, setPendingModifier] = useState("");

  // Helper to get current keystroke string (uses latest state via functional update in saveAction)
  const getKeystrokeString = useCallback(() => keystrokeBuffer.join(" "), [keystrokeBuffer]);

  // Filter
  const filteredActions = actions.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const maxActions = features?.maxActions ?? 5;
  const isUnlimited = maxActions === null || plan === 'pro';
  const canCreate = isUnlimited || actions.length < maxActions;

  // Upgrade dialog state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const navigate = useNavigate();

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewAction, setPreviewAction] = useState<any>(null);

  // ── HELPERS ──────────────────────────────────
  function getDefaultActionForm() {
    return {
      name: "", sound: false, soundFile: null, soundFileName: null,
      soundVolume: 80, soundFadeIn: 0, soundFadeOut: 0, soundLoop: false, soundDelay: 0,
      video: false, videoFile: null, videoFileName: null,
      videoAutoplay: true, videoLoop: false, videoSpeed: 1, videoFadeIn: 0, videoFadeOut: 0,
      image: false, imageFile: null, imageFileName: null,
      imageOpacity: 100, imageScale: 100, imagePosition: { x: 50, y: 50 }, imageAnimation: "none",
      keystroke: false, keystrokeKeys: "", keystrokeHoldMs: 100,
      keystrokeDuration: 5, keystrokeOpacity: 100, keystrokeScale: 100, keystrokeAnimation: "fade",
      minecraft: false, minecraftCommand: "",
      minecraftQueue: false, minecraftCooldown: 0, minecraftDelay: 0, minecraftRandom: false,
      screen: "Screen 1", duration: 20,
      displayDuration: 20, mediaVolume: 80, overlayScreen: "Screen 1",
      globalCooldown: 0, userCooldown: 0,
      fadeInOut: true, repeatCombo: false, skipNext: false,
      enabled: true,
    };
  }

  function getDefaultEventForm() {
    return {
      triggerType: "gift", whoTrigger: "any", actionName: "",
      specificUser: "", giftName: "", minCoins: 1, minLikes: 100,
      keyword: "", enabled: true,
    };
  }

  function openCreateAction() {
    if (!canCreate) {
      setShowUpgradeModal(true);
      return;
    }
    setActionForm(getDefaultActionForm());
    setKeystrokeBuffer([]);
    setPendingModifier("");
    setEditingAction(null);
    setShowActionModal(true);
  }

  function openEditAction(action: any) {
    setActionForm({ ...action });
    setKeystrokeBuffer(action.keystrokeKeys?.split(/\s+/).filter(Boolean) || []);
    setPendingModifier("");
    setEditingAction(action);
    setShowActionModal(true);
  }

  function saveAction(e: React.FormEvent) {
    e.preventDefault();
    const hasMedia = actionForm.sound || actionForm.video || actionForm.image || actionForm.keystroke || actionForm.minecraft;
    if (!hasMedia) { toast("Select at least one media type: Sound, Video, Image, Keystroke, or Minecraft"); return; }
    if (!actionForm.name.trim()) { toast("Enter an action name"); return; }

    // keystrokeBuffer is already in sync with actionForm.keystrokeKeys via handleKeystrokeInputChange
    const ksStr = keystrokeBuffer.join(" ");
    const payload = { ...actionForm, keystrokeKeys: ksStr };

    if (editingAction) {
      updateAction(editingAction.id, payload);
      // Persist media to Dexie (stripped by Zustand partialize)
      persistActionMedia(editingAction.id, payload);
    } else {
      if (!canCreate) { setShowUpgradeModal(true); return; }
      addAction(payload as any);
      // Persist media to Dexie — get the new ID from the latest action
      const latest = useAppStore.getState().actions.slice(-1)[0];
      if (latest) persistActionMedia(latest.id, payload);
    }
    setShowActionModal(false);
  }

  // Persist action media files to Dexie IndexedDB
  async function persistActionMedia(actionId: string, payload: any) {
    try {
      await deleteActionMedia(actionId);
      if (payload.sound && payload.soundFile) {
        await saveActionMedia(actionId + "_sound", actionId, "sound", payload.soundFile, payload.soundFileName || "");
      }
      if (payload.video && payload.videoFile) {
        await saveActionMedia(actionId + "_video", actionId, "video", payload.videoFile, payload.videoFileName || "");
      }
      if (payload.image && payload.imageFile) {
        await saveActionMedia(actionId + "_image", actionId, "image", payload.imageFile, payload.imageFileName || "");
      }
    } catch (_) {}
  }

  // ── EVENT HANDLERS ────────────────────────────
  function openCreateEvent() {
    setEventForm(getDefaultEventForm());
    setSelectedGift("");
    setGiftSearch("");
    setEditingEvent(null);
    setShowEventModal(true);
  }

  function openEditEvent(ev: any) {
    setEventForm({ ...ev });
    setSelectedGift(ev.giftName || "");
    setEditingEvent(ev);
    setShowEventModal(true);
  }

  function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (!eventForm.actionName) { toast("Select an action to trigger"); return; }
      const payload = { ...eventForm };
      if (editingEvent) {
        updateEvent(editingEvent.id, payload);
      } else {
        addEvent(payload as any);
      }
    } catch (err) {
      console.error("[Event] Save error:", err);
    }
    setShowEventModal(false);
    setSelectedGift("");
    setGiftSearch("");
  }

  // ── KEYSTROKE BUILDER ─────────────────────────
  function addSpecialKey(key: string) {
    setKeystrokeBuffer(prev => {
      const newBuffer = [...prev];
      if (pendingModifier) {
        newBuffer.push(pendingModifier + "+" + key);
        // We need to clear pendingModifier - do it after state update via setTimeout
        setTimeout(() => setPendingModifier(""), 0);
      } else {
        newBuffer.push(key);
      }
      return newBuffer;
    });
  }

  function clickModifier(mod: string) {
    setPendingModifier(prev => prev === mod ? "" : mod);
  }

  function removeKeystrokeKey(index: number) {
    setKeystrokeBuffer(prev => {
      const newBuffer = [...prev];
      newBuffer.splice(index, 1);
      return newBuffer;
    });
  }

  function handleKeystrokeInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const value = e.target.value;
    setActionForm((prev: any) => ({ ...prev, keystrokeKeys: value }));
    setKeystrokeBuffer(value.split(/\s+/).filter(Boolean));
  }

  // ── TEST ACTION ──────────────────────────────────────────
  function testAction(action: any) {
    const catalog = getGiftsSync();
    // Pick a real gift from the catalog - prefer one with an image URL
    const giftsWithImages = catalog?.filter(g => getGiftImageUrl(g)) || [];
    const entry = giftsWithImages.length > 0
      ? giftsWithImages[0]  // First gift with a valid image
      : catalog?.[0];       // Fallback to first gift

    if (!entry) {
      console.error('[COIN-JAR-TEST] No catalog entries available');
      toast('Gift catalog not loaded yet');
      return;
    }

    const resolvedImageUrl = getGiftImageUrl(entry);
    const resolvedGiftId = entry?.giftId || 'test-gift';

    console.log('[COIN-JAR-IMAGE-SOURCE] ACTION_TEST_EVENT', JSON.stringify({
      giftId: resolvedGiftId,
      giftName: entry.name,
      diamondCount: entry.coins,
      repeatCount: 2,
      giftImageUrl: resolvedImageUrl || '(empty)',
      imageSource: resolvedImageUrl ? 'catalog' : 'empty',
    }));

    const testEventData = {
      type: "test",
      user: "test_user",
      nickname: "test_user",
      screenId: action.overlayScreen || "Screen 1",
      giftName: entry.name,
      giftId: entry?.giftId || 'test-gift',
      diamondCount: entry.coins,
      repeatCount: 2,
      giftImageUrl: resolvedImageUrl || undefined,
      timestamp: Date.now(),
    };

    // Use the same executeAction path as TikTok events
    // This ensures Repeat Combo queue is respected
    executeAction(action, testEventData);

    // Show test notification (NOT during live TikTok events)
    const effects: string[] = [];
    if (action.sound) effects.push("Sound");
    if (action.video) effects.push("Video");
    if (action.image) effects.push("Image");
    if (action.keystroke) effects.push("Keystroke");
    if (action.minecraft) effects.push("Minecraft");

    showTestNotification({
      actionName: action.name,
      screen: action.overlayScreen || "Screen 1",
      duration: action.displayDuration || action.duration || 5,
      effects,
    });
  }

  // ── GET TRIGGER TEXT ──────────────────────────
  function getTriggerText(ev: any) {
    const t = TRIGGER_TYPES.find(t => t.value === ev.triggerType);
    let text = t?.label || ev.triggerType;
    if (ev.triggerType === "specificgift" && ev.giftName) text += `: ${ev.giftName}`;
    else if (ev.triggerType === "giftcoins" && ev.minCoins) text += ` ≥ ${ev.minCoins} coins`;
    else if (ev.triggerType === "like" && ev.minLikes) text += ` ≥ ${ev.minLikes}`;
    else if (ev.triggerType === "command" && ev.keyword) text += `: /${ev.keyword}`;
    return text;
  }

  return (
    <div className="p-6 h-full overflow-y-auto">

      {/* ══ UPGRADE DIALOG ════════════════════════ */}
      <UpgradeDialog
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason="action_limit"
        currentUsage={actions.length}
        limit={maxActions}
      />

      {/* ── HEADER ─────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white">Actions</h1>
            <p className="text-xs text-white/40">Create actions triggered by TikTok Live events.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40">
                {actions.length} / {isUnlimited ? "∞" : maxActions} actions
              </span>
            <Button onClick={openCreateAction} disabled={!canCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Create New Action
            </Button>
          </div>
        </div>
      </motion.div>

      {/* ══ ACTIONS SECTION ══════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl border border-white/[0.06] bg-card overflow-hidden mb-6">
        <div className="p-4 border-b border-white/[0.06] flex items-center">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary-light" /> Actions
          </h2>
          <div className="relative flex-1 max-w-xs ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input type="text" placeholder="Search actions..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-9 pl-10 pr-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/40" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider w-40">Actions</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider min-w-[140px]">Action Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider w-16">Screen</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider w-12">Dur.</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider w-32">Sound</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider w-32">Video</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider w-32">Image</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider w-36">Keystroke</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider w-36">Minecraft</th>
              </tr>
            </thead>
            <tbody>
              {filteredActions.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-white/30">
                  {actions.length === 0 ? "No Actions Defined" : "No actions match your search."}
                </td></tr>
              ) : (
                filteredActions.map(action => (
                  <motion.tr key={action.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => testAction(action)} className="w-7 h-7 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary-light flex items-center justify-center text-xs transition-all" title="Test"><Play className="w-3.5 h-3.5" /></button>
                        <button onClick={() => openEditAction(action)} className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white flex items-center justify-center text-xs transition-all" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => duplicateAction(action.id)} className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white flex items-center justify-center text-xs transition-all" title="Duplicate"><Copy className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteAction(action.id)} className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-danger/20 text-white/60 hover:text-danger flex items-center justify-center text-xs transition-all" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${action.enabled ? "text-white" : "text-white/40"}`}>
                        {!action.enabled && "[DISABLED] "}{action.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/50">{action.overlayScreen || action.screen || "Screen 1"}</td>
                    <td className="px-4 py-3 text-xs text-white/50">{action.displayDuration || action.duration || 20}s</td>
                    <td className="px-4 py-3 text-xs">
                      {action.sound ? (
                        <span className="flex items-center gap-1.5 text-accent">
                          <Music className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[100px]">{action.soundFileName || "Custom"}</span>
                        </span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {action.video ? (
                        <span className="flex items-center gap-1.5 text-accent">
                          <Video className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[100px]">{action.videoFileName || "Custom"}</span>
                        </span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {action.image ? (
                        <span className="flex items-center gap-1.5 text-accent">
                          <Image className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate max-w-[100px]">{action.imageFileName || "Custom"}</span>
                        </span>
                      ) : <span className="text-white/20">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs">{action.keystroke ? <span className="font-mono text-purple truncate block max-w-[130px]">{action.keystrokeKeys}</span> : <span className="text-white/20">—</span>}</td>
                    <td className="px-4 py-3 text-xs">{action.minecraft ? <span className="text-amber">⛏️ {action.minecraftCommand}</span> : <span className="text-white/20">—</span>}</td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ══ EVENTS SECTION ═══════════════════════ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-2xl border border-white/[0.06] bg-card overflow-hidden">
        <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-secondary-light" /> Events
          </h2>
          <p className="text-xs text-white/40">Link TikTok Live events to actions.</p>
          <Button onClick={openCreateEvent} size="sm" className="gap-2">
            <Plus className="w-4 h-4" /> Create New Event
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Event</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Trigger</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-white/40 uppercase tracking-wider w-28">Action</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-white/40 uppercase tracking-wider w-24">Controls</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-white/30">No Events Defined</td></tr>
              ) : (
                events.map(ev => (
                  <motion.tr key={ev.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Badge variant={ev.enabled ? "outline" : "outline"} className="text-[10px]">{ev.enabled ? "ON" : "OFF"}</Badge>
                        <span className={`font-medium ${ev.enabled ? "text-white" : "text-white/40"}`}>
                          {EVENT_ICONS[ev.triggerType] || "⚡"} {getTriggerText(ev)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-white/50">{ev.whoTrigger && ev.whoTrigger !== "any" ? ev.whoTrigger : "Anyone"}</span>
                      <span className="text-white/20 mx-2">→</span>
                      <span className="text-white/70">{ev.actionName || "-"}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white/60">{ev.actionName || "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEditEvent(ev)} className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white flex items-center justify-center text-xs transition-all" title="Edit"><Edit className="w-3.5 h-3.5" /></button>
                        <button onClick={() => deleteEvent(ev.id)} className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-danger/20 text-white/60 hover:text-danger flex items-center justify-center text-xs transition-all" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ══ OVERLAY SCREENS SECTION ═══════════════ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className="rounded-2xl border border-white/[0.06] bg-card overflow-hidden mt-6">
        <div className="p-4 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Monitor className="w-4 h-4 text-accent" /> Overlay Screen Settings
          </h2>
          <p className="text-xs text-white/40 mt-1 leading-relaxed">
            To make your actions visible in OBS or Live Studio you need to include at least one overlay screen (widget).<br />
            You can map your Actions (animations, alerts, videos, etc.) to different Overlay Screens.<br />
            Here you can copy the Overlay URLs and adjust the maximum queue size of each screen. After adding it, it will be displayed as "Ready".
          </p>
        </div>
        <div className="divide-y divide-white/[0.04]">
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
                  <button onClick={() => { navigator.clipboard.writeText(url); toast("URL copied!", "success"); }}
                    className="shrink-0 px-2 py-1.5 text-[10px] rounded-lg bg-white/[0.04] hover:bg-accent/20 hover:text-accent text-white/50 transition-all font-medium"
                    title="Copy overlay URL">
                    📋 Copy
                  </button>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <input type="number" min={1} max={99} defaultValue={5}
                      className="w-12 h-7 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white outline-none focus:border-primary/40 text-center" />
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
      </motion.div>

      {/* ══ ACTION MODAL ══════════════════════════ */}
      <AnimatePresence>
        {showActionModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowActionModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border border-white/[0.08] rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-20 p-6 border-b border-white/[0.06] bg-card flex items-center justify-between rounded-t-2xl">
                <div>
                  <h2 className="text-lg font-bold text-white">{editingAction ? "Edit Action" : "Create Action"}</h2>
                  <p className="text-xs text-white/40 mt-0.5">Configure your action trigger with media and effects</p>
                </div>
                <button onClick={() => setShowActionModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={saveAction} className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* ── ROW 1: Nama + Screen + Duration ── */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Action Name</label>
                    <input type="text" placeholder="e.g., DOOMSDAY" value={actionForm.name}
                      onChange={e => setActionForm({...actionForm, name: e.target.value})}
                      className="w-full h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/40" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Overlay Screen</label>
                    <select value={actionForm.overlayScreen || "Screen 1"} onChange={e => setActionForm({...actionForm, overlayScreen: e.target.value, screen: e.target.value})}
                      className="w-full h-11 px-4 rounded-xl bg-[#1e1e2a] border border-white/[0.12] text-sm text-white outline-none focus:border-primary/40 transition-all appearance-none cursor-pointer">
                      {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={`Screen ${n}`} className="bg-[#1e1e2a] text-white py-2">{`Screen ${n}`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-white/50 mb-1.5">Display Duration</label>
                    <div className="flex items-center gap-2">
                      <input type="number" min={1} max={300} value={actionForm.displayDuration || actionForm.duration || 20}
                        onChange={e => setActionForm({...actionForm, displayDuration: Number(e.target.value), duration: Number(e.target.value)})}
                        className="flex-1 h-11 px-4 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
                      <span className="text-xs text-white/40 w-8">sec</span>
                    </div>
                  </div>
                </div>

                {/* ── MEDIA TOGGLES ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <MediaToggle
                    icon={Music}
                    label="Sound"
                    color="text-green"
                    formKey="sound"
                    form={actionForm}
                    setForm={setActionForm}
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-white/50 mb-1.5">Audio File (MP3, WAV, OGG)</label>
                        <input
                          type="file"
                          accept="audio/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => setActionForm({...actionForm, soundFile: reader.result as string, soundFileName: file.name});
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="w-full text-xs text-white/40 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                        />
                        {actionForm.soundFileName && <p className="text-xs text-white/40 mt-1">{actionForm.soundFileName}</p>}
                      </div>
                      <div>
                        <label className="block text-xs text-white/50 mb-1.5">Volume: {actionForm.soundVolume ?? actionForm.mediaVolume ?? 80}%</label>
                        <input type="range" min="0" max="100" value={actionForm.soundVolume ?? actionForm.mediaVolume ?? 80}
                          onChange={(e) => setActionForm({...actionForm, soundVolume: Number(e.target.value), mediaVolume: Number(e.target.value)})}
                          className="w-full h-2 accent-green" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Fade In: {actionForm.soundFadeIn || 0}s</label>
                          <input type="range" min="0" max="10" step="0.5" value={actionForm.soundFadeIn || 0}
                            onChange={(e) => setActionForm({...actionForm, soundFadeIn: Number(e.target.value)})}
                            className="w-full h-2 accent-green" />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Fade Out: {actionForm.soundFadeOut || 0}s</label>
                          <input type="range" min="0" max="10" step="0.5" value={actionForm.soundFadeOut || 0}
                            onChange={(e) => setActionForm({...actionForm, soundFadeOut: Number(e.target.value)})}
                            className="w-full h-2 accent-green" />
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={actionForm.soundLoop || false}
                            onChange={(e) => setActionForm({...actionForm, soundLoop: e.target.checked})}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.04] accent-green" />
                          <span className="text-[10px] text-white/50">Loop</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-white/50">Delay:</span>
                          <input type="number" min="0" max="30" value={actionForm.soundDelay || 0}
                            onChange={(e) => setActionForm({...actionForm, soundDelay: Number(e.target.value)})}
                            className="w-14 h-6 px-1.5 rounded bg-white/[0.04] border border-white/[0.08] text-[10px] text-white outline-none text-center" />
                          <span className="text-[10px] text-white/30">s</span>
                        </div>
                      </div>
                    </div>
                  </MediaToggle>

                  <MediaToggle
                    icon={Video}
                    label="Video"
                    color="text-blue"
                    formKey="video"
                    form={actionForm}
                    setForm={setActionForm}
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-white/50 mb-1.5">Video File (MP4, WebM)</label>
                        <input
                          type="file"
                          accept="video/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => setActionForm({...actionForm, videoFile: reader.result as string, videoFileName: file.name});
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="w-full text-xs text-white/40 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                        />
                        {actionForm.videoFileName && <p className="text-xs text-white/40 mt-1">{actionForm.videoFileName}</p>}
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={actionForm.videoAutoplay !== false}
                            onChange={(e) => setActionForm({...actionForm, videoAutoplay: e.target.checked})}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.04] accent-blue" />
                          <span className="text-[10px] text-white/50">Autoplay</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={actionForm.videoLoop || false}
                            onChange={(e) => setActionForm({...actionForm, videoLoop: e.target.checked})}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.04] accent-blue" />
                          <span className="text-[10px] text-white/50">Loop</span>
                        </label>
                      </div>
                      <div>
                        <label className="block text-xs text-white/50 mb-1">Speed: {actionForm.videoSpeed || 1}x</label>
                        <input type="range" min="0.25" max="4" step="0.25" value={actionForm.videoSpeed || 1}
                          onChange={(e) => setActionForm({...actionForm, videoSpeed: Number(e.target.value)})}
                          className="w-full h-2 accent-blue" />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Fade In: {actionForm.videoFadeIn || 0}s</label>
                          <input type="range" min="0" max="10" step="0.5" value={actionForm.videoFadeIn || 0}
                            onChange={(e) => setActionForm({...actionForm, videoFadeIn: Number(e.target.value)})}
                            className="w-full h-2 accent-blue" />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Fade Out: {actionForm.videoFadeOut || 0}s</label>
                          <input type="range" min="0" max="10" step="0.5" value={actionForm.videoFadeOut || 0}
                            onChange={(e) => setActionForm({...actionForm, videoFadeOut: Number(e.target.value)})}
                            className="w-full h-2 accent-blue" />
                        </div>
                      </div>
                    </div>
                  </MediaToggle>

                  <MediaToggle
                    icon={Image}
                    label="Image"
                    color="text-purple"
                    formKey="image"
                    form={actionForm}
                    setForm={setActionForm}
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-white/50 mb-1.5">Image File (PNG, JPG, GIF, WebP)</label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = () => setActionForm({...actionForm, imageFile: reader.result as string, imageFileName: file.name});
                              reader.readAsDataURL(file);
                            }
                          }}
                          className="w-full text-xs text-white/40 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:bg-primary/20 file:text-primary hover:file:bg-primary/30"
                        />
                        {actionForm.imageFileName && <p className="text-xs text-white/40 mt-1">{actionForm.imageFileName}</p>}
                      </div>
                      <div>
                        <label className="block text-xs text-white/50 mb-1">Opacity: {actionForm.imageOpacity ?? 100}%</label>
                        <input type="range" min="0" max="100" value={actionForm.imageOpacity ?? 100}
                          onChange={(e) => setActionForm({...actionForm, imageOpacity: Number(e.target.value)})}
                          className="w-full h-2 accent-purple" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/50 mb-1">Scale: {actionForm.imageScale ?? 100}%</label>
                        <input type="range" min="10" max="300" value={actionForm.imageScale ?? 100}
                          onChange={(e) => setActionForm({...actionForm, imageScale: Number(e.target.value)})}
                          className="w-full h-2 accent-purple" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/50 mb-1.5">Animation</label>
                        <select value={actionForm.imageAnimation || "none"}
                          onChange={(e) => setActionForm({...actionForm, imageAnimation: e.target.value})}
                          className="w-full h-8 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white outline-none">
                          <option value="none">None</option>
                          <option value="fade">Fade In</option>
                          <option value="slide-up">Slide Up</option>
                          <option value="slide-down">Slide Down</option>
                          <option value="slide-left">Slide Left</option>
                          <option value="slide-right">Slide Right</option>
                          <option value="zoom">Zoom In</option>
                          <option value="bounce">Bounce</option>
                          <option value="pulse">Pulse</option>
                        </select>
                      </div>
                    </div>
                  </MediaToggle>

                  <MediaToggle
                    icon={Keyboard}
                    label="Keystroke"
                    color="text-amber"
                    formKey="keystroke"
                    form={actionForm}
                    setForm={setActionForm}
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-white/50 mb-1.5">Keys Sequence</label>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {SPECIAL_KEYS.map(k => (
                            <button type="button" key={k} onClick={() => addSpecialKey(k)}
                              className="px-2 py-1 text-[10px] rounded bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-primary/20 hover:text-primary-light hover:border-primary/30 transition-all">{k}</button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {MODIFIERS.map(m => (
                            <button type="button" key={m} onClick={() => clickModifier(m)}
                              className={`px-2 py-1 text-[10px] rounded border transition-all ${
                                pendingModifier === m
                                  ? "bg-primary/20 border-primary/30 text-primary-light"
                                  : "bg-white/[0.04] border-white/[0.08] text-white/70 hover:bg-primary/20 hover:border-primary/30"
                              }`}>{m}</button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {keystrokeBuffer.map((k, i) => (
                            <span key={i} className="px-2 py-0.5 text-[10px] rounded bg-primary/20 border border-primary/30 text-primary-light flex items-center gap-1">
                              {k}
                              <button type="button" onClick={() => removeKeystrokeKey(i)} className="hover:text-danger">×</button>
                            </span>
                          ))}
                        </div>
                        <input type="text" placeholder="Or type manually (e.g., Ctrl+Shift+K)"
                          value={actionForm.keystrokeKeys}
                          onChange={handleKeystrokeInputChange}
                          className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/40" />
                        <p className="text-[10px] text-white/30">Hold: {actionForm.keystrokeHoldMs || 100}ms</p>
                        <input type="range" min="50" max="5000" step="50" value={actionForm.keystrokeHoldMs || 100}
                          onChange={(e) => setActionForm({...actionForm, keystrokeHoldMs: Number(e.target.value)})}
                          className="w-full h-2 accent-amber" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/50 mb-1">Duration: {actionForm.keystrokeDuration || 5}s</label>
                        <input type="range" min="1" max="30" value={actionForm.keystrokeDuration || 5}
                          onChange={(e) => setActionForm({...actionForm, keystrokeDuration: Number(e.target.value)})}
                          className="w-full h-2 accent-amber" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/50 mb-1">Overlay Opacity: {actionForm.keystrokeOpacity ?? 100}%</label>
                        <input type="range" min="10" max="100" value={actionForm.keystrokeOpacity ?? 100}
                          onChange={(e) => setActionForm({...actionForm, keystrokeOpacity: Number(e.target.value)})}
                          className="w-full h-2 accent-amber" />
                      </div>
                      <div>
                        <label className="block text-xs text-white/50 mb-1.5">Animation</label>
                        <select value={actionForm.keystrokeAnimation || "fade"}
                          onChange={(e) => setActionForm({...actionForm, keystrokeAnimation: e.target.value})}
                          className="w-full h-8 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white outline-none">
                          <option value="fade">Fade</option>
                          <option value="slide-up">Slide Up</option>
                          <option value="zoom">Zoom</option>
                          <option value="none">None</option>
                        </select>
                      </div>
                    </div>
                  </MediaToggle>

                  <MediaToggle
                    icon={Monitor}
                    label="Minecraft"
                    color="text-green"
                    formKey="minecraft"
                    form={actionForm}
                    setForm={setActionForm}
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-white/50 mb-1.5">Command</label>
                        <input type="text" placeholder="/give @p diamond 64"
                          value={actionForm.minecraftCommand}
                          onChange={(e) => setActionForm({...actionForm, minecraftCommand: e.target.value})}
                          className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/40 font-mono" />
                        <p className="text-[10px] text-white/30 mt-1">{"Use {username} for viewer name"}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={actionForm.minecraftQueue || false}
                            onChange={(e) => setActionForm({...actionForm, minecraftQueue: e.target.checked})}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.04] accent-green" />
                          <span className="text-[10px] text-white/50">Queue</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={actionForm.minecraftRandom || false}
                            onChange={(e) => setActionForm({...actionForm, minecraftRandom: e.target.checked})}
                            className="w-3.5 h-3.5 rounded border-white/20 bg-white/[0.04] accent-green" />
                          <span className="text-[10px] text-white/50">Random</span>
                        </label>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Cooldown: {actionForm.minecraftCooldown || 0}s</label>
                          <input type="number" min="0" max="300" value={actionForm.minecraftCooldown || 0}
                            onChange={(e) => setActionForm({...actionForm, minecraftCooldown: Number(e.target.value)})}
                            className="w-full h-7 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white outline-none" />
                        </div>
                        <div>
                          <label className="block text-xs text-white/50 mb-1">Delay: {actionForm.minecraftDelay || 0}s</label>
                          <input type="number" min="0" max="60" value={actionForm.minecraftDelay || 0}
                            onChange={(e) => setActionForm({...actionForm, minecraftDelay: Number(e.target.value)})}
                            className="w-full h-7 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-white outline-none" />
                        </div>
                      </div>
                    </div>
                  </MediaToggle>
                </div>

                {/* ── ADVANCED SETTINGS ── */}
                <div className="border-t border-white/[0.06] pt-6 space-y-4">
                  <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Advanced Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-xs text-white/50 mb-1.5">Media Volume: {actionForm.mediaVolume || 80}%</label>
                      <input type="range" min="0" max="100" value={actionForm.mediaVolume || 80}
                        onChange={(e) => setActionForm({...actionForm, mediaVolume: Number(e.target.value)})}
                        className="w-full h-2 accent-primary" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-1.5">Global Cooldown: {actionForm.globalCooldown || 0}s</label>
                      <input type="number" min="0" max="3600" value={actionForm.globalCooldown || 0}
                        onChange={(e) => setActionForm({...actionForm, globalCooldown: Number(e.target.value)})}
                        className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
                    </div>
                    <div>
                      <label className="block text-xs text-white/50 mb-1.5">User Cooldown: {actionForm.userCooldown || 0}s</label>
                      <input type="number" min="0" max="3600" value={actionForm.userCooldown || 0}
                        onChange={(e) => setActionForm({...actionForm, userCooldown: Number(e.target.value)})}
                        className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
                    </div>
                    <div className="flex items-end gap-4">
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input type="checkbox" checked={actionForm.fadeInOut !== false}
                          onChange={(e) => setActionForm({...actionForm, fadeInOut: e.target.checked})}
                          className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-primary" />
                        <span className="text-xs text-white/70">Fade In/Out</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input type="checkbox" checked={actionForm.repeatCombo}
                          onChange={(e) => setActionForm({...actionForm, repeatCombo: e.target.checked})}
                          className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-primary" />
                        <span className="text-xs text-white/70">Repeat Combo</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input type="checkbox" checked={actionForm.skipNext}
                          onChange={(e) => setActionForm({...actionForm, skipNext: e.target.checked})}
                          className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-primary" />
                        <span className="text-xs text-white/70">Skip Next</span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* ── SUBMIT ── */}
                <div className="flex justify-end gap-3 pt-4 border-t border-white/[0.06]">
                  <Button variant="ghost" type="button" onClick={() => setShowActionModal(false)}>Cancel</Button>
                  <Button type="submit" className="gap-2">{editingAction ? "Update Action" : "Create Action"}</Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ EVENT MODAL ═══════════════════════════ */}
      <AnimatePresence>
        {showEventModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowEventModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border border-white/[0.08] rounded-2xl w-full max-w-xl max-h-[95vh] flex flex-col shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="sticky top-0 z-20 p-5 border-b border-white/[0.06] bg-card flex items-center justify-between rounded-t-2xl shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-white">{editingEvent ? "Edit Event" : "Create Event"}</h2>
                  <p className="text-xs text-white/40 mt-0.5">Link a TikTok Live event to an action</p>
                </div>
                <button onClick={() => setShowEventModal(false)} className="w-8 h-8 rounded-xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/[0.06]">
                  <X className="w-4 h-4" />
                </button>
              </div>

                      <form onSubmit={saveEvent} className="flex-1 overflow-y-auto p-5 space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-2">Who can trigger?</label>
                            <select value={eventForm.whoTrigger} onChange={e => setEventForm({...eventForm, whoTrigger: e.target.value})}
                              className="w-full h-11 px-4 rounded-xl bg-[#1e1e2a] border border-white/[0.12] text-sm text-white outline-none focus:border-primary/40 transition-all appearance-none cursor-pointer">
                              {WHO_TRIGGERS.map(w => <option key={w.value} value={w.value} className="bg-[#1e1e2a] text-white py-2">{w.label}</option>)}
                            </select>
                            {eventForm.whoTrigger === "specificuser" && (
                              <input type="text" placeholder="Enter TikTok username" value={eventForm.specificUser}
                                onChange={e => setEventForm({...eventForm, specificUser: e.target.value})}
                                className="w-full h-10 px-3 mt-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/40" />
                            )}
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-2">By what will trigger?</label>
                            <select value={eventForm.triggerType} onChange={e => setEventForm({...eventForm, triggerType: e.target.value})}
                              className="w-full h-11 px-4 rounded-xl bg-[#1e1e2a] border border-white/[0.12] text-sm text-white outline-none focus:border-primary/40 transition-all appearance-none cursor-pointer">
                              {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value} className="bg-[#1e1e2a] text-white py-2">{EVENT_ICONS[t.value] || "⚡"} {t.label}</option>)}
                            </select>
                          </div>
                        </div>

                        {/* ── Dynamic Fields ── */}
                        {eventForm.triggerType === "specificgift" && (
                          <div>
                            <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-2">🎁 Pilih Gift</label>
                            <div className="relative">
                              <button type="button" onClick={() => setShowGiftPicker(!showGiftPicker)}
                                className="w-full h-10 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-left text-white placeholder:text-white/20 flex items-center justify-between outline-none focus:border-primary/40">
                                <span>{selectedGift ? `${getGiftEmoji(selectedGift)} ${selectedGift}` : "Click to select gift"}</span>
                                <span className="text-xs text-white/40">{showGiftPicker ? "▲" : "▼"}</span>
                              </button>
                              <AnimatePresence>
                                {showGiftPicker && (
                                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                                    className="absolute z-50 top-full left-0 right-0 mt-1 max-h-80 overflow-y-auto bg-[#1a1a24] border border-white/[0.08] rounded-xl shadow-2xl">
                                    <div className="p-2 border-b border-white/[0.06] sticky top-0 bg-[#1a1a24] z-10">
                                      <input type="text" placeholder="Cari gift..." value={giftSearch}
                                        onChange={e => setGiftSearch(e.target.value)}
                                        className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none" />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 p-2">
                                      {loadingGifts ? (
                                        <div className="col-span-3 text-center text-white/30 py-6 text-sm">⏳ Memuat daftar gift...</div>
                                      ) : filteredGifts.length === 0 ? (
                                        <div className="col-span-3 text-center text-white/30 py-6 text-sm">🔍 Tidak ada gift ditemukan</div>
                                      ) : (
                                        filteredGifts.sort((a, b) => a.coins - b.coins || a.name.localeCompare(b.name)).map(g => (
                                          <GiftCard key={g.name} gift={g} selected={selectedGift === g.name}
                                            onSelect={() => { setSelectedGift(g.name); setEventForm({...eventForm, giftName: g.name}); setShowGiftPicker(false); }} />
                                        ))
                                      )}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                            <p className="text-[10px] text-white/30 mt-1">🎁 {allGifts.length} gift tersedia · 🔄 Otomatis diperbarui dari StreamToEarn</p>
                          </div>
                        )}
                        {(eventForm.triggerType === "gift" || eventForm.triggerType === "giftcoins") && (
                          <div>
                            <label className="text-xs text-white/50 block mb-1">💰 Min. coins</label>
                            <input type="number" min={1} value={eventForm.minCoins} onChange={e => setEventForm({...eventForm, minCoins: Number(e.target.value)})}
                              className="w-24 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
                          </div>
                        )}
                        {eventForm.triggerType === "like" && (
                          <div>
                            <label className="text-xs text-white/50 block mb-1">❤️ Min likes</label>
                            <input type="number" min={1} value={eventForm.minLikes} onChange={e => setEventForm({...eventForm, minLikes: Number(e.target.value)})}
                              className="w-24 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40" />
                          </div>
                        )}
                        {(eventForm.triggerType === "command" || eventForm.triggerType === "comment") && (
                          <div>
                            <label className="text-xs text-white/50 block mb-1">💬 Keyword</label>
                            <input type="text" placeholder="Keyword filter (optional)" value={eventForm.keyword}
                              onChange={e => setEventForm({...eventForm, keyword: e.target.value})}
                              className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/40" />
                          </div>
                        )}

                        {/* Action Select */}
                        <div>
                          <label className="text-sm font-semibold text-white block mb-2">⚡ Trigger this action:</label>
                          <select value={eventForm.actionName} onChange={e => setEventForm({...eventForm, actionName: e.target.value})}
                            className="w-full h-11 px-4 rounded-xl bg-[#1e1e2a] border border-white/[0.12] text-sm text-white outline-none focus:border-primary/40 transition-all appearance-none cursor-pointer" required>
                            <option value="" className="bg-[#1e1e2a] text-white/50 py-2">-- Select Action --</option>
                            {actions.map(a => <option key={a.id} value={a.name} className="bg-[#1e1e2a] text-white py-2">{!a.enabled ? "[DISABLED] " : ""}{a.name}</option>)}
                          </select>
                        </div>

                        {/* Enabled */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={eventForm.enabled} onChange={e => setEventForm({...eventForm, enabled: e.target.checked})}
                              className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-primary" />
                            <span className="text-sm text-white/80">✅ Enabled</span>
                          </label>
                          <div className="flex gap-3">
                            <Button variant="ghost" type="button" onClick={() => setShowEventModal(false)}>Cancel</Button>
                            <Button type="submit">{editingEvent ? "Update Event" : "Save Event"}</Button>
                          </div>
                        </div>
                      </form>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
        );
}

export default ActionsPage;
