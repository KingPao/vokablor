import { randomUUID } from 'node:crypto';
import { db } from '../db/client.js';
import type { AIProviderName } from '../db/schema.js';

export interface AIProviderConfig {
  id: string;
  learnerId: string;
  provider: AIProviderName;
  model: string;
  apiKeyEncrypted: Buffer | null;
  createdAt: Date;
}

function toConfig(row: {
  id: string;
  learner_id: string;
  provider: AIProviderName;
  model: string;
  api_key_encrypted: Buffer | null;
  created_at: Date;
}): AIProviderConfig {
  return {
    id: row.id,
    learnerId: row.learner_id,
    provider: row.provider,
    model: row.model,
    apiKeyEncrypted: row.api_key_encrypted,
    createdAt: row.created_at,
  };
}

export async function list(learnerId: string): Promise<AIProviderConfig[]> {
  const rows = await db.selectFrom('ai_provider_configs').selectAll().where('learner_id', '=', learnerId).execute();
  return rows.map(toConfig);
}

export async function findById(id: string): Promise<AIProviderConfig | null> {
  const row = await db.selectFrom('ai_provider_configs').selectAll().where('id', '=', id).executeTakeFirst();
  return row ? toConfig(row) : null;
}

export async function create(
  learnerId: string,
  provider: AIProviderName,
  model: string,
  apiKeyEncrypted: Buffer | null,
): Promise<AIProviderConfig> {
  const id = randomUUID();
  await db
    .insertInto('ai_provider_configs')
    .values({ id, learner_id: learnerId, provider, model, api_key_encrypted: apiKeyEncrypted })
    .execute();
  const created = await findById(id);
  if (!created) throw new Error('Failed to create AI provider config');
  return created;
}

/** Used to apply an already-configured provider to a newly-created LearnerLanguage (FR-016). */
export async function findMostRecent(learnerId: string): Promise<AIProviderConfig | null> {
  const row = await db
    .selectFrom('ai_provider_configs')
    .selectAll()
    .where('learner_id', '=', learnerId)
    .orderBy('created_at', 'desc')
    .limit(1)
    .executeTakeFirst();
  return row ? toConfig(row) : null;
}

export async function remove(id: string, learnerId: string): Promise<void> {
  await db
    .deleteFrom('ai_provider_configs')
    .where('id', '=', id)
    .where('learner_id', '=', learnerId)
    .execute();
}
