# Data Model: Language Learning PWA

Derived from the Key Entities in [spec.md](./spec.md) and the storage/session decisions in
[research.md](./research.md). All tables live in the single self-hosted MySQL instance.

## Learner

Represents an account. One row per person.

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| email | unique, not null | login identifier |
| password_hash | not null | Argon2id (see research.md #3) |
| created_at | timestamp | |
| default_language_id | FK → LearnerLanguage, nullable | which language shows by default |

**Validation**: email must be unique and well-formed. Password hash is never returned by any
API response.

## LearnerLanguage

One row per (learner, target-language) pair — the anchor for Principle II's per-language level
tracking (FR-007, FR-021).

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| learner_id | FK → Learner | |
| language_code | e.g. BCP-47 (`fr`, `ja`, `pt-BR`) | |
| current_level | enum (A1, A2, B1, B2, C1, C2) | see Assumptions in spec.md |
| level_updated_at | timestamp | last automatic/manual reassessment |
| ai_provider_id | FK → AIProviderConfig, nullable | per-language override; falls back to
  learner-level default, then the shared free-tier provider |

**Validation**: unique on (learner_id, language_code) — one level-track per language per
learner (FR-021).

**State transitions**: `current_level` only moves via the leveling job described under
`ProgressState` below (FR-018); a manual override is allowed once at onboarding, never after.

## AIProviderConfig

A learner's configured AI provider/credentials (FR-016).

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| learner_id | FK → Learner | |
| provider | enum (openai, anthropic, google, nvidia_free, other) | |
| model | string | provider-specific model identifier |
| api_key_encrypted | bytes, nullable | null for the shared free-tier provider; encrypted at
  rest (research.md #3 area — encryption key held outside MySQL, e.g. container secret) |
| created_at | timestamp | |

**Validation**: `api_key_encrypted` required unless `provider = nvidia_free`.

## VocabularyItem

The core tracked unit (Principle I, FR-001–FR-005).

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| learner_language_id | FK → LearnerLanguage | |
| term | not null | target-language word/phrase |
| translation | not null | |
| origin | enum (user_added, app_discovered) | FR-003 |
| mastery_state | enum (new, learning, reviewing, mastered) | updated by training/speaking
  sessions (FR-006) |
| next_review_at | timestamp, nullable | drives training-mode due queue |
| created_at | timestamp | |

**Validation**: unique on (learner_language_id, term) — duplicate prevention (FR-005); reusing
an existing row instead of inserting is enforced at the service layer, not just the DB
constraint, so "discovered again" (Acceptance Scenario US1.4) is a lookup-then-reuse, not an
upsert-and-hope.

**State transitions**: `mastery_state` moves `new → learning → reviewing → mastered` on
sustained correct answers across any mode (training, speaking); a wrong answer moves it back
at most one step, never straight to `new`.

## SourceExcerpt

A level-tagged snippet demonstrating a word in context (Principle II, FR-008–FR-010).

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| language_code | not null | excerpts are language-scoped, reusable across learners of that
  language (Edge Cases: shared, not re-fetched per learner) |
| source_type | enum (news, tv_show, game) | |
| source_name | not null | e.g. publication/show/game title |
| source_url | not null | attribution link (FR-009) |
| snippet_text | not null, short (≤ ~2 sentences) | never the full body (FR-009) |
| level | enum (A1..C2) | level this excerpt is appropriate for |
| fetched_at | timestamp | |

## VocabularyExcerptMatch

Join table: which excerpt demonstrates which word(s) — many-to-many, since one snippet can
contain multiple target words and one word can have multiple excerpts.

| Field | Type | Notes |
|---|---|---|
| vocabulary_item_id | FK → VocabularyItem | |
| source_excerpt_id | FK → SourceExcerpt | |

Composite PK on both columns.

## PracticeSession

A record of one training, speaking, or conversation session (FR-006, spec Key Entities).

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| learner_language_id | FK → LearnerLanguage | |
| mode | enum (training, speaking, conversation) | |
| started_at | timestamp | |
| ended_at | timestamp, nullable | |
| outcome_summary | JSON | mode-specific summary (e.g. counts correct/incorrect) |

## SpeakingAttempt

One spoken attempt within a `speaking` PracticeSession (Principle III, FR-011–FR-012).

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| practice_session_id | FK → PracticeSession | |
| vocabulary_item_id | FK → VocabularyItem | |
| audio_ref | string | pointer to transient audio storage/blob, not raw audio in this table |
| transcript | text, nullable | null if unusable |
| evaluation_result | enum (correct, corrected, could_not_evaluate) | FR-012 |
| correction_detail | text, nullable | grounded correction text (FR-011); null when
  `evaluation_result = could_not_evaluate` |
| confidence | float, nullable | provider-reported confidence, drives the
  `could_not_evaluate` branch |
| created_at | timestamp | |

**Validation**: `correction_detail` must be null when `evaluation_result = could_not_evaluate`,
and non-null when `= corrected` — enforced at the service layer so a low-confidence guess can
never be persisted as if it were a grounded correction (Principle III).

## ConversationSession

An AI conversation session (Principle III/IV composition, FR-013–FR-015). Extends
`PracticeSession` (mode = conversation) with its own turn log.

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| practice_session_id | FK → PracticeSession, unique | |

## ConversationTurn

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| conversation_session_id | FK → ConversationSession | |
| speaker | enum (learner, ai) | |
| turn_index | int | ordering within the session |
| content | text | |
| flagged_new_vocabulary | JSON, nullable | list of terms the AI introduced that weren't in
  the learner's list yet (FR-014); null for learner turns |
| correction_detail | text, nullable | set on AI turns that correct a prior learner turn
  (FR-013 conversation acceptance scenario 3) |

## ProgressState

One row per LearnerLanguage — the single, cross-mode progression record (Principle IV,
FR-017–FR-019).

| Field | Type | Notes |
|---|---|---|
| learner_language_id | PK, FK → LearnerLanguage | |
| points | int, default 0 | incremented by any completed action in any mode |
| current_streak_days | int, default 0 | |
| last_activity_at | timestamp, nullable | streak bookkeeping |
| updated_at | timestamp | |

**State transitions**: every completed `PracticeSession` (any mode) triggers a `ProgressState`
update in the same transaction as the session's outcome write — this is what keeps FR-017
("single, learner-visible progress representation") true regardless of which mode produced the
action. The periodic level-reassessment job (FR-018) reads recent `PracticeSession` /
`SpeakingAttempt` / training outcomes across all modes for a `LearnerLanguage`, and on
sustained success writes a new `LearnerLanguage.current_level` + timestamp; it never reads or
writes `ProgressState` directly — leveling and points/streaks are independent derived views
over the same underlying session history.

## OfflineSyncedAction

Server-side dedupe record for the offline queue replay (research.md #10).

| Field | Type | Notes |
|---|---|---|
| idempotency_key | PK, string | client-generated, one per queued mutation |
| learner_id | FK → Learner | |
| applied_at | timestamp | |

**Validation**: a replayed mutation whose `idempotency_key` already exists is a no-op success
response, not a duplicate write.

## Entity Relationship Summary

```text
Learner 1─* LearnerLanguage 1─1 ProgressState
Learner 1─* AIProviderConfig
LearnerLanguage 1─* VocabularyItem
LearnerLanguage 1─* PracticeSession
VocabularyItem *─* SourceExcerpt (via VocabularyExcerptMatch)
PracticeSession 1─* SpeakingAttempt (mode = speaking)
PracticeSession 1─1 ConversationSession (mode = conversation) 1─* ConversationTurn
Learner 1─* OfflineSyncedAction
```
