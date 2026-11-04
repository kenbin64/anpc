import { createCrowd, linkPromotion, promoteExtra, registerExtras } from './extras';
import { findProblems } from './npc-format';
import { createDice } from './random';
import { buildTestNpc } from './test-npc';

/** A stand-in for the AI that invents its own name and a tie that clashes with the known facts. */
const careless = async () => ({
  name: 'Somebody Else', species: 'elf', age: 33, maritalStatus: 'married', backstory: 'Keeps the house and the books.',
  occupation: { title: 'bookkeeper', workplace: 'the forge', role: 'worker' },
  relationships: [{ name: 'Bram', kind: 'friend', affinity: 40 }, { name: 'Hilde', kind: 'sibling', affinity: 80 }],
  affiliations: [], abilities: [{ name: 'Sharp eye', description: 'Spots a wrong sum at a glance.' }],
  routine: { workDaysPerWeek: 5, tavernEveningsPerWeek: 0, familyEveningsPerWeek: 4, worshipDay: 0 }, creature: null,
});

describe('extras', () => {
  it('registers the people an NPC talks about, and logs that it did', () => {
    const { npc, extras } = registerExtras(buildTestNpc(), '1200-01-01');
    expect(extras.map(extra => extra.name)).toEqual(['Elsa']);
    expect(extras[0].description).toBe("Bram's spouse");
    expect(npc.relationships[0].extraId).toBe(extras[0].id);
    expect(npc.lifeLog.at(-1)?.changes?.[0].field).toBe('relationships.0.extraId');
  });

  it('does not register someone twice', () => {
    const once = registerExtras(buildTestNpc(), '1200-01-01').npc;
    expect(registerExtras(once, '1200-01-02').extras).toEqual([]);
  });

  it('fills a room with faces, the same ones for the same seed', () => {
    const crowd = createCrowd(5, 'the Gilded Goose', 'human', createDice('tavern'), 'goose');
    expect(crowd).toHaveLength(5);
    expect(createCrowd(5, 'the Gilded Goose', 'human', createDice('tavern'), 'goose')).toEqual(crowd);
    expect(crowd[0].description).toContain('the Gilded Goose');
  });

  it('promotes an extra into a full NPC that keeps the known facts, even when the AI drifts', async () => {
    const { npc: bram, extras } = registerExtras(buildTestNpc(), '1200-01-01');
    const elsa = await promoteExtra(extras[0], careless, 'a forge village', '1200-06-01');

    expect(findProblems(elsa)).toEqual([]);
    expect(elsa.name).toBe('Elsa');
    expect(elsa.species).toBe('human');
    expect(elsa.id).toBe(extras[0].id);
    expect(elsa.relationships.filter(tie => tie.name === 'Bram')).toEqual([
      { name: 'Bram', kind: 'spouse', npcId: bram.id, affinity: 70, notes: undefined },
    ]);
    expect(elsa.relationships.some(tie => tie.name === 'Hilde')).toBe(true);
    expect(elsa.lifeLog[0].summary).toContain("known only as Bram's spouse");
  });

  it('points the NPC who knew the extra at the new full NPC', async () => {
    const { npc: bram, extras } = registerExtras(buildTestNpc(), '1200-01-01');
    const elsa = await promoteExtra(extras[0], careless, 'a forge village', '1200-06-01');
    const linked = linkPromotion(bram, elsa, '1200-06-01');

    expect(linked.relationships[0].npcId).toBe(elsa.id);
    expect(linked.lifeLog.at(-1)?.summary).toContain('stepped into the story');
  });
});
