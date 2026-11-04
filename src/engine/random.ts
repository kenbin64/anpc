/**
 * SEEDED RANDOMNESS: dice that roll the same way every time for the same seed.
 *
 * Math.random() can't be replayed, which makes a bug impossible to reproduce and a test impossible to
 * write. A seeded generator gives a game the same NPC life from the same seed, and a different life from
 * a different seed. The algorithm is mulberry32, a small, well-known 32-bit generator.
 */

export interface Dice {
  /** A number from 0 up to, but not including, 1. */
  next(): number;
  /** A whole number from 0 to 99, for comparing against 0 to 100 dials. */
  rollPercent(): number;
  /** A whole number from min to max, both included. */
  rollBetween(min: number, max: number): number;
  /** True with the given chance, from 0 to 100. */
  happens(chance: number): boolean;
  /** One item from a list. */
  pick<T>(items: readonly T[]): T;
}

/** Turns any text seed into a 32-bit number, so seeds can be names or ids. */
function hashSeed(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index++) {
    hash = Math.imul(hash ^ seed.charCodeAt(index), 16777619);
  }
  return hash >>> 0;
}

export function createDice(seed: string): Dice {
  let state = hashSeed(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    rollPercent: () => Math.floor(next() * 100),
    rollBetween: (min, max) => min + Math.floor(next() * (max - min + 1)),
    happens: chance => Math.floor(next() * 100) < chance,
    pick: items => items[Math.floor(next() * items.length)],
  };
}
