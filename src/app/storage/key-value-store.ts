import { InjectionToken } from '@angular/core';
import { IndexedDbStore } from './indexed-db-store';

/**
 * LAYER 1, STORAGE: the shape of the app's database, separate from the database itself.
 *
 * The app needs only four things from storage: get a value by key, put one, delete one, and list the
 * keys. This INTERFACE says exactly that and nothing more. The real app plugs in IndexedDB, the database
 * built into every browser, so a world stays on the player's own machine and the server holds nothing.
 * Tests plug in an in-memory version instead (memory-store.ts), so they run fast and leave nothing behind.
 *
 * The INJECTION TOKEN is how Angular knows which one to hand out. Code asks for WORLD_STORAGE and never
 * says "IndexedDB", so swapping the database later, for a server or a file, changes one line here.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export const WORLD_STORAGE = new InjectionToken<KeyValueStore>('WORLD_STORAGE', {
  providedIn: 'root',
  factory: () => new IndexedDbStore('anpc', 'worlds'),
});
