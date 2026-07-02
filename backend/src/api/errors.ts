import type { Context } from 'hono';

export type ApiErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  /** contracts/api.md: reading-source search found nothing at the learner's level (FR-010). */
  | 'NO_LEVEL_APPROPRIATE_MATCH';

/** Enforces the single error shape from contracts/api.md across every route. */
export function apiError(c: Context, status: 400 | 401 | 404 | 409 | 429, code: ApiErrorCode, message: string) {
  return c.json({ error: { code, message } }, status);
}
