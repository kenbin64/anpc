import { calculateWeeklyWage } from './economy';
import { Npc } from './npc.model';
import { generateNpc } from './npc-generator';
import { StoryWriter } from './story-writers';
import { EraName, RoleTemplate, WorldScope, listImpliedRoles } from './world-setup';

/**
 * IMPLIED ROLES: offices a place has whether or not anyone has met the person in them.
 *
 * Every town has a mayor and a constable, a priest and an innkeeper. Until the story needs one, they are
 * only a line in the town's list of roles: no record, no life to simulate, no cost. The first time a
 * player or an NPC deals with the constable, summonRoleHolder() creates them, a full NPC built to fit the
 * office, and the role remembers who holds it. Every later call returns that same person.
 *
 * This is one step lighter than an extra. An extra is a known person ("Bram's wife, Elsa"). An implied
 * role is only a known job ("whoever the constable is").
 */

/** Kept as a name for older code; a settlement's size is its world scope. */
export type SettlementSize = WorldScope;

export interface RoleSlot extends RoleTemplate {
  /** The id of the NPC who holds it, once they've been needed. Empty until then. */
  heldBy?: string;
}

export interface Settlement {
  name: string;
  size: WorldScope;
  era: EraName;
  /** The world it sits in, passed to the AI, such as "a cold northern valley". */
  setting: string;
  roles: RoleSlot[];
}

/** A new place with every role its era and size imply (see world-setup.ts), all still unfilled. */
export function createSettlement(name: string, size: WorldScope, setting: string, era: EraName = 'medieval'): Settlement {
  return { name, size, era, setting, roles: listImpliedRoles(era, size) };
}

export interface Summoned {
  settlement: Settlement;
  /** The NPC newly created for the role, or null if someone already holds it. */
  newNpc: Npc | null;
  /** Who holds the role now. */
  holderId: string;
}

/** Brings a role's holder into the story: creates them the first time, returns the same person after. */
export async function summonRoleHolder(
  settlement: Settlement, title: string, writeStory: StoryWriter, at: string, worldSeed = '', avoidNames: string[] = [],
): Promise<Summoned> {
  const index = settlement.roles.findIndex(role => role.title === title);
  if (index < 0) {
    throw new Error(`${settlement.name} has no ${title}. Its roles are: ${settlement.roles.map(role => role.title).join(', ')}.`);
  }
  const role = settlement.roles[index];
  let result: Summoned = { settlement, newNpc: null, holderId: role.heldBy ?? '' };
  if (!role.heldBy) {
    const id = `${settlement.name}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const generated = await generateNpc({
      era: settlement.era,
      classification: role.classification,
      setting: `${settlement.name}, a ${settlement.size} in ${settlement.setting}`,
      hints: `This person is the ${title} of ${settlement.name} and works at ${role.workplace}. Their story must fit that office.`,
      seed: `${worldSeed}:${id}`,
      avoidNames,
    }, writeStory, at);
    const experience = generated.occupation?.experience ?? 50;
    const holder: Npc = {
      ...generated,
      id,
      occupation: {
        title, workplace: role.workplace, role: role.role, experience,
        workEthic: generated.occupation?.workEthic ?? 60, weeklyWage: calculateWeeklyWage(role.role, experience),
      },
      lifeLog: [{
        at, kind: 'created',
        summary: `${generated.name} stepped into the story as the ${title} of ${settlement.name}. The office always existed; until now no one had needed them.`,
      }],
    };
    const roles = settlement.roles.map((existing, position) => (position === index ? { ...existing, heldBy: id } : existing));
    result = { settlement: { ...settlement, roles }, newNpc: holder, holderId: id };
  }
  return result;
}
