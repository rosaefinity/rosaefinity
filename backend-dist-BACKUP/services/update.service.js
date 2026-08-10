"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateService = exports.UpdateService = void 0;
const update_repository_1 = require("../repositories/update.repository");
const api_error_1 = require("../utils/api-error");
class UpdateService {
    async checkForUpdate(currentVersion, platform = 'windows') {
        const latest = await update_repository_1.updateRepository.findLatestVersion(platform);
        if (!latest) {
            throw api_error_1.ApiError.notFound('No version information available');
        }
        const current = this.parseVersion(currentVersion);
        const latestParsed = this.parseVersion(latest.version);
        const isUpdateAvailable = this.compareVersions(current, latestParsed) < 0;
        return {
            currentVersion,
            latestVersion: latest.version,
            isUpdateAvailable,
            isMandatory: latest.isMandatory,
            downloadUrl: latest.downloadUrl,
            releaseNotes: latest.releaseNotes,
        };
    }
    async getLatestVersion(platform = 'windows') {
        const latest = await update_repository_1.updateRepository.findLatestVersion(platform);
        if (!latest) {
            throw api_error_1.ApiError.notFound('No version information available');
        }
        return {
            version: latest.version,
            platform: latest.platform,
            downloadUrl: latest.downloadUrl,
            releaseNotes: latest.releaseNotes,
            isMandatory: latest.isMandatory,
            createdAt: latest.createdAt,
        };
    }
    async getVersionHistory(platform = 'windows') {
        return update_repository_1.updateRepository.findAllVersions(platform);
    }
    parseVersion(version) {
        return version.split('.').map(Number);
    }
    compareVersions(a, b) {
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
            const numA = a[i] || 0;
            const numB = b[i] || 0;
            if (numA !== numB) {
                return numA - numB;
            }
        }
        return 0;
    }
}
exports.UpdateService = UpdateService;
exports.updateService = new UpdateService();
//# sourceMappingURL=update.service.js.map