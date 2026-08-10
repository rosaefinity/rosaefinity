"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = void 0;
const api_error_1 = require("../utils/api-error");
const validate = (schema) => {
    return (req, _res, next) => {
        try {
            schema.parse({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        }
        catch (error) {
            if (error instanceof Error) {
                next(api_error_1.ApiError.badRequest('Validation failed', { errors: error.message }));
            }
            else {
                next(error);
            }
        }
    };
};
exports.validate = validate;
//# sourceMappingURL=validate.middleware.js.map