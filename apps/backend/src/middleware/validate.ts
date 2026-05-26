import { z, ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';
import { WinPattern } from '@babi-bingo/shared';

// ─────────────────────────────────────────────
//  H7: Zod schemas for all REST endpoints
// ─────────────────────────────────────────────

export const GuestSchema = z.object({
  nickname: z
    .string()
    .min(2, 'Nickname must be at least 2 characters')
    .max(24, 'Nickname must be at most 24 characters')
    .regex(/^[\w\s\u00C0-\u024F-]+$/, 'Nickname contains invalid characters'),
});

export const RegisterSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters').max(32),
  password: z.string().min(6, 'Password must be at least 6 characters').max(128),
  houseName: z.string().min(2, 'House name must be at least 2 characters').max(64),
  role: z.enum(['OPERATOR', 'OWNER']).optional(),
});

export const LoginSchema = z.object({
  username: z.string().min(1, 'username is required'),
  password: z.string().min(1, 'password is required'),
});

export const RefreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

const WIN_PATTERNS: WinPattern[] = ['ROW', 'COLUMN', 'DIAGONAL', 'FOUR_CORNERS', 'POSTAGE_STAMP', 'COVERALL'];

export const CreateRoomSchema = z.object({
  pattern: z.enum(WIN_PATTERNS as [WinPattern, ...WinPattern[]]).optional(),
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
    req.body = result.data; // replace with parsed + coerced data
    next();
  };
}
