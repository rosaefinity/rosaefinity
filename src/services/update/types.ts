// =============================================
// RosaeFinity — Update Service Types
// Canonical channel ids match UpdatePage + update-manager.cjs
// =============================================

export type UpdateChannel = 'stable' | 'beta' | 'nightly';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error'
  | 'cancelled';

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export interface UpdateInfo {
  version: string;
  releaseDate?: string;
  releaseNotes?: string;
}

export interface UpdatePreferences {
  channel: UpdateChannel;
  autoCheck: boolean;
  autoDownload: boolean;
  checkIntervalHours: number;
  silent: boolean;
}
