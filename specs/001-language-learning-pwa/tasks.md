---

description: "Task list for Language Learning PWA implementation"
---

# Tasks: Language Learning PWA

**Input**: Design documents from `/specs/001-language-learning-pwa/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/api.md](./contracts/api.md),
[quickstart.md](./quickstart.md)

**Tests**: Included. The tech stack in plan.md explicitly requires Vitest + Playwright with an
80% coverage gate, so contract/integration tests are part of each user-story phase, not optional.

**Organization**: Tasks are grouped by user story (spec.md priorities P1-P5) to enable
independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US5)
- Paths follow the Option 2 (frontend + backend) structure from plan.md

## Path Conventions

- Backend: `backend/src/`, `backend/tests/`
- Frontend: `frontend/src/`, `frontend/tests/`
- Deployment: `docker/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create `backend/`, `frontend/`, and `docker/` directory skeletons per plan.md Project Structure
- [X] T002 Initialize backend Node+TypeScript project (`backend/package.json`, `backend/tsconfig.json`) with Hono, Kysely, `mysql2`, `argon2`, `dotenv` dependencies
- [X] T003 [P] Initialize frontend Vite+TypeScript project with `vite-plugin-pwa` in `frontend/package.json`, `frontend/tsconfig.json`
- [X] T004 [P] Configure shared ESLint + Prettier config for `backend/` and `frontend/`
- [X] T005 [P] Configure Vitest + `@vitest/coverage-v8` (80% line threshold) in `backend/vitest.config.ts`
- [X] T006 [P] Configure Vitest + `@vitest/coverage-v8` (80% line threshold) in `frontend/vitest.config.ts`
- [X] T007 [P] Configure Playwright with mobile-viewport projects in `frontend/playwright.config.ts`
- [X] T008 Create `docker/Dockerfile` (multi-stage: build frontend static assets, build backend, copy both into one runtime image)
- [X] T009 Create `docker/docker-compose.yml` (app + MySQL + Caddy/Traefik reverse proxy with local dev TLS)
- [X] T010 [P] Create `.env.example` documenting MySQL credentials, session-signing secret, API-key encryption key, and AI provider defaults

**Checkpoint**: Repo builds and installs; `docker compose up` starts an (empty) stack.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T011 Configure Kysely MySQL dialect + connection pool in `backend/src/db/client.ts`
- [X] T012 Create Kysely migration runner script in `backend/src/migrations/run.ts`
- [X] T013 [P] Migration 0001: `learners` + `sessions` tables in `backend/src/migrations/0001_learners_sessions.ts`
- [X] T014 [P] Migration 0002: `learner_languages` + `ai_provider_configs` tables in `backend/src/migrations/0002_languages_providers.ts`
- [X] T015 [P] Migration 0003: `vocabulary_items` table in `backend/src/migrations/0003_vocabulary_items.ts`
- [X] T016 [P] Migration 0004: `source_excerpts` + `vocabulary_excerpt_matches` tables in `backend/src/migrations/0004_excerpts.ts`
- [X] T017 [P] Migration 0005: `practice_sessions` + `speaking_attempts` + `conversation_sessions` + `conversation_turns` tables in `backend/src/migrations/0005_sessions.ts`
- [X] T018 [P] Migration 0006: `progress_states` + `offline_synced_actions` tables in `backend/src/migrations/0006_progress_sync.ts`
- [X] T019 Implement signed, httpOnly, `Secure`, `SameSite=Lax` session-cookie middleware in `backend/src/middleware/session.ts`
- [X] T020 [P] Implement Argon2id password hashing utility in `backend/src/services/password.ts`
- [X] T021 [P] Implement API-key encrypt/decrypt utility (for `AIProviderConfig.api_key_encrypted`) in `backend/src/services/crypto.ts`
- [X] T022 Implement `AIProvider` adapter interface (`generateText`, `evaluateSpeech`, `converseTurn`) + shared NVIDIA free-tier adapter in `backend/src/services/ai-providers/index.ts` and `backend/src/services/ai-providers/nvidia-free.ts`
- [X] T023 Implement per-learner rate limiter for the shared free-tier `AIProvider` path in `backend/src/middleware/rate-limit.ts` (depends on T022)
- [X] T024 [P] Implement error-response helper enforcing the `NO_LEVEL_APPROPRIATE_MATCH` / `COULD_NOT_EVALUATE` error codes in `backend/src/api/errors.ts`
- [X] T025 [P] Implement `ProgressState` model + `recordActivity(learnerLanguageId)` helper in `backend/src/models/progress-state.ts`
- [X] T026 Scaffold Hono app + route mounting + global middleware wiring in `backend/src/api/app.ts` (depends on T019, T024)
- [X] T027 [P] Scaffold frontend API client (fetch with `credentials: 'include'` for cookies) in `frontend/src/services/api-client.ts`
- [X] T028 [P] Scaffold PWA `manifest.json` + service worker precache config in `frontend/public/manifest.json` and `frontend/vite.config.ts`
- [X] T029 [P] Scaffold IndexedDB offline queue (enqueue/dequeue by `idempotencyKey`) in `frontend/src/services/offline-queue.ts`

