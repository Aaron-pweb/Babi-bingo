import { GameState, WinPattern, BingoCard, Player } from '@babi-bingo/shared';
import type { RoomInfo } from '@babi-bingo/shared';
import { redis, redisGet, redisSet, redisDel } from '../redis/client';
import { generateRoomCode } from './roomCodes';

// ─────────────────────────────────────────────
//  Redis Key Schema
// ─────────────────────────────────────────────
const key = {
  room:      (code: string) => `room:${code}`,
  players:   (code: string) => `room:${code}:players`,   // Redis HASH: uuid → JSON
  cards:     (code: string) => `room:${code}:cards`,      // Redis HASH: uuid → JSON
  cooldowns: (code: string) => `room:${code}:cooldowns`,  // Redis HASH: uuid → timestamp string
};

/** Exported so game loop can build the Redis key for atomic Lua transitions */
export const roomKey = key.room;

const ROOM_TTL     = 60 * 60 * 8; // 8 hours in seconds
const COOLDOWN_MS  = 3_000;

// ─────────────────────────────────────────────
//  Room State Shape (stored in Redis as JSON string)
// ─────────────────────────────────────────────
export interface RoomData {
  code: string;
  houseName: string;
  state: GameState;
  pattern: WinPattern;
  calledNumbers: number[];
  deck: number[];
  intervalSeconds: number;
  operatorUuid: string;
  houseId: string;
  createdAt: number;
}

// M1: Single source of truth for the RoomInfo projection sent to clients
export function toRoomInfo(room: RoomData, playerCount: number): RoomInfo {
  return {
    code: room.code,
    houseName: room.houseName,
    state: room.state,
    pattern: room.pattern,
    calledNumbers: room.calledNumbers,
    playerCount,
    intervalSeconds: room.intervalSeconds,
  };
}

// ─────────────────────────────────────────────
//  Room CRUD  (room object stored as plain JSON string)
// ─────────────────────────────────────────────

export async function createRoom(
  houseName: string,
  operatorUuid: string,
  houseId: string,
  pattern: WinPattern = 'ROW',
  intervalSeconds = 5,
): Promise<RoomData> {
  const code = generateRoomCode();
  const room: RoomData = {
    code, houseName, state: 'WAITING', pattern,
    calledNumbers: [], deck: [], intervalSeconds,
    operatorUuid, houseId, createdAt: Date.now(),
  };
  await redisSet(key.room(code), room, ROOM_TTL);
  // Players hash starts empty; just set TTL via a placeholder approach:
  // we touch it on first addPlayer — no need to pre-create the hash.
  return room;
}

export async function getRoom(code: string): Promise<RoomData | null> {
  return redisGet<RoomData>(key.room(code));
}

export async function updateRoom(code: string, patch: Partial<RoomData>): Promise<RoomData> {
  const room = await getRoom(code);
  if (!room) throw new Error(`Room ${code} not found`);
  const updated = { ...room, ...patch };
  await redisSet(key.room(code), updated, ROOM_TTL);
  return updated;
}

export async function deleteRoom(code: string): Promise<void> {
  await Promise.all([
    redisDel(key.room(code)),
    redis.del(key.players(code)),
    redis.del(key.cards(code)),
    redis.del(key.cooldowns(code)),
  ]);
}

// ─────────────────────────────────────────────
//  Player Management  — M3: Redis HASH (O(1) per-player ops)
//  Key:   room:{code}:players
//  Field: player UUID
//  Value: JSON-serialised Player object
// ─────────────────────────────────────────────

export async function getPlayers(code: string): Promise<Player[]> {
  const hash = await redis.hgetall(key.players(code));
  if (!hash) return [];
  return Object.values(hash).map((v) => JSON.parse(v) as Player);
}

/** Returns the full updated player list after add/update. */
export async function addPlayer(code: string, player: Player): Promise<Player[]> {
  // HSET: O(1) — overwrites if UUID already exists (handles reconnect)
  await redis.hset(key.players(code), player.uuid, JSON.stringify(player));
  await redis.expire(key.players(code), ROOM_TTL);
  return getPlayers(code);
}

/** Returns the remaining player list after removal. */
export async function removePlayer(code: string, uuid: string): Promise<Player[]> {
  // HDEL: O(1) — no read-modify-write cycle
  await redis.hdel(key.players(code), uuid);
  return getPlayers(code);
}

// ─────────────────────────────────────────────
//  Card Storage  — M3: Redis HASH (O(1) per-card ops)
//  Key:   room:{code}:cards
//  Field: player UUID
//  Value: JSON-serialised BingoCard (number[][]  with nulls for FREE)
// ─────────────────────────────────────────────

export async function saveCards(
  code: string,
  cards: Record<string, BingoCard>,
): Promise<void> {
  const entries = Object.entries(cards);
  if (entries.length === 0) return;

  // Build flat args array for a single HSET call: [field1, val1, field2, val2, ...]
  const args: string[] = [];
  for (const [uuid, card] of entries) {
    args.push(uuid, JSON.stringify(card));
  }
  await redis.hset(key.cards(code), ...args);
  await redis.expire(key.cards(code), ROOM_TTL);
}

/** O(1) — fetches a single player's card without loading all cards */
export async function getCard(code: string, uuid: string): Promise<BingoCard | null> {
  const raw = await redis.hget(key.cards(code), uuid);
  return raw ? (JSON.parse(raw) as BingoCard) : null;
}

export async function getAllCards(code: string): Promise<Record<string, BingoCard>> {
  const hash = await redis.hgetall(key.cards(code));
  if (!hash) return {};
  return Object.fromEntries(
    Object.entries(hash).map(([uuid, v]) => [uuid, JSON.parse(v) as BingoCard]),
  );
}

// ─────────────────────────────────────────────
//  False-Bingo Cooldown  — M3: Redis HASH (O(1) per-player)
//  Key:   room:{code}:cooldowns
//  Field: player UUID
//  Value: Unix timestamp string (ms)
// ─────────────────────────────────────────────

export async function isOnCooldown(code: string, uuid: string): Promise<boolean> {
  const raw = await redis.hget(key.cooldowns(code), uuid); // O(1)
  if (!raw) return false;
  return Date.now() - parseInt(raw, 10) < COOLDOWN_MS;
}

export async function setCooldown(code: string, uuid: string): Promise<void> {
  await redis.hset(key.cooldowns(code), uuid, Date.now().toString()); // O(1) — no read first
  await redis.expire(key.cooldowns(code), ROOM_TTL);
}
