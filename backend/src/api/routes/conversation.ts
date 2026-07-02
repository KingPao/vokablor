import { Hono } from 'hono';
import type { AppEnv } from '../../middleware/session.js';
import { requireAuth } from '../../middleware/session.js';
import { apiError } from '../errors.js';
import { ensureLearnerLanguage } from '../../models/learner-language.js';
import {
  adoptFlaggedVocabulary,
  ConversationError,
  endConversationSession,
  postTurn,
  startConversationSession,
} from '../../services/conversation-service.js';

export const conversationRoutes = new Hono<AppEnv>();
conversationRoutes.use('*', requireAuth);

conversationRoutes.post('/languages/:languageCode/conversation/session', async (c) => {
  const learnerId = c.get('learnerId') as string;
  const learnerLanguage = await ensureLearnerLanguage(learnerId, c.req.param('languageCode'));
  const { sessionId } = await startConversationSession(learnerLanguage.id);
  return c.json({ sessionId }, 200);
});

conversationRoutes.post('/conversation/sessions/:sessionId/turns', async (c) => {
  const body = await c.req.json<{ content: string }>().catch(() => null);
  if (!body?.content?.trim()) {
    return apiError(c, 400, 'VALIDATION_ERROR', 'content is required');
  }
  try {
    const turn = await postTurn(c.req.param('sessionId'), body.content);
    return c.json(turn, 200);
  } catch (err) {
    if (err instanceof ConversationError) return apiError(c, 404, 'NOT_FOUND', err.message);
    throw err;
  }
});

conversationRoutes.post('/conversation/turns/:id/flagged-vocabulary/:term/adopt', async (c) => {
  try {
    const item = await adoptFlaggedVocabulary(c.req.param('id'), decodeURIComponent(c.req.param('term')));
    return c.json(item, 201);
  } catch (err) {
    if (err instanceof ConversationError) return apiError(c, 404, 'NOT_FOUND', err.message);
    throw err;
  }
});

conversationRoutes.post('/conversation/sessions/:sessionId/end', async (c) => {
  await endConversationSession(c.req.param('sessionId'));
  return c.body(null, 204);
});
