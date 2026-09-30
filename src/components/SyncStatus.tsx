import React from "react";
// =============================================
// RosaeFinity — Sync Status Indicator
// Compact status display for header/sidebar.
// =============================================

import { useNavigate } from 'react-router-dom';
import { Cloud, CloudOff, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react';
import { useSyncStore } from '../store/sync-store';
import { cn } from '../lib/utils';

const STATUS_CONFIG: Record<string, { icon: typeof Cloud; color: string; label: string }> = {
  online: { icon: Cloud, color: 'text-green-400', label: 'Synced' },
  idle: { icon: Cloud, color: 'text-green-400', label: 'Synced' },
  syncing: { icon: Loader2, color: 'text-blue-400', label: 'Syncing' },
  queued: { icon: RefreshCw, color: 'text-yellow-400', label: 'Queued' },
  offline: { icon: CloudOff, color: 'text-gray-400', label: 'Offline' },
  conflict: { icon: AlertTriangle, color: 'text-orange-400', label: 'Conflict' },
  error: { icon: AlertTriangle, color: 'text-red-400', label: 'Error' },
  failed: { icon: AlertTriangle, color: 'text-red-400', label: 'Failed' },
};

interface SyncStatusProps {
  compact?: boolean;
  className?: string;
}

export function SyncStatus({ compact = false, className }: SyncStatusProps): React.JSX.Element {
  const navigate = useNavigate();
  const { status, isOnline, pendingCount, conflictCount } = useSyncStore();
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.idle;
  const Icon = config.icon;
  const isSyncing = status === 'syncing';

  if (compact) {
    return (
      <button
        onClick={() => navigate('/sync')}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs transition-colors hover:bg-white/5',
          config.color,
          className,
        )}
        title={`Sync: ${config.label}${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}`}
      >
        <Icon className={cn('w-3.5 h-3.5', isSyncing && 'animate-spin')} />
        {!isOnline && <span className="text-gray-500">Offline</span>}
        {pendingCount > 0 && (
          <span className="bg-yellow-500/20 text-yellow-400 px-1 rounded-full text-[10px]">
            {pendingCount}
          </span>
        )}
        {conflictCount > 0 && (
          <span className="bg-orange-500/20 text-orange-400 px-1 rounded-full text-[10px]">
            {conflictCount}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Icon className={cn('w-4 h-4', config.color, isSyncing && 'animate-spin')} />
      <span className={cn('text-sm', config.color)}>{config.label}</span>
    </div>
  );
}
