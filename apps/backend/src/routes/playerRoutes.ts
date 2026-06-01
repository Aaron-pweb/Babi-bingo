import { Router, Request, Response } from 'express';
import { verifyToken } from '../auth/tokens';
import { redisGet } from '../redis/client';
import { redis } from '../redis/client';


const router = Router();

// ── requirePlayer middleware ────────────────────────────────────
async function requirePlayer(req: Request, res: Response, next: () => void): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const payload = await verifyToken(auth.slice(7)) as { uuid?: string; nickname?: string };
    if (!payload.uuid) { res.status(401).json({ error: 'Invalid token' }); return; }
    res.locals.playerUuid = payload.uuid;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// GET /api/players/me/history
router.get('/me/history', requirePlayer, async (_req: Request, res: Response): Promise<void> => {
  const uuid = res.locals.playerUuid as string;

  // History stored as a Redis LIST of JSON strings
  const raw = await redis.lrange(`player:${uuid}:history`, 0, 49); // last 50 games
  const history = raw.map((item) => {
    try { return JSON.parse(item); } catch { return null; }
  }).filter(Boolean);

  res.json(history);
});

// GET /api/players/me/profile
router.get('/me/profile', requirePlayer, async (_req: Request, res: Response): Promise<void> => {
  const uuid = res.locals.playerUuid as string;
  const player = await redisGet<{ uuid: string; username: string; nickname: string; createdAt: string }>(`player:${uuid}`);
  if (!player) { res.status(404).json({ error: 'Player not found' }); return; }
  res.json({ uuid: player.uuid, username: player.username, nickname: player.nickname, createdAt: player.createdAt });
});

export default router;
