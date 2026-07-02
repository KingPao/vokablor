import { apiClient, ApiError, OfflineError } from '../services/api-client.js';
import { getCurrentLanguage, setCurrentLanguage } from '../state.js';
import { mountProgressIndicator } from '../components/progress-indicator.js';

interface VocabularyItem {
  id: string;
  term: string;
  translation: string;
  origin: 'user_added' | 'app_discovered';
  masteryState: 'new' | 'learning' | 'reviewing' | 'mastered';
}

interface Suggestion {
  term: string;
  translation: string;
  level: string;
  dictionaryVerified: boolean;
}

function itemRow(item: VocabularyItem): string {
  return `
    <li data-id="${item.id}">
      <span class="term">${item.term}</span> — <span class="translation">${item.translation}</span>
      <span class="badge">${item.origin === 'app_discovered' ? 'discovered' : 'added'}</span>
      <span class="badge">${item.masteryState}</span>
      <a href="#/vocabulary/${item.id}/reading">Read examples</a>
      <button data-action="delete" data-id="${item.id}">Remove</button>
    </li>
  `;
}

export async function renderVocabularyPage(root: HTMLElement): Promise<void> {
  const language = getCurrentLanguage();

  root.innerHTML = `
    <main class="vocabulary-page">
      <h1>Vocabulary</h1>
      <div id="progress-bar"></div>
      <label>Language <input id="language-input" value="${language}" maxlength="8" /></label>
      <nav>
        <a href="#/training">Training</a>
        <a href="#/speaking">Speaking practice</a>
        <a href="#/conversation">Conversation</a>
        <a href="#/settings/ai-provider">AI provider settings</a>
      </nav>

      <form id="add-form">
        <input name="term" placeholder="Word or phrase" required />
        <input name="translation" placeholder="Translation" required />
        <button type="submit">Add</button>
      </form>

      <form id="suggest-form">
        <input name="topic" placeholder="Topic (optional)" />
        <button type="submit">Suggest words</button>
      </form>
      <ul id="suggestions"></ul>

      <p id="vocabulary-error" role="alert"></p>
      <ul id="vocabulary-list">Loading…</ul>
    </main>
  `;

  void mountProgressIndicator(root.querySelector('#progress-bar')!);
  const listEl = root.querySelector<HTMLUListElement>('#vocabulary-list')!;
  const errorEl = root.querySelector<HTMLParagraphElement>('#vocabulary-error')!;
  const suggestionsEl = root.querySelector<HTMLUListElement>('#suggestions')!;

  async function loadList(): Promise<void> {
    try {
      const items = await apiClient.get<VocabularyItem[]>(`/languages/${getCurrentLanguage()}/vocabulary`);
      listEl.innerHTML = items.length ? items.map(itemRow).join('') : '<li>No words yet — add one below.</li>';
    } catch (err) {
      errorEl.textContent = err instanceof OfflineError ? err.message : 'Failed to load vocabulary.';
    }
  }

  root.querySelector('#language-input')?.addEventListener('change', (event) => {
    setCurrentLanguage((event.target as HTMLInputElement).value.trim() || 'fr');
    void loadList();
  });

  root.querySelector('#add-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const data = new FormData(form);
    try {
      await apiClient.post(`/languages/${getCurrentLanguage()}/vocabulary`, {
        term: data.get('term'),
        translation: data.get('translation'),
      });
      form.reset();
      await loadList();
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : 'Failed to add word.';
    }
  });

  root.querySelector('#suggest-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const topic = String(new FormData(form).get('topic') ?? '').trim();
    try {
      const suggestions = await apiClient.post<Suggestion[]>(`/languages/${getCurrentLanguage()}/vocabulary/suggest`, {
        topic: topic || undefined,
      });
      suggestionsEl.innerHTML = suggestions
        .map(
          (s) => `
            <li>
              ${s.term} — ${s.translation} ${s.dictionaryVerified ? '✓' : '(unverified)'}
              <button data-action="adopt" data-term="${s.term}" data-translation="${s.translation}">Adopt</button>
            </li>
          `,
        )
        .join('');
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : 'Failed to fetch suggestions.';
    }
  });

  suggestionsEl.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action="adopt"]');
    if (!button) return;
    await apiClient.post(`/languages/${getCurrentLanguage()}/vocabulary/adopt`, {
      term: button.dataset.term,
      translation: button.dataset.translation,
    });
    button.closest('li')?.remove();
    await loadList();
  });

  listEl.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action="delete"]');
    if (!button?.dataset.id) return;
    await apiClient.delete(`/vocabulary/${button.dataset.id}`);
    await loadList();
  });

  await loadList();
}
