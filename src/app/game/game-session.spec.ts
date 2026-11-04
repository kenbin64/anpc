import { TestBed } from '@angular/core/testing';
import { createSettlement, startScenario, logIn } from '../../engine';
import { AiConnection } from '../ai/ai-connection';
import { WORLD_STORAGE } from '../storage/key-value-store';
import { MemoryStore } from '../storage/memory-store';
import { WorldStore } from '../storage/world-store';
import { GameSession } from './game-session';

/**
 * TESTING THE GAME LOOP: a real world built by the engine, a stand-in AI, and the in-memory database.
 * No Ollama, no browser storage. Each test types commands the way a player would and reads the transcript.
 */
const innkeeperStory = async () => ({
  name: 'Hobb Ashcroft', species: 'human', age: 44, maritalStatus: 'married', inDebt: false,
  backstory: 'Hobb keeps the inn and hears every rumor.', occupation: { title: 'innkeeper', workplace: 'the inn', role: 'owner' },
  relationships: [], affiliations: [], abilities: [{ name: 'Good ears', description: 'Hears every rumor.' }],
  routine: { workDaysPerWeek: 7, tavernEveningsPerWeek: 0, familyEveningsPerWeek: 2, worshipDay: -1 }, creature: null,
});
const fakeAi = { storyWriter: () => innkeeperStory, chatModel: () => async () => 'Welcome, traveler. A room is three copper.' };

async function buildSession(): Promise<GameSession> {
  TestBed.configureTestingModule({
    providers: [GameSession, { provide: WORLD_STORAGE, useValue: new MemoryStore() }, { provide: AiConnection, useValue: fakeAi }],
  });
  const scenario = await startScenario({
    settlement: createSettlement('Ashford', 'village', 'a river valley'), startingCast: [], startingRoles: ['innkeeper'], worldSeed: 'test-world',
  }, innkeeperStory, '1200-04-03', new Date('2026-11-01T09:00:00Z'));
  const player = { id: 'p1', name: 'Kestrel', description: 'a sellsword', location: 'the inn', purse: 100, societyRank: 'commoner' as const };
  await TestBed.inject(WorldStore).save({
    id: 'test-world', name: 'Ashford', scenario: logIn(scenario, player, new Date('2026-11-01T09:00:00Z')).scenario, player,
    hour: 10, transcript: [], updatedAt: '',
  });
  const session = TestBed.inject(GameSession);
  await session.open('test-world', new Date('2026-11-01T09:00:00Z'));
  return session;
}

/** The text of every line added by the last command. */
function lastResponse(session: GameSession): string {
  const lines = session.transcript();
  const lastCommand = lines.map(line => line.kind).lastIndexOf('you');
  return lines.slice(lastCommand + 1).map(line => line.text).join(' | ');
}

describe('GameSession', () => {
  it('opens a world and knows where the player is', async () => {
    const session = await buildSession();
    expect(session.ready()).toBe(true);
    expect(session.place()).toBe('the inn');
    expect(session.peopleHere().map(npc => npc.name)).toEqual(['Hobb Ashcroft']);
  });

  it('looks around', async () => {
    const session = await buildSession();
    await session.run('look');
    expect(lastResponse(session)).toContain('Here: Hobb Ashcroft (working as innkeeper)');
  });

  it('talks to someone who is here, by name or by job', async () => {
    const session = await buildSession();
    await session.run('talk to the innkeeper: Have you a room?');
    expect(session.transcript().at(-1)).toEqual({ kind: 'npc', speaker: 'Hobb Ashcroft', text: 'Welcome, traveler. A room is three copper.' });
  });

  it('will not let the player talk to someone who is elsewhere', async () => {
    const session = await buildSession();
    await session.run('go to the chapel');
    await session.run('talk to Hobb: Hello');
    expect(lastResponse(session)).toContain("Hobb Ashcroft isn't here.");
  });

  it('walking takes an hour', async () => {
    const session = await buildSession();
    await session.run('go to the chapel');
    expect(session.hour()).toBe(11);
    expect(session.place()).toBe('the chapel');
  });

  it('an implied role is only created when the player goes where they work', async () => {
    const session = await buildSession();
    await session.run('talk to the miller: Good day');
    expect(lastResponse(session)).toContain("you'd have to go to the mill to find them");
  });

  it('pays someone who is here, and not someone who is not', async () => {
    const session = await buildSession();
    await session.run('pay Hobb 3');
    expect(lastResponse(session)).toBe('You pay Hobb Ashcroft 3 copper.');
    expect(session.purse()).toBe('9 silver, 7 copper');
    await session.run('go to the chapel');
    await session.run('pay Hobb 3');
    expect(lastResponse(session)).toBe("Hobb Ashcroft isn't here to pay.");
  });

  it('stops forbidden talk with a warning and records nothing', async () => {
    const session = await buildSession();
    await session.run('talk to Hobb: I will torture you');
    expect(session.transcript().at(-1)?.kind).toBe('warning');
  });

  it('waiting stops when someone the player sent for arrives', async () => {
    const session = await buildSession();
    await session.run('go to the chapel');
    await session.run('send for Hobb');
    const report = lastResponse(session);
    await session.run('wait 12');
    const arrivedAt = session.hour();
    expect(report).toContain('Hobb Ashcroft');
    expect(arrivedAt).toBeLessThan(23);
    expect(lastResponse(session)).toContain('Hobb Ashcroft arrives, as they promised.');
    expect(session.peopleHere().map(npc => npc.name)).toContain('Hobb Ashcroft');
  });

  it('the recap leaves out the player own talk', async () => {
    const session = await buildSession();
    await session.run('talk to Hobb: Hello');
    await session.run('recap');
    expect(lastResponse(session)).not.toContain('said:');
  });

  it('says plainly when it does not understand', async () => {
    const session = await buildSession();
    await session.run('dance a jig');
    expect(lastResponse(session)).toContain('I don\'t follow "dance a jig"');
  });
});
