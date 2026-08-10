// =============================================
// RosaeFinity — License Repository
// =============================================

import { getPrisma } from '../../../database/client.js';
const prisma = getPrisma();

export const licenseRepository = {
  async findActiveByUserId(userId: string) {
    return prisma.license.findFirst({
      where: { userId, status: { in: ['active', 'grace'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findByKey(licenseKey: string) {
    return prisma.license.findUnique({
      where: { licenseKey },
      include: { plan: true, user: true },
    });
  },

  async create(data: { userId: string; planId: string; licenseKey?: string; email?: string; expiresAt?: Date }) {
    return prisma.license.create({ data, include: { plan: true } });
  },

  async update(id: string, data: any) {
    return prisma.license.update({ where: { id }, data, include: { plan: true } });
  },

  async revoke(id: string) {
    return prisma.license.update({ where: { id }, data: { status: 'revoked' } });
  },

  async getPlan(planId: string) {
    return prisma.plan.findUnique({ where: { id: planId } });
  },

  async getAllPlans() {
    return prisma.plan.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } });
  },
};
