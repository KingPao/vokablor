import { afterEach, describe, expect, it, vi } from 'vitest';

describe('db client required-env validation', () => {
  const originalDb = process.env.MYSQL_DATABASE;

  afterEach(() => {
    process.env.MYSQL_DATABASE = originalDb;
    vi.resetModules();
  });

  it('fails fast with a clear message when a required env var is missing', async () => {
    delete process.env.MYSQL_DATABASE;
    vi.resetModules();
    await expect(import('../../src/db/client.js')).rejects.toThrow(
      'Missing required environment variable: MYSQL_DATABASE',
    );
  });
});
