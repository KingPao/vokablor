import { Hono } from 'hono';
import type { AppEnv } from '../../middleware/session.js';
import { requireAuth } from '../../middleware/session.js';
import { apiError } from '../errors.js';
import { ensureLearnerLanguage } from '../../models/learner-language.js';
import { startTrainingSession, submitAnswer, TrainingError } from '../../services/training-service.js';

export const trainingRoutes = new Hono<AppEnv>();
trainingRoutes.use('*', requireAuth);

trainingRoutes.post('/languages/:languageCode/training/session', async (c) => {
  const learnerId = c.get('learnerId') as string;
  const learnerLanguage = await ensureLearnerLanguage(learnerId, c.req.param('languageCode'));
  const { sessionId, dueItems } = await startTrainingSession(learnerLanguage.id);
  return c.json({ sessionId, dueItems }, 200);
});

trainingRoutes.post('/training/sessions/:sessionId/answers', async (c) => {
  const body = await c.req.json<{ vocabularyItemId: string; correct: boolean }>().catch(() => null);
  if (!body?.vocabularyItemId || typeof body.correct !== 'boolean') {
    return apiError(c, 400, 'VALIDATION_ERROR', 'vocabularyItemId and correct are required');
  }
  try {
    const item = await submitAnswer(c.req.param('sessionId'), body.vocabularyItemId, body.correct);
    return c.json({ masteryState: item.masteryState }, 200);
  } catch (err) {
    if (err instanceof TrainingError) return apiError(c, 404, 'NOT_FOUND', err.message);
    throw err;
  }
});
