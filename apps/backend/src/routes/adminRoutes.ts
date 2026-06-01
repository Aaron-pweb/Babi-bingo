import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { hash } from 'bcryptjs';
import { redis, redisGet, redisSet } from '../redis/client';
import { operators } from './authRoutes';
import { logger } from '../logger';
import { verifyToken } from '../auth/tokens';
import { validate, CreateOwnerSchema, toE164 } from '../middleware/validate';

const router = Router();

const ADMIN_UUID = 'admin-system';

// ─────────────────────────────────────────────
//  requireAdmin middleware
// ─────────────────────────────────────────────
async function requireAdmin(req: Request, res: Response, next: () => void): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const payload = await verifyToken(auth.slice(7)) as { uuid?: string; nickname?: string };
    if (payload.uuid !== ADMIN_UUID && payload.nickname !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─────────────────────────────────────────────
//  POST /api/admin/owners  — create house owner
// ─────────────────────────────────────────────
router.post('/owners', requireAdmin, validate(CreateOwnerSchema), async (req: Request, res: Response): Promise<void> => {
  const { username, password, houseName, phone: phoneLocal } = req.body as {
    username: string; password: string; houseName: string; phone: string;
  };

  const phone = toE164(phoneLocal);

  if (operators.has(username)) {
    res.status(409).json({ error: 'Username already exists' });
    return;
  }

  // Check phone uniqueness
  const phoneTaken = await redisGet<string>(`phone:${phone}`);
  if (phoneTaken) { res.status(409).json({ error: 'Phone number already registered' }); return; }

  const uuid         = uuidv4();
  const houseId      = uuidv4();
  const passwordHash = await hash(password, 12);

  operators.set(username, {
    uuid, username, passwordHash, role: 'OWNER', houseId, houseName, phone,
    createdAt: new Date().toISOString(),
  });

  await redisSet(`phone:${phone}`, uuid);

  logger.warn({ uuid, username, houseName }, '[Admin] House owner created');
  res.status(201).json({ uuid, houseId, houseName, username });
});

// ─────────────────────────────────────────────
//  GET /api/admin/owners  — list all owners
// ─────────────────────────────────────────────
router.get('/owners', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const owners = [...operators.values()]
    .filter((o) => o.role === 'OWNER')
    .map((o) => ({
      uuid:      o.uuid,
      username:  o.username,
      houseName: o.houseName,
      houseId:   o.houseId,
      phone:     o.phone,
      createdAt: o.createdAt,
    }));
  res.json(owners);
});

// ─────────────────────────────────────────────
//  DELETE /api/admin/owners/:username
// ─────────────────────────────────────────────
router.delete('/owners/:username', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { username } = req.params;
  const op = operators.get(username);
  if (!op || op.role !== 'OWNER') { res.status(404).json({ error: 'Owner not found' }); return; }

  operators.delete(username);
  // Free the phone number
  await redis.del(`phone:${op.phone}`);

  logger.warn({ username }, '[Admin] Owner removed');
  res.json({ removed: true });
});

// ─────────────────────────────────────────────
//  GET /api/admin/stats
// ─────────────────────────────────────────────
router.get('/stats', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const { gameQueue } = await import('../queues/gameQueue');
  const [waiting, active, delayed] = await Promise.all([
    gameQueue.getWaitingCount(),
    gameQueue.getActiveCount(),
    gameQueue.getDelayedCount(),
  ]);

  const roomKeys = await redis.keys('room:*:meta');
  let playingRooms = 0, waitingRooms = 0;
  for (const key of roomKeys) {
    const state = await redis.hget(key, 'state');
    if (state === 'PLAYING')  playingRooms++;
    else if (state === 'WAITING') waitingRooms++;
  }

  const windowOpen  = !!(await redisGet<string>('admin:op-window'));
  const windowExpiry = windowOpen ? await redis.ttl('admin:op-window') : 0;

  res.json({
    totalHouses:   [...operators.values()].filter((o) => o.role === 'OWNER').length,
    activeRooms:   roomKeys.length,
    playingRooms, waitingRooms,
    totalPlayers:  active,
    operatorWindowOpen: windowOpen,
    operatorWindowExpiresAt: windowOpen ? new Date(Date.now() + windowExpiry * 1000).toISOString() : undefined,
    queue: { waiting, active, delayed },
  });
});

// ─────────────────────────────────────────────
//  GET /api/admin/houses  (full house list with rooms/status)
// ─────────────────────────────────────────────
router.get('/houses', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const owners = [...operators.values()].filter((o) => o.role === 'OWNER');

  const houses = await Promise.all(owners.map(async (owner) => {
    const suspended   = !!(await redisGet<boolean>(`house:${owner.houseId}:suspended`));
    const accentColor = (await redisGet<string>(`house:${owner.houseId}:accent`)) ?? '#f5a623';
    const roomKeys    = await redis.keys('room:*:meta');
    let activeRooms = 0, totalGames = 0;
    for (const key of roomKeys) {
      const ownerUuid = await redis.hget(key, 'ownerUuid');
      if (ownerUuid !== owner.uuid) continue;
      totalGames++;
      const state = await redis.hget(key, 'state');
      if (state === 'WAITING' || state === 'PLAYING') activeRooms++;
    }
    return {
      houseId: owner.houseId, houseName: owner.houseName,
      ownerUuid: owner.uuid, ownerUsername: owner.username,
      phone: owner.phone,
      activeRooms, totalGames, suspended, accentColor,
      createdAt: owner.createdAt,
    };
  }));

  res.json(houses);
});

// ─────────────────────────────────────────────
//  PATCH /api/admin/houses/:id/suspend
// ─────────────────────────────────────────────
router.patch('/houses/:id/suspend', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { suspended } = req.body as { suspended?: boolean };
  if (typeof suspended !== 'boolean') { res.status(400).json({ error: 'suspended boolean required' }); return; }

  if (suspended) {
    await redisSet(`house:${id}:suspended`, true);
  } else {
    await redis.del(`house:${id}:suspended`);
  }
  logger.warn({ houseId: id, suspended }, '[Admin] House suspension changed');
  res.json({ houseId: id, suspended });
});

// ─────────────────────────────────────────────
//  GET /api/admin/op-window  (public)
// ─────────────────────────────────────────────
router.get('/op-window', async (_req: Request, res: Response): Promise<void> => {
  const exists = await redisGet<string>('admin:op-window');
  if (!exists) { res.json({ open: false }); return; }
  const ttl = await redis.ttl('admin:op-window');
  res.json({ open: true, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() });
});

// ─────────────────────────────────────────────
//  POST /api/admin/op-window/open
// ─────────────────────────────────────────────
router.post('/op-window/open', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { minutes } = req.body as { minutes?: number };
  const mins = Math.min(Math.max(Number(minutes) || 30, 5), 480);
  await redis.setex('admin:op-window', mins * 60, '1');
  const expiresAt = new Date(Date.now() + mins * 60_000).toISOString();
  logger.warn({ minutes: mins, expiresAt }, '[Admin] Operator registration window opened');
  res.json({ open: true, expiresAt, minutes: mins });
});

export default router;
