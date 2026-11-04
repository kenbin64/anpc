import { addDays, readYear } from './game-date';
import { calculateEffectiveStats, calculateEffectiveWorkEthic, recordDeath } from './health';
import { changeField, changeFieldInto, recordEvent, shiftDial } from './life-log';
import { decide } from './nature';
import { FieldChange, Npc, RelationKind } from './npc.model';
import { Dice } from './random';

/**
 * OFF-SCREEN LIFE: keeps an NPC living between the times a game looks at them.
 *
 * advanceLife() walks forward one week at a time from `livedUntil` to the date asked for. Each week the
 * NPC works (or skips work, if lazy or sick), spends evenings at the tavern and with family, worships,
 * may get into a quarrel and settle it by their own nature, may fall ill or heal, ages, and may die.
 *
 * The log keeps what matters in play. A brawl, an illness, a recovery or a death gets its own entry the
 * moment it happens. The ordinary drift, such as healing a little, growing a little closer to family,
 * gaining a little experience or a little reputation, is gathered up quietly. At the end, one 'period'
 * entry sums up the whole stretch and lists the net change to every number that moved, with the reasons.
 * So nothing goes unrecorded, and nothing important gets buried under routine.
 */

const FAMILY_KINDS: readonly RelationKind[] = ['spouse', 'child', 'parent', 'sibling', 'relative'];
/**
 * Each ailment's severity: how hard it hits when it starts, and the most it can wear someone down in a
 * week while it lasts. A sprained ankle slows you; a fever or a festering wound can kill.
 */
const AILMENTS: Record<string, { onset: [number, number]; weeklyWorst: number }> = {
  'a sprained ankle': { onset: [5, 10], weeklyWorst: 1 },
  'a bad cough': { onset: [8, 15], weeklyWorst: 4 },
  'stomach sickness': { onset: [10, 20], weeklyWorst: 6 },
  'winter fever': { onset: [15, 30], weeklyWorst: 12 },
  'a festering cut': { onset: [10, 25], weeklyWorst: 14 },
};
const AILMENT_NAMES = Object.keys(AILMENTS);
const UNKNOWN_AILMENT = { onset: [10, 20] as [number, number], weeklyWorst: 6 };

/** How much paid treatment raises the weekly chance of recovering, in percentage points. */
export const CARE_BONUS = 25;

/** A running tally of ordinary life across the whole stretch being lived. */
export interface Ledger {
  weeks: number;
  daysWorked: number;
  workDaysPossible: number;
  tavernEvenings: number;
  familyEvenings: number;
  timesWorshipped: number;
  quarrelsSettledCalmly: number;
  quietChanges: FieldChange[];
}

function startLedger(): Ledger {
  return {
    weeks: 0, daysWorked: 0, workDaysPossible: 0, tavernEvenings: 0, familyEvenings: 0,
    timesWorshipped: 0, quarrelsSettledCalmly: 0, quietChanges: [],
  };
}

/** A small routine change: applied now, written into the period summary at the end. */
function driftQuietly(npc: Npc, ledger: Ledger, field: string, amount: number, reason: string): Npc {
  const current = Number(field.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown>)[part], npc));
  const drifted = changeFieldInto(npc, field, Math.min(100, Math.max(0, current + amount)), reason);
  ledger.quietChanges.push(drifted.change);
  return drifted.npc;
}

function liveOneWeek(npc: Npc, weekStart: string, ledger: Ledger, dice: Dice): Npc {
  let current = npc;
  ledger.weeks += 1;
  current = ageOnNewYear(current, ledger, weekStart);
  current = workTheWeek(current, ledger, dice);
  current = spendEvenings(current, ledger, weekStart, dice);
  current = attendWorship(current, ledger, dice);
  current = changeHealth(current, ledger, weekStart, dice);
  return current;
}

function ageOnNewYear(npc: Npc, ledger: Ledger, weekStart: string): Npc {
  const crossedNewYear = readYear(addDays(weekStart, 7)) > readYear(weekStart);
  let current = npc;
  if (crossedNewYear) {
    const aged = changeFieldInto(npc, 'age', npc.age + 1, 'A year older');
    ledger.quietChanges.push(aged.change);
    current = aged.npc;
  }
  return current;
}

