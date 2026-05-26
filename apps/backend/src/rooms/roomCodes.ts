import { randomInt } from 'crypto';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0/1/I to avoid confusion

/**
 * Generates a human-readable room code like "BINGO-7F3K".
 * Uses cryptographic RNG.
 */
export function generateRoomCode(): string {
  const part = Array.from({ length: 4 }, () => CHARS[randomInt(0, CHARS.length)]).join('');
  return `BINGO-${part}`;
}
