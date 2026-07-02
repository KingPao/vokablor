import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { flushOfflineQueue, startOfflineSync } from '../../src/sw/offline-sync.js';
import { enqueueAction, listQueuedActions } from '../../src/services/offline-queue.js';
import { apiClient } from '../../src/services/api-client.js';

vi.mock('../../src/services/api-client.js', () => ({
  apiClient: { post: vi.fn() },
}));

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
}

describe('flushOfflineQueue', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    vi.mocked(apiClient.post).mockReset();
  });

  it('does nothing when the queue is empty', async () => {
    await flushOfflineQueue();
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('replays a queued action and dequeues it on success', async () => {
    await enqueueAction({ idempotencyKey: 'k1', type: 'training-answer', payload: { correct: true } });
    vi.mocked(apiClient.post).mockResolvedValue({ applied: true });

    await flushOfflineQueue();

    expect(apiClient.post).toHaveBeenCalledWith('/sync/actions', {
      idempotencyKey: 'k1',
      type: 'training-answer',
      payload: { correct: true },
    });
    expect(await listQueuedActions()).toEqual([]);
  });

  it('stops at the first failure, leaving that item and any after it queued', async () => {
    await enqueueAction({ idempotencyKey: 'k1', type: 'training-answer', payload: {} });
    await enqueueAction({ idempotencyKey: 'k2', type: 'training-answer', payload: {} });
    vi.mocked(apiClient.post).mockRejectedValue(new Error('offline'));

    await flushOfflineQueue();

    const remaining = await listQueuedActions();
    expect(remaining.map((a) => a.idempotencyKey)).toEqual(['k1', 'k2']);
  });
});

describe('startOfflineSync', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    vi.mocked(apiClient.post).mockReset().mockResolvedValue({ applied: true });
  });

  it('flushes immediately when already online', async () => {
    setOnline(true);
    await enqueueAction({ idempotencyKey: 'k1', type: 'training-answer', payload: {} });
    startOfflineSync();
    await vi.waitFor(() => expect(apiClient.post).toHaveBeenCalled());
  });

  it('flushes when the browser comes back online', async () => {
    setOnline(false);
    startOfflineSync();
    await enqueueAction({ idempotencyKey: 'k2', type: 'training-answer', payload: {} });
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(apiClient.post).toHaveBeenCalled());
  });
});
