import { Prisma } from '@prisma/client';
export declare class SubscriptionRepository {
    findByUserId(userId: string): Promise<{
        status: import("@prisma/client").$Enums.SubscriptionStatuses;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
        userId: string;
        plan: import("@prisma/client").$Enums.SubscriptionPlans;
        startDate: Date;
        endDate: Date;
        autoRenew: boolean;
        externalId: string | null;
    } | null>;
    findById(id: string): Promise<{
        status: import("@prisma/client").$Enums.SubscriptionStatuses;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
        userId: string;
        plan: import("@prisma/client").$Enums.SubscriptionPlans;
        startDate: Date;
        endDate: Date;
        autoRenew: boolean;
        externalId: string | null;
    } | null>;
    create(data: Prisma.SubscriptionsCreateInput): Promise<{
        status: import("@prisma/client").$Enums.SubscriptionStatuses;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
        userId: string;
        plan: import("@prisma/client").$Enums.SubscriptionPlans;
        startDate: Date;
        endDate: Date;
        autoRenew: boolean;
        externalId: string | null;
    }>;
    update(id: string, data: Prisma.SubscriptionsUpdateInput): Promise<{
        status: import("@prisma/client").$Enums.SubscriptionStatuses;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        version: number;
        userId: string;
        plan: import("@prisma/client").$Enums.SubscriptionPlans;
        startDate: Date;
        endDate: Date;
        autoRenew: boolean;
        externalId: string | null;
    }>;
    createPayment(data: Prisma.PaymentsCreateInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        userId: string;
        externalId: string | null;
        invoice: string;
        gateway: import("@prisma/client").$Enums.PaymentGateways;
        amount: Prisma.Decimal;
        currency: string;
        paymentStatus: import("@prisma/client").$Enums.PaymentStatuses;
        paidAt: Date | null;
        subscriptionId: string;
    }>;
}
export declare const subscriptionRepository: SubscriptionRepository;
//# sourceMappingURL=subscription.repository.d.ts.map