import { KeyValueStore } from './key-value-store';

/**
 * INDEXEDDB: the browser's built-in database, wrapped to fit the KeyValueStore interface.
 *
 * IndexedDB stores whole objects (it copies them with the "structured clone" rules, so dates, nested
 * lists and the like survive), and it can hold far more than localStorage. Its own API is old and
 * event-based: you make a request, then wait for a success or error event. The two helpers below turn
 * that into Promises, so the rest of the app can simply `await` it.
 *
 * A DATABASE holds OBJECT STORES, which are like tables. This app uses one database, "anpc", with one
 * store, "worlds", where each saved world is one entry under its id.
 */

/** Turns one IndexedDB request into a Promise that resolves with its result. */
function finish<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export class IndexedDbStore implements KeyValueStore {
  private database: Promise<IDBDatabase> | null = null;

  constructor(private readonly databaseName: string, private readonly storeName: string) {}

  /** Opens the database once and reuses it. The first open creates the store; that's the "upgrade". */
  private open(): Promise<IDBDatabase> {
    this.database ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(this.storeName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.database;
  }

  /** Every read or write happens inside a TRANSACTION, read-only or read-write. */
  private async storeFor(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const database = await this.open();
    return database.transaction(this.storeName, mode).objectStore(this.storeName);
  }

  async get<T>(key: string): Promise<T | undefined> {
    return finish((await this.storeFor('readonly')).get(key)) as Promise<T | undefined>;
  }

  async put<T>(key: string, value: T): Promise<void> {
    await finish((await this.storeFor('readwrite')).put(value, key));
  }

  async delete(key: string): Promise<void> {
    await finish((await this.storeFor('readwrite')).delete(key));
  }

  async keys(): Promise<string[]> {
    return (await finish((await this.storeFor('readonly')).getAllKeys())).map(String);
  }
}
