import { Component, computed, inject, input, resource, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LifeEventKind, formatMoney } from '../../../engine';
import { WorldStore } from '../../storage/world-store';

/**
 * LAYER 5, ONE PERSON'S RECORD: everything the world knows about an ANPC, and their life log.
 *
 * RESOURCE. The person lives inside a saved world in IndexedDB, which is ASYNC: it takes a moment to
 * read. resource() turns that into signals. Its `params` reads the route inputs, and whenever they
 * change, its `loader` runs again. The template reads isLoading(), hasValue() and value(), the same
 * three states httpResource had in the character builder, but for any Promise, not just HTTP.
 *
 * FILTERING. The log can be long, so the player can show one kind of entry at a time. `shownEvents` is a
 * computed() over the loaded log and the chosen filter, so changing either redraws the list.
 */
@Component({
  selector: 'app-person',
  imports: [RouterLink],
  templateUrl: './person.html',
  styleUrl: './person.css',
})
export class Person {
  readonly worldId = input.required<string>();
  readonly npcId = input.required<string>();

  private readonly worldStore = inject(WorldStore);

  protected readonly record = resource({
    params: () => ({ worldId: this.worldId(), npcId: this.npcId() }),
    loader: async ({ params }) => {
      const world = await this.worldStore.load(params.worldId);
      return world?.scenario.npcs.find(npc => npc.id === params.npcId) ?? null;
    },
  });

  protected readonly filter = signal<LifeEventKind | 'all'>('all');
  protected readonly kinds: (LifeEventKind | 'all')[] = ['all', 'period', 'social', 'conflict', 'choice', 'family', 'work', 'change', 'death'];
  protected readonly statKeys = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'] as const;

  protected readonly shownEvents = computed(() => {
    const npc = this.record.hasValue() ? this.record.value() : null;
    const chosen = this.filter();
    return (npc?.lifeLog ?? []).filter(event => chosen === 'all' || event.kind === chosen).slice().reverse();
  });

  protected readonly purse = computed(() => formatMoney(this.record.hasValue() ? this.record.value()?.purse ?? 0 : 0));

  protected chooseFilter(event: Event): void {
    this.filter.set((event.target as HTMLSelectElement).value as LifeEventKind | 'all');
  }
}
