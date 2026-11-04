import { Npc, PlayerCharacter, SocietyRank, WorkRole } from './npc.model';
import { recordEvent } from './life-log';
import { Dice } from './random';
import { EraName } from './world-setup';

/**
 * MONEY: wages, living costs, and paying each other.
 *
 * All money is kept as whole numbers of the smallest coin: copper pennies in a medieval world, cents in a
 * modern one. Whole numbers never drift the way decimals can. formatMoney() turns them into something a
 * person reads, such as "2 gold, 3 silver, 5 copper".
 *
 * A job pays a weekly wage set by its role and the worker's experience; an owner's takings vary week to
 * week. Living costs depend on social rank, because a noble lives far more dearly than a peasant. Each
 * week an NPC earns what they worked and pays what they live on (see life-simulator.ts). Running short
 * means debt, which is logged when it starts and when it's paid off.
 *
 * Players have a purse too. A rich player pays NPCs for goods, work or favors. A working player gets paid
 * by NPCs and has living costs of their own to cover.
 */

/** A week's living costs by social rank, in the smallest coin. */
export const WEEKLY_LIVING_COST: Record<SocietyRank, number> = {
  outcast: 4, peasant: 10, commoner: 20, merchant: 50, gentry: 120, noble: 300, royal: 1000,
};

/**
 * Income that comes with rank rather than work: rents, estates, tithes. The gentry, nobles and royals
 * live dearly, and this is what pays for it. Everyone else lives on what they earn.
 */
export const WEEKLY_RANK_INCOME: Record<SocietyRank, number> = {
  outcast: 0, peasant: 0, commoner: 0, merchant: 0, gentry: 90, noble: 280, royal: 1000,
};

/** One evening at the tavern. */
export const TAVERN_EVENING_COST = 3;

/** A week of a healer's treatment for the sick. */
export const TREATMENT_COST = 40;

/** A full week's pay for each kind of role, before experience, in the smallest coin. */
const BASE_WAGE: Record<WorkRole, number> = {
  none: 0, apprentice: 12, worker: 25, vendor: 35, tradesman: 45, boss: 60, professional: 70, owner: 80,
};

/** Experience moves pay from 60% of the base for a novice to 140% for a master. */
export function calculateWeeklyWage(role: WorkRole, experience: number): number {
  return Math.round(BASE_WAGE[role] * (0.6 + (experience / 100) * 0.8));
}

/** What an owner actually takes in this week: anywhere from a bad week to a good one. */
export function rollOwnerTakings(weeklyWage: number, dice: Dice): number {
  return Math.round(weeklyWage * (dice.rollBetween(40, 160) / 100));
}

/** Coins to start with: a few weeks of living costs for their rank, more or less. */
export function rollStartingPurse(rank: SocietyRank, dice: Dice): number {
  return WEEKLY_LIVING_COST[rank] * dice.rollBetween(3, 12);
}

const COINS: Record<EraName, [name: string, value: number][]> = {
  medieval: [['gold', 100], ['silver', 10], ['copper', 1]],
  modern: [],
};

/** Shows an amount the way people of the era would say it. */
export function formatMoney(amount: number, era: EraName = 'medieval'): string {
  const sign = amount < 0 ? 'owes ' : '';
  let left = Math.abs(amount);
  let shown = `$${(left / 100).toFixed(2)}`;
  if (COINS[era].length > 0) {
    const parts: string[] = [];
    for (const [name, value] of COINS[era]) {
      const count = Math.floor(left / value);
      left -= count * value;
      if (count > 0) parts.push(`${count} ${name}`);
    }
    shown = parts.length ? parts.join(', ') : '0 copper';
  }
  return sign + shown;
}

export interface PaymentResult {
  player: PlayerCharacter;
  npc: Npc;
  paid: boolean;
  /** Why it didn't go through, if it didn't. */
  problem: string | null;
}

/** A player pays an NPC, for goods, work or a favor. They can't pay what they don't have. */
export function payNpc(player: PlayerCharacter, npc: Npc, amount: number, reason: string, at: string): PaymentResult {
  const purse = player.purse ?? 0;
  const canPay = amount > 0 && purse >= amount;
  return canPay
    ? {
        player: { ...player, purse: purse - amount },
        npc: recordEvent({ ...npc, purse: npc.purse + amount }, { at, kind: 'work', summary: `${player.name} paid ${formatMoney(amount)} for ${reason}.` }),
        paid: true, problem: null,
      }
    : { player, npc, paid: false, problem: `${player.name} doesn't have ${formatMoney(amount)}.` };
}

/** An NPC pays a player, such as wages for work done. The NPC can't pay what they don't have. */
export function payPlayer(npc: Npc, player: PlayerCharacter, amount: number, reason: string, at: string): PaymentResult {
  const canPay = amount > 0 && npc.purse >= amount;
  return canPay
    ? {
        player: { ...player, purse: (player.purse ?? 0) + amount },
        npc: recordEvent({ ...npc, purse: npc.purse - amount }, { at, kind: 'work', summary: `Paid ${player.name} ${formatMoney(amount)} for ${reason}.` }),
        paid: true, problem: null,
      }
    : { player, npc, paid: false, problem: `${npc.name} can't afford ${formatMoney(amount)} right now.` };
}

/** A player's own living costs for a number of weeks. Running out leaves them in debt. */
export function chargePlayerLiving(player: PlayerCharacter, weeks: number): PlayerCharacter {
  return { ...player, purse: (player.purse ?? 0) - WEEKLY_LIVING_COST[player.societyRank ?? 'commoner'] * weeks };
}
