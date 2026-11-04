/**
 * THE NPC FORMAT: everything an autonomous character is.
 *
 * This file is the contract between ANPC and any game. A game that reads this shape can load an NPC, and
 * anpc.schema.json publishes the same shape for games that aren't written in TypeScript.
 *
 * Every 0 to 100 trait is a dial between two ends, written as low end to high end in its comment. The
 * engine never reads them as fixed rules; they are the NPC's nature, and the randomness dial decides how
 * often the NPC goes against it.
 *
 * The engine has no Angular in it on purpose, so it can be lifted out and used by any game.
 */

export const NPC_SCHEMA_VERSION = 1;

/**
 * A dial from 0 to 100.
 * @minimum 0
 * @maximum 100
 */
export type Scale = number;

export type Classification =
  | 'gentleman' | 'noble' | 'rogue' | 'barbarian' | 'thief' | 'monster' | 'animal' | 'vagabond';

export type SocietyRank = 'outcast' | 'peasant' | 'commoner' | 'merchant' | 'gentry' | 'noble' | 'royal';

export type MaritalStatus = 'single' | 'betrothed' | 'married' | 'widowed' | 'divorced';

export type WorkRole =
  | 'owner' | 'boss' | 'worker' | 'vendor' | 'professional' | 'tradesman' | 'apprentice' | 'none';

export type RelationKind =
  | 'spouse' | 'child' | 'parent' | 'sibling' | 'relative'
  | 'friend' | 'enemy' | 'rival' | 'customer' | 'vendor' | 'employer' | 'employee' | 'acquaintance';

export type AffiliationKind = 'church' | 'guild' | 'club' | 'tavern';

/** The usual character stats, 3 to 18. */
export interface CoreStats {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
  charisma: number;
}

/** The dials that drive behavior. */
export interface Temperament {
  /** violent (0) to rational (100): how a conflict gets settled. */
  disposition: Scale;
  /** liar (0) to honest (100). */
  honesty: Scale;
  /** evil (0) to good (100). */
  alignment: Scale;
  /** loyal to their nature (0) to unpredictable (100): the chance of acting against type. */
  randomness: Scale;
}

/** Two ranks: where they stand in society, and where they stand among their own kind. */
export interface SocialStanding {
  societyRank: SocietyRank;
  /** bottom (0) to leader (100) of their peer group. */
  peerRank: Scale;
  /** despised (0) to celebrated (100). */
  reputation: Scale;
}

export interface Occupation {
  title: string;
  workplace: string;
  role: WorkRole;
  /** novice (0) to master (100). */
  experience: Scale;
  /** lazy (0) to hard worker (100). */
  workEthic: Scale;
}

/**
 * A tie to another person or creature. `npcId` is set once that one is a full ANPC. `extraId` is set while
 * they're still an extra: known by name, never yet met on screen.
 */
export interface Relationship {
  name: string;
  kind: RelationKind;
  /** hatred (0) to love (100). */
  affinity: Scale;
  npcId?: string;
  extraId?: string;
  /** Set when the tie is to a human player's character. */
  playerId?: string;
  notes?: string;
}

/**
 * A PLAYER CHARACTER: played by a real human, who talks to NPCs directly.
 *
 * The NPC only ever knows the in-world side: a name and how they look and carry themselves. Who the human
 * behind them is stays outside the world.
 */
export interface PlayerCharacter {
  id: string;
  name: string;
  /** How they appear in the world, such as "a road-worn sellsword with a scarred jaw". */
  description: string;
}

/**
 * AN EXTRA: someone who exists but doesn't live a simulated life. Family that's talked about but never
 * seen, regulars who fill a tavern, faces in a market crowd.
 *
 * Extras are cheap: a name, a species, a line or two and who knows them. Nothing simulates them, so a
 * village can hold hundreds. The moment a player or an NPC chooses to deal with one, it gets PROMOTED
 * (see extras.ts) into a full NPC whose story fits everything already said about them.
 */
