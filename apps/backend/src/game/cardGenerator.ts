import { BingoCard, BingoCell, COLUMN_RANGES } from '@babi-bingo/shared';
import { randomInt } from 'crypto';

/**
 * Generates a random subset of `count` unique integers in [min, max] (inclusive)
 * using Node's cryptographic RNG.
 */
function sampleRange(min: number, max: number, count: number): number[] {
  const pool: number[] = [];
  for (let i = min; i <= max; i++) pool.push(i);

  // Fisher-Yates shuffle using crypto.randomInt
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

/**
 * Generates a valid 75-ball Bingo card.
 *
 * Layout (columns B I N G O):
 *   B: 5 unique numbers from  1–15
 *   I: 5 unique numbers from 16–30
 *   N: 4 unique numbers from 31–45 + FREE space at center [row 2]
 *   G: 5 unique numbers from 46–60
 *   O: 5 unique numbers from 61–75
 *
 * The card is row-major: card[row][col]
 * FREE space is always at card[2][2] (row 2, column N)
 */
export function generateBingoCard(): BingoCard {
  const cols = (['B', 'I', 'N', 'G', 'O'] as const).map((col, colIdx) => {
    const [min, max] = COLUMN_RANGES[col];
    const isFreeColumn = colIdx === 2; // N column
    const numbers = sampleRange(min, max, isFreeColumn ? 4 : 5);
    return numbers;
  });

  // Build 5 rows from column arrays, inserting FREE at row 2, col 2
  const rows: BingoCell[][] = Array.from({ length: 5 }, (_, row) =>
    cols.map((colNumbers, col) => {
      if (col === 2 && row === 2) return null; // FREE space
      // N column: rows 0-1 come from indices 0-1, rows 3-4 from indices 2-3
      const idx = col === 2 && row > 2 ? row - 1 : row;
      return colNumbers[idx] ?? null;
    })
  );

  return rows as BingoCard;
}
