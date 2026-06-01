/**
 * L3: Integration tests for /api/rooms routes.
 *
 * Uses an in-memory store via jest.mock so no real Redis is needed.
 * The store is defined inside the factory (jest-hoisting-safe).
 */

import request from 'supertest';
import express from 'express';

process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-algorithm';

// ── Mock must use ONLY factory-local state (jest.mock is hoisted) ─
jest.mock('../../redis/client', () => {
  // All state inside the factory — safe from hoisting
  const store  = new Map<string, string>();
  const hashes = new Map<string, Map<string, string>>();

  const mockRedis = {
    connect: jest.fn(),
    quit: jest.fn(),
    on: jest.fn(),
    ping: jest.fn().mockResolvedValue('PONG'),
    get:   jest.fn((k: string) => Promise.resolve(store.get(k) ?? null)),
    set:   jest.fn((k: string, v: string) => { store.set(k, v); return Promise.resolve('OK'); }),
    setex: jest.fn((k: string, _t: number, v: string) => { store.set(k, v); return Promise.resolve('OK'); }),
    del:   jest.fn((k: string) => { store.delete(k); return Promise.resolve(1); }),
    expire: jest.fn().mockResolvedValue(1),
    eval:   jest.fn().mockResolvedValue(1),
    hset: jest.fn((k: string, ...args: string[]) => {
      if (!hashes.has(k)) hashes.set(k, new Map());
      for (let i = 0; i < args.length; i += 2) hashes.get(k)!.set(args[i], args[i + 1]);
      return Promise.resolve(1);
    }),
    hget: jest.fn((k: string, f: string) => Promise.resolve(hashes.get(k)?.get(f) ?? null)),
    hgetall: jest.fn((k: string) => {
      const h = hashes.get(k);
      return Promise.resolve(h ? Object.fromEntries(h) : null);
    }),
    hdel: jest.fn((k: string, f: string) => { hashes.get(k)?.delete(f); return Promise.resolve(1); }),
  };

  return {
    redis: mockRedis,
    redisGet: jest.fn(async (k: string) => {
      const raw = store.get(k);
      return raw ? JSON.parse(raw) : null;
    }),
    redisSet: jest.fn(async (k: string, v: unknown, ttl?: number) => {
      if (ttl) mockRedis.setex(k, ttl, JSON.stringify(v));
      else     mockRedis.set(k, JSON.stringify(v));
    }),
    redisDel: jest.fn(async (k: string) => { store.delete(k); }),
    redisExpire: jest.fn(),
    atomicStateTransition: jest.fn().mockResolvedValue(true),
  };
});

// Import routes AFTER mock declaration (jest hoisting places the mock above these)
import authRoutes from '../../routes/authRoutes';
import roomRoutes from '../../routes/roomRoutes';
import { globalErrorHandler } from '../../middleware/errorHandler';

const app = express();
app.use(express.json({ limit: '10kb' }));
app.use('/api/auth', authRoutes);
app.post('/api/rooms', roomRoutes);
app.use('/api/rooms', roomRoutes);
app.use(globalErrorHandler);

describe('/api/rooms', () => {
  let accessToken: string;
  let roomCode: string;

  // Create an owner directly in the operators store and login to get a token
  beforeAll(async () => {
    // Import operators map and hash — bcrypt is still real here
    const { operators } = await import('../../routes/authRoutes');
    const { hash } = await import('bcryptjs');
    const { signAccessToken } = await import('../../auth/tokens');

    const uuid    = 'test-owner-uuid';
    const houseId = 'test-house-id';
    operators.set('roomop', {
      uuid, username: 'roomop',
      passwordHash: await hash('roompass', 12),
      role: 'OWNER', houseId, houseName: 'Room House',
      phone: '+251912345678', createdAt: new Date().toISOString(),
    });

    accessToken = await signAccessToken(uuid, 'OWNER', houseId, 'roomop', 'Room House');
  }, 20_000);


  // ── POST /api/rooms ────────────────────────────────────────────
  describe('POST /api/rooms', () => {
    it('creates a room with valid operator token', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({});
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('code');
      expect(res.body).toHaveProperty('pattern');
      roomCode = res.body.code;
    });

    it('accepts custom pattern and intervalSeconds', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pattern: 'COVERALL', intervalSeconds: 10 });
      expect(res.status).toBe(201);
      expect(res.body.pattern).toBe('COVERALL');
      expect(res.body.intervalSeconds).toBe(10);
    });

    it('rejects invalid pattern with 400', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ pattern: 'INVALID' });
      expect(res.status).toBe(400);
    });

    it('rejects missing authorization with 401', async () => {
      const res = await request(app).post('/api/rooms').send({});
      expect(res.status).toBe(401);
    });

    it('rejects invalid token with 401', async () => {
      const res = await request(app)
        .post('/api/rooms')
        .set('Authorization', 'Bearer not.a.real.token')
        .send({});
      expect(res.status).toBe(401);
    });
  });

  // ── GET /api/rooms/:code ───────────────────────────────────────
  describe('GET /api/rooms/:code', () => {
    it('returns room info for a room created above', async () => {
      // roomCode is set by the first POST test — skip if that test failed
      expect(roomCode).toBeDefined();
      const res = await request(app).get(`/api/rooms/${roomCode}`);
      expect(res.status).toBe(200);
      expect(res.body.code).toBe(roomCode);
      expect(res.body).toHaveProperty('state');
      expect(res.body).toHaveProperty('calledNumbers');
    });

    it('returns 404 for non-existent room', async () => {
      const res = await request(app).get('/api/rooms/FAKE-9999');
      expect(res.status).toBe(404);
    });
  });
});
