import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '@babi-bingo/shared';
import { getRoom, updateRoom, getPlayers, removePlayer } from '../rooms/roomManager';
import { requireRole } from '../middleware/socketAuth';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

/**
 * Verifies the socket user is the designated operator for a room.
 */
async function isRoomOperator(socket: TypedSocket, roomCode: string): Promise<boolean> {
  const room = await getRoom(roomCode);
  if (!room) {
    socket.emit('game_error', { code: 'ROOM_NOT_FOUND', message: `Room ${roomCode} not found` });
    return false;
  }
  if (room.operatorUuid !== socket.data.uuid) {
    socket.emit('game_error', { code: 'FORBIDDEN', message: 'Only the room operator can do this' });
    return false;
  }
  return true;
}

export function registerControlHandlers(io: TypedServer, socket: TypedSocket): void {

  // ── start_game ────────────────────────────────────────────────
  socket.on('start_game', async ({ roomCode }) => {
    if (!requireRole(socket, 'OPERATOR', 'OWNER')) return;
    if (!await isRoomOperator(socket, roomCode)) return;

    const room = await getRoom(roomCode);
    if (!room || room.state !== 'WAITING') {
      socket.emit('game_error', { code: 'INVALID_STATE', message: 'Game is not in WAITING state' });
      return;
    }

    // Signal backend game state machine to begin STARTING phase
    // (card generation + game loop happen in gameHandlers.ts — Phase 3)
    await updateRoom(roomCode, { state: 'STARTING' });

    // Notify all clients — the game state machine will take over
    io.to(roomCode).emit('game_paused', { reason: 'Game is starting...' });

    console.log(`[Control] start_game → room ${roomCode}`);
  });

  // ── pause_game ────────────────────────────────────────────────
  socket.on('pause_game', async ({ roomCode }) => {
    if (!requireRole(socket, 'OPERATOR', 'OWNER')) return;
    if (!await isRoomOperator(socket, roomCode)) return;

    const room = await getRoom(roomCode);
    if (!room || room.state !== 'PLAYING') {
      socket.emit('game_error', { code: 'INVALID_STATE', message: 'Game is not currently PLAYING' });
      return;
    }

    await updateRoom(roomCode, { state: 'PAUSED' });
    io.to(roomCode).emit('game_paused', { reason: 'Paused by operator' });

    console.log(`[Control] pause_game → room ${roomCode}`);
  });

  // ── resume_game ───────────────────────────────────────────────
  socket.on('resume_game', async ({ roomCode }) => {
    if (!requireRole(socket, 'OPERATOR', 'OWNER')) return;
    if (!await isRoomOperator(socket, roomCode)) return;

    const room = await getRoom(roomCode);
    if (!room || room.state !== 'PAUSED') {
      socket.emit('game_error', { code: 'INVALID_STATE', message: 'Game is not PAUSED' });
      return;
    }

    await updateRoom(roomCode, { state: 'PLAYING' });
    io.to(roomCode).emit('game_resumed');

    console.log(`[Control] resume_game → room ${roomCode}`);
  });

  // ── kick_player ───────────────────────────────────────────────
  socket.on('kick_player', async ({ roomCode, targetUuid }) => {
    if (!requireRole(socket, 'OPERATOR', 'OWNER')) return;
    if (!await isRoomOperator(socket, roomCode)) return;

    const players = await getPlayers(roomCode);
    const target = players.find((p) => p.uuid === targetUuid);

    if (!target) {
      socket.emit('game_error', { code: 'PLAYER_NOT_FOUND', message: 'Player not in this room' });
      return;
    }

    // Remove from player list
    await removePlayer(roomCode, targetUuid);

    // Notify the kicked player's socket directly
    const targetSocket = io.sockets.sockets.get(target.socketId);
    if (targetSocket) {
      targetSocket.emit('player_kicked', { uuid: targetUuid });
      await targetSocket.leave(roomCode);
    }

    // Notify everyone else
    const updatedPlayers = await getPlayers(roomCode);
    io.to(roomCode).emit('player_left', {
      uuid: targetUuid,
      nickname: target.nickname,
      playerCount: updatedPlayers.length,
    });

    console.log(`[Control] kick_player ${target.nickname} from room ${roomCode}`);
  });
}
