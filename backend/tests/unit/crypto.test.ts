import { afterEach, describe, expect, it } from 'vitest';
import { decryptApiKey, encryptApiKey } from '../../src/services/crypto.js';

describe('api key encryption', () => {
  const original = process.env.API_KEY_ENCRYPTION_KEY;
  afterEach(() => {
    process.env.API_KEY_ENCRYPTION_KEY = original;
  });

  it('round-trips a plaintext key', () => {
    const encrypted = encryptApiKey('sk-my-secret-key');
    expect(decryptApiKey(encrypted)).toBe('sk-my-secret-key');
  });

  it('throws when the encryption key env var is missing', () => {
    delete process.env.API_KEY_ENCRYPTION_KEY;
    expect(() => encryptApiKey('sk-test')).toThrow('Missing required environment variable');
  });

  it('throws when the encryption key does not decode to 32 bytes', () => {
    process.env.API_KEY_ENCRYPTION_KEY = Buffer.from('too-short').toString('base64');
    expect(() => encryptApiKey('sk-test')).toThrow('must decode to exactly 32 bytes');
  });
});
