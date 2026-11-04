import { parseCommand, stripArticle } from './commands';

/** The parser is plain logic, so its tests are plain too: a sentence in, a command out. */
describe('parseCommand', () => {
  it('reads the simple commands', () => {
    expect(parseCommand('look')).toEqual({ kind: 'look' });
    expect(parseCommand('  HELP ')).toEqual({ kind: 'help' });
    expect(parseCommand('recap')).toEqual({ kind: 'recap' });
  });

  it('reads the ways people ask where someone is', () => {
    expect(parseCommand('where is Bram?')).toEqual({ kind: 'where', name: 'Bram' });
    expect(parseCommand("where's the innkeeper")).toEqual({ kind: 'where', name: 'the innkeeper' });
  });

  it('reads travel', () => {
    expect(parseCommand('go to the forge')).toEqual({ kind: 'go', place: 'the forge' });
    expect(parseCommand('walk to Ashford square')).toEqual({ kind: 'go', place: 'Ashford square' });
  });

  it('reads talking, with a colon or a comma', () => {
    expect(parseCommand('talk to Bram: Can you mend a sword?')).toEqual({ kind: 'talk', name: 'Bram', message: 'Can you mend a sword?' });
    expect(parseCommand('speak with the miller, how is business')).toEqual({ kind: 'talk', name: 'the miller', message: 'how is business' });
    expect(parseCommand('say Thank you kindly')).toEqual({ kind: 'say', message: 'Thank you kindly' });
  });

  it('reads sending, paying and waiting', () => {
    expect(parseCommand('send for Bram')).toEqual({ kind: 'send', name: 'Bram' });
    expect(parseCommand('pay Bram 20')).toEqual({ kind: 'pay', name: 'Bram', amount: 20 });
    expect(parseCommand('wait 3 hours')).toEqual({ kind: 'wait', hours: 3 });
    expect(parseCommand('wait')).toEqual({ kind: 'wait', hours: 1 });
    expect(parseCommand('wait 100')).toEqual({ kind: 'wait', hours: 24 });
  });

  it('says plainly when it does not understand', () => {
    expect(parseCommand('dance a jig')).toEqual({ kind: 'unknown', text: 'dance a jig' });
  });

  it('treats "the innkeeper" and "innkeeper" alike', () => {
    expect(stripArticle('the innkeeper')).toBe('innkeeper');
    expect(stripArticle('Bram')).toBe('Bram');
  });
});
