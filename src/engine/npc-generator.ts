import { isCreatureClass, rollNumbers } from './archetypes';
import { WEEKLY_LIVING_COST, calculateWeeklyWage, rollStartingPurse } from './economy';
import { NPC_SCHEMA_VERSION, Npc, Occupation, WorkRole } from './npc.model';
import { Dice, createDice } from './random';
import { rollLifeExpectancy } from './lifespan';
import { Story, shapeStory } from './story';
import { NpcRequest, buildStoryPrompt } from './story-prompt';
import { StoryWriter } from './story-writers';

/**
 * THE GENERATOR: makes a complete NPC in three steps.
 *
 * 1. Code rolls every number from the classification and the seed.
 * 2. The AI writes the story to fit those numbers, through whichever StoryWriter is plugged in.
 * 3. Code checks the story, fills in the numbers the story needs (experience, work ethic, standings),
 *    and opens the life log with a "created" entry, so the history starts on day one.
 */

function hashToNumber(seed: string): number {
  let hash = 0;
  for (const character of seed) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

/** The numbers a job needs, rolled by code: experience from age, a work ethic, and the wage that follows. */
export function buildOccupation(job: { title: string; workplace: string; role: WorkRole }, age: number, dice: Dice): Occupation {
  const experience = Math.min(100, Math.max(0, (age - 14) * 3 + dice.rollBetween(-10, 10)));
  return { ...job, experience, workEthic: dice.rollBetween(10, 95), weeklyWage: calculateWeeklyWage(job.role, experience) };
}

/** Spare first names, split so a swapped name fits the character the story describes. */
const SPARE_FIRST_NAMES: Record<'he' | 'she', string[]> = {
  he: ['Aldous', 'Corwin', 'Edric', 'Gareth', 'Ivo', 'Kenric', 'Merrick', 'Oswin', 'Randal', 'Tancred', 'Vane', 'Yorick', 'Bartram', 'Lionel'],
  she: ['Bryony', 'Delphine', 'Fenella', 'Hester', 'Juliana', 'Linnet', 'Nesta', 'Philippa', 'Sabine', 'Ursula', 'Winifred', 'Zelda', 'Agatha', 'Mabel'],
};

/** Reads whether the backstory calls the character "he" or "she", by which pronouns it uses more. */
function readPronoun(backstory: string): 'he' | 'she' {
  const count = (pattern: RegExp) => (backstory.match(pattern) ?? []).length;
  return count(/\b(she|her|hers|herself)\b/gi) > count(/\b(he|him|his|himself)\b/gi) ? 'she' : 'he';
}

const SPARE_FAMILY_NAMES = [
  'Ashdown', 'Bramwell', 'Colter', 'Dunmore', 'Everard', 'Fairweather', 'Greaves', 'Hollins', 'Ingram', 'Kettering',
  'Lacey', 'Marsh', 'Northcott', 'Oakes', 'Pennington', 'Quarry', 'Radley', 'Sutton', 'Thorne', 'Underhill', 'Weller',
];

/** Swaps a name for another in a piece of text, whole words only. */
function swapWord(text: string, from: string, to: string): string {
  return from === to ? text : text.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
}

/**
 * Makes sure a new character doesn't take a name already used in the world. Asking the model isn't
 * enough; small models reuse favorite names. A taken first name gets swapped for an unused one. A family
 * name already in use gets swapped too, because people who share a family name should be family, and
 * these strangers aren't. The backstory is updated to match, so the story still reads right.
 */
function giveUniqueName(story: Story, takenNames: readonly string[], dice: Dice): Story {
  const takenFirst = new Set(takenNames.map(name => name.split(/\s+/)[0].toLowerCase()));
  const takenFamily = new Set(takenNames.map(name => name.split(/\s+/).slice(1).join(' ').toLowerCase()).filter(Boolean));
  const [firstName, ...familyParts] = story.name.split(/\s+/);
  const familyName = familyParts.join(' ');
  const freeFirst = SPARE_FIRST_NAMES[readPronoun(story.backstory)].filter(name => !takenFirst.has(name.toLowerCase()));
  const freeFamily = SPARE_FAMILY_NAMES.filter(name => !takenFamily.has(name.toLowerCase()));
  const newFirst = takenFirst.has(firstName.toLowerCase()) && freeFirst.length ? dice.pick(freeFirst) : firstName;
  const newFamily = familyName && takenFamily.has(familyName.toLowerCase()) && freeFamily.length ? dice.pick(freeFamily) : familyName;
  return {
    ...story,
    name: [newFirst, newFamily].filter(Boolean).join(' '),
    backstory: swapWord(swapWord(story.backstory, firstName, newFirst), familyName, newFamily),
  };
}

export async function generateNpc(request: NpcRequest, writeStory: StoryWriter, startDate: string): Promise<Npc> {
  const dice = createDice(request.seed);
  const numbers = rollNumbers(request.classification, dice);
  const isCreature = isCreatureClass(request.classification);
  const rolledAge = request.age ?? dice.rollBetween(18, 65);
  const prompt = buildStoryPrompt({ ...request, age: isCreature ? undefined : rolledAge }, numbers, isCreature);
  const written = shapeStory(await writeStory(prompt, hashToNumber(request.seed)), isCreature);
  const story = giveUniqueName({ ...written, age: isCreature ? written.age : rolledAge }, request.avoidNames ?? [], dice);
  const lifeExpectancy = Math.max(rollLifeExpectancy(isCreature ? 'beast' : story.species, dice), story.age + dice.rollBetween(3, 12));

  const npc: Npc = {
    schemaVersion: NPC_SCHEMA_VERSION,
    id: `npc-${hashToNumber(`${request.seed}:${story.name}`).toString(36)}`,
    name: story.name,
    species: story.species,
    age: story.age,
    lifeExpectancy,
    classification: request.classification,
    maritalStatus: story.maritalStatus,
    backstory: story.backstory,
    stats: numbers.stats,
    health: { condition: dice.rollBetween(75, 100), ailments: [], alive: true },
    purse: isCreature ? 0 : story.inDebt
      ? -WEEKLY_LIVING_COST[numbers.social.societyRank] * dice.rollBetween(2, 8)
      : rollStartingPurse(numbers.social.societyRank, dice),
    temperament: numbers.temperament,
    social: numbers.social,
    occupation: story.occupation ? buildOccupation(story.occupation, story.age, dice) : null,
    relationships: story.relationships,
    affiliations: story.affiliations.map(group => ({ ...group, standing: dice.rollBetween(20, 80) })),
    creature: story.creature,
    abilities: story.abilities,
    routine: story.routine,
    livedUntil: startDate,
    lifeLog: [],
  };
  return { ...npc, lifeLog: [{ at: startDate, kind: 'created', summary: `${npc.name} entered the world's records.` }] };
}
