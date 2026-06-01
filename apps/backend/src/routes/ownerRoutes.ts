import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../redis/client';
import { operators } from './authRoutes';
import { verifyToken } from '../auth/tokens';
import { logger } from '../logger';

const router = Router();

const INVITE_TTL_SECONDS = 72 * 60 * 60; // 72 hours

// ─────────────────────────────────────────────
//  requireOwner middleware
// ─────────────────────────────────────────────
async function requireOwner(req: Request, res: Response, next: () => void): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const payload = await verifyToken(auth.slice(7)) as {
      uuid?: string; role?: string; houseId?: string;
    };
    if (payload.role !== 'OWNER') { res.status(403).json({ error: 'Owner access required' }); return; }
    res.locals.owner = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ─────────────────────────────────────────────
//  POST /api/owner/operators/invite
//  Generate a one-use invite link for an operator
// ─────────────────────────────────────────────
router.post('/operators/invite', requireOwner, async (req: Request, res: Response): Promise<void> => {
  const owner = res.locals.owner as { uuid: string; houseId: string; houseName: string };
  const { username } = req.body as { username?: string };

  if (!username || username.length < 3) {
    res.status(400).json({ error: 'username (min 3 chars) is required for the operator' });
    return;
  }

  if (operators.has(username)) {
    res.status(409).json({ error: 'Username already taken' });
    return;
  }

  const token = uuidv4();
  const invite = {
    houseId:   owner.houseId,
    houseName: owner.houseName,
    ownerUuid: owner.uuid,
    username,
    createdAt: new Date().toISOString(),
  };

  await redis.setex(`invite:${token}`, INVITE_TTL_SECONDS, JSON.stringify(invite));

  const acceptUrl = `${process.env.FRONTEND_URL ?? 'http://localhost:5173'}/invite/${token}`;

  logger.info({ ownerUuid: owner.uuid, username, token }, '[Owner] Operator invite created');
  res.json({
    token,
    acceptUrl,
    username,
    expiresAt: new Date(Date.now() + INVITE_TTL_SECONDS * 1000).toISOString(),
  });
});

// ─────────────────────────────────────────────
//  GET /api/owner/operators
//  List operators under this house
// ─────────────────────────────────────────────
router.get('/operators', requireOwner, async (_req: Request, res: Response): Promise<void> => {
  const { houseId } = res.locals.owner as { houseId: string };

  const ops = [...operators.values()]
    .filter((o) => o.role === 'OPERATOR' && o.houseId === houseId)
    .map((o) => ({
      uuid:      o.uuid,
      username:  o.username,
      phone:     o.phone,
      createdAt: o.createdAt,
    }));

  res.json(ops);
});

// ─────────────────────────────────────────────
//  DELETE /api/owner/operators/:username
//  Remove an operator from this house
// ─────────────────────────────────────────────
router.delete('/operators/:username', requireOwner, async (req: Request, res: Response): Promise<void> => {
  const { houseId } = res.locals.owner as { houseId: string };
  const { username } = req.params;

  const op = operators.get(username);
  if (!op || op.role !== 'OPERATOR' || op.houseId !== houseId) {
    res.status(404).json({ error: 'Operator not found in your house' });
    return;
  }

  operators.delete(username);
  await redis.del(`phone:${op.phone}`);

  logger.warn({ username, houseId }, '[Owner] Operator removed');
  res.json({ removed: true });
});

// ─────────────────────────────────────────────
//  GET /api/owner/invite/:token
//  Peek at an invite (preview the username/house before accepting)
// ─────────────────────────────────────────────
router.get('/invite/:token', async (req: Request, res: Response): Promise<void> => {
  const raw = await redis.get(`invite:${req.params.token}`);
  if (!raw) { res.status(410).json({ error: 'Invite link expired or invalid' }); return; }
  const invite = JSON.parse(raw) as { houseName: string; username: string };
  res.json({ houseName: invite.houseName, username: invite.username });
});

export default router;
