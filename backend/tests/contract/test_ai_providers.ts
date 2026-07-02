import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/api/app.js';
import { resetDb } from '../test-db.js';
import { registerAndLogin } from '../helpers/auth.js';
import { json } from '../helpers/http.js';

interface ConfigSummary {
  id: string;
  provider: string;
  model: string;
  hasKey: boolean;
}

describe('AI provider config contract', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('lists no configs by default', async () => {
    const { cookie } = await registerAndLogin();
    const configs = await json<ConfigSummary[]>(app.request('/api/ai-providers', { headers: { Cookie: cookie } }));
    expect(configs).toHaveLength(0);
  });

  it('creates a BYO-key config without ever echoing the key back', async () => {
    const { cookie } = await registerAndLogin();
    const res = app.request('/api/ai-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ provider: 'openai', model: 'gpt-4o', apiKey: 'sk-secret-value' }),
    });
    expect((await res).status).toBe(201);
    const body = await json<ConfigSummary>(res);
    expect(body.hasKey).toBe(true);
    expect(JSON.stringify(body)).not.toContain('sk-secret-value');
  });

  it('rejects a request missing provider or model', async () => {
    const { cookie } = await registerAndLogin();
    const res = await app.request('/api/ai-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ provider: 'openai' }),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a non-free provider without an API key', async () => {
    const { cookie } = await registerAndLogin();
    const res = await app.request('/api/ai-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ provider: 'openai', model: 'gpt-4o' }),
    });
    expect(res.status).toBe(400);
  });

  it('allows nvidia_free with no key', async () => {
    const { cookie } = await registerAndLogin();
    const res = await app.request('/api/ai-providers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ provider: 'nvidia_free', model: 'meta/llama-3.1-8b-instruct' }),
    });
    expect(res.status).toBe(201);
  });

  it('deletes a config, falling back to the shared provider', async () => {
    const { cookie } = await registerAndLogin();
    const created = await json<ConfigSummary>(
      app.request('/api/ai-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ provider: 'nvidia_free', model: 'meta/llama-3.1-8b-instruct' }),
      }),
    );
    const deleted = await app.request(`/api/ai-providers/${created.id}`, { method: 'DELETE', headers: { Cookie: cookie } });
    expect(deleted.status).toBe(204);
    const configs = await json<ConfigSummary[]>(app.request('/api/ai-providers', { headers: { Cookie: cookie } }));
    expect(configs).toHaveLength(0);
  });
});
