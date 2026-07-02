import type { AIProviderName } from '../../db/schema.js';
import { AnthropicProvider } from './anthropic.js';
import { GoogleProvider } from './google.js';
import { createNvidiaFreeProvider } from './nvidia-free.js';
import { OpenAIProvider } from './openai.js';
import type { AIProvider } from './types.js';

export type { AIProvider } from './types.js';
export * from './types.js';

let sharedFreeProvider: AIProvider | null = null;

/** The always-available default (research.md #6); lazily constructed once per process. */
export function getSharedFreeProvider(): AIProvider {
  sharedFreeProvider ??= createNvidiaFreeProvider();
  return sharedFreeProvider;
}

/**
 * Resolves the AIProvider implementation for a learner-configured provider (research.md #5).
 * `provider = 'nvidia_free'` with no key is the shared fallback; anything else requires a key.
 */
export function resolveProvider(provider: AIProviderName, model: string, apiKey: string | null): AIProvider {
  if (provider === 'nvidia_free' || !apiKey) {
    return getSharedFreeProvider();
  }
  switch (provider) {
    case 'openai':
      return new OpenAIProvider(apiKey, model);
    case 'anthropic':
      return new AnthropicProvider(apiKey, model);
    case 'google':
      return new GoogleProvider(apiKey, model);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}
