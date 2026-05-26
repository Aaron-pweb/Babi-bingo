import { BingoCard, BingoCell, WinPattern } from '@babi-bingo/shared';

/**
 * Determines whether a cell is "marked":
 * - null  = FREE space → always marked
 * - number → marked if it appears in calledNumbers
 */
function isMarked(cell: BingoCell, calledNumbers: Set<number>): boolean {
  if (cell === null) return true; // FREE space
  return calledNumbers.has(cell);
}

/**
 * Build a 5×5 boolean grid of marked cells.
 */
function buildMarkedGrid(card: BingoCard, calledNumbers: Set<number>): boolean[][] {
  return card.map((row) => row.map((cell) => isMarked(cell, calledNumbers)));
}

// ─────────────────────────────────────────────
//  Pattern Checkers
// ─────────────────────────────────────────────

function checkRow(grid: boolean[][]): boolean {
  return grid.some((row) => row.every(Boolean));
}

function checkColumn(grid: boolean[][]): boolean {
  for (let col = 0; col < 5; col++) {
    if (grid.every((row) => row[col])) return true;
  }
  return false;
}

function checkDiagonal(grid: boolean[][]): boolean {
  const mainDiag = [0, 1, 2, 3, 4].every((i) => grid[i][i]);
  const antiDiag = [0, 1, 2, 3, 4].every((i) => grid[i][4 - i]);
  return mainDiag || antiDiag;
}

function checkFourCorners(grid: boolean[][]): boolean {
  return grid[0][0] && grid[0][4] && grid[4][0] && grid[4][4];
}

/**
 * POSTAGE_STAMP: 2×2 block in any corner of the card.
 * Checks all four 2×2 corners.
 */
function checkPostageStamp(grid: boolean[][]): boolean {
  const corners = [
    [0, 0], // top-left
    [0, 3], // top-right
    [3, 0], // bottom-left
    [3, 3], // bottom-right
  ] as const;

  return corners.some(([r, c]) =>
    grid[r][c] && grid[r][c + 1] && grid[r + 1][c] && grid[r + 1][c + 1]
  );
}

function checkCoverall(grid: boolean[][]): boolean {
  return grid.every((row) => row.every(Boolean));
}

// ─────────────────────────────────────────────
//  Public API
// ─────────────────────────────────────────────

/**
 * Validates whether a player's card constitutes a win.
 *
 * @param card          The player's Bingo card (stored server-side in Redis)
 * @param calledNumbers Array of numbers drawn so far
 * @param pattern       The required win pattern for this game
 * @returns             true if the card satisfies the pattern with called numbers
 */
export function validateBingo(
  card: BingoCard,
  calledNumbers: number[],
  pattern: WinPattern
): boolean {
  const calledSet = new Set(calledNumbers);
  const grid = buildMarkedGrid(card, calledSet);

  switch (pattern) {
    case 'ROW':           return checkRow(grid);
    case 'COLUMN':        return checkColumn(grid);
    case 'DIAGONAL':      return checkDiagonal(grid);
    case 'FOUR_CORNERS':  return checkFourCorners(grid);
    case 'POSTAGE_STAMP': return checkPostageStamp(grid);
    case 'COVERALL':      return checkCoverall(grid);
  }
}
