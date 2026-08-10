export declare class SubscriptionService {
    getCurrentPlan(userId: string): Promise<{
        plan: string;
        status: string;
        startDate: null;
        endDate: null;
        autoRenew: boolean;
        externalId?: undefined;
    } | {
        plan: import("@prisma/client").$Enums.SubscriptionPlans;
        status: import("@prisma/client").$Enums.SubscriptionStatuses;
        startDate: Date;
        endDate: Date;
        autoRenew: boolean;
        externalId: string | null;
    }>;
    upgrade(userId: string, plan: 'pro' | 'business'): Promise<{
        plan: import("@prisma/client").$Enums.SubscriptionPlans;
        status: import("@prisma/client").$Enums.SubscriptionStatuses;
        startDate: Date;
        endDate: Date;
    }>;
    downgrade(userId: string): Promise<{
        plan: string;
        status: string;
    }>;
    cancel(userId: string): Promise<{
        message: string;
    }>;
    renew(userId: string): Promise<{
        plan: import("@prisma/client").$Enums.SubscriptionPlans;
        status: string;
        endDate: Date;
    }>;
}
export declare const subscriptionService: SubscriptionService;
//# sourceMappingURL=subscription.service.d.ts.map