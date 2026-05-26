import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents, Player } from '@babi-bingo/shared';
import {
  getRoom,
  getPlayers,
  addPlayer,
  removePlayer,
  getCard,
} from '../rooms/roomManager';
import { requireRole } from '../middleware/socketAuth';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

export function registerRoomHandlers(io: TypedServer, socket: TypedSocket): void {

  // ── join_room ─────────────────────────────────────────────────
  socket.on('join_room', async ({ roomCode }) => {
    if (!requireRole(socket, 'PLAYER', 'OPERATOR', 'OWNER')) return;

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

    // Join the Socket.io room
    await socket.join(roomCode);

    // Send room state + player list to this client
    socket.emit('room_joined', {
      room: {
        code: room.code,
        houseName: room.houseName,
        state: room.state,
        pattern: room.pattern,
        calledNumbers: room.calledNumbers,
        playerCount: players.length,
        intervalSeconds: room.intervalSeconds,
      },
      players,
    });

    // Notify others
    socket.to(roomCode).emit('player_joined', {
      player,
      playerCount: players.length,
    });

    // Store mapping for disconnect
    socket.data.currentRoom = roomCode;
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

    // Send current state to display so it can render what's been called so far
    socket.emit('room_joined', {
      room: {
        code: room.code,
        houseName: room.houseName,
        state: room.state,
        pattern: room.pattern,
        calledNumbers: room.calledNumbers,
        playerCount: players.length,
        intervalSeconds: room.intervalSeconds,
      },
      players,
    });

    socket.data.currentRoom = roomCode;
    console.log(`[Socket] Display connected to room ${roomCode}`);
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

    socket.emit('sync_state', {
      room: {
        code: room.code,
        houseName: room.houseName,
        state: room.state,
        pattern: room.pattern,
        calledNumbers: room.calledNumbers,
        playerCount: players.length,
        intervalSeconds: room.intervalSeconds,
      },
      players,
      card,
    });
  });

  // ── disconnect ────────────────────────────────────────────────
  socket.on('disconnect', async () => {
    const roomCode = (socket.data as Record<string, string>).currentRoom;
    if (!roomCode || socket.data.role === 'DISPLAY') return;

    const players = await removePlayer(roomCode, socket.data.uuid);

    io.to(roomCode).emit('player_left', {
      uuid: socket.data.uuid,
      nickname: socket.data.nickname,
      playerCount: players.length,
    });
  });
}
