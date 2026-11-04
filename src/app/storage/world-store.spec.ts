import { TestBed } from '@angular/core/testing';
import { Scenario } from '../../engine';
import { WORLD_STORAGE } from './key-value-store';
import { MemoryStore } from './memory-store';
import { SavedWorld } from './saved-world';
import { WorldStore } from './world-store';

/**
 * TESTING A SERVICE with a swapped-in database. The `providers` line tells Angular: whenever anything
 * asks for WORLD_STORAGE, hand it this MemoryStore instead of IndexedDB.
 */
function buildWorld(id: string, updatedAt: string): SavedWorld {
  const scenario = {
    settlement: { name: 'Ashford', size: 'village', era: 'medieval', setting: 'a river valley', roles: [] },
    rules: Object.freeze({ mode: 'simulation', objective: '', era: 'medieval', scope: 'village', gameDaysPerRealDay: 7 }),
    npcs: [], extras: [], sessions: [], worldSeed: id, lastGameDate: '1200-01-01',
    clock: Object.freeze({ realStart: '2026-11-01T00:00:00Z', gameStart: '1200-01-01', gameDaysPerRealDay: 7 }),
  } as unknown as Scenario;
  return { id, name: `World ${id}`, scenario, player: { id: 'p1', name: 'Kestrel', description: 'a sellsword' }, hour: 9, transcript: [], updatedAt };
}

describe('WorldStore', () => {
  let store: WorldStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [{ provide: WORLD_STORAGE, useValue: new MemoryStore() }] });
    store = TestBed.inject(WorldStore);
  });

  it('saves a world and lists it', async () => {
    await store.save(buildWorld('w1', ''));
    expect(store.worlds().map(world => world.name)).toEqual(['World w1']);
    expect(store.worlds()[0].playerName).toBe('Kestrel');
  });

  it('lists the most recently saved world first', async () => {
    await store.save(buildWorld('older', ''));
    await new Promise(resolve => setTimeout(resolve, 5));
    await store.save(buildWorld('newer', ''));
    expect(store.worlds().map(world => world.id)).toEqual(['newer', 'older']);
  });

  it('loads a world back with its rules locked again', async () => {
    await store.save(buildWorld('w1', ''));
    const loaded = await store.load('w1');
    expect(loaded?.scenario.rules.mode).toBe('simulation');
    expect(Object.isFrozen(loaded?.scenario.rules)).toBe(true);
    expect(Object.isFrozen(loaded?.scenario.clock)).toBe(true);
  });

  it('removes a world', async () => {
    await store.save(buildWorld('w1', ''));
    await store.remove('w1');
    expect(store.worldCount()).toBe(0);
    expect(await store.load('w1')).toBeUndefined();
  });
});
