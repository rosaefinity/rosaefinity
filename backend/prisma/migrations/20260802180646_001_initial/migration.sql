-- CreateTable
CREATE TABLE `Users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `passwordHash` VARCHAR(255) NULL,
    `emailVerified` BOOLEAN NOT NULL DEFAULT false,
    `avatar` VARCHAR(500) NULL,
    `role` ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    `status` ENUM('active', 'suspended', 'deleted') NOT NULL DEFAULT 'active',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `Users_email_key`(`email`),
    UNIQUE INDEX `Users_username_key`(`username`),
    INDEX `Users_email_idx`(`email`),
    INDEX `Users_username_idx`(`username`),
    INDEX `Users_status_idx`(`status`),
    INDEX `Users_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `RefreshTokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `sessionId` CHAR(36) NULL,
    `deviceId` CHAR(36) NULL,
    `token` VARCHAR(500) NOT NULL,
    `expiresAt` TIMESTAMP(6) NOT NULL,
    `revokedAt` TIMESTAMP(6) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    UNIQUE INDEX `RefreshTokens_token_key`(`token`),
    INDEX `RefreshTokens_userId_idx`(`userId`),
    INDEX `RefreshTokens_sessionId_idx`(`sessionId`),
    INDEX `RefreshTokens_deviceId_idx`(`deviceId`),
    INDEX `RefreshTokens_token_idx`(`token`),
    INDEX `RefreshTokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Sessions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NULL,
    `sessionToken` VARCHAR(500) NOT NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(500) NULL,
    `lastActivityAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` TIMESTAMP(6) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    UNIQUE INDEX `Sessions_sessionToken_key`(`sessionToken`),
    INDEX `Sessions_userId_idx`(`userId`),
    INDEX `Sessions_deviceId_idx`(`deviceId`),
    INDEX `Sessions_sessionToken_idx`(`sessionToken`),
    INDEX `Sessions_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Devices` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `deviceId` VARCHAR(255) NOT NULL,
    `deviceName` VARCHAR(100) NOT NULL,
    `os` VARCHAR(50) NOT NULL,
    `cpu` VARCHAR(100) NULL,
    `ipAddress` VARCHAR(45) NULL,
    `lastLogin` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    UNIQUE INDEX `Devices_deviceId_key`(`deviceId`),
    INDEX `Devices_userId_idx`(`userId`),
    INDEX `Devices_deviceId_idx`(`deviceId`),
    INDEX `Devices_os_idx`(`os`),
    INDEX `Devices_lastLogin_idx`(`lastLogin`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserSettings` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NULL,
    `language` VARCHAR(10) NOT NULL DEFAULT 'en',
    `theme` ENUM('light', 'dark', 'system') NOT NULL DEFAULT 'system',
    `notificationsEnabled` BOOLEAN NOT NULL DEFAULT true,
    `soundEnabled` BOOLEAN NOT NULL DEFAULT true,
    `masterVolume` DOUBLE NOT NULL DEFAULT 0.8,
    `debugMode` BOOLEAN NOT NULL DEFAULT false,
    `tiktokLanguage` VARCHAR(10) NOT NULL DEFAULT 'en',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `UserSettings_userId_key`(`userId`),
    INDEX `UserSettings_userId_idx`(`userId`),
    INDEX `UserSettings_deviceId_idx`(`deviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Licenses` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NULL,
    `licenseKey` VARCHAR(50) NOT NULL,
    `type` ENUM('trial', 'personal', 'business') NOT NULL DEFAULT 'personal',
    `status` ENUM('active', 'expired', 'revoked') NOT NULL DEFAULT 'active',
    `activatedAt` TIMESTAMP(6) NULL,
    `expiredAt` TIMESTAMP(6) NULL,
    `hardwareFingerprint` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `Licenses_licenseKey_key`(`licenseKey`),
    INDEX `Licenses_userId_idx`(`userId`),
    INDEX `Licenses_licenseKey_idx`(`licenseKey`),
    INDEX `Licenses_status_idx`(`status`),
    INDEX `Licenses_expiredAt_idx`(`expiredAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivationHistory` (
    `id` VARCHAR(191) NOT NULL,
    `licenseId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NULL,
    `deviceId` VARCHAR(255) NULL,
    `hardwareFingerprint` VARCHAR(255) NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(500) NULL,
    `action` ENUM('activated', 'deactivated', 'reactivated') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    INDEX `ActivationHistory_licenseId_idx`(`licenseId`),
    INDEX `ActivationHistory_userId_idx`(`userId`),
    INDEX `ActivationHistory_action_idx`(`action`),
    INDEX `ActivationHistory_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `plan` ENUM('free', 'pro', 'business') NOT NULL DEFAULT 'free',
    `status` ENUM('active', 'cancelled', 'past_due', 'paused') NOT NULL DEFAULT 'active',
    `startDate` TIMESTAMP(6) NOT NULL,
    `endDate` TIMESTAMP(6) NOT NULL,
    `autoRenew` BOOLEAN NOT NULL DEFAULT true,
    `externalId` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `Subscriptions_userId_idx`(`userId`),
    INDEX `Subscriptions_status_idx`(`status`),
    INDEX `Subscriptions_plan_idx`(`plan`),
    INDEX `Subscriptions_externalId_idx`(`externalId`),
    INDEX `Subscriptions_endDate_idx`(`endDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Payments` (
    `id` VARCHAR(191) NOT NULL,
    `subscriptionId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `invoice` VARCHAR(100) NOT NULL,
    `gateway` ENUM('stripe', 'paypal', 'crypto') NOT NULL,
    `amount` DECIMAL(10, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL DEFAULT 'USD',
    `paymentStatus` ENUM('pending', 'completed', 'failed', 'refunded') NOT NULL,
    `paidAt` TIMESTAMP(6) NULL,
    `externalId` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    UNIQUE INDEX `Payments_invoice_key`(`invoice`),
    INDEX `Payments_subscriptionId_idx`(`subscriptionId`),
    INDEX `Payments_userId_idx`(`userId`),
    INDEX `Payments_invoice_idx`(`invoice`),
    INDEX `Payments_paymentStatus_idx`(`paymentStatus`),
    INDEX `Payments_paidAt_idx`(`paidAt`),
    INDEX `Payments_externalId_idx`(`externalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OverlayScenes` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `thumbnailUrl` VARCHAR(500) NULL,
    `isTemplate` BOOLEAN NOT NULL DEFAULT false,
    `overlayType` ENUM('gift', 'alert', 'goal', 'game', 'interactive', 'sports', 'music', 'trending') NOT NULL,
    `settings` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `OverlayScenes_userId_idx`(`userId`),
    INDEX `OverlayScenes_deviceId_idx`(`deviceId`),
    INDEX `OverlayScenes_isTemplate_idx`(`isTemplate`),
    INDEX `OverlayScenes_overlayType_idx`(`overlayType`),
    INDEX `OverlayScenes_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OverlayInstances` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `sceneId` CHAR(36) NULL,
    `deviceId` CHAR(36) NULL,
    `screenId` VARCHAR(20) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `positionX` DOUBLE NOT NULL DEFAULT 0,
    `positionY` DOUBLE NOT NULL DEFAULT 0,
    `scaleX` DOUBLE NOT NULL DEFAULT 1,
    `scaleY` DOUBLE NOT NULL DEFAULT 1,
    `opacity` DOUBLE NOT NULL DEFAULT 1,
    `zIndex` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `OverlayInstances_userId_idx`(`userId`),
    INDEX `OverlayInstances_sceneId_idx`(`sceneId`),
    INDEX `OverlayInstances_deviceId_idx`(`deviceId`),
    INDEX `OverlayInstances_screenId_idx`(`screenId`),
    INDEX `OverlayInstances_isActive_idx`(`isActive`),
    INDEX `OverlayInstances_userId_screenId_idx`(`userId`, `screenId`),
    INDEX `OverlayInstances_userId_isActive_idx`(`userId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OverlaySettings` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NULL,
    `theme` ENUM('light', 'dark', 'system') NOT NULL DEFAULT 'system',
    `primaryColor` VARCHAR(7) NOT NULL DEFAULT '#6366f1',
    `secondaryColor` VARCHAR(7) NOT NULL DEFAULT '#8b5cf6',
    `transparency` DOUBLE NOT NULL DEFAULT 1,
    `scale` DOUBLE NOT NULL DEFAULT 1,
    `borderRadius` INTEGER NOT NULL DEFAULT 8,
    `animationSpeed` ENUM('slow', 'normal', 'fast') NOT NULL DEFAULT 'normal',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `OverlaySettings_userId_key`(`userId`),
    INDEX `OverlaySettings_userId_idx`(`userId`),
    INDEX `OverlaySettings_deviceId_idx`(`deviceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActionGroups` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `ActionGroups_userId_idx`(`userId`),
    INDEX `ActionGroups_sortOrder_idx`(`sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Actions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `groupId` CHAR(36) NULL,
    `deviceId` CHAR(36) NULL,
    `name` VARCHAR(100) NOT NULL,
    `screen` VARCHAR(20) NOT NULL,
    `duration` INTEGER NOT NULL DEFAULT 5,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `soundEnabled` BOOLEAN NOT NULL DEFAULT false,
    `soundFileId` CHAR(36) NULL,
    `soundVolume` DOUBLE NOT NULL DEFAULT 0.8,
    `soundFadeIn` DOUBLE NOT NULL DEFAULT 0,
    `soundFadeOut` DOUBLE NOT NULL DEFAULT 0,
    `soundLoop` BOOLEAN NOT NULL DEFAULT false,
    `soundDelay` INTEGER NOT NULL DEFAULT 0,
    `videoEnabled` BOOLEAN NOT NULL DEFAULT false,
    `videoFileId` CHAR(36) NULL,
    `videoAutoplay` BOOLEAN NOT NULL DEFAULT true,
    `videoLoop` BOOLEAN NOT NULL DEFAULT false,
    `videoSpeed` DOUBLE NOT NULL DEFAULT 1,
    `videoFadeIn` DOUBLE NOT NULL DEFAULT 0,
    `videoFadeOut` DOUBLE NOT NULL DEFAULT 0,
    `imageEnabled` BOOLEAN NOT NULL DEFAULT false,
    `imageFileId` CHAR(36) NULL,
    `imageOpacity` DOUBLE NOT NULL DEFAULT 1,
    `imageScale` DOUBLE NOT NULL DEFAULT 1,
    `imagePositionX` DOUBLE NOT NULL DEFAULT 0,
    `imagePositionY` DOUBLE NOT NULL DEFAULT 0,
    `imageAnimation` VARCHAR(50) NULL,
    `keystrokeEnabled` BOOLEAN NOT NULL DEFAULT false,
    `keystrokeKeys` VARCHAR(100) NULL,
    `keystrokeHoldMs` INTEGER NOT NULL DEFAULT 0,
    `keystrokeDuration` INTEGER NOT NULL DEFAULT 0,
    `minecraftEnabled` BOOLEAN NOT NULL DEFAULT false,
    `minecraftCommand` VARCHAR(500) NULL,
    `minecraftQueue` BOOLEAN NOT NULL DEFAULT false,
    `minecraftCooldown` INTEGER NOT NULL DEFAULT 0,
    `minecraftDelay` INTEGER NOT NULL DEFAULT 0,
    `minecraftRandom` BOOLEAN NOT NULL DEFAULT false,
    `advancedSettings` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `Actions_userId_idx`(`userId`),
    INDEX `Actions_groupId_idx`(`groupId`),
    INDEX `Actions_deviceId_idx`(`deviceId`),
    INDEX `Actions_screen_idx`(`screen`),
    INDEX `Actions_enabled_idx`(`enabled`),
    INDEX `Actions_soundFileId_idx`(`soundFileId`),
    INDEX `Actions_videoFileId_idx`(`videoFileId`),
    INDEX `Actions_imageFileId_idx`(`imageFileId`),
    INDEX `Actions_userId_enabled_idx`(`userId`, `enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Goals` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NULL,
    `name` VARCHAR(100) NOT NULL,
    `type` ENUM('followers', 'likes', 'gifts', 'custom') NOT NULL,
    `targetValue` INTEGER NOT NULL,
    `currentValue` INTEGER NOT NULL DEFAULT 0,
    `resetOnComplete` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `Goals_userId_idx`(`userId`),
    INDEX `Goals_deviceId_idx`(`deviceId`),
    INDEX `Goals_type_idx`(`type`),
    INDEX `Goals_isActive_idx`(`isActive`),
    INDEX `Goals_userId_isActive_idx`(`userId`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MediaLibrary` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `size` BIGINT NOT NULL,
    `checksum` VARCHAR(64) NOT NULL,
    `localPath` VARCHAR(500) NULL,
    `cloudUrl` VARCHAR(500) NULL,
    `mediaType` ENUM('video', 'image') NOT NULL,
    `duration` DOUBLE NULL,
    `thumbnailUrl` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    INDEX `MediaLibrary_userId_idx`(`userId`),
    INDEX `MediaLibrary_mediaType_idx`(`mediaType`),
    INDEX `MediaLibrary_createdAt_idx`(`createdAt`),
    INDEX `MediaLibrary_checksum_idx`(`checksum`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SoundLibrary` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `fileName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(100) NOT NULL,
    `size` BIGINT NOT NULL,
    `checksum` VARCHAR(64) NOT NULL,
    `localPath` VARCHAR(500) NULL,
    `cloudUrl` VARCHAR(500) NULL,
    `duration` DOUBLE NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    INDEX `SoundLibrary_userId_idx`(`userId`),
    INDEX `SoundLibrary_enabled_idx`(`enabled`),
    INDEX `SoundLibrary_createdAt_idx`(`createdAt`),
    INDEX `SoundLibrary_checksum_idx`(`checksum`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BrowserSources` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NULL,
    `name` VARCHAR(100) NOT NULL,
    `url` VARCHAR(1000) NOT NULL,
    `width` INTEGER NOT NULL DEFAULT 1920,
    `height` INTEGER NOT NULL DEFAULT 1080,
    `refreshInterval` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `BrowserSources_userId_idx`(`userId`),
    INDEX `BrowserSources_deviceId_idx`(`deviceId`),
    INDEX `BrowserSources_isActive_idx`(`isActive`),
    INDEX `BrowserSources_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OBSSettings` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NULL,
    `ipAddress` VARCHAR(45) NOT NULL,
    `port` INTEGER NOT NULL DEFAULT 4455,
    `password` VARCHAR(255) NOT NULL,
    `sceneCollection` VARCHAR(100) NULL,
    `defaultScene` VARCHAR(100) NULL,
    `isConnected` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `OBSSettings_userId_key`(`userId`),
    INDEX `OBSSettings_userId_idx`(`userId`),
    INDEX `OBSSettings_deviceId_idx`(`deviceId`),
    INDEX `OBSSettings_isConnected_idx`(`isConnected`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `TikTokAccounts` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tiktokUsername` VARCHAR(100) NOT NULL,
    `tiktokUserId` VARCHAR(50) NOT NULL,
    `accessToken` TEXT NOT NULL,
    `refreshToken` TEXT NOT NULL,
    `tokenExpiresAt` TIMESTAMP(6) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `TikTokAccounts_tiktokUserId_key`(`tiktokUserId`),
    INDEX `TikTokAccounts_userId_idx`(`userId`),
    INDEX `TikTokAccounts_tiktokUsername_idx`(`tiktokUsername`),
    INDEX `TikTokAccounts_isActive_idx`(`isActive`),
    INDEX `TikTokAccounts_tokenExpiresAt_idx`(`tokenExpiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StreamProfiles` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `deviceId` CHAR(36) NULL,
    `tiktokAccountId` CHAR(36) NULL,
    `obsSettingsId` CHAR(36) NULL,
    `name` VARCHAR(100) NOT NULL,
    `isDefault` BOOLEAN NOT NULL DEFAULT false,
    `overlaySettings` JSON NULL,
    `alertSettings` JSON NULL,
    `pointsConfig` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    INDEX `StreamProfiles_userId_idx`(`userId`),
    INDEX `StreamProfiles_deviceId_idx`(`deviceId`),
    INDEX `StreamProfiles_tiktokAccountId_idx`(`tiktokAccountId`),
    INDEX `StreamProfiles_obsSettingsId_idx`(`obsSettingsId`),
    INDEX `StreamProfiles_isDefault_idx`(`isDefault`),
    INDEX `StreamProfiles_userId_isDefault_idx`(`userId`, `isDefault`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `EmailVerification` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `token` VARCHAR(500) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `purpose` ENUM('registration', 'email_change', 'account_recovery') NOT NULL,
    `expiresAt` TIMESTAMP(6) NOT NULL,
    `verifiedAt` TIMESTAMP(6) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    UNIQUE INDEX `EmailVerification_token_key`(`token`),
    INDEX `EmailVerification_userId_idx`(`userId`),
    INDEX `EmailVerification_token_idx`(`token`),
    INDEX `EmailVerification_purpose_idx`(`purpose`),
    INDEX `EmailVerification_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PasswordResetTokens` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `token` VARCHAR(500) NOT NULL,
    `expiresAt` TIMESTAMP(6) NOT NULL,
    `usedAt` TIMESTAMP(6) NULL,
    `ipAddress` VARCHAR(45) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    UNIQUE INDEX `PasswordResetTokens_token_key`(`token`),
    INDEX `PasswordResetTokens_userId_idx`(`userId`),
    INDEX `PasswordResetTokens_token_idx`(`token`),
    INDEX `PasswordResetTokens_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `APIKeys` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `keyHash` VARCHAR(255) NOT NULL,
    `prefix` VARCHAR(10) NOT NULL,
    `scopes` JSON NULL,
    `lastUsedAt` TIMESTAMP(6) NULL,
    `expiresAt` TIMESTAMP(6) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    UNIQUE INDEX `APIKeys_keyHash_key`(`keyHash`),
    INDEX `APIKeys_userId_idx`(`userId`),
    INDEX `APIKeys_keyHash_idx`(`keyHash`),
    INDEX `APIKeys_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLogs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NULL,
    `deviceId` CHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `resource` VARCHAR(100) NOT NULL,
    `resourceId` CHAR(36) NULL,
    `details` JSON NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    INDEX `AuditLogs_userId_idx`(`userId`),
    INDEX `AuditLogs_deviceId_idx`(`deviceId`),
    INDEX `AuditLogs_action_idx`(`action`),
    INDEX `AuditLogs_resource_idx`(`resource`),
    INDEX `AuditLogs_resourceId_idx`(`resourceId`),
    INDEX `AuditLogs_createdAt_idx`(`createdAt`),
    INDEX `AuditLogs_userId_createdAt_idx`(`userId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FeatureFlags` (
    `id` VARCHAR(191) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `isEnabled` BOOLEAN NOT NULL DEFAULT false,
    `createdBy` CHAR(36) NOT NULL,
    `targeting` JSON NULL,
    `flagType` ENUM('boolean', 'percentage', 'userList') NOT NULL DEFAULT 'boolean',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,

    UNIQUE INDEX `FeatureFlags_key_key`(`key`),
    INDEX `FeatureFlags_key_idx`(`key`),
    INDEX `FeatureFlags_isEnabled_idx`(`isEnabled`),
    INDEX `FeatureFlags_createdBy_idx`(`createdBy`),
    INDEX `FeatureFlags_flagType_idx`(`flagType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AppVersions` (
    `id` VARCHAR(191) NOT NULL,
    `version` VARCHAR(20) NOT NULL,
    `platform` VARCHAR(20) NOT NULL,
    `downloadUrl` VARCHAR(500) NOT NULL,
    `releaseNotes` TEXT NULL,
    `isMandatory` BOOLEAN NOT NULL DEFAULT false,
    `isLatest` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    UNIQUE INDEX `AppVersions_version_key`(`version`),
    INDEX `AppVersions_version_idx`(`version`),
    INDEX `AppVersions_platform_idx`(`platform`),
    INDEX `AppVersions_isLatest_idx`(`isLatest`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CrashReports` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NULL,
    `deviceId` CHAR(36) NULL,
    `appVersion` VARCHAR(20) NOT NULL,
    `platform` VARCHAR(20) NOT NULL,
    `stackTrace` TEXT NOT NULL,
    `systemInfo` JSON NULL,
    `status` ENUM('new', 'investigating', 'resolved', 'wont_fix') NOT NULL DEFAULT 'new',
    `resolvedBy` CHAR(36) NULL,
    `resolvedAt` TIMESTAMP(6) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    INDEX `CrashReports_userId_idx`(`userId`),
    INDEX `CrashReports_deviceId_idx`(`deviceId`),
    INDEX `CrashReports_appVersion_idx`(`appVersion`),
    INDEX `CrashReports_status_idx`(`status`),
    INDEX `CrashReports_resolvedBy_idx`(`resolvedBy`),
    INDEX `CrashReports_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookLogs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NULL,
    `event` VARCHAR(100) NOT NULL,
    `endpoint` VARCHAR(500) NOT NULL,
    `statusCode` INTEGER NOT NULL,
    `requestBody` TEXT NULL,
    `responseBody` TEXT NULL,
    `durationMs` INTEGER NOT NULL,
    `success` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    INDEX `WebhookLogs_userId_idx`(`userId`),
    INDEX `WebhookLogs_event_idx`(`event`),
    INDEX `WebhookLogs_statusCode_idx`(`statusCode`),
    INDEX `WebhookLogs_success_idx`(`success`),
    INDEX `WebhookLogs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BackupHistory` (
    `id` VARCHAR(191) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `backupType` VARCHAR(20) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `storageUrl` VARCHAR(500) NULL,
    `sizeBytes` BIGINT NULL,
    `startedAt` TIMESTAMP(6) NOT NULL,
    `completedAt` TIMESTAMP(6) NULL,
    `errorMessage` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` TIMESTAMP(6) NULL,

    INDEX `BackupHistory_userId_idx`(`userId`),
    INDEX `BackupHistory_status_idx`(`status`),
    INDEX `BackupHistory_startedAt_idx`(`startedAt`),
    INDEX `BackupHistory_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RefreshTokens` ADD CONSTRAINT `RefreshTokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshTokens` ADD CONSTRAINT `RefreshTokens_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `Sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RefreshTokens` ADD CONSTRAINT `RefreshTokens_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sessions` ADD CONSTRAINT `Sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Sessions` ADD CONSTRAINT `Sessions_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Devices` ADD CONSTRAINT `Devices_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSettings` ADD CONSTRAINT `UserSettings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserSettings` ADD CONSTRAINT `UserSettings_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Licenses` ADD CONSTRAINT `Licenses_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivationHistory` ADD CONSTRAINT `ActivationHistory_licenseId_fkey` FOREIGN KEY (`licenseId`) REFERENCES `Licenses`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivationHistory` ADD CONSTRAINT `ActivationHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subscriptions` ADD CONSTRAINT `Subscriptions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payments` ADD CONSTRAINT `Payments_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `Subscriptions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Payments` ADD CONSTRAINT `Payments_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OverlayScenes` ADD CONSTRAINT `OverlayScenes_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OverlayScenes` ADD CONSTRAINT `OverlayScenes_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OverlayInstances` ADD CONSTRAINT `OverlayInstances_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OverlayInstances` ADD CONSTRAINT `OverlayInstances_sceneId_fkey` FOREIGN KEY (`sceneId`) REFERENCES `OverlayScenes`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OverlayInstances` ADD CONSTRAINT `OverlayInstances_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OverlaySettings` ADD CONSTRAINT `OverlaySettings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OverlaySettings` ADD CONSTRAINT `OverlaySettings_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActionGroups` ADD CONSTRAINT `ActionGroups_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_groupId_fkey` FOREIGN KEY (`groupId`) REFERENCES `ActionGroups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_soundFileId_fkey` FOREIGN KEY (`soundFileId`) REFERENCES `SoundLibrary`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_videoFileId_fkey` FOREIGN KEY (`videoFileId`) REFERENCES `MediaLibrary`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Actions` ADD CONSTRAINT `Actions_imageFileId_fkey` FOREIGN KEY (`imageFileId`) REFERENCES `MediaLibrary`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goals` ADD CONSTRAINT `Goals_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Goals` ADD CONSTRAINT `Goals_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MediaLibrary` ADD CONSTRAINT `MediaLibrary_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SoundLibrary` ADD CONSTRAINT `SoundLibrary_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrowserSources` ADD CONSTRAINT `BrowserSources_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BrowserSources` ADD CONSTRAINT `BrowserSources_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OBSSettings` ADD CONSTRAINT `OBSSettings_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `OBSSettings` ADD CONSTRAINT `OBSSettings_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `TikTokAccounts` ADD CONSTRAINT `TikTokAccounts_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StreamProfiles` ADD CONSTRAINT `StreamProfiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StreamProfiles` ADD CONSTRAINT `StreamProfiles_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StreamProfiles` ADD CONSTRAINT `StreamProfiles_tiktokAccountId_fkey` FOREIGN KEY (`tiktokAccountId`) REFERENCES `TikTokAccounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StreamProfiles` ADD CONSTRAINT `StreamProfiles_obsSettingsId_fkey` FOREIGN KEY (`obsSettingsId`) REFERENCES `OBSSettings`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `EmailVerification` ADD CONSTRAINT `EmailVerification_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PasswordResetTokens` ADD CONSTRAINT `PasswordResetTokens_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `APIKeys` ADD CONSTRAINT `APIKeys_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLogs` ADD CONSTRAINT `AuditLogs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AuditLogs` ADD CONSTRAINT `AuditLogs_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FeatureFlags` ADD CONSTRAINT `FeatureFlags_createdBy_fkey` FOREIGN KEY (`createdBy`) REFERENCES `Users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrashReports` ADD CONSTRAINT `CrashReports_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrashReports` ADD CONSTRAINT `CrashReports_deviceId_fkey` FOREIGN KEY (`deviceId`) REFERENCES `Devices`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CrashReports` ADD CONSTRAINT `CrashReports_resolvedBy_fkey` FOREIGN KEY (`resolvedBy`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebhookLogs` ADD CONSTRAINT `WebhookLogs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BackupHistory` ADD CONSTRAINT `BackupHistory_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `Users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
