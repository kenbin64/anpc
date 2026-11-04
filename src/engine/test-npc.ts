import { NPC_SCHEMA_VERSION, Npc } from './npc.model';

/** A ready-made NPC for tests, so each test only changes the part it cares about. */
export function buildTestNpc(overrides: Partial<Npc> = {}): Npc {
  return {
    schemaVersion: NPC_SCHEMA_VERSION,
    id: 'npc-test',
    name: 'Bram',
    species: 'human',
    age: 40,
    lifeExpectancy: 70,
    classification: 'gentleman',
    maritalStatus: 'married',
    backstory: 'A blacksmith who took over his father\'s forge.',
    stats: { strength: 16, dexterity: 10, constitution: 14, intelligence: 10, wisdom: 12, charisma: 10 },
    health: { condition: 100, ailments: [], alive: true },
    purse: 200,
    temperament: { disposition: 50, honesty: 50, alignment: 50, randomness: 0 },
    social: { societyRank: 'commoner', peerRank: 50, reputation: 50 },
    occupation: { title: 'blacksmith', workplace: 'the village forge', role: 'owner', experience: 60, workEthic: 80, weeklyWage: 86 },
    relationships: [{ name: 'Elsa', kind: 'spouse', affinity: 70 }],
    affiliations: [{ name: 'Chapel of Dawn', kind: 'church', standing: 50 }],
    creature: null,
    abilities: [{ name: 'Iron grip', description: 'Never drops what he holds.' }],
    routine: { workDaysPerWeek: 6, tavernEveningsPerWeek: 2, familyEveningsPerWeek: 3, worshipDay: 0 },
    livedUntil: '1200-01-01',
    lifeLog: [{ at: '1200-01-01', kind: 'created', summary: 'Bram entered the world\'s records.' }],
    ...overrides,
  };
}
