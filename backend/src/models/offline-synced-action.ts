import { db } from '../db/client.js';

export async function hasBeenApplied(idempotencyKey: string): Promise<boolean> {
  const row = await db
    .selectFrom('offline_synced_actions')
    .select('idempotency_key')
    .where('idempotency_key', '=', idempotencyKey)
    .executeTakeFirst();
  return row !== undefined;
}

export async function markApplied(idempotencyKey: string, learnerId: string): Promise<void> {
  await db
    .insertInto('offline_synced_actions')
    .values({ idempotency_key: idempotencyKey, learner_id: learnerId })
    .onDuplicateKeyUpdate({ idempotency_key: idempotencyKey })
    .execute();
}
