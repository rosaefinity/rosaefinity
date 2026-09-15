import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAppStore } from "../store/app-store";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { RosaeFinityLogo } from "../components/branding/RosaeFinityLogo";
import { SCREEN_IDS } from "../types";
import {
  LayoutDashboard, Zap, Settings, Bell, Volume2,
  Monitor, Camera, MessageSquare, Music,
  TrendingUp, Users, Gift, Heart
} from "lucide-react";

const FEATURES = [
  { icon: "🎁", title: "Actions & Events", desc: "Automate responses to gifts, follows, likes, and comments.", path: "/actions" },
  { icon: "🔔", title: "Alerts", desc: "Real-time on-screen alerts for every viewer interaction.", path: "/alerts" },
  { icon: "🔊", title: "Sound Library", desc: "Upload custom sounds and trigger them with events.", path: "/sounds" },
  { icon: "📺", title: "Overlay Widgets", desc: "Beautiful overlays for OBS, TikTok LIVE Studio, and more.", path: "/overlay" },
  { icon: "📷", title: "Screen Capture", desc: "Capture any window or screen for streaming in portrait mode.", path: "/capture" },
  { icon: "💬", title: "Live Chat Feed", desc: "Monitor all TikTok events in real-time with filtering.", path: "/chat" },
  { icon: "🎵", title: "Song Requests", desc: "Let viewers request songs via chat commands.", path: "/song" },
  { icon: "⛏️", title: "Minecraft Integration", desc: "Trigger Minecraft commands from TikTok events.", tag: "Popular" },
  { icon: "🏆", title: "Team Member Levels", desc: "Reward loyal viewers with level-based benefits.", tag: "Pro" },
];

export function Dashboard() {
  const navigate = useNavigate();
  const { screenConnections, actions, events } = useAppStore();

  // Compute aggregate stats from all screens
  const connectedScreens = Object.values(screenConnections).filter(c => c.isLive);
  const totalStats = Object.values(screenConnections).reduce(
    (acc, c) => ({
      gifts: acc.gifts + c.stats.gifts,
      likes: acc.likes + c.stats.likes,
      views: Math.max(acc.views, c.stats.views),
      follows: acc.follows + c.stats.follows,
    }),
    { gifts: 0, likes: 0, views: 0, follows: 0 }
  );
  const anyLive = connectedScreens.length > 0;

  return (
    <div className="p-6 h-full overflow-y-auto space-y-8">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
          className="mx-auto mb-5 w-48 h-48">
          <RosaeFinityLogo className="w-full h-full" />
        </motion.div>
        <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="text-3xl font-extrabold tracking-tight">
          <span className="bg-gradient-to-r from-primary-light via-secondary-light to-accent bg-clip-text text-transparent">Rosae</span>
          <span className="text-white">Finity</span>
        </motion.h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="text-white/40 mt-2 text-sm max-w-xl mx-auto">
          TikTok LIVE Streaming Tools — Bikin stream kamu lebih interaktif dan seru!
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="flex items-center justify-center gap-3 mt-6">
          {anyLive ? (
            <Badge className="px-4 py-1.5 text-sm bg-green/20 text-green border border-green/30">
              <span className="w-2 h-2 rounded-full bg-green mr-2 animate-pulse" />
              {connectedScreens.length} Screen{connectedScreens.length > 1 ? "s" : ""} LIVE
            </Badge>
          ) : (
            <Button onClick={() => navigate("/settings")} className="gap-2 px-6">
              <Zap className="w-4 h-4" /> Connect TikTok LIVE
            </Button>
          )}
          <span className="text-xs text-white/30">v1.0.0</span>
        </motion.div>
      </motion.div>

      {/* Stats Bar */}
      {anyLive && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="flex items-center justify-center gap-6 p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
          {[
            { label: "Viewers", value: totalStats.views, icon: Users },
            { label: "Gifts", value: totalStats.gifts, icon: Gift },
            { label: "Likes", value: totalStats.likes, icon: Heart },
            { label: "Actions", value: actions.length, icon: Zap },
            { label: "Events", value: events.length, icon: Bell },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-bold text-white">{s.value}</p>
              <p className="text-[10px] text-white/40">{s.label}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* Per-Screen Status Grid */}
      {anyLive && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="grid grid-cols-4 gap-2">
          {SCREEN_IDS.map((id) => {
            const conn = screenConnections[id];
            return (
              <div key={id} className={`p-2 rounded-lg border text-center ${conn?.isLive ? "bg-green/10 border-green/30" : "bg-white/[0.02] border-white/[0.04]"}`}>
                <p className="text-[10px] text-white/50">S{id.split('-')[1]}</p>
                {conn?.isLive ? (
                  <p className="text-xs text-green font-medium truncate">@{conn.username}</p>
                ) : (
                  <p className="text-xs text-white/20">offline</p>
                )}
              </div>
            );
          })}
        </motion.div>
      )}

      {/* Features Grid */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary-light" /> Interactive TikTok LIVE Tools
        </h2>
        <div className="grid grid-cols-3 gap-3">
          {FEATURES.map((f, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.05 }}
              onClick={() => f.path && navigate(f.path)}
              className={`p-4 rounded-xl border border-white/[0.06] bg-card hover:border-white/[0.12] transition-all ${f.path ? "cursor-pointer" : ""}`}>
              <div className="text-2xl mb-2">{f.icon}</div>
              <h3 className="text-sm font-semibold text-white">{f.title}</h3>
              <p className="text-xs text-white/40 mt-1 leading-relaxed">{f.desc}</p>
              {f.tag && (
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-primary/20 text-primary-light">{f.tag}</span>
              )}
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Latest Updates */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" /> Latest Updates
        </h2>
        <div className="space-y-2">
          {[
            { date: "2024-12", text: "🎉 Multi-Screen Support — 8 independent TikTok connections" },
            { date: "2024-11", text: "🤖 Streamer.bot Integration — trigger actions from TikTok events" },
            { date: "2024-10", text: "⛏️ Minecraft Commands — viewers control Minecraft via gifts" },
            { date: "2024-09", text: "🎵 Song Requests — Spotify integration with chat commands" },
          ].map((u, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
              <span className="text-[10px] text-white/30 shrink-0">{u.date}</span>
              <span className="text-xs text-white/60">{u.text}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

export default Dashboard;
