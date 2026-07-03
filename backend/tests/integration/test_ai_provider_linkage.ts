import { beforeEach, describe, expect, it } from 'vitest';
import { resetDb } from '../test-db.js';
import { createLearner } from '../../src/models/learner.js';
import { ensureLearnerLanguage, findLearnerLanguage } from '../../src/models/learner-language.js';
import { createConfig, deleteConfig } from '../../src/services/ai-provider-config-service.js';

describe('AI provider config actually gets used (FR-016)', () => {
  beforeEach(async () => {
    await resetDb();
  });

  it('applies a newly-added provider to a language the learner already has', async () => {
    const learner = await createLearner('byo@example.com', 'hash');
    const fr = await ensureLearnerLanguage(learner.id, 'fr');
    expect(fr.aiProviderId).toBeNull(); // starts on the shared default

    const config = await createConfig(learner.id, 'openai', 'gpt-4o', 'sk-test-key');
    const updated = await findLearnerLanguage(learner.id, 'fr');
    expect(updated?.aiProviderId).toBe(config.id);
  });

  it('applies an already-configured provider to a brand-new language', async () => {
    const learner = await createLearner('byo2@example.com', 'hash');
    const config = await createConfig(learner.id, 'anthropic', 'claude-3-5-sonnet', 'sk-ant-test');

    const de = await ensureLearnerLanguage(learner.id, 'de');
    expect(de.aiProviderId).toBe(config.id);
  });

  it('reverts to the shared default once the active provider is deleted', async () => {
    const learner = await createLearner('byo3@example.com', 'hash');
    await ensureLearnerLanguage(learner.id, 'fr');
    const config = await createConfig(learner.id, 'google', 'gemini-1.5-flash', 'key');

    await deleteConfig(config.id, learner.id);

    const after = await findLearnerLanguage(learner.id, 'fr');
    expect(after?.aiProviderId).toBeNull();
  });

  it('switches every language over when a second provider is added', async () => {
    const learner = await createLearner('byo4@example.com', 'hash');
    await ensureLearnerLanguage(learner.id, 'fr');
    await ensureLearnerLanguage(learner.id, 'de');
    await createConfig(learner.id, 'openai', 'gpt-4o', 'sk-first');
    const second = await createConfig(learner.id, 'anthropic', 'claude-3-5-sonnet', 'sk-second');

    const fr = await findLearnerLanguage(learner.id, 'fr');
    const de = await findLearnerLanguage(learner.id, 'de');
    expect(fr?.aiProviderId).toBe(second.id);
    expect(de?.aiProviderId).toBe(second.id);
  });
});
