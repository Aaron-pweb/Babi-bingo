import { Router, Request, Response } from 'express';
import { redis } from '../redis/client';
import { operators } from './authRoutes';
import { verifyToken, OwnerPayload } from '../auth/tokens';
import { logger } from '../logger';

const router = Router();

// ─────────────────────────────────────────────
//  requireOwner middleware
// ─────────────────────────────────────────────
async function requireOwner(req: Request, res: Response, next: () => void): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const payload = await verifyToken(auth.slice(7)) as OwnerPayload;
    if (payload.role !== 'OWNER') { res.status(403).json({ error: 'Owner access required' }); return; }
    res.locals.owner = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─────────────────────────────────────────────
//  GET /api/owner/rooms
//  Returns all rooms belonging to this owner's house
// ─────────────────────────────────────────────
router.get('/rooms', requireOwner, async (_req: Request, res: Response): Promise<void> => {
  const { uuid: ownerUuid, houseId } = res.locals.owner as OwnerPayload;

  // Find all room keys in Redis that belong to this owner
  const allKeys = await redis.keys('room:*');
  const roomKeys = allKeys.filter(k => !k.includes(':players') && !k.includes(':cards') && !k.includes(':cooldowns') && !k.includes(':meta'));

  const rooms: object[] = [];

  await Promise.all(roomKeys.map(async (key) => {
    const raw = await redis.get(key);
    if (!raw) return;
    try {
      const room = JSON.parse(raw);
      // Only include rooms owned by this house
      if (room.houseId !== houseId && room.operatorUuid !== ownerUuid) return;

      const playerHash = await redis.hgetall(`room:${room.code}:players`);
      const playerCount = playerHash ? Object.keys(playerHash).length : 0;

      rooms.push({
        code:           room.code,
        state:          room.state,
        pattern:        room.pattern,
        calledCount:    room.calledNumbers?.length ?? 0,
        intervalSeconds: room.intervalSeconds,
        playerCount,
        createdAt:      room.createdAt,
      });
    } catch { /* skip malformed */ }
  }));

  // Sort: active first, then by creation time desc
  const order: Record<string, number> = { PLAYING: 0, WAITING: 1, PAUSED: 2, FINISHED: 3 };
  rooms.sort((a: any, b: any) => {
    const stateOrder = (order[a.state] ?? 9) - (order[b.state] ?? 9);
    if (stateOrder !== 0) return stateOrder;
    return b.createdAt - a.createdAt;
  });

  logger.info({ ownerUuid, count: rooms.length }, '[Owner] Rooms fetched');
  res.json(rooms);
});

// ─────────────────────────────────────────────
//  GET /api/owner/profile
//  Returns owner's account info
// ─────────────────────────────────────────────
router.get('/profile', requireOwner, async (_req: Request, res: Response): Promise<void> => {
  const { uuid } = res.locals.owner as OwnerPayload;
  const owner = [...operators.values()].find(o => o.uuid === uuid);
  if (!owner) { res.status(404).json({ error: 'Owner not found' }); return; }
  res.json({
    uuid:      owner.uuid,
    username:  owner.username,
    houseName: owner.houseName,
    houseId:   owner.houseId,
    phone:     owner.phone,
    createdAt: owner.createdAt,
  });
});

export default router;
