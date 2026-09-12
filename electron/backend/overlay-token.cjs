// =============================================
// RosaeFinity — Overlay Token Generator
// Generates HMAC-signed overlay tokens for production URLs.
// =============================================

const crypto = require('crypto');
const { apiUrl } = require('./api-config.cjs');

/**
 * Generate an HMAC-SHA256 overlay token for a user.
 * @param {string} userId - The user's database ID
 * @param {string} jwtSecret - The JWT_SECRET from environment
 * @returns {string} The signed token
 */
function generateOverlayToken(userId, jwtSecret) {
  const payload = JSON.stringify({ userId, iat: Date.now() });
  const hmac = crypto.createHmac('sha256', jwtSecret);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  const token = Buffer.from(payload).toString('base64url') + '.' + signature;
  console.log('[OVERLAY-TOKEN] generating token');
  console.log('[OVERLAY-TOKEN] userId:', userId);
  console.log('[OVERLAY-TOKEN] secretLength:', jwtSecret?.length, 'isDefault:', jwtSecret === 'default-secret-change-me');
  console.log('[OVERLAY-TOKEN] generatedToken (first 20 chars):', token.substring(0, 20) + '...');
  console.log('[OVERLAY-TOKEN] payload:', payload);
  return token;
}

/**
 * Get the production HTTPS overlay URL for a goal.
 * @param {string} token - The overlay token
 * @returns {string} The full HTTPS URL
 */
function getOverlayUrl(token) {
  const url = `${apiUrl}/overlay/goal/${token}`;
  console.log('[OVERLAY-TOKEN] finalUrl:', url);
  return url;
}

module.exports = { generateOverlayToken, getOverlayUrl };
