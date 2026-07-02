import { apiClient } from '../services/api-client.js';
import { getCurrentLanguage } from '../state.js';

interface Progress {
  points: number;
  currentStreakDays: number;
  currentLevel: string;
}

/**
 * FR-017: one progress representation, mountable from any page — callers just provide a
 * container element; this never maintains its own separate per-mode counter.
 */
export async function mountProgressIndicator(container: HTMLElement): Promise<void> {
  container.innerHTML = '<span class="progress-indicator">Loading progress…</span>';
  try {
    const progress = await apiClient.get<Progress>(`/languages/${getCurrentLanguage()}/progress`);
    container.innerHTML = `
      <span class="progress-indicator">
        🏆 ${progress.points} pts · 🔥 ${progress.currentStreakDays}-day streak · Level ${progress.currentLevel}
      </span>
    `;
  } catch {
    container.innerHTML = '<span class="progress-indicator">Progress unavailable offline.</span>';
  }
}
