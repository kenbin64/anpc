import { talkToNpc } from './conversation';
import { PromptMessage } from './story-prompt';
import { createDice } from './random';
import { renderAsHeard } from './speech';
import { buildTestNpc } from './test-npc';

describe('how a player is heard', () => {
  it('turns modern talk into the speech of a medieval world', () => {
    expect(renderAsHeard("Hey guys, yeah, okay, thanks! What's up?")).toBe('Hail friends, aye, very well, my thanks! How fares it?');
    expect(renderAsHeard("I'm gonna hang out at the tavern lol")).toBe("I'm going to keep company at the tavern");
  });

  it('catches slang "cool" as a whole phrase', () => {
    expect(renderAsHeard("Okay cool, I'm gonna need one by Friday.")).toBe("Very well, I'm going to need one by Friday.");
    expect(renderAsHeard("That's cool with me.")).toBe('That is fine with me.');
  });

  it('leaves words with an everyday old meaning alone', () => {
    expect(renderAsHeard('The water in the great hall is cool, and I have money.')).toBe('The water in the great hall is cool, and I have money.');
  });

  it('changes nothing in a modern world', () => {
    expect(renderAsHeard('Hey guys, yeah, okay', 'modern')).toBe('Hey guys, yeah, okay');
  });

  it('is what the NPC hears and remembers, not what the player typed', async () => {
    const shown: PromptMessage[][] = [];
    const chat = async (messages: PromptMessage[]) => {
      shown.push(messages);
      return 'Aye, good day to you as well.';
    };
    const turn = await talkToNpc(buildTestNpc(), { id: 'p1', name: 'Kestrel', description: 'a sellsword' },
      'Hey dude, yeah, what\'s up?', chat, createDice('s'), '1200-02-01', 'a forge village');

    expect(shown[0][1].content).toContain('Hail friend, aye, how fares it?');
    expect(shown[0][1].content).not.toContain('dude');
    expect(turn.npc.lifeLog.find(event => event.kind === 'social')?.summary).toContain('Hail friend, aye, how fares it?');
  });
});
