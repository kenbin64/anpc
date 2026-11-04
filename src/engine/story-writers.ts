import { STORY_SCHEMA } from './story';
import { PromptMessage } from './story-prompt';

/**
 * STORY WRITERS: the plug where an AI goes in.
 *
 * A StoryWriter takes the prompt and gives back the model's JSON. The generator only knows this one
 * function shape, so swapping Ollama for Claude, or for a fake in tests, changes nothing else.
 */
export type StoryWriter = (messages: PromptMessage[], seed: number) => Promise<unknown>;

export interface OllamaOptions {
  model: string;
  /** Where Ollama listens, usually http://localhost:11434. */
  baseUrl: string;
}

/** A model that answers in plain text, for an NPC's spoken replies. Same plug idea as StoryWriter. */
export type ChatModel = (messages: PromptMessage[], seed: number) => Promise<string>;

/** Plain-text chat on a local Ollama model. */
export function createOllamaChat(options: OllamaOptions): ChatModel {
  return async (messages, seed) => {
    const response = await fetch(`${options.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: options.model, messages, stream: false, options: { temperature: 0.8, seed } }),
    });
    if (!response.ok) {
      throw new Error(`Ollama answered ${response.status}: ${await response.text()}`);
    }
    const body = (await response.json()) as { message?: { content?: string } };
    return body.message?.content ?? '';
  };
}

/** A writer that runs on a local Ollama model: private, free, and no data leaves the machine. */
export function createOllamaWriter(options: OllamaOptions): StoryWriter {
  return async (messages, seed) => {
    const response = await fetch(`${options.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        messages,
        format: STORY_SCHEMA,
        stream: false,
        options: { temperature: 0.8, seed },
      }),
    });
    if (!response.ok) {
      throw new Error(`Ollama answered ${response.status}: ${await response.text()}`);
    }
    const body = (await response.json()) as { message?: { content?: string } };
    return JSON.parse(body.message?.content ?? '{}');
  };
}
