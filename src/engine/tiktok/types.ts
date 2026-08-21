// =============================================
// RosaeFinity â€” TikTok Engine Types
// Shared types for the entire TikTok engine.
// =============================================

// â”€â”€ Connection â”€â”€
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error' | 'rate-limited';

export interface ConnectionConfig {
  screenId: string;
  username: string;
  reconnectAttempts: number;
  reconnectDelayMs: number;
  maxReconnectDelayMs: number;
  heartbeatIntervalMs: number;
  connectionTimeoutMs: number;
}

export interface ConnectionHealth {
  state: ConnectionState;
  latency: number;
  uptime: number;
  reconnectCount: number;
  lastEventAt: number;
  lastHeartbeatAt: number;
  eventsPerSecond: number;
  droppedEvents: number;
  duplicateEvents: number;
  roomId: string | null;
  roomTitle: string | null;
  viewerCount: number;
}

// â”€â”€ Events â”€â”€
export type TikTokEventType =
  | 'gift'
  | 'gift-combo'
  | 'follow'
  | 'share'
  | 'join'
  | 'like'
  | 'comment'
  | 'subscribe'
  | 'disconnect'
  | 'reconnect'
  | 'error'
  | 'viewer-update'
  | 'stats-update'
  | 'member'
  | 'chat';

export type EventPriority = 'highest' | 'high' | 'normal' | 'low' | 'lowest';

export interface TikTokEvent {
  id: string;
  type: TikTokEventType;
  priority: EventPriority;
  screenId: string;
  timestamp: number;
  data: Record<string, unknown>;
  processed: boolean;
  retryCount: number;
}

// â”€â”€ Gift Combo â”€â”€
export interface GiftCombo {
  id: string;
  userId: string;
  username: string;
  nickname: string;
  giftId: string;
  giftName: string;
  giftCount: number;
  totalCoins: number;
  comboCount: number;
  comboStartedAt: number;
  comboLastAt: number;
  comboExpiresAt: number;
  isExtended: boolean;
}

// â”€â”€ Comment â”€â”€
export interface ProcessedComment {
  id: string;
  userId: string;
  username: string;
  nickname: string;
  comment: string;
  timestamp: number;
  isSpam: boolean;
  isDuplicate: boolean;
  sentiment: 'positive' | 'neutral' | 'negative';
}

// â”€â”€ Viewer Stats â”€â”€
export interface ViewerStats {
  current: number;
  peak: number;
  total: number;
  joinRate: number;
  leaveRate: number;
  movingAverage5m: number;
  movingAverage30m: number;
  sessionStart: number;
  joinHistory: number[];
  leaveHistory: number[];
}

// â”€â”€ Action Execution â”€â”€
export interface ActionExecution {
  id: string;
  actionId: string;
  event: TikTokEvent;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
}

// â”€â”€ Event Priority Map â”€â”€
export const EVENT_PRIORITY: Record<TikTokEventType, EventPriority> = {
  'disconnect': 'highest',
  'reconnect': 'highest',
  'error': 'highest',
  'gift': 'high',
  'gift-combo': 'high',
  'subscribe': 'high',
  'follow': 'normal',
  'share': 'normal',
  'join': 'normal',
  'like': 'low',
  'comment': 'low',
  'member': 'low',
  'chat': 'low',
  'viewer-update': 'lowest',
  'stats-update': 'lowest',
};

// â”€â”€ Priority Order (for sorting) â”€â”€
export const PRIORITY_ORDER: Record<EventPriority, number> = {
  'highest': 0,
  'high': 1,
  'normal': 2,
  'low': 3,
  'lowest': 4,
};
