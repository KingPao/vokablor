import { Hono } from 'hono';
import { AuthError, authenticate, register } from '../../services/auth-service.js';
import { issueSession, revokeSession } from '../../middleware/session.js';
import type { AppEnv } from '../../middleware/session.js';
import { apiError } from '../errors.js';

export const authRoutes = new Hono<AppEnv>();

interface Credentials {
  email: string;
  password: string;
}

authRoutes.post('/register', async (c) => {
  const body = await c.req.json<Credentials>().catch(() => null);
  if (!body?.email || !body?.password) {
    return apiError(c, 400, 'VALIDATION_ERROR', 'email and password are required');
  }
  try {
    const learner = await register(body.email, body.password);
    return c.json({ learnerId: learner.id }, 201);
  } catch (err) {
    if (err instanceof AuthError) return apiError(c, 400, 'VALIDATION_ERROR', err.message);
    throw err;
  }
});

authRoutes.post('/login', async (c) => {
  const body = await c.req.json<Credentials>().catch(() => null);
  if (!body?.email || !body?.password) {
    return apiError(c, 400, 'VALIDATION_ERROR', 'email and password are required');
  }
  try {
    const learner = await authenticate(body.email, body.password);
    await issueSession(c, learner.id);
    return c.json({ learnerId: learner.id }, 200);
  } catch (err) {
    if (err instanceof AuthError) return apiError(c, 401, 'UNAUTHENTICATED', err.message);
    throw err;
  }
});

authRoutes.post('/logout', async (c) => {
  await revokeSession(c);
  return c.body(null, 204);
});
