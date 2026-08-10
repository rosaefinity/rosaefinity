// =============================================
// RosaeFinity — Sync Service
// Delta sync with conflict detection.
// =============================================

import { syncRepository } from './repository.js';
import { computeChecksum } from '../../../utils/helpers.js';
import type { SyncPayload, SyncResult } from '../../../types/index.js';

export const syncService = {
  async push(userId: string, records: SyncPayload[], clientVersion: number): Promise<SyncResult> {
    const accepted: SyncPayload[] = [];
    const rejected: { entity: SyncPayload; reason: string }[] = [];

    for (const record of records) {
      // Verify checksum
      const expectedChecksum = computeChecksum(record.data);
      if (expectedChecksum !== record.checksum) {
        rejected.push({ entity: record, reason: 'Checksum mismatch — data may be corrupted' });
        continue;
      }

      // Upsert
      try {
        const saved = await syncRepository.upsert(
          userId,
          record.entityType,
          record.entityId,
          record.data,
          record.version,
          record.checksum,
        );
        accepted.push({ ...record, version: saved.version });
      } catch (err: any) {
        rejected.push({ entity: record, reason: err.message });
      }
    }

    const serverVersion = await syncRepository.getMaxServerVersion(userId);

    return { accepted, rejected, serverVersion };
  },

  async pull(userId: string, entityType?: string, sinceVersion = 0, limit = 100) {
    const records = await syncRepository.findChanged(userId, entityType, sinceVersion);
    const serverVersion = await syncRepository.getMaxServerVersion(userId);
    return { records: records.slice(0, limit), serverVersion };
  },

  async delete(userId: string, entityType: string, entityId: string) {
    await syncRepository.delete(userId, entityType, entityId);
    return { success: true };
  },

  async getServerVersion(userId: string) {
    return syncRepository.getMaxServerVersion(userId);
  },
};
