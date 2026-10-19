import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../store/app-store";
import { useLicenseStore } from "../store/license-store";
import { OBSSceneSelector } from "./components/OBSSceneSelector";
import { cn } from "../lib/utils";
import { UpgradeDialog } from "../components/UpgradeDialog";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { showPendingKeystroke, updatePendingKeystroke, hidePendingKeystroke } from "../components/TestNotification";
import { toast } from "../components/Toast";
import { getGifts, getGiftsSync, getGiftEmoji, getGiftImageUrl, type TikTokGift } from "../services/gift-service";
import { sendToOverlay } from "../lib/overlay-bus";
import { db, saveActionMedia, deleteActionMedia, getAllSounds } from "../lib/db";
import { getOverlayWidgetUrl } from "../lib/browser-source-url";
import { normalizeScreenWithTrace as normalizeScreen } from "../lib/screen-normalizer";
import { executeAction, executeDeferredTestKeystroke, dispatchTikTokEvent } from "../store/event-dispatch";
import { runManualTestAction } from "../lib/manual-action-test";
import { dispatchTestActionCombo, dispatchTestGiftCombo } from "../lib/test-gift-combo";
import { pendingKeystrokeController } from "../lib/pending-keystroke";
import {
  exportActionPackFromActions,
  importActionPackWithDexie,
  persistImportedMediaRows,
  isActionPack,
} from "../lib/action-pack-io";
import {
  Plus, Search, Play, Edit, Trash2, X, Copy, CheckCircle2,
  Music, Video, Image, Keyboard, Monitor, Gift, Heart, Bell,
  MessageSquare, Share2, UserPlus, Star, Zap, Globe,
  AlertTriangle, Volume2, VolumeX, Lock, ArrowRight, Sparkles, Library,
  Download, Upload,
} from "lucide-react";
import { getBuiltInSoundCatalog, getBuiltInSoundDataUrl, type BuiltInSound } from "../lib/builtin-sounds";
import { MyInstantsBrowse } from "../components/MyInstantsBrowse";

// ── SPECIAL KEYS & MODIFIERS (sama persis kaya Electron) ──────
import {
  SPECIAL_KEYS as SPECIAL_KEY_DEFS,
  NUMPAD_KEY_DEFS,
  MODIFIER_KEY_IDS,
  formatKeystrokeTokenForDisplay,
  normalizeKeystrokeToken,
  parseKeystrokeKeys,
} from "../lib/keystroke-keys";
import { composeKeystroke } from "../lib/keystroke-composer";

const SPECIAL_KEYS = SPECIAL_KEY_DEFS.map((k) => k.id);
const NUMPAD_KEYS = NUMPAD_KEY_DEFS;
const MODIFIERS = [...MODIFIER_KEY_IDS];

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

// ── SOUND LIBRARY CATEGORIES ────────────────────
const SOUND_LIBRARY_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'memes', label: 'Memes' },
  { id: 'gaming', label: 'Gaming' },
  { id: 'reactions', label: 'Reactions' },
  { id: 'effects', label: 'Effects' },
  { id: 'notifications', label: 'Notifications' },
] as const;

// ── SOUND LIBRARY MODAL ──────────────────────────
export type SoundLibraryCustomSound = {
  id: string;
  name: string;
  file?: string | null;
  fileName?: string;
  profileId?: string;
  category?: string;
  tags?: string[];
  isBuiltIn?: boolean;
};

/**
 * Merge Zustand custom sounds with Dexie rows for the Action Editor picker.
 * When store has a sound id without `file` and Dexie has the same id with a
 * valid dataURL, fill only the missing binary/file from Dexie (preserve store
 * metadata). Do not create duplicate ids.
 */
export function mergeCustomSoundsWithDb(
  storeCustoms: SoundLibraryCustomSound[],
  dbSounds: SoundLibraryCustomSound[],
): SoundLibraryCustomSound[] {
  const merged: SoundLibraryCustomSound[] = storeCustoms.map((s) => ({ ...s }));
  for (const ds of dbSounds) {
    const existing = merged.find((s) => s.id === ds.id);
    if (existing) {
      if (!existing.file && ds.file) {
        // Preserve store metadata; only backfill missing binary from Dexie
        existing.file = ds.file;
        if (!existing.fileName && ds.fileName) existing.fileName = ds.fileName;
      }
      continue;
    }
    // addSound generates a new id; avoid duplicate picker rows for the same name
    const byName = merged.find(
      (s) => s.name?.trim().toLowerCase() === ds.name?.trim().toLowerCase()
    );
    if (byName) {
      if (!byName.file && ds.file) {
        byName.file = ds.file;
        if (!byName.fileName && ds.fileName) byName.fileName = ds.fileName;
      }
      continue;
    }
    merged.push({ ...ds });
  }
  return merged;
}

type HydrateSoundStore = {
  customSounds: SoundLibraryCustomSound[];
  addSound: (sound: Record<string, unknown>) => void;
  updateSound: (id: string, updates: Record<string, unknown>) => void;
};

/**
 * Hydrate Zustand CustomSounds from Dexie for the Action picker.
 * Same rules as SoundsPage mount: backfill missing file; add if absent;
 * never create duplicate ids; respect profileId.
 */
export async function hydrateCustomSoundsFromDexie(
  profileId: string,
  getStore: () => HydrateSoundStore,
  getSoundsByProfile: (profileId: string) => Promise<SoundLibraryCustomSound[]>,
): Promise<SoundLibraryCustomSound[]> {
  const fromDb = await getSoundsByProfile(profileId);
  for (const dbSound of fromDb) {
    // Re-read live store each iteration so add/update mutations are visible
    const store = getStore();
    const existing = store.customSounds.find((s) => s.id === dbSound.id);
    if (existing && !existing.file && dbSound.file) {
      store.updateSound(dbSound.id, {
        file: dbSound.file,
        fileName: dbSound.fileName ?? existing.fileName,
      });
    } else if (!existing) {
      store.addSound({
        name: dbSound.name,
        file: dbSound.file,
        fileName: dbSound.fileName,
        enabled: true,
        profileId: dbSound.profileId || profileId,
      });
    }
  }
  return fromDb;
}

