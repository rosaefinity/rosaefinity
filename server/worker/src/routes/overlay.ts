// =============================================
// RosaeFinity Worker — Overlay Routes
// SSE streaming and overlay token management.
// NOTE: Electron local server (127.0.0.1:18890) remains
// the PRIMARY overlay real-time server. These routes are
// secondary/backup for HTTPS browser sources.
// =============================================

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import type { Env } from '../config.js';
import { getConfig } from '../config.js';
import { hmacSign, hmacVerify, base64urlEncode, base64urlDecode, sha256 } from '../crypto.js';
import type { ApiResponse, GoalState } from '../types.js';
import type { AppEnv } from '../hono-types.js';

const overlay = new Hono<AppEnv>();

// ─── In-Memory State Store ───
// NOTE: Workers are stateless — this state is per-isolate.
// For production, use Durable Objects or Workers KV.
interface OverlaySession {
  userId: string;
  goals: GoalState[];
}
const sessions = new Map<string, OverlaySession>();

function getOrCreateSession(token: string, userId: string): OverlaySession {
  let session = sessions.get(token);
  if (!session) {
    session = { userId, goals: [] };
    sessions.set(token, session);
  }
  return session;
}

// ─── Token Generation & Verification ───

export async function generateOverlayToken(userId: string, secret: string): Promise<string> {
  const payload = JSON.stringify({ userId, iat: Date.now() });
  const signature = await hmacSign(payload, secret);
  return base64urlEncode(payload) + '.' + signature;
}

export async function verifyOverlayToken(token: string, secret: string): Promise<string | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    if (!payloadB64 || !signature) return null;

    const payload = base64urlDecode(payloadB64);
    const valid = await hmacVerify(payload, signature, secret);
    if (!valid) return null;

    const parsed = JSON.parse(payload);
    return parsed.userId || null;
  } catch {
    return null;
  }
}

// ─── POST /overlay/token — Generate overlay token ───
overlay.post('/token', async (c) => {
  const { userId } = await c.req.json();
  if (!userId || typeof userId !== 'string') {
    const response: ApiResponse = { success: false, error: 'userId is required' };
    return c.json(response, 400);
  }

  const config = getConfig(c.env);
  const token = await generateOverlayToken(userId, config.JWT_SECRET);

  const response: ApiResponse = { success: true, data: { token } };
  return c.json(response);
});

// ─── GET /overlay/self-test — Prove generate↔verify roundtrip ───
overlay.get('/self-test', async (c) => {
  try {
    const config = getConfig(c.env);
    const secretFp = await sha256(config.JWT_SECRET);

    const testUserId = 'self-test-' + Date.now();
    const token = await generateOverlayToken(testUserId, config.JWT_SECRET);
    const verifiedUserId = await verifyOverlayToken(token, config.JWT_SECRET);

    const result = {
      server: 'ok',
      runtime: 'cloudflare-workers',
      roundtrip: verifiedUserId === testUserId,
      tokenSecretConfigured: config.JWT_SECRET.length > 0,
      tokenSecretFingerprint: secretFp.substring(0, 16),
      verificationSecretFingerprint: secretFp.substring(0, 16),
      algorithm: 'HMAC-SHA256',
      tokenLength: token.length,
      generatedUserId: testUserId,
      verifiedUserId,
      hasExp: false,
      timestamp: Date.now(),
    };
    return c.json(result);
  } catch (err) {
    return c.json({ server: 'error', error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

// ─── GET /overlay/goal/:token — Serve overlay HTML ───
overlay.get('/goal/:token', async (c) => {
  const token = c.req.param('token');
  const config = getConfig(c.env);
  const userId = await verifyOverlayToken(token, config.JWT_SECRET);

  if (!userId) {
    const response: ApiResponse = { success: false, error: 'Invalid overlay token' };
    return c.json(response, 401);
  }

  // Return a minimal overlay HTML page
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>RosaeFinity Goal Overlay</title></head>
<body>
<script>
  const TOKEN = '${token}';
  const SSE_URL = window.location.origin + '/api/overlay/goal/' + TOKEN + '/events';
  const evtSource = new EventSource(SSE_URL);
  evtSource.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'goal-state') {
      document.getElementById('goals').innerHTML = data.goals.map(g =>
        '<div class="goal"><h3>' + g.title + '</h3>' +
        '<div class="bar" style="width:' + Math.min(100, (g.current / g.target) * 100) + '%;background:' + g.barColor + '"></div>' +
        '<p>' + g.current + ' / ' + g.target + '</p></div>'
      ).join('');
    }
  };
</script>
<div id="goals"></div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

// ─── GET /overlay/goal/:token/events — SSE stream ───
overlay.get('/goal/:token/events', async (c) => {
  const token = c.req.param('token');
  const config = getConfig(c.env);
  const userId = await verifyOverlayToken(token, config.JWT_SECRET);

  if (!userId) {
    return c.json({ error: 'Invalid overlay token' }, 401);
  }

  const session = getOrCreateSession(token, userId);

  return streamSSE(c, async (stream) => {
    // Send initial state
    if (session.goals.length > 0) {
      const payload = JSON.stringify({ type: 'goal-state', goals: session.goals, timestamp: Date.now() });
      await stream.writeSSE({ data: payload });
    }

    // Keep connection alive via heartbeat
    let alive = true;
    const interval = setInterval(() => {
      if (alive) {
        stream.writeln(': heartbeat').catch(() => {
          alive = false;
          clearInterval(interval);
        });
      }
    }, 15000);

    stream.onAbort(() => {
      alive = false;
      clearInterval(interval);
    });

    while (alive) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });
});

// ─── POST /overlay/goal/:token/state — Receive state from Electron ───
overlay.post('/goal/:token/state', async (c) => {
  const token = c.req.param('token');
  const config = getConfig(c.env);
  const userId = await verifyOverlayToken(token, config.JWT_SECRET);

  if (!userId) {
    const response: ApiResponse = { success: false, error: 'Invalid overlay token' };
    return c.json(response, 401);
  }

  const { goals } = await c.req.json();
  if (!Array.isArray(goals)) {
    const response: ApiResponse = { success: false, error: 'goals must be an array' };
    return c.json(response, 400);
  }

  const session = getOrCreateSession(token, userId);
  session.goals = goals;

  const response: ApiResponse = { success: true, data: { success: true, clientCount: 0 } };
  return c.json(response);
});

// ─── GET /overlay/goal/:token/state — Get current state ───
overlay.get('/goal/:token/state', async (c) => {
  const token = c.req.param('token');
  const config = getConfig(c.env);
  const userId = await verifyOverlayToken(token, config.JWT_SECRET);

  if (!userId) {
    const response: ApiResponse = { success: false, error: 'Invalid overlay token' };
    return c.json(response, 401);
  }

  const session = sessions.get(token);
  const goals = session?.goals || [];

  const response: ApiResponse = { success: true, data: { goals } };
  return c.json(response);
});

export { overlay };
