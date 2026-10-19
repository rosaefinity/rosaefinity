import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";
import { useAuthStore } from "../../store/auth-store";
import { useLicenseStore } from "../../store/license-store";
import { useAppVersion } from "../../hooks/use-app-version";
import { RosaeFinityLogo } from "../branding/RosaeFinityLogo";
import {
  LayoutDashboard, Settings, Zap, Bell, Volume2,
  Monitor, Camera, MessageSquare, Music,
  Folder, Download, CreditCard,
  Shield, LogOut, Users
} from "lucide-react";

const SIDEBAR_ITEMS = [
  { id: "dashboard", label: "Start",   icon: LayoutDashboard, path: "/" },
  { id: "settings",  label: "Setup",   icon: Settings,        path: "/settings" },
  { id: "payment",   label: "Upgrade", icon: CreditCard,      path: "/payment" },
  { id: "actions",   label: "Actions", icon: Zap,             path: "/actions" },
  { id: "alerts",    label: "Alerts",  icon: Bell,            path: "/alerts" },
  { id: "sounds",    label: "Sounds",  icon: Volume2,         path: "/sounds" },
  { id: "media",     label: "Media",   icon: Folder,          path: "/media" },
  { id: "divider",   label: "", icon: undefined, path: "", divider: true },
  { id: "overlays",  label: "Overlays", icon: Monitor,         path: "/overlays" },
  { id: "capture",   label: "Capture", icon: Camera,          path: "/capture" },
  { id: "chat",      label: "Chat",    icon: MessageSquare,   path: "/chat" },
  { id: "song",      label: "Song",    icon: Music,           path: "/song" },
  { id: "divider2",  label: "", icon: undefined, path: "", divider: true },
  { id: "update",     label: "Updates",    icon: Download,   path: "/update" },
  { id: "divider3",   label: "", icon: undefined, path: "", divider: true },
  { id: "admin-users", label: "Users", icon: Users, path: "/admin/users", adminOnly: true },
  { id: "admin-payments", label: "Payments", icon: CreditCard, path: "/admin/payments", adminOnly: true },
];

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, hasRole } = useAuthStore();
  const { plan, isInitialized, expiresAt, isProActive } = useLicenseStore();
  const isAdmin = hasRole('admin');

  // Reactive expiration: re-render when subscription expires mid-session
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (plan !== 'pro' || !expiresAt) return;
    const msUntilExpiry = expiresAt - Date.now();
    if (msUntilExpiry <= 0) { setNow(Date.now()); return; }
    const timer = setTimeout(() => setNow(Date.now()), msUntilExpiry + 1000);
    return () => clearTimeout(timer);
  }, [plan, expiresAt]);

  // Use centralized helper for Pro status
  const showUpgrade = !isProActive();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <aside className="w-[220px] h-screen bg-sidebar border-r border-white/[0.04] flex flex-col shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-20 shrink-0 border-b border-white/[0.04]">
        <div className="shrink-0">
          <RosaeFinityLogo className="w-14 h-14" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="text-lg font-extrabold tracking-tight">
            <span className="bg-gradient-to-r from-primary-light via-secondary-light to-accent bg-clip-text text-transparent">Rosae</span>
            <span className="text-white">Finity</span>
          </span>
          <span className="text-[9px] text-white/20 tracking-[0.15em] uppercase -mt-0.5">Stream Companion</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 min-h-0 px-3 py-3 space-y-0.5 overflow-y-auto scrollbar-thin">
        {SIDEBAR_ITEMS
          .filter(item => !(item as any).adminOnly || isAdmin)
          .filter(item => item.id !== 'payment' || showUpgrade)
          .map((item, index) => {
          if (item.divider) {
            return <div key={`divider-${index}`} className="h-px bg-white/[0.06] mx-2 my-3" />;
          }
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <motion.button
              key={item.id}
              onClick={() => navigate(item.path)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02, duration: 0.3 }}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2.5 rounded-xl w-full transition-all duration-200 group text-left",
                isActive
                  ? "text-white font-medium"
                  : "text-white/40 hover:text-white/80 hover:bg-white/[0.04]"
              )}
            >
              {isActive && (
                <>
                  <motion.div layoutId="activeMenu" className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/20 to-transparent border border-primary/20" transition={{ type: "spring", stiffness: 380, damping: 30 }} />
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-primary shadow-[0_0_8px_rgba(124,58,237,0.6)]" />
                </>
              )}
              <div className="relative z-10 flex items-center justify-center w-6">
                {Icon && <Icon className="w-[18px] h-[18px] shrink-0" />}
              </div>
              <span className="relative z-10 text-sm truncate">{item.label}</span>
              {!isActive && (
                <div className="ml-auto relative z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-1 h-1 rounded-full bg-white/20" />
                </div>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.04] px-4 py-3 shrink-0 space-y-3">
        {/* User Info */}
        {user && (
          <div className="space-y-1">
            <div className="text-sm font-medium text-white/80 truncate">{user.name || "User"}</div>
            <div className="text-xs text-white/40 truncate">{user.email}</div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-white/30" />
              <span className="text-xs text-white/40 capitalize">{plan || "free"}</span>
            </div>
          </div>
        )}

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm text-white/40 hover:text-red-400 hover:bg-red-400/10 transition-all"
        >
          <LogOut className="w-4 h-4" />
          <span>Logout</span>
        </button>

        {/* Version */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.5)]" />
          <span className="text-xs text-white/30">v{useAppVersion()}</span>
        </div>
      </div>
    </aside>
  );
}
