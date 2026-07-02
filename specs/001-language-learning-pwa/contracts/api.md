# API Contracts: Language Learning PWA

REST-ish JSON API served by the backend, consumed by the PWA frontend. All endpoints except
`auth/*` require a valid session cookie. Grouped by user story; entity fields refer to
[data-model.md](../data-model.md).

## Auth

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| POST | `/api/auth/register` | `{email, password}` | `201 {learnerId}` | hashes password (Argon2id) |
| POST | `/api/auth/login` | `{email, password}` | `200`, sets session cookie | |
| POST | `/api/auth/logout` | — | `204`, clears session | invalidates server-side session row |

## Vocabulary (User Story 1)

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/api/languages/:languageCode/vocabulary` | query: `status?`, `dueOnly?` | `200 [VocabularyItem]` | |
| POST | `/api/languages/:languageCode/vocabulary` | `{term, translation}` | `201 VocabularyItem` (origin=user_added) | FR-001; reuses existing row if term already tracked (FR-005) |
| POST | `/api/languages/:languageCode/vocabulary/suggest` | `{topic?}` | `200 [{term, translation, level}]` | FR-002; AI-generated + dictionary-verified candidates (research.md #8), not yet persisted |
| POST | `/api/languages/:languageCode/vocabulary/adopt` | `{term, translation}` | `201 VocabularyItem` (origin=app_discovered) | persists a suggested candidate; body carries the candidate since suggestions aren't persisted until adopted (no id to reference) |
| PATCH | `/api/vocabulary/:id` | `{term?, translation?}` | `200 VocabularyItem` | FR-004 |
| DELETE | `/api/vocabulary/:id` | — | `204` | FR-004 |
| POST | `/api/languages/:languageCode/training/session` | — | `200 {sessionId, dueItems: [VocabularyItem]}` | starts a training PracticeSession |
| POST | `/api/training/sessions/:sessionId/answers` | `{vocabularyItemId, correct}` | `200 {masteryState}` | FR-006; also feeds ProgressState (FR-017) |

## Reading Sources (User Story 2)

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/api/vocabulary/:id/excerpts` | — | `200 [SourceExcerpt]` or `200 {found: false}` | FR-008–FR-010; explicit no-match response, never a mismatched substitute |

## Speaking Practice (User Story 3)

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| POST | `/api/languages/:languageCode/speaking/session` | — | `200 {sessionId, nextItem: VocabularyItem}` | |
| POST | `/api/speaking/sessions/:sessionId/attempts` | multipart: `vocabularyItemId`, `audio` | `200 SpeakingAttempt` | FR-011/FR-012; `evaluation_result` may be `could_not_evaluate` |

## Conversation (User Story 4)

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| POST | `/api/languages/:languageCode/conversation/session` | — | `200 {sessionId}` | |
| POST | `/api/conversation/sessions/:sessionId/turns` | `{content}` | `200 ConversationTurn` (AI reply) | FR-013; response includes `flaggedNewVocabulary` (FR-014) and `correctionDetail` when applicable |
| POST | `/api/conversation/turns/:id/flagged-vocabulary/:term/adopt` | — | `201 VocabularyItem` | FR-015 |
| POST | `/api/conversation/sessions/:sessionId/end` | — | `204` | |

## Progress & Leveling (User Story 5)

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/api/languages/:languageCode/progress` | — | `200 ProgressState & {currentLevel}` | FR-017; single representation, same shape regardless of which mode produced the latest update |

## AI Provider Config

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| GET | `/api/ai-providers` | — | `200 [AIProviderConfig]` (keys redacted) | |
| POST | `/api/ai-providers` | `{provider, model, apiKey?}` | `201 AIProviderConfig` (key redacted in response) | FR-016; key encrypted before storage |
| DELETE | `/api/ai-providers/:id` | — | `204` | falls back to shared free-tier provider |

## Offline Sync

| Method | Path | Request | Response | Notes |
|---|---|---|---|---|
| POST | `/api/sync/actions` | `{idempotencyKey, type, payload}` | `200 {applied: true}` | replays a queued offline mutation (research.md #10); replay of a known `idempotencyKey` returns `200 {applied: true}` without reapplying |

## Cross-cutting error shape

All endpoints return errors as `{error: {code, message}}`. One code is load-bearing for
Principle II compliance and MUST be used consistently rather than a generic 4xx/5xx:

- `NO_LEVEL_APPROPRIATE_MATCH` — reading-source search found nothing at the learner's level
  (FR-010); returned as a 404 error, since there is genuinely nothing to return.

`COULD_NOT_EVALUATE` (FR-012) is deliberately **not** an HTTP error: a low-confidence speaking
attempt is an expected, successful outcome of evaluation, not a failure of the request — it is
returned as `200 SpeakingAttempt` with `evaluationResult: "could_not_evaluate"` (see Speaking
Practice below), so the client can render it without special-casing an error path.
