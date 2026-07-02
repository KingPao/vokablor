import { Hono } from 'hono';
import type { AppEnv } from '../../middleware/session.js';
import { requireAuth } from '../../middleware/session.js';
import { ensureLearnerLanguage } from '../../models/learner-language.js';
import { getProgress } from '../../models/progress-state.js';
import { reassessLevel } from '../../services/leveling-service.js';

export const progressRoutes = new Hono<AppEnv>();
progressRoutes.use('*', requireAuth);

/**
 * FR-017/FR-018/FR-019: single cross-mode progress representation, with the level
 * reassessed on read rather than via a separate scheduler process — simplest mechanism that
 * still keeps `current_level` current before it's used to drive vocabulary/source selection.
 */
progressRoutes.get('/languages/:languageCode/progress', async (c) => {
  const learnerId = c.get('learnerId') as string;
  const learnerLanguage = await ensureLearnerLanguage(learnerId, c.req.param('languageCode'));
  const reassessment = await reassessLevel(learnerLanguage.id);
  const progress = await getProgress(learnerLanguage.id);

  return c.json(
    {
      points: progress?.points ?? 0,
      currentStreakDays: progress?.currentStreakDays ?? 0,
      lastActivityAt: progress?.lastActivityAt ?? null,
      currentLevel: reassessment.newLevel,
    },
    200,
  );
});
