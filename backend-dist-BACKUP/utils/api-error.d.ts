export declare class ApiError extends Error {
    statusCode: number;
    code?: string | undefined;
    details?: Record<string, unknown> | undefined;
    constructor(statusCode: number, message: string, code?: string | undefined, details?: Record<string, unknown> | undefined);
    static badRequest(message: string, details?: Record<string, unknown>): ApiError;
    static unauthorized(message?: string): ApiError;
    static forbidden(message?: string): ApiError;
    static notFound(message?: string): ApiError;
    static conflict(message: string): ApiError;
    static tooMany(message?: string): ApiError;
    static internal(message?: string): ApiError;
}
//# sourceMappingURL=api-error.d.ts.map