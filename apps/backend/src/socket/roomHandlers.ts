import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, Player } from '@babi-bingo/shared';
import {
  getRoom, getPlayers, addPlayer, removePlayer, getCard, updateRoom,
  toRoomInfo,
} from '../rooms/roomManager';
import { requireRole } from '../middleware/socketAuth';
import { logger } from '../logger';
import type { WinPattern } from '@babi-bingo/shared';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerRoomHandlers(io: TypedServer, socket: TypedSocket): void {

  // ── join_room ──────────────────────────────────────────────────
  socket.on('join_room', async ({ roomCode }) => {
    if (!requireRole(socket, 'PLAYER', 'OWNER')) return;

    const room = await getRoom(roomCode);
    if (!room) {
      socket.emit('game_error', { code: 'ROOM_NOT_FOUND', message: `Room ${roomCode} does not exist` });
      return;
    }

    const player: Player = {
      uuid: socket.data.uuid,
      nickname: socket.data.nickname,
      role: socket.data.role,
      socketId: socket.id,
    };

    const players = await addPlayer(roomCode, player);
    await socket.join(roomCode);

    socket.emit('room_joined', { room: toRoomInfo(room, players.length), players });
    socket.to(roomCode).emit('player_joined', { player, playerCount: players.length });

    socket.data.currentRoom = roomCode; // M2: properly typed
  });

  // ── join_display ──────────────────────────────────────────────
  socket.on('join_display', async ({ roomCode }) => {
    if (!requireRole(socket, 'DISPLAY')) return;

    const room = await getRoom(roomCode);
    if (!room) {
      socket.emit('game_error', { code: 'ROOM_NOT_FOUND', message: `Room ${roomCode} does not exist` });
      return;
    }

    await socket.join(roomCode);
    const players = await getPlayers(roomCode);

    // M1: Use shared toRoomInfo helper
    socket.emit('room_joined', { room: toRoomInfo(room, players.length), players });
    socket.data.currentRoom = roomCode;
    logger.info({ roomCode, socketId: socket.id }, '[Socket] Display connected');
  });

  // ── request_sync ──────────────────────────────────────────────
  socket.on('request_sync', async ({ roomCode }) => {
    const room = await getRoom(roomCode);
    if (!room) return;

    const players = await getPlayers(roomCode);
    let card = undefined;
    if (socket.data.role === 'PLAYER') {
      const stored = await getCard(roomCode, socket.data.uuid);
      card = stored ?? undefined;
    }

    socket.emit('sync_state', { room: toRoomInfo(room, players.length), players, card });
  });

  // ── set_pattern — H4 ─────────────────────────────────────────
  socket.on('set_pattern', async ({ roomCode, pattern }) => {
    if (!requireRole(socket, 'OWNER')) return;
    const room = await getRoom(roomCode);
    if (!room) { socket.emit('game_error', { code: 'ROOM_NOT_FOUND', message: `Room ${roomCode} not found` }); return; }
    if (room.operatorUuid !== socket.data.uuid) { socket.emit('game_error', { code: 'FORBIDDEN', message: 'Only the room operator can set the pattern' }); return; }
    if (room.state !== 'WAITING') { socket.emit('game_error', { code: 'INVALID_STATE', message: 'Pattern can only be changed before the game starts' }); return; }

    await updateRoom(roomCode, { pattern: pattern as WinPattern });
    // Confirm change back to the operator
    socket.emit('game_error', { code: 'PATTERN_SET', message: `Pattern set to ${pattern}` });
  });

  // ── disconnect ────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    const roomCode = socket.data.currentRoom; // M2: no more unsafe cast
    if (!roomCode || socket.data.role === 'DISPLAY') return;

    const players = await removePlayer(roomCode, socket.data.uuid);
    io.to(roomCode).emit('player_left', {
      uuid: socket.data.uuid,
      nickname: socket.data.nickname,
      playerCount: players.length,
    });
  });
}
