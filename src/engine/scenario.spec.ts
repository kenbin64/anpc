import { findProblems } from './npc-format';
import { catchUpScenario, startScenario } from './scenario';
import { createSettlement } from './settlement';
import { readGameDate } from './world-clock';

let storyCount = 0;
const writer = async () => {
  storyCount += 1;
  return {
    name: `Villager ${storyCount}`, species: 'human', age: 30 + storyCount, maritalStatus: 'married', backstory: 'Born and raised here.',
    occupation: { title: 'farmer', workplace: 'the fields', role: 'worker' },
    relationships: [{ name: `Spouse of ${storyCount}`, kind: 'spouse', affinity: 80 }],
    affiliations: [], abilities: [{ name: 'Green thumb', description: 'Anything grows for them.' }],
    routine: { workDaysPerWeek: 6, tavernEveningsPerWeek: 1, familyEveningsPerWeek: 3, worshipDay: 0 }, creature: null,
  };
};

describe('world clock', () => {
  it('turns real days into game days at the chosen speed', () => {
    const clock = { realStart: '2026-11-01T09:00:00Z', gameStart: '1200-01-01', gameDaysPerRealDay: 7 };
    expect(readGameDate(clock, new Date('2026-11-01T09:00:00Z'))).toBe('1200-01-01');
    expect(readGameDate(clock, new Date('2026-11-05T09:00:00Z'))).toBe('1200-01-29');
    expect(readGameDate(clock, new Date('2026-10-01T09:00:00Z'))).toBe('1200-01-01');
  });
});

describe('starting a scenario', () => {
  it('opens with the requested cast and the starting roles, and leaves the rest implied', async () => {
    const scenario = await startScenario({
      settlement: createSettlement('Ashford', 'town', 'a river valley'),
      startingCast: [
        { classification: 'rogue', hints: 'a widowed baker with a grudge against the miller', seed: 'baker' },
        { classification: 'vagabond', hints: 'a wandering tinker who knows too much', seed: 'tinker' },
      ],
      startingRoles: ['innkeeper', 'constable'],
    }, writer, '1200-01-01');

    expect(scenario.npcs).toHaveLength(4);
    expect(scenario.npcs.every(npc => findProblems(npc).length === 0)).toBe(true);
    expect(scenario.npcs.map(npc => npc.occupation?.title)).toEqual(expect.arrayContaining(['innkeeper', 'constable']));
    expect(scenario.settlement.roles.find(role => role.title === 'mayor')?.heldBy).toBeUndefined();
    expect(scenario.settlement.roles.find(role => role.title === 'innkeeper')?.heldBy).toBeDefined();
  });

  it('catches the whole cast up whenever the app starts', async () => {
    const scenario = await startScenario({
      settlement: createSettlement('Ashford', 'town', 'a river valley'),
      startingCast: [{ classification: 'gentleman', hints: '', seed: 'catch' }],
      startingRoles: ['innkeeper'],
    }, writer, '1200-01-01', new Date('2026-11-01T09:00:00Z'));

    const fourRealDaysLater = catchUpScenario(scenario, new Date('2026-11-05T09:00:00Z'));

    expect(fourRealDaysLater.npcs.every(npc => npc.livedUntil === '1200-01-29' || !npc.health.alive)).toBe(true);
    expect(fourRealDaysLater.npcs[0].lifeLog.some(event => event.kind === 'period')).toBe(true);
  });

  it('turns everyone the cast talks about into extras', async () => {
    const scenario = await startScenario({
      settlement: createSettlement('Brindle', 'village', 'the moors'),
      startingCast: [{ classification: 'gentleman', hints: '', seed: 'one' }],
      startingRoles: [],
    }, writer, '1200-01-01');

    expect(scenario.extras).toHaveLength(1);
    expect(scenario.extras[0].knownBy[0].npcName).toBe(scenario.npcs[0].name);
  });
});
