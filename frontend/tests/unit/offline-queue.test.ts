import { beforeEach, describe, expect, it } from 'vitest';
import { dequeueAction, enqueueAction, generateIdempotencyKey, listQueuedActions } from '../../src/services/offline-queue.js';
import { IDBFactory } from 'fake-indexeddb';

describe('offline queue', () => {
  beforeEach(() => {
    // Fresh IndexedDB per test so queued actions from one test never leak into the next.
    globalThis.indexedDB = new IDBFactory();
  });

  it('starts empty', async () => {
    expect(await listQueuedActions()).toEqual([]);
  });

  it('enqueues and lists an action', async () => {
    await enqueueAction({ idempotencyKey: 'key-1', type: 'training-answer', payload: { correct: true } });
    const queued = await listQueuedActions();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.idempotencyKey).toBe('key-1');
    expect(queued[0]?.type).toBe('training-answer');
    expect(queued[0]?.createdAt).toBeTypeOf('number');
  });

  it('dequeues by idempotency key', async () => {
    await enqueueAction({ idempotencyKey: 'key-1', type: 'training-answer', payload: {} });
    await enqueueAction({ idempotencyKey: 'key-2', type: 'training-answer', payload: {} });
    await dequeueAction('key-1');
    const queued = await listQueuedActions();
    expect(queued.map((a) => a.idempotencyKey)).toEqual(['key-2']);
  });

  it('re-enqueueing the same key overwrites rather than duplicates (keyPath is idempotencyKey)', async () => {
    await enqueueAction({ idempotencyKey: 'key-1', type: 'training-answer', payload: { correct: false } });
    await enqueueAction({ idempotencyKey: 'key-1', type: 'training-answer', payload: { correct: true } });
    const queued = await listQueuedActions();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.payload).toEqual({ correct: true });
  });

  it('generateIdempotencyKey produces distinct values', () => {
    const a = generateIdempotencyKey();
    const b = generateIdempotencyKey();
    expect(a).not.toBe(b);
    expect(a).toBeTypeOf('string');
  });
});
