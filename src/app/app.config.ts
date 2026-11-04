import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';

/**
 * LAYER 2, THE APP CONFIG: the app-wide setup main.ts reads once, at startup.
 *
 * provideBrowserGlobalErrorListeners()  catches errors nobody else handled, so they're reported
 *                                       instead of silently lost.
 * provideRouter(routes, ...)            turns on page navigation, with route parameters delivered to
 *                                       pages as inputs.
 *
 * There's no provideHttpClient here. The engine talks to Ollama with plain fetch(), so it stays free of
 * Angular and any game can reuse it. And there's no zone.js: Angular 22 redraws from signals.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
  ],
};
