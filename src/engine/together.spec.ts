import { advanceLife } from './life-simulator';
import { Npc } from './npc.model';
import { createDice } from './random';
import { buildTestNpc } from './test-npc';
import { advanceTogether, offerCare } from './together';

/** A miller and his worker, tied to each other both ways. */
function buildMillAndWorker(millerAlignment: number, millerFeeling = 70): [Npc, Npc] {
  const miller = buildTestNpc({
    id: 'miller', name: 'Tobin',
    temperament: { disposition: 60, honesty: 60, alignment: millerAlignment, randomness: 0 },
    relationships: [{ name: 'Wat', kind: 'employee', affinity: millerFeeling, npcId: 'worker' }],
  });
  const worker = buildTestNpc({
    id: 'worker', name: 'Wat',
    health: { condition: 55, ailments: ['winter fever'], alive: true },
    relationships: [{ name: 'Tobin', kind: 'employer', affinity: 50, npcId: 'miller' }],
  });
  return [miller, worker];
}

describe('care for the sick', () => {
  it('a kind employer pays for treatment, and both remember it', () => {
    const [miller, worker] = offerCare(buildMillAndWorker(90), 1, createDice('kind'), '1200-03-01');

    expect(worker.health.caredForBy).toBe('Tobin');
    expect(worker.relationships[0].affinity).toBe(60);
    expect(miller.lifeLog.at(-2)?.summary).toBe("Paid for Wat's treatment for winter fever.");
    expect(miller.social.reputation).toBe(52);
  });

  it('a cold employer refuses, and the worker thinks less of him', () => {
    const [miller, worker] = offerCare(buildMillAndWorker(10), 1, createDice('cold'), '1200-03-01');

    expect(worker.health.caredForBy).toBeUndefined();
    expect(worker.relationships[0].affinity).toBe(45);
    expect(miller.lifeLog.at(-1)?.summary).toBe("Would not pay for Wat's treatment for winter fever.");
  });

  it('even a kind employer will not pay for someone they dislike', () => {
    const [, worker] = offerCare(buildMillAndWorker(90, 10), 1, createDice('grudge'), '1200-03-01');
    expect(worker.health.caredForBy).toBeUndefined();
  });

  it('makes survival more likely: cared-for workers recover sooner on average', () => {
    const weeksToRecover = (cared: boolean, seed: string): number => {
      const [, worker] = buildMillAndWorker(90);
      const patient = { ...worker, health: { ...worker.health, caredForBy: cared ? 'Tobin' : undefined } };
      const lived = advanceLife(patient, '1201-01-01', createDice(seed));
      const recovered = lived.lifeLog.find(event => event.summary.startsWith('Recovered from winter fever'));
      return recovered ? (Date.parse(recovered.at) - Date.parse('1200-01-01')) / 604_800_000 : 52;
    };
    const seeds = Array.from({ length: 200 }, (_, index) => `trial-${index}`);
    const average = (cared: boolean) => seeds.reduce((sum, seed) => sum + weeksToRecover(cared, seed), 0) / seeds.length;
    expect(average(true)).toBeLessThan(average(false));
  });
});

describe('living together', () => {
  it('lets a worker falling ill reach his employer during a catch-up', () => {
    const [miller, healthyWorker] = buildMillAndWorker(90);
    const worker = { ...healthyWorker, health: { condition: 100, ailments: [], alive: true } };
    const [livedMiller, livedWorker] = advanceTogether([miller, worker], '1210-01-01', createDice('decade')).npcs;

    const workerFellIll = livedWorker.lifeLog.some(event => event.summary.startsWith('Fell ill'));
    const millerDecided = livedMiller.lifeLog.some(event => event.kind === 'choice' && event.summary.includes("Wat's treatment"));
    expect(workerFellIll).toBe(true);
    expect(millerDecided).toBe(true);
  });

  it('still closes each life with its own period summary', () => {
    const [miller, worker] = buildMillAndWorker(90);
    const lived = advanceTogether([miller, worker], '1200-06-01', createDice('half')).npcs;
    expect(lived.every(npc => npc.lifeLog.some(event => event.kind === 'period'))).toBe(true);
  });
});

describe('births', () => {
  /** A young married couple, both full NPCs, tied to each other. */
  function buildCouple(): [Npc, Npc] {
    const husband = buildTestNpc({
      id: 'bram', name: 'Bram Fletcher', age: 26,
      relationships: [{ name: 'Elsa Fletcher', kind: 'spouse', affinity: 85, npcId: 'elsa' }],
    });
    const wife = buildTestNpc({
      id: 'elsa', name: 'Elsa Fletcher', age: 24,
      relationships: [{ name: 'Bram Fletcher', kind: 'spouse', affinity: 85, npcId: 'bram' }],
    });
    return [husband, wife];
  }

  it('a married couple may have a child, recorded plainly on both parents', () => {
    const { npcs: [bram, elsa], newExtras } = advanceTogether(buildCouple(), '1206-01-01', createDice('family'));

    expect(newExtras.length).toBeGreaterThan(0);
    const firstBorn = newExtras[0];
    expect(firstBorn.name).toMatch(/ Fletcher$/);
    for (const parent of [bram, elsa]) {
      const birth = parent.lifeLog.find(event => event.kind === 'family')!;
      expect(birth.summary).toBe(`A child, ${firstBorn.name}, was born.`);
      expect(parent.relationships.some(tie => tie.kind === 'child' && tie.extraId === firstBorn.id)).toBe(true);
    }
  });

  it('counts a couple once, so one birth gives one child, not two', () => {
    const { newExtras, npcs: [bram] } = advanceTogether(buildCouple(), '1206-01-01', createDice('family'));
    const childTies = bram.relationships.filter(tie => tie.kind === 'child');
    expect(childTies).toHaveLength(newExtras.length);
  });

  it('gives no children to the unmarried', () => {
    const single = buildTestNpc({ maritalStatus: 'single', age: 25, relationships: [] });
    expect(advanceTogether([single], '1210-01-01', createDice('alone')).newExtras).toEqual([]);
  });
});
