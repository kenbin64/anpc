import { checkConduct } from './conduct-guard';
import { AffiliationKind, MaritalStatus, RelationKind, WorkRole } from './npc.model';

/**
 * THE STORY: the parts of an NPC the AI writes.
 *
 * STORY_SCHEMA is a JSON Schema handed to the model, which makes the model answer in exactly this shape.
 * shapeStory() then checks and repairs what came back, because a model can still slip: an unknown role
 * becomes 'worker', a week of 9 tavern nights becomes 7. Nothing from the model reaches an NPC unchecked.
 */

const MARITAL: MaritalStatus[] = ['single', 'betrothed', 'married', 'widowed', 'divorced'];
const ROLES: WorkRole[] = ['owner', 'boss', 'worker', 'vendor', 'professional', 'tradesman', 'apprentice', 'none'];
const RELATIONS: RelationKind[] = [
  'spouse', 'child', 'parent', 'sibling', 'relative', 'friend', 'enemy', 'rival', 'customer', 'vendor', 'employer',
  'employee', 'acquaintance',
];
const AFFILIATIONS: AffiliationKind[] = ['church', 'guild', 'club', 'tavern'];

export const STORY_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    species: { type: 'string' },
    age: { type: 'integer' },
    maritalStatus: { type: 'string', enum: MARITAL },
    backstory: { type: 'string' },
    occupation: {
      type: ['object', 'null'],
      properties: { title: { type: 'string' }, workplace: { type: 'string' }, role: { type: 'string', enum: ROLES } },
      required: ['title', 'workplace', 'role'],
    },
    relationships: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' }, kind: { type: 'string', enum: RELATIONS },
          affinity: { type: 'integer' }, notes: { type: 'string' },
        },
        required: ['name', 'kind', 'affinity'],
      },
    },
    affiliations: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, kind: { type: 'string', enum: AFFILIATIONS } },
        required: ['name', 'kind'],
      },
    },
    abilities: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' } }, required: ['name', 'description'] },
    },
    routine: {
      type: 'object',
      properties: {
        workDaysPerWeek: { type: 'integer' }, tavernEveningsPerWeek: { type: 'integer' },
        familyEveningsPerWeek: { type: 'integer' }, worshipDay: { type: 'integer' },
      },
      required: ['workDaysPerWeek', 'tavernEveningsPerWeek', 'familyEveningsPerWeek', 'worshipDay'],
    },
    creature: {
      type: ['object', 'null'],
      properties: {
        canSpeak: { type: 'boolean' }, social: { type: 'string', enum: ['pack', 'loner'] },
        intellect: { type: 'integer' }, domestication: { type: 'integer' }, benevolence: { type: 'integer' },
      },
    },
  },
  required: ['name', 'species', 'age', 'maritalStatus', 'backstory', 'occupation', 'relationships', 'affiliations', 'abilities', 'routine', 'creature'],
} as const;

export interface Story {
  name: string;
  species: string;
  age: number;
  maritalStatus: MaritalStatus;
  backstory: string;
  occupation: { title: string; workplace: string; role: WorkRole } | null;
  relationships: { name: string; kind: RelationKind; affinity: number; notes?: string }[];
  affiliations: { name: string; kind: AffiliationKind }[];
  abilities: { name: string; description: string }[];
  routine: { workDaysPerWeek: number; tavernEveningsPerWeek: number; familyEveningsPerWeek: number; worshipDay?: number };
  creature: { canSpeak: boolean; social: 'pack' | 'loner'; intellect: number; domestication: number; benevolence: number } | null;
}

const clamp = (value: unknown, low: number, high: number, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(high, Math.max(low, Math.round(value))) : fallback;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Models sometimes write the WORD "null" or "none" instead of leaving a gap, so those count as missing. */
const EMPTY_WORDS = ['', 'null', 'none', 'undefined', 'n/a', 'unknown'];

/**
 * Accepts a piece of the model's writing only if it's real text AND within the conduct rules. Anything
 * sexual or cruel beyond ordinary fighting is thrown out and the plain fallback used instead.
 */
const text = (value: unknown, fallback: string): string =>
  typeof value === 'string' && !EMPTY_WORDS.includes(value.trim().toLowerCase()) && checkConduct(value).allowed
    ? value.trim()
    : fallback;

const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(item => typeof item === 'object' && item !== null) : [];

/** Turns whatever the model sent into a valid Story, repairing anything out of range or missing. */
export function shapeStory(raw: unknown, isCreature: boolean): Story {
  const source = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const job = source['occupation'] as Record<string, unknown> | null | undefined;
  const habits = (source['routine'] ?? {}) as Record<string, unknown>;
  const beast = source['creature'] as Record<string, unknown> | null | undefined;
  const worshipDay = clamp(habits['worshipDay'], -1, 6, -1);
  return {
    name: text(source['name'], 'Nameless'),
    species: text(source['species'], isCreature ? 'beast' : 'human'),
    age: clamp(source['age'], 1, 500, 30),
    maritalStatus: oneOf(source['maritalStatus'], MARITAL, 'single'),
    backstory: text(source['backstory'], 'Their past is unknown.'),
    occupation: job && !isCreature
      ? { title: text(job['title'], 'laborer'), workplace: text(job['workplace'], 'the village'), role: oneOf(job['role'], ROLES, 'worker') }
      : null,
    relationships: list(source['relationships']).slice(0, 12).map(tie => ({
      name: text(tie['name'], 'someone'), kind: oneOf(tie['kind'], RELATIONS, 'friend'),
      affinity: clamp(tie['affinity'], 0, 100, 50),
      notes: typeof tie['notes'] === 'string' && checkConduct(tie['notes']).allowed ? tie['notes'] : undefined,
    })),
    affiliations: list(source['affiliations']).slice(0, 6).map(group => ({
      name: text(group['name'], 'a local group'), kind: oneOf(group['kind'], AFFILIATIONS, 'club'),
    })),
    abilities: list(source['abilities']).slice(0, 4).map(ability => ({
      name: text(ability['name'], 'a knack'), description: text(ability['description'], ''),
    })),
    routine: {
      workDaysPerWeek: isCreature ? 0 : clamp(habits['workDaysPerWeek'], 0, 7, 5),
      tavernEveningsPerWeek: isCreature ? 0 : clamp(habits['tavernEveningsPerWeek'], 0, 7, 1),
      familyEveningsPerWeek: clamp(habits['familyEveningsPerWeek'], 0, 7, 2),
      worshipDay: worshipDay >= 0 && !isCreature ? worshipDay : undefined,
    },
    creature: isCreature
      ? {
          canSpeak: beast?.['canSpeak'] === true,
          social: oneOf(beast?.['social'], ['pack', 'loner'] as const, 'loner'),
          intellect: clamp(beast?.['intellect'], 0, 100, 30),
          domestication: clamp(beast?.['domestication'], 0, 100, 10),
          benevolence: clamp(beast?.['benevolence'], 0, 100, 40),
        }
      : null,
  };
}
