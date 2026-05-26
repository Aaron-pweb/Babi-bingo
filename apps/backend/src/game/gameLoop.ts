import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, BingoCard } from '@babi-bingo/shared';
import { generateBingoCard } from './cardGenerator';
import { initializeDeck, drawNumber } from './caller';
import { validateBingo } from './winValidator';
import {
  getRoom, updateRoom, getPlayers, getCard,
  saveCards, isOnCooldown, setCooldown,
  roomKey,
} from '../rooms/roomManager';
import { atomicStateTransition } from '../redis/client';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

/** In-memory interval registry — one entry per active game room */
const activeIntervals = new Map<string, NodeJS.Timeout>();

export function stopGameLoop(roomCode: string): void {
  const t = activeIntervals.get(roomCode);
  if (t) { clearInterval(t); activeIntervals.delete(roomCode); }
}

export async function handleStartGame(io: TypedServer, roomCode: string): Promise<void> {
  const room = await getRoom(roomCode);
  if (!room) return;

  // C1: Atomically transition WAITING → PLAYING; if another process beat us, abort
  const transitioned = await atomicStateTransition(roomKey(roomCode), 'WAITING', 'PLAYING');
  if (!transitioned) {
    console.warn(`[GameLoop] start_game race: room ${roomCode} already left WAITING state`);
    return;
  }

  const players = await getPlayers(roomCode);
  const gamePlayers = players.filter((p) => p.role === 'PLAYER');

  // Generate a unique card per player
  const cards: Record<string, BingoCard> = {};
  for (const p of gamePlayers) cards[p.uuid] = generateBingoCard();

  const deck = initializeDeck();
  await saveCards(roomCode, cards);
  await updateRoom(roomCode, { deck, calledNumbers: [] });

  // Send each player their card privately
  for (const p of gamePlayers) {
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.emit('game_starting', { card: cards[p.uuid], pattern: room.pattern, intervalSeconds: room.intervalSeconds });
  }

  // Broadcast to room for DISPLAY clients (no card)
  io.to(roomCode).emit('game_starting', { pattern: room.pattern, intervalSeconds: room.intervalSeconds });

  // Start auto-calling after 3 s countdown
  setTimeout(() => startGameLoop(io, roomCode, room.intervalSeconds), 3000);
}

function startGameLoop(io: TypedServer, roomCode: string, intervalSeconds: number): void {
  stopGameLoop(roomCode); // safety: clear any stale interval

  const interval = setInterval(async () => {
    const room = await getRoom(roomCode);

    if (!room || room.state === 'PAUSED') return; // paused — keep interval alive, skip tick
    if (room.state !== 'PLAYING') { stopGameLoop(roomCode); return; }

    if (room.deck.length === 0) {
      await updateRoom(roomCode, { state: 'FINISHED' });
      stopGameLoop(roomCode);
      return;
    }

    const { number, column, remaining } = drawNumber(room.deck);
    const calledNumbers = [...room.calledNumbers, number];
    await updateRoom(roomCode, { deck: remaining, calledNumbers });

    io.to(roomCode).emit('number_called', { number, column, calledNumbers, remaining: remaining.length });
  }, intervalSeconds * 1000);

  activeIntervals.set(roomCode, interval);
}

export async function handleClaimBingo(io: TypedServer, socket: TypedSocket, roomCode: string): Promise<void> {
  const room = await getRoom(roomCode);
  if (!room || room.state !== 'PLAYING') return;

  if (await isOnCooldown(roomCode, socket.data.uuid)) {
    socket.emit('game_error', { code: 'COOLDOWN', message: 'Wait 3 seconds before claiming again' });
    return;
  }

  const card = await getCard(roomCode, socket.data.uuid);
  if (!card) return;

  const isWin = validateBingo(card, room.calledNumbers, room.pattern);

  if (isWin) {
    // C1: Atomically transition PLAYING → FINISHED
    // If another player won simultaneously, this returns false and we ignore
    const won = await atomicStateTransition(roomKey(roomCode), 'PLAYING', 'FINISHED');
    if (!won) return; // race: another player already won

    stopGameLoop(roomCode);
    io.to(roomCode).emit('game_won', {
      winner: { uuid: socket.data.uuid, nickname: socket.data.nickname },
      pattern: room.pattern,
      calledNumbers: room.calledNumbers,
    });
  } else {
    await setCooldown(roomCode, socket.data.uuid);
    io.to(roomCode).emit('false_alarm', {
      uuid: socket.data.uuid,
      nickname: socket.data.nickname,
      cooldownSeconds: 3,
    });
  }
}
