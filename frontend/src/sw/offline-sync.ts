import { apiClient } from '../services/api-client.js';
import { dequeueAction, listQueuedActions } from '../services/offline-queue.js';

/**
 * research.md #10: the mandatory baseline is foreground replay-on-reconnect — triggered on
 * the browser's `online` event and once at startup if already online. The service worker's
 * Background Sync API would let a flush happen even while the tab is closed, but that
 * requires the `injectManifest` PWA build strategy (custom SW source) rather than the
 * `generateSW` strategy this app uses (vite.config.ts) — deliberately deferred rather than
 * half-implemented, since Safari/iOS doesn't support Background Sync anyway and this
 * foreground path must work unconditionally.
 */
export async function flushOfflineQueue(): Promise<void> {
  const queued = await listQueuedActions();
  for (const action of queued) {
    try {
      await apiClient.post('/sync/actions', {
        idempotencyKey: action.idempotencyKey,
        type: action.type,
        payload: action.payload,
      });
      await dequeueAction(action.idempotencyKey);
    } catch {
      // Still offline, or the server rejected it — leave it queued and try again next time.
      break;
    }
  }
}

export function startOfflineSync(): void {
  window.addEventListener('online', () => void flushOfflineQueue());
  if (navigator.onLine) void flushOfflineQueue();
}
