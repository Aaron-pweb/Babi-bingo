import Redis from 'ioredis';
import dotenv from 'dotenv';
import { logger } from '../logger';

dotenv.config();

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

export const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => logger.info('[Redis] Connected'));
redis.on('error', (err) => logger.error({ err }, '[Redis] Error'));

// ─────────────────────────────────────────────
//  Typed wrapper helpers
// ─────────────────────────────────────────────

export async function redisGet<T>(key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function redisSet<T>(
  key: string,
  value: T,
  ttlSeconds?: number
): Promise<void> {
  const serialized = JSON.stringify(value);
  if (ttlSeconds) {
    await redis.setex(key, ttlSeconds, serialized);
  } else {
    await redis.set(key, serialized);
  }
}

export async function redisDel(key: string): Promise<void> {
  await redis.del(key);
}

export async function redisExpire(key: string, ttlSeconds: number): Promise<void> {
  await redis.expire(key, ttlSeconds);
}

// ─────────────────────────────────────────────
//  C1: Atomic state transition via Lua script
//  Reads the JSON object at `key`, checks that
//  obj.state === fromState, then sets obj.state
//  = toState and writes back atomically.
//  Returns true if the transition succeeded.
// ─────────────────────────────────────────────
const TRANSITION_LUA = `
local raw = redis.call('GET', KEYS[1])
if not raw then return 0 end
local obj = cjson.decode(raw)
if obj.state ~= ARGV[1] then return 0 end
obj.state = ARGV[2]
local ttl = redis.call('TTL', KEYS[1])
if ttl > 0 then
  redis.call('SETEX', KEYS[1], ttl, cjson.encode(obj))
else
  redis.call('SET', KEYS[1], cjson.encode(obj))
end
return 1
`;

export async function atomicStateTransition(
  key: string,
  fromState: string,
  toState: string,
): Promise<boolean> {
  const result = await redis.eval(TRANSITION_LUA, 1, key, fromState, toState);
  return result === 1;
}

