import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export interface JwtPayload {
  sub: string;
  username: string;
  isAdmin: boolean;
}

function requireSecret(name: string, value: string | undefined): string {
  if (!value || value.length < 32) {
    throw new Error(`${name} must be set and at least 32 characters`);
  }
  return value;
}

export function getJwtSecrets() {
  return {
    accessSecret: requireSecret('JWT_ACCESS_SECRET', process.env.JWT_ACCESS_SECRET),
    refreshSecret: requireSecret('JWT_REFRESH_SECRET', process.env.JWT_REFRESH_SECRET),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: JwtPayload): string {
  const { accessSecret, accessExpiresIn } = getJwtSecrets();
  return jwt.sign(payload, accessSecret, { expiresIn: accessExpiresIn } as jwt.SignOptions);
}

export function signRefreshToken(payload: JwtPayload): string {
  const { refreshSecret, refreshExpiresIn } = getJwtSecrets();
  return jwt.sign(payload, refreshSecret, { expiresIn: refreshExpiresIn } as jwt.SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  const { accessSecret } = getJwtSecrets();
  return jwt.verify(token, accessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  const { refreshSecret } = getJwtSecrets();
  return jwt.verify(token, refreshSecret) as JwtPayload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function refreshTokenExpiresAt(): Date {
  const raw = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';
  const match = raw.match(/^(\d+)([dhms])$/);
  if (!match) return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const n = Number(match[1]);
  const unit = match[2];
  const ms =
    unit === 'd' ? n * 86400000 : unit === 'h' ? n * 3600000 : unit === 'm' ? n * 60000 : n * 1000;
  return new Date(Date.now() + ms);
}
