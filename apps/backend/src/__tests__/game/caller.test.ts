import { initializeDeck, drawNumber, getColumn } from '../../game/caller';

describe('initializeDeck()', () => {
  it('returns exactly 75 numbers', () => {
    expect(initializeDeck()).toHaveLength(75);
  });

  it('contains all numbers 1–75 exactly once', () => {
    const deck = initializeDeck();
    const sorted = [...deck].sort((a, b) => a - b);
    const expected = Array.from({ length: 75 }, (_, i) => i + 1);
    expect(sorted).toEqual(expected);
  });

  it('produces different decks on repeated calls (crypto RNG)', () => {
    const deck1 = initializeDeck();
    const deck2 = initializeDeck();
    expect(deck1).not.toEqual(deck2);
  });
});

describe('drawNumber()', () => {
  it('draws the first element and returns remaining 74', () => {
    const deck = initializeDeck();
    const result = drawNumber(deck);
    expect(result.number).toBe(deck[0]);
    expect(result.remaining).toHaveLength(74);
    expect(result.remaining).not.toContain(result.number);
  });

  it('does not mutate the original deck', () => {
    const deck = initializeDeck();
    const original = [...deck];
    drawNumber(deck);
    expect(deck).toEqual(original);
  });

  it('throws when deck is empty', () => {
    expect(() => drawNumber([])).toThrow('Deck is empty');
  });

  it('can draw all 75 numbers without duplicates', () => {
    let deck = initializeDeck();
    const drawn: number[] = [];
    while (deck.length > 0) {
      const result = drawNumber(deck);
      drawn.push(result.number);
      deck = result.remaining;
    }
    expect(drawn).toHaveLength(75);
    expect(new Set(drawn).size).toBe(75);
  });
});

describe('getColumn()', () => {
  it.each([
    [1,  'B'], [15, 'B'],
    [16, 'I'], [30, 'I'],
    [31, 'N'], [45, 'N'],
    [46, 'G'], [60, 'G'],
    [61, 'O'], [75, 'O'],
  ])('number %i maps to column %s', (num, col) => {
    expect(getColumn(num)).toBe(col);
  });
});
