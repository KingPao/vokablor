export interface ApiErrorBody {
  error: { code: string; message: string };
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Thrown when a request needs the network and the browser is offline (constitution: PWA offline resilience). */
export class OfflineError extends Error {
  constructor() {
    super('This action requires an internet connection.');
  }
}

const API_BASE = '/api';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!navigator.onLine) {
    throw new OfflineError();
  }

  const isFormBody = init.body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: 'include',
      // FormData sets its own multipart Content-Type (with boundary) — never override it.
      headers: isFormBody ? init.headers : { 'Content-Type': 'application/json', ...init.headers },
    });
  } catch {
    throw new OfflineError();
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiError(response.status, body?.error.code ?? 'UNKNOWN', body?.error.message ?? response.statusText);
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export const apiClient = {
  get: <T>(path: string): Promise<T> => request<T>(path),
  post: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown): Promise<T> =>
    request<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) }),
  delete: <T>(path: string): Promise<T> => request<T>(path, { method: 'DELETE' }),
  postForm: <T>(path: string, form: FormData): Promise<T> =>
    request<T>(path, { method: 'POST', body: form, headers: {} }),
};
