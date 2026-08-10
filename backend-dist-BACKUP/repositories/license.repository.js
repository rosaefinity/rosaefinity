"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.licenseRepository = exports.LicenseRepository = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
class LicenseRepository {
    async findByKey(licenseKey) {
        return prisma_1.default.licenses.findUnique({ where: { licenseKey } });
    }
    async findByUserId(userId) {
        return prisma_1.default.licenses.findFirst({ where: { userId } });
    }
    async create(data) {
        return prisma_1.default.licenses.create({ data });
    }
    async update(id, data) {
        return prisma_1.default.licenses.update({ where: { id }, data });
    }
    async createActivationHistory(data) {
        return prisma_1.default.activationHistory.create({ data });
    }
}
exports.LicenseRepository = LicenseRepository;
exports.licenseRepository = new LicenseRepository();
//# sourceMappingURL=license.repository.js.map