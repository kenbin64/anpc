import { registerExtras } from './extras';
import { Extra, Npc } from './npc.model';
import { generateNpc } from './npc-generator';
import { NpcRequest } from './story-prompt';
import { Settlement, summonRoleHolder } from './settlement';
import { StoryWriter } from './story-writers';
import { WorldClock, catchUpEveryone, readGameDate } from './world-clock';
import { EraName, WorldMode, WorldScope } from './world-setup';
import type { PlayerSession } from './sessions';

/**
 * A SCENARIO: the starting cast that gets the ball rolling.
 *
 * A world with nobody in it gives players nothing to push against, so every scenario opens with a set of
 * full NPCs. Some are written from a request ("a widowed baker with a grudge against the miller"), and
 * some are the holders of roles the story needs from the first moment, such as the innkeeper the players
 * walk in on. Everyone those NPCs talk about becomes an extra, and every other role stays implied. The
 * world starts small and real, and grows only where the story goes.
 *
 * The scenario carries its own world clock. Every time the app starts, catchUpScenario() lives the whole
 * cast forward to today's game date, so they've been living their lives while the app was off.
 */

export interface ScenarioPlan {
  settlement: Settlement;
  /** A simulation just lives; a game has an objective. Simulation when left out. */
  mode?: WorldMode;
  /** For a game: what the players are trying to do. */
  objective?: string;
  /** Characters written from requests. The setting in each request is filled in from the settlement. */
  startingCast: Omit<NpcRequest, 'setting'>[];
  /** Roles filled from the start, such as ['innkeeper', 'constable']. */
  startingRoles: string[];
  /** How fast the world runs: game days per real day. Defaults to 7, one game week per real day. */
  gameDaysPerRealDay?: number;
  /** Only to replay a world exactly, such as in tests. Left out, every world gets its own fresh dice. */
  worldSeed?: string;
}

/**
 * THE RULES, set once at launch and never changed after. Both the record and the clock are frozen when
 * the world starts, so no later code can quietly change how the world works. People still come and go,
 * but only through play: births, promotions, a summons, retirement, a new player character.
 */
export interface WorldRules {
  mode: WorldMode;
  objective: string;
  era: EraName;
  scope: WorldScope;
  gameDaysPerRealDay: number;
}

export interface Scenario {
  settlement: Settlement;
  rules: Readonly<WorldRules>;
  npcs: Npc[];
  extras: Extra[];
  clock: Readonly<WorldClock>;
  /** Made fresh for every new world, so no two worlds roll the same dice, even with the same town name. */
  worldSeed: string;
  /** The furthest game date this world has reached. Time never goes back past it. */
  lastGameDate: string;
  /** Every player who has played in this world, and whether they're playing right now (see sessions.ts). */
  sessions: PlayerSession[];
}

/**
 * Call whenever the app starts: works out today's game date and lives every NPC up to it. Time only moves
 * forward. If the real clock reads earlier than before (a changed computer clock, say), the world simply
 * waits where it was; it never rewinds.
 */
export function catchUpScenario(scenario: Scenario, realNow: Date): Scenario {
  const clockDate = readGameDate(scenario.clock, realNow);
  const gameDate = clockDate > scenario.lastGameDate ? clockDate : scenario.lastGameDate;
  const lived = catchUpEveryone(scenario.npcs, gameDate, scenario.worldSeed);
  return { ...scenario, npcs: lived.npcs, extras: [...scenario.extras, ...lived.newExtras], lastGameDate: gameDate };
}

/** What has happened since a date, across the whole cast, oldest first. Looking back is a recap only. */
export function recapSince(scenario: Scenario, since: string): { name: string; at: string; summary: string }[] {
  return scenario.npcs
    .flatMap(npc => npc.lifeLog.filter(event => event.at > since).map(event => ({ name: npc.name, at: event.at, summary: event.summary })))
    .sort((first, second) => first.at.localeCompare(second.at));
}

export async function startScenario(
  plan: ScenarioPlan, writeStory: StoryWriter, at: string, realNow: Date = new Date(),
): Promise<Scenario> {
  const setting = `${plan.settlement.name}, a ${plan.settlement.size} in ${plan.settlement.setting}`;
  const worldSeed = plan.worldSeed ?? crypto.randomUUID();
  let settlement = plan.settlement;
  const cast: Npc[] = [];

  const takenNames = (): string[] => cast.map(npc => npc.name);
  for (const request of plan.startingCast) {
    cast.push(await generateNpc({
      ...request, seed: `${worldSeed}:${request.seed}`, setting, era: plan.settlement.era, avoidNames: takenNames(),
    }, writeStory, at));
  }
  for (const title of plan.startingRoles) {
    const summoned = await summonRoleHolder(settlement, title, writeStory, at, worldSeed, takenNames());
    settlement = summoned.settlement;
    if (summoned.newNpc) cast.push(summoned.newNpc);
  }

  const registered = cast.map(npc => registerExtras(npc, at));
  const gameDaysPerRealDay = plan.gameDaysPerRealDay ?? 7;
  return {
    settlement,
    rules: Object.freeze({
      mode: plan.mode ?? 'simulation', objective: plan.objective ?? '',
      era: settlement.era, scope: settlement.size, gameDaysPerRealDay,
    }),
    npcs: registered.map(entry => entry.npc),
    extras: registered.flatMap(entry => entry.extras),
    clock: Object.freeze({ realStart: realNow.toISOString(), gameStart: at, gameDaysPerRealDay }),
    worldSeed,
    lastGameDate: at,
    sessions: [],
  };
}
