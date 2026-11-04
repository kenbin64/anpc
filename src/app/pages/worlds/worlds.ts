import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WorldStore } from '../../storage/world-store';

/**
 * LAYER 5, THE LIST OF WORLDS: the home page.
 *
 * It reads the WorldStore's `worlds` signal, so the list redraws by itself whenever a world is saved or
 * deleted anywhere in the app. Deleting asks for a second click in the page itself, rather than a pop-up,
 * because a world's whole history goes with it. The built-in `date` PIPE formats when each was last played.
 */
@Component({
  selector: 'app-worlds',
  imports: [RouterLink, DatePipe],
  template: `
    <section class="page">
      <header class="heading">
        <h1>Your worlds</h1>
        <a routerLink="/new" class="button">New world</a>
      </header>
      <p class="muted">Worlds never end; they pause. Open one and its people will have lived while you were away.</p>

      <ul class="worlds">
        @for (world of worldStore.worlds(); track world.id) {
          <li class="panel">
            <div>
              <a [routerLink]="['/play', world.id]" class="name">{{ world.name }}</a>
              <span class="muted"> as {{ world.playerName }}, {{ world.mode }}</span>
              <p class="muted">Game date {{ world.gameDate }}. Last played {{ world.updatedAt | date: 'medium' }}.</p>
            </div>
            @if (confirmingDelete() === world.id) {
              <button type="button" (click)="delete(world.id)">Delete for good</button>
              <button type="button" class="ghost" (click)="confirmingDelete.set('')">Keep it</button>
            } @else {
              <button type="button" class="ghost" (click)="confirmingDelete.set(world.id)">Delete</button>
            }
          </li>
        } @empty {
          <li class="muted">No worlds yet. Set one up to begin.</li>
        }
      </ul>
    </section>
  `,
  styles: `
    .heading { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
    .worlds { list-style: none; padding: 0; display: grid; gap: 0.75rem; }
    .worlds li.panel { display: flex; gap: 0.5rem; align-items: center; }
    .worlds li.panel > div { flex: 1; }
    .name { font-family: var(--display); font-size: 1.2rem; font-weight: 700; }
    p { margin: 0.2rem 0 0; }
  `,
})
export class Worlds {
  protected readonly worldStore = inject(WorldStore);
  protected readonly confirmingDelete = signal('');

  constructor() {
    void this.worldStore.refresh();
  }

  protected async delete(id: string): Promise<void> {
    await this.worldStore.remove(id);
    this.confirmingDelete.set('');
  }
}
