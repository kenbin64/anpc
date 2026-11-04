import { rollNumbers } from './archetypes';
import { calculateEffectiveStats, calculateEffectiveWorkEthic, recordDeath } from './health';
import { advanceLife } from './life-simulator';
import { changeField, eventsSince, shiftDial } from './life-log';
import { calculateChanceAgainstNature, decide } from './nature';
import { exportNpc, importNpc } from './npc-format';
import { generateNpc } from './npc-generator';
import { createDice } from './random';
import { shapeStory } from './story';
import { buildTestNpc } from './test-npc';

describe('dice', () => {
  it('rolls the same numbers for the same seed, and different numbers for another', () => {
    const first = Array.from({ length: 5 }, ((dice) => () => dice.rollPercent())(createDice('bram')));
    const again = Array.from({ length: 5 }, ((dice) => () => dice.rollPercent())(createDice('bram')));
    const other = Array.from({ length: 5 }, ((dice) => () => dice.rollPercent())(createDice('elsa')));
    expect(again).toEqual(first);
    expect(other).not.toEqual(first);
  });

  it('keeps rolls inside their range', () => {
    const dice = createDice('range');
    const rolls = Array.from({ length: 500 }, () => dice.rollBetween(3, 6));
    expect(Math.min(...rolls)).toBe(3);
    expect(Math.max(...rolls)).toBe(6);
  });
});

describe('life log', () => {
  it('changes a field on a copy and records the old value, the new value and the reason', () => {
    const npc = buildTestNpc();
    const changed = changeField(npc, 'occupation.title', 'master smith', 'Took over the guild forge', '1200-02-01');
    expect(npc.occupation?.title).toBe('blacksmith');
    expect(changed.occupation?.title).toBe('master smith');
    expect(changed.lifeLog.at(-1)?.changes?.[0]).toEqual({
      field: 'occupation.title', from: 'blacksmith', to: 'master smith', reason: 'Took over the guild forge',
    });
  });

  it('keeps dials inside 0 to 100', () => {
    const npc = shiftDial(buildTestNpc(), 'social.reputation', 80, 'Saved the village', '1200-02-01');
    expect(npc.social.reputation).toBe(100);
  });

  it('lists what happened after a given date, for a game catching up', () => {
    const npc = changeField(buildTestNpc(), 'age', 41, 'Birthday', '1200-03-01');
    expect(eventsSince(npc, '1200-02-01').map(event => event.summary)).toEqual(['Birthday']);
  });
});

describe('health', () => {
  it('leaves a healthy NPC at full strength', () => {
    const npc = buildTestNpc();
    expect(calculateEffectiveStats(npc).strength).toBe(16);
    expect(calculateEffectiveWorkEthic(npc)).toBe(80);
  });

  it('weakens body, temper and work when sick, without changing the stored stats', () => {
    const sick = buildTestNpc({ health: { condition: 20, ailments: ['winter fever'], alive: true } });
    expect(calculateEffectiveStats(sick).strength).toBeLessThan(16);
    expect(calculateEffectiveWorkEthic(sick)).toBeLessThan(80);
    expect(sick.stats.strength).toBe(16);
  });

  it('records a death with its cause, and the dead stop living', () => {
    const dead = recordDeath(buildTestNpc(), 'winter fever', '1200-02-01');
    expect(dead.health.alive).toBe(false);
    expect(dead.health.death).toEqual({ at: '1200-02-01', cause: 'winter fever' });
    expect(advanceLife(dead, '1201-01-01', createDice('x')).lifeLog.length).toBe(dead.lifeLog.length);
  });
});

describe('nature versus randomness', () => {
  it('always follows its nature when randomness is zero', () => {
    const honest = buildTestNpc({ temperament: { disposition: 50, honesty: 90, alignment: 50, randomness: 0 } });
    const dice = createDice('steal');
    const choices = Array.from({ length: 50 }, () => decide(honest, 'tempted-to-steal', dice).response);
    expect(new Set(choices)).toEqual(new Set(['leaves it alone']));
  });

  it('lets strong conviction resist even high randomness', () => {
    expect(calculateChanceAgainstNature(98, 100)).toBeLessThan(calculateChanceAgainstNature(55, 100));
  });

  it('sometimes breaks nature when torn and unpredictable', () => {
    const torn = buildTestNpc({ temperament: { disposition: 50, honesty: 55, alignment: 50, randomness: 100 } });
    const dice = createDice('torn');
    const decisions = Array.from({ length: 200 }, () => decide(torn, 'tempted-to-steal', dice));
    const againstCount = decisions.filter(decision => decision.wentAgainstNature).length;
    expect(againstCount).toBeGreaterThan(40);
    expect(againstCount).toBeLessThan(160);
  });

  it('makes a sick NPC quicker to fight', () => {
    const calm = buildTestNpc({ temperament: { disposition: 60, honesty: 50, alignment: 50, randomness: 0 } });
    const sickAndCalm = { ...calm, health: { condition: 10, ailments: ['a festering cut'], alive: true } };
    expect(decide(calm, 'insulted', createDice('a')).response).toBe('talks it out');
    expect(decide(sickAndCalm, 'insulted', createDice('a')).response).toBe('starts a fight');
  });
});

