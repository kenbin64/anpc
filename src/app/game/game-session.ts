import { Injectable, computed, inject, signal } from '@angular/core';
import {
  Npc, addDays, approachAndTalk, createDice, findWhereabouts, formatMoney, isPresentAt, logIn, logOut, payNpc,
  recapSince, sendForNpc, summonRoleHolder,
} from '../../engine';
import { AiConnection } from '../ai/ai-connection';
import { SavedWorld, TranscriptLine } from '../storage/saved-world';
import { WorldStore } from '../storage/world-store';
import { Command, HELP_TEXT, parseCommand, stripArticle } from './commands';

/**
 * LAYER 4, THE GAME SESSION: one turn of play at a time.
 *
 * This service is the bridge between the screen and the engine. The play page hands it whatever the
 * player typed; it reads the command, asks the engine what happens, writes the result into the transcript,
 * and saves the world. The page itself only shows signals and passes along keystrokes.
 *
 * It uses @Injectable() WITHOUT providedIn: 'root'. The play page lists it in its own `providers`, so
 * each visit to the play page gets a fresh session that goes away when the player leaves. That's a
 * COMPONENT-LEVEL PROVIDER, the right fit for state that belongs to one screen rather than the whole app.
 *
 * Opening the session logs the player in, which catches the world up and brings the welcome-back news.
 * Leaving logs them out, which pauses their part of the game.
 */
@Injectable()
export class GameSession {
  private readonly worldStore = inject(WorldStore);
  private readonly ai = inject(AiConnection);

  private readonly world = signal<SavedWorld | null>(null);
  private lastSpokenTo = '';

  readonly busy = signal(false);
  readonly ready = computed(() => this.world() !== null);
  readonly worldName = computed(() => this.world()?.name ?? '');
  readonly transcript = computed(() => this.world()?.transcript ?? []);
  readonly player = computed(() => this.world()?.player);
  readonly place = computed(() => this.world()?.player.location ?? '');
  readonly hour = computed(() => this.world()?.hour ?? 9);
  readonly date = computed(() => this.world()?.scenario.lastGameDate ?? '');
  readonly purse = computed(() => formatMoney(this.world()?.player.purse ?? 0));
  readonly objective = computed(() => this.world()?.scenario.rules.objective ?? '');

  /** Everyone at the player's place right now, alive. Recomputed whenever time or place changes. */
  readonly peopleHere = computed(() => {
    const world = this.world();
    return world
      ? world.scenario.npcs.filter(npc => npc.health.alive && isPresentAt(npc, world.player.location ?? '', this.date(), this.hour()))
      : [];
  });

  /** Every place the player knows of: workplaces, homes, churches, taverns, and the roles' workplaces. */
  readonly knownPlaces = computed(() => {
    const world = this.world();
    const places = new Set<string>();
    for (const npc of world?.scenario.npcs ?? []) {
      if (npc.occupation) places.add(npc.occupation.workplace);
      npc.affiliations.filter(group => group.kind !== 'guild').forEach(group => places.add(group.name));
      places.add(`${npc.name}'s home`);
    }
    world?.scenario.settlement.roles.forEach(role => places.add(role.workplace));
    if (world) places.add(`${world.scenario.settlement.name} square`);
    return [...places].sort();
  });

  /** Opens a world: logging in catches it up to now and brings the welcome-back news. */
  async open(worldId: string, realNow: Date = new Date()): Promise<void> {
    const saved = await this.worldStore.load(worldId);
    if (saved) {
      const welcome = logIn(saved.scenario, saved.player, realNow);
      const lines: TranscriptLine[] = [
        ...(welcome.timeJump ? [{ kind: 'news' as const, text: welcome.timeJump }] : []),
        ...welcome.news.map(item => ({ kind: 'news' as const, text: item })),
        ...(welcome.frailty ? [{ kind: 'warning' as const, text: welcome.frailty }] : []),
      ];
      await this.commit({ ...saved, scenario: welcome.scenario, player: welcome.player }, lines);
    }
  }

  async leave(): Promise<void> {
    const world = this.world();
    if (world) await this.worldStore.save({ ...world, scenario: logOut(world.scenario, world.player.id) });
  }

  /** One turn: echo what the player typed, carry it out, and save. */
  async run(input: string): Promise<void> {
    const world = this.world();
    const canRun = world !== null && input.trim() !== '' && !this.busy();
    if (canRun) {
      this.busy.set(true);
      try {
        const echoed: SavedWorld = { ...world, transcript: [...world.transcript, { kind: 'you', text: input.trim() }] };
        this.world.set(echoed);
        const outcome = await this.carryOut(parseCommand(input), echoed);
        await this.commit(outcome.world, outcome.lines);
      } finally {
        this.busy.set(false);
      }
    }
  }

