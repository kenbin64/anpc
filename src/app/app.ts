import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AiConnection } from './ai/ai-connection';

/**
 * LAYER 2, THE SHELL: the frame around every page.
 *
 * It holds the title bar, the navigation, and a small light showing whether the local AI is answering.
 * The current page appears inside <router-outlet />. The shell checks the AI connection once, when it's
 * created, so the light is right from the first screen.
 */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly ai = inject(AiConnection);

  constructor() {
    void this.ai.checkConnection();
  }
}
