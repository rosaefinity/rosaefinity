"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deviceRepository = exports.DeviceRepository = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
class DeviceRepository {
    async findByDeviceId(deviceId) {
        return prisma_1.default.devices.findUnique({ where: { deviceId } });
    }
    async findByUserId(userId) {
        return prisma_1.default.devices.findMany({ where: { userId } });
    }
    async create(data) {
        return prisma_1.default.devices.create({ data });
    }
    async update(id, data) {
        return prisma_1.default.devices.update({ where: { id }, data });
    }
    async delete(id) {
        return prisma_1.default.devices.delete({ where: { id } });
    }
}
exports.DeviceRepository = DeviceRepository;
exports.deviceRepository = new DeviceRepository();
//# sourceMappingURL=device.repository.js.map