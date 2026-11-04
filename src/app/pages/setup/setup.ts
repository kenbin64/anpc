import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormField, FormRoot, applyEach, form, max, maxLength, min, required } from '@angular/forms/signals';
import {
  Classification, PlayerCharacter, SocietyRank, WEEKLY_LIVING_COST, WorldMode, WorldScope,
  createDice, createSettlement, listImpliedRoles, logIn, rollLifeExpectancy, startScenario,
} from '../../../engine';
import { AiConnection } from '../../ai/ai-connection';
import { HasUnsavedChanges } from '../../game/unsaved-changes.guard';
import { WorldStore } from '../../storage/world-store';

/**
 * LAYER 3, THE SETUP PAGE: where the game maker sets the rules, before launch locks them.
 *
 * SIGNAL FORMS. The whole form is one signal, `draft`. form(draft, schema) wraps it in a field tree, and
 * the schema lists the rules: required fields, number ranges, a length limit on every starting character's
 * notes (applyEach runs a rule on every item of a list), and an objective that's required ONLY in game
 * mode (the `when` option reads another field's value).
 *
 * LINKEDSIGNAL. Which roles a world offers depends on its scope: a town has a constable, a hamlet doesn't.
 * `roleChoices` is a linkedSignal: it rebuilds its list whenever the scope changes, and in between the
 * player can tick and untick roles freely. Not everything has to be in the form.
 *
 * LAUNCH. Pressing Launch runs the engine's startScenario with the local AI, which writes each starting
 * character, saves the world in IndexedDB, logs the player in, and opens the play screen.
 */

interface CastEntry {
  classification: Classification;
  hints: string;
}

interface SetupDraft {
  worldName: string;
  mode: WorldMode;
  objective: string;
  scope: WorldScope;
  setting: string;
  gameDaysPerRealDay: number;
  cast: CastEntry[];
  playerName: string;
  playerDescription: string;
  playerRank: SocietyRank;
  playerAge: number;
}

const STARTING_DRAFT: SetupDraft = {
  worldName: 'Ashford',
  mode: 'simulation',
  objective: '',
  scope: 'village',
  setting: 'a river valley at the edge of a great forest',
  gameDaysPerRealDay: 7,
  cast: [{ classification: 'gentleman', hints: 'a widowed baker with a grudge against the miller' }],
  playerName: '',
  playerDescription: '',
  playerRank: 'commoner',
  playerAge: 25,
};

/**
 * Says what actually went wrong. "Failed to fetch" means nothing is listening, so Ollama isn't running.
 * An error answer means Ollama is running but the model failed, which a restart of Ollama usually fixes.
 * Either way the form keeps everything the player entered, so they can press Launch again.
 */
function explainLaunchFailure(problem: Error): string {
  const notRunning = problem.message.includes('Failed to fetch') || problem.message.includes('NetworkError');
  const garbled = problem instanceof SyntaxError;
  let message = `The local AI failed while writing the characters. Quit and restart Ollama, then press Launch again; your setup is still here. (Details: ${problem.message.slice(0, 160)})`;
  if (notRunning) message = 'The local AI is not running. Start Ollama, then press Launch again. Your setup is still here.';
  if (garbled) message = 'The local AI wrote a character it could not finish cleanly, twice. Press Launch again; your setup is still here.';
  return message;
}

/** Roles ticked by default, so a new world opens with someone to talk to. */
const DEFAULT_ROLES = ['innkeeper', 'alewife', 'blacksmith'];

@Component({
  selector: 'app-setup',
  imports: [FormRoot, FormField],
  templateUrl: './setup.html',
  styleUrl: './setup.css',
})
export class Setup implements HasUnsavedChanges {
  private readonly ai = inject(AiConnection);
  private readonly worldStore = inject(WorldStore);
  private readonly router = inject(Router);

  protected readonly classifications: Classification[] = ['gentleman', 'noble', 'rogue', 'barbarian', 'thief', 'vagabond', 'monster', 'animal'];
  protected readonly scopes: WorldScope[] = ['house', 'bar', 'area', 'hamlet', 'village', 'town', 'city', 'kingdom'];
  protected readonly ranks: SocietyRank[] = ['outcast', 'peasant', 'commoner', 'merchant', 'gentry', 'noble'];

  private readonly draft = signal<SetupDraft>(structuredClone(STARTING_DRAFT));

