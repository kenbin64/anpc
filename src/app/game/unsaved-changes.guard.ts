import { CanDeactivateFn } from '@angular/router';

/** Any page that can lose work implements this, so the guard can ask it. */
export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * A LEAVE GUARD: before the player navigates away from a half-filled setup form, ask first. The guard
 * knows nothing about forms; it only asks the page, so any page can opt in.
 */
export const unsavedChangesGuard: CanDeactivateFn<HasUnsavedChanges> = page =>
  !page.hasUnsavedChanges() || confirm('Your world setup is not launched yet. Leave and lose it?');