describe('off-screen life', () => {
  it('lives a year and sums up the routine in one entry, not one per week', () => {
    const lived = advanceLife(buildTestNpc(), '1201-01-01', createDice('a year'));
    const periods = lived.lifeLog.filter(event => event.kind === 'period');
    expect(periods).toHaveLength(1);
    expect(periods[0].summary).toMatch(/^From 1200-01-01 to 1200-12-\d\d: Lived \d+ weeks, worked/);
    expect(lived.lifeLog.length).toBeLessThan(30);
  });

  it('gives important events their own entries, dated when they happened', () => {
    const lived = advanceLife(buildTestNpc(), '1205-01-01', createDice('five years'));
    const important = lived.lifeLog.filter(event => event.kind === 'change' || event.kind === 'conflict');
    expect(important.some(event => /Fell ill|brawl/.test(event.summary))).toBe(true);
    const dates = lived.lifeLog.map(event => event.at);
    expect(dates).toEqual([...dates].sort());
  });

  it('records the net change of routine drift in the summary, with reasons', () => {
    const start = buildTestNpc({ health: { condition: 80, ailments: [], alive: true } });
    const lived = advanceLife(start, '1200-02-01', createDice('heal'));
    const period = lived.lifeLog.find(event => event.kind === 'period')!;
    const health = period.changes?.find(change => change.field === 'health.condition');
    expect(health?.from).toBe(80);
    expect(health?.reason).toContain('Rest and time');
  });

  it('gives the same life for the same seed', () => {
    const first = advanceLife(buildTestNpc(), '1201-01-01', createDice('same'));
    const second = advanceLife(buildTestNpc(), '1201-01-01', createDice('same'));
    expect(second).toEqual(first);
  });

  it('logs every number that changed, with a reason', () => {
    const lived = advanceLife(buildTestNpc(), '1203-01-01', createDice('changes'));
    const changes = lived.lifeLog.flatMap(event => event.changes ?? []);
    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every(change => change.reason.length > 0)).toBe(true);
  });

  it('ages them on the new year', () => {
    const lived = advanceLife(buildTestNpc(), '1200-01-20', createDice('young'));
    const older = advanceLife(buildTestNpc({ livedUntil: '1200-12-28' }), '1201-01-10', createDice('young'));
    expect(lived.age).toBe(40);
    expect(older.age === 41 || !older.health.alive).toBe(true);
  });
});

describe('integration format', () => {
  it('exports and imports an NPC unchanged', () => {
    const npc = buildTestNpc();
    expect(importNpc(exportNpc(npc))).toEqual({ npc, problems: [] });
  });

  it('refuses a damaged file and says why', () => {
    const broken = { ...buildTestNpc(), temperament: { disposition: 150, honesty: 50, alignment: 50, randomness: 0 } };
    const result = importNpc(JSON.stringify(broken));
    expect(result.npc).toBeNull();
    expect(result.problems).toContain('temperament.disposition must be a number from 0 to 100.');
    expect(importNpc('{oops').problems).toEqual(['The file is not valid JSON.']);
  });
});

describe('generator', () => {
  it('repairs a sloppy model answer', () => {
    const story = shapeStory({ name: '  Wren ', age: 900, routine: { tavernEveningsPerWeek: 12 }, maritalStatus: 'it is complicated' }, false);
    expect(story.name).toBe('Wren');
    expect(story.age).toBe(500);
    expect(story.routine.tavernEveningsPerWeek).toBe(7);
    expect(story.maritalStatus).toBe('single');
  });

  it('rolls numbers inside each archetype and in range', () => {
    const numbers = rollNumbers('thief', createDice('sneak'));
    expect(numbers.temperament.honesty).toBeLessThanOrEqual(27);
    expect(Object.values(numbers.stats).every(stat => stat >= 3 && stat <= 18)).toBe(true);
  });

  it('builds a complete, valid NPC around the story a writer returns', async () => {
    const fakeWriter = async () => ({
      name: 'Old Tobin', species: 'human', age: 62, maritalStatus: 'widowed',
      backstory: 'A miller who cheats on the weights.', occupation: { title: 'miller', workplace: 'the mill', role: 'owner' },
      relationships: [{ name: 'Mara', kind: 'child', affinity: 85 }], affiliations: [{ name: 'Millers Guild', kind: 'guild' }],
      abilities: [{ name: 'Weighing hand', description: 'Can tell a short sack by feel.' }],
      routine: { workDaysPerWeek: 6, tavernEveningsPerWeek: 3, familyEveningsPerWeek: 1, worshipDay: -1 }, creature: null,
    });
    const npc = await generateNpc({ classification: 'rogue', setting: 'a river village', hints: '', seed: 'tobin' }, fakeWriter, '1200-01-01');
    expect(importNpc(exportNpc(npc)).problems).toEqual([]);
    expect(npc.name).toBe('Old Tobin');
    expect(npc.affiliations[0].standing).toBeGreaterThanOrEqual(20);
    expect(npc.lifeLog[0].kind).toBe('created');
  });
});
