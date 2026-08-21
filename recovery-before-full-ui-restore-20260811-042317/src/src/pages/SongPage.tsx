import { useState } from "react";
import { motion } from "framer-motion";
import { useAppStore } from "../store/app-store";
import { api } from "../services/electron-service";
import { Button } from "../components/ui/button";

export function SongPage() {
  const { spotifyConnected, spotifyNowPlaying, spotifyQueue, setSpotifyConnected, setSpotifyNowPlaying, setSpotifyQueue, setupConfig } = useAppStore();
  const [connecting, setConnecting] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);

  const connectSpotify = async () => {
    setConnecting(true);
    const a = api();
    if (a) {
      try {
        // Check if already authenticated
        const status = await a.spotifyStatus();
        if (status?.authenticated) {
          setSpotifyConnected(true);
          // Get current playback
          const pb = await a.spotifyPlayback();
          if (pb?.name) {
            setSpotifyNowPlaying({
              name: pb.name, artist: pb.artist, albumArt: pb.albumArt || "",
              progressMs: pb.progressMs || 0, durationMs: pb.durationMs || 0, isPlaying: pb.isPlaying || false,
            });
          }
          // Get queue
          const q = await a.spotifyQueue();
          if (q?.queue) setSpotifyQueue(q.queue);
          setConnecting(false);
          return;
        }
        // Start OAuth flow
        const result = await a.spotifyAuth({ clientId: setupConfig.spotifyClientId });
        if (result?.success) {
          setSpotifyConnected(true);
          const pb = await a.spotifyPlayback();
          if (pb?.name) {
            setSpotifyNowPlaying({
              name: pb.name, artist: pb.artist, albumArt: pb.albumArt || "",
              progressMs: pb.progressMs || 0, durationMs: pb.durationMs || 0, isPlaying: pb.isPlaying || false,
            });
          }
        }
      } catch (e) {
        console.error("Spotify connect error:", e);
      }
    } else {
      // Browser fallback — mock
      await new Promise(r => setTimeout(r, 1500));
      setSpotifyConnected(true);
      setSpotifyNowPlaying({
        name: "Blinding Lights", artist: "The Weeknd",
        albumArt: "https://i.scdn.co/image/ab67616d0000b2738863bc11d2aa12b54f5aeb36",
        progressMs: 120000, durationMs: 200000, isPlaying: true,
      });
    }
    setConnecting(false);
  };

  const handleSkip = async () => {
    const a = api();
    if (a) {
      await a.spotifySkip();
      // Refresh playback
      const pb = await a.spotifyPlayback();
      if (pb?.name) {
        setSpotifyNowPlaying({
          name: pb.name, artist: pb.artist, albumArt: pb.albumArt || "",
          progressMs: pb.progressMs || 0, durationMs: pb.durationMs || 0, isPlaying: pb.isPlaying || false,
        });
      }
    }
  };

  const handleTestPlay = () => {
    setTesting("play");
    const store = useAppStore.getState();
    store.addScreenLiveEvent("screen-0", {
      type: "comment", screenId: "screen-0", user: "testuser", comment: "!play Blinding Lights - The Weeknd", timestamp: Date.now(),
    });
    setTimeout(() => setTesting(null), 1000);
  };

  const handleTestSkip = async () => {
    setTesting("skip");
    const a = api();
    if (a) await a.spotifySkip();
    setTimeout(() => setTesting(null), 1000);
  };

  const handleTestRevoke = () => {
    setTesting("revoke");
    useAppStore.getState().addScreenLiveEvent("screen-0", {
      type: "comment", screenId: "screen-0", user: "testuser", comment: "!revoke", timestamp: Date.now(),
    });
    setTimeout(() => setTesting(null), 1000);
  };

  return (
    <div className="p-6 h-full overflow-y-auto space-y-6">

      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/[0.06] bg-card p-6">
        <h1 className="text-xl font-bold text-white">🎵 Spotify Song Requests</h1>
        <p className="text-sm text-white/50 mt-2 leading-relaxed">
          With this feature your viewers can request and skip songs on Spotify!<br />
          Simply play your favorite playlist and your viewers can interact with it.<br />
          The requested songs will be added to your Spotify playback queue!
        </p>
      </motion.div>

      {/* Commands */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="rounded-2xl border border-white/[0.06] bg-card p-4">
        <h4 className="text-sm font-semibold text-white mb-3">📋 Commands</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-3 text-sm">
            <code className="px-2 py-1 rounded bg-white/[0.04] text-accent font-mono text-xs">!play [Song - Artist]</code>
            <span className="text-white/50">Add song to queue</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <code className="px-2 py-1 rounded bg-white/[0.04] text-accent font-mono text-xs">!revoke</code>
            <span className="text-white/50">Revoke requested song from queue</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <code className="px-2 py-1 rounded bg-white/[0.04] text-accent font-mono text-xs">!skip</code>
            <span className="text-white/50">Skip current track</span>
          </div>
        </div>
      </motion.div>

      {/* Connect Card */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="rounded-2xl border border-white/[0.06] bg-card p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-4xl">🎵</div>
            <div>
              <h3 className="text-sm font-bold text-white">Spotify Account Connection</h3>
              <p className="text-xs text-white/40 mt-0.5">First, you need to connect your Spotify account.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium ${spotifyConnected ? "text-green" : "text-yellow-400"}`}>
              {spotifyConnected ? "✅ Connected" : "State: Disconnected"}
            </span>
            <Button onClick={connectSpotify} disabled={connecting || spotifyConnected} variant={spotifyConnected ? "secondary" : "default"} className="gap-2">
              {connecting ? "⏳..." : spotifyConnected ? "✓ Connected" : "🔗 Connect Spotify"}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Now Playing */}
      {spotifyNowPlaying && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="rounded-2xl border border-white/[0.06] bg-card p-4">
          <h3 className="text-sm font-semibold text-white mb-3">🎧 Now Playing</h3>
          <div className="flex items-center gap-4">
            <img src={spotifyNowPlaying.albumArt} alt="" className="w-16 h-16 rounded-xl object-cover" />
            <div className="flex-1">
              <p className="font-semibold text-white">{spotifyNowPlaying.name}</p>
              <p className="text-sm text-white/50">{spotifyNowPlaying.artist}</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${(spotifyNowPlaying.progressMs / spotifyNowPlaying.durationMs) * 100}%` }} />
                </div>
                <span className="text-xs text-white/40">
                  {Math.floor(spotifyNowPlaying.progressMs / 60000)}:{String(Math.floor((spotifyNowPlaying.progressMs % 60000) / 1000)).padStart(2, '0')} / {Math.floor(spotifyNowPlaying.durationMs / 60000)}:{String(Math.floor((spotifyNowPlaying.durationMs % 60000) / 1000)).padStart(2, '0')}
                </span>
              </div>
            </div>
            <Button variant="secondary" size="sm" onClick={handleSkip}>⏭ Skip</Button>
          </div>
        </motion.div>
      )}

      {/* Testing Area */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="rounded-2xl border border-white/[0.06] bg-card p-4">
        <h3 className="text-sm font-semibold text-white mb-3">🧪 Testing Area</h3>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleTestPlay} disabled={testing === "play"}>
            {testing === "play" ? "⏳..." : "Test !play"}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleTestSkip} disabled={testing === "skip"}>
            {testing === "skip" ? "⏳..." : "Test !skip"}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleTestRevoke} disabled={testing === "revoke"}>
            {testing === "revoke" ? "⏳..." : "Test !revoke"}
          </Button>
        </div>
      </motion.div>

      {/* Queue */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
        className="rounded-2xl border border-white/[0.06] bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">📋 Request Queue</h3>
          <span className="text-xs text-white/40">{spotifyQueue.length}/5</span>
        </div>
        {spotifyQueue.length === 0 ? (
          <p className="text-sm text-white/30 text-center py-4">🔗 Connect Spotify to get started</p>
        ) : (
          <div className="space-y-2">
            {spotifyQueue.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.02]">
                <span className="text-xs text-white/30">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{entry.track.name}</p>
                  <p className="text-xs text-white/40">{entry.track.artist} • by @{entry.user}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.div>

    </div>
  );
}
