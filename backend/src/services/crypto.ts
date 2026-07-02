import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function encryptionKey(): Buffer {
  const encoded = process.env.API_KEY_ENCRYPTION_KEY;
  if (!encoded) throw new Error('Missing required environment variable: API_KEY_ENCRYPTION_KEY');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32) {
    throw new Error('API_KEY_ENCRYPTION_KEY must decode to exactly 32 bytes (AES-256)');
  }
  return key;
}

/**
 * Encrypts a learner-supplied AI provider API key for storage in
 * AIProviderConfig.api_key_encrypted (research.md #5, constitution: never store plaintext).
 * Layout: [iv (12 bytes) | authTag (16 bytes) | ciphertext].
 */
export function encryptApiKey(plaintext: string): Buffer {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]);
}

export function decryptApiKey(payload: Buffer): string {
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + 16);
  const ciphertext = payload.subarray(IV_LENGTH + 16);
  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
