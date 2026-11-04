import { createOllamaChat } from './story-writers';

/** Fakes Ollama with a stand-in fetch that fails a set number of times before answering. */
function fakeOllama(failuresFirst: number) {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return calls <= failuresFirst
      ? new Response('{"error":"CUDA error: an illegal memory access was encountered"}', { status: 500 })
      : new Response(JSON.stringify({ message: { content: 'Good day to ye.' } }), { status: 200 });
  }) as typeof fetch;
  return () => calls;
}

describe('writing characters with Ollama', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  it('asks again once when the model sends back broken JSON', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      const content = calls === 1 ? '{"name": "Edwin",\n bad }' : '{"name": "Edwin"}';
      return new Response(JSON.stringify({ message: { content } }), { status: 200 });
    }) as typeof fetch;
    const { createOllamaWriter } = await import('./story-writers');
    const writer = createOllamaWriter({ model: 'llama3.1:8b', baseUrl: 'http://localhost:11434' });

    expect(await writer([{ role: 'user', content: 'Write a miller' }], 1)).toEqual({ name: 'Edwin' });
    expect(calls).toBe(2);
  });
});

describe('talking to Ollama', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  it('retries once when the model stumbles, and gets the answer', async () => {
    const callCount = fakeOllama(1);
    const chat = createOllamaChat({ model: 'llama3.1:8b', baseUrl: 'http://localhost:11434' });
    expect(await chat([{ role: 'user', content: 'Hello' }], 1)).toBe('Good day to ye.');
    expect(callCount()).toBe(2);
  });

  it('gives up after the retry and passes on the real error', async () => {
    fakeOllama(5);
    const chat = createOllamaChat({ model: 'llama3.1:8b', baseUrl: 'http://localhost:11434' });
    await expect(chat([{ role: 'user', content: 'Hello' }], 1)).rejects.toThrow('Ollama answered 500');
  }, 10000);
});
