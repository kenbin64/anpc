import { isCreatureClass, rollNumbers } from './archetypes';
import { NPC_SCHEMA_VERSION, Npc } from './npc.model';
import { createDice } from './random';
import { shapeStory } from './story';
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

export async function generateNpc(request: NpcRequest, writeStory: StoryWriter, startDate: string): Promise<Npc> {
  const dice = createDice(request.seed);
  const numbers = rollNumbers(request.classification, dice);
  const isCreature = isCreatureClass(request.classification);
  const story = shapeStory(await writeStory(buildStoryPrompt(request, numbers, isCreature), hashToNumber(request.seed)), isCreature);

  const npc: Npc = {
    schemaVersion: NPC_SCHEMA_VERSION,
    id: `npc-${hashToNumber(`${request.seed}:${story.name}`).toString(36)}`,
    name: story.name,
    species: story.species,
    age: story.age,
    classification: request.classification,
    maritalStatus: story.maritalStatus,
    backstory: story.backstory,
    stats: numbers.stats,
    health: { condition: dice.rollBetween(75, 100), ailments: [], alive: true },
    temperament: numbers.temperament,
    social: numbers.social,
    occupation: story.occupation
      ? {
          ...story.occupation,
          experience: Math.min(100, Math.max(0, (story.age - 14) * 3 + dice.rollBetween(-10, 10))),
          workEthic: dice.rollBetween(10, 95),
        }
      : null,
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
