/**
 * Integration tests for /api/auth routes (unified auth architecture).
 * Mocks Redis so no running Redis instance is required.
 */

import request from 'supertest';
import express from 'express';
import { globalErrorHandler } from '../../middleware/errorHandler';

// ── Mock Redis BEFORE importing authRoutes ────────────────────────
const store = new Map<string, string>();
jest.mock('../../redis/client', () => ({
  redis: {
    ping: jest.fn().mockResolvedValue('PONG'),
    quit: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockImplementation((key: string) => { store.delete(key); return Promise.resolve(1); }),
    get: jest.fn().mockImplementation((key: string) => Promise.resolve(store.get(key) ?? null)),
    setex: jest.fn().mockImplementation((key: string, _ttl: number, val: string) => { store.set(key, val); return Promise.resolve('OK'); }),
  },
  redisGet: jest.fn().mockImplementation(<T>(key: string) => {
    const val = store.get(key);
    if (!val) return Promise.resolve(null);
    try { return Promise.resolve(JSON.parse(val) as T); } catch { return Promise.resolve(val as unknown as T); }
  }),
  redisSet: jest.fn().mockImplementation((key: string, value: unknown) => {
    store.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    return Promise.resolve();
  }),
}));

process.env.JWT_SECRET      = 'test-secret-that-is-long-enough-for-hs256-algorithm';
process.env.ADMIN_USERNAME  = 'admin';
process.env.ADMIN_PASSWORD  = 'adminpass123';

import authRoutes from '../../routes/authRoutes';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(globalErrorHandler);

describe('/api/auth', () => {
  // ── Guest ───────────────────────────────────────────────────────
  describe('POST /api/auth/guest', () => {
    it('returns uuid + token for valid nickname', async () => {
      const res = await request(app).post('/api/auth/guest').send({ nickname: 'Tester' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('uuid');
      expect(res.body).toHaveProperty('token');
    });

    it('rejects nickname < 2 chars', async () => {
      const res = await request(app).post('/api/auth/guest').send({ nickname: 'X' });
      expect(res.status).toBe(400);
    });

    it('rejects missing nickname', async () => {
      const res = await request(app).post('/api/auth/guest').send({});
      expect(res.status).toBe(400);
    });
  });

  // ── Player register ─────────────────────────────────────────────
  describe('POST /api/auth/register (player)', () => {
    const player = { username: 'player1', password: 'secret123', nickname: 'PlayOne', phone: '912345678' };
    let refreshToken: string;

    it('creates a new player account', async () => {
      const res = await request(app).post('/api/auth/register').send(player);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.role).toBe('PLAYER');
      expect(res.body.nickname).toBe('PlayOne');
      refreshToken = res.body.refreshToken;
    });

    it('rejects duplicate username with 409', async () => {
      const res = await request(app).post('/api/auth/register').send(player);
      expect(res.status).toBe(409);
    });

    it('rejects duplicate phone with 409', async () => {
      const res = await request(app).post('/api/auth/register')
        .send({ ...player, username: 'player2' }); // same phone
      expect(res.status).toBe(409);
    });

    it('rejects invalid phone (8 digits)', async () => {
      const res = await request(app).post('/api/auth/register')
        .send({ username: 'player3', password: 'secret123', nickname: 'P3', phone: '91234567' });
      expect(res.status).toBe(400);
    });

    it('rejects phone not starting with 9', async () => {
      const res = await request(app).post('/api/auth/register')
        .send({ username: 'player4', password: 'secret123', nickname: 'P4', phone: '812345678' });
      expect(res.status).toBe(400);
    });

    it('rejects missing nickname with 400', async () => {
      const res = await request(app).post('/api/auth/register')
        .send({ username: 'player5', password: 'secret123', phone: '912345679' });
      expect(res.status).toBe(400);
    });

    it('rejects password shorter than 6 chars', async () => {
      const res = await request(app).post('/api/auth/register')
        .send({ username: 'player6', password: '123', nickname: 'P6', phone: '912345680' });
      expect(res.status).toBe(400);
    });

    // ── Refresh for player ──────────────────────────────────────
    it('returns new token with valid refreshToken', async () => {
      const res = await request(app).post('/api/auth/refresh').send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });
  });

  // ── Unified login ───────────────────────────────────────────────
  describe('POST /api/auth/login (unified)', () => {
    it('logs in a registered player and returns PLAYER role', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ username: 'player1', password: 'secret123' });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('PLAYER');
      expect(res.body).toHaveProperty('token');
    });

    it('logs in admin with env credentials', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ username: 'admin', password: 'adminpass123' });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('ADMIN');
      expect(res.body).toHaveProperty('token');
    });

    it('rejects wrong admin password with 401', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ username: 'admin', password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });

    it('rejects wrong player password with 401', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ username: 'player1', password: 'wrongpass' });
      expect(res.status).toBe(401);
    });

    it('rejects unknown user with 401', async () => {
      const res = await request(app).post('/api/auth/login')
        .send({ username: 'nobody', password: 'anything' });
      expect(res.status).toBe(401);
    });
  });

  // ── Refresh ─────────────────────────────────────────────────────
  describe('POST /api/auth/refresh', () => {
    it('rejects invalid token with 401', async () => {
      const res = await request(app).post('/api/auth/refresh')
        .send({ refreshToken: 'not.a.valid.token' });
      expect(res.status).toBe(401);
    });

    it('rejects missing token with 400', async () => {
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(400);
    });
  });

  // ── Body size ───────────────────────────────────────────────────
  it('rejects requests with oversized nickname', async () => {
    const res = await request(app).post('/api/auth/guest')
      .send({ nickname: 'A'.repeat(11_000) });
    expect([400, 413]).toContain(res.status);
  });
});
