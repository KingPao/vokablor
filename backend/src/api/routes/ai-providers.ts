import { Hono } from 'hono';
import type { AppEnv } from '../../middleware/session.js';
import { requireAuth } from '../../middleware/session.js';
import { apiError } from '../errors.js';
import {
  createConfig,
  deleteConfig,
  listConfigs,
  AIProviderConfigError,
} from '../../services/ai-provider-config-service.js';
import type { AIProviderName } from '../../db/schema.js';

export const aiProviderRoutes = new Hono<AppEnv>();
aiProviderRoutes.use('*', requireAuth);

aiProviderRoutes.get('/ai-providers', async (c) => {
  const learnerId = c.get('learnerId') as string;
  return c.json(await listConfigs(learnerId), 200);
});

aiProviderRoutes.post('/ai-providers', async (c) => {
  const learnerId = c.get('learnerId') as string;
  const body = await c.req.json<{ provider: AIProviderName; model: string; apiKey?: string }>().catch(() => null);
  if (!body?.provider || !body?.model) {
    return apiError(c, 400, 'VALIDATION_ERROR', 'provider and model are required');
  }
  try {
    const config = await createConfig(learnerId, body.provider, body.model, body.apiKey);
    return c.json(config, 201);
  } catch (err) {
    if (err instanceof AIProviderConfigError) return apiError(c, 400, 'VALIDATION_ERROR', err.message);
    throw err;
  }
});

aiProviderRoutes.delete('/ai-providers/:id', async (c) => {
  const learnerId = c.get('learnerId') as string;
  await deleteConfig(c.req.param('id'), learnerId);
  return c.body(null, 204);
});
