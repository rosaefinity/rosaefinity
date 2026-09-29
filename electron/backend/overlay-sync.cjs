// =============================================
// RosaeFinity — Overlay Sync
// Pushes goal state to the production Railway backend.
// =============================================

const http = require('http');
const https = require('https');

/**
 * Push goal state to the Railway backend.
 * @param {string} token - The overlay token
 * @param {Array} goals - Array of goal state objects
 * @param {string} apiUrl - The backend API base URL
 * @returns {Promise<boolean>} Whether the push succeeded
 */
async function pushGoalState(token, goals, apiUrl) {
  const url = new URL(`${apiUrl}/overlay/goal/${token}/state`);
  const isHttps = url.protocol === 'https:';
  const client = isHttps ? https : http;

  const body = JSON.stringify({ goals });

  return new Promise((resolve) => {
    const req = client.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 10000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.success === true);
        } catch {
          resolve(false);
        }
      });
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.write(body);
    req.end();
  });
}

module.exports = { pushGoalState };
