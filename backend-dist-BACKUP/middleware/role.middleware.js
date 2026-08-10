"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuthenticated = exports.requireModerator = exports.requireSupport = exports.requireAdmin = exports.requireRole = void 0;
const api_error_1 = require("../utils/api-error");
const requireRole = (...roles) => {
    return (req, _res, next) => {
        if (!req.user) {
            next(api_error_1.ApiError.unauthorized('Authentication required'));
            return;
        }
        const user = req.user;
        const userRole = user.role;
        if (!userRole || !roles.includes(userRole)) {
            next(api_error_1.ApiError.forbidden('Insufficient permissions'));
            return;
        }
        next();
    };
};
exports.requireRole = requireRole;
exports.requireAdmin = (0, exports.requireRole)('ADMIN', 'SUPER_ADMIN');
exports.requireSupport = (0, exports.requireRole)('SUPPORT', 'ADMIN', 'SUPER_ADMIN');
exports.requireModerator = (0, exports.requireRole)('MODERATOR', 'SUPPORT', 'ADMIN', 'SUPER_ADMIN');
exports.requireAuthenticated = (0, exports.requireRole)('USER', 'MODERATOR', 'SUPPORT', 'ADMIN', 'SUPER_ADMIN');
//# sourceMappingURL=role.middleware.js.map