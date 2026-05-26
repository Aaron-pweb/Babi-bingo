import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, BingoCard } from '@babi-bingo/shared';
import { generateBingoCard } from './cardGenerator';
import { initializeDeck } from './caller';
import { validateBingo } from './winValidator';
import {
  getRoom, updateRoom, getPlayers, getCard,
  saveCards, isOnCooldown, setCooldown, roomKey,
} from '../rooms/roomManager';
import { atomicStateTransition } from '../redis/client';
import { scheduleNextTick } from '../queues/gameQueue'; // C4: BullMQ replaces setInterval

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

// ─────────────────────────────────────────────
//  C4: No more in-memory interval registry.
//  Game loop is now a BullMQ job chain in Redis.
//  To stop: set room.state ≠ 'PLAYING' — the
//  worker checks state on every tick and won't
//  reschedule when the game is not PLAYING.
// ─────────────────────────────────────────────

export async function handleStartGame(io: TypedServer, roomCode: string): Promise<void> {
  const room = await getRoom(roomCode);
  if (!room) return;

  // C1: Atomically transition WAITING → PLAYING — prevents double-start races
  const transitioned = await atomicStateTransition(roomKey(roomCode), 'WAITING', 'PLAYING');
  if (!transitioned) {
    console.warn(`[GameLoop] start_game race: room ${roomCode} already left WAITING`);
    return;
  }

  const players = await getPlayers(roomCode);
  const gamePlayers = players.filter((p) => p.role === 'PLAYER');

  // Generate and persist a unique card per player (M3: O(1) HGET per card)
  const cards: Record<string, BingoCard> = {};
  for (const p of gamePlayers) cards[p.uuid] = generateBingoCard();

  const deck = initializeDeck();
  await saveCards(roomCode, cards);           // M3: HSET per card
  await updateRoom(roomCode, { deck, calledNumbers: [] });

  // Deliver each player their private card
  for (const p of gamePlayers) {
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.emit('game_starting', { card: cards[p.uuid], pattern: room.pattern, intervalSeconds: room.intervalSeconds });
  }

  // Broadcast to room so DISPLAY clients know the game started
  io.to(roomCode).emit('game_starting', { pattern: room.pattern, intervalSeconds: room.intervalSeconds });

  // C4: Schedule the first BullMQ tick after 3 s countdown
  //     Each tick will schedule the next one — self-perpetuating chain
  await scheduleNextTick(roomCode, room.intervalSeconds, 3000 + room.intervalSeconds * 1000);
}

export async function handleClaimBingo(io: TypedServer, socket: TypedSocket, roomCode: string): Promise<void> {
  const room = await getRoom(roomCode);
  if (!room || room.state !== 'PLAYING') return;

  if (await isOnCooldown(roomCode, socket.data.uuid)) {
    socket.emit('game_error', { code: 'COOLDOWN', message: 'Wait 3 seconds before claiming again' });
    return;
  }

  const card = await getCard(roomCode, socket.data.uuid); // M3: O(1) HGET
  if (!card) return;

  const isWin = validateBingo(card, room.calledNumbers, room.pattern);

  if (isWin) {
    // C1: Atomic PLAYING → FINISHED — only the first winner wins
    const won = await atomicStateTransition(roomKey(roomCode), 'PLAYING', 'FINISHED');
    if (!won) return; // Another player won the race — ignore

    // C4: No stopGameLoop() call needed — the BullMQ worker reads state from
    //     Redis on its next tick and sees FINISHED, so it won't reschedule.
    io.to(roomCode).emit('game_won', {
      winner: { uuid: socket.data.uuid, nickname: socket.data.nickname },
      pattern: room.pattern,
      calledNumbers: room.calledNumbers,
    });
  } else {
    await setCooldown(roomCode, socket.data.uuid); // M3: O(1) HSET
    io.to(roomCode).emit('false_alarm', {
      uuid: socket.data.uuid,
      nickname: socket.data.nickname,
      cooldownSeconds: 3,
    });
  }
}
