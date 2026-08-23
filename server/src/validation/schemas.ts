// =============================================
// RosaeFinity Server — Zod Validation Schemas
// Request/response validation for all endpoints.
// =============================================

import { z } from 'zod';

// ── Auth ──
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  displayName: z.string().min(1).max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional(),
});

export const googleAuthSchema = z.object({
  accessToken: z.string().min(1),
  idToken: z.string().optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

// ── License ──
export const activateLicenseSchema = z.object({
  licenseKey: z.string().regex(/^ROSAE-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/, 'Invalid license key format'),
  email: z.string().email().optional(),
  deviceId: z.string().min(1),
  userId: z.string().optional(), // Admin-only: target user ID for admin-activated licenses
});

export const adminActivateSchema = z.object({
  plan: z.enum(['pro', 'enterprise']).default('pro'),
  durationDays: z.number().int().min(1).max(3650).default(365),
});

export const deactivateLicenseSchema = z.object({
  deviceId: z.string().min(1),
});

// ── Payment ──
export const submitPaymentSchema = z.object({
  amount: z.number().int().positive(),
  paymentMethod: z.enum(['qris', 'bank_transfer', 'e_wallet']).default('qris'),
  proofUrl: z.string().url().optional(),
});

export const rejectPaymentSchema = z.object({
  notes: z.string().max(500).optional(),
});

// ── Device ──
export const registerDeviceSchema = z.object({
  deviceId: z.string().min(1),
  name: z.string().min(1).max(200),
  platform: z.string().min(1).max(100),
  appVersion: z.string().optional(),
  machineFingerprint: z.string().optional(),
});

// ── Sync ──
export const syncPushSchema = z.object({
  entityType: z.enum(['action', 'sound', 'overlay', 'settings', 'alert', 'goal', 'preference']),
  entityId: z.string().min(1),
  data: z.record(z.unknown()),
  version: z.number().int().positive(),
  checksum: z.string().min(1),
  updatedAt: z.number().int().positive(),
});

export const syncBatchSchema = z.object({
  records: z.array(syncPushSchema).max(100),
  clientVersion: z.number().int().default(0),
});

export const syncPullSchema = z.object({
  entityType: z.enum(['action', 'sound', 'overlay', 'settings', 'alert', 'goal', 'preference']).optional(),
  sinceVersion: z.number().int().default(0),
  limit: z.number().int().min(1).max(500).default(100),
});

// ── Analytics ──
export const analyticsEventSchema = z.object({
  eventType: z.enum(['app_start', 'feature_usage', 'crash_report', 'performance_metric', 'update_installed', 'license_activated', 'session_duration']),
  eventData: z.record(z.unknown()),
  appVersion: z.string().optional(),
  platform: z.string().optional(),
  sessionId: z.string().optional(),
});

// ── Pagination ──
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ── Update ──
export const checkUpdateSchema = z.object({
  currentVersion: z.string().min(1),
  channel: z.enum(['stable', 'beta', 'nightly']).default('stable'),
  platform: z.string().optional(),
});
