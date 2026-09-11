// =============================================
// RosaeFinity Worker — Shared Types
// =============================================

// ── API Response ──
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  requestId?: string;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// ── Auth ──
export interface JwtPayload {
  sub: string;        // User ID
  email: string;
  planTier: string;   // Subscription tier (guest/free/pro/enterprise)
  role: string;       // Authorization role (USER | ADMIN)
  iat: number;
  exp: number;
  type?: string;      // 'refresh' for refresh tokens
}

// ── Plan Tiers ──
export type PlanTier = 'guest' | 'free' | 'pro' | 'enterprise';

// ── Device ──
export type DeviceStatus = 'active' | 'inactive' | 'revoked';

// ── Sync ──
export type SyncEntityType = 'action' | 'sound' | 'overlay' | 'settings' | 'alert' | 'goal' | 'preference';

export interface SyncPayload {
  entityType: SyncEntityType;
  entityId: string;
  data: Record<string, unknown>;
  version: number;
  checksum: string;
  updatedAt: number;
}

export interface SyncResult {
  accepted: SyncPayload[];
  rejected: { entity: SyncPayload; reason: string }[];
  serverVersion: number;
}

// ── Analytics ──
export type AnalyticsEventType =
  | 'app_start'
  | 'feature_usage'
  | 'crash_report'
  | 'performance_metric'
  | 'update_installed'
  | 'license_activated'
  | 'session_duration';

// ── Pagination ──
export interface PaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// ── Overlay ──
export interface GoalState {
  goalId: string;
  title: string;
  type: string;
  current: number;
  target: number;
  barColor: string;
  reached: boolean;
}
