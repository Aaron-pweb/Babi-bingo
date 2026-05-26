import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet'; // L1
import rateLimit from 'express-rate-limit'; // H2
import { ClientToServerEvents, ServerToClientEvents } from '@babi-bingo/shared';

import { redis } from './redis/client';
import { socketAuthMiddleware } from './middleware/socketAuth';
import { globalErrorHandler } from './middleware/errorHandler';
import { registerRoomHandlers } from './socket/roomHandlers';
import { registerControlHandlers } from './socket/controlHandlers';
import { startGameWorker } from './queues/gameQueue'; // C4: BullMQ worker
import authRoutes from './routes/authRoutes';
import roomRoutes from './routes/roomRoutes';

const PORT = Number(process.env.PORT ?? 4000);

// L4: Support multiple frontend origins from env (comma-separated)
const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(',').map((o) => o.trim());

// ─────────────────────────────────────────────
//  Express
// ─────────────────────────────────────────────
const app = express();

// L1: Helmet — security headers (CSP, HSTS, X-Frame-Options, etc.)
app.use(helmet());

// L4: Multi-origin CORS
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// C6: 10kb body size limit
app.use(express.json({ limit: '10kb' }));

// H2: Rate limiters per route group
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});

const roomCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Room creation limit reached, try again later' },
});

// Routes
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString(), uptime: process.uptime() }));
app.use('/api/auth', authLimiter, authRoutes);                    // H2: auth rate limit
app.post('/api/rooms', roomCreateLimiter, roomRoutes);            // H2: room creation rate limit
app.use('/api/rooms', roomRoutes);                                // other room routes (GET)

// ─────────────────────────────────────────────
//  Socket.io
// ─────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id} | role=${socket.data.role} | uuid=${socket.data.uuid}`);
  registerRoomHandlers(io, socket);
  registerControlHandlers(io, socket);
  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
  });
});

// H6: Global error handler — MUST be last
app.use(globalErrorHandler);

// ─────────────────────────────────────────────
//  Boot + Graceful Shutdown (H5)
// ─────────────────────────────────────────────
import type { Worker } from 'bullmq';
let gameWorker: Worker | null = null;

async function main(): Promise<void> {
  await redis.connect();

  // C4: Start BullMQ game tick worker (must be after io is created)
  gameWorker = startGameWorker(io);

  httpServer.listen(PORT, () => {
    console.log(`\n🎱  Babi-Bingo server running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health\n`);
  });
}

async function shutdown(signal: string): Promise<void> {
  console.log(`\n[Shutdown] Received ${signal}, shutting down gracefully…`);
  httpServer.close(async () => {
    console.log('[Shutdown] HTTP server closed');
    if (gameWorker) await gameWorker.close(); // C4: stop accepting new jobs
    await redis.quit();
    console.log('[Shutdown] Redis connection closed');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[Shutdown] Forced exit after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
process.on('SIGINT',  () => { void shutdown('SIGINT'); });

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
