import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient, ApiError, OfflineError } from '../../src/services/api-client.js';

function mockFetchOnce(response: Response): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

function setOnline(online: boolean): void {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
}

describe('apiClient', () => {
  beforeEach(() => {
    setOnline(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setOnline(true);
  });

  it('throws OfflineError immediately when navigator.onLine is false', async () => {
    setOnline(false);
    await expect(apiClient.get('/languages/fr/vocabulary')).rejects.toThrow(OfflineError);
  });

  it('throws OfflineError when fetch itself rejects (network drop mid-request)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(apiClient.get('/languages/fr/vocabulary')).rejects.toThrow(OfflineError);
  });

  it('returns parsed JSON on success', async () => {
    mockFetchOnce(new Response(JSON.stringify({ hello: 'world' }), { status: 200 }));
    const result = await apiClient.get<{ hello: string }>('/x');
    expect(result).toEqual({ hello: 'world' });
  });

  it('returns undefined for a 204 response', async () => {
    mockFetchOnce(new Response(null, { status: 204 }));
    const result = await apiClient.delete('/x');
    expect(result).toBeUndefined();
  });

  it('throws ApiError with the server-provided code and message on a non-OK response', async () => {
    mockFetchOnce(
      new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'nope' } }), { status: 404 }),
    );
    await expect(apiClient.get('/x')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND', message: 'nope' });
  });

  it('falls back to UNKNOWN/statusText when the error response has no JSON body', async () => {
    mockFetchOnce(new Response('not json', { status: 500, statusText: 'Server Error' }));
    await expect(apiClient.get('/x')).rejects.toMatchObject({ status: 500, code: 'UNKNOWN' });
  });

  it('serializes a JSON body for post/patch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await apiClient.post('/x', { a: 1 });
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('postForm sends FormData without forcing a JSON Content-Type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const form = new FormData();
    form.append('a', '1');
    await apiClient.postForm('/x', form);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.body).toBe(form);
    expect(init.headers).toEqual({});
  });

  it('ApiError instances carry the error instanceof chain correctly', async () => {
    mockFetchOnce(new Response(JSON.stringify({ error: { code: 'X', message: 'x' } }), { status: 400 }));
    await expect(apiClient.get('/x')).rejects.toBeInstanceOf(ApiError);
  });
});
