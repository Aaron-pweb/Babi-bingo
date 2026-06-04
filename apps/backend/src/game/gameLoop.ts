import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, BingoCard } from '@babi-bingo/shared';
import { generateBingoCard } from './cardGenerator';
import { initializeDeck } from './caller';
import { validateBingo } from './winValidator';
import { getRoom, updateRoom, getPlayers, getCard,
  saveCards, isOnCooldown, setCooldown, roomKey,
} from '../rooms/roomManager';
import { atomicStateTransition } from '../redis/client';
import { scheduleNextTick } from '../queues/gameQueue';
import { redis } from '../redis/client';
import { logger } from '../logger';

type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;
type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

const HISTORY_MAX = 50;   // keep last 50 games per player

// ─────────────────────────────────────────────
//  Write one history entry for every player who was in the room.
//  winnerUuid = 'draw' when all 75 balls are called with no winner.
// ─────────────────────────────────────────────
async function recordGameHistory(
  roomCode: string,
  houseName: string,
  pattern: string,
  calledCount: number,
  winnerUuid: string,
  playerUuids: string[],
): Promise<void> {
  const ts = new Date().toISOString();
  const pipeline = redis.pipeline();

  for (const uuid of playerUuids) {
    const entry = JSON.stringify({
      roomCode,
      houseName,
      pattern,
      result: uuid === winnerUuid ? 'WON' : 'LOST',
      calledCount,
      ts,
    });
    const histKey = `player:${uuid}:history`;
    pipeline.lpush(histKey, entry);
    pipeline.ltrim(histKey, 0, HISTORY_MAX - 1);
  }

  await pipeline.exec();
  logger.info({ roomCode, players: playerUuids.length, winner: winnerUuid }, '[Game] History written');
}

export async function handleStartGame(io: TypedServer, roomCode: string): Promise<void> {
  const room = await getRoom(roomCode);
  if (!room) return;

  // C1: Atomically transition WAITING → PLAYING — prevents double-start races
  const transitioned = await atomicStateTransition(roomKey(roomCode), 'WAITING', 'PLAYING');
  if (!transitioned) {
    logger.warn({ roomCode }, '[GameLoop] start_game race: room already left WAITING');
    return;
  }

  const players = await getPlayers(roomCode);
  const gamePlayers = players.filter((p) => p.role === 'PLAYER');

  // Generate and persist a unique card per player
  const cards: Record<string, BingoCard> = {};
  for (const p of gamePlayers) cards[p.uuid] = generateBingoCard();

  const deck = initializeDeck();
  await saveCards(roomCode, cards);
  await updateRoom(roomCode, { deck, calledNumbers: [] });

  // Deliver each player their private card
  for (const p of gamePlayers) {
    const s = io.sockets.sockets.get(p.socketId);
    if (s) s.emit('game_starting', { card: cards[p.uuid], pattern: room.pattern, intervalSeconds: room.intervalSeconds });
  }

  // Broadcast to room so DISPLAY clients know the game started
  io.to(roomCode).emit('game_starting', { pattern: room.pattern, intervalSeconds: room.intervalSeconds });

  // C4: Schedule first BullMQ tick after 3 s countdown
  await scheduleNextTick(roomCode, room.intervalSeconds, 3000 + room.intervalSeconds * 1000);
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
    // C1: Atomic PLAYING → FINISHED — only first winner wins
    const won = await atomicStateTransition(roomKey(roomCode), 'PLAYING', 'FINISHED');
    if (!won) return;

    io.to(roomCode).emit('game_won', {
      winner: { uuid: socket.data.uuid, nickname: socket.data.nickname },
      pattern: room.pattern,
      calledNumbers: room.calledNumbers,
    });

    // Write history for all players in the room
    const players = await getPlayers(roomCode);
    const playerUuids = players.filter(p => p.role === 'PLAYER').map(p => p.uuid);
    await recordGameHistory(
      roomCode, room.houseName, room.pattern,
      room.calledNumbers.length, socket.data.uuid, playerUuids,
    );
  } else {
    await setCooldown(roomCode, socket.data.uuid);
    io.to(roomCode).emit('false_alarm', {
      uuid: socket.data.uuid,
      nickname: socket.data.nickname,
      cooldownSeconds: 3,
    });
  }
}
