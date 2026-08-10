"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRepository = exports.UserRepository = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
class UserRepository {
    async findByEmail(email) {
        return prisma_1.default.users.findUnique({ where: { email } });
    }
    async findByUsername(username) {
        return prisma_1.default.users.findUnique({ where: { username } });
    }
    async findById(id) {
        return prisma_1.default.users.findUnique({ where: { id } });
    }
    async create(data) {
        return prisma_1.default.users.create({ data });
    }
    async update(id, data) {
        return prisma_1.default.users.update({ where: { id }, data });
    }
    async delete(id) {
        return prisma_1.default.users.delete({ where: { id } });
    }
}
exports.UserRepository = UserRepository;
exports.userRepository = new UserRepository();
//# sourceMappingURL=user.repository.js.map