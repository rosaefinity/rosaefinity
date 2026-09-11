// =============================================
// RosaeFinity Worker — Payment Routes
// =============================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../config.js';
import { getPrisma } from '../db.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { BadRequestError, NotFoundError } from '../middleware/error-handler.js';
import type { ApiResponse, JwtPayload } from '../types.js';
import type { AppEnv } from '../hono-types.js';

const payment = new Hono<AppEnv>();

const submitPaymentSchema = z.object({
  amount: z.number().int().positive(),
  paymentMethod: z.enum(['qris', 'bank_transfer', 'e_wallet']).default('qris'),
  proofUrl: z.string().url().optional(),
});

const rejectPaymentSchema = z.object({
  notes: z.string().max(500).optional(),
});

const PRO_SUBSCRIPTION_DAYS = 30;

// ── Submit payment ──
payment.post('/submit', authenticate, async (c) => {
  const user = c.get('user');
  const body = submitPaymentSchema.parse(await c.req.json());
  const prisma = getPrisma(c.env);

  if (body.amount <= 0) throw new BadRequestError('Amount must be positive');

  const existingPending = await prisma.payment.findFirst({
    where: { userId: user.sub, status: 'PENDING' },
  });
  if (existingPending) {
    throw new BadRequestError('You already have a pending payment. Please wait for it to be processed.');
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const paymentRecord = await prisma.payment.create({
    data: {
      userId: user.sub,
      planId: 'pro',
      amount: body.amount,
      paymentMethod: body.paymentMethod,
      paymentProofUrl: body.proofUrl,
      expiresAt,
    },
  });

  const response: ApiResponse = { success: true, data: paymentRecord };
  return c.json(response, 201);
});

// ── User's payments ──
payment.get('/my', authenticate, async (c) => {
  const user = c.get('user');
  const prisma = getPrisma(c.env);

  const payments = await prisma.payment.findMany({
    where: { userId: user.sub },
    include: { plan: true },
    orderBy: { createdAt: 'desc' },
  });

  const response: ApiResponse = { success: true, data: payments };
  return c.json(response);
});

// ── Admin: pending payments ──
payment.get('/pending', authenticate, requireRole('ADMIN'), async (c) => {
  const prisma = getPrisma(c.env);
  const page = Number(c.req.query('page')) || 1;
  const limit = Number(c.req.query('limit')) || 20;
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

  const response: ApiResponse = {
    success: true,
    data: payments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
  return c.json(response);
});

// ── Admin: all payments ──
payment.get('/all', authenticate, requireRole('ADMIN'), async (c) => {
  const prisma = getPrisma(c.env);
  const page = Number(c.req.query('page')) || 1;
  const limit = Number(c.req.query('limit')) || 20;
  const status = c.req.query('status');
  const skip = (page - 1) * limit;

  const where = status ? { status } : {};
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

  const response: ApiResponse = {
    success: true,
    data: payments,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
  return c.json(response);
});

// ── Get payment detail ──
payment.get('/:id', authenticate, async (c) => {
  const prisma = getPrisma(c.env);
  const id = c.req.param('id');

  const paymentRecord = await prisma.payment.findUnique({
    where: { id },
    include: { user: true, approvedBy: true, plan: true },
  });
  if (!paymentRecord) throw new NotFoundError('Payment not found');

  const response: ApiResponse = { success: true, data: paymentRecord };
  return c.json(response);
});

// ── Admin: approve payment ──
payment.post('/:id/approve', authenticate, requireRole('ADMIN'), async (c) => {
  const user = c.get('user');
  const prisma = getPrisma(c.env);
  const paymentId = c.req.param('id');

  const paymentRecord = await prisma.payment.findFirst({
    where: { id: paymentId, status: 'PENDING' },
    include: { user: true, plan: true },
  });
  if (!paymentRecord) throw new NotFoundError('Payment not found or not pending');

  const expiresAt = new Date(Date.now() + PRO_SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

  // Sequential operations (Neon HTTP adapter does not support interactive $transaction)
  const updatedPayment = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'PAID', approvedById: user.sub, approvedAt: new Date() },
  });

  const existingSub = await prisma.subscription.findFirst({
    where: { userId: paymentRecord.userId, planId: 'pro' },
  });

  if (existingSub) {
    await prisma.subscription.update({
      where: { id: existingSub.id },
      data: { status: 'active', provider: 'manual', currentPeriodStart: new Date(), currentPeriodEnd: expiresAt },
    });
  } else {
    await prisma.subscription.create({
      data: { userId: paymentRecord.userId, planId: 'pro', status: 'active', provider: 'manual', currentPeriodStart: new Date(), currentPeriodEnd: expiresAt },
    });
  }

  const existingLicense = await prisma.license.findFirst({
    where: { userId: paymentRecord.userId, planId: 'pro' },
  });

  if (existingLicense) {
    await prisma.license.update({
      where: { id: existingLicense.id },
      data: { status: 'active', expiresAt, activatedAt: new Date(), lastValidatedAt: new Date() },
    });
  } else {
    await prisma.license.create({
      data: { userId: paymentRecord.userId, planId: 'pro', status: 'active', expiresAt, activatedAt: new Date(), lastValidatedAt: new Date() },
    });
  }

  await prisma.user.update({ where: { id: paymentRecord.userId }, data: { accountType: 'pro' } });

  const result = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { user: true, approvedBy: true, plan: true },
  });

  const response: ApiResponse = { success: true, data: result };
  return c.json(response);
});

// ── Admin: reject payment ──
payment.post('/:id/reject', authenticate, requireRole('ADMIN'), async (c) => {
  const user = c.get('user');
  const prisma = getPrisma(c.env);
  const paymentId = c.req.param('id');
  const body = rejectPaymentSchema.parse(await c.req.json());

  const paymentRecord = await prisma.payment.findFirst({
    where: { id: paymentId, status: 'PENDING' },
  });
  if (!paymentRecord) throw new NotFoundError('Payment not found or not pending');

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: { status: 'REJECTED', approvedById: user.sub, approvedAt: new Date(), adminNotes: body.notes },
    include: { user: true, approvedBy: true, plan: true },
  });

  const response: ApiResponse = { success: true, data: updated };
  return c.json(response);
});

export { payment };
