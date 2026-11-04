import { PlayerCharacter, Scenario } from '../../engine';

/**
 * WHAT GETS SAVED: one entry per world.
 *
 * It holds the engine's whole Scenario (the place, every NPC with their life log, the extras, the clock,
 * the sessions), plus everything about the player's side of play: their character, where they are, the
 * hour of the day, and the running transcript of what's been said and seen.
 */

export type LineKind = 'you' | 'npc' | 'narration' | 'news' | 'warning';

/** One line on the play screen: something the player did, someone said, or the world reported. */
export interface TranscriptLine {
  kind: LineKind;
  text: string;
  /** Who's speaking, for 'npc' lines. */
  speaker?: string;
}

export interface SavedWorld {
  id: string;
  name: string;
  scenario: Scenario;
  player: PlayerCharacter;
  /** The hour of the game day, 0 to 23. The date is the scenario's lastGameDate. */
  hour: number;
  transcript: TranscriptLine[];
  /** When it was last saved, in real time, for sorting the list of worlds. */
  updatedAt: string;
}

/** A short version for the list of worlds, so the list doesn't load every NPC's whole life. */
export interface WorldSummary {
  id: string;
  name: string;
  playerName: string;
  gameDate: string;
  mode: string;
  updatedAt: string;
}
