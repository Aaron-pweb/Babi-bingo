import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { ClientToServerEvents, ServerToClientEvents } from '@babi-bingo/shared';

import { redis } from './redis/client';
import { socketAuthMiddleware } from './middleware/socketAuth';
import { registerRoomHandlers } from './socket/roomHandlers';
import { registerControlHandlers } from './socket/controlHandlers';
import authRoutes from './routes/authRoutes';
import roomRoutes from './routes/roomRoutes';

const PORT = Number(process.env.PORT ?? 4000);
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'http://localhost:5173';

// ─────────────────────────────────────────────
//  Express
// ─────────────────────────────────────────────
const app = express();

app.use(cors({ origin: FRONTEND_URL, credentials: true }));
app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);

// ─────────────────────────────────────────────
//  Socket.io
// ─────────────────────────────────────────────
const httpServer = http.createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Auth middleware for every socket connection
io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  console.log(`[Socket] Connected: ${socket.id} | role=${socket.data.role} | uuid=${socket.data.uuid}`);

  registerRoomHandlers(io, socket);
  registerControlHandlers(io, socket);

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${socket.id} (${reason})`);
  });
});

// ─────────────────────────────────────────────
//  Boot
// ─────────────────────────────────────────────
async function main(): Promise<void> {
  await redis.connect();

  httpServer.listen(PORT, () => {
    console.log(`\n🎱  Babi-Bingo server running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health\n`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
