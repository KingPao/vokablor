import * as argon2 from 'argon2';

/** research.md #3: Argon2id is the OWASP-recommended default; bcrypt is the documented fallback. */
export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch {
    return false;
  }
}
