import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/api/app.js';
import { resetDb } from '../test-db.js';
import { registerAndLogin } from '../helpers/auth.js';
import { json } from '../helpers/http.js';

interface ConversationSession {
  sessionId: string;
}

interface ConversationTurn {
  id: string;
  content: string;
  flaggedNewVocabulary: string[];
  correctionDetail: string | null;
}

vi.mock('../../src/services/ai-provider-config-service.js', () => ({
  resolveProviderForLearner: vi.fn(async () => ({
    generateText: vi.fn(async () => 'a translated word'),
    evaluateSpeech: vi.fn(),
    converseTurn: vi.fn(async () => ({
      reply: 'Bonjour ! Comment ça va ?',
      flaggedNewVocabulary: ['ça va'],
      correctionDetail: null,
    })),
  })),
}));

describe('conversation contract', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('starts a session and exchanges a turn with flagged new vocabulary', async () => {
    const { cookie } = await registerAndLogin();
    const { sessionId } = await json<ConversationSession>(
      app.request('/api/languages/fr/conversation/session', { method: 'POST', headers: { Cookie: cookie } }),
    );

    const res = app.request(`/api/conversation/sessions/${sessionId}/turns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ content: 'Salut !' }),
    });
    expect((await res).status).toBe(200);
    const turn = await json<ConversationTurn>(res);
    expect(turn.content).toContain('Bonjour');
    expect(turn.flaggedNewVocabulary).toContain('ça va');
  });

  it('adopts a flagged term into the vocabulary list', async () => {
    const { cookie } = await registerAndLogin();
    const { sessionId } = await json<ConversationSession>(
      app.request('/api/languages/fr/conversation/session', { method: 'POST', headers: { Cookie: cookie } }),
    );
    const turn = await json<ConversationTurn>(
      app.request(`/api/conversation/sessions/${sessionId}/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ content: 'Salut !' }),
      }),
    );

    const res = await app.request(`/api/conversation/turns/${turn.id}/flagged-vocabulary/${encodeURIComponent('ça va')}/adopt`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(201);

    const list = await json<{ term: string; origin: string }[]>(
      app.request('/api/languages/fr/vocabulary', { headers: { Cookie: cookie } }),
    );
    expect(list.some((v) => v.term === 'ça va' && v.origin === 'app_discovered')).toBe(true);
  });

  it('rejects adopting a term that was not actually flagged', async () => {
    const { cookie } = await registerAndLogin();
    const { sessionId } = await json<ConversationSession>(
      app.request('/api/languages/fr/conversation/session', { method: 'POST', headers: { Cookie: cookie } }),
    );
    const turn = await json<ConversationTurn>(
      app.request(`/api/conversation/sessions/${sessionId}/turns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Cookie: cookie },
        body: JSON.stringify({ content: 'Salut !' }),
      }),
    );

    const res = await app.request(`/api/conversation/turns/${turn.id}/flagged-vocabulary/not-flagged/adopt`, {
      method: 'POST',
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(404);
  });

  it('ends a conversation session', async () => {
    const { cookie } = await registerAndLogin();
    const { sessionId } = await json<ConversationSession>(
      app.request('/api/languages/fr/conversation/session', { method: 'POST', headers: { Cookie: cookie } }),
    );
    const res = await app.request(`/api/conversation/sessions/${sessionId}/end`, { method: 'POST', headers: { Cookie: cookie } });
    expect(res.status).toBe(204);
  });
});