  /** Sends each kind of command to the method that handles it. One case per command, one return at the end. */
  private async carryOut(command: Command, world: SavedWorld): Promise<{ world: SavedWorld; lines: TranscriptLine[] }> {
    const say = (text: string) => ({ world, lines: [{ kind: 'narration' as const, text }] });
    let outcome: { world: SavedWorld; lines: TranscriptLine[] };
    switch (command.kind) {
      case 'help': outcome = { world, lines: HELP_TEXT.map(text => ({ kind: 'narration' as const, text })) }; break;
      case 'look': outcome = say(this.describeSurroundings(world)); break;
      case 'who': outcome = say(this.describeEveryone(world)); break;
      case 'recap': outcome = say(this.describeRecent(world)); break;
      case 'where': outcome = say(this.describeWhereabouts(world, command.name)); break;
      case 'go': outcome = this.goTo(world, command.place); break;
      case 'wait': outcome = this.wait(world, command.hours); break;
      case 'talk': outcome = await this.talk(world, command.name, command.message); break;
      case 'say': outcome = this.lastSpokenTo
        ? await this.talk(world, this.lastSpokenTo, command.message)
        : say('Say it to whom? Try "talk to <name>: <what you say>".'); break;
      case 'send': outcome = this.sendFor(world, command.name); break;
      case 'pay': outcome = this.pay(world, command.name, command.amount); break;
      default: outcome = say(`I don't follow "${command.text}". Type "help" to see what you can do.`);
    }
    return outcome;
  }

  /** Finds a person by full name, first name, or job ("the innkeeper"). */
  private findPerson(world: SavedWorld, name: string): Npc | undefined {
    const wanted = stripArticle(name).toLowerCase();
    return world.scenario.npcs.find(npc =>
      npc.name.toLowerCase() === wanted || npc.name.split(' ')[0].toLowerCase() === wanted ||
      npc.occupation?.title.toLowerCase() === wanted);
  }

  private replaceNpc(world: SavedWorld, updated: Npc): SavedWorld {
    const npcs = world.scenario.npcs.map(npc => (npc.id === updated.id ? updated : npc));
    return { ...world, scenario: { ...world.scenario, npcs } };
  }

  private describeSurroundings(world: SavedWorld): string {
    const here = this.peopleHereFor(world);
    const people = here.length
      ? here.map(npc => `${npc.name} (${findWhereabouts(npc, world.scenario.lastGameDate, world.hour).activity})`).join('; ')
      : 'nobody you know';
    return `It is ${world.hour}:00 on ${world.scenario.lastGameDate}. You are at ${world.player.location}. Here: ${people}. You carry ${formatMoney(world.player.purse ?? 0)}.`;
  }

  private peopleHereFor(world: SavedWorld): Npc[] {
    return world.scenario.npcs.filter(npc => npc.health.alive && isPresentAt(npc, world.player.location ?? '', world.scenario.lastGameDate, world.hour));
  }

  private describeEveryone(world: SavedWorld): string {
    const people = world.scenario.npcs.map(npc =>
      `${npc.name}${npc.occupation ? `, ${npc.occupation.title}` : ''}${npc.health.alive ? '' : ' (dead)'}`);
    return people.length ? `You know of: ${people.join('; ')}.` : 'You know no one yet.';
  }

  private describeRecent(world: SavedWorld): string {
    const recent = recapSince(world.scenario, addDays(world.scenario.lastGameDate, -30)).slice(-8);
    return recent.length ? recent.map(entry => `${entry.at}: ${entry.name}: ${entry.summary}`).join('\n') : 'Nothing of note in the last month.';
  }

  private describeWhereabouts(world: SavedWorld, name: string): string {
    const person = this.findPerson(world, name);
    const whereabouts = person ? findWhereabouts(person, world.scenario.lastGameDate, world.hour) : null;
    return person && whereabouts
      ? `${person.name} is at ${whereabouts.place}, ${whereabouts.activity}.`
      : `You don't know anyone called ${name}.`;
  }

  /** Walking takes an hour. Unknown places can still be walked to; the world is bigger than the list. */
  private goTo(world: SavedWorld, place: string): { world: SavedWorld; lines: TranscriptLine[] } {
    const wanted = stripArticle(place).toLowerCase();
    const known = this.knownPlaces().find(candidate => stripArticle(candidate).toLowerCase() === wanted) ?? place.trim();
    const moved = this.advanceHours({ ...world, player: { ...world.player, location: known } }, 1);
    return { world: moved, lines: [{ kind: 'narration', text: `You walk to ${known}.` }, { kind: 'narration', text: this.describeSurroundings(moved) }] };
  }

  private wait(world: SavedWorld, hours: number): { world: SavedWorld; lines: TranscriptLine[] } {
    const waited = this.advanceHours(world, hours);
    return { world: waited, lines: [{ kind: 'narration', text: `Time passes. ${this.describeSurroundings(waited)}` }] };
  }

  /** Moves the clock on by whole hours. Past midnight, it's the next day, and the world's date moves too. */
  private advanceHours(world: SavedWorld, hours: number): SavedWorld {
    const total = world.hour + hours;
    const days = Math.floor(total / 24);
    const date = addDays(world.scenario.lastGameDate, days);
    return { ...world, hour: total % 24, scenario: { ...world.scenario, lastGameDate: date } };
  }

