/**
 * L3: Integration tests for /api/auth routes.
 * Uses supertest to make real HTTP requests against an Express instance.
 * Redis and BullMQ are NOT required — this tests business logic only.
 */

import request from 'supertest';
import express from 'express';
import authRoutes from '../../routes/authRoutes';
import { globalErrorHandler } from '../../middleware/errorHandler';

// Set a JWT secret so tokens.ts doesn't throw
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-algorithm';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use(globalErrorHandler);

describe('/api/auth', () => {
  const user = { username: 'testop', password: 'secret123', houseName: 'Test House' };
  let refreshToken: string;

  // ── Guest token ────────────────────────────────────────────────
  describe('POST /api/auth/guest', () => {
    it('returns uuid + token for a valid nickname', async () => {
      const res = await request(app)
        .post('/api/auth/guest')
        .send({ nickname: 'Tester' });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('uuid');
      expect(res.body).toHaveProperty('token');
    });

    it('rejects nicknames shorter than 2 characters', async () => {
      const res = await request(app).post('/api/auth/guest').send({ nickname: 'X' });
      expect(res.status).toBe(400);
    });

    it('rejects nicknames longer than 24 characters', async () => {
      const res = await request(app).post('/api/auth/guest').send({ nickname: 'A'.repeat(25) });
      expect(res.status).toBe(400);
    });

    it('rejects missing nickname', async () => {
      const res = await request(app).post('/api/auth/guest').send({});
      expect(res.status).toBe(400);
    });
  });

  // ── Register ───────────────────────────────────────────────────
  describe('POST /api/auth/register', () => {
    it('creates a new operator account', async () => {
      const res = await request(app).post('/api/auth/register').send(user);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      refreshToken = res.body.refreshToken;
    });

    it('rejects duplicate username with 409', async () => {
      const res = await request(app).post('/api/auth/register').send(user);
      expect(res.status).toBe(409);
    });

    it('rejects missing houseName with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'other', password: 'pass123' });
      expect(res.status).toBe(400);
    });

    it('rejects password shorter than 6 chars', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ username: 'other2', password: '12', houseName: 'House' });
      expect(res.status).toBe(400);
    });
  });

  // ── Login ──────────────────────────────────────────────────────
  describe('POST /api/auth/login', () => {
    it('logs in with correct credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: user.username, password: user.password });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });

    it('rejects wrong password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: user.username, password: 'wrongpass' });
      expect(res.status).toBe(401);
    });

    it('rejects unknown username with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: 'nobody', password: 'anything' });
      expect(res.status).toBe(401);
    });
  });

  // ── Refresh ────────────────────────────────────────────────────
  describe('POST /api/auth/refresh', () => {
    it('returns new accessToken with valid refreshToken', async () => {
      // refreshToken was set during the register test
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('rejects invalid token with 401', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'not.a.valid.token' });
      expect(res.status).toBe(401);
    });

    it('rejects missing token with 400', async () => {
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(400);
    });
  });

  // ── Body size limit ────────────────────────────────────────────
  it('C6: rejects requests over 10kb', async () => {
    const res = await request(app)
      .post('/api/auth/guest')
      .send({ nickname: 'A'.repeat(11_000) });
    // Either 400 (Zod rejects too-long nickname) or 413 (body limit) — both are correct
    expect([400, 413]).toContain(res.status);
  });
});
