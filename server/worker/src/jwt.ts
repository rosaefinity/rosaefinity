// =============================================
// RosaeFinity Worker — JWT Operations (jose)
// Web Crypto-based JWT for Cloudflare Workers
// =============================================

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { JwtPayload } from './types.js';

const ALGORITHM = 'HS256';

function getSecret(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

function parseExpiresIn(value: string): number {
  const match = value.match(/^(\d+)([smhd])$/);
  if (!match) return 900; // default 15 minutes
  const num = parseInt(match[1], 10);
  const unit = match[2];
  switch (unit) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: return 900;
  }
}

export async function generateTokens(
  payload: Omit<JwtPayload, 'iat' | 'exp'>,
  secret: string,
  expiresIn: string,
  refreshExpiresIn: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const secretBytes = getSecret(secret);

  const accessToken = await new SignJWT({
    sub: payload.sub,
    email: payload.email,
    planTier: payload.planTier,
    role: payload.role,
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(`${parseExpiresIn(expiresIn)}s`)
    .sign(secretBytes);

  const refreshToken = await new SignJWT({
    sub: payload.sub,
    email: payload.email,
    planTier: payload.planTier,
    role: payload.role,
    type: 'refresh',
  })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(`${parseExpiresIn(refreshExpiresIn)}s`)
    .sign(secretBytes);

  return { accessToken, refreshToken };
}

export async function verifyAccessToken(
  token: string,
  secret: string,
): Promise<JwtPayload> {
  const secretBytes = getSecret(secret);
  const { payload } = await jwtVerify(token, secretBytes, {
    algorithms: [ALGORITHM],
  });
  return payload as unknown as JwtPayload;
}

export async function verifyRefreshToken(
  token: string,
  secret: string,
): Promise<JwtPayload> {
  const secretBytes = getSecret(secret);
  const { payload } = await jwtVerify(token, secretBytes, {
    algorithms: [ALGORITHM],
  });

  if (payload.type !== 'refresh') {
    throw new Error('Not a refresh token');
  }

  return payload as unknown as JwtPayload;
}
