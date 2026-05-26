import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { signGuestToken, signAccessToken, signRefreshToken } from '../auth/tokens';

const router = Router();

// ─── In-memory operator store (replaced by DB in Phase 4) ───────
// Shape: { uuid, username, passwordHash, houseId, houseName, role }
// For Phase 2 we store plain text — DO NOT use in production.
interface OperatorRecord {
  uuid: string;
  username: string;
  password: string; // plaintext, Phase 4 will hash with bcrypt
  role: 'OPERATOR' | 'OWNER';
  houseId: string;
  houseName: string;
}

const operators = new Map<string, OperatorRecord>(); // keyed by username

// ─────────────────────────────────────────────
//  POST /api/auth/guest
//  Body: { nickname: string }
//  Returns: { token: string }
// ─────────────────────────────────────────────
router.post('/guest', async (req: Request, res: Response): Promise<void> => {
  const { nickname } = req.body as { nickname?: string };

  if (!nickname || nickname.trim().length < 2 || nickname.trim().length > 24) {
    res.status(400).json({ error: 'Nickname must be 2–24 characters' });
    return;
  }

  const uuid = uuidv4();
  const token = await signGuestToken(uuid, nickname.trim());

  res.json({ uuid, token });
});

// ─────────────────────────────────────────────
//  POST /api/auth/register
//  Body: { username, password, houseName, role }
//  Returns: { accessToken, refreshToken }
// ─────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  const { username, password, houseName, role } = req.body as {
    username?: string;
    password?: string;
    houseName?: string;
    role?: string;
  };

  if (!username || !password || !houseName) {
    res.status(400).json({ error: 'username, password, and houseName are required' });
    return;
  }

  if (operators.has(username)) {
    res.status(409).json({ error: 'Username already exists' });
    return;
  }

  const resolvedRole: 'OPERATOR' | 'OWNER' =
    role === 'OPERATOR' ? 'OPERATOR' : 'OWNER';

  const uuid = uuidv4();
  const houseId = uuidv4();

  operators.set(username, {
    uuid,
    username,
    password,
    role: resolvedRole,
    houseId,
    houseName,
  });

  const accessToken = await signAccessToken(uuid, resolvedRole, houseId, username);
  const refreshToken = await signRefreshToken(uuid);

  res.status(201).json({ uuid, houseId, accessToken, refreshToken });
});

// ─────────────────────────────────────────────
//  POST /api/auth/login
//  Body: { username, password }
//  Returns: { accessToken, refreshToken }
// ─────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username?: string; password?: string };

  const op = username ? operators.get(username) : undefined;

  if (!op || op.password !== password) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const accessToken = await signAccessToken(op.uuid, op.role, op.houseId, op.username);
  const refreshToken = await signRefreshToken(op.uuid);

  res.json({ uuid: op.uuid, houseId: op.houseId, houseName: op.houseName, accessToken, refreshToken });
});

export default router;
