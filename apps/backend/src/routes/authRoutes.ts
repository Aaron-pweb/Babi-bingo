import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { hash, compare } from 'bcryptjs';
import { signGuestToken, signAccessToken, signRefreshToken, verifyToken } from '../auth/tokens';
import { validate, GuestSchema, RegisterSchema, LoginSchema, RefreshSchema } from '../middleware/validate';

const router = Router();

// ─── In-memory operator store (replaced by DB in Phase 4) ───────
interface OperatorRecord {
  uuid: string;
  username: string;
  passwordHash: string; // C2: always bcrypt-hashed
  role: 'OPERATOR' | 'OWNER';
  houseId: string;
  houseName: string;
}

const operators = new Map<string, OperatorRecord>();

// POST /api/auth/guest
router.post('/guest', validate(GuestSchema), async (req: Request, res: Response): Promise<void> => {
  const { nickname } = req.body as { nickname: string };
  const uuid = uuidv4();
  const token = await signGuestToken(uuid, nickname.trim());
  res.json({ uuid, token });
});

// POST /api/auth/register
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

  const accessToken = await signAccessToken(uuid, resolvedRole, houseId, username);
  const refreshToken = await signRefreshToken(uuid);

  res.status(201).json({ uuid, houseId, accessToken, refreshToken });
});

// POST /api/auth/login
router.post('/login', validate(LoginSchema), async (req: Request, res: Response): Promise<void> => {
  const { username, password } = req.body as { username: string; password: string };

  const op = operators.get(username);

  if (!op || !(await compare(password, op.passwordHash))) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }

  const accessToken = await signAccessToken(op.uuid, op.role, op.houseId, op.username);
  const refreshToken = await signRefreshToken(op.uuid);

  res.json({ uuid: op.uuid, houseId: op.houseId, houseName: op.houseName, accessToken, refreshToken });
});

// POST /api/auth/refresh  — C5
router.post('/refresh', validate(RefreshSchema), async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body as { refreshToken: string };

  try {
    const payload = await verifyToken(refreshToken) as { uuid?: string; type?: string };
    if (payload.type !== 'refresh' || !payload.uuid) {
      res.status(401).json({ error: 'Invalid refresh token' });
      return;
    }

    const op = [...operators.values()].find((o) => o.uuid === payload.uuid);
    if (!op) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    const accessToken = await signAccessToken(op.uuid, op.role, op.houseId, op.username);
    res.json({ accessToken });
  } catch {
    res.status(401).json({ error: 'Refresh token invalid or expired' });
  }
});

export default router;
