import { ERA_PROFILES, EraName } from './world-setup';

/**
 * HOW A PLAYER IS HEARD: players speak plain modern English, and NPCs hear it in their own world's speech.
 *
 * A medieval blacksmith never hears "Hey guys, yeah, that's cool." He hears "Hail, friends, aye, that is
 * fine." The NPC never hears the player's real voice or way of writing, only what they meant, in words of
 * the NPC's own world. That keeps the world believable and keeps the real person out of it.
 *
 * This file swaps the common modern phrases with plain code, using the era's phrasebook. The AI is also
 * told that the stranger's words reach the NPC in their own tongue, which covers what the phrasebook
 * doesn't, and the NPC answers in their own accent. A voice player is heard the same way: speech becomes
 * text first, so the NPC never hears their real voice.
 */

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Keeps a capital letter where the player had one, so "Yeah" becomes "Aye". */
function matchCapital(original: string, replacement: string): string {
  const startsCapital = original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase();
  return startsCapital && replacement ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;
}

/** Turns a player's modern words into how an NPC of this era hears them. */
export function renderAsHeard(text: string, era: EraName = 'medieval'): string {
  const phrases = [...ERA_PROFILES[era].phrasebook].sort((first, second) => second[0].length - first[0].length);
  let heard = text;
  for (const [modern, inWorld] of phrases) {
    heard = heard.replace(new RegExp(`\\b${escapeForRegex(modern)}\\b`, 'gi'), found => matchCapital(found, inWorld));
  }
  return heard.replace(/\s+([,.!?])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}
