import { z, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { WinPattern } from '@babi-bingo/shared';

// ─────────────────────────────────────────────
//  Phone: +251 prefix, user enters 9-digit
//  Ethiopian number starting with 9
// ─────────────────────────────────────────────
const phoneLocal = z
  .string()
  .regex(/^9[0-9]{8}$/, 'Phone must be 9 digits starting with 9 (e.g. 912345678)');

/** Converts "912345678" → "+251912345678" */
export function toE164(local: string): string {
  return `+251${local}`;
}

// ─────────────────────────────────────────────
//  Auth schemas
// ─────────────────────────────────────────────

export const GuestSchema = z.object({
  nickname: z
    .string()
    .min(2, 'Nickname must be at least 2 characters')
    .max(24, 'Nickname must be at most 24 characters')
    .regex(/^[\w\s\u00C0-\u024F-]+$/, 'Nickname contains invalid characters'),
});

/** Unified login — all roles */
export const LoginSchema = z.object({
  username: z.string().min(1, 'username is required'),
  password: z.string().min(1, 'password is required'),
});

/** Player self-registration */
export const PlayerRegisterSchema = z.object({
  username: z.string().min(3, 'Username min 3 chars').max(32),
  password: z.string().min(6, 'Password min 6 chars').max(128),
  nickname: z.string().min(2).max(24).regex(/^[\w\s\u00C0-\u024F-]+$/, 'Invalid nickname'),
  phone: phoneLocal,
});

/** Admin creates an owner account */
export const CreateOwnerSchema = z.object({
  username:  z.string().min(3).max(32),
  password:  z.string().min(6).max(128),
  houseName: z.string().min(2).max(64),
  phone:     phoneLocal,
});

/** Accept operator invite */
export const AcceptInviteSchema = z.object({
  inviteToken: z.string().min(1),
  password:    z.string().min(6).max(128),
  phone:       phoneLocal,
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

const WIN_PATTERNS: WinPattern[] = ['ROW', 'COLUMN', 'DIAGONAL', 'FOUR_CORNERS', 'POSTAGE_STAMP', 'COVERALL'];

export const CreateRoomSchema = z.object({
  pattern:         z.enum(WIN_PATTERNS as [WinPattern, ...WinPattern[]]).optional(),
  intervalSeconds: z.number().int().min(3).max(30).optional(),
});

// ─────────────────────────────────────────────
//  Generic validation middleware factory
// ─────────────────────────────────────────────
export function validate(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({ error: 'Validation failed', details: result.error.flatten() });
      return;
    }
    req.body = result.data;
    next();
  };
}
