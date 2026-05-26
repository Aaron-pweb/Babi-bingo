import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@babi-bingo/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(import.meta.env.VITE_API_URL ?? 'http://localhost:4000', {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });
  }
  return socket;
}

export function connectSocket(auth: { token?: string; role?: string }): GameSocket {
  const s = getSocket();
  s.auth = auth;
  if (!s.connected) s.connect();
  return s;
}
