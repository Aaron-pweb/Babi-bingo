import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { hash, compare } from 'bcryptjs';
import { signGuestToken, signAccessToken, signRefreshToken, verifyToken } from '../auth/tokens';
import { validate, GuestSchema, RegisterSchema, LoginSchema, RefreshSchema, PlayerRegisterSchema, PlayerLoginSchema } from '../middleware/validate';
import { redisGet, redisSet } from '../redis/client';
import { logger } from '../logger';

const router = Router();

// ─── In-memory operator store ────────────────────────────────────
interface OperatorRecord {
  uuid: string; username: string; passwordHash: string;
  role: 'OPERATOR' | 'OWNER'; houseId: string; houseName: string;
}
export const operators = new Map<string, OperatorRecord>();

// ─── Admin account (seeded from env) ─────────────────────────────
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? '';

// POST /api/auth/guest
router.post('/guest', validate(GuestSchema), async (req: Request, res: Response): Promise<void> => {
  const { nickname } = req.body as { nickname: string };
  const uuid = uuidv4();
  const token = await signGuestToken(uuid, nickname.trim());
  res.json({ uuid, token });
});

// POST /api/auth/register  (Owner/Operator)
router.post('/register', validate(RegisterSchema), async (req: Request, res: Response): Promise<void> => {
  const { username, password, houseName, role } = req.body as {
    username: string; password: string; houseName: string; role?: 'OPERATOR' | 'OWNER';
  };

  if (operators.has(username)) {
    res.status(409).json({ error: 'Username already exists' });
    return;
  }

  const resolvedRole: 'OPERATOR' | 'OWNER' = role === 'OPERATOR' ? 'OPERATOR' : 'OWNER';
  const uuid = uuidv4();
  const houseId = uuidv4();
  const passwordHash = await hash(password, 12);

  operators.set(username, { uuid, username, passwordHash, role: resolvedRole, houseId, houseName });

  const accessToken = await signAccessToken(uuid, resolvedRole, houseId, username, houseName);
  const refreshToken = await signRefreshToken(uuid);

  res.status(201).json({ uuid, houseId, accessToken, refreshToken });
});

// POST /api/auth/login  (Owner/Operator)
router.post('/login', validate(LoginSchema), async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username: string; password: string };
  const op = operators.get(username);

  if (!op || !(await compare(password, op.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const accessToken = await signAccessToken(op.uuid, op.role, op.houseId, op.username, op.houseName);
  const refreshToken = await signRefreshToken(op.uuid);

  res.json({ uuid: op.uuid, houseId: op.houseId, houseName: op.houseName, role: op.role, accessToken, refreshToken });
});

// POST /api/auth/refresh
router.post('/refresh', validate(RefreshSchema), async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken: string };
  try {
    const payload = await verifyToken(refreshToken) as { uuid?: string; type?: string };
    if (payload.type !== 'refresh' || !payload.uuid) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }
    const op = [...operators.values()].find((o) => o.uuid === payload.uuid);
    if (!op) { res.status(401).json({ error: 'User not found' }); return; }
    const accessToken = await signAccessToken(op.uuid, op.role, op.houseId, op.username, op.houseName);
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Refresh token invalid or expired' });
  }
});

// ─── Player Auth ──────────────────────────────────────────────────

// POST /api/auth/player/register
router.post('/player/register', validate(PlayerRegisterSchema), async (req: Request, res: Response): Promise<void> => {
  const { username, password, nickname } = req.body as { username: string; password: string; nickname: string };

  const existing = await redisGet<string>(`player:by-username:${username}`);
  if (existing) { res.status(409).json({ error: 'Username already taken' }); return; }

  const uuid = uuidv4();
  const passwordHash = await hash(password, 12);
  const player = { uuid, username, nickname: nickname.trim(), passwordHash, createdAt: new Date().toISOString() };

  await redisSet(`player:${uuid}`, player);
  await redisSet(`player:by-username:${username}`, uuid);

  const token = await signGuestToken(uuid, nickname.trim()); // reuse guest token for players
  const refreshToken = await signRefreshToken(uuid);

  logger.info({ uuid, username }, '[Auth] Player registered');
  res.status(201).json({ uuid, token, nickname: player.nickname, refreshToken });
});

// POST /api/auth/player/login
router.post('/player/login', validate(PlayerLoginSchema), async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username: string; password: string };

  const uuid = await redisGet<string>(`player:by-username:${username}`);
  if (!uuid) { res.status(401).json({ error: 'Invalid credentials' }); return; }

  const player = await redisGet<{ uuid: string; username: string; nickname: string; passwordHash: string }>(`player:${uuid}`);
  if (!player || !(await compare(password, player.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const token = await signGuestToken(player.uuid, player.nickname);
  const refreshToken = await signRefreshToken(player.uuid);

  logger.info({ uuid: player.uuid }, '[Auth] Player logged in');
  res.json({ uuid: player.uuid, token, nickname: player.nickname, refreshToken });
});

// POST /api/auth/admin/login
router.post('/admin/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) { res.status(400).json({ error: 'Missing credentials' }); return; }
  if (!ADMIN_PASSWORD) { res.status(503).json({ error: 'Admin not configured' }); return; }
  if (username !== ADMIN_USERNAME || password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: 'Invalid admin credentials' });
    return;
  }
  const uuid = 'admin-system';
  const token = await signGuestToken(uuid, 'ADMIN'); // simple token reuse
  logger.warn({ username }, '[Auth] Admin login');
  res.json({ uuid, token });
});

// POST /api/auth/operator/register  (only when window is open)
router.post('/operator/register', async (req: Request, res: Response): Promise<void> => {
  const windowOpen = await redisGet<string>('admin:op-window');
  if (!windowOpen) { res.status(403).json({ error: 'Operator registration is currently closed' }); return; }

  const { username, password, houseId } = req.body as { username?: string; password?: string; houseId?: string };
  if (!username || !password || !houseId) { res.status(400).json({ error: 'username, password, houseId required' }); return; }
  if (operators.has(username)) { res.status(409).json({ error: 'Username already exists' }); return; }

  // Find which house this operator belongs to
  const ownerEntry = [...operators.values()].find((o) => o.houseId === houseId && o.role === 'OWNER');
  if (!ownerEntry) { res.status(404).json({ error: 'House not found' }); return; }

  const uuid = uuidv4();
  const passwordHash = await hash(password, 12);
  operators.set(username, { uuid, username, passwordHash, role: 'OPERATOR', houseId, houseName: ownerEntry.houseName });

  const accessToken = await signAccessToken(uuid, 'OPERATOR', houseId, username, ownerEntry.houseName);
  const refreshToken = await signRefreshToken(uuid);

  logger.info({ username, houseId }, '[Auth] Operator registered');
  res.status(201).json({ uuid, accessToken, refreshToken });
});

export default router;
