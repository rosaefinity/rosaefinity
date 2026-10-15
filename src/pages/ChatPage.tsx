import { useEffect, useMemo, useRef, useState, memo } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../store/app-store";
import { Button } from "../components/ui/button";
import { SCREEN_IDS } from "../types";
import type { ScreenId, LiveEvent } from "../types";
import {
  MessageSquare, Trash2, Gift, Heart,
  Share2, UserPlus, Filter, Volume2
} from "lucide-react";
import { BrowserSourceBar } from "../components/BrowserSourceBar";
import { TTSChatSettings } from "../components/tts/TTSChatSettings";

const EVENT_ICONS = {
  gift: "🎁", follow: "👤", comment: "💬",
  like: "❤️", share: "🔗", join: "👋", subscribe: "⭐",
};

const eventTypes = [
  { value: "all", label: "All", icon: MessageSquare },
  { value: "gift", label: "Gifts", icon: Gift },
  { value: "follow", label: "Follows", icon: UserPlus },
  { value: "like", label: "Likes", icon: Heart },
  { value: "comment", label: "Comments", icon: MessageSquare },
  { value: "share", label: "Shares", icon: Share2 },
  { value: "join", label: "Joins", icon: Share2 },
];

/** Store caps each screen at 100 events (app-store addScreenLiveEvent). */
const STORE_EVENT_CAP_PER_SCREEN = 100;
/** Historical UI cap when merging all screens — keep prior semantics. */
const MERGED_EVENT_CAP = 200;

/** Optional [CHAT-PERF] diagnostics. Enable: window.__RF_CHAT_PERF = true */
const CHAT_PERF_ENABLED =
  typeof window !== "undefined" &&
  (window as unknown as { __RF_CHAT_PERF?: boolean }).__RF_CHAT_PERF === true;

const EMPTY_EVENTS: LiveEvent[] = [];

/**
 * Stable list key — avoids remounting every row when a new event is prepended.
 * Ordering/filter semantics are unchanged; only React reconciliation is cheaper.
 */
function getEventKey(event: LiveEvent): string {
  return [
    event.timestamp,
    event.screenId ?? "",
    event.type,
    event.user ?? "",
    event.giftName ?? "",
    event.comment ?? "",
    event.likeCount ?? "",
    event.repeatCount ?? "",
  ].join("|");
}

interface LiveEventRowProps {
  event: LiveEvent;
  isLatest: boolean;
}

/**
 * Memoized event row. Parent list uses plain DOM + CSS enter animation on the
 * newest item only — no Framer Motion layout/enter work for hundreds of rows.
 */
const LiveEventRow = memo(function LiveEventRow({ event, isLatest }: LiveEventRowProps) {
  return (
    <div
      className={`event-item event-${event.type} mb-3 last:mb-0${isLatest ? " event-item-enter" : ""}`}
    >
      <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
        <span className="text-2xl flex-shrink-0 mt-0.5">
          {EVENT_ICONS[event.type as keyof typeof EVENT_ICONS] || "⚡"}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50 font-mono">
              S{event.screenId?.split("-")[1] || "?"}
            </span>
            <span className="font-medium text-white/90">
              @{event.user || event.nickname || "someone"}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50 uppercase">
              {event.type}
            </span>
            <span className="text-[10px] text-white/30">
              {new Date(event.timestamp).toLocaleTimeString("id-ID", {
                hour: "2-digit", minute: "2-digit", second: "2-digit",
              })}
            </span>
          </div>
          <div className="text-sm text-white/70 whitespace-pre-wrap break-words">
            {event.type === "gift" && `Sent <strong>${event.giftName}</strong> ×${event.repeatCount || 1}`}
            {event.type === "comment" && event.comment}
            {event.type === "like" && `+${event.likeCount || 1} likes`}
            {event.type === "share" && "shared your live"}
            {event.type === "follow" && "is now following you"}
            {event.type === "join" && "joined your live"}
            {event.type === "subscribe" && "subscribed to you! ⭐"}
          </div>
        </div>
      </div>
    </div>
  );
});

