// ─────────────────────────────────────────────
//  Core Game Types
// ─────────────────────────────────────────────

/** A single cell on a bingo card. null = FREE space */
export type BingoCell = number | null;

/** 5×5 Bingo card: rows[0..4][cols 0..4] mapping to B/I/N/G/O */
export type BingoCard = [
  [BingoCell, BingoCell, BingoCell, BingoCell, BingoCell],
  [BingoCell, BingoCell, BingoCell, BingoCell, BingoCell],
  [BingoCell, BingoCell, BingoCell, BingoCell, BingoCell],
  [BingoCell, BingoCell, BingoCell, BingoCell, BingoCell],
  [BingoCell, BingoCell, BingoCell, BingoCell, BingoCell]
];

/** All supported win patterns */
export type WinPattern =
  | 'ROW'
  | 'COLUMN'
  | 'DIAGONAL'
  | 'FOUR_CORNERS'
  | 'POSTAGE_STAMP'
  | 'COVERALL';

/** Game lifecycle state */
export type GameState =
  | 'WAITING'
  | 'STARTING'
  | 'PLAYING'
  | 'PAUSED'
  | 'FINISHED';

/** Platform user roles */
export type UserRole = 'OWNER' | 'OPERATOR' | 'PLAYER' | 'DISPLAY';

/** Bingo column names */
export type BingoColumn = 'B' | 'I' | 'N' | 'G' | 'O';

export const COLUMN_RANGES: Record<BingoColumn, [number, number]> = {
  B: [1, 15],
  I: [16, 30],
  N: [31, 45],
  G: [46, 60],
  O: [61, 75],
};

// ─────────────────────────────────────────────
//  Room & Player Types
// ─────────────────────────────────────────────

export interface Player {
  uuid: string;
  nickname: string;
  role: UserRole;
  socketId: string;
}

export interface RoomInfo {
  code: string;         // e.g. "BINGO-7F3K"
  houseName: string;
  state: GameState;
  pattern: WinPattern;
  calledNumbers: number[];
  playerCount: number;
  intervalSeconds: number;
}
