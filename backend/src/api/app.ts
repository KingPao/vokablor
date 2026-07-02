import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import type { AppEnv } from '../middleware/session.js';
import { attachSession } from '../middleware/session.js';
import { closeDb } from '../db/client.js';
import { apiError } from './errors.js';
import { AIProviderError } from '../services/ai-providers/index.js';
import { authRoutes } from './routes/auth.js';
import { vocabularyRoutes } from './routes/vocabulary.js';
import { trainingRoutes } from './routes/training.js';
import { excerptRoutes } from './routes/excerpts.js';
import { speakingRoutes } from './routes/speaking.js';
import { aiProviderRoutes } from './routes/ai-providers.js';
import { conversationRoutes } from './routes/conversation.js';
import { progressRoutes } from './routes/progress.js';
import { syncRoutes } from './routes/sync.js';

export const app = new Hono<AppEnv>();

app.use('*', attachSession);

app.get('/api/health', (c) => c.json({ status: 'ok' }));

app.route('/api/auth', authRoutes);
app.route('/api', vocabularyRoutes);
app.route('/api', trainingRoutes);
app.route('/api', excerptRoutes);
app.route('/api', speakingRoutes);
app.route('/api', aiProviderRoutes);
app.route('/api', conversationRoutes);
app.route('/api', progressRoutes);
app.route('/api', syncRoutes);

/**
 * Safety net so every error response honors the `{error: {code, message}}` contract
 * (contracts/api.md) — without this, an uncaught throw (e.g. the configured AIProvider
 * rejecting because no API key/quota is set up) falls through to Hono's default handler,
 * which returns a plain-text "Internal Server Error" that breaks the frontend's JSON parsing.
 */
app.onError((err, c) => {
  console.error(err);
  if (err instanceof AIProviderError) {
    return apiError(c, 502, 'AI_PROVIDER_ERROR', 'The configured AI provider is unavailable right now.');
  }
  return apiError(c, 500, 'INTERNAL_ERROR', 'Something went wrong. Please try again.');
});

/* v8 ignore start -- static asset serving for the production image (docker/Dockerfile copies
 * frontend/dist next to this process's WORKDIR); local dev serves the frontend via Vite
 * instead (root package.json's `dev` script). Skipped in tests: there's no frontend/dist next
 * to the test process, and serve-static logs a (harmless but noisy) warning when it's absent. */
if (process.env.NODE_ENV !== 'test') {
  app.use('/*', serveStatic({ root: './frontend/dist' }));
  app.get('/*', serveStatic({ path: './frontend/dist/index.html' }));
}
/* v8 ignore stop */

/* v8 ignore start -- process bootstrap/lifecycle, exercised by running the server, not unit tests */
const port = Number(process.env.PORT ?? 3000);
if (process.env.NODE_ENV !== 'test') {
  const server = serve({ fetch: app.fetch, port }, (info) => {
    console.log(`vokablor backend listening on port ${info.port}`);
  });

  const shutdown = async (): Promise<void> => {
    server.close();
    await closeDb();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
/* v8 ignore stop */
