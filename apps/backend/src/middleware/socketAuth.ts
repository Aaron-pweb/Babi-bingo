import { Socket } from 'socket.io';
import { verifyToken, AuthPayload } from '../auth/tokens';
import { UserRole } from '@babi-bingo/shared';

// Extend socket.data with our auth info
declare module 'socket.io' {
  interface SocketData {
    uuid: string;
    nickname: string;
    role: UserRole;
    houseId?: string;
    username?: string;
  }
}

/**
 * Socket.io middleware that verifies the JWT from the handshake.
 *
 * PLAYER  → token required (guest JWT)
 * DISPLAY → no token needed (read-only, pass role=DISPLAY in auth)
 * OPERATOR/OWNER → operator JWT required
 */
export async function socketAuthMiddleware(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const { token, role } = socket.handshake.auth as {
      token?: string;
      role?: string;
    };

    // Display clients are anonymous — no auth needed
    if (role === 'DISPLAY') {
      socket.data.uuid = `display-${socket.id}`;
      socket.data.nickname = 'Display';
      socket.data.role = 'DISPLAY';
      return next();
    }

    if (!token) {
      return next(new Error('AUTH_REQUIRED: No token provided'));
    }

    const payload: AuthPayload = await verifyToken(token);

    socket.data.uuid = payload.uuid;
    socket.data.role = payload.role as UserRole;

    if (payload.role === 'PLAYER') {
      socket.data.nickname = (payload as { nickname: string }).nickname;
    } else {
      socket.data.nickname = (payload as { username: string }).username;
      socket.data.houseId = (payload as { houseId: string }).houseId;
    }

    next();
  } catch {
    next(new Error('AUTH_INVALID: Token verification failed'));
  }
}

/**
 * Guard: ensures the socket has one of the required roles.
 * Returns false and emits game_error if role check fails.
 */
export function requireRole(
  socket: Socket,
  ...roles: UserRole[]
): boolean {
  if (!roles.includes(socket.data.role)) {
    socket.emit('game_error', {
      code: 'FORBIDDEN',
      message: `This action requires role: ${roles.join(' or ')}`,
    });
    return false;
  }
  return true;
}