function workTheWeek(npc: Npc, ledger: Ledger, dice: Dice): Npc {
  let current = npc;
  const workDays = npc.occupation ? npc.routine.workDaysPerWeek : 0;
  const showUpChance = 40 + calculateEffectiveWorkEthic(npc) * 0.6;
  let daysWorked = 0;
  for (let day = 0; day < workDays; day++) {
    daysWorked += dice.happens(showUpChance) ? 1 : 0;
  }
  ledger.daysWorked += daysWorked;
  ledger.workDaysPossible += workDays;
  if (workDays > 0 && daysWorked === workDays && dice.happens(15)) {
    current = driftQuietly(current, ledger, 'occupation.experience', 1, 'Steady work built up experience');
  }
  return current;
}

function spendEvenings(npc: Npc, ledger: Ledger, weekStart: string, dice: Dice): Npc {
  let current = npc;
  for (let evening = 0; evening < npc.routine.tavernEveningsPerWeek; evening++) {
    ledger.tavernEvenings += 1;
    current = dice.happens(6) ? settleTavernQuarrel(current, ledger, weekStart, dice) : current;
  }
  const family = npc.relationships.filter(tie => FAMILY_KINDS.includes(tie.kind));
  ledger.familyEvenings += family.length > 0 ? npc.routine.familyEveningsPerWeek : 0;
  if (family.length > 0 && npc.routine.familyEveningsPerWeek > 0 && dice.happens(10)) {
    const relativeIndex = npc.relationships.indexOf(dice.pick(family));
    current = driftQuietly(current, ledger, `relationships.${relativeIndex}.affinity`, 2, 'Time spent together');
  }
  return current;
}

/** A quarrel settled calmly is routine. A brawl matters in play, so it's logged the moment it happens. */
function settleTavernQuarrel(npc: Npc, ledger: Ledger, weekStart: string, dice: Dice): Npc {
  const decision = decide(npc, 'insulted', dice);
  let current = npc;
  if (decision.response === 'starts a fight') {
    const surprise = decision.wentAgainstNature ? ', against their nature' : '';
    const injury = Math.max(1, dice.rollBetween(5, 20) - Math.floor(calculateEffectiveStats(npc).constitution / 4));
    current = recordEvent(current, {
      at: weekStart, kind: 'conflict', summary: `Insulted at the tavern, ${npc.name} started a fight${surprise}.`,
    });
    current = shiftDial(current, 'social.reputation', -3, 'Started a brawl at the tavern', weekStart);
    current = shiftDial(current, 'health.condition', -injury, 'Hurt in a tavern brawl', weekStart);
  } else {
    ledger.quarrelsSettledCalmly += 1;
    current = driftQuietly(current, ledger, 'social.reputation', 1, 'Kept their head in tavern quarrels');
  }
  return current;
}

function attendWorship(npc: Npc, ledger: Ledger, dice: Dice): Npc {
  let current = npc;
  const churchIndex = npc.affiliations.findIndex(affiliation => affiliation.kind === 'church');
  const worshipped = npc.routine.worshipDay !== undefined && churchIndex >= 0 && npc.health.condition > 20;
  ledger.timesWorshipped += worshipped ? 1 : 0;
  if (worshipped && dice.happens(5)) {
    current = driftQuietly(current, ledger, `affiliations.${churchIndex}.standing`, 1, 'Faithful attendance at worship');
  }
  return current;
}

/** Falling ill and recovering matter in play and are logged. Slow healing is routine drift. */
function changeHealth(npc: Npc, ledger: Ledger, weekStart: string, dice: Dice): Npc {
  let current = npc;
  const isIll = npc.health.ailments.length > 0;
  const illnessChance = 2 + Math.floor(npc.age / 25) + npc.routine.tavernEveningsPerWeek;
  if (!isIll && dice.happens(illnessChance)) {
    const ailment = dice.pick(AILMENT_NAMES);
    const [mildest, worst] = AILMENTS[ailment].onset;
    current = changeField(current, 'health.ailments', [ailment], `Fell ill with ${ailment}`, weekStart);
    current = shiftDial(current, 'health.condition', -dice.rollBetween(mildest, worst), `Weakened by ${ailment}`, weekStart);
  } else if (isIll && dice.happens(30 + npc.stats.constitution * 2 + (npc.health.caredForBy ? CARE_BONUS : 0))) {
    current = changeField(current, 'health.ailments', [], `Recovered from ${npc.health.ailments.join(' and ')}`, weekStart);
    current = shiftDial(current, 'health.condition', dice.rollBetween(10, 25), 'Getting their strength back', weekStart);
    current = current.health.caredForBy ? changeField(current, 'health.caredForBy', undefined, 'Treatment no longer needed', weekStart) : current;
  } else if (isIll) {
    const severity = AILMENTS[npc.health.ailments[0]] ?? UNKNOWN_AILMENT;
    const worsening = dice.rollBetween(0, current.health.caredForBy ? Math.ceil(severity.weeklyWorst / 3) : severity.weeklyWorst);
    current = driftQuietly(current, ledger, 'health.condition', -worsening, `Still suffering from ${npc.health.ailments[0]}`);
  } else if (!isIll && npc.health.condition < 100) {
    current = driftQuietly(current, ledger, 'health.condition', 2, 'Rest and time');
  }
  const oldAgeChance = Math.max(0, current.age - 70) / 4;
  const cause = current.health.condition <= 0 ? current.health.ailments[0] ?? 'their injuries' : 'old age';
  const dies = current.health.condition <= 0 || dice.happens(oldAgeChance);
  return dies ? recordDeath(current, cause, weekStart) : current;
}

