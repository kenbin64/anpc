import { Dice } from './random';
import { calculateEffectiveTemperament } from './health';
import { recordEvent } from './life-log';
import { Npc } from './npc.model';

/**
 * NATURE versus RANDOMNESS: how an NPC decides, with no script.
 *
 * Each situation reads one trait. A trait above 50 points to one response, below 50 to the opposite; that
 * is the NPC's nature. The randomness dial sets the chance they act against it, up to a coin flip, and conviction softens the
 * chance: someone at honesty 95 almost never steals however unpredictable they are, while someone at
 * honesty 55 is torn and breaks often. Effective (health-adjusted) temperament is used, so a sick NPC is
 * shorter-tempered than a healthy one.
 */

export type Situation = 'insulted' | 'threatened' | 'tempted-to-steal' | 'asked-for-help' | 'offered-bribe';

interface SituationRule {
  readTrait: (npc: Npc) => number;
  highResponse: string;
  lowResponse: string;
}

const SITUATION_RULES: Record<Situation, SituationRule> = {
  'insulted': {
    readTrait: npc => calculateEffectiveTemperament(npc).disposition,
    highResponse: 'talks it out', lowResponse: 'starts a fight',
  },
  'threatened': {
    readTrait: npc => calculateEffectiveTemperament(npc).disposition,
    highResponse: 'tries to calm things down', lowResponse: 'strikes first',
  },
  'tempted-to-steal': {
    readTrait: npc => npc.temperament.honesty,
    highResponse: 'leaves it alone', lowResponse: 'steals it',
  },
  'asked-for-help': {
    readTrait: npc => npc.temperament.alignment,
    highResponse: 'helps', lowResponse: 'refuses, or takes advantage',
  },
  'offered-bribe': {
    readTrait: npc => npc.temperament.honesty,
    highResponse: 'refuses the bribe', lowResponse: 'takes the bribe',
  },
};

export interface Decision {
  situation: Situation;
  response: string;
  naturalResponse: string;
  wentAgainstNature: boolean;
  /** The chance, 0 to 100, that this NPC would go against type here. */
  chanceAgainstNature: number;
}

/**
 * The chance of acting against type. Full randomness tops out at 50%, a coin flip, because acting against
 * type more than half the time would just mean having the opposite nature. Conviction then softens it.
 */
export function calculateChanceAgainstNature(trait: number, randomness: number): number {
  const conviction = Math.abs(trait - 50) / 50;
  return Math.round((randomness / 2) * (1 - conviction * 0.9));
}

export function decide(npc: Npc, situation: Situation, dice: Dice): Decision {
  const rule = SITUATION_RULES[situation];
  const trait = rule.readTrait(npc);
  const naturalResponse = trait >= 50 ? rule.highResponse : rule.lowResponse;
  const oppositeResponse = trait >= 50 ? rule.lowResponse : rule.highResponse;
  const chanceAgainstNature = calculateChanceAgainstNature(trait, npc.temperament.randomness);
  const wentAgainstNature = dice.happens(chanceAgainstNature);
  return {
    situation,
    response: wentAgainstNature ? oppositeResponse : naturalResponse,
    naturalResponse,
    wentAgainstNature,
    chanceAgainstNature,
  };
}

/** Decides and writes the choice into the life log, so the game's history and the NPC's agree. */
export function decideAndRecord(npc: Npc, situation: Situation, dice: Dice, at: string): { npc: Npc; decision: Decision } {
  const decision = decide(npc, situation, dice);
  const surprise = decision.wentAgainstNature ? ', against their nature' : '';
  const updated = recordEvent(npc, {
    at, kind: 'choice', summary: `When ${situation.replace(/-/g, ' ')}, ${npc.name} ${decision.response}${surprise}.`,
  });
  return { npc: updated, decision };
}
