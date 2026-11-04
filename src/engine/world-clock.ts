import { addDays } from './game-date';
import { Npc } from './npc.model';
import { createDice } from './random';
import { LivedTogether, advanceTogether } from './together';

/**
 * THE WORLD CLOCK: how real time turns into game time, and how everyone catches up.
 *
 * The game maker sets how fast the world runs, such as one game week for every real day. Whenever the app
 * starts, readGameDate() works out what day it is in the world now, and catchUpEveryone() lives every NPC
 * forward to that day. So an NPC who steps into play after a month away has lived that month.
 *
 * Everyone catches up TOGETHER, a week at a time, so their lives can touch: a worker falls ill and his
 * employer decides whether to pay for treatment (see together.ts). Each catch-up rolls its own dice,
 * seeded by the world and the date it starts from, so the same catch-up always gives the same lives.
 */

export interface WorldClock {
  /** The real moment the world started, as an ISO date and time. */
  realStart: string;
  /** The game date at that moment, "YYYY-MM-DD". */
  gameStart: string;
  /** How many game days pass for each real day. 7 means one game week per real day. */
  gameDaysPerRealDay: number;
}

const MILLISECONDS_PER_DAY = 86_400_000;

export function readGameDate(clock: WorldClock, realNow: Date): string {
  const realDaysPassed = Math.max(0, (realNow.getTime() - new Date(clock.realStart).getTime()) / MILLISECONDS_PER_DAY);
  return addDays(clock.gameStart, Math.floor(realDaysPassed * clock.gameDaysPerRealDay));
}

/** Lives every NPC forward to the game date, together. The dead and the already-current stay as they are. */
export function catchUpEveryone(npcs: readonly Npc[], gameDate: string, worldSeed: string): LivedTogether {
  const earliest = npcs.map(npc => npc.livedUntil).sort()[0] ?? gameDate;
  return advanceTogether(npcs, gameDate, createDice(`${worldSeed}:${earliest}`));
}