function SoundLibraryModal({ open, onClose, onSelect }: { open: boolean; onClose: () => void; onSelect: (file: string, name: string) => void }) {
  const { customSounds, currentProfileId, getCurrentProfileCustomSounds } = useAppStore();
  const [dbSounds, setDbSounds] = useState<SoundLibraryCustomSound[]>([]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useState<{ current: HTMLAudioElement | null }>({ current: null })[0];
  const builtInUrlsRef = useRef<Map<string, string>>(new Map());
  const [activeTab, setActiveTab] = useState<'library' | 'myinstants'>('library');

  const profileCustomSounds = getCurrentProfileCustomSounds();

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      if (!currentProfileId) return;
      try {
        const { getSoundsByProfile } = await import('../lib/db');
        // Hydrate Zustand from Dexie first (same path as SoundsPage mount)
        // so the picker filter (isBuiltIn || file) sees CustomSounds with dataURL.
        const fromDb = await hydrateCustomSoundsFromDexie(
          currentProfileId,
          () => useAppStore.getState() as unknown as HydrateSoundStore,
          getSoundsByProfile,
        );
        setDbSounds(fromDb);
      } catch { setDbSounds([]); }
    };
    load();
    setSearch('');
    setActiveCategory('all');
    setActiveTab('library');
    setPlayingId(null);
    // Pre-cache all built-in sounds for synchronous lookup (ref, not state — avoids stale closure)
    builtInUrlsRef.current = new Map();
    const catalog = getBuiltInSoundCatalog();
    for (const s of catalog) {
      getBuiltInSoundDataUrl(s.id).then((url) => {
        if (url) builtInUrlsRef.current.set(s.id, url);
      });
    }
    // Native DOM mousedown listener as fallback for programmatic clicks
    // CDP Input.dispatchMouseEvent fires mousedown/mouseup but NOT click inside Framer Motion
    const nativeHandler = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      // Check if click target is the Use Sound button or inside it
      const btn = target.closest('button');
      if (!btn || btn.textContent.trim() !== 'Use Sound') return;
      // Find the matching sound
      const item = btn.closest('[class*="rounded-xl"]');
      if (!item) return;
      const nameEl = item.querySelector('p');
      const name = nameEl ? nameEl.textContent.trim() : '';
      if (!name) return;
      const match = mergedSounds.find((s) => s.name === name);
      if (match) {
        const file = match.file || builtInUrlsRef.current.get(match.id) || null;
        if (!file) return;
        e.preventDefault();
        e.stopPropagation();
        audioRef.current?.pause();
        audioRef.current = null;
        setPlayingId(null);
        onSelect(file, match.name);
        onClose();
      }
    };
    document.addEventListener('mousedown', nativeHandler, true);
    return () => {
      document.removeEventListener('mousedown', nativeHandler, true);
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, [open, currentProfileId]);

  // Merge: built-in sounds first, then custom sounds with Dexie file backfill
  const mergedSounds = useMemo(() => {
    const catalog = getBuiltInSoundCatalog();
    const builtIn = catalog.map((s) => ({
      ...s,
      file: null as string | null,
      fileName: 'Built-in sound',
      isBuiltIn: true,
    }));
    const user = mergeCustomSoundsWithDb(profileCustomSounds as SoundLibraryCustomSound[], dbSounds as SoundLibraryCustomSound[]);
    return [...builtIn, ...user];
  }, [profileCustomSounds, dbSounds]);

  // Show built-in sounds always (even without file), plus user sounds with files
  const soundsWithFiles = useMemo(
    () => mergedSounds.filter((s) => s.isBuiltIn || s.file),
    [mergedSounds],
  );

  // Search and category filter
  const filtered = useMemo(() => {
    return soundsWithFiles.filter((s) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(q) ||
        (s.category && s.category.toLowerCase().includes(q)) ||
        (s.tags && s.tags.some((t: string) => t.toLowerCase().includes(q)));
      const matchesCategory = activeCategory === 'all' || s.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [soundsWithFiles, search, activeCategory]);

  // Resolve a sound's dataURL (built-in sounds generate on demand)
  const resolveFile = async (sound: { id: string; file?: string | null; isBuiltIn?: boolean }): Promise<string | null> => {
    if (sound.file) return sound.file;
    if (sound.isBuiltIn) return getBuiltInSoundDataUrl(sound.id);
    return null;
  };

  const previewSound = async (sound: { id: string; file?: string | null; isBuiltIn?: boolean }) => {
    if (playingId === sound.id) {
      audioRef.current?.pause();
      audioRef.current = null;
      setPlayingId(null);
      return;
    }
    const file = await resolveFile(sound);
    if (!file) return;
    audioRef.current?.pause();
    const audio = new Audio(file);
    audio.volume = 0.6;
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(sound.id);
    audio.play().catch(() => setPlayingId(null));
  };

  const handleSelect = (sound: { id: string; name: string; file?: string | null; isBuiltIn?: boolean }) => {
    // Resolve synchronously: check user file first, then pre-cached built-in (ref, always fresh)
    const file = sound.file || builtInUrlsRef.current.get(sound.id) || null;
    if (!file) return;
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
    onSelect(file, sound.name);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.2 }}
          className="bg-card border border-white/[0.08] rounded-2xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-2">
              <Library className="w-5 h-5 text-primary" />
              <h3 className="text-base font-semibold text-white">Sound Library</h3>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.06] text-white/50 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 px-5 py-2 border-b border-white/[0.06]">
            <button
              onClick={() => setActiveTab('library')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'library'
                  ? 'bg-primary/20 text-primary'
                  : 'text-white/50 hover:text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              Your Library
            </button>
            <button
              onClick={() => setActiveTab('myinstants')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'myinstants'
                  ? 'bg-primary/20 text-primary'
                  : 'text-white/50 hover:text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              MyInstants
            </button>
          </div>
          {/* Library Tab Content */}
          {activeTab === 'library' && (
            <>
              {/* Search */}
              <div className="px-5 py-3 border-b border-white/[0.06]">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search sounds..."
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/30 outline-none focus:border-primary/50" />
                </div>
              </div>
              {/* Categories */}
              <div className="px-5 py-2.5 border-b border-white/[0.06] flex gap-1.5 overflow-x-auto">
                {SOUND_LIBRARY_CATEGORIES.map((cat) => (
                  <button key={cat.id} onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      activeCategory === cat.id
                        ? 'bg-primary/20 text-primary'
                        : 'bg-white/[0.04] text-white/50 hover:bg-white/[0.08] hover:text-white/70'
                    }`}>
                    {cat.label}
                  </button>
                ))}
              </div>
              {/* Sound list */}
              <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5">
                {filtered.length === 0 && (
                  <div className="text-center py-10">
                    <Music className="w-10 h-10 text-white/15 mx-auto mb-3" />
                    <p className="text-sm text-white/40 mb-1">
                      {soundsWithFiles.length === 0
                        ? 'No sounds in your library yet'
                        : 'No sounds match your search'}
                    </p>
                    <p className="text-xs text-white/25">
                      {soundsWithFiles.length === 0
                        ? 'Built-in sounds are loading — try again in a moment'
                        : 'Try a different search term'}
                    </p>
                  </div>
                )}
                {filtered.map((sound) => (
                  <div key={sound.id}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.12] hover:bg-white/[0.05] transition-all group">
                    <button onClick={() => previewSound(sound)}
                      className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-primary/20 text-white/50 hover:text-primary transition-colors flex-shrink-0">
                      {playingId === sound.id ? <VolumeX className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{sound.name}</p>
                      <p className="text-[10px] text-white/30">
                        {sound.isBuiltIn ? sound.category : (sound.fileName || 'Custom sound')}
                      </p>
                    </div>
                    <button onPointerDown={() => handleSelect(sound)}
                      className="px-3 py-1.5 rounded-lg bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors flex-shrink-0 cursor-pointer">
                      Use Sound
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {/* MyInstants Tab Content */}
          {activeTab === 'myinstants' && (
            <div className="flex-1 overflow-y-auto px-5 py-3">
              <MyInstantsBrowse masterVolume={60} />
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── MEDIA TOGGLE SUB-COMPONENT ─────────────────
// NOTE: no overflow-hidden on the card. Runtime audit showed that clipping
// the absolutely-positioned DarkListSelect popup made wheel events miss the
// listbox (target = this card's label) and hit the form scroll container instead.
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

// ── SPOTIFY TRACK SELECTOR ──────────────────────
function SpotifyTrackSelector({ value, trackName, onChange }: { value: string; trackName: string; onChange: (uri: string, name: string) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<{ uri: string; name: string; artist: string; albumArt?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [spotifyAuthed, setSpotifyAuthed] = useState(true);

  useEffect(() => {
    const a = (window as any).electronAPI;
    if (a?.spotifyStatus) {
      a.spotifyStatus().then((s: any) => setSpotifyAuthed(s?.authenticated ?? false)).catch(() => setSpotifyAuthed(false));
    }
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    const a = (window as any).electronAPI;
    if (!a?.spotifySearch) return;
    setLoading(true);
    try {
      const result = await a.spotifySearch({ query: query.trim(), limit: 8 });
      setResults((result?.tracks ?? []).map((t: any) => ({
        uri: t.uri,
        name: t.name,
        artist: t.artists?.map((a: any) => a.name).join(", ") || "",
        albumArt: t.album?.images?.[0]?.url,
      })));
    } catch { setResults([]); }
    setLoading(false);
  };

  if (!spotifyAuthed) {
    return <div className="text-[10px] text-yellow-400/70 py-1">Spotify not authenticated. Connect in Settings first.</div>;
  }

  return (
    <div className="space-y-2">
      {trackName && value ? (
        <div className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.04] border border-white/[0.08]">
          <Music className="w-4 h-4 text-green-400 shrink-0" />
          <span className="text-xs text-white/80 truncate flex-1">{trackName}</span>
          <button onClick={() => onChange("", "")} className="text-[10px] text-white/30 hover:text-white/60">Change</button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input type="text" placeholder="Search tracks..."
              value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1 h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/40" />
            <button onClick={handleSearch} disabled={loading}
              className="h-9 px-3 rounded-xl bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors disabled:opacity-50">
              {loading ? "..." : "Search"}
            </button>
          </div>
          {results.length > 0 && (
            <div className="max-h-40 overflow-y-auto space-y-1">
              {results.map((track) => (
                <button key={track.uri} onClick={() => onChange(track.uri, `${track.name} — ${track.artist}`)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] transition-colors text-left">
                  {track.albumArt ? (
                    <img src={track.albumArt} alt="" className="w-8 h-8 rounded object-cover" />
                  ) : (
                    <Music className="w-8 h-8 text-white/20" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white/80 truncate">{track.name}</div>
                    <div className="text-[10px] text-white/40 truncate">{track.artist}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
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
  const { actions, addAction, updateAction, deleteAction, duplicateAction, events, addEvent, updateEvent, deleteEvent, setupConfig, updateSetupConfig } = useAppStore();
  const importActionsToCurrentProfile = useAppStore((s) => s.importActionsToCurrentProfile);
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
  const [showSoundLibrary, setShowSoundLibrary] = useState(false);

  // Event Modal
  const [showEventModal, setShowEventModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [eventForm, setEventForm] = useState<any>(getDefaultEventForm());
  const [selectedGift, setSelectedGift] = useState<string>("");
  const [giftSearch, setGiftSearch] = useState("");
  const [showGiftPicker, setShowGiftPicker] = useState(false);
  const [testGiftRepeats, setTestGiftRepeats] = useState(1);

  const filteredGifts = allGifts.filter(g => !giftSearch || g.name.toLowerCase().includes(giftSearch.toLowerCase()));

  // Keystroke builder
  const [keystrokeBuffer, setKeystrokeBuffer] = useState<string[]>([]);
  // Stacked pending modifiers (Ctrl+Shift+Alt). Previously a single string,
  // so the second modifier chip replaced the first (Ctrl+Shift+A was impossible).
  const [pendingModifiers, setPendingModifiers] = useState<string[]>([]);

  // Helper to get current keystroke string (uses latest state via functional update in saveAction)
  const getKeystrokeString = useCallback(() => keystrokeBuffer.join(" "), [keystrokeBuffer]);

  // Filter
  const filteredActions = actions.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const maxActions = features?.maxActions ?? 5;
  const isUnlimited = maxActions === null || plan === 'pro';
  const canCreate = isUnlimited || actions.length < maxActions;

  // [FORENSIC-ACTIONS-PAGE] Actions page render diagnostics
  console.log('[FORENSIC-ACTIONS-PAGE]', JSON.stringify({
    storeActionCount: actions.length,
    storeActionIds: actions.map((a: Action) => a.id),
    filteredActionCount: filteredActions.length,
    filteredActionIds: filteredActions.map((a: Action) => a.id),
    maxActions,
    isUnlimited,
    canCreate,
  }));

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
      obs: false, obsAction: "switchScene", obsSceneName: "",
      streamerbot: false, sbActionName: "",
      spotify: false, spotifyAction: "addToQueue", spotifyTrackUri: "", spotifyTrackName: "",
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
      actionNames: [], actionMode: "single",
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
    setPendingModifiers([]);
    setEditingAction(null);
    setShowActionModal(true);
  }

  function openEditAction(action: any) {
    setActionForm({ ...action });
    setKeystrokeBuffer(parseKeystrokeKeys(action.keystrokeKeys));
    setPendingModifiers([]);
    setEditingAction(action);
    setShowActionModal(true);
  }

  async function saveAction(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const hasMedia = actionForm.sound || actionForm.video || actionForm.image || actionForm.keystroke || actionForm.minecraft || actionForm.obs || actionForm.spotify;
    if (!hasMedia) { toast("Select at least one action type: Sound, Video, Image, Keystroke, Minecraft, OBS, or Spotify"); return; }
    if (!actionForm.name.trim()) { toast("Enter an action name"); return; }

    // keystrokeBuffer is already in sync with actionForm.keystrokeKeys via handleKeystrokeInputChange
    const ksStr = keystrokeBuffer.join(" ");
    const payload = { ...actionForm, keystrokeKeys: ksStr };

    // KEY-E2E-SAVED: Log what will be saved
    console.log("[KEY-E2E-SAVED]", JSON.stringify({
      actionId: editingAction?.id || '(new)',
      keystrokeKeys: ksStr,
      keystrokeBuffer,
      keystrokeHoldMs: payload.keystrokeHoldMs || 100,
    }));

    if (editingAction) {
      await updateAction(editingAction.id, payload);
      const mediaResult = await persistActionMedia(editingAction.id, payload);
      if (!mediaResult.success) {
        toast(mediaResult.error, 'error');
        return;
      }
    } else {
      if (!canCreate) { setShowUpgradeModal(true); return; }
      await addAction(payload as any);
      const latest = useAppStore.getState().actions.slice(-1)[0];
      if (latest) {
        const mediaResult = await persistActionMedia(latest.id, payload);
        if (!mediaResult.success) {
          toast(mediaResult.error, 'error');
          return;
        }
      }
    }
    setShowActionModal(false);
  }

  // Persist action media files to Dexie IndexedDB
  async function persistActionMedia(actionId: string, payload: any): Promise<{ success: boolean; error: string }> {
    const logMedia = async (operation: string, stage: string): Promise<void> => {
      const rows = await db.mediaFiles.where('actionId').equals(actionId).toArray();
      const row = rows.find((candidate) => candidate.type === 'image') ?? rows[0] ?? null;
      console.log('[IMAGE-MEDIA-LIFECYCLE-DIAG]', JSON.stringify({
        operation,
        stage,
        actionId,
        currentProfileId: useAppStore.getState().currentProfileId,
        matchingMediaRow: Boolean(row),
        rowId: row?.id ?? null,
        rowType: row?.type ?? null,
        hasFile: typeof row?.file === 'string' && row.file.length > 0,
        fileLength: typeof row?.file === 'string' ? row.file.length : 0,
        mediaRef: row?.mediaRef ?? null,
        relevantActionIds: useAppStore.getState().actions.map((action) => action.id),
      }));
    };
    try {
      await logMedia('persistActionMedia', 'before-delete');
      await deleteActionMedia(actionId);
      await logMedia('persistActionMedia', 'after-delete');
      if (payload.sound && payload.soundFile) {
        await saveActionMedia(actionId + "_sound", actionId, "sound", payload.soundFile, payload.soundFileName || "");
      }
      if (payload.video && payload.videoFile) {
        await saveActionMedia(actionId + "_video", actionId, "video", payload.videoFile, payload.videoFileName || "");
      }
      if (payload.image && payload.imageFile) {
        await logMedia('persistActionMedia', 'before-image-save');
        await saveActionMedia(actionId + "_image", actionId, "image", payload.imageFile, payload.imageFileName || "");
        await logMedia('persistActionMedia', 'after-image-save');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[IMAGE-MEDIA-LIFECYCLE-DIAG]', JSON.stringify({
        operation: 'persistActionMedia',
        stage: 'error',
        actionId,
        currentProfileId: useAppStore.getState().currentProfileId,
        error: message,
      }));
      return { success: false, error: `Media save failed: ${message}` };
    }

    const verifyRows = await db.mediaFiles.where('actionId').equals(actionId).toArray();
    const expectedTypes = [
      payload.sound && payload.soundFile ? 'sound' : null,
      payload.video && payload.videoFile ? 'video' : null,
      payload.image && payload.imageFile ? 'image' : null,
    ].filter((type): type is 'sound' | 'video' | 'image' => type !== null);
    const missingType = expectedTypes.find((type) => {
      const row = verifyRows.find((candidate) => candidate.type === type);
      return !row || typeof row.file !== 'string' || row.file.length === 0;
    });
    if (missingType) {
      return { success: false, error: `Media save failed: ${missingType} file was not persisted.` };
    }
    return { success: true, error: '' };
  }

  // ── PORTABLE ACTION PACK EXPORT / IMPORT ─────────────────
  function exportActionPack(action: any) {
    void (async () => {
      try {
        const pack = await exportActionPackFromActions([action]);
        const jsonStr = JSON.stringify(pack, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `rosaefinity-action-${(action.name || action.id || "action").replace(/\s+/g, "-")}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast(`Exported "${action.name}" with ${pack.mediaAssets.length} media asset(s)`, "success");
      } catch (err) {
        console.error("[MEDIA-EXPORT-FAIL]", err);
        toast("Export failed", "error");
      }
    })();
  }

  function importActionPackFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      toast("Please select an Action pack JSON file", "error");
      return;
    }

    // CRITICAL: capture the active Stream Profile BEFORE any async work.
    // Media restore / Dexie I/O can race with cloud pull or profile switches.
    const targetProfileId = useAppStore.getState().currentProfileId;
    const targetProfileName =
      useAppStore.getState().streamProfiles.find((p) => p.id === targetProfileId)?.name ?? null;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(String(ev.target?.result || ""));
        if (!isActionPack(data)) {
          toast("Not a valid RosaeFinity Action pack", "error");
          return;
        }
        const store = useAppStore.getState();
        const existingIds = new Set(store.actions.map((a) => a.id));
        const result = await importActionPackWithDexie(data, existingIds);
        // Persist media rows FIRST so Test/hydrate can resolve immediately
        await persistImportedMediaRows(result.mediaRows);
        // Dedicated Action Pack path: dual-write into the EXPLICIT target profile
        // captured at import start. Never creates/switches/replaces Stream Profiles
        // (unlike Settings profile import).
        const importResult = await importActionsToCurrentProfile(
          result.actions as any,
          targetProfileId,
        );
        if (
          importResult.targetProfileId &&
          importResult.finalCurrentProfileId !== importResult.targetProfileId
        ) {
          console.warn("[ACTION-PACK-IMPORT] currentProfileId drifted during import", importResult);
        }
        if (importResult.profileCountAfter !== importResult.profileCountBefore) {
          console.warn("[ACTION-PACK-IMPORT] profile count changed during import", importResult);
        }
        console.log("[ACTION-PACK-IMPORT-FILE]", JSON.stringify({
          capturedTargetProfileId: targetProfileId,
          capturedTargetProfileName: targetProfileName,
          finalCurrentProfileId: importResult.finalCurrentProfileId,
          importedActionCount: importResult.importedActionCount,
          profileCountBefore: importResult.profileCountBefore,
          profileCountAfter: importResult.profileCountAfter,
        }));
        // Persist pointer/blob rows under the final action ids
        for (const imported of result.actions) {
          await persistActionMedia(String((imported as any).id), imported);
        }
        toast(
          `Imported ${result.actions.length} action(s) — media restored automatically`,
          "success",
        );
      } catch (err) {
        console.error("[MEDIA-IMPORT-FAIL]", err);
        toast("Import failed", "error");
      }
    };
    reader.readAsText(file);
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
    const hasRandomActions = ev.actionNames && ev.actionNames.length > 1;
    setEventForm({
      ...ev,
      actionNames: ev.actionNames || (ev.actionName ? [ev.actionName] : []),
      actionMode: hasRandomActions ? "random" : "single",
    });
    setSelectedGift(ev.giftName || "");
    setEditingEvent(ev);
    setShowEventModal(true);
  }

  function saveEvent(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      const isRandomMode = eventForm.actionMode === "random";

      if (isRandomMode) {
        const selectedActions = eventForm.actionNames || [];
        if (selectedActions.length === 0) {
          toast("Select at least one action");
          return;
        }
        if (selectedActions.length > 8) {
          toast("Maximum 8 random actions allowed");
          return;
        }
      } else {
        if (!eventForm.actionName) {
          toast("Select an action to trigger");
          return;
        }
      }

      const selectedActions = eventForm.actionNames || [];
      const payload = {
        ...eventForm,
        actionNames: isRandomMode ? selectedActions : [],
        actionName: isRandomMode ? (selectedActions[0] || "") : eventForm.actionName,
      };

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
    // Snapshot pending modifiers, then clear them in the same tick as the buffer update
    // (no setTimeout) so Ctrl+Shift+A cannot race with a second chip click.
    const mods = pendingModifiers;
    setKeystrokeBuffer(prev => {
      const newBuffer = [...prev];
      if (mods.length > 0) {
        // Canonical order: Ctrl, Shift, Alt, Meta — then main key
        const order = ["Ctrl", "Shift", "Alt", "Meta"];
        const stacked = [...mods].sort(
          (a, b) => order.indexOf(a) - order.indexOf(b)
        );
        newBuffer.push(normalizeKeystrokeToken([...stacked, key].join("+")));
      } else {
        newBuffer.push(normalizeKeystrokeToken(key));
      }
      return newBuffer;
    });
    setPendingModifiers([]);
  }

  function clickModifier(mod: string) {
    // Toggle each modifier independently so users can stack Ctrl+Shift+Alt.
    setPendingModifiers(prev =>
      prev.includes(mod) ? prev.filter(m => m !== mod) : [...prev, mod]
    );
  }

  function removeKeystrokeKey(index: number) {
    setKeystrokeBuffer(prev => {
      const newBuffer = [...prev];
      newBuffer.splice(index, 1);
      return newBuffer;
    });
  }

  function handleKeystrokeInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const rawValue = e.target.value;

    // KEY-COMPOSE-1: Log raw inputs
    console.log("[KEY-COMPOSE-1]", JSON.stringify({
      pendingModifiers,
      manualInput: rawValue,
    }));

    // Compose: combine pendingModifiers with manual input
    const composed = composeKeystroke(pendingModifiers, rawValue);

    // KEY-COMPOSE-2: Log normalized values
    const parts = composed.split("+").filter(Boolean);
    const mainKey = parts.length > 0 ? parts[parts.length - 1] : "";
    const mods = parts.slice(0, -1);
    console.log("[KEY-COMPOSE-2]", JSON.stringify({
      normalizedMainKey: mainKey,
      normalizedModifiers: mods,
    }));

    // KEY-COMPOSE-3: Log final combination
    const newBuffer = parseKeystrokeKeys(composed);
    console.log("[KEY-COMPOSE-3]", JSON.stringify({
      finalCombination: composed,
      keystrokeBuffer: newBuffer,
    }));

    // Update form and buffer
    setActionForm((prev: any) => ({ ...prev, keystrokeKeys: composed }));
    setKeystrokeBuffer(newBuffer);

    // Clear pending modifiers after composition (they're now part of the combination)
    if (pendingModifiers.length > 0 && composed) {
      setPendingModifiers([]);
    }
  }

  // ── TEST ACTION ──────────────────────────────────────────
  function testAction(action: any) {
    // Find the event(s) that trigger this action
    const store = useAppStore.getState();
    const allEvents = store.events;
    const allActions = store.actions;

    // RF-KEY-TRACE: correlation id for one Test Action click → one keyboard execution
    const rfKeyId = `RF-KEY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log("[RF-KEY-TRACE]", JSON.stringify({
      stage: "renderer-testAction-click",
      id: rfKeyId,
      actionId: action.id,
      keystrokeKeys: action.keystrokeKeys,
      keystroke: action.keystroke,
    }));

    // KEY-E2E-TEST: Log what the test button will execute
    console.log("[KEY-E2E-TEST]", JSON.stringify({
      actionId: action.id,
      actionKeystrokeKeys: action.keystrokeKeys,
      rfKeyId,
      testPayload: {
        keystrokeKeys: action.keystrokeKeys,
        keystrokeHoldMs: action.keystrokeHoldMs || 100,
        keystroke: action.keystroke,
      },
    }));

    console.log('[TEST-ACTION-START]', JSON.stringify({
      actionId: action.id,
      actionName: action.name,
      actionEnabled: action.enabled,
      actionType: action.sound ? 'sound' : action.video ? 'video' : action.image ? 'image' : action.keystroke ? 'keystroke' : action.minecraft ? 'minecraft' : 'other',
      keystrokeKeys: action.keystrokeKeys,
      keystrokeHoldMs: action.keystrokeHoldMs,
      overlayScreen: action.overlayScreen,
      displayDuration: action.displayDuration,
      duration: action.duration,
    }));

    console.log('[TEST-ACTION-ALL-EVENTS]', JSON.stringify({
      totalEvents: allEvents.length,
      enabledEvents: allEvents.filter(e => e.enabled).length,
      events: allEvents.map(e => ({
        id: e.id,
        enabled: e.enabled,
        triggerType: e.triggerType,
        actionName: e.actionName,
        actionNames: e.actionNames,
        whoTrigger: e.whoTrigger,
        giftName: e.giftName,
        minCoins: e.minCoins,
        minLikes: e.minLikes,
        keyword: e.keyword,
      })),
    }));

    console.log('[TEST-ACTION-ALL-ACTIONS]', JSON.stringify({
      totalActions: allActions.length,
      enabledActions: allActions.filter(a => a.enabled).length,
      actions: allActions.map(a => ({
        id: a.id,
        name: a.name,
        enabled: a.enabled,
      })),
    }));

    const linkedEvents = allEvents.filter(
      (e) => e.enabled && (e.actionName === action.name || (e.actionNames || []).includes(action.name))
    );

    console.log('[TEST-ACTION-EVENT]', JSON.stringify({
      linkedEventCount: linkedEvents.length,
      linkedEvents: linkedEvents.map(e => ({
        id: e.id,
        actionName: e.actionName,
        actionNames: e.actionNames,
        triggerType: e.triggerType,
        whoTrigger: e.whoTrigger,
        specificUser: e.specificUser,
        giftName: e.giftName,
        minCoins: e.minCoins,
        minLikes: e.minLikes,
        keyword: e.keyword,
      })),
    }));

    // If no linked event, execute the selected action directly through the
    // normal queue path. No synthetic gift event is dispatched and no Goal
    // Overlay side effects are triggered.
    if (linkedEvents.length === 0) {
      console.warn('[TEST-ACTION] No linked event found for action:', action.name, '- using direct test of selected action');

      const actionScreen = normalizeScreen(action.overlayScreen || action.screen || "Screen 1");
      const maxQueue = setupConfig.overlayScreensMaxQueue?.[`screen-${Number(actionScreen) - 1}`] ?? 5;
      console.log('[TEST-ACTION-DIRECT]', JSON.stringify({
        actionId: action.id,
        actionName: action.name,
        actionScreen,
        repeats: testGiftRepeats,
        maxQueue,
        rfKeyId,
      }));

      void dispatchTestActionCombo({
        executeAction,
        action,
        repeatCount: testGiftRepeats,
        screenId: `screen-${Number(actionScreen) - 1}`,
        maxQueue,
      });
      return;
    }

    // Use the first linked event's trigger type to generate appropriate test event
    const triggerType = linkedEvents[0].triggerType;
    const eventConfig = linkedEvents[0];

    console.log('[TEST-ACTION-TRIGGER]', JSON.stringify({
      selectedTriggerType: triggerType,
      eventConfig: {
        id: eventConfig.id,
        triggerType: eventConfig.triggerType,
        actionName: eventConfig.actionName,
        actionNames: eventConfig.actionNames,
        giftName: eventConfig.giftName,
        minCoins: eventConfig.minCoins,
        minLikes: eventConfig.minLikes,
        keyword: eventConfig.keyword,
      },
    }));

    const catalog = getGiftsSync();
    const giftsWithImages = catalog?.filter(g => getGiftImageUrl(g)) || [];
    const giftEntry = giftsWithImages.length > 0 ? giftsWithImages[0] : catalog?.[0];

    console.log('[TEST-ACTION-GIFT-CATALOG]', JSON.stringify({
      catalogLength: catalog?.length || 0,
      giftEntry: giftEntry ? {
        name: giftEntry.name,
        giftId: giftEntry.giftId,
        coins: giftEntry.coins,
        imageUrl: getGiftImageUrl(giftEntry),
      } : null,
    }));

    let testEventData: any = {
      user: "test_user",
      nickname: "test_user",
      screenId: action.overlayScreen || "Screen 1",
      timestamp: Date.now(),
    };

    // Generate test event matching the trigger type (matching tiktok-service.cjs normalization)
    switch (triggerType) {
      case "follow":
        testEventData.type = "follow";
        break;
      case "gift":
        testEventData.type = "gift";
        testEventData.giftName = giftEntry?.name || "Test Gift";
        testEventData.giftId = giftEntry?.giftId || "test-gift";
        testEventData.diamondCount = giftEntry?.coins || 1;
        testEventData.repeatCount = 1;
        testEventData.giftImageUrl = giftEntry ? getGiftImageUrl(giftEntry) : undefined;
        break;
      case "specificgift":
        testEventData.type = "gift";
        testEventData.giftName = eventConfig.giftName || (giftEntry?.name || "Test Gift");
        testEventData.giftId = giftEntry?.giftId || "test-gift";
        testEventData.diamondCount = giftEntry?.coins || 1;
        testEventData.repeatCount = 1;
        testEventData.giftImageUrl = giftEntry ? getGiftImageUrl(giftEntry) : undefined;
        break;
      case "giftcoins":
        testEventData.type = "gift";
        testEventData.giftName = giftEntry?.name || "Test Gift";
        testEventData.giftId = giftEntry?.giftId || "test-gift";
        testEventData.diamondCount = Math.max(eventConfig.minCoins || 1, giftEntry?.coins || 1);
        testEventData.repeatCount = 1;
        testEventData.giftImageUrl = giftEntry ? getGiftImageUrl(giftEntry) : undefined;
        break;
      case "like":
        testEventData.type = "like";
        testEventData.likeCount = Math.max(eventConfig.minLikes || 100, 1);
        testEventData.totalLikeCount = testEventData.likeCount * 2;
        break;
      case "comment":
        testEventData.type = "comment";
        testEventData.comment = eventConfig.keyword || "test comment";
        break;
      case "command":
        testEventData.type = "comment";
        testEventData.comment = "/" + (eventConfig.keyword || "test");
        break;
      case "join":
        testEventData.type = "member"; // Real TikTok event type from tiktok-service.cjs
        break;
      case "subscribe":
        testEventData.type = "subscribe";
        break;
      case "share":
        testEventData.type = "share";
        break;
      case "firstactivity":
        testEventData.type = "follow"; // First activity typically maps to follow
        break;
      case "subemote":
        testEventData.type = "subscribe";
        break;
      case "fansclub":
        testEventData.type = "subscribe";
        break;
      case "shop":
        testEventData.type = "gift"; // Shop purchase treated as gift-like
        testEventData.giftName = "TikTok Shop Purchase";
        testEventData.giftId = "shop";
        testEventData.diamondCount = 100;
        testEventData.repeatCount = 1;
        break;
      default:
        console.warn('[TestAction] Unknown trigger type:', triggerType, '- falling back to generic');
        testActionWithGenericEvent(action, rfKeyId);
        return;
    }

    console.log('[TEST-ACTION-SYNTHETIC]', JSON.stringify({
      triggerType,
      generatedEvent: testEventData,
    }));

    // Gift tests run through the production dispatcher so the combo cap and the
    // normal queue capacity are exercised. bypassQueue would hide both.
    if (testEventData.type === "gift") {
      const actionScreen = normalizeScreen(action.overlayScreen || action.screen || "Screen 1");
      console.log('[TEST-ACTION-GIFT-COMBO]', JSON.stringify({
        actionId: action.id,
        actionName: action.name,
        actionScreen,
        repeats: testGiftRepeats,
        maxQueue: setupConfig.overlayScreensMaxQueue?.[`screen-${Number(actionScreen) - 1}`] ?? 5,
        rfKeyId,
      }));
      dispatchTestGiftCombo({
        dispatch: dispatchTikTokEvent,
        repeatCount: testGiftRepeats,
        screenId: `screen-${Number(actionScreen) - 1}`,
        giftName: testEventData.giftName,
        giftId: testEventData.giftId,
        diamondCount: testEventData.diamondCount,
        giftImageUrl: testEventData.giftImageUrl,
        user: "test_user",
        roomId: `test-room-${actionScreen}`,
      });
      return;
    }

    // Non-gift tests keep the existing manual path: immediate execution with the
    // pending-keystroke countdown.
    console.log('[TEST-ACTION-EXECUTE]', JSON.stringify({
      actionId: action.id,
      actionName: action.name,
      eventType: testEventData.type,
      bypassQueue: true,
      rfKeyId,
    }));
    console.log("[RF-KEY-TRACE]", JSON.stringify({
      stage: "renderer-dispatch",
      id: rfKeyId,
      actionId: action.id,
      bypassQueue: true,
    }));

    // Shared Test Action architecture — identical for existing/new/copied/edited.
    // Pending 5s countdown ONLY when canonical keystroke data is present.
    runManualTestAction(action, testEventData, rfKeyId, {
      executeAction,
      executeDeferredTestKeystroke,
      showPendingKeystroke,
      updatePendingKeystroke,
      hidePendingKeystroke,
      pendingController: pendingKeystrokeController,
      setInterval: (fn, ms) => window.setInterval(fn, ms),
      clearInterval: (id) => window.clearInterval(id),
    });
  }

  // Fallback generic test event (gift-based, for backward compatibility)
  function testActionWithGenericEvent(action: any, rfKeyId?: string) {
    const rfKey = rfKeyId || `RF-KEY-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const catalog = getGiftsSync();
    const giftsWithImages = catalog?.filter(g => getGiftImageUrl(g)) || [];
    const entry = giftsWithImages.length > 0 ? giftsWithImages[0] : catalog?.[0];

    if (!entry) {
      console.error('[COIN-JAR-TEST] No catalog entries available');
      toast('Gift catalog not loaded yet');
      return;
    }

    const resolvedImageUrl = getGiftImageUrl(entry);

    const testEventData = {
      type: "gift",
      user: "test_user",
      nickname: "test_user",
      screenId: action.overlayScreen || "Screen 1",
      giftName: entry.name,
      giftId: entry?.giftId || 'test-gift',
      diamondCount: entry.coins,
      repeatCount: 1,
      giftImageUrl: resolvedImageUrl || undefined,
      timestamp: Date.now(),
    };

    console.log('[TestAction] Fallback generic gift test event');
    console.log("[RF-KEY-TRACE]", JSON.stringify({
      stage: "renderer-generic-test-dispatch",
      id: rfKey,
      actionId: action.id,
    }));

    // Generic tests are also gifts, so they use the dispatcher and queue instead
    // of the manual bypass path.
    const actionScreen = normalizeScreen(action.overlayScreen || action.screen || "Screen 1");
    dispatchTestGiftCombo({
      dispatch: dispatchTikTokEvent,
      repeatCount: testGiftRepeats,
      screenId: `screen-${Number(actionScreen) - 1}`,
      giftName: testEventData.giftName,
      giftId: testEventData.giftId,
      diamondCount: testEventData.diamondCount,
      giftImageUrl: testEventData.giftImageUrl,
      user: "test_user",
      roomId: `test-room-${actionScreen}`,
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

      {/* ══ SOUND LIBRARY MODAL ═══════════════════ */}
      <SoundLibraryModal
        open={showSoundLibrary}
        onClose={() => setShowSoundLibrary(false)}
        onSelect={(file, name) => setActionForm({ ...actionForm, sound: true, soundFile: file, soundFileName: name })}
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
            <label className="cursor-pointer inline-flex items-center gap-2 h-9 px-3 rounded-xl bg-white/[0.06] text-sm text-white hover:bg-white/[0.1] transition-colors">
              <Upload className="w-4 h-4" /> Import Pack
              <input type="file" accept=".json" onChange={importActionPackFile} style={{ display: "none" }} />
            </label>
            <Button onClick={openCreateAction} disabled={!canCreate} className="gap-2">
              <Plus className="w-4 h-4" /> Create New Action
            </Button>
          </div>
        </div>
        {/* Test Gift Repeats Control */}
        <div className="flex items-center gap-2 mb-4">
          <label className="text-xs text-white/40">Test Gift Repeats:</label>
          <input type="number" min={1} max={101} value={testGiftRepeats}
            onChange={(e) => setTestGiftRepeats(Math.max(1, Math.min(101, Number(e.target.value) || 1)))}
            className="w-16 h-7 px-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-white outline-none focus:border-primary/40 text-center" />
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
                        <button onClick={() => exportActionPack(action)} className="w-7 h-7 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-white/60 hover:text-white flex items-center justify-center text-xs transition-all" title="Export Action pack (with media)"><Download className="w-3.5 h-3.5" /></button>
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
                    <input type="number" min={1} max={100}
                      value={setupConfig.overlayScreensMaxQueue?.[`screen-${n - 1}`] ?? 5}
                      onChange={(e) => {
                        const value = Math.max(1, Math.min(100, Number(e.target.value) || 5));
                        updateSetupConfig({
                          overlayScreensMaxQueue: {
                            ...setupConfig.overlayScreensMaxQueue,
                            [`screen-${n - 1}`]: value,
                          },
                        });
                      }}
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
                      <div className="min-w-0">
                        <label className="block text-xs text-white/50 mb-1.5">Audio File (MP3, WAV, OGG)</label>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="flex-1 min-w-0 overflow-hidden">
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
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowSoundLibrary(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-primary/20 text-primary text-xs font-medium hover:bg-primary/30 transition-colors whitespace-nowrap shrink-0"
                          >
                            <Library className="w-3.5 h-3.5" />
                            Sound Library
                          </button>
                        </div>
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
                          <span className="w-full text-[10px] text-white/35 mb-0.5">Numpad</span>
                          {NUMPAD_KEYS.map(k => (
                            <button type="button" key={k.id} onClick={() => addSpecialKey(k.id)}
                              title={k.id}
                              className="px-2 py-1 text-[10px] rounded bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-amber/20 hover:text-amber hover:border-amber/30 transition-all">{k.label}</button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {MODIFIERS.map(m => (
                            <button type="button" key={m} onClick={() => clickModifier(m)}
                              className={`px-2 py-1 text-[10px] rounded border transition-all ${
                                pendingModifiers.includes(m)
                                  ? "bg-primary/20 border-primary/30 text-primary-light"
                                  : "bg-white/[0.04] border-white/[0.08] text-white/70 hover:bg-primary/20 hover:border-primary/30"
                              }`}>{m}</button>
                          ))}
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {keystrokeBuffer.map((k, i) => (
                            <span key={i} className="px-2 py-0.5 text-[10px] rounded bg-primary/20 border border-primary/30 text-primary-light flex items-center gap-1">
                              {formatKeystrokeTokenForDisplay(k)}
                              <button type="button" onClick={() => removeKeystrokeKey(i)} className="hover:text-danger">×</button>
                            </span>
                          ))}
                        </div>
                        <input type="text" placeholder="Or type manually (e.g., Ctrl+Shift+K or Ctrl+Numpad1)"
                          value={actionForm.keystrokeKeys}
                          onChange={handleKeystrokeInputChange}
                          className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/40" />
                        <p className="text-[10px] text-white/30">Hold: {actionForm.keystrokeHoldMs || 100}ms · Numpad: Numpad0–9, NumpadAdd, NumpadSubtract, NumpadMultiply, NumpadDivide, NumpadDecimal, NumpadEnter</p>
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

                  <MediaToggle
                    icon={Monitor}
                    label="OBS"
                    color="text-blue"
                    formKey="obs"
                    form={actionForm}
                    setForm={setActionForm}
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-white/50 mb-1.5">Scene</label>
                        <OBSSceneSelector
                          value={actionForm.obsSceneName}
                          onChange={(sceneName) => setActionForm({...actionForm, obsSceneName: sceneName})}
                        />
                      </div>
                    </div>
                  </MediaToggle>

                  <MediaToggle
                    icon={Zap}
                    label="Streamer.bot"
                    color="text-purple"
                    formKey="streamerbot"
                    form={actionForm}
                    setForm={setActionForm}
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-white/50 mb-1.5">Action Name</label>
                        <input type="text" placeholder="Enter Streamer.bot action name"
                          value={actionForm.sbActionName || ""}
                          onChange={(e) => setActionForm({...actionForm, sbActionName: e.target.value})}
                          className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-primary/40 font-mono" />
                        <p className="text-[10px] text-white/30 mt-1">Must match the action name configured in Streamer.bot</p>
                      </div>
                    </div>
                  </MediaToggle>

                  <MediaToggle
                    icon={Music}
                    label="Spotify"
                    color="text-green-400"
                    formKey="spotify"
                    form={actionForm}
                    setForm={setActionForm}
                  >
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-white/50 mb-1.5">Operation</label>
                        <select
                          value={actionForm.spotifyAction || "addToQueue"}
                          onChange={(e) => setActionForm({...actionForm, spotifyAction: e.target.value, spotifyTrackUri: "", spotifyTrackName: ""})}
                          className="w-full h-9 px-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white outline-none focus:border-primary/40"
                        >
                          <option value="addToQueue">Add Track to Queue</option>
                          <option value="skip">Skip Current Track</option>
                        </select>
                      </div>
                      {actionForm.spotifyAction === "addToQueue" && (
                        <SpotifyTrackSelector
                          value={actionForm.spotifyTrackUri || ""}
                          trackName={actionForm.spotifyTrackName || ""}
                          onChange={(uri, name) => setActionForm({...actionForm, spotifyTrackUri: uri, spotifyTrackName: name})}
                        />
                      )}
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

                        {/* Action Mode Toggle */}
                        <div>
                          <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-2">Action Mode</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setEventForm({...eventForm, actionMode: "single", actionNames: []})}
                              className={cn(
                                "px-3 py-2 rounded-xl text-sm font-medium transition-all",
                                eventForm.actionMode === "single"
                                  ? "bg-primary/20 border border-primary/30 text-primary-light"
                                  : "bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08]"
                              )}
                            >
                              ⚡ Trigger this action
                            </button>
                            <button
                              type="button"
                              onClick={() => setEventForm({...eventForm, actionMode: "random", actionName: ""})}
                              className={cn(
                                "px-3 py-2 rounded-xl text-sm font-medium transition-all",
                                eventForm.actionMode === "random"
                                  ? "bg-primary/20 border border-primary/30 text-primary-light"
                                  : "bg-white/[0.04] border border-white/[0.08] text-white/70 hover:bg-white/[0.08]"
                              )}
                            >
                              🎲 Random action
                            </button>
                          </div>
                        </div>

                        {/* Single Action Select */}
                        {eventForm.actionMode === "single" && (
                          <div>
                            <label className="text-sm font-semibold text-white block mb-2">⚡ Trigger this action:</label>
                            <select value={eventForm.actionName} onChange={e => setEventForm({...eventForm, actionName: e.target.value})}
                              className="w-full h-11 px-4 rounded-xl bg-[#1e1e2a] border border-white/[0.12] text-sm text-white outline-none focus:border-primary/40 transition-all appearance-none cursor-pointer" required>
                              <option value="" className="bg-[#1e1e2a] text-white/50 py-2">-- Select Action --</option>
                              {actions.map(a => <option key={a.id} value={a.name} className="bg-[#1e1e2a] text-white py-2">{!a.enabled ? "[DISABLED] " : ""}{a.name}</option>)}
                            </select>
                          </div>
                        )}

                        {/* Random Action Multi-Select */}
                        {eventForm.actionMode === "random" && (
                          <div>
                            <label className="text-sm font-semibold text-white block mb-2">
                              🎲 Trigger one of these actions (random) *
                              <span className="text-white/30 ml-2 text-xs font-normal">(1-8 actions)</span>
                            </label>
                            <div className="max-h-48 overflow-y-auto border border-white/[0.08] rounded-xl bg-white/[0.02] p-2 space-y-1">
                              {actions.length === 0 ? (
                                <p className="text-xs text-white/30 text-center py-2">No actions available</p>
                              ) : (
                                actions.map(a => {
                                  const isSelected = (eventForm.actionNames || []).includes(a.name);
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
                                          const currentNames = eventForm.actionNames || [];
                                          let newNames;
                                          if (e.target.checked) {
                                            if (currentNames.length >= 8) {
                                              toast("Maximum 8 random actions allowed");
                                              return;
                                            }
                                            newNames = [...currentNames, a.name];
                                          } else {
                                            newNames = currentNames.filter((n: string) => n !== a.name);
                                          }
                                          setEventForm({...eventForm, actionNames: newNames});
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
                            {(eventForm.actionNames || []).length > 0 && (
                              <p className="text-xs text-white/40 mt-2">
                                Selected: {(eventForm.actionNames || []).length}/8
                              </p>
                            )}
                          </div>
                        )}

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
