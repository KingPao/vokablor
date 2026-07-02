import { Hono } from 'hono';
import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../test-db.js';
import { db } from '../../src/db/client.js';
import { createLearner } from '../../src/models/learner.js';
import { enforceSharedProviderRateLimit } from '../../src/middleware/rate-limit.js';
import type { AppEnv } from '../../src/middleware/session.js';

function buildTestApp(learnerId: string | null) {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.set('learnerId', learnerId);
    await next();
  });
  app.get('/guarded', enforceSharedProviderRateLimit, (c) => c.json({ ok: true }));
  return app;
}

describe('shared free-tier rate limit middleware', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('rejects with 401 when no learner is attached (defensive — requireAuth normally runs first)', async () => {
    const app = buildTestApp(null);
    const res = await app.request('/guarded');
    expect(res.status).toBe(401);
  });

  it('allows the request through and increments the daily counter', async () => {
    const learner = await createLearner('rate-limited@example.com', 'hash');
    const app = buildTestApp(learner.id);
    const res = await app.request('/guarded');
    expect(res.status).toBe(200);

    const usage = await db
      .selectFrom('ai_free_tier_usage')
      .select('request_count')
      .where('learner_id', '=', learner.id)
      .executeTakeFirst();
    expect(usage?.request_count).toBe(1);
  });

  it('rejects with 429 once the daily quota is already at the limit', async () => {
    const learner = await createLearner('over-limit@example.com', 'hash');
    const windowStart = new Date().toISOString().slice(0, 10);
    await db
      .insertInto('ai_free_tier_usage')
      .values({ learner_id: learner.id, window_start: windowStart, request_count: 50 })
      .execute();

    const app = buildTestApp(learner.id);
    const res = await app.request('/guarded');
    expect(res.status).toBe(429);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
  });
});
