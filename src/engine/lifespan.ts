import { Dice } from './random';

/**
 * LIFESPAN: everyone ages, and no one lives forever, player characters included.
 *
 * Every character gets a life expectancy when they're made, from their species: a dwarf or an elf
 * outlives a human by far. Children grow up faster in game time than adults age, so a child born during
 * play becomes an adult in a few game years instead of sixteen. Adults age a year at a time.
 *
 * Death from old age is a rising chance, not a fixed date. It starts ten years before the expected age,
 * climbs every year after, and by fifteen years past it, death within the year is all but certain. Player characters age
 * the same way, but under the session rules they can only actually die during play.
 */

/** Below this age a character counts as a child, and grows up faster. */
export const ADULT_AGE = 16;

/** How many years a child ages for each game year. Adults age one year per game year. */
export const CHILD_YEARS_PER_YEAR = 3;

/** The range of expected lifespans for each species, in years. Unknown species live like humans. */
const LIFESPANS: Record<string, [shortest: number, longest: number]> = {
  human: [55, 80],
  halfling: [90, 150],
  dwarf: [180, 300],
  elf: [350, 700],
  gnome: [200, 400],
  orc: [40, 60],
  'half-orc': [55, 75],
  'half-elf': [120, 180],
  dragonborn: [60, 85],
  tiefling: [70, 100],
  beast: [10, 25],
};

export function rollLifeExpectancy(species: string, dice: Dice): number {
  const [shortest, longest] = LIFESPANS[species.trim().toLowerCase()] ?? LIFESPANS['human'];
  return dice.rollBetween(shortest, longest);
}

/** How many years someone of this age gains in one game year. */
export function yearsGainedInAYear(age: number): number {
  return age < ADULT_AGE ? Math.min(CHILD_YEARS_PER_YEAR, ADULT_AGE - age) : 1;
}

/** Ages someone forward a number of game years, children faster until they come of age. */
export function ageForward(age: number, gameYears: number): number {
  let current = age;
  for (let year = 0; year < gameYears; year++) {
    current += yearsGainedInAYear(current);
  }
  return current;
}

/**
 * The weekly chance, in percent, of dying of old age. Nothing until ten years before the expected age,
 * then rising steeply, reaching certainty fifteen years past it.
 */
export function oldAgeDeathChance(age: number, lifeExpectancy: number): number {
  const yearsIntoTwilight = age - (lifeExpectancy - 10);
  return yearsIntoTwilight <= 0 ? 0 : Math.min(100, (yearsIntoTwilight / 25) ** 2 * 6);
}

/** True when someone is near the end, for warning a returning player. */
export function isFrail(age: number, lifeExpectancy: number): boolean {
  return age >= lifeExpectancy - 5;
}
