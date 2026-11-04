import { calculateWeeklyWage } from './economy';
import { promoteExtra } from './extras';
import { Extra, Npc } from './npc.model';
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
  /** Set when the role went to an extra people already knew of, such as the baker's rival "Edwin the miller". */
  promotedExtraId?: string;
}

/**
 * Finds an extra who already is this role holder in someone's story: the role's title appears in their
 * name, their description or the notes about them. "Miller Edwin, Godric's rival" is the miller.
 */
function findExtraInRole(title: string, extras: readonly Extra[]): Extra | undefined {
  const pattern = new RegExp(`\\b${title}\\b`, 'i');
  return extras.find(extra =>
    pattern.test(`${extra.name} ${extra.description} ${extra.knownBy.map(link => link.notes ?? '').join(' ')}`));
}

/**
 * Brings a role's holder into the story: creates them the first time, returns the same person after.
 *
 * If someone's story already names the holder (an extra such as "Edwin, the miller I quarrel with"), that
 * extra is promoted into the role instead of a new person being invented. Otherwise two millers would
 * exist: the one the baker talks about and the one the player meets. A live playtest showed exactly that.
 */
export async function summonRoleHolder(
  settlement: Settlement, title: string, writeStory: StoryWriter, at: string, worldSeed = '', avoidNames: string[] = [],
  knownExtras: readonly Extra[] = [],
): Promise<Summoned> {
  const index = settlement.roles.findIndex(role => role.title === title);
  if (index < 0) {
    throw new Error(`${settlement.name} has no ${title}. Its roles are: ${settlement.roles.map(role => role.title).join(', ')}.`);
  }
  const role = settlement.roles[index];
  let result: Summoned = { settlement, newNpc: null, holderId: role.heldBy ?? '' };
  if (!role.heldBy) {
    const knownHolder = findExtraInRole(title, knownExtras);
    const setting = `${settlement.name}, a ${settlement.size} in ${settlement.setting}`;
    const generated = knownHolder
      ? await promoteExtra({ ...knownHolder, description: `${knownHolder.description}; the ${title} of ${settlement.name}` }, writeStory, setting, at)
      : await generateNpc({
          era: settlement.era,
          classification: role.classification,
          setting,
          hints: `This person is the ${title} of ${settlement.name} and works at ${role.workplace}. Their story must fit that office.`,
          seed: `${worldSeed}:${settlement.name}-${title}`,
          avoidNames,
        }, writeStory, at);
    const id = knownHolder?.id ?? `${settlement.name}-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
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
        summary: knownHolder
          ? `${generated.name} stepped into the story as the ${title} of ${settlement.name}, the one ${knownHolder.knownBy.map(link => link.npcName).join(' and ')} spoke of.`
          : `${generated.name} stepped into the story as the ${title} of ${settlement.name}. The office always existed; until now no one had needed them.`,
      }],
    };
    const roles = settlement.roles.map((existing, position) => (position === index ? { ...existing, heldBy: id } : existing));
    result = { settlement: { ...settlement, roles }, newNpc: holder, holderId: id, promotedExtraId: knownHolder?.id };
  }
  return result;
}
