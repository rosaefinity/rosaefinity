// =============================================
// RosaeFinity — Overlay Routes
// HTTPS endpoints for production browser sources.
// =============================================

import { Router, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  verifyOverlayToken,
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

// ─── GET /overlay/goal/:token — Serve overlay HTML ───
overlayRouter.get('/overlay/goal/:token', (req: Request, res: Response) => {
  const token = getToken(req);
  const userId = verifyOverlayToken(token);
  if (!userId) {
    res.status(401).json({ error: 'Invalid overlay token' });
    return;
  }

  // Serve the self-contained overlay HTML
  const htmlPaths = [
    path.join(__dirname, '../../../../public/goals-overlay.html'),
    path.join(__dirname, '../../../../dist/goals-overlay.html'),
  ];

  for (const htmlPath of htmlPaths) {
    try {
      if (fs.existsSync(htmlPath)) {
        const html = fs.readFileSync(htmlPath, 'utf-8');
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
