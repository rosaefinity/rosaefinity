// =============================================
// RosaeFinity — Payment Service
// =============================================

import { paymentRepository } from './repository.js';
import { getPrisma } from '../../../database/client.js';
import { BadRequestError, NotFoundError } from '../../middleware/error-handler.js';

const prisma = getPrisma();

const PRO_SUBSCRIPTION_DAYS = 30;

export const paymentService = {
  async submitPayment(userId: string, amount: number, paymentMethod: string = 'qris', proofUrl?: string) {
    if (amount <= 0) throw new BadRequestError('Amount must be positive');

    // Check for existing pending payment
    const existingPending = await prisma.payment.findFirst({
      where: { userId, status: 'PENDING' },
    });
    if (existingPending) {
      throw new BadRequestError('You already have a pending payment. Please wait for it to be processed.');
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const payment = await paymentRepository.create({
      userId,
      planId: 'pro',
      amount,
      paymentMethod,
      paymentProofUrl: proofUrl,
      expiresAt,
    });

    return payment;
  },

  async getUserPayments(userId: string) {
    return paymentRepository.findByUser(userId);
  },

  async getPendingPayments(page: number = 1, limit: number = 20) {
    return paymentRepository.getPendingPayments(page, limit);
  },

  async getAllPayments(page: number = 1, limit: number = 20, status?: string) {
    return paymentRepository.getAllPayments(page, limit, status);
  },

  async getPaymentById(paymentId: string) {
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) throw new NotFoundError('Payment not found');
    return payment;
  },

  /**
   * Approve a pending payment — activates Pro subscription.
   * Uses a database transaction so payment approval and subscription
   * activation cannot partially succeed.
   */
  async approvePayment(paymentId: string, adminUserId: string) {
    const payment = await paymentRepository.findPendingById(paymentId);
    if (!payment) throw new NotFoundError('Payment not found or not pending');

    const expiresAt = new Date(Date.now() + PRO_SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

    // Atomic transaction: approve payment + activate subscription
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update payment status to PAID
      const updatedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'PAID',
          approvedById: adminUserId,
          approvedAt: new Date(),
        },
        include: { user: true, approvedBy: true, plan: true },
      });

      // 2. Create or update Subscription record
      const existingSub = await tx.subscription.findFirst({
        where: { userId: payment.userId, planId: 'pro' },
      });

      if (existingSub) {
        await tx.subscription.update({
          where: { id: existingSub.id },
          data: {
            status: 'active',
            provider: 'manual',
            currentPeriodStart: new Date(),
            currentPeriodEnd: expiresAt,
          },
        });
      } else {
        await tx.subscription.create({
          data: {
            userId: payment.userId,
            planId: 'pro',
            status: 'active',
            provider: 'manual',
            currentPeriodStart: new Date(),
            currentPeriodEnd: expiresAt,
          },
        });
      }

      // 3. Create or update License record
      const existingLicense = await tx.license.findFirst({
        where: { userId: payment.userId, planId: 'pro' },
      });

      if (existingLicense) {
        await tx.license.update({
          where: { id: existingLicense.id },
          data: {
            status: 'active',
            expiresAt,
            activatedAt: new Date(),
            lastValidatedAt: new Date(),
          },
        });
      } else {
        await tx.license.create({
          data: {
            userId: payment.userId,
            planId: 'pro',
            status: 'active',
            expiresAt,
            activatedAt: new Date(),
            lastValidatedAt: new Date(),
          },
        });
      }

      // 4. Update user's accountType to 'pro'
      await tx.user.update({
        where: { id: payment.userId },
        data: { accountType: 'pro' },
      });

      return updatedPayment;
    });

    return result;
  },

  /**
   * Reject a pending payment.
   */
  async rejectPayment(paymentId: string, adminUserId: string, notes?: string) {
    const payment = await paymentRepository.findPendingById(paymentId);
    if (!payment) throw new NotFoundError('Payment not found or not pending');

    const updated = await paymentRepository.updateStatus(
      paymentId,
      'REJECTED',
      adminUserId,
      notes,
    );

    return updated;
  },
};
