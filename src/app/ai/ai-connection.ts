import { Service, signal } from '@angular/core';
import { ChatModel, StoryWriter, createOllamaChat, createOllamaWriter } from '../../engine';

/**
 * LAYER 2, THE AI CONNECTION: one service that knows where the AI is and whether it's answering.
 *
 * ANPC runs its AI on the player's own machine through Ollama, so nothing they say leaves the computer
 * and nothing is billed. This service holds the settings (which model, at what address), checks that
 * Ollama is up, and hands the engine a StoryWriter for creating characters and a ChatModel for talking.
 *
 * The settings are remembered in localStorage, which is fine here: they're a per-person preference, not
 * game data. Game data lives in IndexedDB (layer 1).
 */

export type ConnectionStatus = 'checking' | 'connected' | 'offline';

const SETTINGS_KEY = 'anpc.ai-settings';

interface AiSettings {
  model: string;
  baseUrl: string;
}

const DEFAULT_SETTINGS: AiSettings = { model: 'llama3.1:8b', baseUrl: 'http://localhost:11434' };

function readSavedSettings(): AiSettings {
  let settings = DEFAULT_SETTINGS;
  try {
    settings = { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}') };
  } catch {
    settings = DEFAULT_SETTINGS;
  }
  return settings;
}

@Service()
export class AiConnection {
  private readonly settings = signal<AiSettings>(readSavedSettings());

  readonly model = () => this.settings().model;
  readonly status = signal<ConnectionStatus>('checking');

  /** Asks Ollama for its list of models: a cheap way to learn whether it's running. */
  async checkConnection(): Promise<ConnectionStatus> {
    this.status.set('checking');
    let status: ConnectionStatus = 'offline';
    try {
      const response = await fetch(`${this.settings().baseUrl}/api/tags`, { signal: AbortSignal.timeout(3000) });
      status = response.ok ? 'connected' : 'offline';
    } catch {
      status = 'offline';
    }
    this.status.set(status);
    return status;
  }

  useModel(model: string): void {
    this.settings.update(current => ({ ...current, model }));
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings()));
    } catch {
      // Storage can be blocked; the choice still holds until the page closes.
    }
  }

  storyWriter(): StoryWriter {
    return createOllamaWriter(this.settings());
  }

  chatModel(): ChatModel {
    return createOllamaChat(this.settings());
  }
}
