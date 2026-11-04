import { talkToNpc, ConversationTurn } from './conversation';
import { changeField, recordEvent } from './life-log';
import { calculateEffectiveWorkEthic } from './health';
import { Npc, PlayerCharacter } from './npc.model';
import { Dice } from './random';
import { ChatModel } from './story-writers';
import { findWhereabouts, isPresentAt } from './whereabouts';
import { EraName } from './world-setup';

/**
 * MEETING: a player and an ANPC have to be in the same place to talk. There is no teleporting.
 *
 * A player can go to the NPC, or send someone to fetch them. Sending for someone is a request, not a
 * command: the NPC decides by their own life and feelings. The dead can't come, the sick are too ill, a
 * hard worker finishes their shift first, and someone who dislikes the sender simply won't. If they agree,
 * the summons is written onto them, and their whereabouts follow it for the hours it covers.
 */

export interface ApproachResult {
  /** The conversation, if they were there to have one. */
  turn: ConversationTurn | null;
  /** When they weren't there: where they are and what they're doing, so the player can go or send for them. */
  notHere: string | null;
}

/** Talks to the NPC only if they're where the player is; otherwise says where they are instead. */
export async function approachAndTalk(
  npc: Npc, player: PlayerCharacter, message: string, chat: ChatModel, dice: Dice,
  date: string, hour: number, setting: string, era: EraName = 'medieval', neighbors: readonly string[] = [],
): Promise<ApproachResult> {
  const here = player.location !== undefined && isPresentAt(npc, player.location, date, hour);
  const whereabouts = findWhereabouts(npc, date, hour);
  const notHere = `${npc.name} isn't here. They're at ${whereabouts.place}, ${whereabouts.activity}. ` +
    'Travel there, or send someone to fetch them.';
  return here
    ? { turn: await talkToNpc(npc, player, message, chat, dice, date, setting, era, neighbors), notHere: null }
    : { turn: null, notHere };
}

export interface FetchResult {
  npc: Npc;
  comes: boolean;
  /** The hour they'll arrive, if they come. */
  arrivesAtHour: number | null;
  /** What the messenger reports back. */
  report: string;
}

/** How long a summons holds once they arrive. */
const MEETING_HOURS = 2;

export function sendForNpc(
  npc: Npc, sender: { name: string; playerId?: string; npcId?: string }, place: string,
  messenger: string, date: string, hour: number, dice: Dice,
): FetchResult {
  const tie = npc.relationships.find(other =>
    (sender.playerId !== undefined && other.playerId === sender.playerId) || (sender.npcId !== undefined && other.npcId === sender.npcId));
  const affinity = tie?.affinity ?? 50;
  const whereabouts = findWhereabouts(npc, date, hour);
  const busyWorking = whereabouts.activity.startsWith('working') && dice.happens(calculateEffectiveWorkEthic(npc));
  const arrivesAtHour = busyWorking ? 18 : Math.min(23, hour + 1);

  let report = `${npc.name} agreed to come, and will be at ${place} by ${arrivesAtHour}:00.`;
  let comes = true;
  if (!npc.health.alive) {
    report = `${npc.name} is dead and buried.`;
    comes = false;
  } else if (npc.health.ailments.length > 0) {
    report = `${npc.name} is too sick to come, laid up with ${npc.health.ailments[0]}.`;
    comes = false;
  } else if (affinity < 30 || dice.happens(npc.temperament.randomness / 5)) {
    report = `${npc.name} sent ${messenger} away and would not come.`;
    comes = false;
  } else if (busyWorking) {
    report = `${npc.name} said they'd come once their work is done, by 18:00, to ${place}.`;
  }

  const summons = { place, by: sender.name, date, fromHour: arrivesAtHour, untilHour: Math.min(24, arrivesAtHour + MEETING_HOURS) };
  const answered = comes
    ? changeField(npc, 'summonedTo', summons, `${sender.name} sent ${messenger} to fetch them`, date)
    : recordEvent(npc, { at: date, kind: 'choice', summary: `${sender.name} sent ${messenger} for them. ${report}` });
  return { npc: answered, comes, arrivesAtHour: comes ? arrivesAtHour : null, report };
}

/**
 * A PLAYER CHARACTER DIES: that character's story is over. Every NPC who knew them remembers the death.
 *
 * The human may step back into the same world as a new character. To the world, that new character is a
 * stranger: the human behind both is outside the world, so nothing carries over.
 */
export function recordPlayerDeath(npcs: readonly Npc[], player: PlayerCharacter, cause: string, at: string): Npc[] {
  return npcs.map(npc => {
    const knewThem = npc.relationships.some(tie => tie.playerId === player.id);
    return knewThem ? recordEvent(npc, { at, kind: 'social', summary: `Heard that ${player.name} died. Cause: ${cause}.` }) : npc;
  });
}
