"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = void 0;
const api_error_1 = require("../utils/api-error");
const logger_1 = __importDefault(require("../utils/logger"));
const env_1 = require("../config/env");
const errorHandler = (err, req, res, _next) => {
    logger_1.default.error({
        err,
        req: {
            method: req.method,
            url: req.url,
        },
    });
    if (err instanceof api_error_1.ApiError) {
        const response = {
            success: false,
            error: {
                code: err.code || 'ERROR',
                message: err.message,
                details: err.details,
            },
        };
        res.status(err.statusCode).json(response);
        return;
    }
    const response = {
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: env_1.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
        },
    };
    res.status(500).json(response);
};
exports.errorHandler = errorHandler;
const notFoundHandler = (req, res) => {
    const response = {
        success: false,
        error: {
            code: 'NOT_FOUND',
            message: `Route ${req.method} ${req.url} not found`,
        },
    };
    res.status(404).json(response);
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=error.middleware.js.map