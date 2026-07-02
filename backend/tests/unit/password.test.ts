import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../src/services/password.js';

describe('password hashing', () => {
  it('round-trips a correct password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(await verifyPassword(hash, 'correct-horse-battery')).toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const hash = await hashPassword('correct-horse-battery');
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false);
  });

  it('returns false (never throws) for a malformed hash string', async () => {
    expect(await verifyPassword('not-a-real-argon2-hash', 'anything')).toBe(false);
  });
});
