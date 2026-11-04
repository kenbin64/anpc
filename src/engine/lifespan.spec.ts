import { advanceLife } from './life-simulator';
import { ageForward, oldAgeDeathChance, rollLifeExpectancy } from './lifespan';
import { generateNpc } from './npc-generator';
import { createDice } from './random';
import { buildTestNpc } from './test-npc';

describe('lifespan', () => {
  it('children grow up faster; adults age a year at a time', () => {
    expect(ageForward(0, 5)).toBe(15);
    expect(ageForward(0, 6)).toBe(16);
    expect(ageForward(40, 5)).toBe(45);
  });

  it('gives each species its own life expectancy', () => {
    const dice = createDice('species');
    expect(rollLifeExpectancy('human', dice)).toBeLessThanOrEqual(80);
    expect(rollLifeExpectancy('elf', dice)).toBeGreaterThanOrEqual(350);
    expect(rollLifeExpectancy('Something Unheard Of', dice)).toBeLessThanOrEqual(80);
  });

  it('old age is no danger in the prime of life, and certain near the end', () => {
    expect(oldAgeDeathChance(40, 70)).toBe(0);
    expect(oldAgeDeathChance(70, 70)).toBeGreaterThan(0);
    expect(oldAgeDeathChance(85, 70)).toBeGreaterThanOrEqual(6);
  });

  it('no one lives forever: across many lives, everyone dies, mostly near their expected age', () => {
    const agesAtDeath = Array.from({ length: 40 }, (_, index) => {
      const elder = buildTestNpc({ id: `elder-${index}`, age: 55, lifeExpectancy: 70, routine: { workDaysPerWeek: 0, tavernEveningsPerWeek: 0, familyEveningsPerWeek: 2 } });
      const lived = advanceLife(elder, '1260-01-01', createDice(`life-${index}`));
      return lived.health.alive ? null : lived.age;
    });
    expect(agesAtDeath.every(age => age !== null)).toBe(true);
    const average = agesAtDeath.reduce((sum, age) => sum! + age!, 0)! / agesAtDeath.length;
    expect(average).toBeGreaterThan(60);
    expect(average).toBeLessThan(80);
  });

  it('a child born in play grows into an adult within a handful of game years', () => {
    const child = buildTestNpc({ age: 1, occupation: null, maritalStatus: 'single', relationships: [] });
    const lived = advanceLife(child, '1206-01-01', createDice('growing'));
    expect(lived.age).toBeGreaterThanOrEqual(16);
  });
});

describe('names', () => {
  it('will not reuse a name already taken in the world, even if the model does', async () => {
    const lazyWriter = async () => ({
      name: 'Godric Fletcher', species: 'human', age: 30, maritalStatus: 'single', inDebt: false,
      backstory: 'Godric learned the trade from his father.', occupation: null, relationships: [], affiliations: [],
      abilities: [{ name: 'Steady hands', description: 'Never slips.' }],
      routine: { workDaysPerWeek: 0, tavernEveningsPerWeek: 1, familyEveningsPerWeek: 1, worshipDay: -1 }, creature: null,
    });
    const npc = await generateNpc(
      { classification: 'gentleman', setting: 'a village', hints: '', seed: 'names', avoidNames: ['Godric Fletcher'] }, lazyWriter, '1200-01-01');

    const [first, family] = npc.name.split(' ');
    expect(first).not.toBe('Godric');
    expect(family).not.toBe('Fletcher');
    expect(npc.backstory.startsWith(first)).toBe(true);
  });

  it('rolls the age in code, so a cast is not all the same age', async () => {
    const sameEveryTime = async () => ({
      name: 'Ada', species: 'human', age: 42, maritalStatus: 'single', inDebt: false, backstory: 'A miller.',
      occupation: null, relationships: [], affiliations: [], abilities: [{ name: 'Grit', description: 'Keeps going.' }],
      routine: { workDaysPerWeek: 0, tavernEveningsPerWeek: 0, familyEveningsPerWeek: 0, worshipDay: -1 }, creature: null,
    });
    const ages = await Promise.all(['a', 'b', 'c', 'd'].map(seed =>
      generateNpc({ classification: 'gentleman', setting: 'a village', hints: '', seed }, sameEveryTime, '1200-01-01').then(npc => npc.age)));
    expect(new Set(ages).size).toBeGreaterThan(1);
  });
});

describe('births', () => {
  it('never gives the same parent two children within fifteen months', async () => {
    const { advanceTogether } = await import('./together');
    const parent = buildTestNpc({ age: 25, relationships: [{ name: 'Elsa', kind: 'spouse', affinity: 90 }] });
    const { npcs: [lived] } = advanceTogether([parent], '1215-01-01', createDice('many'));
    const births = lived.lifeLog.filter(event => event.summary.startsWith('A child,')).map(event => Date.parse(event.at));
    const gaps = births.slice(1).map((birth, index) => (birth - births[index]) / 86_400_000);
    expect(births.length).toBeGreaterThan(1);
    expect(gaps.every(days => days >= 456)).toBe(true);
  });
});
