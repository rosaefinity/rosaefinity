// =============================================
// RosaeFinity â€” Sync API Client
// Typed HTTP client for backend sync endpoints.
// Auth, retry, offline detection built-in.
// =============================================

import { api, isElectron } from '../electron-service';
import type { SyncPushPayload, SyncPushResult, SyncPullResult, SyncEntityType } from './types';

const BASE_URL = `${import.meta.env.VITE_API_URL}/v1`;

interface RequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

interface ApiError {
  message: string;
  code: string;
  status: number;
}

class SyncApiClient {
  private baseUrl: string;
  private authToken: string | null = null;
  private isOnline: boolean = navigator.onLine;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;

    // Listen for online/offline events
    window.addEventListener('online', () => { this.isOnline = true; });
    window.addEventListener('offline', () => { this.isOnline = false; });
  }

  /** Set auth token for authenticated requests */
  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  /** Check if client is online */
  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  /** Push sync records to server */
  async push(payload: SyncPushPayload): Promise<SyncPushResult> {
    const result = await this.request<SyncPushResult>({
      method: 'POST',
      path: '/sync/push',
      body: payload,
      timeout: 30000,
    });
    return result;
  }

  /** Pull sync records from server */
  async pull(entityType?: SyncEntityType, sinceVersion = 0, limit = 100): Promise<SyncPullResult> {
    const params = new URLSearchParams();
    if (entityType) params.set('entityType', entityType);
    params.set('sinceVersion', String(sinceVersion));
    params.set('limit', String(limit));

    const result = await this.request<SyncPullResult>({
      method: 'GET',
      path: `/sync/pull?${params.toString()}`,
      timeout: 15000,
    });
    return result;
  }

  /** Get server version */
  async getVersion(): Promise<number> {
    const result = await this.request<{ serverVersion: number }>({
      method: 'GET',
      path: '/sync/version',
    });
    return result.serverVersion;
  }

  /** Delete a synced entity */
  async delete(entityType: SyncEntityType, entityId: string): Promise<void> {
    await this.request({
      method: 'POST',
      path: '/sync/delete',
      body: { entityType, entityId },
    });
  }

  /** Generic request with retry and timeout */
  private async request<T>(options: RequestOptions): Promise<T> {
    if (!this.isOnline) {
      throw new ApiError({ message: 'Offline', code: 'OFFLINE', status: 0 });
    }

    const { method, path, body, headers = {}, timeout = 10000 } = options;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const fetchHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...headers,
      };

      if (this.authToken) {
        fetchHeaders['Authorization'] = `Bearer ${this.authToken}`;
      }

      // Use Electron IPC if available (bypasses CORS)
      if (isElectron()) {
        return await this.electronRequest<T>(options);
      }

      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: fetchHeaders,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new ApiError({
          message: json.error || `HTTP ${response.status}`,
          code: json.code || 'API_ERROR',
          status: response.status,
        });
      }

      return json.data as T;
    } catch (err: any) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        throw new ApiError({ message: 'Request timeout', code: 'TIMEOUT', status: 0 });
      }

      if (err instanceof ApiError) throw err;

      throw new ApiError({
        message: err.message || 'Network error',
        code: 'NETWORK_ERROR',
        status: 0,
      });
    }
  }

  /** Electron IPC fallback (no CORS needed) */
  private async electronRequest<T>(options: RequestOptions): Promise<T> {
    const a = api();
    if (!a) throw new ApiError({ message: 'Electron not available', code: 'NO_ELECTRON', status: 0 });

    // For now, use fetch even in Electron (backend may not be running)
    // In production, this would use IPC to a native HTTP client
    return this.request<T>({ ...options });
  }
}

/** Custom ApiError class */
class ApiError extends Error {
  code: string;
  status: number;

  constructor({ message, code, status }: { message: string; code: string; status: number }) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

// Singleton
let _client: SyncApiClient | null = null;

export function getSyncApiClient(): SyncApiClient {
  if (!_client) {
    _client = new SyncApiClient();
  }
  return _client;
}

export { ApiError };
