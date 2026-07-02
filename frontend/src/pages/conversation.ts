import { apiClient, ApiError } from '../services/api-client.js';
import { getCurrentLanguage } from '../state.js';
import { mountProgressIndicator } from '../components/progress-indicator.js';

interface ConversationTurn {
  id: string;
  speaker: 'learner' | 'ai';
  content: string;
  flaggedNewVocabulary: string[];
  correctionDetail: string | null;
}

function turnHtml(turn: ConversationTurn): string {
  const flagged = turn.flaggedNewVocabulary
    .map((term) => `<button data-action="adopt" data-turn-id="${turn.id}" data-term="${term}">+ ${term}</button>`)
    .join(' ');
  return `
    <li class="turn ${turn.speaker}">
      <p>${turn.content}</p>
      ${turn.correctionDetail ? `<p class="correction">Correction: ${turn.correctionDetail}</p>` : ''}
      ${flagged ? `<p class="new-words">New words: ${flagged}</p>` : ''}
    </li>
  `;
}

export async function renderConversationPage(root: HTMLElement): Promise<void> {
  const language = getCurrentLanguage();
  root.innerHTML = `
    <main class="conversation-page">
      <h1>Conversation practice — ${language}</h1>
      <div id="progress-bar"></div>
      <ul id="turns"></ul>
      <form id="turn-form">
        <input name="content" placeholder="Say something…" required autocomplete="off" />
        <button type="submit">Send</button>
      </form>
      <p id="conversation-error" role="alert"></p>
    </main>
  `;

  const progressBar = root.querySelector<HTMLDivElement>('#progress-bar')!;
  void mountProgressIndicator(progressBar);
  const turnsEl = root.querySelector<HTMLUListElement>('#turns')!;
  const errorEl = root.querySelector<HTMLParagraphElement>('#conversation-error')!;

  let sessionId: string;
  try {
    const started = await apiClient.post<{ sessionId: string }>(`/languages/${language}/conversation/session`);
    sessionId = started.sessionId;
  } catch (err) {
    errorEl.textContent = err instanceof ApiError ? err.message : 'Conversation practice requires an internet connection.';
    return;
  }

  root.querySelector('#turn-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const content = String(new FormData(form).get('content'));
    form.reset();

    turnsEl.insertAdjacentHTML(
      'beforeend',
      `<li class="turn learner"><p>${content}</p></li>`,
    );

    try {
      const aiTurn = await apiClient.post<ConversationTurn>(`/conversation/sessions/${sessionId}/turns`, { content });
      turnsEl.insertAdjacentHTML('beforeend', turnHtml(aiTurn));
      void mountProgressIndicator(progressBar);
    } catch (err) {
      errorEl.textContent = err instanceof ApiError ? err.message : 'Failed to send message.';
    }
  });

  turnsEl.addEventListener('click', async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-action="adopt"]');
    if (!button?.dataset.turnId || !button.dataset.term) return;
    await apiClient.post(`/conversation/turns/${button.dataset.turnId}/flagged-vocabulary/${encodeURIComponent(button.dataset.term)}/adopt`);
    button.disabled = true;
    button.textContent = 'Added';
  });
}
