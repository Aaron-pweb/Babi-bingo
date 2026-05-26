import { generateBingoCard } from '../../game/cardGenerator';
import { BingoCard, COLUMN_RANGES } from '@babi-bingo/shared';

describe('generateBingoCard()', () => {
  let card: BingoCard;

  beforeEach(() => {
    card = generateBingoCard();
  });

  it('produces a 5×5 grid', () => {
    expect(card).toHaveLength(5);
    card.forEach((row) => expect(row).toHaveLength(5));
  });

  it('has FREE space (null) at exactly position [2][2]', () => {
    expect(card[2][2]).toBeNull();
    // Only one null in the whole card
    const nulls = card.flat().filter((cell) => cell === null);
    expect(nulls).toHaveLength(1);
  });

  it('B column (col 0) contains 5 unique numbers in range 1–15', () => {
    const bCol = card.map((row) => row[0]) as number[];
    expect(new Set(bCol).size).toBe(5);
    bCol.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(COLUMN_RANGES['B'][0]);
      expect(n).toBeLessThanOrEqual(COLUMN_RANGES['B'][1]);
    });
  });

  it('I column (col 1) contains 5 unique numbers in range 16–30', () => {
    const iCol = card.map((row) => row[1]) as number[];
    expect(new Set(iCol).size).toBe(5);
    iCol.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(COLUMN_RANGES['I'][0]);
      expect(n).toBeLessThanOrEqual(COLUMN_RANGES['I'][1]);
    });
  });

  it('N column (col 2) contains 4 unique numbers in range 31–45 plus FREE', () => {
    const nCol = card.map((row) => row[2]);
    const numbers = nCol.filter((cell) => cell !== null) as number[];
    expect(numbers).toHaveLength(4);
    expect(new Set(numbers).size).toBe(4);
    numbers.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(COLUMN_RANGES['N'][0]);
      expect(n).toBeLessThanOrEqual(COLUMN_RANGES['N'][1]);
    });
  });

  it('G column (col 3) contains 5 unique numbers in range 46–60', () => {
    const gCol = card.map((row) => row[3]) as number[];
    expect(new Set(gCol).size).toBe(5);
    gCol.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(COLUMN_RANGES['G'][0]);
      expect(n).toBeLessThanOrEqual(COLUMN_RANGES['G'][1]);
    });
  });

  it('O column (col 4) contains 5 unique numbers in range 61–75', () => {
    const oCol = card.map((row) => row[4]) as number[];
    expect(new Set(oCol).size).toBe(5);
    oCol.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(COLUMN_RANGES['O'][0]);
      expect(n).toBeLessThanOrEqual(COLUMN_RANGES['O'][1]);
    });
  });

  it('generates different cards (not deterministic)', () => {
    const card2 = generateBingoCard();
    // Statistically near-impossible to be equal
    expect(card).not.toEqual(card2);
  });
});
