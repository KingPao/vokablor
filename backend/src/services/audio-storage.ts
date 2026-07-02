import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

/**
 * SpeakingAttempt.audio_ref (data-model.md) is "a pointer to transient audio storage/blob,
 * not raw audio in this table" — this is a minimal local-disk implementation of that pointer;
 * swap for object storage without touching callers if that becomes necessary at scale.
 */
function storageDir(): string {
  return process.env.AUDIO_STORAGE_DIR ?? path.resolve(process.cwd(), 'data', 'audio');
}

export async function storeAudio(buffer: Buffer, mimeType: string): Promise<string> {
  const extension = mimeType.includes('wav') ? 'wav' : mimeType.includes('ogg') ? 'ogg' : 'webm';
  const dir = storageDir();
  await mkdir(dir, { recursive: true });
  const ref = `${randomUUID()}.${extension}`;
  await writeFile(path.join(dir, ref), buffer);
  return ref;
}
