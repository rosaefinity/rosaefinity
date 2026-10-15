// =============================================
// RosaeFinity â€” Update Notification Banner
// Shows when an update is available or downloading.
// Appears at the top of the app, auto-dismisses.
// =============================================

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useUpdateStore } from '../store/update-store';
import { Button } from './ui/button';
import { Download, ArrowRight, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

export function UpdateNotification(): React.JSX.Element | null {
  const navigate = useNavigate();
  const { status, currentInfo, progress, error, downloadUpdate, clearError } = useUpdateStore();
  const [dismissed, setDismissed] = useState(false);

  // Auto-dismiss after download completes
  useEffect(() => {
    if (status === 'downloaded') {
      const timer = setTimeout(() => setDismissed(true), 10000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Reset dismissed when new update available
  useEffect(() => {
    if (status === 'available' || status === 'error') {
      setDismissed(false);
    }
  }, [status]);

  if (dismissed) return null;

  // Don't show if idle, checking, or not-available
  if (
    status !== 'available' &&
    status !== 'downloading' &&
    status !== 'downloaded' &&
    !(status === 'error' && error)
  ) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        className="fixed top-12 left-1/2 -translate-x-1/2 z-50 max-w-lg w-full"
      >
        <div className="bg-[#1a1a2e] border border-white/10 rounded-xl shadow-2xl shadow-black/50 p-4">
          {/* Available */}
          {status === 'available' && currentInfo && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">
                  Update Available
                </div>
                <div className="text-xs text-gray-400">
                  v{currentInfo.version}
                </div>
              </div>
              <Button
                size="sm"
                onClick={downloadUpdate}
                className="bg-purple-600 hover:bg-purple-500 text-white shrink-0"
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                Download
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate('/update')}
                className="text-gray-400 hover:text-white shrink-0"
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
              <button
                onClick={() => setDismissed(true)}
                className="text-gray-500 hover:text-white shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Downloading */}
          {status === 'downloading' && progress && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-purple-400 animate-spin shrink-0" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-white">
                    Downloading Update...
                  </div>
                  <div className="text-xs text-gray-400">
                    {Math.round(progress.percent)}% Â· {(progress.bytesPerSecond / 1024).toFixed(0)} KB/s
                    {progress.estimatedSecondsRemaining > 0 && ` Â· ~${Math.ceil(progress.estimatedSecondsRemaining / 60)}m remaining`}
                  </div>
                </div>
                <button
                  onClick={() => useUpdateStore.getState().cancelDownload()}
                  className="text-gray-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <motion.div
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}

          {/* Downloaded */}
          {status === 'downloaded' && (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-white">
                  Update Ready to Install
                </div>
                <div className="text-xs text-gray-400">
                  Restart the app to apply the update
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => useUpdateStore.getState().installUpdate()}
                className="bg-green-600 hover:bg-green-500 text-white shrink-0"
              >
                Restart & Install
              </Button>
              <button
                onClick={() => setDismissed(true)}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Error */}
          {status === 'error' && error && (
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-white">Update Error</div>
                <div className="text-xs text-gray-400">{error}</div>
              </div>
              <button
                onClick={clearError}
                className="text-gray-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
