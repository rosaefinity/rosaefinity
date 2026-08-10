"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.strictRateLimiter = exports.rateLimiter = void 0;
const rate_limiter_flexible_1 = require("rate-limiter-flexible");
const api_error_1 = require("../utils/api-error");
const env_1 = require("../config/env");
const windowMs = parseInt(env_1.env.RATE_LIMIT_WINDOW_MS, 10);
const maxRequests = parseInt(env_1.env.RATE_LIMIT_MAX_REQUESTS, 10);
const generalLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
    points: maxRequests,
    duration: windowMs / 1000,
});
const strictLimiter = new rate_limiter_flexible_1.RateLimiterMemory({
    points: 10,
    duration: 900,
});
const rateLimiter = async (req, _res, next) => {
    try {
        const key = req.ip || 'unknown';
        await generalLimiter.consume(key);
        next();
    }
    catch {
        next(api_error_1.ApiError.tooMany('Too many requests, please try again later'));
    }
};
exports.rateLimiter = rateLimiter;
const strictRateLimiter = async (req, _res, next) => {
    try {
        const key = req.ip || 'unknown';
        await strictLimiter.consume(key);
        next();
    }
    catch {
        next(api_error_1.ApiError.tooMany('Too many attempts, please try again later'));
    }
};
exports.strictRateLimiter = strictRateLimiter;
//# sourceMappingURL=rate-limit.middleware.js.map