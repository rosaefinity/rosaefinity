import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { api } from "../services/electron-service";
import { Button } from "../components/ui/button";
import {
  Camera, RefreshCw, Play, Square, Volume2, VolumeX,
  Monitor, WifiOff, AlertTriangle, Maximize2
} from "lucide-react";
import type { CaptureSource } from "../types";

export function CapturePage() {
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [volume, setVolume] = useState(0.8);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: 0, height: 0 });
  const [audioTrackCount, setAudioTrackCount] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // ── Load sources on mount ──
  useEffect(() => {
    refreshSources();
    return () => { stopCapture(); };
  }, []);

  async function refreshSources() {
    setIsLoading(true);
    setError(null);
    try {
      const a = api();
      if (!a) throw new Error("Electron API not available — run with electron:dev");
      const result = await a.getCaptureSources();
      setSources(result);
      if (result.length > 0 && !selectedSourceId) {
        setSelectedSourceId(result[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sources");
    } finally {
      setIsLoading(false);
    }
  }

  // ── Start capture ──
  const startCapture = useCallback(async () => {
    if (!selectedSourceId) return;
    const a = api();
    if (!a) return;

    try {
      setError(null);
      setAudioTrackCount(0);

      // Tell main process which source to auto-approve via setDisplayMediaRequestHandler
      await a.setCaptureSource(selectedSourceId);

      // Use getDisplayMedia — triggers setDisplayMediaRequestHandler which auto-approves
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: true,
        audio: audioEnabled,
      });

      streamRef.current = stream;

      // Log track info for debugging
      const vTracks = stream.getVideoTracks();
      const aTracks = stream.getAudioTracks();
      console.log(`[Capture] Video tracks: ${vTracks.length}, Audio tracks: ${aTracks.length}`);
      if (vTracks.length > 0) {
        const settings = vTracks[0].getSettings();
        console.log(`[Capture] Video: ${settings.width}x${settings.height}, fps: ${settings.frameRate}`);
      }
      setAudioTrackCount(aTracks.length);

      // Attach video to preview element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }

      // Attach audio to the audio element — must be done in the same call stack as user gesture
      if (audioRef.current && aTracks.length > 0) {
        const audioStream = new MediaStream(aTracks);
        audioRef.current.srcObject = audioStream;
        audioRef.current.volume = volume;
        audioRef.current.muted = false;
        const playPromise = audioRef.current.play();
        if (playPromise) {
          playPromise.catch(() => {
            // Autoplay blocked — try muted then unmute
            if (audioRef.current) {
              audioRef.current.muted = true;
              audioRef.current.play().then(() => {
                setTimeout(() => {
                  if (audioRef.current) {
                    audioRef.current.muted = false;
                    audioRef.current.volume = volume;
                  }
                }, 200);
              }).catch(() => {});
            }
          });
        }
      }

      // Track ended — source closed
      stream.getTracks().forEach((track: MediaStreamTrack) => {
        track.onended = () => {
          const allEnded = stream.getTracks().every((t: MediaStreamTrack) => t.readyState === "ended");
          if (allEnded) {
            setIsCapturing(false);
            setError("Capture source was closed or became unavailable");
          }
        };
      });

      setIsCapturing(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start capture");
      stopCapture();
    }
  }, [selectedSourceId, audioEnabled, volume]);

  // ── Stop capture ──
  function stopCapture() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setIsCapturing(false);
    setAudioTrackCount(0);
  }

  // ── Volume sync ──
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // ── Video metadata → preview size ──
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onMeta = () => {
      setPreviewSize({ width: video.videoWidth, height: video.videoHeight });
    };
    video.addEventListener("loadedmetadata", onMeta);
    return () => video.removeEventListener("loadedmetadata", onMeta);
  }, [isCapturing]);

  const selectedSource = sources.find((s) => s.id === selectedSourceId);

  return (
    <div className="p-6 h-full overflow-y-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Camera className="w-5 h-5 text-primary-light" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Screen Capture</h1>
              <p className="text-xs text-white/40">Capture any window or screen for streaming</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium px-3 py-1.5 rounded-lg border ${
              isCapturing
                ? "text-green border-green/30 bg-green/10"
                : "text-white/40 border-white/[0.06] bg-white/[0.02]"
            }`}>
              {isCapturing ? "● Capturing" : "○ Idle"}
            </span>
          </div>
        </div>
      </motion.div>

      <div className="flex gap-6">
        {/* Left: Source selector + Controls */}
        <div className="w-80 shrink-0 space-y-4">
          {/* Sources card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="rounded-2xl border border-white/[0.06] bg-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-white">Sources</h3>
              <Button variant="ghost" size="sm" onClick={refreshSources} disabled={isLoading} className="gap-1">
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {sources.length === 0 && !isLoading && (
              <div className="text-center py-6">
                <WifiOff className="w-8 h-8 text-white/20 mx-auto mb-2" />
                <p className="text-xs text-white/40">No sources found</p>
                <Button variant="ghost" size="sm" onClick={refreshSources} className="mt-2">
                  Try again
                </Button>
              </div>
            )}

            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-thin">
              {sources.map((source) => (
                <button
                  key={source.id}
                  onClick={() => { if (!isCapturing) setSelectedSourceId(source.id); }}
                  className={`w-full flex items-center gap-3 p-2 rounded-xl text-left transition-all ${
                    selectedSourceId === source.id
                      ? "bg-primary/20 border border-primary/30"
                      : "bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"
                  }`}
                >
                  <img src={source.thumbnailDataURL} alt={source.name}
                    className="w-20 h-12 rounded-lg object-cover bg-white/[0.04]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{source.name}</p>
                    <p className="text-[10px] text-white/30">
                      {source.id.startsWith("screen:") ? "🖥️ Screen" : "🪟 Window"}
                    </p>
                  </div>
                  {selectedSourceId === source.id && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </motion.div>

          {/* Controls card */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl border border-white/[0.06] bg-card p-4 space-y-4">
            <h3 className="text-sm font-semibold text-white">Controls</h3>

            {/* Start/Stop */}
            <div className="flex gap-2">
              {!isCapturing ? (
                <Button onClick={startCapture} disabled={!selectedSourceId || isLoading} className="flex-1 gap-2">
                  <Play className="w-4 h-4" /> Start Capture
                </Button>
              ) : (
                <Button onClick={stopCapture} variant="danger" className="flex-1 gap-2">
                  <Square className="w-4 h-4" /> Stop Capture
                </Button>
              )}
            </div>

            {/* Audio toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {audioEnabled ? (
                  <Volume2 className="w-4 h-4 text-white/50" />
                ) : (
                  <VolumeX className="w-4 h-4 text-white/30" />
                )}
                <span className="text-xs text-white/60">System Audio</span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={audioEnabled}
                  onChange={(e) => setAudioEnabled(e.target.checked)}
                  className="sr-only peer" disabled={isCapturing} />
                <div className="w-9 h-5 bg-white/[0.08] peer-focus:outline-none rounded-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
              </label>
            </div>

            {/* Volume */}
            {audioEnabled && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-white/40">Volume</span>
                  <span className="text-xs text-white/40">{Math.round(volume * 100)}%</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="w-full h-1.5 accent-primary" />
              </div>
            )}

            {/* Source info */}
            {selectedSource && (
              <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-1">
                <p className="text-xs text-white/40">Selected</p>
                <p className="text-xs text-white font-medium truncate">{selectedSource.name}</p>
                {previewSize.width > 0 && (
                  <p className="text-[10px] text-white/30">{previewSize.width} × {previewSize.height}</p>
                )}
                {isCapturing && (
                  <p className="text-[10px] text-white/30">
                    Audio tracks: {audioTrackCount}
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-red/10 border border-red/20 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red shrink-0 mt-0.5" />
                <p className="text-xs text-red/80">{error}</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Right: Preview */}
        <div className="flex-1 flex flex-col items-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl border border-white/[0.06] bg-card p-6 flex flex-col items-center w-full">
            <div className="flex items-center justify-between w-full mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Monitor className="w-4 h-4 text-white/50" /> Preview
              </h3>
              {isCapturing && (
                <span className="flex items-center gap-1.5 text-xs text-green">
                  <span className="w-2 h-2 rounded-full bg-green animate-pulse" />
                  Live
                </span>
              )}
            </div>

            {/* 9:16 Portrait Preview — fills the entire canvas like TikTok LIVE Studio */}
            <div className="relative w-full flex justify-center">
              <div
                className="relative overflow-hidden bg-black rounded-xl shadow-2xl border border-white/[0.08]"
                style={{
                  width: "100%",
                  maxWidth: "min(100%, calc(100vh - 200px) * 9 / 16)",
                  aspectRatio: "9/16",
                }}
              >
                {/* Video fills the entire container — object-fit: cover matches TikTok LIVE Studio */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />

                {/* Placeholder */}
                {!isCapturing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                    <Camera className="w-16 h-16 text-white/10 mb-3" />
                    <p className="text-sm text-white/30">
                      {selectedSource ? "Click Start Capture" : "Select a source"}
                    </p>
                    {selectedSource && (
                      <p className="text-xs text-white/15 mt-1 max-w-[200px] text-center truncate">
                        {selectedSource.name}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Audio element — plays captured system audio through the main app window */}
            <audio ref={audioRef} />

            {/* Status badges */}
            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Maximize2 className="w-3 h-3 text-white/30" />
                <span className="text-[10px] text-white/20">9:16 Portrait • cover</span>
              </div>
              {isCapturing && audioTrackCount > 0 && (
                <div className="flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-green" />
                  <span className="text-[10px] text-green/80">Audio active</span>
                </div>
              )}
              {isCapturing && audioTrackCount === 0 && audioEnabled && (
                <div className="flex items-center gap-1">
                  <VolumeX className="w-3 h-3 text-yellow-400" />
                  <span className="text-[10px] text-yellow-400/80">No audio tracks</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Tips */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl border border-white/[0.06] bg-card p-4 mt-4 w-full max-w-lg">
            <h3 className="text-sm font-semibold text-white mb-2">💡 Tips</h3>
            <ul className="space-y-1.5 text-xs text-white/40">
              <li>• Select any window or screen from the source list</li>
              <li>• Video fills the 9:16 portrait canvas with object-fit: cover</li>
              <li>• Enable "System Audio" to capture application sound</li>
              <li>• Audio plays through the main app window (not Browser Source)</li>
              <li>• Close the captured window to auto-stop the stream</li>
            </ul>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

export default CapturePage;
