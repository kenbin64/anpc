import { court } from './courtship';
import { proposeMarriage } from './marriage';
import { createDice } from './random';
import { buildTestNpc } from './test-npc';

const kestrel = { name: 'Kestrel', playerId: 'player-1' };

function buildSingle(affinity: number) {
  return buildTestNpc({
    name: 'Hilde', maritalStatus: 'single',
    relationships: [{ name: 'Kestrel', kind: 'acquaintance', affinity, playerId: 'player-1' }],
  });
}

describe('courtship', () => {
  it('builds affection over time, until a proposal is likely to be accepted', () => {
    let hilde = buildSingle(55);
    const dice = createDice('courting');
    for (let week = 0; week < 15; week++) {
      hilde = court(hilde, kestrel, 'a small gift', dice, `1200-02-${String(week + 1).padStart(2, '0')}`).npc;
    }
    expect(hilde.relationships[0].affinity).toBeGreaterThanOrEqual(75);
    expect(proposeMarriage(hilde, kestrel, dice, '1200-03-01').accepted).toBe(true);
  });

  it('lets an ANPC turn a suitor away, and pushing on only costs more', () => {
    let hilde = buildSingle(20);
    const dice = createDice('no');
    const first = court(hilde, kestrel, 'kind words', dice, '1200-02-01');
    expect(first.notInterested).toBe(true);
    expect(first.npc.lifeLog.at(-2)?.summary).toContain('made it clear they were not interested');
    hilde = first.npc;
    for (let time = 0; time < 3; time++) hilde = court(hilde, kestrel, 'a small gift', dice, '1200-02-02').npc;
    expect(hilde.relationships[0].affinity).toBe(0);
  });

  it('a married ANPC is not open to courting at all', () => {
    const married = buildTestNpc({
      relationships: [...buildTestNpc().relationships, { name: 'Kestrel', kind: 'friend', affinity: 90, playerId: 'player-1' }],
    });
    expect(court(married, kestrel, 'a song', createDice('m'), '1200-02-01').notInterested).toBe(true);
  });

  it('works the same for any ANPC, whoever they are', () => {
    const bram = buildTestNpc({ maritalStatus: 'single', relationships: [{ name: 'Kestrel', kind: 'friend', affinity: 60, playerId: 'player-1' }] });
    const result = court(bram, kestrel, 'a walk together', createDice('even'), '1200-02-01');
    expect(result.notInterested).toBe(false);
  });
});
