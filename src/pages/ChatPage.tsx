import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../store/app-store";
import { Button } from "../components/ui/button";
import { SCREEN_IDS } from "../types";
import type { ScreenId } from "../types";
import {
  MessageSquare, Trash2, Gift, Heart,
  Share2, UserPlus, Filter, Mic, Volume2
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

export function ChatPage() {
  const { screenConnections, screenLiveEvents, clearScreenLiveEvents } = useAppStore();
  const [filter, setFilter] = useState("all");
  const [selectedScreen, setSelectedScreen] = useState<ScreenId | "all">("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [paused, setPaused] = useState(false);
  const eventsContainerRef = useRef<HTMLDivElement>(null);

  // Build merged event list from per-screen arrays
  const allEvents = selectedScreen === "all"
    ? Object.values(screenLiveEvents).flat().sort((a, b) => b.timestamp - a.timestamp).slice(0, 200)
    : (screenLiveEvents[selectedScreen] || []);

  const filteredEvents = filter === "all"
    ? allEvents
    : allEvents.filter(e => e.type === filter);

  // Check if any screen is live
  const isLive = Object.values(screenConnections).some(c => c.isLive);
  const liveUsername = Object.values(screenConnections).find(c => c.isLive)?.username || "";

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (autoScroll && !paused && eventsContainerRef.current) {
      eventsContainerRef.current.scrollTop = eventsContainerRef.current.scrollHeight;
    }
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
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red/20 border border-red/30 text-red text-[10px] font-semibold animate-pulse"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red" /> LIVE @{liveUsername}
              </motion.span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => selectedScreen === "all" ? clearScreenLiveEvents("screen-0") : clearScreenLiveEvents(selectedScreen)} className="gap-1.5">
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-white/[0.06] bg-card p-4 mb-4 flex flex-wrap items-center gap-4">
        {/* Screen filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40">Screen:</span>
          <select
            value={selectedScreen}
            onChange={(e) => setSelectedScreen(e.target.value as ScreenId | "all")}
            className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-primary/40"
          >
            <option value="all">All Screens</option>
            {SCREEN_IDS.map(id => {
              const conn = screenConnections[id];
              return (
                <option key={id} value={id} disabled={!conn?.isLive}>
                  S{id.split('-')[1]}{conn?.isLive ? ` (${conn.username})` : " (offline)"}
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
            {eventTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Auto-scroll */}
        <label className="flex items-center gap-2 cursor-pointer ml-auto">
          <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-primary" />
          <span className="text-sm text-white/70">Auto-scroll</span>
        </label>

        {/* Pause */}
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={paused} onChange={(e) => setPaused(e.target.checked)}
            className="w-4 h-4 rounded border-white/20 bg-white/[0.04] accent-primary" />
          <span className="text-sm text-white/70">Pause</span>
        </label>

        <div className="text-xs text-white/40">
          {filteredEvents.length} events
        </div>
      </motion.div>

      {/* Event List */}
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
            <AnimatePresence mode="popLayout">
              {filteredEvents.map((event, index) => (
                <motion.div
                  key={`${event.timestamp}-${index}`}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className={`event-item event-${event.type} mb-3 last:mb-0`}
                >
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{EVENT_ICONS[event.type as keyof typeof EVENT_ICONS] || "⚡"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50 font-mono">S{event.screenId?.split('-')[1] || '?'}</span>
                        <span className="font-medium text-white/90">@{event.user || event.nickname || "someone"}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-white/50 uppercase">{event.type}</span>
                        <span className="text-[10px] text-white/30">{new Date(event.timestamp).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
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
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Browser Source URL */}
      <div className="mt-4">
        <BrowserSourceBar overlayPath="chat" label="Chat Feed Overlay" />
      </div>

      {/* TTS Chat Section */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6">
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
}export default ChatPage;
