import { registerExtras } from './extras';
import { Extra, Npc } from './npc.model';
import { generateNpc } from './npc-generator';
import { NpcRequest } from './story-prompt';
import { Settlement, summonRoleHolder } from './settlement';
import { StoryWriter } from './story-writers';
import { WorldClock, catchUpEveryone, readGameDate } from './world-clock';
import { WorldMode } from './world-setup';

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
}

export interface Scenario {
  settlement: Settlement;
  mode: WorldMode;
  objective: string;
  npcs: Npc[];
  extras: Extra[];
  clock: WorldClock;
}

/** Call whenever the app starts: works out today's game date and lives every NPC up to it. */
export function catchUpScenario(scenario: Scenario, realNow: Date): Scenario {
  const gameDate = readGameDate(scenario.clock, realNow);
  const lived = catchUpEveryone(scenario.npcs, gameDate, scenario.settlement.name);
  return { ...scenario, npcs: lived.npcs, extras: [...scenario.extras, ...lived.newExtras] };
}

export async function startScenario(
  plan: ScenarioPlan, writeStory: StoryWriter, at: string, realNow: Date = new Date(),
): Promise<Scenario> {
  const setting = `${plan.settlement.name}, a ${plan.settlement.size} in ${plan.settlement.setting}`;
  let settlement = plan.settlement;
  const cast: Npc[] = [];

  for (const request of plan.startingCast) {
    cast.push(await generateNpc({ ...request, setting, era: plan.settlement.era }, writeStory, at));
  }
  for (const title of plan.startingRoles) {
    const summoned = await summonRoleHolder(settlement, title, writeStory, at);
    settlement = summoned.settlement;
    if (summoned.newNpc) cast.push(summoned.newNpc);
  }

  const registered = cast.map(npc => registerExtras(npc, at));
  return {
    settlement,
    mode: plan.mode ?? 'simulation',
    objective: plan.objective ?? '',
    npcs: registered.map(entry => entry.npc),
    extras: registered.flatMap(entry => entry.extras),
    clock: { realStart: realNow.toISOString(), gameStart: at, gameDaysPerRealDay: plan.gameDaysPerRealDay ?? 7 },
  };
}
