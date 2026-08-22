// =============================================
// RosaeFinity — Payment Repository
// =============================================

import { getPrisma } from '../../../database/client.js';
const prisma = getPrisma();

export const paymentRepository = {
  async findById(id: string) {
    return prisma.payment.findUnique({
      where: { id },
      include: { user: true, approvedBy: true, plan: true },
    });
  },

  async findByUser(userId: string) {
    return prisma.payment.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  },

  async findPendingById(id: string) {
    return prisma.payment.findFirst({
      where: { id, status: 'PENDING' },
      include: { user: true, plan: true },
    });
  },

  async create(data: {
    userId: string;
    planId?: string;
    amount: number;
    paymentMethod?: string;
    paymentProofUrl?: string;
    expiresAt?: Date;
  }) {
    return prisma.payment.create({
      data,
      include: { user: true, plan: true },
    });
  },

  async updateStatus(id: string, status: string, approvedById?: string, adminNotes?: string) {
    return prisma.payment.update({
      where: { id },
      data: {
        status,
        approvedById: approvedById || null,
        approvedAt: approvedById ? new Date() : null,
        adminNotes: adminNotes || undefined,
      },
      include: { user: true, approvedBy: true, plan: true },
    });
  },

  async getPendingPayments(page: number, limit: number) {
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where: { status: 'PENDING' },
        include: { user: true, plan: true },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
    ]);
    return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async getAllPayments(page: number, limit: number, status?: string) {
    const where = status ? { status } : {};
    const skip = (page - 1) * limit;
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: { user: true, approvedBy: true, plan: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.payment.count({ where }),
    ]);
    return { payments, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async countByStatus(status: string) {
    return prisma.payment.count({ where: { status } });
  },

  async getPlan(planId: string) {
    return prisma.plan.findUnique({ where: { id: planId } });
  },
};
