import React from "react";
// =============================================
// RosaeFinity — Update Management Page
// Version info, channel, check/download, preferences.
// =============================================

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUpdateStore } from '../store/update-store';
import { useAppVersion } from '../hooks/use-app-version';
import { isElectron } from '../services/electron-service';
import { Button } from '../components/ui/button';
import type { UpdateChannel } from '../services/update/types';
import {
  Download, RefreshCw, CheckCircle2, ArrowRight, Clock,
  Settings, AlertTriangle, Loader2, Zap, Shield,
  ChevronDown, ChevronRight, Info, SkipForward,
} from 'lucide-react';

const CHANNELS: { id: UpdateChannel; label: string; description: string; icon: typeof Shield }[] = [
  { id: 'stable', label: 'Stable', description: 'Production-ready releases', icon: Shield },
  { id: 'beta', label: 'Beta', description: 'Pre-release testing builds', icon: Zap },
  { id: 'nightly', label: 'Nightly', description: 'Daily development builds', icon: Clock },
];

const STATUS_LABELS: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  idle: { label: 'Idle', color: 'text-gray-400', icon: Clock },
  checking: { label: 'Checking...', color: 'text-blue-400', icon: RefreshCw },
  available: { label: 'Update Available', color: 'text-purple-400', icon: Download },
  'not-available': { label: 'Up to Date', color: 'text-green-400', icon: CheckCircle2 },
  downloading: { label: 'Downloading...', color: 'text-purple-400', icon: Loader2 },
  downloaded: { label: 'Ready to Install', color: 'text-green-400', icon: CheckCircle2 },
  installing: { label: 'Installing...', color: 'text-orange-400', icon: Loader2 },
  error: { label: 'Error', color: 'text-red-400', icon: AlertTriangle },
  cancelled: { label: 'Cancelled', color: 'text-gray-400', icon: AlertTriangle },
  progress: { label: 'Downloading...', color: 'text-purple-400', icon: Loader2 },
};

