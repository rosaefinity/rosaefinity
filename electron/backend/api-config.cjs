// ═══════════════════════════════════════════════
// RosaeFinity — Backend API Configuration
// Single source of truth for the API base URL.
// ═══════════════════════════════════════════════

const API_BASE_URL = process.env.ROSAE_API_URL || "http://localhost:3000";
const API_PREFIX = process.env.ROSAE_API_PREFIX || "/api";

module.exports = {
  /** Full base URL for API requests, e.g. "http://localhost:3000/api" */
  apiUrl: `${API_BASE_URL}${API_PREFIX}`,
};
