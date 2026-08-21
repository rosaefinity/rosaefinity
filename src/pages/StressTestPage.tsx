// =============================================
// RosaeFinity — Stress Test Page
// Simulate high event rates for testing.
// =============================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { PageHeader } from '../components/ui/page-header';
import { Button } from '../components/ui/button';
import { ThroughputTracker } from '../lib/perf';
import {
  Zap, Play, Square, Settings, Activity, TrendingUp,
  Gift, Heart, MessageSquare, UserPlus, Share2, Users,
} from 'lucide-react';

interface StressConfig {
  giftRate: number;
  commentRate: number;
  likeRate: number;
  joinRate: number;
  shareRate: number;
  followRate: number;
}

const DEFAULT_CONFIG: StressConfig = {
  giftRate: 10,
  commentRate: 50,
  likeRate: 100,
  joinRate: 20,
  shareRate: 5,
  followRate: 3,
};

const USERNAMES = ['StreamerFan', 'LiveViewer', 'GiftMaster', 'ChatKing', 'ProGamer', 'MusicLover', 'DanceQueen', 'ArtFan', 'CookingPro', 'TechNerd'];
const GIFT_NAMES = ['Rose', 'TikTok', 'Heart', 'Diamond', 'Star', 'Crown', 'Fire', 'Rainbow', 'Unicorn', 'Galaxy'];
const COMMENTS = ['Hello!', 'Nice stream!', 'Love it!', 'GG!', 'Awesome!', 'First!', 'Let\'s go!', 'Wow!', 'Amazing!', 'Cool!'];

