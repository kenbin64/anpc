import {
  Component, DestroyRef, ElementRef, OnInit, afterRenderEffect, computed, inject, input, viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { GameSession } from '../../game/game-session';
import { CommandHistory } from '../../shared/command-history.directive';
import { TimeOfDayPipe } from '../../shared/time-of-day.pipe';
import { TranscriptLineView } from '../../shared/transcript-line';

/**
 * LAYER 4, THE PLAY PAGE: the text game itself.
 *
 * COMPONENT-LEVEL PROVIDER. `providers: [GameSession]` gives this page its own GameSession, created with
 * the page and thrown away when the player leaves. The page only shows the session's signals and passes
 * along what the player types; the session does the work.
 *
 * LIFECYCLE. ngOnInit runs once the route's :worldId has arrived as an input, and opens the world, which
 * logs the player in. DestroyRef.onDestroy runs when the player navigates away, and logs them out, so
 * their part of the game pauses.
 *
 * AFTER RENDER. afterRenderEffect runs after Angular has drawn the page. Here it keeps the transcript
 * scrolled to the newest line, which can only be done once the new line is actually on screen.
 */
@Component({
  selector: 'app-play',
  imports: [RouterLink, TranscriptLineView, TimeOfDayPipe, CommandHistory],
  providers: [GameSession],
  templateUrl: './play.html',
  styleUrl: './play.css',
})
export class Play implements OnInit {
  readonly worldId = input.required<string>();

  protected readonly session = inject(GameSession);
  private readonly transcriptBox = viewChild.required<ElementRef<HTMLElement>>('transcriptBox');

  protected readonly pastCommands = computed(() =>
    this.session.transcript().filter(line => line.kind === 'you').map(line => line.text));

  constructor() {
    inject(DestroyRef).onDestroy(() => void this.session.leave());
    afterRenderEffect(() => {
      this.session.transcript();
      const box = this.transcriptBox().nativeElement;
      box.scrollTop = box.scrollHeight;
    });
  }

  ngOnInit(): void {
    void this.session.open(this.worldId());
  }

  /**
   * Sends the command. While the AI is still answering the last one, the new command stays in the box
   * instead of being cleared and lost; the player can press Enter again once the answer is in.
   */
  protected async submit(box: HTMLInputElement): Promise<void> {
    if (!this.session.busy()) {
      const command = box.value;
      box.value = '';
      await this.session.run(command);
      box.focus();
    }
  }
}
