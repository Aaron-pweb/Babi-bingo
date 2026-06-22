import { io, Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@babi-bingo/shared';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;

export function getSocket(): GameSocket {
  if (!socket) {
    const socketUrl = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? `http://${window.location.hostname}:4000` : undefined);
    socket = io(socketUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
    });
  }
  return socket;
}

/**
 * H3: Disconnect + recreate socket when auth changes.
 * The previous socket may be connected with a different token/role —
 * we must disconnect it first so the new handshake carries the correct auth.
 */
export function connectSocket(auth: { token?: string; role?: string }): GameSocket {
  // If already connected with (potentially different) auth, reset
  if (socket?.connected) {
    socket.disconnect();
    socket = null;
  }
  const s = getSocket();
  s.auth = auth;
  s.connect();
  return s;
}
