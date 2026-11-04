import { approachAndTalk, recordPlayerDeath, sendForNpc } from './meeting';
import { recordDeath } from './health';
import { PlayerCharacter } from './npc.model';
import { createDice } from './random';
import { buildTestNpc } from './test-npc';
import { findWhereabouts } from './whereabouts';

/** Checked against the calendar: 1 January 1200 was a Saturday. */
const MONDAY = '1200-01-03';
const SUNDAY = '1200-01-02';
const chat = async () => 'Aye, what do you need?';

function kestrelAt(location: string): PlayerCharacter {
  return { id: 'player-1', name: 'Kestrel', description: 'a road-worn sellsword', location };
}

describe('whereabouts', () => {
  const bram = buildTestNpc();

  it('follows the NPC through their day', () => {
    expect(findWhereabouts(bram, MONDAY, 3)).toEqual({ place: "Bram's home", activity: 'asleep' });
    expect(findWhereabouts(bram, MONDAY, 10)).toEqual({ place: 'the village forge', activity: 'working as blacksmith' });
    expect(findWhereabouts(bram, SUNDAY, 9)).toEqual({ place: 'Chapel of Dawn', activity: 'at worship' });
  });

  it('keeps the sick in bed and the dead in the graveyard', () => {
    const sick = { ...bram, health: { condition: 40, ailments: ['winter fever'], alive: true } };
    expect(findWhereabouts(sick, MONDAY, 10).activity).toBe('sick in bed with winter fever');
    expect(findWhereabouts(recordDeath(bram, 'winter fever', MONDAY), MONDAY, 10).place).toBe('the graveyard');
  });

  it('gives the same answer every time for the same moment', () => {
    expect(findWhereabouts(bram, MONDAY, 20)).toEqual(findWhereabouts(bram, MONDAY, 20));
  });
});

describe('meeting', () => {
  it('will not let a player talk to someone who is somewhere else, and says where they are', async () => {
    const result = await approachAndTalk(buildTestNpc(), kestrelAt('the tavern'), 'Hello', chat, createDice('m'), MONDAY, 10, 'a village');
    expect(result.turn).toBeNull();
    expect(result.notHere).toBe(
      "Bram isn't here. They're at the village forge, working as blacksmith. Travel there, or send someone to fetch them.",
    );
  });

  it('lets them talk once the player has traveled there', async () => {
    const result = await approachAndTalk(buildTestNpc(), kestrelAt('the village forge'), 'Hello', chat, createDice('m'), MONDAY, 10, 'a village');
    expect(result.turn?.reply).toBe('Aye, what do you need?');
  });

  it('sending for an NPC is a request they answer for themselves', () => {
    const friendly = buildTestNpc({
      temperament: { disposition: 60, honesty: 60, alignment: 60, randomness: 0 },
      relationships: [{ name: 'Kestrel', kind: 'friend', affinity: 80, playerId: 'player-1' }],
    });
    const result = sendForNpc(friendly, { name: 'Kestrel', playerId: 'player-1' }, 'the tavern', 'a stable boy', MONDAY, 20, createDice('f'));

    expect(result.comes).toBe(true);
    expect(findWhereabouts(result.npc, MONDAY, result.arrivesAtHour!).place).toBe('the tavern');
  });

  it('someone who dislikes the sender will not come, and the sick cannot', () => {
    const cold = buildTestNpc({ relationships: [{ name: 'Kestrel', kind: 'enemy', affinity: 5, playerId: 'player-1' }] });
    expect(sendForNpc(cold, { name: 'Kestrel', playerId: 'player-1' }, 'the tavern', 'a boy', MONDAY, 20, createDice('c')).comes).toBe(false);
    const sick = buildTestNpc({ health: { condition: 30, ailments: ['a bad cough'], alive: true } });
    expect(sendForNpc(sick, { name: 'Kestrel' }, 'the tavern', 'a boy', MONDAY, 20, createDice('s')).report).toContain('too sick');
  });
});

describe('a player character dies', () => {
  it('those who knew them remember it, and a new character starts as a stranger', () => {
    const friend = buildTestNpc({ relationships: [{ name: 'Kestrel', kind: 'friend', affinity: 80, playerId: 'player-1' }] });
    const stranger = buildTestNpc({ id: 'other', relationships: [] });
    const [rememberer, unaware] = recordPlayerDeath([friend, stranger], kestrelAt('the road'), 'a bandit\'s arrow', '1200-03-01');

    expect(rememberer.lifeLog.at(-1)?.summary).toBe("Heard that Kestrel died. Cause: a bandit's arrow.");
    expect(unaware).toBe(stranger);
    expect(rememberer.relationships.some(tie => tie.playerId === 'player-2')).toBe(false);
  });
});
