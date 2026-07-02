import { Hono } from 'hono';
import type { AppEnv } from '../../middleware/session.js';
import { requireAuth } from '../../middleware/session.js';
import { apiError } from '../errors.js';
import * as vocabularyModel from '../../models/vocabulary-item.js';
import { findLearnerLanguageById } from '../../models/learner-language.js';
import { findExcerptsForVocabulary } from '../../services/excerpt-service.js';

export const excerptRoutes = new Hono<AppEnv>();
excerptRoutes.use('*', requireAuth);

excerptRoutes.get('/vocabulary/:id/excerpts', async (c) => {
  const learnerId = c.get('learnerId') as string;
  const item = await vocabularyModel.findById(c.req.param('id'));
  if (!item) return apiError(c, 404, 'NOT_FOUND', 'Vocabulary item not found');

  const learnerLanguage = await findLearnerLanguageById(item.learnerLanguageId);
  if (!learnerLanguage || learnerLanguage.learnerId !== learnerId) {
    return apiError(c, 404, 'NOT_FOUND', 'Vocabulary item not found');
  }

  const result = await findExcerptsForVocabulary(item.id, item.term, learnerLanguage.languageCode, learnerLanguage.currentLevel);
  if (!result.found) {
    return apiError(c, 404, 'NO_LEVEL_APPROPRIATE_MATCH', 'No level-appropriate usage example was found for this word yet');
  }
  return c.json(result.excerpts, 200);
});
