"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiError = void 0;
class ApiError extends Error {
    statusCode;
    code;
    details;
    constructor(statusCode, message, code, details) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.name = 'ApiError';
    }
    static badRequest(message, details) {
        return new ApiError(400, message, 'BAD_REQUEST', details);
    }
    static unauthorized(message = 'Unauthorized') {
        return new ApiError(401, message, 'UNAUTHORIZED');
    }
    static forbidden(message = 'Forbidden') {
        return new ApiError(403, message, 'FORBIDDEN');
    }
    static notFound(message = 'Resource not found') {
        return new ApiError(404, message, 'NOT_FOUND');
    }
    static conflict(message) {
        return new ApiError(409, message, 'CONFLICT');
    }
    static tooMany(message = 'Too many requests') {
        return new ApiError(429, message, 'TOO_MANY_REQUESTS');
    }
    static internal(message = 'Internal server error') {
        return new ApiError(500, message, 'INTERNAL_ERROR');
    }
}
exports.ApiError = ApiError;
//# sourceMappingURL=api-error.js.map