/** Folds many small changes to the same field into one: where it started, where it ended, and why. */
function netChanges(changes: FieldChange[]): FieldChange[] {
  const byField = new Map<string, FieldChange>();
  for (const change of changes) {
    const earlier = byField.get(change.field);
    const reasons = earlier ? new Set([...earlier.reason.split('; '), change.reason]) : new Set([change.reason]);
    byField.set(change.field, { field: change.field, from: earlier ? earlier.from : change.from, to: change.to, reason: [...reasons].join('; ') });
  }
  return [...byField.values()].filter(change => change.from !== change.to);
}

function summarizePeriod(npc: Npc, ledger: Ledger): string {
  const parts = [`Lived ${ledger.weeks} week${ledger.weeks === 1 ? '' : 's'}`];
  if (ledger.workDaysPossible) parts.push(`worked ${ledger.daysWorked} of ${ledger.workDaysPossible} days as ${npc.occupation?.title}`);
  if (ledger.tavernEvenings) parts.push(`${ledger.tavernEvenings} evenings at the tavern`);
  if (ledger.quarrelsSettledCalmly) parts.push(`talked their way out of ${ledger.quarrelsSettledCalmly} quarrel${ledger.quarrelsSettledCalmly === 1 ? '' : 's'}`);
  if (ledger.familyEvenings) parts.push(`${ledger.familyEvenings} evenings with family`);
  if (ledger.timesWorshipped) parts.push(`attended worship ${ledger.timesWorshipped} times`);
  return `${parts.join(', ')}.`;
}

/**
 * A STRETCH OF LIVING in progress. Living alone uses advanceLife(); living alongside others (see
 * together.ts) steps everyone a week at a time with these three functions, so neighbors can affect each
 * other between weeks.
 */
export interface LifeRun {
  npc: Npc;
  startDate: string;
  ledger: Ledger;
}

export function beginLiving(npc: Npc): LifeRun {
  return { npc, startDate: npc.livedUntil, ledger: startLedger() };
}

/** True if this NPC can live another whole week before `untilDate`. */
export function canLiveAnotherWeek(run: LifeRun, untilDate: string): boolean {
  return run.npc.health.alive && addDays(run.npc.livedUntil, 7) <= untilDate;
}

export function liveWeek(run: LifeRun, dice: Dice): LifeRun {
  const lived = liveOneWeek(run.npc, run.npc.livedUntil, run.ledger, dice);
  return { ...run, npc: { ...lived, livedUntil: addDays(run.npc.livedUntil, 7) } };
}

/** Closes the stretch with one summary of the ordinary living in it. */
export function finishLiving(run: LifeRun): Npc {
  const changes = netChanges(run.ledger.quietChanges);
  const span = `From ${run.startDate} to ${run.npc.livedUntil}: `;
  return run.ledger.weeks === 0
    ? run.npc
    : recordEvent(run.npc, {
        at: run.npc.livedUntil, kind: 'period', summary: span + summarizePeriod(run.npc, run.ledger), ...(changes.length ? { changes } : {}),
      });
}

/**
 * Lives one NPC's life forward to `untilDate`, alone, logging what matters as it happens and closing with
 * one summary of the ordinary living in between. The dead and the already-current come back unchanged.
 */
export function advanceLife(npc: Npc, untilDate: string, dice: Dice): Npc {
  let run = beginLiving(npc);
  while (canLiveAnotherWeek(run, untilDate)) {
    run = liveWeek(run, dice);
  }
  return finishLiving(run);
}
