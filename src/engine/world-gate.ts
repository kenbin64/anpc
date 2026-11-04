import { ERA_PROFILES, EraName, META_TERMS } from './world-setup';

/**
 * THE WORLD GATE: decides whether something a human player said belongs in the game world.
 *
 * Human players are real people, so their words can bring in things the world doesn't have, or try to
 * talk the AI out of its role. What counts as outside depends on the ERA: a phone is ordinary in a modern
 * town and nonsense in a medieval village. Talk about the game itself or the AI is outside in EVERY era.
 *
 * This gate finds those words with plain code before any AI sees them, and the out-of-world words are
 * NEVER passed to the model. The NPC only learns that the stranger said something it couldn't understand.
 * So nothing from outside leaks in, and a player can't steer the model with it.
 *
 * Word lists can't catch everything, so the model is also told to treat anything outside its world as
 * nonsense, and its reply is checked again on the way out (see conversation.ts).
 */

export interface GateResult {
  /** True when the whole message belongs in the world. */
  inWorld: boolean;
  /** The out-of-world words that were found, for the game's own records. Never sent to the AI. */
  strangeWords: string[];
  /** The message with every out-of-world part replaced, safe to show the AI. */
  heardAs: string;
  /** How much of the message was strange, 0 to 100. */
  strangeness: number;
}

const STRANGE_PLACEHOLDER = '[strange words]';

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Checks one message from a human player against the world of the given era. */
export function checkAgainstWorld(message: string, era: EraName = 'medieval'): GateResult {
  const profile = ERA_PROFILES[era];
  const strangeWords: string[] = [];
  let heardAs = message;
  for (const term of [...META_TERMS, ...profile.outOfWorldTerms]) {
    // Plurals count too: "credit card" also catches "credit cards", "phone" catches "phones".
    const termPattern = new RegExp(`\\b${escapeForRegex(term)}(?:s|es)?\\b`, 'gi');
    if (termPattern.test(heardAs)) {
      strangeWords.push(term);
      heardAs = heardAs.replace(termPattern, STRANGE_PLACEHOLDER);
    }
  }
  for (const pattern of profile.outOfWorldPatterns) {
    const globalPattern = new RegExp(pattern.source, `${pattern.flags.replace('g', '')}g`);
    const found = heardAs.match(globalPattern) ?? [];
    strangeWords.push(...found);
    heardAs = heardAs.replace(globalPattern, STRANGE_PLACEHOLDER);
  }
  const totalWords = Math.max(1, message.split(/\s+/).filter(Boolean).length);
  const strangeness = Math.min(100, Math.round((strangeWords.length / totalWords) * 300));
  return { inWorld: strangeWords.length === 0, strangeWords, heardAs, strangeness };
}

/** True if text the AI wrote for an NPC mentions anything outside the world. Used to check replies. */
export function mentionsOutsideWorld(reply: string, era: EraName = 'medieval'): boolean {
  return !checkAgainstWorld(reply, era).inWorld;
}
