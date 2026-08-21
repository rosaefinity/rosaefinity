import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../store/auth-store";
import { useNavigate } from "react-router-dom";
import {
  Search, Bell, MessageCircle, BookOpen, ChevronDown,
  Crown, LogOut, User, Settings, Wifi, WifiOff
} from "lucide-react";
import { getSSEConnectionState } from "../../lib/overlay-bus";

const notifications = [
  { id: "1", title: "New overlay available", message: "World Cup Bracket is now available", type: "info" as const, time: "1h ago", read: false },
  { id: "2", title: "Pro trial ending", message: "Your trial expires in 3 days", type: "warning" as const, time: "2h ago", read: false },
  { id: "3", title: "Overlay published", message: "Gift Rain Deluxe is now live", type: "success" as const, time: "1d ago", read: true },
];

export function Header() {
  const [searchFocused, setSearchFocused] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sseStatus, setSseStatus] = useState(getSSEConnectionState);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setSseStatus({ connected: detail.connected, retryCount: detail.retryCount });
    };
    window.addEventListener("rosae:sse-state", handler);
    return () => window.removeEventListener("rosae:sse-state", handler);
  }, []);

  return (
    <header className="h-16 bg-background/80 backdrop-blur-xl border-b border-white/[0.04] flex items-center justify-between px-6 shrink-0 relative z-20">
      {/* Left */}
      <div className="flex items-center gap-4">
        <div className={cn("relative flex items-center transition-all duration-300", searchFocused ? "w-80" : "w-64")}>
          <Search className={cn("absolute left-3 w-4 h-4 transition-colors", searchFocused ? "text-primary" : "text-white/30")} />
          <input
            type="text" placeholder="Search overlays..."
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full h-9 pl-9 pr-3 rounded-xl bg-white/[0.04] border text-sm text-white/80 placeholder:text-white/20 outline-none transition-all duration-200"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        {/* SSE Relay Status */}
        <div
          className={cn(
            "flex items-center gap-1.5 px-2.5 h-8 rounded-lg text-xs font-medium transition-all",
            sseStatus.connected
              ? "bg-success/10 text-success"
              : "bg-danger/10 text-danger"
          )}
          title={sseStatus.connected ? "OBS overlay relay connected" : "OBS overlay relay disconnected — check SSE server on port 18890"}
        >
          {sseStatus.connected ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          <span className="hidden sm:inline">
            {sseStatus.connected ? "Overlay" : "Overlay Offline"}
          </span>
        </div>

        {/* Notifications */}
        <div className="relative">
          <button onClick={() => setShowNotif(!showNotif)} className="relative w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition-all">
            <Bell className="w-[18px] h-[18px]" />
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-danger shadow-[0_0_6px_rgba(239,68,68,0.6)]" />
          </button>
          <AnimatePresence>
            {showNotif && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 top-full mt-2 w-80 rounded-2xl bg-[#1a1a24] border border-white/[0.08] shadow-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Notifications</h3>
                    <button className="text-xs text-primary hover:text-primary-light">Mark all read</button>
                  </div>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.map((n) => (
                    <button key={n.id} className={cn("w-full px-4 py-3 text-left hover:bg-white/[0.03] transition-colors border-b border-white/[0.03] last:border-0", !n.read && "bg-primary/[0.03]")}>
                      <div className="flex items-start gap-3">
                        <div className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", n.type === "warning" && "bg-warning", n.type === "success" && "bg-success", n.type === "info" && "bg-accent")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white/90 truncate">{n.title}</p>
                          <p className="text-xs text-white/40">{n.message}</p>
                          <p className="text-[10px] text-white/20 mt-1">{n.time}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Discord */}
        <a href="#" className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-accent hover:bg-accent/[0.06] transition-all">
          <MessageCircle className="w-[18px] h-[18px]" />
        </a>
        {/* Docs */}
        <a href="#" className="w-9 h-9 rounded-xl flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-white/[0.04] transition-all">
          <BookOpen className="w-[18px] h-[18px]" />
        </a>

        {/* Upgrade Pro */}
        <button onClick={() => navigate("/settings#license")} className="hidden sm:flex items-center gap-2 h-9 px-4 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-medium hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-[0.97] cursor-pointer">
          <Crown className="w-4 h-4" /> Upgrade Pro
        </button>

        {/* User */}
        <div className="relative">
          <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center gap-2 pl-2 pr-3 h-9 rounded-xl hover:bg-white/[0.04] transition-all group">
            <div className="relative">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white text-xs font-bold">
                {user?.name?.charAt(0) || "R"}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-background" />
            </div>
            <span className="text-sm font-medium text-white/70 group-hover:text-white/90 transition-colors hidden sm:block">{user?.name || "User"}</span>
            <ChevronDown className="w-3 h-3 text-white/30 hidden sm:block" />
          </button>
          <AnimatePresence>
            {showUserMenu && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="absolute right-0 top-full mt-2 w-48 rounded-2xl bg-[#1a1a24] border border-white/[0.08] shadow-2xl overflow-hidden">
                <div className="p-1">
                  <button className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-all">
                    <User className="w-4 h-4" /> Profile
                  </button>
                  <button className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-white/60 hover:text-white hover:bg-white/[0.04] transition-all">
                    <Settings className="w-4 h-4" /> Settings
                  </button>
                </div>
                <div className="border-t border-white/[0.06] p-1">
                  <button onClick={logout} className="flex items-center gap-3 w-full px-3 py-2 rounded-xl text-sm text-danger/60 hover:text-danger hover:bg-danger/[0.04] transition-all">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
