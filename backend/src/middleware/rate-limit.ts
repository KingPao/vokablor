import type { Context, Next } from 'hono';
import { db } from '../db/client.js';
import type { AppEnv } from './session.js';

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function dailyLimit(): number {
  return Number(process.env.NVIDIA_FREE_RATE_LIMIT_PER_DAY ?? 50);
}

/**
 * Fixed-window (per calendar day, UTC), MySQL-backed counter (research.md #6). Only meant to
 * guard the shared free-tier AIProvider path — routes that call `resolveProvider` with a
 * learner-supplied key must skip this middleware, since BYO keys are self-limited by the
 * learner's own account with that provider.
 */
export async function enforceSharedProviderRateLimit(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  const learnerId = c.get('learnerId');
  if (!learnerId) {
    return c.json({ error: { code: 'UNAUTHENTICATED', message: 'Login required' } }, 401);
  }

  const windowStart = todayUtc();
  const limit = dailyLimit();

  const usage = await db
    .selectFrom('ai_free_tier_usage')
    .select('request_count')
    .where('learner_id', '=', learnerId)
    .where('window_start', '=', windowStart)
    .executeTakeFirst();

  if (usage && usage.request_count >= limit) {
    return c.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: 'Daily shared free-tier AI quota reached. Configure your own AI provider to continue.',
        },
      },
      429,
    );
  }

  await db
    .insertInto('ai_free_tier_usage')
    .values({ learner_id: learnerId, window_start: windowStart, request_count: 1 })
    .onDuplicateKeyUpdate({ request_count: (eb) => eb('request_count', '+', 1) })
    .execute();

  await next();
}
