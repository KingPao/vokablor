import { apiClient, ApiError } from '../services/api-client.js';
import type { RouteParams } from '../router.js';
import { mountProgressIndicator } from '../components/progress-indicator.js';

interface SourceExcerpt {
  id: string;
  sourceType: string;
  sourceName: string;
  sourceUrl: string;
  snippetText: string;
  level: string;
}

/** Route: `/vocabulary/:id/reading`. */
export async function renderReadingPage(root: HTMLElement, params: RouteParams): Promise<void> {
  const vocabularyItemId = params.id;
  root.innerHTML = `
    <main class="reading-page">
      <h1>Real-world usage</h1>
      <div id="progress-bar"></div>
      <a href="#/vocabulary">← Back to vocabulary</a>
      <div id="reading-content">Loading…</div>
    </main>
  `;

  void mountProgressIndicator(root.querySelector('#progress-bar')!);
  const contentEl = root.querySelector<HTMLDivElement>('#reading-content')!;
  if (!vocabularyItemId) {
    contentEl.textContent = 'No word selected.';
    return;
  }

  try {
    const excerpts = await apiClient.get<SourceExcerpt[]>(`/vocabulary/${vocabularyItemId}/excerpts`);
    contentEl.innerHTML = excerpts
      .map(
        (e) => `
          <article>
            <p>"${e.snippetText}"</p>
            <p><em>${e.sourceType} — ${e.sourceName}</em> (level ${e.level})</p>
            <a href="${e.sourceUrl}" target="_blank" rel="noopener noreferrer">Read the source →</a>
          </article>
        `,
      )
      .join('');
  } catch (err) {
    if (err instanceof ApiError && err.code === 'NO_LEVEL_APPROPRIATE_MATCH') {
      contentEl.textContent = 'No level-appropriate example found for this word yet — check back later.';
    } else {
      contentEl.textContent = 'Failed to load reading examples.';
    }
  }
}
