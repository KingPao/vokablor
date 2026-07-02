import { apiClient, OfflineError } from '../services/api-client.js';
import { getCurrentLanguage } from '../state.js';
import { enqueueAction, generateIdempotencyKey } from '../services/offline-queue.js';
import { mountProgressIndicator } from '../components/progress-indicator.js';

interface VocabularyItem {
  id: string;
  term: string;
  translation: string;
  masteryState: string;
}

const DUE_ITEMS_CACHE_PREFIX = 'vokablor:dueItems:';

function cacheKey(language: string): string {
  return `${DUE_ITEMS_CACHE_PREFIX}${language}`;
}

export async function renderTrainingPage(root: HTMLElement): Promise<void> {
  const language = getCurrentLanguage();
  root.innerHTML = `
    <main class="training-page">
      <h1>Training — ${language}</h1>
      <div id="progress-bar"></div>
      <p id="offline-banner" hidden>You're offline. Reviewing cached words; answers will sync once you're back online.</p>
      <div id="quiz"></div>
      <p id="training-status"></p>
    </main>
  `;

  const quizEl = root.querySelector<HTMLDivElement>('#quiz')!;
  const statusEl = root.querySelector<HTMLParagraphElement>('#training-status')!;
  const offlineBanner = root.querySelector<HTMLParagraphElement>('#offline-banner')!;
  void mountProgressIndicator(root.querySelector('#progress-bar')!);

  let sessionId: string | null = null;
  let dueItems: VocabularyItem[] = [];
  let index = 0;

  try {
    const started = await apiClient.post<{ sessionId: string; dueItems: VocabularyItem[] }>(
      `/languages/${language}/training/session`,
    );
    sessionId = started.sessionId;
    dueItems = started.dueItems;
    localStorage.setItem(cacheKey(language), JSON.stringify(dueItems));
  } catch (err) {
    if (!(err instanceof OfflineError)) throw err;
    offlineBanner.hidden = false;
    dueItems = JSON.parse(localStorage.getItem(cacheKey(language)) ?? '[]');
  }

  function renderCurrent(): void {
    if (index >= dueItems.length) {
      quizEl.innerHTML = '<p>No more words due right now. Nice work!</p>';
      return;
    }
    const item = dueItems[index]!;
    quizEl.innerHTML = `
      <p class="term">${item.term}</p>
      <form id="answer-form">
        <input name="translation" placeholder="Your translation" autocomplete="off" required />
        <button type="submit">Check</button>
      </form>
    `;
    quizEl.querySelector('#answer-form')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.target as HTMLFormElement;
      const guess = String(new FormData(form).get('translation')).trim();
      const correct = guess.toLowerCase() === item.translation.toLowerCase();
      await submitAnswer(item.id, correct);
      statusEl.textContent = correct ? 'Correct!' : `Not quite — it's "${item.translation}".`;
      index += 1;
      renderCurrent();
    });
  }

  async function submitAnswer(vocabularyItemId: string, correct: boolean): Promise<void> {
    if (!sessionId) return; // no session (offline at load time) — nothing to sync against yet
    try {
      await apiClient.post(`/training/sessions/${sessionId}/answers`, { vocabularyItemId, correct });
    } catch (err) {
      if (!(err instanceof OfflineError)) throw err;
      await enqueueAction({
        idempotencyKey: generateIdempotencyKey(),
        type: 'training-answer',
        payload: { sessionId, vocabularyItemId, correct },
      });
      offlineBanner.hidden = false;
    }
  }

  renderCurrent();
}
