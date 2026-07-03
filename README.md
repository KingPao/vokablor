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

Follow this once, top to bottom, and you'll have a working account with real AI features by
the end. This is the Docker Compose path (the same shape a real deployment runs in); see
[Local development](#local-development) below instead if you're planning to change code.

**1. Clone and prepare your environment file**

```bash
git clone git@github.com:KingPao/vokablor.git
cd vokablor
cp .env.example .env
```

**2. Generate the two required secrets**

```bash
# Paste this output into SESSION_SECRET in .env
openssl rand -base64 32

# Paste this output into API_KEY_ENCRYPTION_KEY in .env — it MUST decode to exactly 32 bytes,
# which `openssl rand -base64 32` always produces
openssl rand -base64 32
```

Also set `MYSQL_PASSWORD` and `MYSQL_ROOT_PASSWORD` in `.env` to anything reasonably random.

**3. Get an AI provider API key**

The app needs a working AI provider for three things: AI-generated vocabulary suggestions
(always uses the *shared* provider below, regardless of what you configure later), speaking
correction, and conversation practice. Pick one:

- **Fastest — the shared free tier (NVIDIA)**: sign up at
  [build.nvidia.com](https://build.nvidia.com), generate an API key, and put it in
  `NVIDIA_FREE_API_KEY` in `.env`. Every learner on this deployment shares this key with a
  per-learner daily request cap (`NVIDIA_FREE_RATE_LIMIT_PER_DAY`, default 50) — fine for
  trying the app out or a small self-hosted instance.
- **Your own key (no shared quota)**: get a key from
  [OpenAI](https://platform.openai.com/api-keys),
  [Anthropic](https://console.anthropic.com/settings/keys), or
  [Google AI Studio](https://aistudio.google.com/apikey) (Gemini). You don't need to put this
  one in `.env` — add it later from inside the app (step 7), per learner account. Note this
  only covers speaking/conversation; vocabulary suggestions still need the NVIDIA key above to
  work at all.

You can skip this step entirely and come back to it later — everything except AI-generated
suggestions, speaking correction, and conversation practice works fine without any key
(adding words manually, training, and reading real-world excerpts don't need AI at all).

**4. Start the stack and apply migrations**

```bash
cd docker
docker compose up --build -d
docker compose exec app node backend/dist/migrations/run.js up
```

**5. Open the app**

Go to **https://localhost** and accept the browser's self-signed-certificate warning (this is
expected for local dev — a real deployment would have Caddy get a real Let's Encrypt cert
automatically for a real domain).

**6. Create your account**

Click **Register**, enter an email and password, then type a language code for what you want
to learn (e.g. `fr`, `de`, `es`, `ja` — anything; it's created the moment you use it).

**7. (Optional) Add your own AI provider key**

If you got your own OpenAI/Anthropic/Google key in step 3, open **AI provider settings**,
pick the provider, paste the key, and save. It's encrypted at rest and immediately becomes
the provider used for speaking and conversation practice across every language you study —
you can swap it or delete it (falling back to the shared default) any time.

**8. Try each mode once**

1. On the **Vocabulary** page, add 3-5 words, or hit **Suggest words** for a topic and adopt a
   few of the results.
2. Click **Training** and answer the quiz — watch a word's status move through
   `new → learning → reviewing → mastered` as you get it right.
3. From any word, click **Read examples** to see a real news excerpt using it (this needs at
   least one RSS feed configured — see `RSS_FEEDS_FR`/`_ES`/`_DE` in Configuration below;
   without one you'll correctly get an honest "no match found" instead of a fake result).
4. Click **Speaking practice**, hold the record button, say the word out loud, and release —
   you'll get an immediate correct/incorrect/"couldn't evaluate" result.
5. Click **Conversation** and have a short back-and-forth; adopt any new word the AI flags.
6. Check the points/streak/level indicator at the top — it should have moved after every one
   of the steps above (one shared counter across every mode, not a separate score per mode).
   Your level increases automatically once you've shown consistent success — no manual
   level-picking after this initial setup.

From here on, day-to-day use is just repeating step 8.

**Managing the stack** (run from the `docker/` directory):

```bash
docker compose logs -f app     # tail the backend
docker compose down            # stop everything (add -v to also wipe the database)
```

## Local development

Prefer this over Docker Compose if you're actively changing code — nothing needs an image
rebuild. Runs a plain MySQL container plus the backend and frontend directly on your machine.

```bash
docker run -d --name vokablor-dev-mysql \
  -e MYSQL_ROOT_PASSWORD=devroot -e MYSQL_DATABASE=vokablor \
  -e MYSQL_USER=vokablor -e MYSQL_PASSWORD=devpass \
  -p 3306:3306 mysql:8.4

cp .env.example .env
# same required values as the Getting Started steps above, plus:
# MYSQL_HOST=localhost and COOKIE_SECURE=false (a `Secure` cookie is never sent over plain
# http://localhost by Safari/WebKit, even though Chromium is lenient about it)

npm install
npm run migrate       # applies migrations via tsx against the container above
npm run dev            # backend (tsx watch, :3000) + Vite dev server (:5173) together
```

Open **http://localhost:5173**.

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
