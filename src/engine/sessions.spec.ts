import { PlayerCharacter } from './npc.model';
import { startScenario } from './scenario';
import { createDice } from './random';
import { checkPlayerOldAge, isPlaying, killPlayerCharacter, logIn, logOut, retireCharacter } from './sessions';
import { createSettlement } from './settlement';

const writer = async () => ({
  name: 'Hobb', species: 'human', age: 40, maritalStatus: 'married', backstory: 'Keeps the inn.', inDebt: false,
  occupation: { title: 'innkeeper', workplace: 'the inn', role: 'owner' },
  relationships: [{ name: 'Kestrel', kind: 'friend', affinity: 70 }], affiliations: [],
  abilities: [{ name: 'Never forgets a face', description: 'Remembers every guest.' }],
  routine: { workDaysPerWeek: 6, tavernEveningsPerWeek: 2, familyEveningsPerWeek: 3, worshipDay: 0 }, creature: null,
});

const kestrel: PlayerCharacter = { id: 'p1', name: 'Kestrel', description: 'a road-worn sellsword', location: 'the inn' };

async function buildWorld() {
  return startScenario({
    settlement: createSettlement('Ashford', 'town', 'a river valley'), startingCast: [], startingRoles: ['innkeeper', 'constable'],
    worldSeed: 'sessions-test',
  }, writer, '1200-01-01', new Date('2026-11-01T09:00:00Z'));
}

describe('player sessions', () => {
  it('a first login has no time jump to report', async () => {
    const welcome = logIn(await buildWorld(), kestrel, new Date('2026-11-01T10:00:00Z'));
    expect(welcome.timeJump).toBe('');
    expect(isPlaying(welcome.scenario, 'p1')).toBe(true);
  });

  it('coming back, the player hears how much time passed and what happened while they were away', async () => {
    const firstVisit = logIn(await buildWorld(), kestrel, new Date('2026-11-01T10:00:00Z'));
    const away = logOut(firstVisit.scenario, 'p1');
    const welcome = logIn(away, kestrel, new Date('2026-11-21T10:00:00Z'));

    // 20 real days at 7 game days each is 140 days; 1200 was a leap year, so that lands on 20 May.
    expect(welcome.timeJump).toBe('While you were away, 20 weeks passed in the world (from 1200-01-01 to 1200-05-20).');
    expect(welcome.news.length).toBeGreaterThan(0);
    expect(welcome.news.every(item => /^1200-\d\d-\d\d: /.test(item))).toBe(true);
  });

  it('the world is lived up to now, not to where the player left off', async () => {
    const away = logOut(logIn(await buildWorld(), kestrel, new Date('2026-11-01T10:00:00Z')).scenario, 'p1');
    const welcome = logIn(away, kestrel, new Date('2026-11-21T10:00:00Z'));
    expect(welcome.scenario.lastGameDate).toBe('1200-05-20');
    expect(welcome.scenario.npcs.every(npc => npc.livedUntil >= '1200-05-14' || !npc.health.alive)).toBe(true);
  });
});

describe('player characters age too', () => {
  it('ages the character by the time away, and warns when they are growing frail', async () => {
    const elder: PlayerCharacter = { ...kestrel, age: 64, lifeExpectancy: 70 };
    const away = logOut(logIn(await buildWorld(), elder, new Date('2026-11-01T10:00:00Z')).scenario, 'p1');
    const welcome = logIn(away, elder, new Date('2027-02-15T10:00:00Z'));

    expect(welcome.player.age).toBe(66);
    expect(welcome.frailty).toBe('Kestrel is 66 now and growing frail. Their days are numbered.');
  });

  it('old age can only take a player character during play', async () => {
    // Old age is a weekly chance, so check a year of weeks: never while away, near-certain in play.
    const ancient: PlayerCharacter = { ...kestrel, age: 99, lifeExpectancy: 70 };
    const yearOfChecks = (scenario: Awaited<ReturnType<typeof buildWorld>>) => {
      const dice = createDice('old');
      return Array.from({ length: 52 }, () => checkPlayerOldAge(scenario, ancient, dice, '1200-02-01').died).some(Boolean);
    };
    const away = logOut(logIn(await buildWorld(), ancient, new Date('2026-11-01T10:00:00Z')).scenario, 'p1');
    expect(yearOfChecks(away)).toBe(false);

    const playing = logIn(away, ancient, new Date('2026-11-01T11:00:00Z')).scenario;
    expect(yearOfChecks(playing)).toBe(true);
  });
});

describe('retiring a character', () => {
  it('turns the character into an ANPC who keeps living, known to everyone who knew them', async () => {
    const world = await buildWorld();
    const innkeeperIndex = world.npcs.findIndex(npc => npc.occupation?.title === 'innkeeper');
    world.npcs[innkeeperIndex] = {
      ...world.npcs[innkeeperIndex],
      relationships: [...world.npcs[innkeeperIndex].relationships, { name: 'Kestrel', kind: 'friend', affinity: 80, playerId: 'p1' }],
    };
    const veteran: PlayerCharacter = { ...kestrel, age: 52, lifeExpectancy: 74, purse: 900 };
    const playing = logIn(world, veteran, new Date('2026-11-01T10:00:00Z')).scenario;

    const { scenario, retiree } = await retireCharacter(playing, veteran, 'gentleman', writer, '1200-02-01');

    expect(retiree).toMatchObject({ name: 'Kestrel', age: 52, purse: 900, id: 'retired-p1' });
    expect(retiree!.relationships[0]).toMatchObject({ kind: 'friend', npcId: scenario.npcs[innkeeperIndex].id });
    expect(scenario.npcs[innkeeperIndex].relationships.at(-1)).toMatchObject({ npcId: 'retired-p1', playerId: undefined });
    expect(isPlaying(scenario, 'p1')).toBe(false);
    expect(scenario.npcs).toContain(retiree);
  });

  it('only the player can retire their character, during play', async () => {
    const away = logOut(logIn(await buildWorld(), kestrel, new Date('2026-11-01T10:00:00Z')).scenario, 'p1');
    expect((await retireCharacter(away, kestrel, 'gentleman', writer, '1200-02-01')).refusal).toContain('only be retired');
  });
});

describe('a character can only die in play', () => {
  it('refuses to kill a character whose player is logged out', async () => {
    const away = logOut(logIn(await buildWorld(), kestrel, new Date('2026-11-01T10:00:00Z')).scenario, 'p1');
    const attempt = killPlayerCharacter(away, kestrel, 'a fall', '1200-01-05');

    expect(attempt.killed).toBe(false);
    expect(attempt.refusal).toBe('Kestrel is not in play. A character can only die while their player is playing.');
    expect(attempt.scenario).toBe(away);
  });

  it('during play a character can die, and the player comes back as someone new', async () => {
    const playing = logIn(await buildWorld(), kestrel, new Date('2026-11-01T10:00:00Z')).scenario;
    const death = killPlayerCharacter(playing, kestrel, "a bandit's arrow", '1200-01-05');

    expect(death.killed).toBe(true);
    expect(isPlaying(death.scenario, 'p1')).toBe(false);
    const newcomer: PlayerCharacter = { id: 'p1-second', name: 'Mira', description: 'a quiet herbalist' };
    expect(isPlaying(logIn(death.scenario, newcomer, new Date('2026-11-01T11:00:00Z')).scenario, 'p1-second')).toBe(true);
  });
});
