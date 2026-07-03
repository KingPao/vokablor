# Quickstart: Validating the Language Learning PWA

Prerequisites and runnable scenarios to prove each user story from [spec.md](./spec.md) works
end-to-end. See [data-model.md](./data-model.md) for entity fields and
[contracts/api.md](./contracts/api.md) for endpoint details.

## Prerequisites

- Docker + Docker Compose (runs the app container, MySQL, and the Caddy/Traefik reverse proxy
  with a local dev TLS cert — HTTPS is required for the service worker even in dev).
- A `.env` with at least: MySQL credentials, session-signing secret, the API-key encryption
  key, and either a real key for one AI provider or reliance on the shared free-tier default.
- `npm install` at the repo root (frontend + backend workspaces).

## Setup

Two ways to run this, depending on what you're validating:

**A — the real deployment shape** (single built image + MySQL + Caddy, matches production):

```bash
cd docker && docker compose up --build -d     # builds and starts app + mysql + proxy
```

The app container's entrypoint (`docker/entrypoint.sh`) applies any pending migrations
automatically before starting the server, on every start — no separate migration command.

Open `https://localhost` (accept the local self-signed cert) — this serves the actual built
frontend and API through Caddy, exactly as production would.

**B — local dev loop** (fast rebuilds, no image build):

```bash
docker run -d --name vokablor-dev-mysql -e MYSQL_ROOT_PASSWORD=... \
  -e MYSQL_DATABASE=vokablor -e MYSQL_USER=vokablor -e MYSQL_PASSWORD=... \
  -p 3306:3306 mysql:8.4                       # a plain MySQL container, no Caddy/app image
npm run migrate --workspace backend            # applies Kysely migrations via tsx against it
npm run dev                                     # backend (tsx watch) + Vite dev server, proxied
```

Open `http://localhost:5173` — plain HTTP is fine here since `localhost` is a secure context
for service workers; set `COOKIE_SECURE=false` in `.env` for this path (see
`middleware/session.ts`) since Path A's `Secure` cookie attribute isn't sent over HTTP.

## Scenario 1 — Vocabulary list & training (User Story 1, P1)

1. Register a learner account and select a target language.
2. Add 5 words manually (`POST /api/languages/:code/vocabulary`).
3. Call the suggestion endpoint for a topic and adopt 5 more
   (`POST .../vocabulary/suggest` → `.../vocabulary/adopt` with the chosen candidate in the body).
4. Start a training session and answer all 10 due items.
   **Expected**: each `VocabularyItem.mastery_state` moves off `new`; re-adding a word already
   in the list reuses the existing row instead of creating a duplicate (FR-005).

## Scenario 2 — Level-adaptive reading (User Story 2, P2)

1. Using the learner from Scenario 1, request excerpts for one of the added words
   (`GET /api/vocabulary/:id/excerpts`).
   **Expected**: response contains excerpts tagged at/below the learner's current level, each
   with `source_url` attribution and a snippet short enough to not be the full article/script.
2. Repeat for a rare/invented term with no real-world usage at the learner's level.
   **Expected**: `{found: false}` / `NO_LEVEL_APPROPRIATE_MATCH`, not a mismatched result.

## Scenario 3 — AI-corrected speaking (User Story 3, P3)

1. Start a speaking session and submit a correct spoken attempt for a due word.
   **Expected**: `evaluation_result = correct`, mastery state advances.
2. Submit a mispronounced/incorrect attempt.
   **Expected**: `evaluation_result = corrected` with a non-null `correction_detail` referencing
   the specific error.
3. Submit silence/noise as the audio.
   **Expected**: `evaluation_result = could_not_evaluate`, `correction_detail` is null — the app
   must not present a guess as a confident correction (Principle III).

## Scenario 4 — AI conversation (User Story 4, P4)

1. Start a conversation session; send a learner turn using known vocabulary.
   **Expected**: AI turn returned in the target language.
2. Send a turn containing a deliberate grammar/word-choice error.
   **Expected**: the AI's reply turn has a non-null `correction_detail` grounded in that error.
3. Continue until the AI's reply includes a word outside the learner's vocabulary list.
   **Expected**: that turn's `flagged_new_vocabulary` is non-empty; calling the adopt endpoint
   on one flagged term creates a new `VocabularyItem` with `origin = app_discovered`.

## Scenario 5 — Gamified progress & leveling (User Story 5, P5)

1. Complete one action in each mode (training answer, speaking attempt, conversation turn).
2. Call `GET /api/languages/:code/progress` after each.
   **Expected**: `points`/`current_streak_days` change after every action regardless of mode —
   one representation, not per-mode counters.
3. Seed enough consistently-correct history to trigger the leveling job (or run it manually in
   a dev script) and re-check `LearnerLanguage.current_level`.
   **Expected**: level increases only on sustained success, and Scenario 2's excerpt search
   against the same word now reflects the new level.

## Offline behavior check

1. With the app open and vocabulary already loaded, disable network (DevTools "Offline").
2. Run a training session.
   **Expected**: review works from cached data; answers queue locally (IndexedDB).
3. Attempt to start a speaking or conversation session while offline.
   **Expected**: a clear "requires connection" message, not a hang.
4. Re-enable network.
   **Expected**: queued training answers flush via `POST /api/sync/actions`; replaying the same
   `idempotencyKey` twice does not double-apply (check `mastery_state` only advanced once).

## PWA installability check

Run Lighthouse's PWA audit against the deployed HTTPS URL — manifest, service worker, and
installability checks must pass (see Constitution Principle V and the PWA Requirements in the
plan's Technical Context).

## Automated test suites

```bash
npm run test            # Vitest: unit + integration, includes AIProvider adapters against
                         # recorded fixtures (research.md #11)
npm run test:coverage   # gates at 80% line coverage (@vitest/coverage-v8)
npm run test:e2e        # Playwright: install flow, offline mode, mobile viewports
```
