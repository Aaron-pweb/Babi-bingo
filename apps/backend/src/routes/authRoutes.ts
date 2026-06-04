import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { hash, compare } from 'bcryptjs';
import {
  signGuestToken, signAccessToken, signRefreshToken, verifyToken,
} from '../auth/tokens';
import {
  validate, GuestSchema, LoginSchema, PlayerRegisterSchema, RefreshSchema, toE164,
} from '../middleware/validate';
import { redisGet, redisSet } from '../redis/client';
import { logger } from '../logger';

const router = Router();

// ─────────────────────────────────────────────
//  In-memory store for Owners
//  (Players live in Redis)
// ─────────────────────────────────────────────
export interface OwnerRecord {
  uuid: string;
  username: string;
  passwordHash: string;
  role: 'OWNER';
  houseId: string;
  houseName: string;
  phone: string;          // E.164 e.g. +251912345678
  createdAt: string;
}

export const operators = new Map<string, OwnerRecord>();

// ─────────────────────────────────────────────
//  Admin credentials (seeded from .env)
// ─────────────────────────────────────────────
const ADMIN_UUID     = 'admin-system';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
async function isPhoneTaken(phone: string): Promise<boolean> {
  return !!(await redisGet<string>(`phone:${phone}`));
}

async function reservePhone(phone: string, uuid: string): Promise<void> {
  await redisSet(`phone:${phone}`, uuid);
}

// ─────────────────────────────────────────────
//  POST /api/auth/login  — UNIFIED (all roles)
// ─────────────────────────────────────────────
router.post('/login', validate(LoginSchema), async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username: string; password: string };

  // 1. Check admin
  if (username === ADMIN_USERNAME) {
    if (!ADMIN_PASSWORD) { res.status(503).json({ error: 'Admin not configured' }); return; }
    if (password !== ADMIN_PASSWORD) { res.status(401).json({ error: 'Invalid credentials' }); return; }
    const token = await signGuestToken(ADMIN_UUID, 'ADMIN');
    logger.warn({ username }, '[Auth] Admin login');
    res.json({ uuid: ADMIN_UUID, role: 'ADMIN', token });
    return;
  }

  // 2. Check Owner (in-memory)
  const op = operators.get(username);
  if (op) {
    if (!(await compare(password, op.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const accessToken  = await signAccessToken(op.uuid, 'OWNER', op.houseId, op.username, op.houseName);
    const refreshToken = await signRefreshToken(op.uuid);
    logger.info({ uuid: op.uuid }, '[Auth] Owner login');
    res.json({
      uuid: op.uuid, role: 'OWNER', houseName: op.houseName, houseId: op.houseId,
      accessToken, refreshToken,
    });
    return;
  }

  // 3. Check Player (Redis)
  const playerUuid = await redisGet<string>(`player:by-username:${username}`);
  if (playerUuid) {
    const player = await redisGet<{
      uuid: string; username: string; nickname: string;
      passwordHash: string; phone: string;
    }>(`player:${playerUuid}`);

    if (!player || !(await compare(password, player.passwordHash))) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }
    const token        = await signGuestToken(player.uuid, player.nickname);
    const refreshToken = await signRefreshToken(player.uuid);
    logger.info({ uuid: player.uuid }, '[Auth] Player login');
    res.json({ uuid: player.uuid, role: 'PLAYER', nickname: player.nickname, token, refreshToken });
    return;
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

// ─────────────────────────────────────────────
//  GET /api/auth/me  — validate token on load
// ─────────────────────────────────────────────
router.get('/me', async (req: Request, res: Response): Promise<void> => {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    const payload = await verifyToken(auth.slice(7)) as {
      uuid?: string; nickname?: string; role?: string; houseName?: string; houseId?: string;
    };

    if (!payload.uuid) { res.status(401).json({ error: 'Invalid token' }); return; }

    // Admin
    if (payload.uuid === ADMIN_UUID || payload.nickname === 'ADMIN') {
      res.json({ uuid: ADMIN_UUID, role: 'ADMIN' });
      return;
    }

    // Owner — look up by uuid
    const op = [...operators.values()].find((o) => o.uuid === payload.uuid);
    if (op) {
      res.json({ uuid: op.uuid, role: 'OWNER', houseName: op.houseName, houseId: op.houseId });
      return;
    }

    // Player
    const player = await redisGet<{ uuid: string; nickname: string }>(`player:${payload.uuid}`);
    if (player) {
      res.json({ uuid: player.uuid, role: 'PLAYER', nickname: player.nickname });
      return;
    }

    res.status(401).json({ error: 'User not found' });
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
  }
});

// ─────────────────────────────────────────────
//  POST /api/auth/register  — Players only
// ─────────────────────────────────────────────
router.post('/register', validate(PlayerRegisterSchema), async (req: Request, res: Response): Promise<void> => {
  const { username, password, nickname, phone: phoneLocal } = req.body as {
    username: string; password: string; nickname: string; phone: string;
  };

  const phone = toE164(phoneLocal);

  const existingByUsername = await redisGet<string>(`player:by-username:${username}`);
  if (existingByUsername) { res.status(409).json({ error: 'Username already taken' }); return; }

  if (await isPhoneTaken(phone)) {
    res.status(409).json({ error: 'Phone number already registered' });
    return;
  }

  const uuid         = uuidv4();
  const passwordHash = await hash(password, 12);
  const player       = { uuid, username, nickname: nickname.trim(), passwordHash, phone, createdAt: new Date().toISOString() };

  await redisSet(`player:${uuid}`, player);
  await redisSet(`player:by-username:${username}`, uuid);
  await reservePhone(phone, uuid);

  const token        = await signGuestToken(uuid, nickname.trim());
  const refreshToken = await signRefreshToken(uuid);

  logger.info({ uuid, username, phone }, '[Auth] Player registered');
  res.status(201).json({ uuid, role: 'PLAYER', nickname: player.nickname, token, refreshToken });
});

// ─────────────────────────────────────────────
//  POST /api/auth/refresh
// ─────────────────────────────────────────────
router.post('/refresh', validate(RefreshSchema), async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken: string };
  try {
    const payload = await verifyToken(refreshToken) as { uuid?: string; type?: string };
    if (payload.type !== 'refresh' || !payload.uuid) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const op = [...operators.values()].find((o) => o.uuid === payload.uuid);
    if (op) {
      const accessToken = await signAccessToken(op.uuid, 'OWNER', op.houseId, op.username, op.houseName);
      res.json({ accessToken });
      return;
    }

    const player = await redisGet<{ uuid: string; nickname: string }>(`player:${payload.uuid}`);
    if (player) {
      const token = await signGuestToken(player.uuid, player.nickname);
      res.json({ accessToken: token });
      return;
    }

    res.status(401).json({ error: 'User not found' });
  } catch {
    res.status(401).json({ error: 'Refresh token invalid or expired' });
  }
});

// ─────────────────────────────────────────────
//  POST /api/auth/guest  (TV display joins)
// ─────────────────────────────────────────────
router.post('/guest', validate(GuestSchema), async (req: Request, res: Response): Promise<void> => {
  const { nickname } = req.body as { nickname: string };
  const uuid = uuidv4();
  const token = await signGuestToken(uuid, nickname.trim());
  res.json({ uuid, token });
});

export default router;
