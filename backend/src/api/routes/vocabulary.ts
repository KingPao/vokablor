import { Hono } from 'hono';
import type { AppEnv } from '../../middleware/session.js';
import { requireAuth } from '../../middleware/session.js';
import { enforceSharedProviderRateLimit } from '../../middleware/rate-limit.js';
import { apiError } from '../errors.js';
import { ensureLearnerLanguage } from '../../models/learner-language.js';
import { addVocabulary, editVocabulary, deleteVocabulary, listVocabulary, VocabularyError } from '../../services/vocabulary-service.js';
import { suggestVocabulary } from '../../services/vocabulary-suggestion-service.js';

export const vocabularyRoutes = new Hono<AppEnv>();
vocabularyRoutes.use('*', requireAuth);

vocabularyRoutes.get('/languages/:languageCode/vocabulary', async (c) => {
  const learnerId = c.get('learnerId') as string;
  const learnerLanguage = await ensureLearnerLanguage(learnerId, c.req.param('languageCode'));
  const dueOnly = c.req.query('dueOnly') === 'true';
  const items = await listVocabulary(learnerLanguage.id, dueOnly);
  return c.json(items);
});

vocabularyRoutes.post('/languages/:languageCode/vocabulary', async (c) => {
  const learnerId = c.get('learnerId') as string;
  const body = await c.req.json<{ term: string; translation: string }>().catch(() => null);
  if (!body?.term || !body?.translation) {
    return apiError(c, 400, 'VALIDATION_ERROR', 'term and translation are required');
  }
  const learnerLanguage = await ensureLearnerLanguage(learnerId, c.req.param('languageCode'));
  try {
    const item = await addVocabulary(learnerLanguage.id, body.term, body.translation, 'user_added');
    return c.json(item, 201);
  } catch (err) {
    if (err instanceof VocabularyError) return apiError(c, 400, 'VALIDATION_ERROR', err.message);
    throw err;
  }
});

// Vocabulary suggestion always calls the shared free-tier AIProvider directly (no per-learner
// BYO-key path here — see vocabulary-suggestion-service.ts), so it's the one endpoint where
// unconditionally applying the shared-quota rate limiter (research.md #6) is unambiguously correct.
vocabularyRoutes.post('/languages/:languageCode/vocabulary/suggest', enforceSharedProviderRateLimit, async (c) => {
  const learnerId = c.get('learnerId') as string;
  const body = await c.req.json<{ topic?: string }>().catch(() => ({}) as { topic?: string });
  const languageCode = c.req.param('languageCode') as string;
  const learnerLanguage = await ensureLearnerLanguage(learnerId, languageCode);
  const suggestions = await suggestVocabulary(learnerLanguage.languageCode, learnerLanguage.currentLevel, body.topic);
  return c.json(suggestions, 200);
});

vocabularyRoutes.post('/languages/:languageCode/vocabulary/adopt', async (c) => {
  const learnerId = c.get('learnerId') as string;
  const body = await c.req.json<{ term: string; translation: string }>().catch(() => null);
  if (!body?.term || !body?.translation) {
    return apiError(c, 400, 'VALIDATION_ERROR', 'term and translation are required');
  }
  const learnerLanguage = await ensureLearnerLanguage(learnerId, c.req.param('languageCode'));
  const item = await addVocabulary(learnerLanguage.id, body.term, body.translation, 'app_discovered');
  return c.json(item, 201);
});

vocabularyRoutes.patch('/vocabulary/:id', async (c) => {
  const body = await c.req.json<{ term?: string; translation?: string }>().catch(() => null);
  if (!body) return apiError(c, 400, 'VALIDATION_ERROR', 'invalid request body');
  try {
    const item = await editVocabulary(c.req.param('id'), body);
    return c.json(item, 200);
  } catch (err) {
    if (err instanceof VocabularyError) return apiError(c, 404, 'NOT_FOUND', err.message);
    throw err;
  }
});

vocabularyRoutes.delete('/vocabulary/:id', async (c) => {
  await deleteVocabulary(c.req.param('id'));
  return c.body(null, 204);
});
