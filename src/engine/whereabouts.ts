import { Npc } from './npc.model';
import { createDice } from './random';

/**
 * WHEREABOUTS: where an ANPC is and what they're doing at any moment of the game day.
 *
 * Players can always ask. The answer comes from the NPC's own life: the dead are laid to rest, the sick
 * are in bed, everyone sleeps at night, workers are at work on work days, regulars are at the tavern on
 * their evenings out, and the faithful are at worship on their day. A summons they agreed to (see
 * meeting.ts) overrides all of that for the hours it covers.
 *
 * The answer for a given moment is always the same, because the evening's choice is rolled with dice
 * seeded by the NPC and the date.
 */

export interface Whereabouts {
  place: string;
  activity: string;
}

/** Monday is 1, Sunday is 0, as in the game calendar. */
function readWeekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function homeOf(npc: Npc): string {
  return `${npc.name}'s home`;
}

/** Works the first N days counting from Monday, skipping their day of worship. */
function worksOn(npc: Npc, weekday: number): boolean {
  const workWeek = [1, 2, 3, 4, 5, 6, 0].filter(day => day !== npc.routine.worshipDay).slice(0, npc.routine.workDaysPerWeek);
  return npc.occupation !== null && workWeek.includes(weekday);
}

function findSummons(npc: Npc, date: string, hour: number): Whereabouts | null {
  const summons = npc.summonedTo;
  const covers = summons !== undefined && summons.date === date && hour >= summons.fromHour && hour < summons.untilHour;
  return covers ? { place: summons.place, activity: `meeting ${summons.by}, who sent for them` } : null;
}

export function findWhereabouts(npc: Npc, date: string, hour: number): Whereabouts {
  const weekday = readWeekday(date);
  const churchName = npc.affiliations.find(group => group.kind === 'church')?.name ?? 'the chapel';
  const tavernName = npc.affiliations.find(group => group.kind === 'tavern')?.name ?? 'the tavern';
  const goesOutTonight = createDice(`${npc.id}:${date}:evening`).happens((npc.routine.tavernEveningsPerWeek / 7) * 100);
  const summoned = findSummons(npc, date, hour);

  let whereabouts: Whereabouts = { place: homeOf(npc), activity: 'at home' };
  if (!npc.health.alive) {
    whereabouts = { place: 'the graveyard', activity: `laid to rest; died of ${npc.health.death?.cause ?? 'unknown causes'}` };
  } else if (summoned) {
    whereabouts = summoned;
  } else if (npc.creature) {
    whereabouts = { place: npc.occupation?.workplace ?? 'the wilds', activity: hour >= 6 && hour < 20 ? 'roaming its territory' : 'resting in its den' };
  } else if (npc.health.ailments.length > 0) {
    whereabouts = { place: homeOf(npc), activity: `sick in bed with ${npc.health.ailments[0]}` };
  } else if (hour < 6 || hour >= 22) {
    whereabouts = { place: homeOf(npc), activity: 'asleep' };
  } else if (weekday === npc.routine.worshipDay && hour >= 8 && hour < 12) {
    whereabouts = { place: churchName, activity: 'at worship' };
  } else if (hour >= 8 && hour < 18 && worksOn(npc, weekday)) {
    whereabouts = { place: npc.occupation!.workplace, activity: `working as ${npc.occupation!.title}` };
  } else if (hour >= 18 && goesOutTonight) {
    whereabouts = { place: tavernName, activity: 'drinking with the regulars' };
  }
  return whereabouts;
}

/** True if a player at `place` can meet the NPC right now. Places match whatever their capitals. */
export function isPresentAt(npc: Npc, place: string, date: string, hour: number): boolean {
  return findWhereabouts(npc, date, hour).place.toLowerCase() === place.trim().toLowerCase();
}
