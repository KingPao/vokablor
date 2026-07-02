import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/api/app.js';
import { resetDb } from '../test-db.js';
import { registerAndLogin } from '../helpers/auth.js';
import { AIProviderError } from '../../src/services/ai-providers/index.js';

const { suggestMock } = vi.hoisted(() => ({ suggestMock: vi.fn() }));
vi.mock('../../src/services/vocabulary-suggestion-service.js', () => ({
  suggestVocabulary: suggestMock,
}));

describe('global error handler', () => {
  beforeEach(async () => {
    await resetDb();
    suggestMock.mockReset();
  });

  it('returns a 502 AI_PROVIDER_ERROR JSON body when an AIProviderError escapes a route', async () => {
    suggestMock.mockRejectedValue(new AIProviderError('upstream said no'));
    const { cookie } = await registerAndLogin();
    const res = await app.request('/api/languages/fr/vocabulary/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(502);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('AI_PROVIDER_ERROR');
  });

  it('returns a 500 INTERNAL_ERROR JSON body for any other uncaught error', async () => {
    suggestMock.mockRejectedValue(new Error('something unexpected'));
    const { cookie } = await registerAndLogin();
    const res = await app.request('/api/languages/fr/vocabulary/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe('INTERNAL_ERROR');
  });
});
