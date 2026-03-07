# 🛡️ Community Alerts Platform

A **polyglot microservices platform** for real-time community safety in Cape Town — combining crime heat mapping, ML-powered incident analysis, and automated resident notifications.

Built as a portfolio project to demonstrate production-grade system design across four distinct technology stacks.

> 📖 **[Read the full Architecture & Design Decisions doc →](./docs/ARCHITECTURE.md)**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Zustand, TanStack Query, Leaflet.js |
| Core API | Java 17, Spring Boot 3, Spring Security (JWT), JPA, Redis |
| ML Service | Python 3.12, FastAPI, scikit-learn, spaCy |
| Notifications | C# 12, .NET 8, EF Core, MailKit, RabbitMQ |
| Data | PostgreSQL ×2 (domain + notifications), Redis cache |
| Infra | Docker Compose, Kubernetes (k8s manifests), Terraform (Azure) |
| CI/CD | GitHub Actions — parallel Java / .NET / Python test jobs |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                  Next.js Frontend                   │
│         (Dashboard · Map · Alerts · Forum)          │
└───────┬─────────────────┬──────────────┬────────────┘
        │                 │              │
        ▼                 ▼              ▼
 ┌─────────────┐  ┌──────────────┐  ┌───────────────┐
 │ Spring Boot │  │  FastAPI ML  │  │  .NET Notif.  │
 │   Core API  │  │   Service    │  │    Service    │
 └──────┬──────┘  └──────────────┘  └───────┬───────┘
        │                                    │
        │──── RabbitMQ (alert events) ───────┘
        │
 ┌──────┴──────┐   ┌──────────────┐   ┌────────────┐
 │  PostgreSQL │   │  PostgreSQL  │   │   Redis    │
 │ (incidents) │   │  (notif. DB) │   │  (cache)   │
 └─────────────┘   └──────────────┘   └────────────┘
```

The Java API is the **system of record** — it owns incident data, heat scoring, and forum logic. When a suburb's alert level escalates, it publishes an event to RabbitMQ. The .NET service consumes that queue and dispatches emails/push notifications, with HTTP webhooks and polling as fallback layers.

The Python service is purely analytical — it runs on-demand ML inference (urgency classification, heat prediction, pattern detection) without owning any persistent data.

---

## Key Features

**Heat Scoring** — Each Cape Town suburb has a live danger score calculated from incident type weights and recency decay. Scores map to GREEN / YELLOW / ORANGE / RED alert levels and drive the Leaflet KDE heatmap overlay.

**ML Pipeline** — Five models run on startup against synthetic SAPS-structured data: an NLP entity extractor (clothing, vehicles, weapons from freetext), a TF-IDF urgency classifier, a Gradient Boosting heat predictor, a K-Means pattern detector, and a Gaussian Naïve Bayes risk forecaster.

**SAPS Data Import** — An async admin endpoint accepts official SAPS quarterly crime stats Excel files (up to 50MB), processes them in the background across all 63 Cape Town police stations, and returns a `jobId` for progress polling.

**Notification System** — Residents subscribe to suburbs of interest. When those suburbs cross alert thresholds, the .NET service dispatches emails via MailKit with deduplication logic to prevent notification floods.

---

## Running Locally

```bash
# Clone and start the full backend stack
git clone <repo-url>
cd infra/docker
docker compose up --build
```

Services will be available at:
- Spring Boot API → `http://localhost:8080` · [Swagger UI](http://localhost:8080/swagger-ui.html)
- FastAPI ML → `http://localhost:8001` · [Swagger UI](http://localhost:8001/docs)
- .NET Notifications → `http://localhost:5001` · [Swagger UI](http://localhost:5001/swagger)

```bash
# Start the frontend
cd apps/community-alerts-web
cp .env.example .env.local
npm install && npm run dev
# → http://localhost:3000
```

---

## Project Structure

```
community-alerts-platform/
├── apps/
│   └── community-alerts-web/     # Next.js 14 frontend
├── services/
│   ├── java-api/                 # Spring Boot core API
│   ├── ml-api-python/            # FastAPI ML microservice
│   └── notification-api-dotnet/  # .NET 8 notification service
├── infra/
│   ├── docker/                   # Docker Compose (dev + prod)
│   ├── k8s/                      # Kubernetes manifests
│   └── terraform/                # Azure IaC
└── docs/
    └── ARCHITECTURE.md           # Design decisions & deep dives
```

---

## CI/CD

Three parallel GitHub Actions jobs run on every push to `main`:

| Job | Steps |
|---|---|
| Java API Tests | `mvn -B test` (Java 21 + Temurin) |
| .NET Build | `dotnet build --configuration Release` |
| Python ML Tests | `pip install` → `pytest app/tests -q` |
