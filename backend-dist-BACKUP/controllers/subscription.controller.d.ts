import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare class SubscriptionController {
    getCurrentPlan(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    upgrade(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    downgrade(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    renew(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const subscriptionController: SubscriptionController;
//# sourceMappingURL=subscription.controller.d.ts.map