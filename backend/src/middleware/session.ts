import { randomUUID } from 'node:crypto';
import type { Context, Next } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { db } from '../db/client.js';

export const SESSION_COOKIE_NAME = 'vokablor_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('Missing required environment variable: SESSION_SECRET');
  return secret;
}

/**
 * Defaults to `true` (fail-safe) — production always runs behind the Caddy/Traefik HTTPS
 * reverse proxy (docker/Caddyfile). Only disable for local HTTP dev/E2E, where a `Secure`
 * cookie would silently never be stored/sent by browsers that enforce the spec strictly
 * (WebKit does even for `localhost`; Chromium is lenient — this gap only surfaces on Safari/iOS).
 */
function cookiesRequireHttps(): boolean {
  return process.env.COOKIE_SECURE !== 'false';
}

export type AppEnv = {
  Variables: {
    learnerId: string | null;
  };
};

/** Creates a server-side session row and sets the signed httpOnly cookie (research.md #4). */
export async function issueSession(c: Context, learnerId: string): Promise<void> {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insertInto('sessions').values({ id, learner_id: learnerId, expires_at: expiresAt }).execute();
  await setSignedCookie(c, SESSION_COOKIE_NAME, id, sessionSecret(), {
    httpOnly: true,
    secure: cookiesRequireHttps(),
    sameSite: 'Lax',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function revokeSession(c: Context): Promise<void> {
  const sessionId = await getSignedCookie(c, sessionSecret(), SESSION_COOKIE_NAME);
  if (sessionId) {
    await db.deleteFrom('sessions').where('id', '=', sessionId).execute();
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });
}

/** Attaches `learnerId` to the request context when a valid, unexpired session cookie is present. */
export async function attachSession(c: Context<AppEnv>, next: Next): Promise<void> {
  const sessionId = await getSignedCookie(c, sessionSecret(), SESSION_COOKIE_NAME);
  if (!sessionId) {
    c.set('learnerId', null);
    await next();
    return;
  }

  const session = await db
    .selectFrom('sessions')
    .select(['learner_id', 'expires_at'])
    .where('id', '=', sessionId)
    .executeTakeFirst();

  if (!session || session.expires_at.getTime() < Date.now()) {
    c.set('learnerId', null);
    await next();
    return;
  }

  c.set('learnerId', session.learner_id);
  await next();
}

/** Rejects the request with 401 unless attachSession found a valid learner. Mount after attachSession. */
export async function requireAuth(c: Context<AppEnv>, next: Next): Promise<Response | void> {
  const learnerId = c.get('learnerId');
  if (!learnerId) {
    return c.json({ error: { code: 'UNAUTHENTICATED', message: 'Login required' } }, 401);
  }
  await next();
}
