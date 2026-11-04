/**
 * THE CONDUCT GUARD: what this simulation never allows, whatever the era or the story.
 *
 * Ordinary combat is part of play: fists, swords, brawls, duels, even a death in battle. What is never
 * allowed is sexual content of any kind, sexual violence, and cruelty beyond normal fighting, such as
 * torture or mutilation.
 *
 * When a player's message crosses that line, it is stopped before anything else happens. The AI never
 * sees it, no NPC hears it, nothing is written to any life log, and no trust or reputation changes. The
 * player just gets a plain warning. The same check runs on everything the AI writes, so the model can't
 * cross the line either.
 *
 * Like the world gate, a word list can't catch every phrasing. The writer's note in every prompt (see
 * FICTION_FRAME) tells the model the same rules, as a second line of defense.
 */

export type ConductProblem = 'sexual' | 'sexual-violence' | 'cruelty';

const BLOCKED_TERMS: Record<ConductProblem, string[]> = {
  'sexual-violence': [
    'rape', 'raped', 'raping', 'rapes', 'rapist', 'sexual assault', 'sexually assault', 'sexually assaulted',
    'molest', 'molested', 'molesting', 'molester', 'force himself on', 'force herself on', 'forced himself on',
    'forced herself on', 'have my way with', 'defile her', 'defile him', 'ravish', 'ravished',
  ],
  'sexual': [
    'sex', 'sexual', 'sexually', 'nude', 'nudity', 'porn', 'orgasm', 'erotic', 'genitals', 'penis', 'vagina',
    'breasts', 'undress', 'undressing', 'strip naked', 'make love', 'sleep with me', 'bed her', 'bed him', 'seduce',
    'lust', 'lustful', 'fondle', 'grope', 'groping', 'whore', 'brothel', 'harlot',
  ],
  'cruelty': [
    'torture', 'tortured', 'torturing', 'mutilate', 'mutilated', 'mutilating', 'dismember', 'dismembered', 'flay',
    'flayed', 'skin him alive', 'skin her alive', 'gouge out', 'disembowel', 'disemboweled', 'burn alive',
    'burned alive', 'eat his flesh', 'eat her flesh', 'cannibal', 'torment the child', 'beat the child', 'abuse the child',
  ],
};

export const CONDUCT_WARNING =
  'This simulation does not allow sexual or explicit content, sexual violence, or cruelty beyond normal play. ' +
  'That was not sent, and nothing about it was recorded.';

export interface ConductResult {
  allowed: boolean;
  problem: ConductProblem | null;
}

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Checks text against what the simulation never allows. Sexual violence is checked first. */
export function checkConduct(text: string): ConductResult {
  const order: ConductProblem[] = ['sexual-violence', 'sexual', 'cruelty'];
  const problem = order.find(category =>
    BLOCKED_TERMS[category].some(term => new RegExp(`\\b${escapeForRegex(term)}\\b`, 'i').test(text))) ?? null;
  return { allowed: problem === null, problem };
}
