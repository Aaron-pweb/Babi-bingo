import { Server, Socket } from 'socket.io';
import { ClientToServerEvents, ServerToClientEvents } from '@babi-bingo/shared';
import { getRoom, updateRoom, getPlayers, removePlayer } from '../rooms/roomManager';
import { requireRole } from '../middleware/socketAuth';
import { handleStartGame, handleClaimBingo } from '../game/gameLoop';

type TypedSocket = Socket<ClientToServerEvents, ServerToClientEvents>;
type TypedServer = Server<ClientToServerEvents, ServerToClientEvents>;

async function isRoomOperator(socket: TypedSocket, roomCode: string): Promise<boolean> {
  const room = await getRoom(roomCode);
  if (!room) { socket.emit('game_error', { code: 'ROOM_NOT_FOUND', message: `Room ${roomCode} not found` }); return false; }
  if (room.operatorUuid !== socket.data.uuid) { socket.emit('game_error', { code: 'FORBIDDEN', message: 'Only the room operator can do this' }); return false; }
  return true;
}

export function registerControlHandlers(io: TypedServer, socket: TypedSocket): void {

  socket.on('start_game', async ({ roomCode }) => {
    if (!requireRole(socket, 'OPERATOR', 'OWNER')) return;
    if (!await isRoomOperator(socket, roomCode)) return;
    const room = await getRoom(roomCode);
    if (!room || room.state !== 'WAITING') {
      socket.emit('game_error', { code: 'INVALID_STATE', message: 'Game is not in WAITING state' });
      return;
    }
    await handleStartGame(io, roomCode);
  });

  socket.on('pause_game', async ({ roomCode }) => {
    if (!requireRole(socket, 'OPERATOR', 'OWNER')) return;
    if (!await isRoomOperator(socket, roomCode)) return;
    const room = await getRoom(roomCode);
    if (!room || room.state !== 'PLAYING') { socket.emit('game_error', { code: 'INVALID_STATE', message: 'Not currently playing' }); return; }
    await updateRoom(roomCode, { state: 'PAUSED' });
    io.to(roomCode).emit('game_paused', { reason: 'Paused by operator' });
  });

  socket.on('resume_game', async ({ roomCode }) => {
    if (!requireRole(socket, 'OPERATOR', 'OWNER')) return;
    if (!await isRoomOperator(socket, roomCode)) return;
    const room = await getRoom(roomCode);
    if (!room || room.state !== 'PAUSED') { socket.emit('game_error', { code: 'INVALID_STATE', message: 'Game is not paused' }); return; }
    await updateRoom(roomCode, { state: 'PLAYING' });
    io.to(roomCode).emit('game_resumed');
  });

  socket.on('kick_player', async ({ roomCode, targetUuid }) => {
    if (!requireRole(socket, 'OPERATOR', 'OWNER')) return;
    if (!await isRoomOperator(socket, roomCode)) return;
    const players = await getPlayers(roomCode);
    const target = players.find((p) => p.uuid === targetUuid);
    if (!target) { socket.emit('game_error', { code: 'PLAYER_NOT_FOUND', message: 'Player not in room' }); return; }
    await removePlayer(roomCode, targetUuid);
    const targetSocket = io.sockets.sockets.get(target.socketId);
    if (targetSocket) { targetSocket.emit('player_kicked', { uuid: targetUuid }); await targetSocket.leave(roomCode); }
    const updated = await getPlayers(roomCode);
    io.to(roomCode).emit('player_left', { uuid: targetUuid, nickname: target.nickname, playerCount: updated.length });
  });

  socket.on('claim_bingo', async ({ roomCode }) => {
    if (!requireRole(socket, 'PLAYER')) return;
    await handleClaimBingo(io, socket, roomCode);
  });
}
