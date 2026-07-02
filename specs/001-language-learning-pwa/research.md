# Research: Language Learning PWA

Phase 0 output. Each topic below was either an open technical unknown from the feature
description or a technology choice needing a documented rationale before Phase 1 design.

## 1. Backend web framework

- **Decision**: [Hono](https://hono.dev) running on Node.js (LTS), mounted behind the
  reverse proxy.
- **Rationale**: Zero-dependency-at-core, TypeScript-first, has first-class cookie/session
  helpers, and its router/middleware model is small enough to read end-to-end — consistent
  with the "avoid heavy frameworks" constraint. It runs on plain Node so it drops straight
  into a minimal Docker image without a framework-specific runtime.
- **Alternatives considered**: *Fastify* — solid and TS-friendly but pulls in a larger plugin
  ecosystem/dependency graph than needed here. *Raw `node:http`* — would satisfy "minimal
  dependencies" even further, but reimplementing routing, cookie parsing, and body parsing by
  hand adds more custom code (and more places to introduce security bugs) than adopting a
  ~20KB router does. *Express* — rejected as the "heavy/legacy default," offers nothing Hono
  doesn't already cover.

## 2. Database access layer

- **Decision**: [Kysely](https://kysely.dev) with the MySQL dialect.
- **Rationale**: Type-safe query building without a full ORM's runtime/model layer, matches
  the "lightweight, type-safe query layer... avoid heavy ORMs" constraint directly. Schema
  migrations handled via Kysely's migration runner (plain `.ts` migration files, no separate
  migration DSL to learn).
- **Alternatives considered**: *Raw SQL strings* — maximal minimalism but loses compile-time
  column/type checking across ~8 entities with many joins (vocabulary ↔ excerpts ↔ sessions);
  the type-safety payoff outweighs Kysely's small footprint. *Prisma* — explicitly excluded by
  the user's constraint (heavy ORM, code-gen step, larger runtime).

## 3. Password hashing

- **Decision**: Argon2id via `argon2` (native binding, Alpine/Debian-compatible build in the
  Docker image).
- **Rationale**: Argon2id is the current OWASP-recommended default for password hashing and
  the user's spec explicitly names it as an acceptable option; since the app already ships as
  a Docker image, the native-build step is a one-time Dockerfile concern, not an ops burden for
  the deployer.
- **Alternatives considered**: *bcrypt* — also explicitly allowed by the user, avoids Argon2's
  native-binding requirement, but has a lower work-factor ceiling. Argon2id is preferred as the
  primary choice with bcrypt noted as the fallback if the deployment target can't build native
  modules.

## 4. Session handling

- **Decision**: Signed, httpOnly, `Secure`, `SameSite=Lax` cookies holding an opaque session
  ID; session state (learner ID, expiry) stored server-side in a MySQL `sessions` table, not
  encoded into the cookie itself.
- **Rationale**: Matches the explicit requirement (signed httpOnly cookies, not localStorage).
  Server-side session storage (vs. a signed JWT) makes revocation (logout, password change)
  immediate rather than waiting for token expiry, and keeps the cookie payload small for mobile
  PWA contexts.
- **Alternatives considered**: *Stateless signed JWT cookie* — removes the sessions table but
  makes "log out everywhere" / revocation require a denylist anyway, which is the same
  complexity as just using a sessions table from the start.

## 5. AI provider abstraction

- **Decision**: A single internal `AIProvider` interface (`generateText`, `evaluateSpeech`,
  `converseTurn`) with one adapter per supported provider (OpenAI, Anthropic, Google, and the
  shared free-tier fallback). Each learner's `Learner Profile` stores which provider + model to
  use and an encrypted API key (if self-supplied); requests route through the interface so
  callers (speaking-practice, conversation) never see provider-specific request/response shapes.
- **Rationale**: Directly satisfies the "pluggable/abstracted so providers can be swapped per
  user without code changes" constraint and keeps Constitution Principle III (grounded,
  confidence-aware correction) enforceable in one place rather than per-provider.
- **Alternatives considered**: *LangChain or a similar provider-abstraction library* — rejected
  under the minimal-dependency constraint; the actual surface area needed (3 methods, ~4
  providers) is small enough that a hand-written adapter interface is less code and less
  dependency risk than adopting a general-purpose framework.

## 6. Free-tier AI fallback + per-user rate limiting

- **Decision**: NVIDIA's free-tier hosted inference API serves as the default `AIProvider` for
  learners who haven't configured their own key. Usage against this shared path is metered
  per-learner with a fixed-window counter (requests/tokens per rolling 24h) stored in MySQL;
  learner-supplied provider keys bypass this counter entirely (self-limited by the learner's
  own account with that provider).
- **Rationale**: Matches the explicit preference for free-tier models on the shared path and
  the requirement to prevent one learner exhausting a shared quota. A MySQL-backed counter (vs.
  in-memory) is required because the app may run as more than one container replica behind the
  reverse proxy, and it reuses the storage the app already has rather than adding Redis.
