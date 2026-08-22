// =============================================
// RosaeFinity — Payment Service Tests
// =============================================

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so these are available inside vi.mock factories (which are hoisted)
const { mockPrisma, mockRepo } = vi.hoisted(() => ({
  mockPrisma: {
    payment: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    subscription: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    license: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    user: { update: vi.fn() },
    $transaction: vi.fn(),
  },
  mockRepo: {
    create: vi.fn(),
    findById: vi.fn(),
    findByUser: vi.fn(),
    findPendingById: vi.fn(),
    updateStatus: vi.fn(),
    getPendingPayments: vi.fn(),
    getAllPayments: vi.fn(),
  },
}));

vi.mock('../../../../database/client.js', () => ({
  getPrisma: () => mockPrisma,
}));

vi.mock('../repository.js', () => ({
  paymentRepository: mockRepo,
}));

import { paymentService } from '../service.js';

beforeEach(() => {
  vi.clearAllMocks();
});

const ADMIN_ID = 'admin-user-id';
const USER_ID = 'user-id';
const PAYMENT_ID = 'payment-id';

describe('submitPayment', () => {
  it('creates a PENDING payment with correct fields', async () => {
    mockPrisma.payment.findFirst.mockResolvedValue(null);
    mockRepo.create.mockResolvedValue({
      id: PAYMENT_ID, userId: USER_ID, planId: 'pro', amount: 150000,
      paymentMethod: 'qris', status: 'PENDING', createdAt: new Date(),
    });

    const result = await paymentService.submitPayment(USER_ID, 150000, 'qris');

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER_ID, amount: 150000, paymentMethod: 'qris' })
    );
    expect(result.status).toBe('PENDING');
  });

  it('rejects if amount is not positive', async () => {
    await expect(paymentService.submitPayment(USER_ID, 0)).rejects.toThrow('Amount must be positive');
    await expect(paymentService.submitPayment(USER_ID, -100)).rejects.toThrow('Amount must be positive');
  });

  it('rejects if user has an existing pending payment', async () => {
    mockPrisma.payment.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(paymentService.submitPayment(USER_ID, 150000)).rejects.toThrow('already have a pending payment');
  });
});

describe('approvePayment', () => {
  const pendingPayment = {
    id: PAYMENT_ID, userId: USER_ID, planId: 'pro', status: 'PENDING',
    user: { id: USER_ID, email: 'user@test.com' },
    plan: { id: 'pro', name: 'Pro' },
  };

  it('approves payment and activates Pro subscription in a transaction', async () => {
    mockRepo.findPendingById.mockResolvedValue(pendingPayment);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        payment: { update: vi.fn().mockResolvedValue({ ...pendingPayment, status: 'PAID', approvedById: ADMIN_ID }) },
        subscription: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
        license: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
        user: { update: vi.fn().mockResolvedValue({}) },
      };
      return fn(tx);
    });

    const result = await paymentService.approvePayment(PAYMENT_ID, ADMIN_ID);
    expect(mockPrisma.$transaction).toHaveBeenCalled();
    expect(result.status).toBe('PAID');
    expect(result.approvedById).toBe(ADMIN_ID);
  });

  it('throws if payment is not found or not pending', async () => {
    mockRepo.findPendingById.mockResolvedValue(null);
    await expect(paymentService.approvePayment(PAYMENT_ID, ADMIN_ID)).rejects.toThrow('not found or not pending');
  });

  it('prevents double-approval', async () => {
    mockRepo.findPendingById.mockResolvedValue(null);
    await expect(paymentService.approvePayment(PAYMENT_ID, ADMIN_ID)).rejects.toThrow('not found or not pending');
  });

  it('creates subscription and license, and updates user accountType', async () => {
    mockRepo.findPendingById.mockResolvedValue(pendingPayment);
    const txMocks = {
      payment: { update: vi.fn().mockResolvedValue({}) },
      subscription: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      license: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({}) },
      user: { update: vi.fn().mockResolvedValue({}) },
    };
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(txMocks));

    await paymentService.approvePayment(PAYMENT_ID, ADMIN_ID);

    expect(txMocks.subscription.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: USER_ID, planId: 'pro', status: 'active' }) })
    );
    expect(txMocks.license.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: USER_ID, planId: 'pro', status: 'active' }) })
    );
    expect(txMocks.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: USER_ID }, data: { accountType: 'pro' } })
    );
  });

  it('rolls back if subscription activation fails', async () => {
    mockRepo.findPendingById.mockResolvedValue(pendingPayment);
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      const tx = {
        payment: { update: vi.fn().mockResolvedValue({}) },
        subscription: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockRejectedValue(new Error('DB error')) },
        license: { findFirst: vi.fn(), create: vi.fn() },
        user: { update: vi.fn() },
      };
      return fn(tx);
    });
    await expect(paymentService.approvePayment(PAYMENT_ID, ADMIN_ID)).rejects.toThrow('DB error');
  });
});

describe('rejectPayment', () => {
  it('sets status to REJECTED with notes', async () => {
    mockRepo.findPendingById.mockResolvedValue({ id: PAYMENT_ID, status: 'PENDING' });
    mockRepo.updateStatus.mockResolvedValue({ id: PAYMENT_ID, status: 'REJECTED', adminNotes: 'Invalid proof' });

    const result = await paymentService.rejectPayment(PAYMENT_ID, ADMIN_ID, 'Invalid proof');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(PAYMENT_ID, 'REJECTED', ADMIN_ID, 'Invalid proof');
    expect(result.status).toBe('REJECTED');
  });

  it('throws if payment is not pending', async () => {
    mockRepo.findPendingById.mockResolvedValue(null);
    await expect(paymentService.rejectPayment(PAYMENT_ID, ADMIN_ID)).rejects.toThrow('not found or not pending');
  });
});

describe('getUserPayments', () => {
  it('returns user payment history', async () => {
    mockRepo.findByUser.mockResolvedValue([{ id: 'p1', userId: USER_ID }]);
    const result = await paymentService.getUserPayments(USER_ID);
    expect(result).toHaveLength(1);
    expect(mockRepo.findByUser).toHaveBeenCalledWith(USER_ID);
  });
});
