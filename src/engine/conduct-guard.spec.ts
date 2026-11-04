import { CONDUCT_WARNING, checkConduct } from './conduct-guard';
import { talkToNpc } from './conversation';
import { PlayerCharacter } from './npc.model';
import { PromptMessage } from './story-prompt';
import { createDice } from './random';
import { shapeStory } from './story';
import { buildTestNpc } from './test-npc';

const wanderer: PlayerCharacter = { id: 'player-1', name: 'Kestrel', description: 'a road-worn sellsword' };

function createRecordingChat(answer: string) {
  const shown: PromptMessage[][] = [];
  const chat = async (messages: PromptMessage[]) => {
    shown.push(messages);
    return answer;
  };
  return { chat, shown };
}

describe('conduct guard', () => {
  it('allows ordinary combat and the language of a fighting world', () => {
    for (const line of [
      "I'll cut you down with my sword!", 'We brawled with our fists till dawn.', 'He drew a naked blade.',
      'My father died in battle.', 'Stand and fight, coward!', 'The bandits killed the merchant on the road.',
    ]) {
      expect(checkConduct(line)).toEqual({ allowed: true, problem: null });
    }
  });

  it('stops sexual violence, sexual content and cruelty beyond normal fighting', () => {
    expect(checkConduct('I want to rape her').problem).toBe('sexual-violence');
    expect(checkConduct('Take off your clothes and undress for me').problem).toBe('sexual');
    expect(checkConduct('Let us torture the prisoner').problem).toBe('cruelty');
  });
});

describe('conduct in conversation', () => {
  it('stops a message cold: no AI, no record, no change, just a warning', async () => {
    const { chat, shown } = createRecordingChat('This should never be said.');
    const bram = buildTestNpc();
    const turn = await talkToNpc(bram, wanderer, 'I am going to rape someone tonight', chat, createDice('x'), '1200-02-01', 'a forge village');

    expect(turn.warning).toBe(CONDUCT_WARNING);
    expect(turn.reply).toBe('');
    expect(shown).toHaveLength(0);
    expect(turn.npc).toBe(bram);
  });

  it('lets normal combat talk through to the NPC', async () => {
    const { chat } = createRecordingChat('Then draw your sword and we will settle this outside.');
    const turn = await talkToNpc(buildTestNpc(), wanderer, 'I will fight you for that insult!', chat, createDice('x'), '1200-02-01', 'a forge village');

    expect(turn.warning).toBeNull();
    expect(turn.reply).toBe('Then draw your sword and we will settle this outside.');
  });

  it('replaces an AI reply that crosses the line, and never records it', async () => {
    const { chat } = createRecordingChat('Come back tonight and undress for me.');
    const turn = await talkToNpc(buildTestNpc(), wanderer, 'Good evening', chat, createDice('x'), '1200-02-01', 'a forge village');

    expect(turn.replyWasReplaced).toBe(true);
    expect(JSON.stringify(turn.npc.lifeLog)).not.toContain('undress');
  });
});

describe('conduct in generated characters', () => {
  it('throws out a backstory or a note that crosses the line', () => {
    const story = shapeStory({
      name: 'Varn', backstory: 'He tortured prisoners for the old lord.',
      relationships: [{ name: 'Mira', kind: 'enemy', affinity: 5, notes: 'he once tried to molest her' }],
    }, false);
    expect(story.backstory).toBe('Their past is unknown.');
    expect(story.relationships[0].notes).toBeUndefined();
  });
});
