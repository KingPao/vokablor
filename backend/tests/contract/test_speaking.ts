import { beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/api/app.js';
import { resetDb } from '../test-db.js';
import { registerAndLogin } from '../helpers/auth.js';
import { json } from '../helpers/http.js';

interface VocabularyItem {
  id: string;
  term: string;
}

interface SpeakingSession {
  sessionId: string;
  nextItem: VocabularyItem | null;
}

interface SpeakingAttempt {
  evaluationResult: 'correct' | 'corrected' | 'could_not_evaluate';
  correctionDetail: string | null;
  transcript: string | null;
}

// Shape of AIProvider.evaluateSpeech's return value (types.ts EvaluateSpeechResult) — distinct
// from the API's SpeakingAttempt response shape above (which uses `evaluationResult`, not `result`).
interface MockEvaluation {
  transcript: string | null;
  result: 'correct' | 'corrected' | 'could_not_evaluate';
  correctionDetail: string | null;
  confidence: number | null;
}

let nextEvaluation: MockEvaluation = { transcript: 'bonjour', result: 'correct', correctionDetail: null, confidence: 0.95 };

vi.mock('../../src/services/ai-provider-config-service.js', () => ({
  resolveProviderForLearner: vi.fn(async () => ({
    generateText: vi.fn(),
    converseTurn: vi.fn(),
    evaluateSpeech: vi.fn(async () => nextEvaluation),
  })),
}));

async function addWord(cookie: string, term: string): Promise<VocabularyItem> {
  return json<VocabularyItem>(
    app.request('/api/languages/fr/vocabulary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ term, translation: term }),
    }),
  );
}

function attemptForm(vocabularyItemId: string): FormData {
  const form = new FormData();
  form.append('vocabularyItemId', vocabularyItemId);
  form.append('audio', new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' }), 'attempt.webm');
  return form;
}

describe('speaking contract', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('returns a grounded correction and advances mastery on a correct attempt', async () => {
    nextEvaluation = { transcript: 'pomme', result: 'correct', correctionDetail: null, confidence: 0.95 };
    const { cookie } = await registerAndLogin();
    const word = await addWord(cookie, 'pomme');
    const { sessionId } = await json<SpeakingSession>(
      app.request('/api/languages/fr/speaking/session', { method: 'POST', headers: { Cookie: cookie } }),
    );

    const res = await app.request(`/api/speaking/sessions/${sessionId}/attempts`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: attemptForm(word.id),
    });
    expect(res.status).toBe(200);
    const attempt = (await res.json()) as SpeakingAttempt;
    expect(attempt.evaluationResult).toBe('correct');
  });

  it('returns could_not_evaluate as a normal 200 outcome, never a fabricated correction', async () => {
    nextEvaluation = { transcript: null, result: 'could_not_evaluate', correctionDetail: null, confidence: null };
    const { cookie } = await registerAndLogin();
    const word = await addWord(cookie, 'chat');
    const { sessionId } = await json<SpeakingSession>(
      app.request('/api/languages/fr/speaking/session', { method: 'POST', headers: { Cookie: cookie } }),
    );

    const res = await app.request(`/api/speaking/sessions/${sessionId}/attempts`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: attemptForm(word.id),
    });
    expect(res.status).toBe(200);
    const attempt = (await res.json()) as SpeakingAttempt;
    expect(attempt.evaluationResult).toBe('could_not_evaluate');
    expect(attempt.correctionDetail).toBeNull();
  });

  it('404s for an attempt against a session that does not exist', async () => {
    const { cookie } = await registerAndLogin();
    const res = await app.request('/api/speaking/sessions/nonexistent/attempts', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: attemptForm('nonexistent'),
    });
    expect(res.status).toBe(404);
  });
});
