import { welcomeBirths } from './births';
import { TREATMENT_COST, formatMoney } from './economy';
import { changeField, changeFieldInto, recordEvent, shiftDial } from './life-log';
import { LifeRun, beginLiving, canLiveAnotherWeek, finishLiving, liveWeek } from './life-simulator';
import { decide } from './nature';
import { Extra, Npc, RelationKind } from './npc.model';
import { Dice } from './random';

/**
 * LIVING TOGETHER: NPCs who share a world live each week side by side, so one life can reach another.
 *
 * Everyone lives one week, then the world looks at what happened and lets it ripple out. The first ripple
 * is CARE FOR THE SICK. When someone falls ill, the people tied to them, such as their employer, family
 * and friends, each decide whether to pay for treatment. They decide by their own nature (the
 * 'asked-for-help' situation, so kindness and randomness both count) and only if they care enough about
 * the sick one. Care raises the weekly chance of recovery and slows the decline, so a kind miller can
 * keep his worker alive and a cold one can let him die. Both sides remember: helping earns gratitude and
 * reputation, and refusing costs affection.
 *
 * The healer who gives the treatment is NOT created here. They stay an implied role: the treatment simply
 * happens. A healer only becomes a full ANPC when they're actually in a scene, such as a player visiting
 * them or a fundraiser they attend. Someone only talked about stays implied.
 */

/** Ties, as the HELPER sees them, that make someone a natural person to ask. */
const CARING_TIES: readonly RelationKind[] = ['employee', 'spouse', 'child', 'parent', 'sibling', 'relative', 'friend'];

/** How much the helper must care about the sick one before they'll even consider paying. */
const LEAST_AFFINITY_TO_HELP = 30;

interface Helper {
  index: number;
  tieIndex: number;
  affinity: number;
}

/** Everyone in the group tied to the sick NPC in a caring way, the closest first. */
function findHelpers(sickId: string, people: readonly Npc[]): Helper[] {
  const helpers: Helper[] = [];
  people.forEach((person, index) => {
    const tieIndex = person.relationships.findIndex(tie => tie.npcId === sickId && CARING_TIES.includes(tie.kind));
    const canHelp = tieIndex >= 0 && person.health.alive && person.health.ailments.length === 0;
    if (canHelp) helpers.push({ index, tieIndex, affinity: person.relationships[tieIndex].affinity });
  });
  return helpers.sort((first, second) => second.affinity - first.affinity);
}

/** Changes the sick NPC's feelings toward a helper, if they know them. */
function shiftFeelingToward(npc: Npc, otherId: string, amount: number, reason: string, at: string): Npc {
  const tieIndex = npc.relationships.findIndex(tie => tie.npcId === otherId);
  return tieIndex >= 0 ? shiftDial(npc, `relationships.${tieIndex}.affinity`, amount, reason, at) : npc;
}

/**
 * Asks each person tied to the sick NPC, closest first, until someone pays or everyone has said no.
 * Returns the whole group with every decision written into the logs on both sides.
 */
