import { Router, Request, Response } from 'express';
import { verifyToken, OwnerPayload } from '../auth/tokens';
import { createRoom, getRoom, getPlayers } from '../rooms/roomManager';
import { validate, CreateRoomSchema } from '../middleware/validate';
import type { WinPattern } from '@babi-bingo/shared';

const router = Router();

/**
 * Middleware: extract operator/owner from Bearer token.
 * Stores verified payload in res.locals.auth so it survives Zod body replacement.
 */
async function requireOwnerAuth(
  req: Request,
  res: Response,
  next: () => void,
): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing authorization header' });
    return;
  }
  try {
    const payload = await verifyToken(auth.slice(7)) as OwnerPayload;
    if (payload.role !== 'OWNER') {
      res.status(403).json({ error: 'Owner role required' });
      return;
    }
    res.locals.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// POST /api/rooms
router.post('/', requireOwnerAuth, validate(CreateRoomSchema), async (req: Request, res: Response): Promise<void> => {
  const auth = res.locals.auth as OwnerPayload;
  const { pattern, intervalSeconds } = req.body as { pattern?: WinPattern; intervalSeconds?: number };

  const room = await createRoom(
    auth.houseName,
    auth.uuid,
    auth.houseId,
    pattern ?? 'ROW',
    intervalSeconds ?? 5,
  );

  res.status(201).json({
    code: room.code,
    houseName: room.houseName,
    state: room.state,
    pattern: room.pattern,
    intervalSeconds: room.intervalSeconds,
  });
});

// GET /api/rooms/public — landing page feed
// MUST be defined before /:code so Express matches it first
router.get('/public', async (_req: Request, res: Response): Promise<void> => {
  const { redis } = await import('../redis/client');
  const keys = await redis.keys('room:*:meta');

  const now = Date.now();
  const RECENT_WINDOW_MS = 2 * 60 * 60 * 1000; // 2 hours

  const playing: object[] = [];
  const waiting: object[] = [];
  const recent: object[] = [];

  await Promise.all(keys.map(async (key) => {
    const data = await redis.hgetall(key);
    if (!data) return;

    const calledCount = data.calledNumbers ? JSON.parse(data.calledNumbers).length : 0;
    const room = {
      code:        data.code,
      houseName:   data.houseName,
      state:       data.state,
      pattern:     data.pattern,
      playerCount: Number(data.playerCount ?? 0),
      calledCount,
      accentColor: data.accentColor,
      startedAt:   data.startedAt,
      finishedAt:  data.finishedAt,
    };

    if (data.state === 'PLAYING')  { playing.push(room); }
    else if (data.state === 'WAITING') { waiting.push(room); }
    else if (data.state === 'FINISHED' && data.finishedAt) {
      if (now - new Date(data.finishedAt).getTime() < RECENT_WINDOW_MS) {
        recent.push(room);
      }
    }
  }));

  // Sort: most players first
  playing.sort((a: any, b: any) => b.playerCount - a.playerCount);
  waiting.sort((a: any, b: any) => b.playerCount - a.playerCount);
  recent.sort((a: any, b: any) => new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime());

  res.json({ playing, waiting, recent: recent.slice(0, 10) });
});

// GET /api/rooms/:code — public
router.get('/:code', async (req: Request, res: Response): Promise<void> => {
  const room = await getRoom(req.params.code);
  if (!room) {
    res.status(404).json({ error: 'Room not found' });
    return;
  }

  const players = await getPlayers(req.params.code);

  res.json({
    code: room.code,
    houseName: room.houseName,
    state: room.state,
    pattern: room.pattern,
    calledNumbers: room.calledNumbers,
    playerCount: players.length,
    intervalSeconds: room.intervalSeconds,
  });
});

export default router;
