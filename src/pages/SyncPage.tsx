// =============================================
// RosaeFinity — Sync Settings & Status Page
// =============================================

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useSyncStore } from '../store/sync-store';
import { isElectron } from '../services/electron-service';
import { Button } from '../components/ui/button';
import { SyncStatus } from '../components/SyncStatus';
import {
  Cloud, RefreshCw, AlertTriangle, Clock, Wifi, WifiOff,
  ChevronDown, ChevronRight, Loader2, Database, ArrowUpDown,
  CheckCircle2, XCircle, Settings,
} from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function SyncPage(): React.JSX.Element {
  const {
    status, isOnline, config, stats, pendingCount, conflictCount, conflicts,
    sync, setConfig, retryAll, forceSync, refreshStats,
  } = useSyncStore();

  const [showSettings, setShowSettings] = useState(false);
  const [showConflicts, setShowConflicts] = useState(false);

  useEffect(() => {
    refreshStats();
    const timer = setInterval(refreshStats, 10000);
    return () => clearInterval(timer);
  }, [refreshStats]);

  if (!isElectron()) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
        <Cloud className="w-12 h-12" />
        <p>Sync is only available in the desktop app.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto p-6 space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Cloud className="w-6 h-6 text-purple-400" />
            Cloud Sync
          </h1>
          <p className="text-sm text-gray-400 mt-1">Synchronize your data across devices</p>
        </div>
        <SyncStatus />
      </div>

      {/* Connection Status */}
      <div className={`flex items-center gap-4 p-4 rounded-xl border ${
        isOnline
          ? 'bg-green-500/10 border-green-500/20'
          : 'bg-yellow-500/10 border-yellow-500/20'
      }`}>
        {isOnline ? <Wifi className="w-5 h-5 text-green-400" /> : <WifiOff className="w-5 h-5 text-yellow-400" />}
        <div className="flex-1">
          <div className="text-sm font-medium text-white">
            {isOnline ? 'Connected' : 'Offline Mode'}
          </div>
          <div className="text-xs text-gray-400">
            {isOnline ? 'Changes will sync automatically' : 'Changes queued for next sync'}
          </div>
        </div>
        <Button
          size="sm"
          onClick={forceSync}
          disabled={!isOnline || status === 'syncing'}
          className="border-white/10"
          variant="outline"
        >
          {status === 'syncing' ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-1" />
          )}
          Sync Now
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Pending" value={String(pendingCount)} icon={<Clock className="w-4 h-4 text-yellow-400" />} />
        <StatCard label="Conflicts" value={String(conflictCount)} icon={<AlertTriangle className="w-4 h-4 text-orange-400" />} />
        <StatCard label="Last Sync" value={stats.lastSyncAt ? new Date(stats.lastSyncAt).toLocaleTimeString() : 'Never'} icon={<Cloud className="w-4 h-4 text-green-400" />} />
        <StatCard label="Duration" value={formatDuration(stats.lastSyncDuration)} icon={<ArrowUpDown className="w-4 h-4 text-blue-400" />} />
      </div>

      {/* Detailed Stats */}
      <div className="border border-white/10 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Database className="w-4 h-4 text-purple-400" />
          Sync Statistics
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-400">Upload Size</span>
            <span className="text-gray-200 font-mono">{formatBytes(stats.uploadSize)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Download Size</span>
            <span className="text-gray-200 font-mono">{formatBytes(stats.downloadSize)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">API Latency</span>
            <span className="text-gray-200 font-mono">{stats.apiLatency ? `${stats.apiLatency}ms` : '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Retry Count</span>
            <span className="text-gray-200 font-mono">{stats.retryCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Failed Items</span>
            <span className="text-gray-200 font-mono">{stats.failedCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Synced Items</span>
            <span className="text-gray-200 font-mono">{stats.syncedCount}</span>
          </div>
        </div>
        {stats.failedCount > 0 && (
          <Button size="sm" variant="outline" onClick={retryAll} className="border-white/10">
            <RefreshCw className="w-3.5 h-3.5 mr-1" />
            Retry Failed ({stats.failedCount})
          </Button>
        )}
      </div>

      {/* Conflicts */}
      {conflictCount > 0 && (
        <div className="border border-orange-500/20 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowConflicts(!showConflicts)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-orange-500/10 hover:bg-orange-500/15 transition-colors"
          >
            <AlertTriangle className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium text-white flex-1 text-left">
              {conflictCount} Conflict{conflictCount !== 1 ? 's' : ''} Need Resolution
            </span>
            {showConflicts ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </button>
          {showConflicts && (
            <div className="divide-y divide-white/5">
              {conflicts.map(c => (
                <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-sm text-white">{c.entityType}: {c.entityId}</div>
                    <div className="text-xs text-gray-400">Detected {new Date(c.detectedAt).toLocaleString()}</div>
                  </div>
                  <Button size="sm" variant="ghost" className="text-xs text-green-400" onClick={() => useSyncStore.getState().resolveConflict(c.id, 'local')}>
                    Keep Local
                  </Button>
                  <Button size="sm" variant="ghost" className="text-xs text-blue-400" onClick={() => useSyncStore.getState().resolveConflict(c.id, 'remote')}>
                    Use Remote
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors"
        >
          <Settings className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white flex-1 text-left">Sync Settings</span>
          {showSettings ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>
        {showSettings && (
          <div className="px-4 py-4 space-y-4">
            <ToggleSetting
              label="Auto Sync"
              description="Automatically sync changes in the background"
              value={config.autoSync}
              onChange={(v) => setConfig({ autoSync: v })}
            />
            <ToggleSetting
              label="Sync on Startup"
              description="Sync when the application starts"
              value={config.syncOnStartup}
              onChange={(v) => setConfig({ syncOnStartup: v })}
            />
            <ToggleSetting
              label="Sync on Exit"
              description="Final sync before closing"
              value={config.syncOnExit}
              onChange={(v) => setConfig({ syncOnExit: v })}
            />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white">Sync Interval</div>
                <div className="text-xs text-gray-500">How often to check for changes</div>
              </div>
              <select
                value={config.syncIntervalMs}
                onChange={(e) => setConfig({ syncIntervalMs: Number(e.target.value) })}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white"
              >
                <option value={60000}>1 minute</option>
                <option value={300000}>5 minutes</option>
                <option value={600000}>10 minutes</option>
                <option value={1800000}>30 minutes</option>
              </select>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Helper Components ──

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <div className="text-lg font-bold text-white font-mono">{value}</div>
    </div>
  );
}

function ToggleSetting({ label, description, value, onChange }: {
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="text-sm text-white">{label}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative w-11 h-6 rounded-full transition-colors ${value ? 'bg-purple-600' : 'bg-white/10'}`}
      >
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
export default SyncPage;
