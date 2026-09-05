// =============================================
// RosaeFinity — Overlay Service
// HTTPS overlay token management, in-memory state,
// and SSE streaming for production browser sources.
// =============================================

import crypto from 'crypto';
import { getConfig } from '../../../config/index.js';

// ─── Token Generation & Verification ───

/**
 * Generate an HMAC-SHA256 overlay token for a user.
 * The token encodes userId + issued-at, signed with JWT_SECRET.
 * One token per user — serves all their goals.
 */
export function generateOverlayToken(userId: string): string {
  const config = getConfig();
  const payload = JSON.stringify({ userId, iat: Date.now() });
  const hmac = crypto.createHmac('sha256', config.JWT_SECRET);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  // URL-safe base64 of payload + signature
  const token = Buffer.from(payload).toString('base64url') + '.' + signature;
  return token;
}

/**
 * Verify an overlay token and return the userId.
 * Returns null if token is invalid or tampered.
 */
export function verifyOverlayToken(token: string): string | null {
  try {
    const config = getConfig();
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const payload = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const hmac = crypto.createHmac('sha256', config.JWT_SECRET);
    hmac.update(payload);
    const expectedSig = hmac.digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) {
      return null;
    }

    const parsed = JSON.parse(payload);
    return parsed.userId || null;
  } catch {
    return null;
  }
}

// ─── In-Memory State Store ───

export interface GoalState {
  goalId: string;
  title: string;
  type: string;
  current: number;
  target: number;
  barColor: string;
  reached: boolean;
}

interface OverlaySession {
  userId: string;
  goals: GoalState[];
  sseClients: Set<import('http').ServerResponse>;
}

const sessions = new Map<string, OverlaySession>();

/**
 * Get or create an overlay session for a token.
 */
function getOrCreateSession(token: string, userId: string): OverlaySession {
  let session = sessions.get(token);
  if (!session) {
    session = { userId, goals: [], sseClients: new Set() };
    sessions.set(token, session);
  }
  return session;
}

/**
 * Store goal state and broadcast to all connected SSE clients.
 */
export function setGoalState(token: string, userId: string, goals: GoalState[]): void {
  const session = getOrCreateSession(token, userId);
  session.goals = goals;

  // Broadcast to all connected SSE clients
  const payload = JSON.stringify({ type: 'goal-state', goals, timestamp: Date.now() });
  const deadClients: import('http').ServerResponse[] = [];

  for (const client of session.sseClients) {
    try {
      client.write(`data: ${payload}\n\n`);
    } catch {
      deadClients.push(client);
    }
  }

  // Clean up dead clients
  for (const client of deadClients) {
    session.sseClients.delete(client);
  }
}

/**
 * Add an SSE client to a session.
 */
export function addSSEClient(token: string, userId: string, res: import('http').ServerResponse): void {
  const session = getOrCreateSession(token, userId);
  session.sseClients.add(res);
}

/**
 * Remove an SSE client from a session.
 */
export function removeSSEClient(token: string, res: import('http').ServerResponse): void {
  const session = sessions.get(token);
  if (session) {
    session.sseClients.delete(res);
  }
}

/**
 * Get current goal state for a token.
 */
export function getGoalState(token: string): GoalState[] {
  const session = sessions.get(token);
  return session?.goals || [];
}

// ─── Cleanup stale sessions (called periodically) ───
setInterval(() => {
  for (const [token, session] of sessions) {
    if (session.sseClients.size === 0 && session.goals.length === 0) {
      sessions.delete(token);
    }
  }
}, 60000); // Clean up every 60 seconds