export function UpdatePage(): React.JSX.Element {
  const {
    status, latestVersion, channel, progress,
    currentInfo, releaseNotes, lastCheckedAt, lastInstalledAt,
    ignoredVersions, preferences, error,
    checkForUpdates, downloadUpdate, installUpdate, cancelDownload,
    setChannel, setPreferences, skipVersion, unskipVersion, clearError,
  } = useUpdateStore();
  const currentVersion = useAppVersion();

  const [showPreferences, setShowPreferences] = useState(false);
  const [showIgnored, setShowIgnored] = useState(false);

  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.idle;
  const StatusIcon = statusInfo.icon;
  const isChecking = status === 'checking';
  const isDownloading = status === 'downloading';
  const isDownloaded = status === 'downloaded';
  const hasUpdate = status === 'available';

  if (!isElectron()) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4">
        <Download className="w-12 h-12" />
        <p>Updates are only available in the desktop app.</p>
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
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Download className="w-6 h-6 text-purple-400" />
          Updates
        </h1>
        <p className="text-sm text-gray-400 mt-1">Manage application updates and channels</p>
      </div>

      {/* Version Card */}
      <div className="border border-white/10 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-400">Current Version</div>
            <div className="text-2xl font-bold text-white font-mono">v{currentVersion}</div>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${statusInfo.color} bg-white/5 border border-white/10`}>
            <StatusIcon className={`w-4 h-4 ${isChecking || isDownloading ? 'animate-spin' : ''}`} />
            <span className="text-sm font-medium">{statusInfo.label}</span>
          </div>
        </div>

        {latestVersion && latestVersion !== currentVersion && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-400">Latest:</span>
            <span className="text-white font-mono">v{latestVersion}</span>
            {latestVersion && (
              <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                {compareVersions(currentVersion, latestVersion)}
              </span>
            )}
          </div>
        )}

        {/* Progress bar */}
        {isDownloading && progress && (
          <div className="space-y-2">
            <div className="w-full bg-white/10 rounded-full h-2">
              <motion.div
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full"
                animate={{ width: `${progress.percent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>{Math.round(progress.percent)}%</span>
              <span>{(progress.bytesPerSecond / 1024).toFixed(0)} KB/s</span>
              <span>{formatBytes(progress.transferred)} / {formatBytes(progress.total)}</span>
              {progress.estimatedSecondsRemaining > 0 && (
                <span>~{Math.ceil(progress.estimatedSecondsRemaining / 60)}m remaining</span>
              )}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={clearError} className="text-red-400 hover:text-red-300">✕</button>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          {!hasUpdate && !isDownloading && !isDownloaded && (
            <Button
              onClick={() => checkForUpdates(false)}
              disabled={isChecking}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
            >
              {isChecking ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Check for Updates
            </Button>
          )}

          {hasUpdate && (
            <Button
              onClick={downloadUpdate}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Download Update
            </Button>
          )}

          {isDownloading && (
            <Button
              onClick={cancelDownload}
              variant="outline"
              className="border-white/10"
            >
              Cancel
            </Button>
          )}

          {isDownloaded && (
            <Button
              onClick={installUpdate}
              className="bg-green-600 hover:bg-green-500 text-white"
            >
              <ArrowRight className="w-4 h-4 mr-2" />
              Restart & Install
            </Button>
          )}
        </div>

        {/* Last checked */}
        {lastCheckedAt && (
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Last checked: {new Date(lastCheckedAt).toLocaleString()}
          </div>
        )}
        {lastInstalledAt && (
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Last installed: {new Date(lastInstalledAt).toLocaleString()}
          </div>
        )}
      </div>

      {/* Channel Selection */}
      <div className="border border-white/10 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Zap className="w-4 h-4 text-purple-400" />
          Update Channel
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {CHANNELS.map(ch => {
            const Icon = ch.icon;
            const isSelected = channel === ch.id;
            return (
              <button
                key={ch.id}
                onClick={() => setChannel(ch.id)}
                className={`p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-purple-500/50 bg-purple-500/10'
                    : 'border-white/10 bg-white/5 hover:bg-white/[0.07]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-purple-400' : 'text-gray-400'}`} />
                  <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                    {ch.label}
                  </span>
                </div>
                <div className="text-xs text-gray-500">{ch.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Release Notes */}
      {(releaseNotes || currentInfo?.releaseNotes) && (
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-white/5 border-b border-white/10">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              Release Notes
            </h3>
          </div>
          <div className="px-4 py-3 max-h-60 overflow-y-auto scrollbar-thin">
            <div className="text-sm text-gray-300 whitespace-pre-wrap">
              {releaseNotes || currentInfo?.releaseNotes || 'No release notes available.'}
            </div>
          </div>
        </div>
      )}

      {/* Preferences */}
      <div className="border border-white/10 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowPreferences(!showPreferences)}
          className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors"
        >
          <Settings className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-white flex-1 text-left">Update Preferences</span>
          {showPreferences ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
        </button>
        {showPreferences && (
          <div className="px-4 py-4 space-y-4">
            <ToggleSetting
              label="Automatic Update Checks"
              description="Check for updates on startup and every 4 hours"
              value={preferences.autoCheck}
              onChange={(v) => setPreferences({ autoCheck: v })}
            />
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-white">Automatic Downloads</div>
                <div className="text-xs text-gray-500">Updates are downloaded manually when you choose Download.</div>
              </div>
              <span className="text-xs text-gray-500">Manual</span>
            </div>
            <ToggleSetting
              label="Silent Mode"
              description="Hide update notifications; installation still requires your confirmation"
              value={preferences.silent}
              onChange={(v) => setPreferences({ silent: v })}
            />
          </div>
        )}
      </div>

      {/* Ignored Versions */}
      {ignoredVersions.length > 0 && (
        <div className="border border-white/10 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowIgnored(!showIgnored)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors"
          >
            <SkipForward className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-white flex-1 text-left">
              Ignored Versions ({ignoredVersions.length})
            </span>
            {showIgnored ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
          </button>
          {showIgnored && (
            <div className="px-4 py-3 space-y-2">
              {ignoredVersions.map(v => (
                <div key={v} className="flex items-center justify-between py-1">
                  <span className="text-sm text-gray-300 font-mono">v{v}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-gray-400 hover:text-white"
                    onClick={() => unskipVersion(v)}
                  >
                    Unskip
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

// ── Helper Components ──

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
        className={`relative w-11 h-6 rounded-full transition-colors ${
          value ? 'bg-purple-600' : 'bg-white/10'
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-5.5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}

// ── Helpers ──

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function compareVersions(current: string, latest: string): string {
  const cur = current.split('.').map(Number);
  const lat = latest.split('.').map(Number);
  if (lat[0] > cur[0]) return 'Major Update';
  if (lat[1] > cur[1]) return 'Minor Update';
  if (lat[2] > cur[2]) return 'Patch Update';
  return 'Update';
}
export default UpdatePage;
