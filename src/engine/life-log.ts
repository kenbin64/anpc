import { FieldChange, LifeEvent, Npc } from './npc.model';

/**
 * THE LIFE LOG: the only way an NPC changes.
 *
 * Every function here returns a NEW npc and leaves the old one alone, and every change is written to the
 * log with its reason. So a game can always answer "why is this blacksmith a drunk now?" by reading the
 * log, and an NPC that wakes up after months away still carries everything that happened to it.
 */

/** Adds one event to the end of the log. */
export function recordEvent(npc: Npc, event: LifeEvent): Npc {
  return { ...npc, lifeLog: [...npc.lifeLog, event] };
}

/** Reads a dotted path such as "social.reputation". */
export function readField(npc: Npc, field: string): unknown {
  let value: unknown = npc;
  for (const part of field.split('.')) {
    value = value === null || value === undefined ? undefined : (value as Record<string, unknown>)[part];
  }
  return value;
}

/** Writes a dotted path on a copy, copying each object along the way so the original stays untouched. */
function writeField(npc: Npc, field: string, value: unknown): Npc {
  const parts = field.split('.');
  const updated = structuredClone(npc) as unknown as Record<string, unknown>;
  let target = updated;
  for (const part of parts.slice(0, -1)) {
    target = target[part] as Record<string, unknown>;
  }
  target[parts[parts.length - 1]] = value;
  return updated as unknown as Npc;
}

/**
 * Changes one field and hands back the change, WITHOUT a log entry of its own. Use it for small routine
 * changes that belong inside a bigger entry, such as a week's slow healing, and put the returned change
 * in that entry's `changes`. It is still documented, just grouped.
 */
export function changeFieldInto(npc: Npc, field: string, value: unknown, reason: string): { npc: Npc; change: FieldChange } {
  return { npc: writeField(npc, field, value), change: { field, from: readField(npc, field), to: value, reason } };
}

/** Changes one field and logs the change with its reason, in a single step. */
export function changeField(npc: Npc, field: string, value: unknown, reason: string, at: string): Npc {
  const change: FieldChange = { field, from: readField(npc, field), to: value, reason };
  const changed = writeField(npc, field, value);
  return recordEvent(changed, { at, kind: 'change', summary: reason, changes: [change] });
}

/** Moves a 0 to 100 dial by an amount, kept inside 0 to 100, and logs it. */
export function shiftDial(npc: Npc, field: string, amount: number, reason: string, at: string): Npc {
  const current = Number(readField(npc, field));
  return changeField(npc, field, Math.min(100, Math.max(0, current + amount)), reason, at);
}

/** Everything logged after a game date: what a game reads to catch up on an NPC. */
export function eventsSince(npc: Npc, since: string): LifeEvent[] {
  return npc.lifeLog.filter(event => event.at > since);
}
