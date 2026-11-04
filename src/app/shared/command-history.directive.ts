import { Directive, ElementRef, inject, input } from '@angular/core';

/**
 * AN ATTRIBUTE DIRECTIVE: gives any text box a command history, like a terminal.
 *
 * Put `appCommandHistory` on an input and pass it the list of past commands. Up arrow steps back through
 * them, down arrow steps forward, and the box fills with each one. The `host` object listens to the
 * element's own key presses; no @HostListener needed. The directive knows nothing about the game; it
 * would work on any input that has a history.
 */
@Directive({
  selector: 'input[appCommandHistory]',
  host: {
    '(keydown.arrowup)': 'stepBack($event)',
    '(keydown.arrowdown)': 'stepForward($event)',
    '(keydown.enter)': 'resetPosition()',
  },
})
export class CommandHistory {
  readonly appCommandHistory = input.required<readonly string[]>();

  private readonly element = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private stepsBack = 0;

  protected stepBack(event: Event): void {
    event.preventDefault();
    this.stepsBack = Math.min(this.stepsBack + 1, this.appCommandHistory().length);
    this.showEntry();
  }

  protected stepForward(event: Event): void {
    event.preventDefault();
    this.stepsBack = Math.max(this.stepsBack - 1, 0);
    this.showEntry();
  }

  protected resetPosition(): void {
    this.stepsBack = 0;
  }

  private showEntry(): void {
    const history = this.appCommandHistory();
    this.element.nativeElement.value = this.stepsBack === 0 ? '' : history[history.length - this.stepsBack] ?? '';
  }
}
