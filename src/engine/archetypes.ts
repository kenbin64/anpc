import { Classification, CoreStats, SocialStanding, SocietyRank, Temperament } from './npc.model';
import { Dice } from './random';

/**
 * ARCHETYPES: what each classification tends toward, and the dice that roll the numbers.
 *
 * Code rolls the numbers and the AI writes the story around them, never the other way round. Numbers
 * from code are fair, repeatable and always in range. A model asked for numbers drifts toward the same
 * safe middles and sometimes breaks the range. Each trait is a center plus or minus a spread, so two
 * rogues share a family resemblance but are never twins.
 */

interface TraitRange {
  center: number;
  spread: number;
}

interface Archetype {
  disposition: TraitRange;
  honesty: TraitRange;
  alignment: TraitRange;
  randomness: TraitRange;
  societyRanks: readonly SocietyRank[];
  strongStats: readonly (keyof CoreStats)[];
  isCreature: boolean;
}

const range = (center: number, spread: number): TraitRange => ({ center, spread });

export const ARCHETYPES: Record<Classification, Archetype> = {
  gentleman: {
    disposition: range(75, 15), honesty: range(70, 20), alignment: range(65, 20), randomness: range(20, 15),
    societyRanks: ['merchant', 'gentry'], strongStats: ['charisma', 'intelligence'], isCreature: false,
  },
  noble: {
    disposition: range(60, 25), honesty: range(50, 30), alignment: range(55, 30), randomness: range(25, 15),
    societyRanks: ['gentry', 'noble', 'royal'], strongStats: ['charisma', 'wisdom'], isCreature: false,
  },
  rogue: {
    disposition: range(50, 25), honesty: range(30, 20), alignment: range(45, 25), randomness: range(60, 20),
    societyRanks: ['outcast', 'peasant', 'commoner'], strongStats: ['dexterity', 'charisma'], isCreature: false,
  },
  barbarian: {
    disposition: range(25, 15), honesty: range(60, 25), alignment: range(50, 25), randomness: range(50, 20),
    societyRanks: ['outcast', 'peasant'], strongStats: ['strength', 'constitution'], isCreature: false,
  },
  thief: {
    disposition: range(45, 20), honesty: range(15, 12), alignment: range(35, 20), randomness: range(45, 20),
    societyRanks: ['outcast', 'peasant', 'commoner'], strongStats: ['dexterity', 'intelligence'], isCreature: false,
  },
  vagabond: {
    disposition: range(50, 25), honesty: range(45, 25), alignment: range(50, 25), randomness: range(70, 20),
    societyRanks: ['outcast', 'peasant'], strongStats: ['constitution', 'wisdom'], isCreature: false,
  },
  monster: {
    disposition: range(20, 15), honesty: range(30, 25), alignment: range(25, 20), randomness: range(55, 25),
    societyRanks: ['outcast'], strongStats: ['strength', 'constitution'], isCreature: true,
  },
  animal: {
    disposition: range(45, 30), honesty: range(70, 20), alignment: range(50, 15), randomness: range(40, 20),
    societyRanks: ['outcast'], strongStats: ['dexterity', 'wisdom'], isCreature: true,
  },
};

const STAT_KEYS: readonly (keyof CoreStats)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'];

function rollTrait(trait: TraitRange, dice: Dice): number {
  return Math.min(100, Math.max(0, dice.rollBetween(trait.center - trait.spread, trait.center + trait.spread)));
}

/** Three six-sided dice per stat, and the archetype's strong stats roll four and keep the best three. */
function rollStats(archetype: Archetype, dice: Dice): CoreStats {
  const stats = {} as CoreStats;
  for (const key of STAT_KEYS) {
    const rolls = Array.from({ length: archetype.strongStats.includes(key) ? 4 : 3 }, () => dice.rollBetween(1, 6));
    stats[key] = rolls.sort((a, b) => b - a).slice(0, 3).reduce((sum, roll) => sum + roll, 0);
  }
  return stats;
}

export interface RolledNumbers {
  stats: CoreStats;
  temperament: Temperament;
  social: SocialStanding;
}

export function rollNumbers(classification: Classification, dice: Dice): RolledNumbers {
  const archetype = ARCHETYPES[classification];
  return {
    stats: rollStats(archetype, dice),
    temperament: {
      disposition: rollTrait(archetype.disposition, dice),
      honesty: rollTrait(archetype.honesty, dice),
      alignment: rollTrait(archetype.alignment, dice),
      randomness: rollTrait(archetype.randomness, dice),
    },
    social: {
      societyRank: dice.pick(archetype.societyRanks),
      peerRank: dice.rollBetween(10, 90),
      reputation: dice.rollBetween(20, 80),
    },
  };
}

export function isCreatureClass(classification: Classification): boolean {
  return ARCHETYPES[classification].isCreature;
}