  protected readonly setupForm = form(
    this.draft,
    path => {
      required(path.worldName, { message: 'Give the world a name.' });
      required(path.setting, { message: 'Describe the place in a few words.' });
      required(path.objective, {
        message: 'A game needs an objective.',
        when: ({ valueOf }) => valueOf(path.mode) === 'game',
      });
      min(path.gameDaysPerRealDay, 1, { message: 'At least one game day per real day.' });
      max(path.gameDaysPerRealDay, 60, { message: 'At most 60 game days per real day.' });
      applyEach(path.cast, entry => maxLength(entry.hints, 200, { message: 'Keep the notes under 200 characters.' }));
      required(path.playerName, { message: 'Name your character.' });
      required(path.playerDescription, { message: 'Describe how your character looks.' });
      min(path.playerAge, 16, { message: 'Your character must be at least 16.' });
      max(path.playerAge, 90, { message: 'Your character must be 90 or younger.' });
    },
    { submission: { action: async () => this.launch() } },
  );

  protected readonly roleChoices = linkedSignal(() =>
    listImpliedRoles('medieval', this.draft().scope).map(role => ({ ...role, chosen: DEFAULT_ROLES.includes(role.title) })));

  protected readonly chosenRoleCount = computed(() => this.roleChoices().filter(role => role.chosen).length);
  protected readonly charactersToWrite = computed(() => this.draft().cast.length + this.chosenRoleCount());
  protected readonly startingPurse = computed(() => WEEKLY_LIVING_COST[this.draft().playerRank] * 10);

  protected readonly launching = signal(false);
  protected readonly launchError = signal('');
  private launched = false;

  protected readonly aiStatus = this.ai.status;

  hasUnsavedChanges(): boolean {
    return this.setupForm().dirty() && !this.launched;
  }

  protected addCastMember(): void {
    this.draft.update(current => ({ ...current, cast: [...current.cast, { classification: 'gentleman', hints: '' }] }));
  }

  protected removeCastMember(index: number): void {
    this.draft.update(current => ({ ...current, cast: current.cast.filter((_, position) => position !== index) }));
  }

  protected toggleRole(title: string): void {
    this.roleChoices.update(roles => roles.map(role => (role.title === title ? { ...role, chosen: !role.chosen } : role)));
  }

  /** Runs only when the whole form is valid: writes the starting cast with the AI, saves, and opens play. */
  private async launch(): Promise<undefined> {
    const draft = this.draft();
    this.launching.set(true);
    this.launchError.set('');
    try {
      const startDate = '1200-04-01';
      const settlement = createSettlement(draft.worldName.trim(), draft.scope, draft.setting.trim());
      const scenario = await startScenario({
        settlement,
        mode: draft.mode,
        objective: draft.mode === 'game' ? draft.objective.trim() : '',
        gameDaysPerRealDay: draft.gameDaysPerRealDay,
        startingCast: draft.cast.map((entry, index) => ({ classification: entry.classification, hints: entry.hints.trim(), seed: `cast-${index}` })),
        startingRoles: this.roleChoices().filter(role => role.chosen).map(role => role.title),
      }, this.ai.storyWriter(), startDate);

      const startingPlace = scenario.npcs.find(npc => npc.occupation)?.occupation?.workplace ?? `${settlement.name} square`;
      const player: PlayerCharacter = {
        id: `player-${crypto.randomUUID()}`,
        name: draft.playerName.trim(),
        description: draft.playerDescription.trim(),
        societyRank: draft.playerRank,
        purse: this.startingPurse(),
        age: draft.playerAge,
        lifeExpectancy: Math.max(rollLifeExpectancy('human', createDice(scenario.worldSeed)), draft.playerAge + 15),
        location: startingPlace,
      };
      const opening = logIn(scenario, player, new Date());
      const id = scenario.worldSeed;
      await this.worldStore.save({
        id, name: settlement.name, scenario: opening.scenario, player, hour: 9, updatedAt: '',
        transcript: [
          { kind: 'narration', text: `You arrive in ${settlement.name}, ${draft.setting.trim()}. It is morning, and you stand at ${startingPlace}.` },
          ...(draft.mode === 'game' ? [{ kind: 'news' as const, text: `Your objective: ${draft.objective.trim()}` }] : []),
          { kind: 'narration', text: 'Type "help" to see what you can do.' },
        ],
      });
      this.launched = true;
      await this.router.navigate(['/play', id]);
    } catch (problem) {
      this.launchError.set(explainLaunchFailure(problem as Error));
    } finally {
      this.launching.set(false);
    }
    return undefined;
  }
}
