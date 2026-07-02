# Implementation Plan: Language Learning PWA

**Branch**: `001-language-learning-pwa` | **Date**: 2026-07-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-language-learning-pwa/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command. See `.specify/templates/plan-template.md` for the execution workflow.

## Summary

A self-hosted PWA for vocabulary-driven language learning: learners build a vocabulary list
(manual or AI/web-discovered), review it in a spaced training mode, see real-world usage
excerpts from news/TV/games filtered to their level, practice speaking with AI correction, and
have open-ended AI conversations — all feeding one gamified progress/leveling system that
decides what vocabulary and sources come next. Technical approach: a vanilla TS + Vite PWA
frontend talking to a minimal Node/Hono backend over a typed Kysely/MySQL data layer, with a
pluggable per-learner AI provider abstraction and RSS-based, excerpt-only content sourcing —
see [research.md](./research.md) for the ten technology decisions this rests on.

## Technical Context

**Language/Version**: TypeScript (ES2022+) throughout; Node.js LTS on the backend.

**Primary Dependencies**: Vite (frontend build/PWA plugin), Hono (backend router), Kysely
(typed MySQL access), Argon2 (password hashing), a hand-written `AIProvider` adapter interface
(OpenAI/Anthropic/Google/NVIDIA-free) — see research.md #1, #2, #3, #5.

**Storage**: MySQL (self-hosted), accessed via Kysely; see [data-model.md](./data-model.md) for
the full schema (Learner, LearnerLanguage, VocabularyItem, SourceExcerpt, PracticeSession,
SpeakingAttempt, ConversationSession/Turn, ProgressState, AIProviderConfig,
OfflineSyncedAction).

**Testing**: Vitest + `@vitest/coverage-v8` for unit/integration (80% line-coverage gate),
Playwright for install-flow/offline/mobile-viewport E2E; see research.md #11.

**Target Platform**: Browser-based PWA, installable on Android and iOS; server runs as a
Docker container behind a Caddy/Traefik HTTPS reverse proxy.

**Project Type**: Web application (frontend + backend), per Option 2 below.

**Performance Goals**: Standard responsive-web expectations for locally-computed operations
(UI interactions, cached-vocabulary review) — no numeric SLA specified by the feature; AI-bound
operations (speaking correction, conversation turns, source search) are dominated by the
configured AI provider's own latency and are outside this app's control, so the requirement is
graceful "still working / could not evaluate" feedback (FR-012) rather than a fixed p95.

**Constraints**: Minimal dependencies (vanilla JS/TS, no heavy frontend framework); HTTPS
mandatory for service worker/PWA features; offline-capable vocabulary review with queued/synced
offline actions (research.md #10); httpOnly signed session cookies, not localStorage;
user-supplied AI provider keys encrypted at rest; per-learner rate limiting on the shared
free-tier AI fallback only (research.md #6); content sourcing limited to free/open
RSS/dictionary sources, excerpt-only storage (research.md #7, #8), never full article/script
bodies (Constitution: Content Sourcing & Compliance).

**Scale/Scope**: Self-hosted, single-tenant-per-deployment; sized for a small-to-moderate
learner base on one Docker/MySQL instance (tens to low thousands of learners), not
internet-scale — consistent with the "managed Docker container, self-hosted" deployment model.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle / Section | Status | How this plan satisfies it |
|---|---|---|
| I. Vocabulary-First Learning | PASS | `VocabularyItem` (data-model.md) is the mandatory anchor for training, excerpts, speaking attempts, and conversation flags; every mode's API writes through it (contracts/api.md). |
| II. Level-Adaptive Content Sourcing | PASS | `LearnerLanguage.current_level` gates `SourceExcerpt` selection (FR-008–010); the level itself is recomputed from cross-mode session history (`ProgressState`/leveling job in data-model.md), not just self-report; `NO_LEVEL_APPROPRIATE_MATCH` makes the selection outcome explainable/traceable rather than silent. |
| III. AI-Mediated Speaking & Correction (NON-NEGOTIABLE) | PASS | `SpeakingAttempt.evaluation_result` has an explicit `could_not_evaluate` state that the service layer forbids pairing with a `correction_detail` (data-model.md); `ConversationTurn.flagged_new_vocabulary` prevents silent drift onto untaught material. |
| IV. Gamified Progression | PASS | Single `ProgressState` row per `LearnerLanguage`, updated transactionally by every mode's session outcome (FR-017); no per-mode scoreboards. |
| V. PWA Simplicity & Resilience | PASS | Vite PWA plugin for manifest + service worker; vanilla TS frontend, Hono backend (research.md #1) chosen specifically to avoid heavy framework weight; offline queue + idempotent replay (research.md #10) satisfies offline vocabulary review without hanging on network-bound modes. |
| Content Sourcing & Compliance | PASS | RSS-only sourcing (research.md #7) and `SourceExcerpt.snippet_text` schema constraint (short, attributed, no full body) make excerpt-only storage structural, not a policy note. |
| Development Workflow & Quality Gates | PASS | Vitest/Playwright + 80% coverage gate (research.md #11) covers the level-computation, mastery-state, and AI-correction logic the constitution calls out as highest-risk. |

No unresolved violations — Complexity Tracking is intentionally left empty below.

*Post-Phase 1 re-check*: table above reflects the completed data-model.md and
contracts/api.md, not just intent — re-verified PASS on all rows after design, no drift
introduced (e.g., the `could_not_evaluate`/`correction_detail` mutual-exclusion constraint in
data-model.md was added specifically to keep Principle III enforceable at the schema level,
not just in service code).

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── models/          # Kysely table types + query builders per data-model.md entity
│   ├── services/        # vocabulary, leveling, progress, ai-provider adapters (research.md #5)
│   │   └── ai-providers/    # one adapter module per provider (openai, anthropic, google, nvidia_free)
│   ├── api/              # Hono route handlers, grouped per contracts/api.md sections
│   ├── migrations/       # Kysely migration files
│   └── middleware/       # session/cookie auth, per-learner rate limiting (research.md #6)
└── tests/
    ├── contract/         # one suite per contracts/api.md endpoint group
    ├── integration/      # cross-service flows (e.g. training → ProgressState update)
    └── unit/             # ai-provider adapters against recorded fixtures (research.md #11)

frontend/
├── src/
│   ├── components/       # vanilla TS/Web Components UI pieces
│   ├── pages/            # vocabulary, training, reading, speaking, conversation, progress
│   ├── services/         # API client, offline queue (IndexedDB), sync replay (research.md #10)
│   └── sw/                # service worker: precache + offline queue flush
├── public/
│   └── manifest.json
└── tests/
    ├── unit/             # Vitest component/service tests
    └── e2e/              # Playwright: install flow, offline mode, mobile viewports

docker/
├── Dockerfile             # backend + built frontend static assets in one image
└── docker-compose.yml     # app + MySQL + Caddy/Traefik reverse proxy
```

**Structure Decision**: Option 2 (frontend + backend) from the template, since the feature
inherently needs a browser-installable PWA client and a stateful server holding MySQL,
sessions, and AI-provider credentials — a single-project structure has no natural place to
keep server secrets (API keys, session signing) out of the client bundle. `docker/` is added
alongside (not nested in) `backend/`/`frontend/` because the Dockerfile builds and packages
both.

## Complexity Tracking

No entries — the Constitution Check above found no violations requiring justification.
