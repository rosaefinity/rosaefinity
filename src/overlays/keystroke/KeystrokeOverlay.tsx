import { useState, useEffect, useCallback, useRef } from "react";

interface KeystrokeState {
  keys: string[];
  mouseButtons: number[];
  event: string;
  key?: string;
  code?: string;
  button?: number;
  deltaY?: number;
  timestamp: number;
}

interface KeystrokeOverlayProps {
  screen?: string;
  opacity?: number;
  scale?: number;
  animation?: string;
  duration?: number;
  showKeyNames?: boolean;
  showMouseIndicator?: boolean;
  position?: "bottom-left" | "bottom-center" | "bottom-right" | "top-left" | "top-center" | "top-right";
}

const MOUSE_BUTTON_LABELS: Record<number, string> = {
  0: "LMB",
  1: "MMB",
  2: "RMB",
};

const POSITION_CLASSES: Record<string, string> = {
  "bottom-left": "bottom-4 left-4",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-4 right-4",
  "top-left": "top-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "top-right": "top-4 right-4",
};

export function KeystrokeOverlay({
  screen = "1",
  opacity = 85,
  scale = 100,
  animation = "fade",
  duration = 5,
  showKeyNames = true,
  showMouseIndicator = true,
  position = "bottom-center",
}: KeystrokeOverlayProps) {
  const [state, setState] = useState<KeystrokeState | null>(null);
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState<"in" | "out" | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEventRef = useRef<number>(0);

  const handleOverlayEvent = useCallback((e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (!detail || detail.type !== "keystroke") return;
    if (detail.screen && detail.screen !== screen) return;
    // Accept both live capture and action-triggered events
    if (detail.source !== "keyboard-capture" && detail.source !== "action-trigger") return;

    const now = Date.now();
    lastEventRef.current = now;

    const newState: KeystrokeState = {
      keys: detail.keys || [],
      mouseButtons: detail.mouseButtons || [],
      event: detail.event,
      key: detail.key,
      code: detail.code,
      button: detail.button,
      deltaY: detail.deltaY,
      timestamp: now,
    };

    setState(newState);

    // Use custom duration from action-triggered events
    const eventDuration = detail.duration || duration;

    // Show overlay
    if (!visible) {
      setVisible(true);
      setAnimating("in");
      setTimeout(() => setAnimating(null), 300);
    }

    // Reset hide timer
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (lastEventRef.current === now) {
        setAnimating("out");
        setTimeout(() => {
          setVisible(false);
          setAnimating(null);
          setState(null);
        }, 300);
      }
    }, eventDuration * 1000);
  }, [screen, visible, duration]);

  useEffect(() => {
    window.addEventListener("rosae:overlay-event", handleOverlayEvent);
    return () => {
      window.removeEventListener("rosae:overlay-event", handleOverlayEvent);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [handleOverlayEvent]);

  if (!visible || !state) return null;

  const activeKeys = state.keys.filter(k => k !== "Control" && k !== "Shift" && k !== "Alt" && k !== "Meta");
  const modifiers = state.keys.filter(k => ["Control", "Shift", "Alt", "Meta"].includes(k));
  const mouseButtons = state.mouseButtons;

  const hasContent = activeKeys.length > 0 || mouseButtons.length > 0 || state.event === "mouse-wheel";
  if (!hasContent) return null;

  const animClass = animating === "in"
    ? "animate-[keystroke-in_0.3s_ease-out]"
    : animating === "out"
    ? "animate-[keystroke-out_0.3s_ease-in]"
    : "";

  return (
    <div
      className={`fixed ${POSITION_CLASSES[position]} z-[9999] pointer-events-none ${animClass}`}
      style={{
        opacity: opacity / 100,
        transform: `scale(${scale / 100})`,
      }}
    >
      <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/10 shadow-2xl">
        {/* Modifiers */}
        {modifiers.length > 0 && (
          <div className="flex items-center gap-0.5">
            {modifiers.map((mod, i) => (
              <span key={`mod-${i}`} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/30 text-primary-light border border-primary/40">
                {mod === "Control" ? "Ctrl" : mod === "Meta" ? "Win" : mod}
              </span>
            ))}
            <span className="text-white/20 text-[10px] mx-0.5">+</span>
          </div>
        )}

        {/* Active Keys */}
        {showKeyNames && activeKeys.map((key, i) => (
          <span key={`key-${i}`} className="px-2 py-0.5 rounded text-xs font-bold bg-white/10 text-white border border-white/20 animate-[key-press_0.15s_ease-out]">
            {key}
          </span>
        ))}

        {/* Mouse Buttons */}
        {showMouseIndicator && mouseButtons.length > 0 && (
          <div className="flex items-center gap-0.5 ml-1">
            {mouseButtons.map((btn) => (
              <span key={`mouse-${btn}`} className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-secondary/30 text-secondary-light border border-secondary/40">
                {MOUSE_BUTTON_LABELS[btn] || `M${btn}`}
              </span>
            ))}
          </div>
        )}

        {/* Mouse Wheel */}
        {state.event === "mouse-wheel" && state.deltaY !== undefined && (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/30 text-accent border border-accent/40">
            {state.deltaY < 0 ? "_wheel↑" : "_wheel↓"}
          </span>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes keystroke-in {
          from { opacity: 0; transform: translateY(10px) scale(${scale / 100 * 0.9}); }
          to { opacity: ${opacity / 100}; transform: translateY(0) scale(${scale / 100}); }
        }
        @keyframes keystroke-out {
          from { opacity: ${opacity / 100}; transform: translateY(0) scale(${scale / 100}); }
          to { opacity: 0; transform: translateY(10px) scale(${scale / 100 * 0.9}); }
        }
        @keyframes key-press {
          0% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
