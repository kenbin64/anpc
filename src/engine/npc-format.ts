import { NPC_SCHEMA_VERSION, Npc } from './npc.model';

/**
 * THE INTEGRATION FORMAT: an NPC as one JSON file any game can read.
 *
 * exportNpc() writes the file. importNpc() reads one back and checks it before trusting it, since a file
 * may have been edited by hand or come from a game with bugs. The checks match anpc.schema.json, which is
 * the published description for games written in other languages.
 */

export interface ImportResult {
  npc: Npc | null;
  problems: string[];
}

const DIAL_FIELDS = [
  'temperament.disposition', 'temperament.honesty', 'temperament.alignment', 'temperament.randomness',
  'social.peerRank', 'social.reputation', 'health.condition',
];

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((value, part) => (value as Record<string, unknown> | undefined)?.[part], source);
}

/** Lists everything wrong with a candidate NPC. An empty list means it's safe to use. */
export function findProblems(candidate: unknown): string[] {
  const problems: string[] = [];
  const npc = candidate as Partial<Npc>;
  if (typeof candidate !== 'object' || candidate === null) problems.push('Not an object.');
  if (npc?.schemaVersion !== NPC_SCHEMA_VERSION) problems.push(`schemaVersion must be ${NPC_SCHEMA_VERSION}.`);
  for (const field of ['id', 'name', 'species', 'backstory', 'livedUntil'] as const) {
    if (typeof npc?.[field] !== 'string' || npc[field] === '') problems.push(`${field} is missing.`);
  }
  for (const field of DIAL_FIELDS) {
    const value = readPath(candidate, field);
    if (typeof value !== 'number' || value < 0 || value > 100) problems.push(`${field} must be a number from 0 to 100.`);
  }
  if (typeof npc?.purse !== 'number' || !Number.isInteger(npc.purse)) problems.push('purse must be a whole number of coins.');
  if (typeof npc?.lifeExpectancy !== 'number' || npc.lifeExpectancy <= 0) problems.push('lifeExpectancy must be a positive number.');
  for (const field of ['relationships', 'affiliations', 'abilities', 'lifeLog'] as const) {
    if (!Array.isArray(npc?.[field])) problems.push(`${field} must be a list.`);
  }
  return problems;
}

export function exportNpc(npc: Npc): string {
  return JSON.stringify(npc, null, 2);
}

export function importNpc(text: string): ImportResult {
  let parsed: unknown = null;
  let problems: string[] = [];
  try {
    parsed = JSON.parse(text);
    problems = findProblems(parsed);
  } catch {
    problems = ['The file is not valid JSON.'];
  }
  return { npc: problems.length === 0 ? (parsed as Npc) : null, problems };
}
