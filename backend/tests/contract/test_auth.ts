import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/api/app.js';
import { resetDb } from '../test-db.js';

describe('auth contract', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('registers a new learner', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'learner@example.com', password: 'correct-horse-battery' }),
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { learnerId: string };
    expect(body.learnerId).toBeTypeOf('string');
  });

  it('rejects registration with a missing password', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nopassword@example.com' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects registration with an invalid email format', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email', password: 'correct-horse-battery' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects registration with a too-short password', async () => {
    const res = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'shortpass@example.com', password: 'short' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects login with a missing password', async () => {
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'someone@example.com' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects registering the same email twice', async () => {
    const payload = { email: 'dupe@example.com', password: 'correct-horse-battery' };
    await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const second = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(second.status).toBe(400);
  });

  it('logs in with correct credentials and sets a session cookie', async () => {
    const payload = { email: 'login@example.com', password: 'correct-horse-battery' };
    await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie');
    expect(setCookie).toContain('vokablor_session=');
    expect(setCookie).toContain('HttpOnly');
  });

  it('marks the session cookie Secure unless COOKIE_SECURE=false (WebKit enforces this strictly, even on localhost)', async () => {
    const payload = { email: 'secure-cookie@example.com', password: 'correct-horse-battery' };
    await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const previous = process.env.COOKIE_SECURE;
    try {
      process.env.COOKIE_SECURE = 'false';
      const insecureRes = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      expect(insecureRes.headers.get('set-cookie')).not.toContain('Secure');

      delete process.env.COOKIE_SECURE;
      const secureRes = await app.request('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      expect(secureRes.headers.get('set-cookie')).toContain('Secure');
    } finally {
      process.env.COOKIE_SECURE = previous;
    }
  });

  it('rejects login with the wrong password', async () => {
    const payload = { email: 'wrongpass@example.com', password: 'correct-horse-battery' };
    await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: payload.email, password: 'nope' }),
    });
    expect(res.status).toBe(401);
  });

  it('logs out and clears the session cookie', async () => {
    const res = await app.request('/api/auth/logout', { method: 'POST' });
    expect(res.status).toBe(204);
  });
});
