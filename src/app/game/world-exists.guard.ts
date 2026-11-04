import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { WorldStore } from '../storage/world-store';

/**
 * A ROUTE GUARD that waits for the database. A guard may return a Promise, and the router waits for it
 * before opening the page. Here it checks that the world in the address really exists; an old bookmark
 * to a deleted world goes back to the list instead of opening a broken page.
 */
export const worldExistsGuard: CanActivateFn = async route => {
  const exists = (await inject(WorldStore).load(route.paramMap.get('worldId') ?? '')) !== undefined;
  return exists ? true : inject(Router).createUrlTree(['/']);
};
