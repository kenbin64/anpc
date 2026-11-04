import { findProblems } from './npc-format';
import { createSettlement, summonRoleHolder } from './settlement';

const writer = async () => ({
  name: 'Hobb Ashcroft', species: 'human', age: 48, maritalStatus: 'married', backstory: 'Keeps the peace with a heavy cudgel.',
  occupation: { title: 'farmer', workplace: 'his fields', role: 'worker' },
  relationships: [], affiliations: [], abilities: [{ name: 'Stern voice', description: 'Brawls stop when he shouts.' }],
  routine: { workDaysPerWeek: 6, tavernEveningsPerWeek: 1, familyEveningsPerWeek: 3, worshipDay: 0 }, creature: null,
});

describe('implied roles', () => {
  it('gives a town the roles of a village and a hamlet too, all unfilled', () => {
    const town = createSettlement('Ashford', 'town', 'a river valley');
    const titles = town.roles.map(role => role.title);
    expect(titles).toContain('mayor');
    expect(titles).toContain('constable');
    expect(titles).toContain('blacksmith');
    expect(titles).toContain('elder');
    expect(titles).not.toContain('bishop');
    expect(town.roles.every(role => !role.heldBy)).toBe(true);
  });

  it('creates the holder the first time they are needed, with the office as their job', async () => {
    const town = createSettlement('Ashford', 'town', 'a river valley');
    const summoned = await summonRoleHolder(town, 'constable', writer, '1200-03-01');

    expect(summoned.newNpc).not.toBeNull();
    expect(findProblems(summoned.newNpc)).toEqual([]);
    expect(summoned.newNpc?.occupation?.title).toBe('constable');
    expect(summoned.newNpc?.occupation?.workplace).toBe('the watch house');
    expect(summoned.newNpc?.lifeLog[0].summary).toContain('the constable of Ashford');
    expect(summoned.settlement.roles.find(role => role.title === 'constable')?.heldBy).toBe(summoned.holderId);
  });

  it('returns the same person after that, without creating anyone new', async () => {
    const first = await summonRoleHolder(createSettlement('Ashford', 'town', 'a river valley'), 'constable', writer, '1200-03-01');
    const again = await summonRoleHolder(first.settlement, 'constable', writer, '1200-04-01');

    expect(again.newNpc).toBeNull();
    expect(again.holderId).toBe(first.holderId);
  });

  it('gives the role to the person people already speak of, instead of inventing a second one', async () => {
    const town = createSettlement('Ashford', 'town', 'a river valley');
    const edwin = {
      id: 'baker-x0', name: 'Edwin', species: 'human', description: "Godric's rival, the miller", classification: 'gentleman' as const,
      knownBy: [{ npcId: 'baker', npcName: 'Godric', npcDescription: 'a baker', kind: 'rival' as const, notes: 'the miller who overcharges for flour' }],
    };
    const summoned = await summonRoleHolder(town, 'miller', writer, '1200-03-01', 'seed', [], [edwin]);

    expect(summoned.promotedExtraId).toBe('baker-x0');
    expect(summoned.newNpc?.name).toBe('Edwin');
    expect(summoned.newNpc?.occupation?.title).toBe('miller');
    expect(summoned.newNpc?.lifeLog[0].summary).toContain('the one Godric spoke of');
  });

  it('says plainly when a place has no such role', async () => {
    const hamlet = createSettlement('Brindle', 'hamlet', 'the moors');
    await expect(summonRoleHolder(hamlet, 'mayor', writer, '1200-03-01')).rejects.toThrow('Brindle has no mayor');
  });
});
