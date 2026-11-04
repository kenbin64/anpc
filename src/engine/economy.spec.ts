import { TREATMENT_COST, calculateWeeklyWage, chargePlayerLiving, formatMoney, payNpc, payPlayer } from './economy';
import { advanceLife } from './life-simulator';
import { PlayerCharacter } from './npc.model';
import { createDice } from './random';
import { buildTestNpc } from './test-npc';
import { advanceTogether, offerCare } from './together';

const richPlayer: PlayerCharacter = { id: 'p1', name: 'Lord Aldric', description: 'a richly dressed lord', purse: 5000, societyRank: 'noble' };
const poorPlayer: PlayerCharacter = { id: 'p2', name: 'Wren', description: 'a ragged farmhand', purse: 15, societyRank: 'peasant' };

describe('money', () => {
  it('shows amounts the way the era would say them', () => {
    expect(formatMoney(235)).toBe('2 gold, 3 silver, 5 copper');
    expect(formatMoney(0)).toBe('0 copper');
    expect(formatMoney(-40)).toBe('owes 4 silver');
    expect(formatMoney(1234, 'modern')).toBe('$12.34');
  });

  it('pays experience: a master earns more than a novice in the same role', () => {
    expect(calculateWeeklyWage('tradesman', 90)).toBeGreaterThan(calculateWeeklyWage('tradesman', 10));
    expect(calculateWeeklyWage('none', 90)).toBe(0);
  });

  it('a working NPC earns, spends, and the year is summed up', () => {
    const lived = advanceLife(buildTestNpc(), '1201-01-01', createDice('wages'));
    const period = lived.lifeLog.find(event => event.kind === 'period')!;
    expect(period.summary).toMatch(/earned .+ and spent .+, leaving/);
    expect(period.changes?.some(change => change.field === 'purse')).toBe(true);
  });

  it('logs falling into debt when living costs outrun income', () => {
    const idleMerchant = buildTestNpc({ occupation: null, purse: 100, social: { societyRank: 'merchant', peerRank: 50, reputation: 50 } });
    const lived = advanceLife(idleMerchant, '1200-03-01', createDice('spendthrift'));
    expect(lived.purse).toBeLessThan(0);
    expect(lived.lifeLog.some(event => event.summary === 'Bram fell into debt.')).toBe(true);
  });
});

describe('story and money agree', () => {
  it('a character whose story says they owe money starts in debt', async () => {
    const { generateNpc } = await import('./npc-generator');
    const writer = async () => ({
      name: 'Thoric', species: 'human', age: 35, maritalStatus: 'married', backstory: 'Owes the lord for his forge.', inDebt: true,
      occupation: { title: 'blacksmith', workplace: 'the forge', role: 'owner' }, relationships: [], affiliations: [],
      abilities: [{ name: 'Tool mastery', description: 'Any tool, any job.' }],
      routine: { workDaysPerWeek: 6, tavernEveningsPerWeek: 1, familyEveningsPerWeek: 3, worshipDay: 0 }, creature: null,
    });
    const npc = await generateNpc({ classification: 'gentleman', setting: 'a village', hints: 'quietly in debt', seed: 'debt' }, writer, '1200-01-01');
    expect(npc.purse).toBeLessThan(0);
  });
});

describe('balance', () => {
  it('a working villager of each rank tends to stay afloat over a year', () => {
    for (const rank of ['peasant', 'commoner', 'merchant', 'gentry', 'noble'] as const) {
      const ends = Array.from({ length: 10 }, (_, index) => {
        const villager = buildTestNpc({ id: `v-${rank}-${index}`, purse: 100, social: { societyRank: rank, peerRank: 50, reputation: 50 } });
        return advanceLife(villager, '1201-01-01', createDice(`balance-${rank}-${index}`)).purse;
      });
      expect(ends.filter(purse => purse >= 0).length).toBeGreaterThanOrEqual(6);
    }
  });
});

describe('players and money', () => {
  it('a rich player can pay an NPC, and the NPC remembers it', () => {
    const result = payNpc(richPlayer, buildTestNpc(), 150, 'a new sword', '1200-02-01');
    expect(result.paid).toBe(true);
    expect(result.player.purse).toBe(4850);
    expect(result.npc.purse).toBe(350);
    expect(result.npc.lifeLog.at(-1)?.summary).toBe('Lord Aldric paid 1 gold, 5 silver for a new sword.');
  });

  it('a player cannot pay what they do not have', () => {
    const result = payNpc(poorPlayer, buildTestNpc(), 150, 'a new sword', '1200-02-01');
    expect(result.paid).toBe(false);
    expect(result.problem).toBe("Wren doesn't have 1 gold, 5 silver.");
  });

  it('a working player gets paid by an NPC, and has to cover their own living', () => {
    const paid = payPlayer(buildTestNpc(), poorPlayer, 30, 'a week at the forge', '1200-02-01');
    expect(paid.player.purse).toBe(45);
    expect(chargePlayerLiving(paid.player, 2).purse).toBe(25);
  });
});

describe('money between NPCs', () => {
  it('an employer who is a full NPC pays the worker from their own purse', () => {
    const employer = buildTestNpc({ id: 'miller', name: 'Tobin', purse: 1000, relationships: [{ name: 'Wat', kind: 'employee', affinity: 60, npcId: 'worker' }] });
    const worker = buildTestNpc({
      id: 'worker', name: 'Wat', occupation: { title: 'mill hand', workplace: 'the mill', role: 'worker', experience: 30, workEthic: 70, weeklyWage: 21 },
      relationships: [{ name: 'Tobin', kind: 'employer', affinity: 60, npcId: 'miller' }],
    });
    const [paidEmployer] = advanceTogether([employer, worker], '1200-02-05', createDice('payroll')).npcs;
    const wagesOut = paidEmployer.lifeLog.find(event => event.kind === 'period')?.changes?.find(change => change.field === 'purse');
    expect(wagesOut?.reason).toContain('Wages paid to Wat');
  });

  it('a kind employer who cannot afford treatment says so instead of paying', () => {
    const brokeMiller = buildTestNpc({
      id: 'miller', name: 'Tobin', purse: TREATMENT_COST - 1,
      temperament: { disposition: 60, honesty: 60, alignment: 95, randomness: 0 },
      relationships: [{ name: 'Wat', kind: 'employee', affinity: 80, npcId: 'worker' }],
    });
    const sickWorker = buildTestNpc({ id: 'worker', name: 'Wat', health: { condition: 50, ailments: ['winter fever'], alive: true } });
    const [miller, worker] = offerCare([brokeMiller, sickWorker], 1, createDice('broke'), '1200-03-01');

    expect(worker.health.caredForBy).toBeUndefined();
    expect(miller.lifeLog.at(-1)?.summary).toBe("Wanted to pay for Wat's treatment for winter fever, but could not afford it.");
  });
});
