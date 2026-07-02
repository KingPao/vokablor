import { apiClient, ApiError } from '../services/api-client.js';
import { getCurrentLanguage } from '../state.js';
import { mountProgressIndicator } from '../components/progress-indicator.js';

interface VocabularyItem {
  id: string;
  term: string;
  translation: string;
}

interface SpeakingAttempt {
  evaluationResult: 'correct' | 'corrected' | 'could_not_evaluate';
  correctionDetail: string | null;
  transcript: string | null;
}

export async function renderSpeakingPage(root: HTMLElement): Promise<void> {
  const language = getCurrentLanguage();
  root.innerHTML = `
    <main class="speaking-page">
      <h1>Speaking practice — ${language}</h1>
      <div id="progress-bar"></div>
      <div id="speaking-content">Loading…</div>
    </main>
  `;
  void mountProgressIndicator(root.querySelector('#progress-bar')!);
  const contentEl = root.querySelector<HTMLDivElement>('#speaking-content')!;

  let sessionId: string;
  let item: VocabularyItem | null;
  try {
    const started = await apiClient.post<{ sessionId: string; nextItem: VocabularyItem | null }>(
      `/languages/${language}/speaking/session`,
    );
    sessionId = started.sessionId;
    item = started.nextItem;
  } catch {
    contentEl.textContent = 'Speaking practice requires an internet connection.';
    return;
  }

  if (!item) {
    contentEl.innerHTML = '<p>No words are due for speaking practice right now.</p>';
    return;
  }

  if (!('MediaRecorder' in window)) {
    contentEl.textContent = 'Your browser does not support audio recording.';
    return;
  }

  contentEl.innerHTML = `
    <p class="term">Say: <strong>${item.term}</strong></p>
    <button id="record-button">🎙 Hold to record</button>
    <p id="speaking-result" role="status"></p>
  `;

  const resultEl = contentEl.querySelector<HTMLParagraphElement>('#speaking-result')!;
  const recordButton = contentEl.querySelector<HTMLButtonElement>('#record-button')!;

  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];

  async function startRecording(): Promise<void> {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    chunks = [];
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.start();
  }

  async function stopRecording(): Promise<void> {
    if (!recorder || !item) return;
    const stopped = new Promise<void>((resolve) => {
      recorder!.onstop = () => resolve();
    });
    recorder.stop();
    await stopped;
    stream?.getTracks().forEach((track) => track.stop());

    const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
    const form = new FormData();
    form.append('vocabularyItemId', item.id);
    form.append('audio', blob, 'attempt.webm');

    resultEl.textContent = 'Evaluating…';
    try {
      const attempt = await apiClient.postForm<SpeakingAttempt>(`/speaking/sessions/${sessionId}/attempts`, form);
      if (attempt.evaluationResult === 'could_not_evaluate') {
        resultEl.textContent = "Couldn't evaluate that attempt — try again in a quieter spot.";
      } else if (attempt.evaluationResult === 'correct') {
        resultEl.textContent = 'Correct!';
      } else {
        resultEl.textContent = `Correction: ${attempt.correctionDetail}`;
      }
    } catch (err) {
      resultEl.textContent = err instanceof ApiError ? err.message : 'Failed to submit attempt.';
    }
  }

  recordButton.addEventListener('mousedown', () => void startRecording());
  recordButton.addEventListener('mouseup', () => void stopRecording());
  recordButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    void startRecording();
  });
  recordButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    void stopRecording();
  });
}
