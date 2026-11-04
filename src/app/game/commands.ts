/**
 * LAYER 4, THE COMMANDS: what a player can type, turned into something the game understands.
 *
 * This is plain TypeScript with no Angular in it, because reading a sentence is pure logic: text in,
 * a Command out. That makes it the easiest part of the game to test. The player writes naturally, and a
 * few patterns cover the ways people tend to say each thing:
 *
 *   look                       who and what is around you
 *   who                        everyone you know of
 *   where is Bram              where someone is and what they're doing
 *   go to the forge            walk somewhere (an hour passes)
 *   talk to Bram: Good day     speak to someone who's here
 *   say Good day               speak to whoever you spoke to last
 *   send for Bram              have someone fetch them to you
 *   pay Bram 20                pay someone who's here, in copper
 *   wait 3                     let hours pass
 *   recap                      what's happened lately
 *   help                       this list
 */

export type Command =
  | { kind: 'help' }
  | { kind: 'look' }
  | { kind: 'who' }
  | { kind: 'where'; name: string }
  | { kind: 'go'; place: string }
  | { kind: 'talk'; name: string; message: string }
  | { kind: 'say'; message: string }
  | { kind: 'send'; name: string }
  | { kind: 'pay'; name: string; amount: number }
  | { kind: 'wait'; hours: number }
  | { kind: 'recap' }
  | { kind: 'unknown'; text: string };

interface Pattern {
  match: RegExp;
  build: (parts: string[]) => Command;
}

/** Tried in order; the first that matches wins. Each one names its pieces with a capture group. */
const PATTERNS: Pattern[] = [
  { match: /^(help|\?|commands)$/i, build: () => ({ kind: 'help' }) },
  { match: /^(look|look around|l)$/i, build: () => ({ kind: 'look' }) },
  { match: /^(who|people|who do i know)$/i, build: () => ({ kind: 'who' }) },
  { match: /^(recap|news|what happened)$/i, build: () => ({ kind: 'recap' }) },
  { match: /^where(?: is| are|'s)? (.+?)\??$/i, build: ([name]) => ({ kind: 'where', name }) },
  { match: /^(?:go|walk|travel|head)(?: to)? (.+)$/i, build: ([place]) => ({ kind: 'go', place }) },
  { match: /^(?:talk|speak)(?: to| with)? (.+?)\s*[:,]\s*(.+)$/i, build: ([name, message]) => ({ kind: 'talk', name, message }) },
  { match: /^(?:say|tell them|reply)\s+(.+)$/i, build: ([message]) => ({ kind: 'say', message }) },
  { match: /^(?:send for|fetch|summon) (.+)$/i, build: ([name]) => ({ kind: 'send', name }) },
  { match: /^pay (.+?) (\d+)(?: copper)?$/i, build: ([name, amount]) => ({ kind: 'pay', name, amount: Number(amount) }) },
  { match: /^wait(?: for)?(?: (\d+))?(?: hours?)?$/i, build: ([hours]) => ({ kind: 'wait', hours: Math.min(24, Number(hours ?? 1)) }) },
];

/** Strips a leading "the" from a name or place, so "the innkeeper" and "innkeeper" read the same. */
export function stripArticle(text: string): string {
  return text.trim().replace(/^the\s+/i, '');
}

export function parseCommand(text: string): Command {
  const trimmed = text.trim();
  const pattern = PATTERNS.find(candidate => candidate.match.test(trimmed));
  return pattern ? pattern.build(trimmed.match(pattern.match)!.slice(1)) : { kind: 'unknown', text: trimmed };
}

export const HELP_TEXT = [
  'look: who and what is around you',
  'who: everyone you know of',
  'where is <name>: where someone is and what they are doing',
  'go to <place>: walk somewhere (an hour passes)',
  'talk to <name>: <what you say>: speak to someone who is here',
  'say <what you say>: speak to whoever you spoke to last',
  'send for <name>: have someone fetch them to you',
  'pay <name> <copper>: pay someone who is here',
  'wait <hours>: let time pass',
  'recap: what has happened lately',
];