**Checkpoint**: Foundation ready - user story implementation can now begin.

---

## Phase 3: User Story 1 - Build and Practice a Personal Vocabulary List (Priority: P1) 🎯 MVP

**Goal**: Learners can add/discover vocabulary and review it in a standard training mode with
mastery tracking.

**Independent Test**: Create an account, add/search 10 words, run a training session, confirm
mastery state updates and duplicate discovery reuses existing entries.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T030 [P] [US1] Contract test for register/login/logout in `backend/tests/contract/test_auth.ts`
- [X] T031 [P] [US1] Contract test for vocabulary CRUD + suggest/adopt endpoints in `backend/tests/contract/test_vocabulary.ts`
- [X] T032 [P] [US1] Contract test for training session start + submit answer in `backend/tests/contract/test_training.ts`
- [X] T033 [P] [US1] Integration test for add→train→mastery-update→dedupe flow in `backend/tests/integration/test_vocabulary_training_flow.ts`

### Implementation for User Story 1

- [X] T034 [P] [US1] `Learner` model/queries in `backend/src/models/learner.ts`
- [X] T035 [P] [US1] `LearnerLanguage` model/queries in `backend/src/models/learner-language.ts`
- [X] T036 [P] [US1] `VocabularyItem` model/queries, including dedupe-by-term lookup (FR-005), in `backend/src/models/vocabulary-item.ts`
- [X] T037 [US1] `AuthService` (register/login/logout, session issuance) in `backend/src/services/auth-service.ts` (depends on T034, T020, T019)
- [X] T038 [US1] `VocabularyService` (add/edit/delete/dedupe, mastery transitions) in `backend/src/services/vocabulary-service.ts` (depends on T036, T025)
- [X] T039 [US1] `VocabularySuggestionService` (AI candidate generation + dictionary verification, research.md #8) in `backend/src/services/vocabulary-suggestion-service.ts` (depends on T022)
- [X] T040 [US1] `TrainingService` (due-item selection, answer recording, mastery + progress update) in `backend/src/services/training-service.ts` (depends on T036, T025)
- [X] T041 [US1] Auth routes in `backend/src/api/routes/auth.ts` (depends on T037)
- [X] T042 [US1] Vocabulary routes (CRUD, suggest, adopt) in `backend/src/api/routes/vocabulary.ts` (depends on T038, T039)
- [X] T043 [US1] Training routes (session start, submit answer) in `backend/src/api/routes/training.ts` (depends on T040)
- [X] T044 [P] [US1] Frontend registration/login pages in `frontend/src/pages/auth.ts` (depends on T027)
- [X] T045 [P] [US1] Frontend vocabulary list page (add/edit/delete/suggest/adopt) in `frontend/src/pages/vocabulary.ts` (depends on T027)
- [X] T046 [US1] Frontend training session page (quiz flow, caches due items for offline review) in `frontend/src/pages/training.ts` (depends on T045, T029)

**Checkpoint**: User Story 1 fully functional and independently testable (MVP).

---

## Phase 4: User Story 2 - Level-Adaptive Real-World Reading (Priority: P2)

**Goal**: Learners see level-appropriate news/TV/game excerpts containing their target vocabulary.

**Independent Test**: Given an existing vocabulary list and level, trigger a source search and
confirm every returned excerpt contains a target word, is tagged at/below the learner's level,
and shows attribution — with an explicit no-match response when nothing qualifies.

### Tests for User Story 2

- [X] T047 [P] [US2] Contract test for `GET /api/vocabulary/:id/excerpts` (match and no-match cases) in `backend/tests/contract/test_excerpts.ts`
- [X] T048 [P] [US2] Integration test confirming excerpt search respects learner level and returns attribution-only snippets in `backend/tests/integration/test_reading_sources_flow.ts`

### Implementation for User Story 2

- [X] T049 [P] [US2] `SourceExcerpt` + `VocabularyExcerptMatch` model/queries in `backend/src/models/source-excerpt.ts`
- [X] T050 [US2] RSS feed poller/indexer (per-language feeds, headline/snippet only — research.md #7) in `backend/src/services/rss-ingest-service.ts` (depends on T049)
- [X] T051 [US2] `ExcerptMatchingService` (level-filtered vocabulary→excerpt lookup, explicit `NO_LEVEL_APPROPRIATE_MATCH`) in `backend/src/services/excerpt-service.ts` (depends on T049, T024)
- [X] T052 [US2] Excerpt routes (`GET /api/vocabulary/:id/excerpts`) in `backend/src/api/routes/excerpts.ts` (depends on T051)
- [X] T053 [P] [US2] Frontend reading/excerpts view on vocabulary detail in `frontend/src/pages/reading.ts` (depends on T027)

**Checkpoint**: User Stories 1 AND 2 both independently functional.

---

## Phase 5: User Story 3 - AI-Corrected Speaking Practice (Priority: P3)

**Goal**: Learners speak target words/phrases and get AI corrections grounded in the actual
attempt, with an explicit "could not evaluate" outcome when confidence is too low.

**Independent Test**: Record correct, incorrect, and inaudible spoken attempts and confirm each
returns a grounded correction or an explicit `could_not_evaluate` — never a guess presented as
confident.

### Tests for User Story 3

- [X] T054 [P] [US3] Contract test for speaking session start + submit attempt (correct/corrected/could_not_evaluate) in `backend/tests/contract/test_speaking.ts`
- [X] T055 [P] [US3] Contract test for AI provider config CRUD in `backend/tests/contract/test_ai_providers.ts`
- [X] T056 [P] [US3] Integration test confirming speaking attempts update mastery/progress and that low-confidence evaluations never persist a `correction_detail` in `backend/tests/integration/test_speaking_flow.ts`

### Implementation for User Story 3

- [X] T057 [P] [US3] `SpeakingAttempt` model/queries enforcing the `correction_detail`/`could_not_evaluate` mutual exclusion in `backend/src/models/speaking-attempt.ts`
- [X] T058 [P] [US3] `AIProviderConfig` model/queries in `backend/src/models/ai-provider-config.ts` (depends on T021)
- [X] T059 [US3] `SpeakingEvaluationService` (audio → `AIProvider.evaluateSpeech`, confidence gating per FR-012) in `backend/src/services/speaking-service.ts` (depends on T022, T057, T025)
- [X] T060 [US3] `AIProviderConfigService` (create/list/delete, key encryption, fallback-to-shared-provider resolution) in `backend/src/services/ai-provider-config-service.ts` (depends on T058, T021)
- [X] T061 [US3] Speaking routes (session start, submit attempt) in `backend/src/api/routes/speaking.ts` (depends on T059)
- [X] T062 [US3] AI provider config routes (`GET`/`POST`/`DELETE /api/ai-providers`) in `backend/src/api/routes/ai-providers.ts` (depends on T060)
- [X] T063 [P] [US3] Frontend speaking-practice page (`MediaRecorder` capture, upload, feedback display — research.md #9) in `frontend/src/pages/speaking.ts` (depends on T027)
- [X] T064 [P] [US3] Frontend AI provider settings page (configure provider/model/API key) in `frontend/src/pages/settings-ai-provider.ts` (depends on T027)

**Checkpoint**: User Stories 1-3 independently functional.

---

## Phase 6: User Story 4 - AI Conversation Practice (Priority: P4)

**Goal**: Learners hold open-ended AI conversations in the target language, scoped to known
vocabulary/level, with grounded corrections and visible flagging of new vocabulary.

**Independent Test**: Exchange several turns and confirm AI turns stay in the target language,
reference known vocabulary, flag any new word introduced, and ground corrections in what the
learner actually wrote/said.

### Tests for User Story 4

- [X] T065 [P] [US4] Contract test for conversation session start/turn/end + flagged-vocabulary adopt in `backend/tests/contract/test_conversation.ts`
- [X] T066 [P] [US4] Integration test confirming grounded corrections, new-vocabulary flagging, and adopt-into-list behavior in `backend/tests/integration/test_conversation_flow.ts`

### Implementation for User Story 4

- [X] T067 [P] [US4] `ConversationSession` + `ConversationTurn` model/queries in `backend/src/models/conversation.ts`
- [X] T068 [US4] `ConversationService` (turn exchange via `AIProvider.converseTurn`, new-vocabulary flagging, grounded correction) in `backend/src/services/conversation-service.ts` (depends on T022, T067, T036, T025, T060)
- [X] T069 [US4] Conversation routes (session start, turn, flagged-vocabulary adopt, end) in `backend/src/api/routes/conversation.ts` (depends on T068)
- [X] T070 [P] [US4] Frontend conversation page (chat UI, flagged-vocabulary adopt action) in `frontend/src/pages/conversation.ts` (depends on T027)

**Checkpoint**: User Stories 1-4 independently functional.

---

## Phase 7: User Story 5 - Gamified Progress and Adaptive Leveling (Priority: P5)

**Goal**: Every mode feeds one visible progress system, and proficiency level updates
automatically from cross-mode performance to drive what vocabulary/sources come next.

**Independent Test**: Perform actions across all modes and confirm one progress indicator
updates consistently; simulate sustained correct answers and confirm the level increases without
manual override, then confirm reading/vocabulary suggestions reflect the new level.

### Tests for User Story 5

- [X] T071 [P] [US5] Contract test for `GET /api/languages/:code/progress` in `backend/tests/contract/test_progress.ts`
- [X] T072 [P] [US5] Integration test confirming cross-mode actions update a single `ProgressState` and that sustained success raises `current_level`, which then changes excerpt/vocabulary selection, in `backend/tests/integration/test_progress_leveling_flow.ts`

### Implementation for User Story 5

- [X] T073 [US5] `LevelingService` (periodic reassessment reading cross-mode session history, level transition rules per FR-018) in `backend/src/services/leveling-service.ts` (depends on T025, T040, T059, T068)
- [X] T074 [US5] Progress routes (`GET` progress + level) in `backend/src/api/routes/progress.ts` (depends on T025)
- [X] T075 [P] [US5] Frontend progress/level indicator component, visible from any screen (FR-017) in `frontend/src/components/progress-indicator.ts` (depends on T027)
- [X] T076 [US5] Wire the progress-indicator component into the training/reading/speaking/conversation pages in `frontend/src/pages/*.ts` (depends on T075, T046, T053, T063, T070)

**Checkpoint**: All user stories independently functional; unified gamification live.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T077 [P] Offline-sync endpoint with idempotent replay (research.md #10) in `backend/src/api/routes/sync.ts` and `backend/src/services/offline-sync-service.ts`
- [X] T078 [P] Frontend offline-queue flush wiring (foreground replay-on-reconnect + best-effort Background Sync) in `frontend/src/sw/offline-sync.ts`
- [X] T079 [P] Playwright E2E: PWA install flow / Lighthouse installability in `frontend/tests/e2e/install.spec.ts`
- [X] T080 [P] Playwright E2E: offline mode (training works offline; speaking/conversation show a clear offline message; sync on reconnect) in `frontend/tests/e2e/offline.spec.ts`
- [X] T081 [P] Playwright E2E: mobile-viewport responsive checks (Android/iOS sizes) in `frontend/tests/e2e/mobile-viewport.spec.ts`
- [X] T082 [P] RSS source-catalog seed script (initial per-language feed list) in `backend/src/scripts/seed-rss-sources.ts`
- [X] T083 Run full coverage report and confirm ≥80% threshold across backend and frontend; close any gaps
- [X] T084 Run all [quickstart.md](./quickstart.md) validation scenarios end-to-end against a local `docker compose` stack

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - Can proceed in parallel if staffed, but priority order (P1→P5) is recommended since US3
    introduces `AIProviderConfig` that US4 reuses, and US5's `LevelingService` reads session
    history produced by US1/US3/US4
  - Recommended sequential order: US1 → US2 → US3 → US4 → US5
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: No dependencies on other stories — pure MVP slice
- **User Story 2 (P2)**: Reads `VocabularyItem` and `LearnerLanguage.current_level` from US1;
  independently testable with a level set manually if US5's auto-leveling isn't built yet
- **User Story 3 (P3)**: Reads `VocabularyItem` from US1; introduces `AIProviderConfig`, which
  US4 also uses
- **User Story 4 (P4)**: Reads `VocabularyItem` from US1 and `AIProviderConfig` from US3
- **User Story 5 (P5)**: Reads session/attempt history produced by US1, US3, and US4; can run
  with a stubbed/manual level before this story exists (US2 already tolerates that), so it is
  safe to build last

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Models before services
- Services before routes
- Backend routes before the frontend page that calls them
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (migrations T013-T018 are independent
  files; utilities T020, T021, T024, T025 are independent files)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Frontend page tasks marked [P] can run in parallel with backend route tasks in the same story
  once the API client (T027) exists, since they're different files
- Different user stories can be worked on in parallel by different developers once Foundational
  is done, keeping the dependency notes above in mind (US3 before US4; US1/US3/US4 before US5
  for a fully automatic level)

---

## Parallel Example: User Story 1

```bash
# Launch all tests for User Story 1 together:
Task: "Contract test for register/login/logout in backend/tests/contract/test_auth.ts"
Task: "Contract test for vocabulary CRUD + suggest/adopt endpoints in backend/tests/contract/test_vocabulary.ts"
Task: "Contract test for training session start + submit answer in backend/tests/contract/test_training.ts"
Task: "Integration test for add→train→mastery-update→dedupe flow in backend/tests/integration/test_vocabulary_training_flow.ts"

# Launch all models for User Story 1 together:
Task: "Learner model/queries in backend/src/models/learner.ts"
Task: "LearnerLanguage model/queries in backend/src/models/learner-language.ts"
Task: "VocabularyItem model/queries in backend/src/models/vocabulary-item.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Run quickstart.md Scenario 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → validate via quickstart.md Scenario 1 → Deploy/Demo (MVP!)
3. Add User Story 2 → validate via Scenario 2 → Deploy/Demo
4. Add User Story 3 → validate via Scenario 3 → Deploy/Demo
5. Add User Story 4 → validate via Scenario 4 → Deploy/Demo
6. Add User Story 5 → validate via Scenario 5 + the Offline behavior check → Deploy/Demo
7. Phase 8 Polish → validate PWA installability + full quickstart.md pass

### Parallel Team Strategy

With multiple developers, after Foundational is done:

- Developer A: User Story 1, then User Story 5 (needs US1's session history)
- Developer B: User Story 2 (only needs US1's vocabulary/level, can start once US1's models land)
- Developer C: User Story 3, then User Story 4 (US4 depends on US3's `AIProviderConfig`)

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Every user story phase includes tests per the coverage-gate requirement in plan.md
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate a story independently via the matching quickstart.md scenario
- Avoid: vague tasks, same-file conflicts, cross-story dependencies that break independence
