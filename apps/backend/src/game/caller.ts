import { randomInt } from 'crypto';
import { BingoColumn } from '@babi-bingo/shared';

/**
 * Maps a bingo number (1–75) to its column letter.
 */
export function getColumn(n: number): BingoColumn {
  if (n >= 1  && n <= 15) return 'B';
  if (n >= 16 && n <= 30) return 'I';
  if (n >= 31 && n <= 45) return 'N';
  if (n >= 46 && n <= 60) return 'G';
  return 'O';
}

/**
 * Creates a shuffled deck of all 75 bingo balls using
 * the Fisher-Yates algorithm with Node's crypto.randomInt.
 *
 * @returns A new array of 75 unique numbers in random order.
 */
export function initializeDeck(): number[] {
  const deck: number[] = Array.from({ length: 75 }, (_, i) => i + 1);

  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

export interface DrawnNumber {
  number: number;
  column: BingoColumn;
  remaining: number[];
}

/**
 * Draws the next number from the deck (immutably).
 *
 * @param deck  The current deck (ordered array, first element is "top")
 * @returns     The drawn number + the new deck with that number removed
 * @throws      If the deck is empty
 */
export function drawNumber(deck: readonly number[]): DrawnNumber {
  if (deck.length === 0) {
    throw new Error('Deck is empty — all 75 numbers have been called.');
  }

  const [number, ...remaining] = deck;
  return {
    number,
    column: getColumn(number),
    remaining,
  };
}
