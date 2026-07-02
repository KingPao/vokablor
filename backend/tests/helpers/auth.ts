import { app } from '../../src/api/app.js';
import { json } from './http.js';

let counter = 0;

/** Registers a fresh learner and logs in, returning the Cookie header for authenticated requests. */
export async function registerAndLogin(): Promise<{ cookie: string; learnerId: string }> {
  counter += 1;
  const email = `learner-${counter}-${Math.floor(Math.random() * 1e9)}@example.com`;
  const password = 'correct-horse-battery';

  const registerRes = app.request('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const { learnerId } = await json<{ learnerId: string }>(registerRes);

  const loginRes = await app.request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = loginRes.headers.get('set-cookie') ?? '';
  const cookie = setCookie.split(';')[0] ?? '';

  return { cookie, learnerId };
}
