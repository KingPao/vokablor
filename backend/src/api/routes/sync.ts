import { Hono } from 'hono';
import type { AppEnv } from '../../middleware/session.js';
import { requireAuth } from '../../middleware/session.js';
import { apiError } from '../errors.js';
import { OfflineSyncError, replayAction } from '../../services/offline-sync-service.js';
import type { SyncActionPayload } from '../../services/offline-sync-service.js';

export const syncRoutes = new Hono<AppEnv>();
syncRoutes.use('*', requireAuth);

syncRoutes.post('/sync/actions', async (c) => {
  const learnerId = c.get('learnerId') as string;
  const body = await c.req.json<SyncActionPayload>().catch(() => null);
  if (!body?.idempotencyKey || !body?.type) {
    return apiError(c, 400, 'VALIDATION_ERROR', 'idempotencyKey and type are required');
  }
  try {
    const result = await replayAction(learnerId, body);
    return c.json(result, 200);
  } catch (err) {
    if (err instanceof OfflineSyncError) return apiError(c, 400, 'VALIDATION_ERROR', err.message);
    throw err;
  }
});
