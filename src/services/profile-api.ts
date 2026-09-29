// =============================================
// RosaeFinity — Profile API Client
// Account-scoped stream profile backend operations.
// =============================================

import { authFetch } from '../lib/auth-fetch';
import type { StreamProfile, TTSSettings } from '../types';

interface ProfileListItem {
  id: string;
  name: string;
  icon: string | null;
  tiktokUsername: string;
  overlaySettings: Record<string, unknown>;
  alertsSettings: Record<string, unknown>;
  alertsMasterEnabled?: boolean;
  actions: Record<string, unknown>[];
  events: Record<string, unknown>[];
  customSounds: Record<string, unknown>[];
  ttsSettings?: TTSSettings;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

interface CreateProfileParams {
  name: string;
  icon?: string;
  tiktokUsername?: string;
  overlaySettings?: Record<string, unknown>;
  alertsSettings?: Record<string, unknown>;
  actions?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
  ttsSettings?: TTSSettings;
  sortOrder?: number;
}

interface UpdateProfileParams {
  name?: string;
  icon?: string;
  tiktokUsername?: string;
  overlaySettings?: Record<string, unknown>;
  alertsSettings?: Record<string, unknown>;
  actions?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
  ttsSettings?: TTSSettings;
  sortOrder?: number;
}

interface ListProfilesResponse {
  profiles: ProfileListItem[];
  maxProfiles: number;
}

interface BulkUpsertItem {
  serverId?: string;
  name: string;
  icon?: string;
  tiktokUsername?: string;
  overlaySettings?: Record<string, unknown>;
  alertsSettings?: Record<string, unknown>;
  alertsMasterEnabled?: boolean;
  actions?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
  customSounds?: Record<string, unknown>[];
  ttsSettings?: TTSSettings;
  sortOrder?: number;
}

interface BulkUpsertResult {
  localIndex: number;
  serverId: string;
  name: string;
}

/**
 * Fetch all profiles for the authenticated account.
 */
export async function fetchProfiles(): Promise<ListProfilesResponse> {
  return authFetch<ListProfilesResponse>('/profiles');
}

/**
 * Create a new profile on the server.
 */
export async function createProfile(profile: CreateProfileParams): Promise<ProfileListItem> {
  return authFetch<ProfileListItem>('/profiles', {
    method: 'POST',
    body: JSON.stringify(profile),
  });
}

/**
 * Update an existing profile on the server.
 */
export async function updateProfile(
  serverId: string,
  updates: UpdateProfileParams
): Promise<ProfileListItem> {
  return authFetch<ProfileListItem>(`/profiles/${serverId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/**
 * Delete a profile from the server.
 */
export async function deleteProfile(serverId: string): Promise<void> {
  return authFetch(`/profiles/${serverId}`, { method: 'DELETE' });
}

/**
 * Bulk upsert profiles (used during migration).
 */
export async function bulkUpsertProfiles(
  profiles: BulkUpsertItem[]
): Promise<{ results: BulkUpsertResult[] }> {
  return authFetch('/profiles/bulk', {
    method: 'POST',
    body: JSON.stringify({ profiles }),
  });
}
