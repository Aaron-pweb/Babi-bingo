import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { ClientToServerEvents, ServerToClientEvents } from '@babi-bingo/shared';

import { redis } from './redis/client';
import { logger } from './logger'; // M5
import { socketAuthMiddleware } from './middleware/socketAuth';
import { globalErrorHandler } from './middleware/errorHandler';
import { registerRoomHandlers } from './socket/roomHandlers';
import { registerControlHandlers } from './socket/controlHandlers';
import { startGameWorker, gameQueue } from './queues/gameQueue';
import authRoutes from './routes/authRoutes';
import roomRoutes from './routes/roomRoutes';
import adminRoutes from './routes/adminRoutes';
import playerRoutes from './routes/playerRoutes';
import ownerRoutes from './routes/ownerRoutes';
import type { Worker } from 'bullmq';

const PORT = Number(process.env.PORT ?? 4000);

// L4: Support multiple frontend origins from env (comma-separated)
const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173')
  .split(',').map((o) => o.trim());

// ─────────────────────────────────────────────
//  Express
// ─────────────────────────────────────────────
const app = express();

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));
// M5: Structured HTTP request logging
app.use(pinoHttp({ logger }));
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin) || origin.includes('10.') || origin.includes('192.168.') || origin.includes('172.')) {
      return cb(null, true);
    }
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10kb' }));

// H2: Rate limiters
// Strict limit on login/register — brute-force protection
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
  skip: (req) => req.method === 'GET', // never limit GET /me
});

const roomCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Room creation limit reached, try again later' },
});

// ─────────────────────────────────────────────
//  L6: Enhanced /health endpoint with metrics
// ─────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  const redisOk = await redis.ping().then(() => true).catch(() => false);
  const [waiting, active, delayed] = await Promise.all([
    gameQueue.getWaitingCount(),
    gameQueue.getActiveCount(),
    gameQueue.getDelayedCount(),
  ]);
  res.json({
    status: redisOk ? 'ok' : 'degraded',
    redis: redisOk,
    gameLoop: { waiting, active, delayed },
    uptime: Math.floor(process.uptime()),
    memory: process.memoryUsage().rss,
    ts: new Date().toISOString(),
  });
});

app.use('/api/auth', authLimiter, authRoutes);
app.post('/api/rooms', roomCreateLimiter, roomRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/players', playerRoutes);
app.use('/api/owner', ownerRoutes);

// Serve frontend static assets in production
if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.join(__dirname, '../../../../frontend/dist');
  app.use(express.static(frontendDistPath));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

// H6: Global error handler — MUST be last
app.use(globalErrorHandler);

// ─────────────────────────────────────────────
//  Socket.io
// ─────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: (origin, cb) => {
      // Allow no-origin (curl, mobile apps), and any private network IP
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        /^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(origin)
      ) {
        cb(null, true);
      } else {
        cb(new Error(`Socket CORS: origin ${origin} not allowed`));
      }
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  logger.info({ socketId: socket.id, role: socket.data.role, uuid: socket.data.uuid }, '[Socket] Connected');
  registerRoomHandlers(io, socket);
  registerControlHandlers(io, socket);
  socket.on('disconnect', (reason) => {
    logger.info({ socketId: socket.id, reason }, '[Socket] Disconnected');
  });
});

// ─────────────────────────────────────────────
//  Boot + Graceful Shutdown (H5)
// ─────────────────────────────────────────────
let gameWorker: Worker | null = null;

async function main(): Promise<void> {
  await redis.connect();
  gameWorker = startGameWorker(io);

  httpServer.listen(PORT, () => {
    logger.info({ port: PORT }, `🎱  Babi-Bingo server ready`);
  });
}

async function shutdown(signal: string): Promise<void> {
  logger.warn({ signal }, '[Shutdown] Graceful shutdown initiated');
  httpServer.close(async () => {
    logger.info('[Shutdown] HTTP server closed');
    if (gameWorker) await gameWorker.close();
    await redis.quit();
    logger.info('[Shutdown] Done');
    process.exit(0);
  });
  setTimeout(() => { logger.error('[Shutdown] Forced exit'); process.exit(1); }, 10_000);
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT',  () => { void shutdown('SIGINT'); });

main().catch((err: Error) => {
  logger.fatal({ err }, 'Fatal startup error');
  process.exit(1);
});
