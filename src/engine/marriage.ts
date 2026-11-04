import { changeField, changeFieldInto, recordEvent } from './life-log';
import { Npc } from './npc.model';
import { Dice } from './random';

/**
 * MARRIAGE: an ANPC may marry another ANPC or a human player's character.
 *
 * In this simulation a marriage is a living arrangement: they share a home and a life, and the record
 * says so plainly. Nothing explicit is ever described or acted out; the conduct guard blocks it as it
 * always does. Two human players marrying each other is the game's own record, since players don't keep
 * life logs.
 *
 * An ANPC answers a proposal by how they feel about the suitor. Deep affection means yes. Fondness may
 * mean yes, depending on how unpredictable they are. Anything less, or already being married, means no.
 */

export interface Suitor {
  name: string;
  /** Set when the suitor is another ANPC. */
  npcId?: string;
  /** Set when the suitor is a human player's character. */
  playerId?: string;
}

const SURE_YES = 75;
const MAYBE_YES = 60;

function findTieIndex(npc: Npc, suitor: Suitor): number {
  return npc.relationships.findIndex(tie =>
    (suitor.npcId !== undefined && tie.npcId === suitor.npcId) ||
    (suitor.playerId !== undefined && tie.playerId === suitor.playerId));
}

export function proposeMarriage(npc: Npc, suitor: Suitor, dice: Dice, at: string): { npc: Npc; accepted: boolean } {
  const tieIndex = findTieIndex(npc, suitor);
  const affinity = tieIndex >= 0 ? npc.relationships[tieIndex].affinity : 0;
  const free = npc.health.alive && npc.maritalStatus !== 'married';
  const accepted = free && (affinity >= SURE_YES || (affinity >= MAYBE_YES && dice.happens(npc.temperament.randomness / 2)));
  const answered = accepted ? recordMarriage(npc, suitor, at) : recordEvent(npc, {
    at, kind: 'family', summary: `${suitor.name} asked for ${npc.name}'s hand, and ${npc.name} said no.`,
  });
  return { npc: answered, accepted };
}

/** Records a marriage as a shared home and life: marital status, the spouse tie, and one family entry. */
export function recordMarriage(npc: Npc, spouse: Suitor, at: string): Npc {
  const tieIndex = findTieIndex(npc, spouse);
  const married = changeField(npc, 'maritalStatus', 'married', `Married ${spouse.name}`, at);
  const spouseTie = { name: spouse.name, kind: 'spouse' as const, affinity: 85, npcId: spouse.npcId, playerId: spouse.playerId };
  const relationships = tieIndex >= 0
    ? married.relationships.map((tie, index) => (index === tieIndex ? { ...tie, kind: 'spouse' as const, affinity: Math.max(tie.affinity, 85) } : tie))
    : [...married.relationships, spouseTie];
  const tied = changeFieldInto(married, 'relationships', relationships, `${spouse.name} became their spouse`);
  return recordEvent(tied.npc, {
    at, kind: 'family', summary: `${npc.name} married ${spouse.name}. They now share a home.`, changes: [tied.change],
  });
}
