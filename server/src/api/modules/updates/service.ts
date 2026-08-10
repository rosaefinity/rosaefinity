// =============================================
// RosaeFinity — Update Service
// Version management and release tracking.
// =============================================

import { updateRepository } from './repository.js';

// In production, these would come from a database or GitHub API
const CURRENT_VERSIONS: Record<string, { version: string; releaseNotes: string; minVersion: string; isCritical: boolean }> = {
  stable: { version: '1.0.1', releaseNotes: 'Stable release with license and update system.', minVersion: '1.0.0', isCritical: false },
  beta: { version: '1.1.0-beta.1', releaseNotes: 'Beta with cloud sync foundation.', minVersion: '1.0.0', isCritical: false },
  nightly: { version: '1.1.0-nightly.42', releaseNotes: 'Nightly build with latest features.', minVersion: '0.9.0', isCritical: false },
};

export const updateService = {
  async checkForUpdate(currentVersion: string, channel: string) {
    const release = CURRENT_VERSIONS[channel] || CURRENT_VERSIONS.stable;
    const isUpToDate = currentVersion === release.version;
    const isCritical = release.isCritical;

    return {
      available: !isUpToDate,
      currentVersion,
      latestVersion: release.version,
      channel,
      releaseNotes: release.releaseNotes,
      minVersion: release.minVersion,
      isCritical,
      downloadUrl: `https://github.com/RosaeFinity/RosaeFinity/releases/download/v${release.version}`,
    };
  },

  async recordInstall(userId: string | undefined, fromVersion: string, toVersion: string, channel: string, platform?: string) {
    return updateRepository.recordUpdate({
      userId,
      fromVersion,
      toVersion,
      channel,
      status: 'installed',
      platform,
    });
  },

  async getStats() {
    return updateRepository.getUpdateStats();
  },

  async getRecent(limit = 50) {
    return updateRepository.getRecentUpdates(limit);
  },
};
