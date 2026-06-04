import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { UserRole } from '@babi-bingo/shared';
import dotenv from 'dotenv';

dotenv.config();

// C3: Never fall back to a hardcoded secret — fail loudly at startup
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('FATAL: JWT_SECRET environment variable is required. Generate one with: openssl rand -base64 64');
}

const SECRET = new TextEncoder().encode(jwtSecret);

// ─────────────────────────────────────────────
//  Token Payload Shapes
// ─────────────────────────────────────────────

export interface GuestPayload extends JWTPayload {
  uuid: string;
  nickname: string;
  role: 'PLAYER';
}

/** Owners run their house directly — no separate Operator role */
export interface OwnerPayload extends JWTPayload {
  uuid: string;
  role: 'OWNER';
  houseId: string;
  username: string;
  houseName: string;
}

export type AuthPayload = GuestPayload | OwnerPayload;

// ─────────────────────────────────────────────
//  Token Factories
// ─────────────────────────────────────────────

export async function signGuestToken(uuid: string, nickname: string): Promise<string> {
  return new SignJWT({ uuid, nickname, role: 'PLAYER' as UserRole })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET);
}

export async function signAccessToken(
  uuid: string,
  role: 'OWNER',
  houseId: string,
  username: string,
  houseName: string,
): Promise<string> {
  return new SignJWT({ uuid, role, houseId, username, houseName })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(SECRET);
}

export async function signRefreshToken(uuid: string): Promise<string> {
  return new SignJWT({ uuid, type: 'refresh' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

// ─────────────────────────────────────────────
//  Token Verification
// ─────────────────────────────────────────────

export async function verifyToken(token: string): Promise<AuthPayload> {
  const { payload } = await jwtVerify(token, SECRET);
  return payload as AuthPayload;
}
