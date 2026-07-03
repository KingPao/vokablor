#!/bin/sh
# Runs once per container start. `docker-compose.yml`'s `depends_on: condition:
# service_healthy` on mysql guarantees the database is already reachable by the time this
# runs, so no wait-for-it retry loop is needed. Migrations are safe to re-run on every
# restart — Kysely's migrator tracks what's already applied and no-ops on those.
set -e

echo "Applying database migrations..."
node backend/dist/migrations/run.js up

echo "Starting server..."
exec node backend/dist/api/app.js
