// =============================================
// TikTok Engine — Barrel Export
// =============================================

export { getTikTokEngine } from './tiktok-engine';
export type {
  TikTokEvent,
  TikTokEventType,
  ConnectionState,
  ConnectionHealth,
  ConnectionConfig,
  GiftCombo,
  ProcessedComment,
  ViewerStats,
  ActionExecution,
  EventPriority,
} from './types';

// ScreenId is re-exported from the project-wide types
// for convenience — tiktok/types.ts imports it from here
export type { ScreenId } from '../../types';
