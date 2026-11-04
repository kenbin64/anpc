import { changeField, changeFieldInto, recordEvent } from './life-log';
import { Classification, Extra, FieldChange, Npc, RelationKind } from './npc.model';
import { generateNpc } from './npc-generator';
import { ageForward } from './lifespan';
import { Dice } from './random';
import { StoryWriter } from './story-writers';

/**
 * EXTRAS and PROMOTION: the people in the background, and how they step forward.
 *
 * registerExtras() turns the people an NPC talks about into extras, so the village knows they exist.
 * createCrowd() makes faces to fill a room, with no AI at all. promoteExtra() is the moment someone
 * chooses to deal with an extra: the AI writes a full NPC whose story fits what's already known, the
 * name and species stay as they were, and the ties run both ways. linkPromotion() then points everyone who
 * knew the extra at the new NPC.
 */

/** How a tie looks from the other side: if Bram's child is Wren, then Wren's parent is Bram. */
const RECIPROCAL: Record<RelationKind, RelationKind> = {
  spouse: 'spouse', child: 'parent', parent: 'child', sibling: 'sibling', relative: 'relative',
  friend: 'friend', enemy: 'enemy', rival: 'rival', customer: 'vendor', vendor: 'customer',
  employer: 'employee', employee: 'employer', acquaintance: 'acquaintance',
};

const FAMILY: readonly RelationKind[] = ['spouse', 'child', 'parent', 'sibling', 'relative'];

const CROWD_FIRST_NAMES = [
  'Alda', 'Bertram', 'Cecily', 'Dunstan', 'Edda', 'Fulk', 'Gilda', 'Hamon', 'Isolde', 'Jory',
  'Kendra', 'Lambert', 'Maud', 'Nyle', 'Osric', 'Petra', 'Quill', 'Rowena', 'Simkin', 'Tilda', 'Ulric', 'Wynn',
];
const CROWD_TRADES = ['farmhand', 'carter', 'washerwoman', 'cooper', 'tanner', 'shepherd', 'chandler', 'weaver', 'fisher'];

/** Family of nobles are nobles. Everyone else steps forward as a gentleman, the plain townsfolk class. */
function chooseClassification(knower: Npc, kind: RelationKind): Classification {
  const isCreature = knower.classification === 'monster' || knower.classification === 'animal';
  return FAMILY.includes(kind) && !isCreature ? knower.classification : 'gentleman';
}

/** Who an NPC is, in a few words, for anyone else's story that mentions them. */
function describeNpc(npc: Npc): string {
  const work = npc.occupation ? `, ${npc.occupation.title} at ${npc.occupation.workplace}` : '';
  return `a ${npc.age}-year-old ${npc.species} ${npc.classification}${work}`;
}

/** Makes an extra for every tie that isn't yet a full NPC or an extra, and marks the tie with its id. */
export function registerExtras(npc: Npc, at: string): { npc: Npc; extras: Extra[] } {
  let current = npc;
  const extras: Extra[] = [];
  const changes: FieldChange[] = [];
  npc.relationships.forEach((tie, index) => {
    if (!tie.npcId && !tie.extraId) {
      const extra: Extra = {
        id: `${npc.id}-x${index}`,
        name: tie.name,
        species: npc.species,
        description: `${npc.name}'s ${tie.kind}${tie.notes ? `, ${tie.notes}` : ''}`,
        classification: chooseClassification(npc, tie.kind),
        knownBy: [{ npcId: npc.id, npcName: npc.name, npcDescription: describeNpc(npc), kind: tie.kind, notes: tie.notes }],
      };
      const linked = changeFieldInto(current, `relationships.${index}.extraId`, extra.id, `${tie.name} exists in the world as an extra`);
      current = linked.npc;
      changes.push(linked.change);
      extras.push(extra);
    }
  });
  const logged = changes.length
    ? recordEvent(current, { at, kind: 'change', summary: 'The people they know were entered into the world as extras.', changes })
    : current;
  return { npc: logged, extras };
}

/** Faces to fill a room. No AI, no simulation, just names and a line each. */
export function createCrowd(count: number, place: string, species: string, dice: Dice, idPrefix: string): Extra[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${idPrefix}-crowd${index}`,
    name: dice.pick(CROWD_FIRST_NAMES),
    species,
    description: `a ${dice.pick(CROWD_TRADES)}, often seen at ${place}`,
    classification: 'gentleman' as const,
    knownBy: [],
  }));
}

/** What the AI is told, so the new NPC's story agrees with everything already said about them. */
function describeForPromotion(extra: Extra): string {
  const known = extra.knownBy.map(link =>
    `${extra.name} is the ${link.kind} of ${link.npcName}, who is ${link.npcDescription}${link.notes ? ` (${link.notes})` : ''}.`);
  return [`This character is ${extra.name}, a ${extra.species}, until now known only as ${extra.description}.`, ...known,
    'Their name, species and these ties are fixed facts; build their story around them.'].join(' ');
}

/** Turns an extra into a full NPC whose story fits what's known, with ties back to everyone who knew them. */
export async function promoteExtra(extra: Extra, writeStory: StoryWriter, setting: string, at: string): Promise<Npc> {
  const generated = await generateNpc(
    { classification: extra.classification, setting, hints: describeForPromotion(extra), seed: extra.id },
    writeStory,
    at,
  );
  const knownNames = new Set(extra.knownBy.map(link => link.npcName));
  const tiesBack = extra.knownBy.map(link => ({
    name: link.npcName, kind: RECIPROCAL[link.kind], npcId: link.npcId,
    affinity: link.kind === 'enemy' || link.kind === 'rival' ? 25 : 70, notes: link.notes,
  }));
  const gameYearsSinceBirth = extra.bornOn ? Math.floor((Date.parse(at) - Date.parse(extra.bornOn)) / 31_557_600_000) : null;
  const age = gameYearsSinceBirth === null ? generated.age : ageForward(0, gameYearsSinceBirth);
  const promoted: Npc = {
    ...generated,
    id: extra.id,
    name: extra.name,
    species: extra.species,
    age,
    lifeExpectancy: Math.max(generated.lifeExpectancy, age + 10),
    relationships: [...tiesBack, ...generated.relationships.filter(tie => !knownNames.has(tie.name))],
    lifeLog: [{ at, kind: 'created', summary: `${extra.name} stepped into the story. Until now they were known only as ${extra.description}.` }],
  };
  return promoted;
}

/** Points an NPC's tie at the newly promoted NPC, so both sides now know each other as full NPCs. */
export function linkPromotion(knower: Npc, promoted: Npc, at: string): Npc {
  const index = knower.relationships.findIndex(tie => tie.extraId === promoted.id);
  return index < 0
    ? knower
    : changeField(knower, `relationships.${index}.npcId`, promoted.id, `${promoted.name} stepped into the story as a full character`, at);
}
