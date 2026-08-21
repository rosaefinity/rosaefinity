import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env';

export interface TokenPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
}

export const generateAccessToken = (payload: TokenPayload): string => {
  const uniquePayload = {
    ...payload,
    jti: crypto.randomUUID(),
  };
  return jwt.sign(uniquePayload, env.JWT_SECRET, {
    expiresIn: '15m',
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  const uniquePayload = {
    ...payload,
    jti: crypto.randomUUID(),
  };
  return jwt.sign(uniquePayload, env.JWT_SECRET, {
    expiresIn: '7d',
  });
};

export const verifyToken = (token: string): TokenPayload => {
  return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
};
