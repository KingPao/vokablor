const DB_NAME = 'vokablor-offline';
const DB_VERSION = 1;
const STORE_NAME = 'queued-actions';

export interface QueuedAction {
  idempotencyKey: string;
  type: string;
  payload: unknown;
  createdAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'idempotencyKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Offline-eligible mutations (e.g. training answers) are enqueued here with a
 * client-generated idempotency key (research.md #10), then replayed against
 * `POST /api/sync/actions` once connectivity returns — see frontend/src/sw/offline-sync.ts.
 */
export async function enqueueAction(action: Omit<QueuedAction, 'createdAt'>): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put({ ...action, createdAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function listQueuedActions(): Promise<QueuedAction[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as QueuedAction[]);
    request.onerror = () => reject(request.error);
  });
}

export async function dequeueAction(idempotencyKey: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(idempotencyKey);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}
