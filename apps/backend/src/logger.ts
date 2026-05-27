import pino from 'pino';

/**
 * M5: Singleton structured logger using pino.
 * Output is newline-delimited JSON (NDJSON) — parseable by Datadog, Loki, CloudWatch, etc.
 * Set LOG_LEVEL env var to control verbosity: trace | debug | info | warn | error
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: { service: 'babi-bingo-backend' },
  timestamp: pino.stdTimeFunctions.isoTime,
});
