import { Service, computed, inject, signal } from '@angular/core';
import { Scenario } from '../../engine';
import { WORLD_STORAGE } from './key-value-store';
import { SavedWorld, WorldSummary } from './saved-world';

/**
 * THE WORLD STORE: a SERVICE that every page uses to save and load worlds.
 *
 * Pages never touch storage themselves; they ask this service. It keeps a SIGNAL with the list of saved
 * worlds, so the list page redraws by itself after a save or a delete.
 *
 * One detail matters for the rules: a world's rules and clock are frozen at launch. Saving copies the
 * world into the database, and a copy is not frozen, so loading freezes them again. Without that step,
 * a world reloaded from disk would quietly lose its locked rules.
 */
@Service()
export class WorldStore {
  private readonly storage = inject(WORLD_STORAGE);

  private readonly summaries = signal<WorldSummary[]>([]);
  readonly worlds = this.summaries.asReadonly();
  readonly worldCount = computed(() => this.summaries().length);

  async refresh(): Promise<void> {
    const saved = await Promise.all((await this.storage.keys()).map(key => this.storage.get<SavedWorld>(key)));
    const summaries = saved
      .filter((world): world is SavedWorld => world !== undefined)
      .map(summarize)
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
    this.summaries.set(summaries);
  }

  async load(id: string): Promise<SavedWorld | undefined> {
    const world = await this.storage.get<SavedWorld>(id);
    return world ? { ...world, scenario: relockRules(world.scenario) } : undefined;
  }

  async save(world: SavedWorld): Promise<void> {
    await this.storage.put(world.id, { ...world, updatedAt: new Date().toISOString() });
    await this.refresh();
  }

  async remove(id: string): Promise<void> {
    await this.storage.delete(id);
    await this.refresh();
  }
}

function summarize(world: SavedWorld): WorldSummary {
  return {
    id: world.id, name: world.name, playerName: world.player.name, gameDate: world.scenario.lastGameDate,
    mode: world.scenario.rules.mode, updatedAt: world.updatedAt,
  };
}

/** Freezes the rules and the clock again after a load, so they stay locked for the life of the world. */
function relockRules(scenario: Scenario): Scenario {
  return { ...scenario, rules: Object.freeze({ ...scenario.rules }), clock: Object.freeze({ ...scenario.clock }) };
}
