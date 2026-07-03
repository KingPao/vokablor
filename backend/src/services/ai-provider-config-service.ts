import * as aiProviderConfigModel from '../models/ai-provider-config.js';
import type { AIProviderConfig } from '../models/ai-provider-config.js';
import type { AIProviderName } from '../db/schema.js';
import { encryptApiKey, decryptApiKey } from './crypto.js';
import { resolveProvider, type AIProvider } from './ai-providers/index.js';
import { setAiProviderForAllLanguages } from '../models/learner-language.js';

export class AIProviderConfigError extends Error {}

export interface AIProviderConfigSummary {
  id: string;
  provider: AIProviderName;
  model: string;
  hasKey: boolean;
  createdAt: Date;
}

function toSummary(config: AIProviderConfig): AIProviderConfigSummary {
  return { id: config.id, provider: config.provider, model: config.model, hasKey: config.apiKeyEncrypted !== null, createdAt: config.createdAt };
}

export async function listConfigs(learnerId: string): Promise<AIProviderConfigSummary[]> {
  return (await aiProviderConfigModel.list(learnerId)).map(toSummary);
}

/** FR-016: BYO key required for every provider except the shared free-tier default. */
export async function createConfig(
  learnerId: string,
  provider: AIProviderName,
  model: string,
  apiKey: string | undefined,
): Promise<AIProviderConfigSummary> {
  if (provider !== 'nvidia_free' && !apiKey) {
    throw new AIProviderConfigError('An API key is required for this provider');
  }
  const encrypted = apiKey ? encryptApiKey(apiKey) : null;
  const config = await aiProviderConfigModel.create(learnerId, provider, model, encrypted);
  // Adding a provider means "use this for me now" — apply it across every language the
  // learner is already studying (see setAiProviderForAllLanguages for the rationale).
  await setAiProviderForAllLanguages(learnerId, config.id);
  return toSummary(config);
}

export async function deleteConfig(id: string, learnerId: string): Promise<void> {
  await aiProviderConfigModel.remove(id, learnerId);
}

/** Resolves the concrete AIProvider a learner's config points to — falls back to the shared provider if unset. */
export async function resolveProviderForLearner(configId: string | null): Promise<AIProvider> {
  if (!configId) return resolveProvider('nvidia_free', '', null);
  const config = await aiProviderConfigModel.findById(configId);
  if (!config) return resolveProvider('nvidia_free', '', null);
  const apiKey = config.apiKeyEncrypted ? decryptApiKey(config.apiKeyEncrypted) : null;
  return resolveProvider(config.provider, config.model, apiKey);
}
