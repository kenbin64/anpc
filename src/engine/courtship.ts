import { recordEvent, shiftDial } from './life-log';
import { Npc } from './npc.model';
import { Dice } from './random';
import { Suitor } from './marriage';

/**
 * COURTSHIP: affection has to be earned, because an ANPC chooses for themselves.
 *
 * Every ANPC, man or woman, can accept or reject a suitor. A suitor courts them over time with small
 * gestures, and each gesture lands or doesn't by the ANPC's own nature and how they already feel. Warm
 * gestures that land raise affection; ones that miss cool it a little. Only real affection, built this
 * way, makes a proposal likely to be accepted (see marriage.ts).
 *
 * An ANPC who is married, or who dislikes the suitor, is not open to courting. Gestures then make it
 * clear they aren't interested, and keeping on after that costs the suitor more each time. No means no.
 */

export type Gesture = 'kind words' | 'a small gift' | 'a helping hand' | 'a walk together' | 'a song';

/** Below this, the ANPC is not open to being courted by this suitor at all. */
const LEAST_AFFINITY_TO_COURT = 25;

export interface CourtshipResult {
  npc: Npc;
  /** True when the gesture was welcome and affection grew. */
  welcomed: boolean;
  /** True when the ANPC isn't open to courtship from this suitor. */
  notInterested: boolean;
}

function findTieIndex(npc: Npc, suitor: Suitor): number {
  return npc.relationships.findIndex(tie =>
    (suitor.npcId !== undefined && tie.npcId === suitor.npcId) ||
    (suitor.playerId !== undefined && tie.playerId === suitor.playerId));
}

export function court(npc: Npc, suitor: Suitor, gesture: Gesture, dice: Dice, at: string): CourtshipResult {
  const tieIndex = findTieIndex(npc, suitor);
  const affinity = tieIndex >= 0 ? npc.relationships[tieIndex].affinity : 50;
  const notInterested = npc.maritalStatus === 'married' || affinity < LEAST_AFFINITY_TO_COURT;
  const welcomeChance = Math.round(30 + affinity * 0.5 + (npc.temperament.alignment - 50) * 0.2);
  const welcomed = !notInterested && dice.happens(welcomeChance);
  const field = `relationships.${tieIndex}.affinity`;

  let result = npc;
  if (tieIndex < 0) {
    result = recordEvent(npc, { at, kind: 'social', summary: `${suitor.name}, a stranger, offered ${gesture}. ${npc.name} kept their distance.` });
  } else if (notInterested) {
    result = shiftDial(
      recordEvent(npc, { at, kind: 'social', summary: `${suitor.name} offered ${gesture}. ${npc.name} made it clear they were not interested.` }),
      field, -5, `Unwanted attention from ${suitor.name}`, at,
    );
  } else if (welcomed) {
    result = shiftDial(npc, field, dice.rollBetween(3, 8), `${suitor.name}'s ${gesture} was welcome`, at);
  } else {
    result = shiftDial(npc, field, -2, `${suitor.name}'s ${gesture} fell flat`, at);
  }
  return { npc: result, welcomed, notInterested: tieIndex >= 0 && notInterested };
}
