import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
export declare class FeedbackController {
    sendFeedback(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
    getFeedbackHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const feedbackController: FeedbackController;
//# sourceMappingURL=feedback.controller.d.ts.map