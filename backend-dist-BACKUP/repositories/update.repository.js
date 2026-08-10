"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateRepository = exports.UpdateRepository = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
class UpdateRepository {
    async findLatestVersion(platform) {
        return prisma_1.default.appVersions.findFirst({
            where: { platform, isLatest: true },
            orderBy: { createdAt: 'desc' },
        });
    }
    async findAllVersions(platform) {
        return prisma_1.default.appVersions.findMany({
            where: { platform },
            orderBy: { createdAt: 'desc' },
            take: 10,
        });
    }
    async createVersion(data) {
        return prisma_1.default.appVersions.create({
            data: {
                version: data.version,
                platform: data.platform,
                downloadUrl: data.downloadUrl,
                releaseNotes: data.releaseNotes,
                isMandatory: data.isMandatory || false,
                isLatest: true,
            },
        });
    }
}
exports.UpdateRepository = UpdateRepository;
exports.updateRepository = new UpdateRepository();
//# sourceMappingURL=update.repository.js.map