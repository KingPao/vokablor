import 'dotenv/config';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import type { AppEnv } from '../middleware/session.js';
import { attachSession } from '../middleware/session.js';
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

const port = Number(process.env.PORT ?? 3000);
if (process.env.NODE_ENV !== 'test') {
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`vokablor backend listening on port ${info.port}`);
  });
}
