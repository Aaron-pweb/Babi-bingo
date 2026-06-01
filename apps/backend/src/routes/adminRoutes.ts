import { Router, Request, Response } from 'express';
import { redis, redisGet, redisSet } from '../redis/client';
import { operators } from './authRoutes';
import { logger } from '../logger';

const router = Router();


async function requireAdmin(req: Request, res: Response, next: () => void): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return; }

  try {
    // Admin token has nickname === 'ADMIN' (set during admin/login)
    const { verifyToken } = await import('../auth/tokens');
    const payload = await verifyToken(auth.slice(7)) as { uuid?: string; nickname?: string; role?: string };
    if (payload.uuid !== 'admin-system' && payload.nickname !== 'ADMIN') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// GET /api/admin/stats
router.get('/stats', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const { gameQueue } = await import('../queues/gameQueue');
  const [waiting, active, delayed] = await Promise.all([
    gameQueue.getWaitingCount(),
    gameQueue.getActiveCount(),
    gameQueue.getDelayedCount(),
  ]);

  // Count rooms from the public index
  const roomKeys = await redis.keys('room:*:meta');
  let playingRooms = 0, waitingRooms = 0;
  for (const key of roomKeys) {
    const state = await redis.hget(key, 'state');
    if (state === 'PLAYING') playingRooms++;
    else if (state === 'WAITING') waitingRooms++;
  }

  const windowOpen = !!(await redisGet<string>('admin:op-window'));
  const windowExpiry = await redis.ttl('admin:op-window');

  res.json({
    totalHouses: [...operators.values()].filter(o => o.role === 'OWNER').length,
    activeRooms: roomKeys.length,
    playingRooms,
    waitingRooms,
    totalPlayers: active,
    operatorWindowOpen: windowOpen,
    operatorWindowExpiresAt: windowOpen
      ? new Date(Date.now() + windowExpiry * 1000).toISOString()
      : undefined,
    queue: { waiting, active: active, delayed },
  });
});

// GET /api/admin/houses
router.get('/houses', requireAdmin, async (_req: Request, res: Response): Promise<void> => {
  const owners = [...operators.values()].filter(o => o.role === 'OWNER');

  const houses = await Promise.all(owners.map(async (owner) => {
    const suspended = !!(await redisGet<boolean>(`house:${owner.houseId}:suspended`));
    const accentColor = (await redisGet<string>(`house:${owner.houseId}:accent`)) ?? '#f5a623';
    const roomKeys = await redis.keys(`room:*:meta`);
    let activeRooms = 0, totalGames = 0;
    for (const key of roomKeys) {
      const ownerUuid = await redis.hget(key, 'ownerUuid');
      if (ownerUuid !== owner.uuid) continue;
      totalGames++;
      const state = await redis.hget(key, 'state');
      if (state === 'WAITING' || state === 'PLAYING') activeRooms++;
    }
    return {
      houseId: owner.houseId,
      houseName: owner.houseName,
      ownerUuid: owner.uuid,
      ownerUsername: owner.username,
      activeRooms,
      totalGames,
      suspended,
      accentColor,
      createdAt: new Date().toISOString(),
    };
  }));

  res.json(houses);
});

// PATCH /api/admin/houses/:id/suspend
router.patch('/houses/:id/suspend', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { suspended } = req.body as { suspended?: boolean };
  if (typeof suspended !== 'boolean') { res.status(400).json({ error: 'suspended boolean required' }); return; }

  if (suspended) {
    await redisSet(`house:${id}:suspended`, true);
  } else {
    const { redisDel } = await import('../redis/client');
    await redisDel(`house:${id}:suspended`);
  }
  logger.warn({ houseId: id, suspended }, '[Admin] House suspension changed');
  res.json({ houseId: id, suspended });
});

// GET /api/admin/op-window  (public — frontend checks before showing operator register)
router.get('/op-window', async (_req: Request, res: Response): Promise<void> => {
  const exists = await redisGet<string>('admin:op-window');
  if (!exists) { res.json({ open: false }); return; }
  const ttl = await redis.ttl('admin:op-window');
  res.json({ open: true, expiresAt: new Date(Date.now() + ttl * 1000).toISOString() });
});

// POST /api/admin/op-window/open
router.post('/op-window/open', requireAdmin, async (req: Request, res: Response): Promise<void> => {
  const { minutes } = req.body as { minutes?: number };
  const mins = Math.min(Math.max(Number(minutes) || 30, 5), 480);
  const ttl = mins * 60;

  await redis.setex('admin:op-window', ttl, '1');
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
  logger.warn({ minutes: mins, expiresAt }, '[Admin] Operator registration window opened');
  res.json({ open: true, expiresAt, minutes: mins });
});

export default router;
