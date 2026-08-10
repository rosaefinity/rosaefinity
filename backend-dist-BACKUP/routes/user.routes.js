"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_controller_1 = require("../controllers/user.controller");
const validate_middleware_1 = require("../middleware/validate.middleware");
const auth_middleware_1 = require("../middleware/auth.middleware");
const user_validator_1 = require("../validators/user.validator");
const router = (0, express_1.Router)();
/**
 * @swagger
 * /api/user/profile:
 *   get:
 *     tags: [User]
 *     summary: Get user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 */
router.get('/profile', auth_middleware_1.authenticate, user_controller_1.userController.getProfile);
/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     tags: [User]
 *     summary: Update user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               avatar:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 */
router.put('/profile', auth_middleware_1.authenticate, (0, validate_middleware_1.validate)(user_validator_1.updateProfileSchema), user_controller_1.userController.updateProfile);
/**
 * @swagger
 * /api/user/account:
 *   delete:
 *     tags: [User]
 *     summary: Delete user account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password, confirmation]
 *             properties:
 *               password:
 *                 type: string
 *               confirmation:
 *                 type: string
 *                 enum: [DELETE]
 *     responses:
 *       200:
 *         description: Account deleted
 */
router.delete('/account', auth_middleware_1.authenticate, (0, validate_middleware_1.validate)(user_validator_1.deleteAccountSchema), user_controller_1.userController.deleteAccount);
exports.default = router;
//# sourceMappingURL=user.routes.js.map