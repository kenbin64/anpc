import { RolledNumbers } from './archetypes';
import { Classification } from './npc.model';
import { ERA_PROFILES, EraName } from './world-setup';

/**
 * THE PROMPT: what the AI is told before it writes a character.
 *
 * The rolled numbers go in first, described in words, so the story has to fit them: a character rolled
 * at honesty 12 gets a past that explains it. The prompt asks for a life that is already in motion, with
 * a job, family, friends, enemies and habits, because those are what the life simulator runs on.
 */

export interface NpcRequest {
  classification: Classification;
  /** The world they live in, such as "a small farming village in a cold northern valley". */
  setting: string;
  /** Anything the designer wants, such as "a widowed baker with a grudge against the miller". */
  hints: string;
  /** The same seed gives the same numbers and, with a local model, a very similar story. */
  seed: string;
  /** The time period. Medieval when left out. */
  era?: EraName;
}

export interface PromptMessage {
  role: 'system' | 'user';
  content: string;
}

function describeDial(value: number, low: string, high: string): string {
  const leaning = value >= 50 ? high : low;
  const strength = Math.abs(value - 50) >= 35 ? 'strongly' : Math.abs(value - 50) >= 15 ? 'fairly' : 'slightly';
  return `${strength} ${leaning} (${value}/100)`;
}

/**
 * Said to the MODEL as the writer, never in a character's voice. Characters still don't know they're in a
 * game. This only tells the writer that fights, crime and cruelty are part of the play: nobody real is
 * hurt, so the model shouldn't refuse or soften them, and it keeps them free of gore.
 */
export const FICTION_FRAME =
  'This is fiction for a game. Ordinary conflict, crime and combat are part of the play and harm no one real; ' +
  'write them plainly when the story calls for them, without gore. Never write sexual content of any kind, ' +
  'sexual violence, or cruelty beyond ordinary fighting, such as torture or mutilation.';

export function buildStoryPrompt(request: NpcRequest, numbers: RolledNumbers, isCreature: boolean): PromptMessage[] {
  const { temperament, social, stats } = numbers;
  const system = [
    'You create non-player characters for games. Each one must feel like a real life already in progress.',
    FICTION_FRAME,
    `Answer only with JSON that matches the given schema. ${ERA_PROFILES[request.era ?? 'medieval'].styleGuide}`,
    'The backstory is 3 to 5 sentences and must explain the character\'s temperament and standing.',
    'Give them 2 to 6 relationships (family where it fits, plus friends, enemies, rivals or customers),',
    '0 to 3 affiliations (church, guild, club or tavern) and 1 to 3 special abilities that suit them.',
    'Affinity is 0 for hatred up to 100 for love. Routine counts are per week, 0 to 7. worshipDay is 0 to 6',
    '(0 is Sunday) or -1 if they do not worship.',
    isCreature
      ? 'This is a creature: occupation must be null, and fill in creature with canSpeak, social, and 0 to 100 values for intellect (instinct to intelligent), domestication (wild to tame) and benevolence (malevolent to benevolent, 50 is benign).'
      : 'This is a person: creature must be null.',
  ].join(' ');
  const user = [
    `Classification: ${request.classification}.`,
    `Setting: ${request.setting || `a small ${request.era ?? 'medieval'} village`}.`,
    request.hints ? `Designer notes: ${request.hints}.` : '',
    `Their nature, already decided by dice:`,
    `disposition ${describeDial(temperament.disposition, 'violent', 'rational')},`,
    `${describeDial(temperament.honesty, 'dishonest', 'honest')},`,
    `${describeDial(temperament.alignment, 'evil', 'good')},`,
    `${describeDial(temperament.randomness, 'predictable', 'unpredictable')}.`,
    `Social rank in society: ${social.societyRank}. Standing among peers: ${social.peerRank}/100. Reputation: ${social.reputation}/100.`,
    `Stats (3 to 18): strength ${stats.strength}, dexterity ${stats.dexterity}, constitution ${stats.constitution},`,
    `intelligence ${stats.intelligence}, wisdom ${stats.wisdom}, charisma ${stats.charisma}.`,
  ].filter(Boolean).join(' ');
  return [{ role: 'system', content: system }, { role: 'user', content: user }];
}