- **Alternatives considered**: *In-memory token bucket per process* — simplest, but breaks
  under multiple replicas/restarts and silently resets counters, allowing quota bypass.
  *Redis-backed limiter* — better suited to high request volume, but adds a whole new stateful
  service for a shared *fallback* path only, contradicting the minimal-dependency goal at this
  scale.

## 7. News/content sourcing

- **Decision**: A curated set of per-language RSS feeds (e.g. national broadcaster/newspaper
  feeds that publish RSS) is polled on a schedule and indexed (headline, link, publish date,
  language). Vocabulary matching runs against the indexed headline/snippet text already
  present in the feed payload; the app never fetches or stores full article bodies. TV
  show/game usage examples are sourced the same way, from any subtitle/script or wiki source
  that itself publishes short excerpts under an open license or via RSS — full scripts are out
  of scope for automated fetching.
- **Rationale**: RSS requires no API key, no paid tier, and inherently exposes only the
  headline/summary the publisher has chosen to syndicate — which keeps the app compliant with
  Content Sourcing & Compliance (excerpt-only, attributed) by construction, not by a separate
  filtering step.
- **Alternatives considered**: *Paid news APIs (NewsAPI.org paid tier, etc.)* — excluded by the
  "no paid search APIs unless unavoidable" constraint. *Scraping article pages directly* —
  explicitly deprioritized in favor of RSS/free APIs and would risk violating robots.txt/ToS for
  full-text capture, contradicting the excerpt-only requirement.

## 8. Vocabulary discovery ("search the web for suggestions")

- **Decision**: Vocabulary suggestions for a topic/level are generated by asking the learner's
  configured `AIProvider` (Decision #5) for level-appropriate candidate words, then validating
  each candidate against a free, open dictionary source (e.g. Wiktionary's API) for translation
  and basic well-formedness before it's shown to the learner.
- **Rationale**: Avoids standing up a separate paid web-search API purely for word discovery —
  the AI provider the app already integrates for speaking/conversation can generate candidates,
  and a free dictionary lookup provides an independent check rather than trusting the AI's
  translation blindly.
- **Alternatives considered**: *Paid search API (Bing/Google Custom Search)* — unnecessary cost
  for a task that doesn't need full web search, just candidate generation + verification.
  *Scraping a dictionary site directly* — an open dictionary API achieves the same result
  without robots.txt/ToS risk.

## 9. Speech capture on the client

- **Decision**: Capture audio via `MediaRecorder` (native browser API) and send the recorded
  clip to the configured `AIProvider`'s speech-evaluation endpoint for transcription +
  correction in one round-trip, rather than relying on the browser's `SpeechRecognition` API.
- **Rationale**: `SpeechRecognition` (Web Speech API) has inconsistent/absent support on iOS
  Safari, which would break the speaking-practice mode specifically on iOS PWA installs —
  unacceptable given the PWA installability requirement covers Android **and** iOS.
  `MediaRecorder` is broadly supported across the target browsers and keeps transcription +
  evaluation as a single provider-side step, which also gives the AI the raw audio (useful for
  pronunciation feedback, not just word-match on a transcript).
- **Alternatives considered**: *Web Speech API for capture* — rejected for the iOS gap above.
  *Client-side ML transcription (e.g. a WASM Whisper build)* — rejected under the
  minimal-dependency/minimal-bundle-size constraint; ships a multi-hundred-MB model to the
  client for a task the configured AI provider already does server-side.

## 10. Offline action queue + sync

- **Decision**: Offline-eligible mutations (training answers, mastery updates) are written to
  an IndexedDB-backed local queue with a client-generated idempotency key. On reconnect, the
  service worker (or a foreground sync routine) replays the queue against the API in order; the
  server upserts by idempotency key so a replayed action can never double-apply.
- **Rationale**: Matches the explicit requirement ("offline actions queued locally and
  synced/reconciled with MySQL once connection is restored") and the idempotency key is the
  simplest mechanism that makes replay-safety correct without server-side session/version
  vectors.
- **Alternatives considered**: *Background Sync API* — used opportunistically where supported
  (Chrome/Android) as a trigger to flush the queue sooner, but the app cannot depend on it alone
  since Safari/iOS does not support it; the foreground-replay-on-reconnect path is the mandatory
  baseline and Background Sync is a best-effort enhancement, not a separate mechanism.

## 11. Testing & coverage gate

- **Decision**: Vitest for unit/integration tests (including the AIProvider adapters, tested
  against recorded fixture responses rather than live calls) and `@vitest/coverage-v8` gating
  CI at 80% line coverage. Playwright covers install-flow, offline-mode, and mobile-viewport
  scenarios that Vitest can't reach (real service worker + browser behavior).
- **Rationale**: Matches the stated tooling exactly; recording AI-provider fixtures (rather than
  hitting real provider APIs in CI) keeps the suite fast, free, and deterministic while still
  exercising the correction/grounding logic Principle III requires to be tested.
- **Alternatives considered**: *Jest* — would work but adds a second config/runtime story next
  to Vite instead of reusing Vite's own transform pipeline, which Vitest does natively.
