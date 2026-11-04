import { Component, input } from '@angular/core';
import { TranscriptLine } from '../storage/saved-world';

/**
 * A SMALL PRESENTATIONAL COMPONENT: one line of the transcript.
 *
 * It takes a line as an INPUT and shows it styled by kind: what the player said, what an NPC said, the
 * world's narration, news from while they were away, and warnings. It has no services and changes
 * nothing; it only shows what it's given. Small components like this keep the page's template readable.
 *
 * The `host` object puts a class on the component's own element, so each kind can be styled from here.
 */
@Component({
  selector: 'app-transcript-line',
  host: { '[class]': 'line().kind' },
  template: `
    @switch (line().kind) {
      @case ('you') { <span class="mark" aria-hidden="true">&gt;</span> {{ line().text }} }
      @case ('npc') { <strong>{{ line().speaker }}:</strong> "{{ line().text }}" }
      @case ('news') { <span class="tag">News</span> {{ line().text }} }
      @case ('warning') { <span class="tag">Notice</span> {{ line().text }} }
      @default { {{ line().text }} }
    }
  `,
  styles: `
    :host { display: block; padding: 0.15rem 0; white-space: pre-line; }
    :host(.you) { color: var(--accent); font-family: var(--mono); margin-top: 0.6rem; }
    :host(.npc) { color: var(--npc); }
    :host(.news) { color: var(--muted); font-size: 0.95rem; }
    :host(.warning) { color: var(--danger); }
    .tag { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; border: 1px solid currentColor;
           border-radius: 4px; padding: 0 0.3rem; margin-right: 0.3rem; }
  `,
})
export class TranscriptLineView {
  readonly line = input.required<TranscriptLine>();
}
