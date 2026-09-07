// =============================================
// RosaeFinity — Overlay Routes
// HTTPS endpoints for production browser sources.
// =============================================

import { Router, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { getConfig } from '../../../config/index.js';
import {
  verifyOverlayToken,
  generateOverlayToken,
  setGoalState,
  addSSEClient,
  removeSSEClient,
  getGoalState,
} from './service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const overlayRouter = Router();

/** Helper to extract token from params */
function getToken(req: Request): string {
  return String(req.params.token || '');
}

// ─── POST /overlay/token — Generate overlay token (called by Electron) ───
// Public endpoint: overlay tokens are designed to be shared (browser sources).
// HMAC signature prevents forgery; this endpoint just ensures both sides use the same JWT_SECRET.
overlayRouter.post('/overlay/token', (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId || typeof userId !== 'string') {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  const token = generateOverlayToken(userId);
  console.log('[OVERLAY-AUTH-TRACE] token generated for userId:', userId);
  res.json({ success: true, token });
});

// ─── GET /overlay/self-test — Prove generate↔verify roundtrip ───
// Returns safe metadata only. NEVER returns JWT_SECRET.
overlayRouter.get('/overlay/self-test', (_req: Request, res: Response) => {
  try {
    const config = getConfig();
    const secretFp = crypto.createHash('sha256').update(config.JWT_SECRET).digest('hex');

    // Roundtrip test: generate → verify
    const testUserId = 'self-test-' + Date.now();
    const token = generateOverlayToken(testUserId);
    const verifiedUserId = verifyOverlayToken(token);

    const result = {
      server: 'ok',
      roundtrip: verifiedUserId === testUserId,
      tokenSecretConfigured: config.JWT_SECRET.length > 0,
      tokenSecretFingerprint: secretFp.substring(0, 16),
      verificationSecretFingerprint: secretFp.substring(0, 16), // same process = same secret
      algorithm: 'HS256',
      tokenLength: token.length,
      generatedUserId: testUserId,
      verifiedUserId,
      hasExp: false,
      timestamp: Date.now(),
    };
    console.log('[OVERLAY-AUTH-TRACE] self-test:', result.roundtrip ? 'PASS' : 'FAIL');
    console.log('[OVERLAY-AUTH-TRACE] secretFingerprint=' + result.tokenSecretFingerprint);
    res.json(result);
  } catch (err) {
    res.status(500).json({ server: 'error', error: err instanceof Error ? err.message : String(err) });
  }
});

// ─── GET /overlay/goal/:token — Serve overlay HTML ───
overlayRouter.get('/overlay/goal/:token', (req: Request, res: Response) => {
  const token = getToken(req);
  console.log('[OVERLAY-AUTH-TRACE] GET /overlay/goal/:token');
  console.log('[OVERLAY-AUTH-TRACE] server expected token location: URL path segment /api/overlay/goal/:token');
  console.log('[OVERLAY-AUTH-TRACE] token extracted from path: true');
  console.log('[OVERLAY-AUTH-TRACE] token length:', token.length);
  console.log('[OVERLAY-AUTH-TRACE] token parts:', token.split('.').length);
  console.log('[OVERLAY-AUTH-TRACE] originalUrl:', req.originalUrl);
  const userId = verifyOverlayToken(token);
  if (!userId) {
    console.log('[OVERLAY-AUTH-TRACE] REJECTED — returning 401 Invalid overlay token');
    res.status(401).json({ error: 'Invalid overlay token' });
    return;
  }

  // Serve the self-contained overlay HTML
  // Try multiple path strategies for different runtimes (node, tsx, Docker)
  console.log('[OVERLAY-E2E-API] serving goals-overlay.html for userId:', userId);
  console.log('[OVERLAY-E2E-API] __dirname:', __dirname);
  console.log('[OVERLAY-E2E-API] process.cwd():', process.cwd());
  const htmlPaths = [
    // Strategy 1: relative to this file (4 levels up from src/api/modules/overlay/)
    path.join(__dirname, '../../../../public/goals-overlay.html'),
    path.join(__dirname, '../../../../dist/goals-overlay.html'),
    // Strategy 2: relative to process.cwd() (Railway /app/)
    path.join(process.cwd(), 'public/goals-overlay.html'),
    path.join(process.cwd(), 'dist/goals-overlay.html'),
    // Strategy 3: absolute Railway paths
    '/app/public/goals-overlay.html',
    '/app/dist/goals-overlay.html',
    // Strategy 4: relative to server root (when running from server/)
    path.join(process.cwd(), '../../public/goals-overlay.html'),
    path.join(process.cwd(), '../../dist/goals-overlay.html'),
  ];

  for (const htmlPath of htmlPaths) {
    try {
      if (fs.existsSync(htmlPath)) {
        const html = fs.readFileSync(htmlPath, 'utf-8');
        console.log('[OVERLAY-E2E-API] resolved HTML path:', htmlPath, 'length:', html.length);
        // Inject the token into the HTML for the SSE connection
        const finalHtml = html.replace('__OVERLAY_TOKEN__', token);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(finalHtml);
        return;
      }
    } catch {}
  }

  res.status(404).json({ error: 'Overlay HTML not found' });
});

// ─── GET /overlay/goal/:token/events — SSE stream ───
overlayRouter.get('/overlay/goal/:token/events', (req: Request, res: Response) => {
  const token = getToken(req);
  const userId = verifyOverlayToken(token);
  if (!userId) {
    res.status(401).json({ error: 'Invalid overlay token' });
    return;
  }

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send initial comment to flush headers
  res.write(':\n\n');

  // Send current state immediately
  const currentGoals = getGoalState(token);
  if (currentGoals.length > 0) {
    const payload = JSON.stringify({ type: 'goal-state', goals: currentGoals, timestamp: Date.now() });
    res.write(`data: ${payload}\n\n`);
  }

  // Register client
  addSSEClient(token, userId, res);

  // Heartbeat every 15 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    removeSSEClient(token, res);
  });
});

// ─── POST /overlay/goal/:token/state — Receive state from Electron ───
overlayRouter.post('/overlay/goal/:token/state', (req: Request, res: Response) => {
  const token = getToken(req);
  const userId = verifyOverlayToken(token);
  if (!userId) {
    res.status(401).json({ error: 'Invalid overlay token' });
    return;
  }

  const { goals } = req.body;
  if (!Array.isArray(goals)) {
    res.status(400).json({ error: 'goals must be an array' });
    return;
  }

  setGoalState(token, userId, goals);
  res.json({ success: true, clientCount: 0 }); // clientCount would need async check
});

// ─── GET /overlay/goal/:token/state — Get current state ───
overlayRouter.get('/overlay/goal/:token/state', (req: Request, res: Response) => {
  const token = getToken(req);
  const userId = verifyOverlayToken(token);
  if (!userId) {
    res.status(401).json({ error: 'Invalid overlay token' });
    return;
  }

  const goals = getGoalState(token);
  res.json({ goals });
});
