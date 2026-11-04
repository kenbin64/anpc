import { CoreStats, Npc, Temperament } from './npc.model';
import { changeField, recordEvent } from './life-log';

/**
 * HEALTH EFFECTS: how being unwell weighs on everything else, and how death is recorded.
 *
 * The NPC's stored stats are who they are when healthy. These functions work out who they are TODAY:
 * below 70 condition they start to lose strength, stamina, temper and work ethic, and the lower they go,
 * the more they lose. A game should read the effective numbers when deciding what an NPC can do.
 */

const HEALTHY_LINE = 70;

/** 0 when healthy, rising toward 1 as condition falls to zero. */
export function calculateFrailty(npc: Npc): number {
  return Math.max(0, HEALTHY_LINE - npc.health.condition) / HEALTHY_LINE;
}

/** Stats as they are today. Body stats suffer most, the mind a little. Nothing drops below 3. */
export function calculateEffectiveStats(npc: Npc): CoreStats {
  const frailty = calculateFrailty(npc);
  const weaken = (value: number, share: number) => Math.max(3, Math.round(value - value * frailty * share));
  return {
    strength: weaken(npc.stats.strength, 0.6),
    dexterity: weaken(npc.stats.dexterity, 0.4),
    constitution: weaken(npc.stats.constitution, 0.6),
    intelligence: weaken(npc.stats.intelligence, 0.15),
    wisdom: weaken(npc.stats.wisdom, 0.15),
    charisma: weaken(npc.stats.charisma, 0.25),
  };
}

/** Temperament as it is today. Pain and sickness shorten the temper, so disposition drops. */
export function calculateEffectiveTemperament(npc: Npc): Temperament {
  const frailty = calculateFrailty(npc);
  return { ...npc.temperament, disposition: Math.round(npc.temperament.disposition * (1 - frailty * 0.3)) };
}

/** Work ethic as it is today. A sick hard worker still works less. */
export function calculateEffectiveWorkEthic(npc: Npc): number {
  const workEthic = npc.occupation?.workEthic ?? 0;
  return Math.round(workEthic * (1 - calculateFrailty(npc) * 0.7));
}

/** Records a death. Dead NPCs stay in the game's records, but their lives stop advancing. */
export function recordDeath(npc: Npc, cause: string, at: string): Npc {
  const dead = changeField(changeField(npc, 'health.alive', false, `Died: ${cause}`, at), 'health.condition', 0, `Died: ${cause}`, at);
  const withDeath = { ...dead, health: { ...dead.health, death: { at, cause } } };
  return recordEvent(withDeath, { at, kind: 'death', summary: `${npc.name} died. Cause: ${cause}.` });
}
