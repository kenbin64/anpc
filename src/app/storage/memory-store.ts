import { KeyValueStore } from './key-value-store';

/**
 * AN IN-MEMORY STORE for tests: the same interface as IndexedDB, backed by a plain Map.
 *
 * Values are copied with structuredClone on the way in and out, the same as IndexedDB does, so a test
 * catches code that wrongly expects to get back the very same object it saved.
 */
export class MemoryStore implements KeyValueStore {
  private readonly entries = new Map<string, unknown>();

  async get<T>(key: string): Promise<T | undefined> {
    return this.entries.has(key) ? structuredClone(this.entries.get(key) as T) : undefined;
  }

  async put<T>(key: string, value: T): Promise<void> {
    this.entries.set(key, structuredClone(value));
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key);
  }

  async keys(): Promise<string[]> {
    return [...this.entries.keys()];
  }
}
