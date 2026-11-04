import { proposeMarriage } from './marriage';
import { createDice } from './random';
import { buildTestNpc } from './test-npc';

/** An unmarried NPC who knows a player, Kestrel, with the given affection. */
function buildSingle(affinity: number) {
  return buildTestNpc({
    maritalStatus: 'single',
    relationships: [{ name: 'Kestrel', kind: 'friend', affinity, playerId: 'player-1' }],
  });
}

describe('marriage', () => {
  it('an ANPC who loves the player says yes, and it is recorded as a shared home', () => {
    const { npc, accepted } = proposeMarriage(buildSingle(90), { name: 'Kestrel', playerId: 'player-1' }, createDice('yes'), '1200-05-01');

    expect(accepted).toBe(true);
    expect(npc.maritalStatus).toBe('married');
    expect(npc.relationships[0]).toMatchObject({ name: 'Kestrel', kind: 'spouse', playerId: 'player-1' });
    expect(npc.lifeLog.at(-1)?.summary).toBe('Bram married Kestrel. They now share a home.');
  });

  it('says no to someone they barely care for, and remembers being asked', () => {
    const { npc, accepted } = proposeMarriage(buildSingle(30), { name: 'Kestrel', playerId: 'player-1' }, createDice('no'), '1200-05-01');

    expect(accepted).toBe(false);
    expect(npc.maritalStatus).toBe('single');
    expect(npc.lifeLog.at(-1)?.summary).toBe("Kestrel asked for Bram's hand, and Bram said no.");
  });

  it('says no when already married', () => {
    const married = buildTestNpc({
      relationships: [...buildTestNpc().relationships, { name: 'Kestrel', kind: 'friend', affinity: 95, playerId: 'player-1' }],
    });
    expect(proposeMarriage(married, { name: 'Kestrel', playerId: 'player-1' }, createDice('taken'), '1200-05-01').accepted).toBe(false);
  });

  it('can marry another ANPC too', () => {
    const single = buildTestNpc({ maritalStatus: 'single', relationships: [{ name: 'Hilde', kind: 'friend', affinity: 80, npcId: 'hilde' }] });
    const { npc } = proposeMarriage(single, { name: 'Hilde', npcId: 'hilde' }, createDice('pair'), '1200-05-01');
    expect(npc.relationships[0]).toMatchObject({ kind: 'spouse', npcId: 'hilde' });
  });
});
