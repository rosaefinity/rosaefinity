import { FeedbackData } from '../repositories/feedback.repository';
export declare class FeedbackService {
    sendFeedback(userId: string, data: Omit<FeedbackData, 'userId'>): Promise<{
        id: string;
        type: "feedback" | "bug" | "feature";
        subject: string;
        message: string;
        createdAt: Date;
    }>;
    getFeedbackHistory(userId: string): Promise<{
        id: string;
        event: string;
        createdAt: Date;
    }[]>;
}
export declare const feedbackService: FeedbackService;
//# sourceMappingURL=feedback.service.d.ts.map