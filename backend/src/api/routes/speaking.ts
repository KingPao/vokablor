import { Hono } from 'hono';
import type { AppEnv } from '../../middleware/session.js';
import { requireAuth } from '../../middleware/session.js';
import { apiError } from '../errors.js';
import { ensureLearnerLanguage } from '../../models/learner-language.js';
import { startSpeakingSession, submitSpeakingAttempt, SpeakingError } from '../../services/speaking-service.js';

export const speakingRoutes = new Hono<AppEnv>();
speakingRoutes.use('*', requireAuth);

speakingRoutes.post('/languages/:languageCode/speaking/session', async (c) => {
  const learnerId = c.get('learnerId') as string;
  const learnerLanguage = await ensureLearnerLanguage(learnerId, c.req.param('languageCode'));
  const { sessionId, nextItem } = await startSpeakingSession(learnerLanguage.id);
  return c.json({ sessionId, nextItem }, 200);
});

speakingRoutes.post('/speaking/sessions/:sessionId/attempts', async (c) => {
  const body = await c.req.parseBody();
  const vocabularyItemId = body.vocabularyItemId;
  const audio = body.audio;
  if (typeof vocabularyItemId !== 'string' || !(audio instanceof File)) {
    return apiError(c, 400, 'VALIDATION_ERROR', 'vocabularyItemId and audio are required');
  }

  const audioBuffer = Buffer.from(await audio.arrayBuffer());
  try {
    // FR-012 / contracts/api.md: evaluationResult may legitimately be "could_not_evaluate" —
    // that's a successful response describing the outcome, not an HTTP error.
    const attempt = await submitSpeakingAttempt(c.req.param('sessionId'), vocabularyItemId, audioBuffer, audio.type);
    return c.json(attempt, 200);
  } catch (err) {
    if (err instanceof SpeakingError) return apiError(c, 404, 'NOT_FOUND', err.message);
    throw err;
  }
});
