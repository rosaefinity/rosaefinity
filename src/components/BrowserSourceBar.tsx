import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./ui/button";
import { cn } from "../lib/utils";
import { getSSEBaseUrl, getOverlayWidgetUrl } from "../lib/browser-source-url";
import {
  Copy, ExternalLink, RotateCcw, CheckCircle2, Monitor
} from "lucide-react";

interface BrowserSourceBarProps {
  /** The browser source ID from overlay instance */
  browserSourceId: string;
  /** Display label */
  label?: string;
  /** Port for the SSE server */
  port?: number;
  /** Optional screen number for overlay-widget.html */
  screen?: string | number;
}

export function BrowserSourceBar({ browserSourceId, label, port, screen }: BrowserSourceBarProps) {
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Use the centralized URL helper
  const overlayWidgetUrl = getOverlayWidgetUrl(screen);
  const browserSourceUrl = `${getSSEBaseUrl()}/overlay/${browserSourceId}`;

  const urls = [
    { host: "Overlay Widget", url: overlayWidgetUrl },
    { host: "Browser Source", url: browserSourceUrl },
  ];

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-white/[0.06] bg-card p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Monitor className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-semibold text-white/70">
            {label || `Overlay: ${browserSourceId}`}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setShowPreview(!showPreview)}
            className="gap-1 text-[10px] h-7 px-2">
            <ExternalLink className="w-3 h-3" /> {showPreview ? "Hide" : "Preview"}
          </Button>
          <Button variant="ghost" size="sm"
            onClick={() => window.location.reload()}
            className="gap-1 text-[10px] h-7 px-2">
            <RotateCcw className="w-3 h-3" /> Refresh
          </Button>
        </div>
      </div>

      <div className="space-y-1.5">
        {urls.map(({ host, url }) => (
          <div key={host} className="flex items-center gap-2">
            <code className={cn(
              "flex-1 text-[11px] px-2.5 py-1.5 rounded-lg border truncate font-mono select-all",
              "text-white/80 bg-white/[0.03] border-white/[0.06]"
            )} title={`${host} URL`}>
              {url}
            </code>
            <button onClick={() => copyUrl(url)}
              className="shrink-0 px-2 py-1 text-[10px] rounded-lg bg-white/[0.04] hover:bg-accent/20 hover:text-accent text-white/50 transition-all font-medium"
              title={`Copy ${host} URL`}>
              {copied ? <CheckCircle2 className="w-3 h-3 text-green" /> : "📋"}
            </button>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {showPreview && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }} className="mt-2 overflow-hidden">
            <iframe
              src={overlayWidgetUrl}
              className="w-full h-48 rounded-lg border border-white/[0.08] bg-black"
              title={`Overlay Preview: ${label || browserSourceId}`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
