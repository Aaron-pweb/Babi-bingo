import { Router, Request, Response } from 'express';
import { verifyToken, OperatorPayload } from '../auth/tokens';
import { createRoom, getRoom, getPlayers } from '../rooms/roomManager';
import { validate, CreateRoomSchema } from '../middleware/validate';
import type { WinPattern } from '@babi-bingo/shared';

const router = Router();

/**
 * Middleware: extract operator/owner from Bearer token.
 * Stores verified payload in res.locals.auth so it survives Zod body replacement.
 */
async function requireOperatorAuth(
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
    const payload = await verifyToken(auth.slice(7)) as OperatorPayload;
    if (payload.role !== 'OPERATOR' && payload.role !== 'OWNER') {
      res.status(403).json({ error: 'Operator or Owner role required' });
      return;
    }
    // Store in res.locals — survives validate() replacing req.body
    res.locals.auth = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// POST /api/rooms
router.post('/', requireOperatorAuth, validate(CreateRoomSchema), async (req: Request, res: Response): Promise<void> => {
  const auth = res.locals.auth as OperatorPayload; // safe: set by requireOperatorAuth
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
