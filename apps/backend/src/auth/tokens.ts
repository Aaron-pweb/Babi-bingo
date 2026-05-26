import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { UserRole } from '@babi-bingo/shared';
import dotenv from 'dotenv';

dotenv.config();

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'INSECURE_DEV_SECRET_CHANGE_ME'
);

// ─────────────────────────────────────────────
//  Token Payload Shapes
// ─────────────────────────────────────────────

export interface GuestPayload extends JWTPayload {
  uuid: string;
  nickname: string;
  role: 'PLAYER';
}

export interface OperatorPayload extends JWTPayload {
  uuid: string;
  role: 'OPERATOR' | 'OWNER';
  houseId: string;
  username: string;
}

export type AuthPayload = GuestPayload | OperatorPayload;

// ─────────────────────────────────────────────
//  Token Factories
// ─────────────────────────────────────────────

/**
 * Creates a signed JWT for a guest player.
 * Expires in 24h — no login required.
 */
export async function signGuestToken(uuid: string, nickname: string): Promise<string> {
  return new SignJWT({ uuid, nickname, role: 'PLAYER' as UserRole })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(SECRET);
}

/**
 * Creates a short-lived access token for operators/owners.
 */
export async function signAccessToken(
  uuid: string,
  role: 'OPERATOR' | 'OWNER',
  houseId: string,
  username: string
): Promise<string> {
  return new SignJWT({ uuid, role, houseId, username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(SECRET);
}

/**
 * Creates a long-lived refresh token for operators/owners.
 */
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