  private async talk(world: SavedWorld, name: string, message: string): Promise<{ world: SavedWorld; lines: TranscriptLine[] }> {
    const summoned = await this.meetRoleHolder(world, name);
    const current = summoned.world;
    const person = this.findPerson(current, name);
    const lines: TranscriptLine[] = [...summoned.lines];
    let next = current;
    if (!person) {
      lines.push({ kind: 'narration', text: `You don't know anyone called ${name} here.` });
    } else {
      const date = current.scenario.lastGameDate;
      const dice = createDice(`${current.scenario.worldSeed}:${date}:${current.hour}:${current.transcript.length}`);
      const setting = `${current.scenario.settlement.name}, ${current.scenario.settlement.setting}`;
      const result = await approachAndTalk(person, current.player, message, this.ai.chatModel(), dice, date, current.hour, setting);
      this.lastSpokenTo = person.name;
      if (result.notHere) {
        lines.push({ kind: 'narration', text: result.notHere });
      } else if (result.turn?.warning) {
        lines.push({ kind: 'warning', text: result.turn.warning });
      } else if (result.turn) {
        lines.push({ kind: 'npc', speaker: person.name, text: result.turn.reply });
        next = this.replaceNpc(current, result.turn.npc);
      }
    }
    return { world: next, lines };
  }

  /**
   * THE SCENE RULE for implied roles: asking for "the constable" only creates the constable if the
   * player is where the constable works. Anywhere else, the town just has one, somewhere.
   */
  private async meetRoleHolder(world: SavedWorld, name: string): Promise<{ world: SavedWorld; lines: TranscriptLine[] }> {
    const title = stripArticle(name).toLowerCase();
    const role = world.scenario.settlement.roles.find(slot => slot.title.toLowerCase() === title && !slot.heldBy);
    const atTheirPost = role !== undefined && (world.player.location ?? '').toLowerCase() === role.workplace.toLowerCase();
    let result: { world: SavedWorld; lines: TranscriptLine[] } = { world, lines: [] };
    if (role && atTheirPost) {
      const summoned = await summonRoleHolder(world.scenario.settlement, role.title, this.ai.storyWriter(), world.scenario.lastGameDate,
        world.scenario.worldSeed, world.scenario.npcs.map(npc => npc.name));
      const scenario = {
        ...world.scenario, settlement: summoned.settlement,
        npcs: summoned.newNpc ? [...world.scenario.npcs, summoned.newNpc] : world.scenario.npcs,
      };
      result = { world: { ...world, scenario }, lines: [{ kind: 'narration', text: `You find the ${role.title}: ${summoned.newNpc?.name}.` }] };
    } else if (role) {
      result = { world, lines: [{ kind: 'narration', text: `There's surely a ${role.title} here, but you'd have to go to ${role.workplace} to find them.` }] };
    }
    return result;
  }

  private sendFor(world: SavedWorld, name: string): { world: SavedWorld; lines: TranscriptLine[] } {
    const person = this.findPerson(world, name);
    let outcome: { world: SavedWorld; lines: TranscriptLine[] } = {
      world, lines: [{ kind: 'narration', text: `You don't know anyone called ${name}.` }],
    };
    if (person) {
      const dice = createDice(`${world.scenario.worldSeed}:${world.scenario.lastGameDate}:${world.hour}:send`);
      const result = sendForNpc(person, { name: world.player.name, playerId: world.player.id }, world.player.location ?? '',
        'a local child', world.scenario.lastGameDate, world.hour, dice);
      outcome = {
        world: this.replaceNpc(world, result.npc),
        lines: [{ kind: 'narration', text: `You send a local child to fetch ${person.name}. ${result.report}` }],
      };
    }
    return outcome;
  }

  private pay(world: SavedWorld, name: string, amount: number): { world: SavedWorld; lines: TranscriptLine[] } {
    const person = this.findPerson(world, name);
    const here = person !== undefined && this.peopleHereFor(world).some(npc => npc.id === person.id);
    let outcome: { world: SavedWorld; lines: TranscriptLine[] } = {
      world, lines: [{ kind: 'narration', text: `${person?.name ?? name} isn't here to pay.` }],
    };
    if (person && here) {
      const payment = payNpc(world.player, person, amount, 'their trouble', world.scenario.lastGameDate);
      outcome = payment.paid
        ? { world: { ...this.replaceNpc(world, payment.npc), player: payment.player }, lines: [{ kind: 'narration', text: `You pay ${person.name} ${formatMoney(amount)}.` }] }
        : { world, lines: [{ kind: 'warning', text: payment.problem ?? 'That payment did not go through.' }] };
    }
    return outcome;
  }

  /** Adds lines to the transcript (keeping the last 300), shows the result, and saves it. */
  private async commit(world: SavedWorld, lines: TranscriptLine[]): Promise<void> {
    const updated = { ...world, transcript: [...world.transcript, ...lines].slice(-300) };
    this.world.set(updated);
    await this.worldStore.save(updated);
  }
}
