import { Queue, Worker, type Job } from 'bullmq';
import { Server } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '@babi-bingo/shared';
import { getRoom, updateRoom } from '../rooms/roomManager';
import { drawNumber } from '../game/caller';

// ─────────────────────────────────────────────
//  Redis connection config for BullMQ
//  BullMQ manages its own ioredis instances internally —
//  it must not share the app's existing connection.
// ─────────────────────────────────────────────
const rawUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
const parsedUrl = new URL(rawUrl);

export const bullConnection = {
  host:     parsedUrl.hostname,
  port:     parseInt(parsedUrl.port || '6379', 10),
  password: parsedUrl.password || undefined,
  db:       parsedUrl.pathname ? parseInt(parsedUrl.pathname.slice(1) || '0', 10) : 0,
};

// ─────────────────────────────────────────────
//  Job payload shape
// ─────────────────────────────────────────────
export interface TickJobData {
  roomCode: string;
  intervalSeconds: number;
}

// ─────────────────────────────────────────────
//  C4: BullMQ Queue — Redis-backed, survives server restarts
//  Replaces the in-memory setInterval registry.
// ─────────────────────────────────────────────
export const gameQueue = new Queue<TickJobData>('bingo-ticks', {
  connection: bullConnection,
  defaultJobOptions: {
    attempts: 1,         // Don't retry failed ticks — next tick will self-heal
    removeOnComplete: 50, // Keep last 50 completed jobs for debugging
    removeOnFail: 100,
  },
});

/**
 * Schedule the next tick for a room.
 * The job is delayed by `intervalSeconds` (or a custom `delayMs`).
 * When the worker processes it, it will schedule the next one — forming
 * a self-perpetuating chain that stops naturally when state ≠ PLAYING.
 */
export async function scheduleNextTick(
  roomCode: string,
  intervalSeconds: number,
  delayMs?: number,
): Promise<void> {
  await gameQueue.add(
    'tick',
    { roomCode, intervalSeconds },
    { delay: delayMs ?? intervalSeconds * 1000 },
  );
}

/**
 * C4: Start the BullMQ worker.
 * Called once from index.ts after the Socket.io server is created.
 * The `io` instance is captured in closure — works for single-process deployments.
 * For multi-process, replace io.to() with Redis pub/sub.
 */
export function startGameWorker(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
): Worker<TickJobData> {
  const worker = new Worker<TickJobData>(
    'bingo-ticks',
    async (job: Job<TickJobData>) => {
      const { roomCode, intervalSeconds } = job.data;
      const room = await getRoom(roomCode);

      // ── Terminal states: stop the chain ──────────────────────
      if (!room || room.state === 'FINISHED' || room.state === 'WAITING') {
        return; // Game over — no next tick scheduled
      }

      // ── Paused: keep chain alive, skip drawing ────────────────
      if (room.state === 'PAUSED') {
        await scheduleNextTick(roomCode, intervalSeconds);
        return;
      }

      // ── Deck exhausted: game ends in a draw ───────────────────
      if (room.deck.length === 0) {
        await updateRoom(roomCode, { state: 'FINISHED' });
        io.to(roomCode).emit('game_won', {
          winner: { uuid: 'draw', nickname: '— Draw —' },
          pattern: room.pattern,
          calledNumbers: room.calledNumbers,
        });
        return;
      }

      // ── Draw next number ──────────────────────────────────────
      const { number, column, remaining } = drawNumber(room.deck);
      const calledNumbers = [...room.calledNumbers, number];
      await updateRoom(roomCode, { deck: remaining, calledNumbers });

      io.to(roomCode).emit('number_called', {
        number, column, calledNumbers, remaining: remaining.length,
      });

      // ── Schedule the next tick (self-perpetuating chain) ──────
      if (remaining.length > 0) {
        await scheduleNextTick(roomCode, intervalSeconds);
      } else {
        // Last number was just called — game ends after this broadcast
        await updateRoom(roomCode, { state: 'FINISHED' });
      }
    },
    { connection: bullConnection, concurrency: 10 },
  );

  worker.on('failed', (job, err) => {
    console.error(`[GameWorker] Tick failed for room ${job?.data.roomCode}:`, err.message);
  });

  worker.on('ready', () => {
    console.log('[GameWorker] BullMQ worker ready ✅');
  });

  return worker;
}
