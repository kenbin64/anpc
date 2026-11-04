import { STORY_SCHEMA } from './story';
import { PromptMessage } from './story-prompt';

/**
 * STORY WRITERS: the plug where an AI goes in.
 *
 * A StoryWriter takes the prompt and gives back the model's JSON. The generator only knows this one
 * function shape, so swapping Ollama for Claude, or for a fake in tests, changes nothing else.
 *
 * A local model can stumble once, for example a graphics-card error under memory pressure. So every call
 * to Ollama gets one retry after a short pause before the error is passed on.
 */
export type StoryWriter = (messages: PromptMessage[], seed: number) => Promise<unknown>;

/** A model that answers in plain text, for an NPC's spoken replies. Same plug idea as StoryWriter. */
export type ChatModel = (messages: PromptMessage[], seed: number) => Promise<string>;

export interface OllamaOptions {
  model: string;
  /** Where Ollama listens, usually http://localhost:11434. */
  baseUrl: string;
}

const RETRY_PAUSE_MS = 2000;

/** Sends one chat request to Ollama and returns the model's text, retrying once if Ollama reports an error. */
async function askOllama(options: OllamaOptions, request: Record<string, unknown>, attemptsLeft = 2): Promise<string> {
  const response = await fetch(`${options.baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: options.model, stream: false, ...request }),
  });
  let text: string;
  if (response.ok) {
    const body = (await response.json()) as { message?: { content?: string } };
    text = body.message?.content ?? '';
  } else if (attemptsLeft > 1) {
    await new Promise(resolve => setTimeout(resolve, RETRY_PAUSE_MS));
    text = await askOllama(options, request, attemptsLeft - 1);
  } else {
    throw new Error(`Ollama answered ${response.status}: ${await response.text()}`);
  }
  return text;
}

/** Plain-text chat on a local Ollama model. */
export function createOllamaChat(options: OllamaOptions): ChatModel {
  return (messages, seed) => askOllama(options, { messages, options: { temperature: 0.8, seed } });
}

/**
 * A writer that runs on a local Ollama model: private, free, and no data leaves the machine.
 *
 * Even when told the exact JSON shape, a small model now and then sends back JSON that won't parse. That
 * isn't a crash, so it's handled like a stumble: ask once more with a fresh seed, and only then give up.
 */
export function createOllamaWriter(options: OllamaOptions): StoryWriter {
  const writeOnce = async (messages: PromptMessage[], seed: number): Promise<unknown> =>
    JSON.parse((await askOllama(options, { messages, format: STORY_SCHEMA, options: { temperature: 0.8, seed } })) || '{}');
  return async (messages, seed) => {
    let story: unknown;
    try {
      story = await writeOnce(messages, seed);
    } catch (problem) {
      if (!(problem instanceof SyntaxError)) throw problem;
      story = await writeOnce(messages, seed + 1);
    }
    return story;
  };
}
