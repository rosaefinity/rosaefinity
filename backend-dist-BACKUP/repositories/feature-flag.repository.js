"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.featureFlagRepository = exports.FeatureFlagRepository = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
class FeatureFlagRepository {
    async findAllEnabled() {
        return prisma_1.default.featureFlags.findMany({
            where: { isEnabled: true },
        });
    }
    async findByKey(key) {
        return prisma_1.default.featureFlags.findUnique({ where: { key } });
    }
    async create(data) {
        return prisma_1.default.featureFlags.create({
            data: {
                key: data.key,
                name: data.name,
                description: data.description,
                flagType: data.flagType || 'boolean',
                isEnabled: false,
                createdBy: data.createdBy,
            },
        });
    }
    async update(key, data) {
        return prisma_1.default.featureFlags.update({
            where: { key },
            data,
        });
    }
}
exports.FeatureFlagRepository = FeatureFlagRepository;
exports.featureFlagRepository = new FeatureFlagRepository();
//# sourceMappingURL=feature-flag.repository.js.map