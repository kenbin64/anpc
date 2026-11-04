import { calculateEffectiveStats, calculateEffectiveTemperament } from './health';
import { Npc } from './npc.model';
import { Dice } from './random';

/**
 * REACTING TO STRANGE TALK: what an NPC makes of words from outside their world.
 *
 * The reaction comes from their nature. A short temper turns it into a threat, so they get DEFENSIVE.
 * Kindness and good sense make them CONCERNED that the stranger is fevered or bewitched. Most people are
 * SUSPICIOUS of a stranger talking nonsense: a spy, a drunk, a madman or a witch. A creature that can't
 * speak just goes WARY. Their randomness still applies, so now and then they react out of character too.
 */

export type StrangeReaction = 'defensive' | 'concerned' | 'suspicious' | 'wary';

export const REACTION_GUIDANCE: Record<StrangeReaction, string> = {
  defensive: 'You feel threatened by this babbling stranger. Be curt and guarded, and warn them off if they persist.',
  concerned: 'You worry the stranger is fevered, bewitched or touched in the head. Be gentle but puzzled.',
  suspicious: 'You suspect the stranger is a spy, a drunk, a fool or worse. Be wary and question them.',
  wary: 'You are a creature. You do not understand. Back away, growl, or watch them closely.',
};

/** How much trust a reaction costs the stranger, out of 100. */
export const TRUST_COST: Record<StrangeReaction, number> = { defensive: 10, suspicious: 6, concerned: 2, wary: 8 };

const REACTIONS: readonly StrangeReaction[] = ['defensive', 'concerned', 'suspicious'];

function chooseByNature(npc: Npc): StrangeReaction {
  const temperament = calculateEffectiveTemperament(npc);
  const stats = calculateEffectiveStats(npc);
  let reaction: StrangeReaction = 'suspicious';
  if (temperament.disposition < 35) {
    reaction = 'defensive';
  } else if (temperament.alignment >= 60 && stats.wisdom >= 11) {
    reaction = 'concerned';
  }
  return reaction;
}

export function chooseStrangeReaction(npc: Npc, dice: Dice): StrangeReaction {
  const isMuteCreature = npc.creature !== null && !npc.creature.canSpeak;
  const natural = chooseByNature(npc);
  const actsOutOfCharacter = dice.happens(npc.temperament.randomness / 4);
  const otherReactions = REACTIONS.filter(reaction => reaction !== natural);
  const byPersonality = actsOutOfCharacter ? dice.pick(otherReactions) : natural;
  return isMuteCreature ? 'wary' : byPersonality;
}
