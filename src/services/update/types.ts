// =============================================
// RosaeFinity — Update Service Types
// =============================================

export type UpdateChannel = 'stable' | 'beta' | 'dev';

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'installing'
  | 'error';

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
