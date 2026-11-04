import { changeFieldInto, recordEvent } from './life-log';
import { Extra, Npc } from './npc.model';
import { Dice } from './random';

/**
 * BIRTHS: married couples may have children in the natural course of life.
 *
 * It happens off screen and is recorded plainly: "A child, Maud Fletcher, was born." Nothing about how is
 * ever described or acted out. The newborn arrives as an EXTRA, known to the parents by name, and becomes
 * a full ANPC only if the story brings them into a scene, the same as any other extra.
 *
 * Chances are weekly and modest: only married NPCs aged 18 to 45, less likely with each child already in
 * the family, and never within about fifteen months of the last child. When both parents are full NPCs,
 * the couple is counted once and the child is tied to both.
 */

const CHILD_NAMES = [
  'Alda', 'Bertram', 'Cecily', 'Dunstan', 'Edda', 'Fulk', 'Gilda', 'Hamon', 'Isolde', 'Jory', 'Kendra',
  'Lambert', 'Maud', 'Nyle', 'Osric', 'Petra', 'Rowena', 'Simkin', 'Tilda', 'Ulric', 'Wynn', 'Agnes', 'Piers',
];

/** The weekly chance of a birth, in percent: about one child every two years for a young couple. */
const WEEKLY_BIRTH_CHANCE = 1;

/** The least time between one child and the next, in days: about fifteen months. */
const DAYS_BETWEEN_CHILDREN = 456;

/** True if this parent had a child too recently for another. */
function hadChildRecently(npc: Npc, at: string): boolean {
  const lastBirth = [...npc.lifeLog].reverse().find(event => event.kind === 'family' && event.summary.startsWith('A child,'));
  return lastBirth !== undefined && (Date.parse(at) - Date.parse(lastBirth.at)) / 86_400_000 < DAYS_BETWEEN_CHILDREN;
}

function isOfAge(npc: Npc): boolean {
  return npc.health.alive && npc.maritalStatus === 'married' && npc.age >= 18 && npc.age <= 45 && npc.creature === null;
}

function countChildren(npc: Npc): number {
  return npc.relationships.filter(tie => tie.kind === 'child').length;
}

/** The family name, taken from the last word of a parent's name when they have one. */
function familyName(npc: Npc): string {
  const parts = npc.name.trim().split(/\s+/);
  return parts.length > 1 ? ` ${parts[parts.length - 1]}` : '';
}

/** Ties a newborn to a parent and logs it as a family event. */
function welcomeChild(parent: Npc, child: Extra, at: string): Npc {
  const updated = changeFieldInto(
    parent, 'relationships', [...parent.relationships, { name: child.name, kind: 'child' as const, affinity: 90, extraId: child.id }],
    `A child, ${child.name}, was born`,
  );
  return recordEvent(updated.npc, { at, kind: 'family', summary: `A child, ${child.name}, was born.`, changes: [updated.change] });
}

/**
 * Gives each married couple in the group its weekly chance of a child. Returns the group with the
 * births recorded on the parents, and the newborns as extras.
 */
export function welcomeBirths(people: readonly Npc[], dice: Dice, at: string): { people: Npc[]; newborns: Extra[] } {
  const updated = [...people];
  const newborns: Extra[] = [];
  people.forEach((parent, index) => {
    const spouseTie = parent.relationships.find(tie => tie.kind === 'spouse');
    const spouseIndex = spouseTie?.npcId ? people.findIndex(person => person.id === spouseTie.npcId) : -1;
    const countedByPartner = spouseIndex >= 0 && spouseIndex < index;
    const chance = WEEKLY_BIRTH_CHANCE / (1 + countChildren(parent));
    if (isOfAge(parent) && spouseTie && !countedByPartner && !hadChildRecently(parent, at) && dice.happens(chance)) {
      const child: Extra = {
        id: `${parent.id}-born-${at}`,
        name: `${dice.pick(CHILD_NAMES)}${familyName(parent)}`,
        species: parent.species,
        description: `the child of ${parent.name} and ${spouseTie.name}, born ${at}`,
        classification: parent.classification,
        bornOn: at,
        knownBy: [parent, ...(spouseIndex >= 0 ? [people[spouseIndex]] : [])].map(knower => ({
          npcId: knower.id, npcName: knower.name, kind: 'child' as const,
          npcDescription: `a ${knower.age}-year-old ${knower.species} ${knower.classification}`,
        })),
      };
      updated[index] = welcomeChild(updated[index], child, at);
      if (spouseIndex >= 0) updated[spouseIndex] = welcomeChild(updated[spouseIndex], child, at);
      newborns.push(child);
    }
  });
  return { people: updated, newborns };
}
