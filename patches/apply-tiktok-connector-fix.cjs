#!/usr/bin/env node
// =============================================
// Patches tiktok-live-connector@2.4.0 to fix
// SignatureRateLimitError receiving response.data
// instead of the full response object.
//
// Bug: throw new SignatureRateLimitError(..., response.data)
// Fix: throw new SignatureRateLimitError(..., response)
//
// The constructor expects response.headers["retry-after"],
// but response.data is the parsed body with no headers.
// This causes: TypeError: Cannot read properties of undefined
//   (reading 'retry-after')
//
// Also makes calculateRetryAfter/calculateResetTime defensive
// against missing response/headers.
// =============================================

const fs = require('fs');
const path = require('path');

const TARGET = path.join(
  __dirname, '..', 'node_modules', 'tiktok-live-connector', 'dist', 'lib-YL2P_UWg.js'
);

if (!fs.existsSync(TARGET)) {
  console.log('[patch] tiktok-live-connector dist file not found, skipping');
  process.exit(0);
}

let src = fs.readFileSync(TARGET, 'utf-8');
const original = src;

// Fix 1: Constructor — tolerate missing response/headers
src = src.replace(
  /constructor\(apiMessage, formatStr, response\) \{\s*const retryAfter = SignatureRateLimitError\.calculateRetryAfter\(response\);\s*const resetTime = SignatureRateLimitError\.calculateResetTime\(response\);\s*const logId = response\.headers\["x-log-id"\];\s*const agentId = response\.headers\["x-agent-id"\];/,
  `constructor(apiMessage, formatStr, response) {
		const retryAfter = SignatureRateLimitError.calculateRetryAfter(response);
		const resetTime = SignatureRateLimitError.calculateResetTime(response);
		const headers = response?.headers || {};
		const logId = headers["x-log-id"];
		const agentId = headers["x-agent-id"];`
);

// Fix 2: calculateRetryAfter — tolerate missing headers
src = src.replace(
  /static calculateRetryAfter\(response\) \{\s*return parseInt\(response\.headers\["retry-after"\] \|\| "0"\) \* 1e3;\s*\}/,
  `static calculateRetryAfter(response) {
		const headers = response?.headers || {};
		return parseInt(headers["retry-after"] || "0") * 1e3;
	}`
);

// Fix 3: calculateResetTime — tolerate missing headers
src = src.replace(
  /static calculateResetTime\(response\) \{\s*const value = response\.headers\["x-ratelimit-reset"\];\s*return value \? parseInt\(value\) \* 1e3 : void 0;\s*\}/,
  `static calculateResetTime(response) {
		const headers = response?.headers || {};
		const value = headers["x-ratelimit-reset"];
		return value ? parseInt(value) * 1e3 : void 0;
	}`
);

// Fix 4: ROOT CAUSE — pass full response instead of response.data
src = src.replace(
  /throw new SignatureRateLimitError\(process\.env\.SIGN_SERVER_MESSAGE_DISABLED \? null : data\?\.message, `\$\{data\?\.limit_label \? `\(\$\{data\.limit_label\}\) ` : ""\}Too many connections started, try again later\.`, response\.data\);/,
  `throw new SignatureRateLimitError(process.env.SIGN_SERVER_MESSAGE_DISABLED ? null : data?.message, \`\${data?.limit_label ? \`(\${data.limit_label}) \` : ""\}Too many connections started, try again later.\`, response);`
);

if (src === original) {
  console.log('[patch] tiktok-live-connector already patched');
} else {
  fs.writeFileSync(TARGET, src, 'utf-8');
  console.log('[patch] tiktok-live-connector patched: SignatureRateLimitError fix applied');
}
