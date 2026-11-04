import { Routes } from '@angular/router';
import { worldExistsGuard } from './game/world-exists.guard';

/**
 * LAYER 2, THE ROUTES: every screen in the app and the address it lives at.
 *
 *   /                          the list of saved worlds
 *   /new                       set up and launch a new world
 *   /play/:worldId             play a world, in text
 *   /play/:worldId/people/:id  one person's full record
 *
 * Every page is LAZY LOADED with loadComponent, so the browser only downloads a page's code the first time
 * it opens. The play routes are GUARDED, so a link to a deleted world goes back to the list. Route
 * parameters like :worldId reach each page as an input, because app.config.ts turns on
 * withComponentInputBinding().
 */
export const routes: Routes = [
  {
    path: '',
    title: 'ANPC',
    loadComponent: () => import('./pages/worlds/worlds').then(m => m.Worlds),
  },
  {
    path: 'new',
    title: 'New world',
    loadComponent: () => import('./pages/setup/setup').then(m => m.Setup),
  },
  {
    path: 'play/:worldId',
    title: 'Playing',
    canActivate: [worldExistsGuard],
    loadComponent: () => import('./pages/play/play').then(m => m.Play),
  },
  {
    path: 'play/:worldId/people/:npcId',
    title: 'A person',
    canActivate: [worldExistsGuard],
    loadComponent: () => import('./pages/person/person').then(m => m.Person),
  },
  { path: '**', redirectTo: '' },
];