export function ChatPage() {
  // ── Narrow Zustand selectors ──
  // Only subscribe to Live Event Feed state + stable actions.
  // Avoids re-rendering ChatPage (and TTS settings / overlay bar) on unrelated
  // app-store writes (points, actions, auth, media hydration, etc.).
  const screenLiveEvents = useAppStore((s) => s.screenLiveEvents);
  const clearScreenLiveEvents = useAppStore((s) => s.clearScreenLiveEvents);
  // Stable slice reference — only changes when connection state actually updates.
  // Do NOT map this slice inside the selector (new object identities defeat
  // useSyncExternalStore / caused Maximum update depth in TTSChatSettings).
  const screenConnections = useAppStore((s) => s.screenConnections);
  const liveScreenInfo = useMemo(
    () =>
      SCREEN_IDS.map((id) => {
        const conn = screenConnections[id];
        return {
          id,
          isLive: !!conn?.isLive,
          username: conn?.username || "",
        };
      }),
    [screenConnections]
  );

  const [filter, setFilter] = useState("all");
  const [selectedScreen, setSelectedScreen] = useState<ScreenId | "all">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const eventsContainerRef = useRef<HTMLDivElement>(null);
  const renderCountRef = useRef(0);
  const lastFilterMsRef = useRef(0);
  const lastSortMsRef = useRef(0);

  // ── Memoized event derivation ──
  // Runs only when screenLiveEvents or selectedScreen/filter changes —
  // not on every ChatPage re-render (e.g. connection badge ticks).
  // Ordering / caps preserved exactly:
  //   all screens → merge, sort timestamp desc, slice(200)
  //   one screen  → store array as-is (already newest-first, capped at 100)
  const allEvents = useMemo(() => {
    const t0 = CHAT_PERF_ENABLED ? performance.now() : 0;
    let result: LiveEvent[];
    if (selectedScreen === "all") {
      result = Object.values(screenLiveEvents)
        .flat()
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MERGED_EVENT_CAP);
    } else {
      result = screenLiveEvents[selectedScreen] || EMPTY_EVENTS;
    }
    if (CHAT_PERF_ENABLED) {
      lastSortMsRef.current = performance.now() - t0;
    }
    return result;
  }, [screenLiveEvents, selectedScreen]);

  const filteredEvents = useMemo(() => {
    if (filter === "all") return allEvents;
    const t0 = CHAT_PERF_ENABLED ? performance.now() : 0;
    const result = allEvents.filter((e) => e.type === filter);
    if (CHAT_PERF_ENABLED) {
      lastFilterMsRef.current = performance.now() - t0;
    }
    return result;
  }, [allEvents, filter]);

  // Derived LIVE badge from shallow connection snapshot (not full store).
  const isLive = liveScreenInfo.some((c) => c.isLive);
  const liveUsername = liveScreenInfo.find((c) => c.isLive)?.username || "";

  renderCountRef.current += 1;
  if (CHAT_PERF_ENABLED) {
    const storeEventCount = Object.values(screenLiveEvents)
      .reduce((n, arr) => n + arr.length, 0);
    console.log("[CHAT-PERF]", {
      render: renderCountRef.current,
      visibleEventCount: filteredEvents.length,
      allEventCount: allEvents.length,
      storeEventCount,
      filter,
      selectedScreen,
      sortMs: +lastSortMsRef.current.toFixed(2),
      filterMs: +lastFilterMsRef.current.toFixed(2),
      storeCapPerScreen: STORE_EVENT_CAP_PER_SCREEN,
      mergedCap: MERGED_EVENT_CAP,
    });
  }

  // Auto-scroll: only when visible list length / toggles change.
  // rAF batches the write so layout is not forced synchronously in the effect.
  useEffect(() => {
    if (!autoScroll || paused) return;
    const el = eventsContainerRef.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
    return () => cancelAnimationFrame(raf);
  }, [filteredEvents.length, autoScroll, paused]);

  return (
    <div className="p-6 h-full overflow-hidden flex flex-col">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-accent" />
              <h1 className="text-xl font-bold text-white">Live Event Feed</h1>
            </div>
            {isLive && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red/20 border border-red/30 text-red text-[10px] font-semibold animate-pulse"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red" /> LIVE @{liveUsername}
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                selectedScreen === "all"
                  ? clearScreenLiveEvents("screen-0")
                  : clearScreenLiveEvents(selectedScreen)
              }
              className="gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-white/[0.06] bg-card p-4 mb-4 flex flex-wrap items-center gap-4"
      >
        {/* Screen filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">Screen:</span>
          <select
            value={selectedScreen}
            onChange={(e) => setSelectedScreen(e.target.value as ScreenId | "all")}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/40"
          >
            <option value="all">All Screens</option>
            {SCREEN_IDS.map((id) => {
              const conn = liveScreenInfo.find((c) => c.id === id);
              return (
                <option key={id} value={id} disabled={!conn?.isLive}>
                  S{id.split("-")[1]}
                  {conn?.isLive ? ` (${conn.username})` : " (offline)"}
                </option>
              );
            })}
          </select>
        </div>

        {/* Event type filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-white/40" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/40"
          >
            {eventTypes.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Auto-scroll */}
        <label className="flex items-center gap-2 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-primary"
          />
          <span className="text-sm text-white/70">Auto-scroll</span>
        </label>

        {/* Pause */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={paused}
            onChange={(e) => setPaused(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-primary"
          />
          <span className="text-sm text-white/70">Pause</span>
        </label>

        <div className="text-xs text-white/40">
          {filteredEvents.length} events
        </div>
      </motion.div>

      {/* Event List — plain rows; CSS enter animation on newest item only */}
      <div className="flex-1 overflow-hidden rounded-2xl border border-white/[0.06] bg-card">
        {filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-white/30">
            <MessageSquare className="w-16 h-16 mb-4" />
            <p className="text-sm">No events yet</p>
            <p className="text-xs mt-1">Connect a TikTok LIVE screen to see events</p>
          </div>
        ) : (
          <div
            ref={eventsContainerRef}
            className="h-full overflow-y-auto p-4"
            onScroll={() => {
              if (eventsContainerRef.current) {
                const { scrollTop, scrollHeight, clientHeight } = eventsContainerRef.current;
                const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
                if (!isAtBottom) setAutoScroll(false);
              }
            }}
          >
            {filteredEvents.map((event, index) => (
              <LiveEventRow
                key={getEventKey(event)}
                event={event}
                isLatest={index === 0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Browser Source URL — unchanged (negligible cost; not part of this perf patch) */}
      <div className="mt-4">
        <BrowserSourceBar overlayPath="chat" label="Chat Feed Overlay" />
      </div>

      {/* TTS Chat Section — UI only; runtime TTS stays in use-init.ts */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mt-6"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-6 h-6 text-accent" />
            <h2 className="text-xl font-bold text-white">TTS Chat</h2>
          </div>
        </div>

        <div className="space-y-4">
          <TTSChatSettings />
        </div>
      </motion.div>
    </div>
  );
}

export default ChatPage;
