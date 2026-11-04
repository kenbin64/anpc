/**
 * GAME DATES: dates in the game world, kept as "YYYY-MM-DD" text.
 *
 * Text in that form sorts in date order, so log entries compare with plain < and >. Games with their own
 * calendars can map them onto this one.
 */

export function addDays(date: string, days: number): string {
  const moved = new Date(`${date}T00:00:00Z`);
  moved.setUTCDate(moved.getUTCDate() + days);
  return moved.toISOString().slice(0, 10);
}

export function readYear(date: string): number {
  return Number(date.slice(0, 4));
}