export interface Extra {
  id: string;
  name: string;
  species: string;
  /** A line or two, such as "the miller's quiet son" or "a regular at the Gilded Goose". */
  description: string;
  /** The classification they'll get if promoted. */
  classification: Classification;
  /**
   * Full NPCs who know them, and how. `npcDescription` says who that NPC is ("a blacksmith at the village
   * forge"), so a promoted extra's story can't contradict the people already in the world.
   */
  knownBy: { npcId: string; npcName: string; npcDescription: string; kind: RelationKind; notes?: string }[];
}

export interface Affiliation {
  name: string;
  kind: AffiliationKind;
  /** outsider (0) to pillar (100) of that church, guild, club or tavern. */
  standing: Scale;
}

/** Only monsters and animals have these. */
export interface CreatureTraits {
  /** malevolent (0) through benign (50) to benevolent (100). */
  benevolence: Scale;
  canSpeak: boolean;
  /** pure instinct (0) to fully intelligent (100). */
  intellect: Scale;
  /** wild (0) to domesticated (100). */
  domestication: Scale;
  social: 'pack' | 'loner';
}

export interface SpecialAbility {
  name: string;
  description: string;
}

/**
 * HEALTH: autonomous NPCs can sicken, heal and die, on screen or off.
 *
 * Health weighs on everything else. A sick or injured NPC is weaker, works less and has a shorter temper,
 * but the base numbers stay as they were. The engine works out the weakened numbers when it needs them
 * (see health.ts), so an NPC who recovers gets their old self back without anything being restored by hand.
 */
export interface Health {
  /** dying (0) to in perfect health (100). */
  condition: Scale;
  /** Current illnesses and injuries, such as "broken arm" or "winter fever". */
  ailments: string[];
  alive: boolean;
  /** Set when they die: the game date and the cause. */
  death?: { at: string; cause: string };
  /** Who is paying for their treatment while they're ill. Care makes recovery more likely. */
  caredForBy?: string;
}

/** How a typical week of their life runs, in evenings and days. */
export interface Routine {
  workDaysPerWeek: number;
  tavernEveningsPerWeek: number;
  familyEveningsPerWeek: number;
  /** 0 is Sunday. Absent if they don't attend worship. */
  worshipDay?: number;
}

/** One change to one field, with the reason, so nothing about an NPC changes silently. */
export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
  reason: string;
}

/**
 * 'period' is the one routine entry: a summary of a whole stretch of ordinary living, with the net change
 * to every number that drifted. Every other kind is something important enough to matter in play.
 */
export type LifeEventKind =
  | 'created' | 'period' | 'work' | 'family' | 'social' | 'conflict' | 'choice' | 'change' | 'health' | 'death';

/**
 * One entry in the life log. `at` is a date in the game world, not the real world.
 *
 * The log keeps what matters in play, not every moment. Fights, illness, choices, conversations, deaths
 * and big changes get entries of their own. Ordinary weeks are rolled into one 'period' entry per
 * stretch of living, so nothing is lost, but nothing important gets buried either.
 */
export interface LifeEvent {
  at: string;
  kind: LifeEventKind;
  summary: string;
  changes?: FieldChange[];
}

export interface Npc {
  schemaVersion: number;
  id: string;
  name: string;
  species: string;
  age: number;
  classification: Classification;
  maritalStatus: MaritalStatus;
  backstory: string;
  stats: CoreStats;
  health: Health;
  temperament: Temperament;
  social: SocialStanding;
  occupation: Occupation | null;
  relationships: Relationship[];
  affiliations: Affiliation[];
  creature: CreatureTraits | null;
  abilities: SpecialAbility[];
  routine: Routine;
  /** The game date the NPC's life has been lived up to. */
  livedUntil: string;
  /** Everything that ever happened to them or changed about them, oldest first. */
  lifeLog: LifeEvent[];
}
