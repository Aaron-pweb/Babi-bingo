import { validateBingo } from '../../game/winValidator';
import { BingoCard } from '@babi-bingo/shared';

// A fixed test card:
// B    I    N    G    O
// 5    17   31   47   65   row 0
// 10   22   38   52   70   row 1
// 3    28  FREE  58   63   row 2  ← FREE at [2][2]
// 14   19   42   49   72   row 3
// 8    25   35   60   68   row 4

const TEST_CARD: BingoCard = [
  [5,  17, 31, 47, 65],
  [10, 22, 38, 52, 70],
  [3,  28, null, 58, 63],
  [14, 19, 42, 49, 72],
  [8,  25, 35, 60, 68],
];

// ──────────────────────────────────
//  ROW
// ──────────────────────────────────
describe('validateBingo ROW', () => {
  it('returns true when a complete row is called', () => {
    // Row 0: 5, 17, 31, 47, 65
    expect(validateBingo(TEST_CARD, [5, 17, 31, 47, 65], 'ROW')).toBe(true);
  });

  it('returns true when last row is complete', () => {
    // Row 4: 8, 25, 35, 60, 68
    expect(validateBingo(TEST_CARD, [8, 25, 35, 60, 68, 99], 'ROW')).toBe(true);
  });

  it('returns false when no row is complete', () => {
    expect(validateBingo(TEST_CARD, [5, 17, 31, 47], 'ROW')).toBe(false);
  });
});

// ──────────────────────────────────
//  COLUMN
// ──────────────────────────────────
describe('validateBingo COLUMN', () => {
  it('returns true when B column (col 0) is complete', () => {
    // B col: 5, 10, 3, 14, 8
    expect(validateBingo(TEST_CARD, [5, 10, 3, 14, 8], 'COLUMN')).toBe(true);
  });

  it('returns true for N column with FREE space', () => {
    // N col: 31, 38, FREE, 42, 35  → only need 31, 38, 42, 35
    expect(validateBingo(TEST_CARD, [31, 38, 42, 35], 'COLUMN')).toBe(true);
  });

  it('returns false when no column is complete', () => {
    expect(validateBingo(TEST_CARD, [5, 10, 3, 14], 'COLUMN')).toBe(false);
  });
});

// ──────────────────────────────────
//  DIAGONAL
// ──────────────────────────────────
describe('validateBingo DIAGONAL', () => {
  it('returns true for main diagonal (top-left to bottom-right)', () => {
    // [0][0]=5, [1][1]=22, [2][2]=FREE, [3][3]=49, [4][4]=68
    expect(validateBingo(TEST_CARD, [5, 22, 49, 68], 'DIAGONAL')).toBe(true);
  });

  it('returns true for anti-diagonal (top-right to bottom-left)', () => {
    // [0][4]=65, [1][3]=52, [2][2]=FREE, [3][1]=19, [4][0]=8
    expect(validateBingo(TEST_CARD, [65, 52, 19, 8], 'DIAGONAL')).toBe(true);
  });

  it('returns false when neither diagonal is complete', () => {
    expect(validateBingo(TEST_CARD, [5, 22, 49], 'DIAGONAL')).toBe(false);
  });
});

// ──────────────────────────────────
//  FOUR_CORNERS
// ──────────────────────────────────
describe('validateBingo FOUR_CORNERS', () => {
  it('returns true when all four corners are called', () => {
    // [0][0]=5, [0][4]=65, [4][0]=8, [4][4]=68
    expect(validateBingo(TEST_CARD, [5, 65, 8, 68], 'FOUR_CORNERS')).toBe(true);
  });

  it('returns false when one corner is missing', () => {
    expect(validateBingo(TEST_CARD, [5, 65, 8], 'FOUR_CORNERS')).toBe(false);
  });
});

// ──────────────────────────────────
//  POSTAGE_STAMP
// ──────────────────────────────────
describe('validateBingo POSTAGE_STAMP', () => {
  it('returns true for top-left 2×2 block', () => {
    // [0][0]=5, [0][1]=17, [1][0]=10, [1][1]=22
    expect(validateBingo(TEST_CARD, [5, 17, 10, 22], 'POSTAGE_STAMP')).toBe(true);
  });

  it('returns true for bottom-right 2×2 block', () => {
    // [3][3]=49, [3][4]=72, [4][3]=60, [4][4]=68
    expect(validateBingo(TEST_CARD, [49, 72, 60, 68], 'POSTAGE_STAMP')).toBe(true);
  });

  it('returns false when no 2×2 block is complete', () => {
    expect(validateBingo(TEST_CARD, [5, 17, 10], 'POSTAGE_STAMP')).toBe(false);
  });
});

// ──────────────────────────────────
//  COVERALL
// ──────────────────────────────────
describe('validateBingo COVERALL', () => {
  it('returns true when all 24 numbers are called (FREE counts)', () => {
    const allNumbers = TEST_CARD.flat().filter((c): c is number => c !== null);
    expect(allNumbers).toHaveLength(24);
    expect(validateBingo(TEST_CARD, allNumbers, 'COVERALL')).toBe(true);
  });

  it('returns false when one number is missing', () => {
    const allNumbers = TEST_CARD.flat().filter((c): c is number => c !== null);
    const missing = allNumbers.slice(0, 23); // remove last one
    expect(validateBingo(TEST_CARD, missing, 'COVERALL')).toBe(false);
  });

  it('returns false with only a few numbers called', () => {
    expect(validateBingo(TEST_CARD, [5, 17, 31], 'COVERALL')).toBe(false);
  });
});
