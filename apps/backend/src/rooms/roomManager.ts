import { GameState, WinPattern, BingoCard, Player } from '@babi-bingo/shared';
import { redisGet, redisSet, redisDel } from '../redis/client';
import { generateRoomCode } from './roomCodes';

// ─────────────────────────────────────────────
//  Redis Key Schema
// ─────────────────────────────────────────────
const key = {
  room:      (code: string) => `room:${code}`,
  players:   (code: string) => `room:${code}:players`,
  cards:     (code: string) => `room:${code}:cards`,
  cooldowns: (code: string) => `room:${code}:cooldowns`,
};

const ROOM_TTL = 60 * 60 * 8; // 8 hours

// ─────────────────────────────────────────────
//  Room State Shape (stored in Redis)
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

// ─────────────────────────────────────────────
//  Room CRUD
// ─────────────────────────────────────────────

export async function createRoom(
  houseName: string,
  operatorUuid: string,
  houseId: string,
  pattern: WinPattern = 'ROW',
  intervalSeconds = 5
): Promise<RoomData> {
  const code = generateRoomCode();

  const room: RoomData = {
    code,
    houseName,
    state: 'WAITING',
    pattern,
    calledNumbers: [],
    deck: [],
    intervalSeconds,
    operatorUuid,
    houseId,
    createdAt: Date.now(),
  };

  await redisSet(key.room(code), room, ROOM_TTL);
  await redisSet<Player[]>(key.players(code), [], ROOM_TTL);

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
    redisDel(key.players(code)),
    redisDel(key.cards(code)),
    redisDel(key.cooldowns(code)),
  ]);
}

// ─────────────────────────────────────────────
//  Player Management
// ─────────────────────────────────────────────

export async function getPlayers(code: string): Promise<Player[]> {
  return (await redisGet<Player[]>(key.players(code))) ?? [];
}

export async function addPlayer(code: string, player: Player): Promise<Player[]> {
  const players = await getPlayers(code);
  const exists = players.some((p) => p.uuid === player.uuid);
  if (exists) {
    // Update socket ID on reconnect
    const updated = players.map((p) => (p.uuid === player.uuid ? player : p));
    await redisSet(key.players(code), updated, ROOM_TTL);
    return updated;
  }
  const updated = [...players, player];
  await redisSet(key.players(code), updated, ROOM_TTL);
  return updated;
}

export async function removePlayer(code: string, uuid: string): Promise<Player[]> {
  const players = await getPlayers(code);
  const updated = players.filter((p) => p.uuid !== uuid);
  await redisSet(key.players(code), updated, ROOM_TTL);
  return updated;
}

// ─────────────────────────────────────────────
//  Card Storage
// ─────────────────────────────────────────────

export async function saveCards(
  code: string,
  cards: Record<string, BingoCard>
): Promise<void> {
  await redisSet(key.cards(code), cards, ROOM_TTL);
}

export async function getCard(code: string, uuid: string): Promise<BingoCard | null> {
  const cards = await redisGet<Record<string, BingoCard>>(key.cards(code));
  return cards?.[uuid] ?? null;
}

export async function getAllCards(code: string): Promise<Record<string, BingoCard>> {
  return (await redisGet<Record<string, BingoCard>>(key.cards(code))) ?? {};
}

// ─────────────────────────────────────────────
//  False-Bingo Cooldown
// ─────────────────────────────────────────────

const COOLDOWN_MS = 3000;

export async function isOnCooldown(code: string, uuid: string): Promise<boolean> {
  const cooldowns = (await redisGet<Record<string, number>>(key.cooldowns(code))) ?? {};
  const last = cooldowns[uuid];
  return last !== undefined && Date.now() - last < COOLDOWN_MS;
}

export async function setCooldown(code: string, uuid: string): Promise<void> {
  const cooldowns = (await redisGet<Record<string, number>>(key.cooldowns(code))) ?? {};
  cooldowns[uuid] = Date.now();
  await redisSet(key.cooldowns(code), cooldowns, ROOM_TTL);
}
