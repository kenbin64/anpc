import { ageForward, isFrail, oldAgeDeathChance } from './lifespan';
import { recordPlayerDeath } from './meeting';
import { Dice } from './random';
import { changeField } from './life-log';
import { Classification, LifeEvent, Npc, PlayerCharacter } from './npc.model';
import { generateNpc } from './npc-generator';
import { StoryWriter } from './story-writers';
import { Scenario, catchUpScenario } from './scenario';

/**
 * PLAYER SESSIONS: games never end, they only pause.
 *
 * When a player logs out, the world keeps living. When they log back in, everyone is caught up to now,
 * not to where the player left off, and the player gets a welcome-back report: how much game time passed,
 * and the important things that happened while they were gone, with anything involving them first.
 *
 * A player's character is only ever in danger while they're actually playing. Logged out, the character
 * is out of the world and safe. The engine refuses to kill a character whose player isn't in a session,
 * so nobody logs in to find their character died while they were away.
 */

export interface PlayerSession {
  playerId: string;
  name: string;
  /** True while the player is logged in and playing. */
  playing: boolean;
  /** The game date when they last stopped playing. Their next welcome-back report starts here. */
  lastGameDate: string;
  /** True once this character has died in play. The player re-enters as a new character. */
  characterDead: boolean;
  /** True once the player has retired this character into an ANPC. The player re-enters as a new character. */
  retired?: boolean;
}

export interface WelcomeBack {
  scenario: Scenario;
  /** The player's character, aged by the time that passed while they were away. */
  player: PlayerCharacter;
  /** A gentle warning when their character is near the end of their life. Empty otherwise. */
  frailty: string;
  /** "While you were away, 4 weeks passed..." Empty when no time passed. */
  timeJump: string;
  /** Important events since they left, anything involving them first. */
  news: string[];
}

/**
 * How much each kind of event matters to a returning player. Routine summaries aren't news. Follow-on
 * entries that only repeat the main one ("Weakened by...", "Hurt in a tavern brawl") are left out too.
 */
const NEWS_WEIGHT: Partial<Record<LifeEvent['kind'], number>> = {
  death: 5, family: 4, conflict: 3, choice: 3, work: 2, social: 2, change: 1,
};
const ECHOES = [/^Weakened by/, /^Getting their strength/, /^Hurt in a tavern brawl/, /^Started a brawl/, /^Treatment no longer/, /^A year older/];
const NEWS_LIMIT = 10;

function describeGap(from: string, to: string): string {
  const days = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
  const weeks = Math.floor(days / 7);
  const span = weeks >= 1 ? `${weeks} week${weeks === 1 ? '' : 's'}` : `${days} day${days === 1 ? '' : 's'}`;
  return days > 0 ? `While you were away, ${span} passed in the world (from ${from} to ${to}).` : '';
}

/**
 * The news since a date. Anything mentioning the player comes first, then the weightiest, then the most
 * recent. The chosen items are then shown in date order, so they read like a story.
 */
function gatherNews(npcs: readonly Npc[], since: string, playerName: string): string[] {
  const items = npcs.flatMap(npc =>
    npc.lifeLog
      .filter(event => event.at > since && NEWS_WEIGHT[event.kind] !== undefined && !ECHOES.some(echo => echo.test(event.summary)))
      .map(event => ({
        at: event.at,
        aboutPlayer: event.summary.includes(playerName),
        weight: NEWS_WEIGHT[event.kind]!,
        text: event.summary.includes(npc.name) ? `${event.at}: ${event.summary}` : `${event.at}: ${npc.name}: ${event.summary}`,
      })));
  return items
    .sort((first, second) =>
      Number(second.aboutPlayer) - Number(first.aboutPlayer) || second.weight - first.weight || second.at.localeCompare(first.at))
    .slice(0, NEWS_LIMIT)
    .sort((first, second) => first.at.localeCompare(second.at))
    .map(item => item.text);
}

/** Logs a player in: catches the world up to now, and tells them what changed while they were gone. */
export function logIn(scenario: Scenario, player: PlayerCharacter, realNow: Date): WelcomeBack {
  const caughtUp = catchUpScenario(scenario, realNow);
  const known = caughtUp.sessions.find(session => session.playerId === player.id);
  const since = known?.lastGameDate ?? caughtUp.lastGameDate;
  const session: PlayerSession = {
    playerId: player.id, name: player.name, playing: true, lastGameDate: since, characterDead: known?.characterDead ?? false,
  };
  const sessions = [...caughtUp.sessions.filter(other => other.playerId !== player.id), session];
  const gameYearsAway = Math.floor((Date.parse(caughtUp.lastGameDate) - Date.parse(since)) / 31_557_600_000);
  const aged = player.age === undefined ? player : { ...player, age: ageForward(player.age, gameYearsAway) };
  const frail = aged.age !== undefined && aged.lifeExpectancy !== undefined && isFrail(aged.age, aged.lifeExpectancy);
  return {
    scenario: { ...caughtUp, sessions },
    player: aged,
    frailty: frail ? `${aged.name} is ${aged.age} now and growing frail. Their days are numbered.` : '',
    timeJump: known ? describeGap(since, caughtUp.lastGameDate) : '',
    news: known ? gatherNews(caughtUp.npcs, since, player.name) : [],
  };
}