export function offerCare(people: readonly Npc[], sickIndex: number, dice: Dice, at: string): Npc[] {
  const updated = [...people];
  const sickName = people[sickIndex].name;
  const ailment = people[sickIndex].health.ailments[0] ?? 'their illness';
  let cared = false;
  for (const helper of findHelpers(people[sickIndex].id, people)) {
    if (cared) break;
    const helperNpc = updated[helper.index];
    const decision = decide(helperNpc, 'asked-for-help', dice);
    const willing = decision.response === 'helps' && helper.affinity >= LEAST_AFFINITY_TO_HELP;
    const canAfford = helperNpc.purse >= TREATMENT_COST;
    const surprise = decision.wentAgainstNature ? ', against their nature' : '';
    if (willing && !canAfford) {
      updated[helper.index] = recordEvent(helperNpc, {
        at, kind: 'choice', summary: `Wanted to pay for ${sickName}'s treatment for ${ailment}, but could not afford it.`,
      });
    } else if (willing) {
      updated[helper.index] = shiftDial(
        recordEvent(
          { ...helperNpc, purse: helperNpc.purse - TREATMENT_COST },
          { at, kind: 'choice', summary: `Paid ${formatMoney(TREATMENT_COST)} for ${sickName}'s treatment for ${ailment}${surprise}.` },
        ),
        'social.reputation', 2, 'Known to look after their own', at,
      );
      updated[sickIndex] = shiftFeelingToward(
        changeField(updated[sickIndex], 'health.caredForBy', helperNpc.name, `${helperNpc.name} paid for treatment`, at),
        helperNpc.id, 10, `Grateful that ${helperNpc.name} paid for treatment`, at,
      );
      cared = true;
    } else {
      updated[helper.index] = recordEvent(helperNpc, {
        at, kind: 'choice', summary: `Would not pay for ${sickName}'s treatment for ${ailment}${surprise}.`,
      });
      updated[sickIndex] = shiftFeelingToward(updated[sickIndex], helperNpc.id, -5, `${helperNpc.name} would not help`, at);
    }
  }
  return updated;
}

/**
 * WAGES INSIDE THE WORLD: when a worker's employer is also a full NPC, the employer really pays them.
 * The worker's own week already counted the wage coming in; here it goes out of the employer's purse, so
 * money moves between them instead of appearing from nowhere. It's part of the employer's routine, so it
 * goes into their period summary, and an employer who can't cover their payroll falls into debt.
 */
function payWages(runs: LifeRun[]): LifeRun[] {
  const updated = [...runs];
  runs.forEach(workerRun => {
    const worker = workerRun.npc;
    const employerTie = worker.relationships.find(tie => tie.kind === 'employer' && tie.npcId);
    const employerIndex = employerTie ? updated.findIndex(run => run.npc.id === employerTie.npcId) : -1;
    const isEmployed = employerIndex >= 0 && worker.health.alive && worker.occupation !== null;
    if (isEmployed) {
      const employerRun = updated[employerIndex];
      const paid = changeFieldInto(
        employerRun.npc, 'purse', employerRun.npc.purse - worker.occupation!.weeklyWage, `Wages paid to ${worker.name}`,
      );
      employerRun.ledger.quietChanges.push(paid.change);
      updated[employerIndex] = { ...employerRun, npc: paid.npc };
    }
  });
  return updated;
}

export interface LivedTogether {
  npcs: Npc[];
  /** Children born along the way, as extras known to their parents. */
  newExtras: Extra[];
}

/**
 * Lives a whole group forward together to `untilDate`, a week at a time, letting each week's troubles
 * and joys ripple out before the next: care for the sick, and births to married couples. Each NPC still
 * ends with their own period summary.
 */
export function advanceTogether(npcs: readonly Npc[], untilDate: string, dice: Dice): LivedTogether {
  let runs: LifeRun[] = npcs.map(beginLiving);
  const newExtras: Extra[] = [];
  while (runs.some(run => canLiveAnotherWeek(run, untilDate))) {
    const before = runs.map(run => run.npc);
    runs = runs.map(run => (canLiveAnotherWeek(run, untilDate) ? liveWeek(run, dice) : run));
    let people = runs.map(run => run.npc);
    people.forEach((person, index) => {
      const fellIll = before[index].health.ailments.length === 0 && person.health.ailments.length > 0;
      if (fellIll && person.health.alive) people = offerCare(people, index, dice, person.livedUntil);
    });
    runs = runs.map((run, index) => ({ ...run, npc: people[index] }));
    runs = payWages(runs);
    people = runs.map(run => run.npc);
    const weekOf = people.map(person => person.livedUntil).sort().at(-1) ?? untilDate;
    const births = welcomeBirths(people, dice, weekOf);
    people = births.people;
    newExtras.push(...births.newborns);
    runs = runs.map((run, index) => ({ ...run, npc: people[index] }));
  }
  return { npcs: runs.map(finishLiving), newExtras };
}
