import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Music, Video, Image, Keyboard, Monitor } from "lucide-react";

interface TestNotificationData {
  actionName: string;
  screen: string;
  duration: number;
  effects: string[];
}

let showTestNotificationFn: ((data: TestNotificationData) => void) | null = null;

/**
 * Call this to show a test notification from anywhere in the app.
 * Only fires during manual test â€” NOT during live TikTok events.
 */
export function showTestNotification(data: TestNotificationData) {
  if (showTestNotificationFn) showTestNotificationFn(data);
}

const EFFECT_ICONS: Record<string, typeof Music> = {
  Sound: Music,
  Video: Video,
  Image: Image,
  Keystroke: Keyboard,
  Minecraft: Monitor,
};

export function TestNotification() {
  const [notification, setNotification] = useState<TestNotificationData | null>(null);
  const [visible, setVisible] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => setNotification(null), 300);
  }, []);

  useEffect(() => {
    showTestNotificationFn = (data) => {
      setNotification(data);
      setVisible(true);
      setTimeout(dismiss, 4000);
    };
    return () => { showTestNotificationFn = null; };
  }, [dismiss]);

  return (
    <div className="fixed top-4 right-4 z-[10000] pointer-events-none">
      <AnimatePresence>
        {visible && notification && (
          <motion.div
            initial={{ opacity: 0, x: 100, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 100, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="pointer-events-auto w-80 rounded-2xl bg-[#1a1a24] border border-white/[0.08] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-success/15 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-success" />
                </div>
                <span className="text-sm font-semibold text-white">Test Successful</span>
              </div>
              <button onClick={dismiss} className="w-6 h-6 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/[0.06] transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3 space-y-2.5">
              {/* Action */}
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-white/30 uppercase tracking-wider w-16 shrink-0 pt-0.5">Action</span>
                <span className="text-sm text-white/80 font-medium">{notification.actionName}</span>
              </div>

              {/* Screen */}
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-white/30 uppercase tracking-wider w-16 shrink-0 pt-0.5">Screen</span>
                <span className="text-sm text-white/60">{notification.screen}</span>
              </div>

              {/* Effects */}
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-white/30 uppercase tracking-wider w-16 shrink-0 pt-0.5">Effects</span>
                <div className="flex flex-wrap gap-1.5">
                  {notification.effects.map((effect) => {
                    const Icon = EFFECT_ICONS[effect];
                    return (
                      <span key={effect} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-[10px] text-white/60">
                        {Icon && <Icon className="w-3 h-3" />}
                        {effect}
                      </span>
                    );
                  })}
                </div>
              </div>

              {/* Duration */}
              <div className="flex items-start gap-2">
                <span className="text-[10px] text-white/30 uppercase tracking-wider w-16 shrink-0 pt-0.5">Duration</span>
                <span className="text-sm text-white/60">{notification.duration}s</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="h-0.5 bg-white/[0.04]">
              <motion.div
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 4, ease: "linear" }}
                className="h-full bg-success/40"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
