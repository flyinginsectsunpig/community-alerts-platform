# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

Community Alerts Platform — a real-time neighbourhood safety dashboard built as an
event-driven polyglot monorepo:

| Directory | Stack | Role |
|---|---|---|
| `apps/web` | Next.js 14 (App Router), TypeScript, react-leaflet | Map dashboard, live feed, report + watch-zone forms |
| `services/alerts-api` | Java 21, Spring Boot 3, Maven | Public REST API, SSE feed, auth, rate limiting, **owns the DB schema (Flyway)** |
| `services/alert-processor` | C# / .NET 8 headless worker | Watch-zone matching, escalations, webhook/email delivery, stats |
| `services/ml-service` | Python 3.12, FastAPI, scikit-learn | Severity scoring (TF-IDF + LR + keyword overrides), DBSCAN hotspots |
| `tools/saps-import` | Python CLI | Quarterly SAPS crime-stats import (stations + stats into Postgres) |
| `infra/terraform` | Terraform, azurerm | Azure Container Apps deployment |
| `echoes/` | Markdown only | **Unrelated** UE5 game design docs that share this repo — ignore for platform work |
| `docs/superpowers/` | Markdown | Implementation plans and specs |

## Commands

```bash
# Full stack (uses live cloud backing services — see gotchas below)
docker compose up --build              # web :3000, api :8080, ml :8000

# Web
cd apps/web && npm run dev             # hot-reload dev server
cd apps/web && npm run typecheck && npm run build   # this IS the web "test suite" (no unit tests)

# Java API — NOTE: Maven is not installed on this machine; run it via Docker:
docker run --rm -v "C:\Fable makes my app\services\alerts-api:/workspace" \
  -v communityalerts-m2:/root/.m2 -w /workspace \
  maven:3.9-eclipse-temurin-21 mvn -B test
#   single test class: append -Dtest=AlertServiceTest
#   (CI simply runs `mvn -B verify` in services/alerts-api)

# .NET worker
dotnet test services/alert-processor/tests/AlertProcessor.Tests
#   single class: --filter FullyQualifiedName~WatchZoneMatcherTests

# Python ML service (venv at services/ml-service/.venv, or pip install both requirements files)
cd services/ml-service && pytest
#   single test: pytest tests/test_severity.py::<test_name>

# SAPS importer (writes to the LIVE Neon DB — confirm with the user first)
cd tools/saps-import && .venv/Scripts/python -m pytest tests -q     # tests
DATABASE_URL=... .venv/Scripts/python import_saps.py --xlsx <file>  # import
```

CI (`.github/workflows/ci.yml`) runs all four suites on every push/PR and builds
the four container images on `main`.

`.claude/launch.json` defines `web` (npm, :3000, autoPort), `alerts-api` and
`ml-service` (docker compose) for preview/IDE use.

## Architecture

**Write path (the core flow):** browser POSTs a report → API persists it with
severity `UNSCORED` and publishes `alert.created` to LavinMQ → ML service scores
it and publishes `alert.scored` → API applies the score; the worker independently
consumes both events to match watch zones, record notifications, recompute stats,
and escalate CRITICAL alerts. Every state change is published to Redis pub/sub
channel `alerts.live`, which each API replica bridges into Server-Sent Events —
that is what makes SSE correct across replicas.

**Messaging topology:** single topic exchange `alerts.topic` with routing keys
`alert.created` / `alert.scored`; queues `q.ml.alert-created`, `q.worker.enrichment`,
`q.api.alert-scored`, `q.worker.escalation`, plus `alerts.dlx` → `q.dead-letter`.
Exchanges are declared idempotently by every service; **each service declares only
its own queues**. All AMQP/Redis connections use TLS.

**Cross-service contracts are duplicated by hand in three languages.** The
`alert.created` / `alert.scored` event shapes live in
`services/alerts-api/src/main/java/com/communityalerts/api/messaging/events/`,
`services/alert-processor/src/AlertProcessor/Events.cs`, and
`services/ml-service/app/messaging/`. Changing an event means updating all three.
The same applies to the REST DTOs mirrored in `apps/web/src/lib/types.ts`.

**Data ownership:** only the API runs Flyway migrations
(`services/alerts-api/src/main/resources/db/migration/`); the worker and ML
service access the same PostgreSQL with raw SQL (Dapper-style / psycopg) and must
be kept in sync with schema changes. On a fresh database, start `alerts-api`
before the other services.

**Geo:** no PostGIS — bounding-box prefilter + haversine, implemented separately
in each service (Java `support/`, C# `Geo/GeoMath.cs`, Python). Escalations use
2x each zone's radius.

**Auth (hybrid, deliberate):** reporting and confirming are anonymous (random
client fingerprint from `apps/web/src/lib/fingerprint.ts` + Redis fixed-window
rate limiting that fails open). Accounts exist only for comment threads: HS256
JWTs via a small explicit filter (`auth/JwtAuthFilter.java`) with bcrypt —
spring-security-crypto only, no full Spring Security stack. Don't introduce the
full stack when touching auth.

**Redis keys:** `alerts:nearby:*` (30s geo cache, API), `stats:7d` (worker writes,
API reads, API falls back to SQL when cold), `hotspots:*` (ML, 5 min),
`rl:*` (rate limits), `alerts.live` (pub/sub for SSE).

## Local dev gotchas

- **There are no local Postgres/Redis/AMQP containers.** Docker Compose and local
  runs talk directly to live cloud services (Neon PostgreSQL, Upstash Redis,
  CloudAMQP LavinMQ) using the gitignored root `.env` (template: `.env.example`).
  Starting `alerts-api` runs Flyway against the **live Neon database** — treat it
  as a DB-modifying command and confirm with the user first.
- All configuration is environment-only; never hardcode credentials or add
  secrets to source. After editing `.env`, recreate containers
  (`docker compose up -d --build <service>`).
- `NEXT_PUBLIC_API_URL` is baked into the web image at **build time** (compose
  build arg / Dockerfile ARG) — it's the URL the *browser* uses.
- Dev-only console noise: `reactStrictMode` double-mounts `MapContainer`
  (react-leaflet 4.2.1), throwing "Map container is already initialized" errors
  that the error boundary recovers from. Expected — don't re-diagnose.
- Deployment is Terraform → Azure Container Apps (`infra/terraform`); web and API
  public, ML internal-only, worker headless. Images are built locally/in CI and
  pushed to ACR, then `terraform apply` with the new `image_tag`.