/**
 * Old age comes for player characters too, but only while they're playing. The game calls this as time
 * passes during play, such as once per game week; a death is handled like any other death in play.
 */
export function checkPlayerOldAge(
  scenario: Scenario, player: PlayerCharacter, dice: Dice, at: string,
): { scenario: Scenario; died: boolean } {
  const chance = player.age !== undefined && player.lifeExpectancy !== undefined ? oldAgeDeathChance(player.age, player.lifeExpectancy) : 0;
  const dies = isPlaying(scenario, player.id) && dice.happens(chance);
  return dies ? { scenario: killPlayerCharacter(scenario, player, 'old age', at).scenario, died: true } : { scenario, died: false };
}

/** Logs a player out. The game pauses for them, not for the world. */
export function logOut(scenario: Scenario, playerId: string): Scenario {
  const sessions = scenario.sessions.map(session =>
    session.playerId === playerId ? { ...session, playing: false, lastGameDate: scenario.lastGameDate } : session);
  return { ...scenario, sessions };
}

export function isPlaying(scenario: Scenario, playerId: string): boolean {
  return scenario.sessions.some(session =>
    session.playerId === playerId && session.playing && !session.characterDead && !session.retired);
}

/**
 * RETIREMENT: a player can hand their character over to the world. The character becomes an ANPC who
 * goes on living, and the player starts fresh with someone new.
 *
 * The AI writes the retired character's life from what the world remembers about them: everything the
 * NPCs' logs say they did. Their name, age, looks and purse stay as they were. Everyone who knew them
 * keeps knowing them, now as a full ANPC, and the ties run both ways. A character can only be retired
 * by their player, during play.
 */
export async function retireCharacter(
  scenario: Scenario, player: PlayerCharacter, classification: Classification, writeStory: StoryWriter, at: string,
): Promise<{ scenario: Scenario; retiree: Npc | null; refusal: string | null }> {
  if (!isPlaying(scenario, player.id)) {
    return { scenario, retiree: null, refusal: `${player.name} can only be retired by their player, during play.` };
  }
  const id = `retired-${player.id}`;
  const remembered = scenario.npcs
    .flatMap(npc => npc.lifeLog.filter(event => event.summary.includes(player.name)).map(event => event.summary))
    .slice(-8);
  const settlement = scenario.settlement;
  const generated = await generateNpc({
    classification,
    era: settlement.era,
    setting: `${settlement.name}, a ${settlement.size} in ${settlement.setting}`,
    seed: `${scenario.worldSeed}:${id}`,
    hints: [
      `This is ${player.name}, ${player.description}, who has decided to settle down for good in ${settlement.name}.`,
      remembered.length ? `What people remember about them: ${remembered.join(' ')}` : '',
      'Their name and looks are fixed; build their story around what people remember.',
    ].filter(Boolean).join(' '),
  }, writeStory, at);

  const knewThem = scenario.npcs.filter(npc => npc.relationships.some(tie => tie.playerId === player.id));
  const tiesBack = knewThem.map(npc => {
    const theirTie = npc.relationships.find(tie => tie.playerId === player.id)!;
    return { name: npc.name, kind: theirTie.kind, affinity: theirTie.affinity, npcId: npc.id };
  });
  const age = player.age ?? generated.age;
  const retiree: Npc = {
    ...generated,
    id,
    name: player.name,
    age,
    lifeExpectancy: player.lifeExpectancy ?? Math.max(generated.lifeExpectancy, age + 5),
    purse: player.purse ?? generated.purse,
    relationships: [...tiesBack, ...generated.relationships.filter(tie => !tiesBack.some(back => back.name === tie.name))],
    lifeLog: [{ at, kind: 'created', summary: `${player.name} settled down for good in ${settlement.name}.` }],
  };
  const npcs = scenario.npcs.map(npc => {
    const tieIndex = npc.relationships.findIndex(tie => tie.playerId === player.id);
    return tieIndex < 0
      ? npc
      : changeField(npc, `relationships.${tieIndex}`, { ...npc.relationships[tieIndex], playerId: undefined, npcId: id },
          `${player.name} settled down in ${settlement.name} for good`, at);
  });
  const sessions = scenario.sessions.map(session =>
    session.playerId === player.id ? { ...session, playing: false, retired: true, lastGameDate: at } : session);
  return { scenario: { ...scenario, npcs: [...npcs, retiree], sessions }, retiree, refusal: null };
}

/**
 * Kills a player's character, but only during their actual play. Otherwise it refuses, and nothing
 * changes. A killed character's session ends; the player can come back as a new character.
 */
export function killPlayerCharacter(
  scenario: Scenario, player: PlayerCharacter, cause: string, at: string,
): { scenario: Scenario; killed: boolean; refusal: string | null } {
  const inPlay = isPlaying(scenario, player.id);
  const sessions = scenario.sessions.map(session =>
    session.playerId === player.id ? { ...session, playing: false, characterDead: true, lastGameDate: at } : session);
  return inPlay
    ? { scenario: { ...scenario, npcs: recordPlayerDeath(scenario.npcs, player, cause, at), sessions }, killed: true, refusal: null }
    : { scenario, killed: false, refusal: `${player.name} is not in play. A character can only die while their player is playing.` };
}
