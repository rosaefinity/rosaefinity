export interface FeedbackData {
    userId: string;
    type: 'feedback' | 'bug' | 'feature';
    subject: string;
    message: string;
    email?: string;
    appVersion?: string;
    platform?: string;
}
export declare class FeedbackRepository {
    create(data: FeedbackData): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        userId: string | null;
        event: string;
        endpoint: string;
        statusCode: number;
        requestBody: string | null;
        responseBody: string | null;
        durationMs: number;
        success: boolean;
    }>;
    findByUserId(userId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        deletedAt: Date | null;
        userId: string | null;
        event: string;
        endpoint: string;
        statusCode: number;
        requestBody: string | null;
        responseBody: string | null;
        durationMs: number;
        success: boolean;
    }[]>;
}
export declare const feedbackRepository: FeedbackRepository;
//# sourceMappingURL=feedback.repository.d.ts.map