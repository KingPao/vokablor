# Vokablor

Vokablor is a Progressive Web App for learning vocabulary the way you'd actually encounter
it: you build a personal word list (by hand or by asking the app to suggest some), see those
words used in real news headlines, practice saying them out loud with AI correction, and have
open-ended conversations with an AI in the language you're learning. Everything you do feeds a
single points/streak/level system that decides what to show you next.

## What it does

- **Vocabulary list & training** — add words manually or ask the app for AI-generated,
  dictionary-verified suggestions; review them with a spaced-repetition-style training mode.
- **Level-adaptive reading** — see short excerpts from real RSS news feeds that use your
  target words, filtered to your current CEFR level (never the full article — just enough
  context, with a link and attribution back to the source).
- **AI-corrected speaking practice** — record yourself saying a word or phrase; the app
  transcribes it and tells you if you got it right, with a grounded correction if not (and an
  honest "couldn't tell" if the audio just wasn't usable — never a fabricated correction).
- **AI conversation practice** — have a back-and-forth conversation in your target language,
  scoped to words you already know; new vocabulary the AI introduces gets flagged so you can
  add it to your list with one click.
- **Gamified, adaptive leveling** — one shared points/streak counter across every mode, and a
  proficiency level that advances automatically from your actual performance, which in turn
  decides what vocabulary and reading sources you see next.
- **Bring your own AI** — use the shared free-tier provider by default, or plug in your own
  OpenAI, Anthropic, or Google API key per account.
- **Works offline** — previously loaded vocabulary and progress are reviewable without a
  connection; anything you do offline queues up and syncs once you're back online.

See [`specs/001-language-learning-pwa/spec.md`](specs/001-language-learning-pwa/spec.md) for
the full feature spec, or [`plan.md`](specs/001-language-learning-pwa/plan.md) and
[`research.md`](specs/001-language-learning-pwa/research.md) for the technical design.

## Tech stack

- **Frontend**: vanilla TypeScript + Vite, built as an installable PWA (manifest + service
  worker), no UI framework.
- **Backend**: [Hono](https://hono.dev) on Node.js, [Kysely](https://kysely.dev) for
  type-safe MySQL access.
- **Database**: MySQL 8.4.
- **Deployment**: a single Docker image (frontend + backend) behind a Caddy reverse proxy for
  automatic HTTPS.
- **Testing**: Vitest (unit/contract/integration, backend and frontend) and Playwright (E2E:
  install flow, offline behavior, mobile viewports).

## Prerequisites

- Node.js 22+ and npm
- Docker + Docker Compose (for the real deployment path, or for a throwaway MySQL if you're
  running the app directly on the host)

## Getting started

### Option A — run it like production (Docker Compose)

This builds one image containing the built frontend + backend, starts MySQL, and puts a Caddy
reverse proxy in front for HTTPS — the same shape it'd run in for real.

```bash
cp .env.example .env
# edit .env: set real values for SESSION_SECRET, API_KEY_ENCRYPTION_KEY, and the MySQL
# passwords at minimum (see "Configuration" below)

cd docker
docker compose up --build -d
docker compose exec app node backend/dist/migrations/run.js up   # first run only
```

Open **https://localhost** (accept the self-signed local certificate — real deployments would
put a real domain behind Caddy and get a Let's Encrypt cert automatically).

```bash
docker compose logs -f app     # tail the backend
docker compose down            # stop everything (add -v to also wipe the database)
```

### Option B — local dev loop (fast rebuilds)

Run a plain MySQL container plus the app directly on your machine — better for actively
changing code, since nothing needs a Docker image rebuild.

```bash
docker run -d --name vokablor-dev-mysql \
  -e MYSQL_ROOT_PASSWORD=devroot -e MYSQL_DATABASE=vokablor \
  -e MYSQL_USER=vokablor -e MYSQL_PASSWORD=devpass \
  -p 3306:3306 mysql:8.4

cp .env.example .env
# same required values as above, plus: MYSQL_HOST=localhost, COOKIE_SECURE=false
# (a `Secure` cookie is never sent over plain http://localhost by Safari/WebKit)

npm install
npm run migrate       # applies migrations via tsx against the container above
npm run dev            # backend (tsx watch, :3000) + Vite dev server (:5173) together
```

Open **http://localhost:5173**.

## Using the app

1. **Register** an account and pick a language (any code, e.g. `fr`, `de`, `es` — it's created
   the first time you use it).
2. **Add vocabulary**: type words in yourself, or hit "Suggest words" for a topic and adopt the
   ones you like.
3. **Train**: run a training session — you'll be quizzed on due words, and each answer moves
   that word through `new → learning → reviewing → mastered`.
4. **Read**: from any word, open "Read examples" to see real news excerpts using it, filtered
   to your level.
5. **Speak**: start a speaking session, hold the record button, say the word, release —
   you'll get an immediate correct/incorrect/"couldn't evaluate" result.
6. **Converse**: start a conversation and just talk; any new word the AI uses gets flagged with
   an "adopt" button.
7. Your points, streak, and level are always visible at the top of the page and update after
   every action in every mode; the level itself moves up automatically once you've shown
   consistent success — no manual level-picking after the first setup.

By default every learner shares one free-tier AI provider with limited daily quota. To use
your own OpenAI/Anthropic/Google key instead (no shared quota, your own cost), go to
**AI provider settings** and add it — it's encrypted at rest and never shown again in the UI.

## Configuration

All configuration is environment variables — copy `.env.example` to `.env` and fill it in.
The ones you actually need to set for anything to work:

| Variable | What it's for |
|---|---|
| `MYSQL_*` | Database connection + credentials |
| `SESSION_SECRET` | Signs the session cookie — any long random string |
| `API_KEY_ENCRYPTION_KEY` | Base64-encoded 32-byte key used to encrypt learners' own AI provider keys at rest |
| `COOKIE_SECURE` | Leave `true` behind HTTPS (Docker Compose path); set `false` for plain-HTTP local dev |

Everything else has a working default:

| Variable | Default behavior |
|---|---|
| `NVIDIA_FREE_API_KEY` / `_BASE_URL` / `_MODEL` | The shared free-tier AI provider every learner falls back to until they add their own key |
| `NVIDIA_FREE_RATE_LIMIT_PER_DAY` | Per-learner daily request cap on that shared provider (default 50) |
| `RSS_FEEDS_FR` / `_ES` / `_DE` | Comma-separated RSS feed URLs used as reading sources per language — empty by default, so reading-example lookups will honestly report "no match" until you set some. Run `npm run seed:rss --workspace backend -- --verify` for a starter list of real feeds to paste in. |

## Testing

```bash
npm run test              # backend + frontend unit/contract/integration tests (Vitest)
npm run test:coverage     # same, gated at 80% coverage on all four metrics
npm run test:e2e          # Playwright: PWA install flow, offline behavior, mobile viewports
```

The backend test suite needs a real MySQL instance (point `backend/.env.test` at one); the
Playwright suite starts its own backend + frontend dev servers automatically.

## Project structure

```text
backend/            Hono API server, Kysely models/migrations, AI provider adapters
frontend/            Vite PWA — vanilla TS pages, service worker, offline queue
docker/              Dockerfile, docker-compose.yml, Caddyfile
specs/001-language-learning-pwa/   Full spec, plan, data model, API contracts, tasks
```

For the deeper "why" behind any design decision, check
[`specs/001-language-learning-pwa/research.md`](specs/001-language-learning-pwa/research.md)
and the project [constitution](.specify/memory/constitution.md).