export function StressTestPage(): JSX.Element {
  const [config, setConfig] = useState<StressConfig>(DEFAULT_CONFIG);
  const [isRunning, setIsRunning] = useState(false);
  const [stats, setStats] = useState({ total: 0, perSecond: 0, gifts: 0, comments: 0, likes: 0, joins: 0 });
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);
  const trackerRef = useRef(new ThroughputTracker());
  const countersRef = useRef({ gifts: 0, comments: 0, likes: 0, joins: 0 });

  const randomFrom = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

  const generateEvent = useCallback((type: string) => {
    const username = randomFrom(USERNAMES);
    const data: Record<string, unknown> = {
      type,
      userId: `user-${Math.random().toString(36).slice(2, 8)}`,
      username,
      nickname: username,
      screenId: "screen-0",
    };

    switch (type) {
      case 'gift':
        data.giftName = randomFrom(GIFT_NAMES);
        data.giftId = `gift-${Math.floor(Math.random() * 100)}`;
        data.giftCount = Math.floor(Math.random() * 5) + 1;
        data.diamondCount = Math.floor(Math.random() * 100) + 1;
        countersRef.current.gifts++;
        break;
      case 'comment':
        data.comment = randomFrom(COMMENTS);
        countersRef.current.comments++;
        break;
      case 'like':
        data.likeCount = Math.floor(Math.random() * 10) + 1;
        data.totalLikeCount = Math.floor(Math.random() * 1000);
        countersRef.current.likes++;
        break;
      case 'join':
        data.viewerCount = Math.floor(Math.random() * 500) + 100;
        countersRef.current.joins++;
        break;
      case 'share':
        countersRef.current.joins++;
        break;
      case 'follow':
        countersRef.current.joins++;
        break;
    }

    // Use the event-dispatch system (renderer side pipeline)
    const { dispatchTikTokEvent } = require('../store/event-dispatch');
    dispatchTikTokEvent(data);
    trackerRef.current.record();
  }, []);

  const startStressTest = useCallback(() => {
    setIsRunning(true);
    countersRef.current = { gifts: 0, comments: 0, likes: 0, joins: 0 };

    const createInterval = (type: string, rate: number) => {
      if (rate <= 0) return null;
      const intervalMs = 1000 / rate;
      return setInterval(() => generateEvent(type), intervalMs);
    };

    const intervals: ReturnType<typeof setInterval>[] = [];
    if (config.giftRate > 0) intervals.push(createInterval('gift', config.giftRate)!);
    if (config.commentRate > 0) intervals.push(createInterval('comment', config.commentRate)!);
    if (config.likeRate > 0) intervals.push(createInterval('like', config.likeRate)!);
    if (config.joinRate > 0) intervals.push(createInterval('join', config.joinRate)!);
    if (config.shareRate > 0) intervals.push(createInterval('share', config.shareRate)!);
    if (config.followRate > 0) intervals.push(createInterval('follow', config.followRate)!);

    intervalsRef.current = intervals.filter(Boolean);
  }, [config, generateEvent]);

  const stopStressTest = useCallback(() => {
    intervalsRef.current.forEach(clearInterval);
    intervalsRef.current = [];
    setIsRunning(false);
  }, []);

  // Stats update loop
  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      setStats({
        total: trackerRef.current.getPerSecond() * 60, // rough total
        perSecond: trackerRef.current.getPerSecond(),
        gifts: countersRef.current.gifts,
        comments: countersRef.current.comments,
        likes: countersRef.current.likes,
        joins: countersRef.current.joins,
      });
    }, 500);
    return () => clearInterval(timer);
  }, [isRunning]);

  // Cleanup on unmount
  useEffect(() => () => stopStressTest(), [stopStressTest]);

  const totalRate = config.giftRate + config.commentRate + config.likeRate + config.joinRate + config.shareRate + config.followRate;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto p-6 space-y-6">
      <PageHeader
        title="Stress Test"
        subtitle={`Simulate ${totalRate} events/sec across all event types`}
        icon={<Zap className="w-5 h-5 text-purple-400" />}
        actions={
          <div className="flex gap-2">
            {!isRunning ? (
              <Button onClick={startStressTest} className="bg-green-600 hover:bg-green-500 text-white">
                <Play className="w-4 h-4 mr-1" /> Start
              </Button>
            ) : (
              <Button onClick={stopStressTest} className="bg-red-600 hover:bg-red-500 text-white">
                <Square className="w-4 h-4 mr-1" /> Stop
              </Button>
            )}
          </div>
        }
      />

      {/* Live Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={<Activity className="w-4 h-4 text-blue-400" />} label="Events/sec" value={String(stats.perSecond)} />
        <StatCard icon={<Gift className="w-4 h-4 text-purple-400" />} label="Gifts" value={String(stats.gifts)} />
        <StatCard icon={<MessageSquare className="w-4 h-4 text-cyan-400" />} label="Comments" value={String(stats.comments)} />
        <StatCard icon={<Heart className="w-4 h-4 text-red-400" />} label="Likes" value={String(stats.likes)} />
      </div>

      {/* Configuration */}
      <div className="border border-white/10 rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-purple-400" />
          Event Rates (events per second)
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <RateInput label="Gifts" icon={<Gift className="w-3.5 h-3.5" />} value={config.giftRate} onChange={v => setConfig(c => ({ ...c, giftRate: v }))} />
          <RateInput label="Comments" icon={<MessageSquare className="w-3.5 h-3.5" />} value={config.commentRate} onChange={v => setConfig(c => ({ ...c, commentRate: v }))} />
          <RateInput label="Likes" icon={<Heart className="w-3.5 h-3.5" />} value={config.likeRate} onChange={v => setConfig(c => ({ ...c, likeRate: v }))} />
          <RateInput label="Joins" icon={<UserPlus className="w-3.5 h-3.5" />} value={config.joinRate} onChange={v => setConfig(c => ({ ...c, joinRate: v }))} />
          <RateInput label="Shares" icon={<Share2 className="w-3.5 h-3.5" />} value={config.shareRate} onChange={v => setConfig(c => ({ ...c, shareRate: v }))} />
          <RateInput label="Follows" icon={<Users className="w-3.5 h-3.5" />} value={config.followRate} onChange={v => setConfig(c => ({ ...c, followRate: v }))} />
        </div>
        <div className="text-xs text-gray-500">
          Total: {totalRate} events/sec ({(totalRate * 3600).toLocaleString()} events/hour)
        </div>
      </div>

      {/* Engine Stats */}
      <div className="border border-white/10 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-green-400" />
          Engine Statistics
        </h3>
        <EngineStatsDisplay />
      </div>
    </motion.div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-gray-400">{label}</span></div>
      <div className="text-lg font-bold text-white font-mono">{value}</div>
    </div>
  );
}

function RateInput({ label, icon, value, onChange }: { label: string; icon: React.ReactNode; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-gray-400 flex items-center gap-1 mb-1">{icon}{label}</label>
      <input type="number" min={0} max={1000} value={value} onChange={e => onChange(Number(e.target.value))}
        className="w-full px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-purple-500/50" />
    </div>
  );
}

function EngineStatsDisplay() {
  // TikTok engine now runs in main process - stats come via IPC
  // For stress test, we just show local counters
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
      <div><span className="text-gray-500">Generated Events:</span> <span className="text-white font-mono">(local only)</span></div>
      <div><span className="text-gray-500">Pipeline Stats:</span> <span className="text-white font-mono">(main process)</span></div>
      <div><span className="text-gray-500">Active Combos:</span> <span className="text-white font-mono">N/A</span></div>
      <div><span className="text-gray-500">Action Queue:</span> <span className="text-white font-mono">N/A</span></div>
    </div>
  );
}
export default StressTestPage;
