# Architecture & Design Decisions

This document explains the "why" behind the major technical decisions in the Community Alerts Platform — the trade-offs considered, the alternatives rejected, and the reasoning that shaped each choice.

---

## Table of Contents

- [Why Polyglot Microservices?](#why-polyglot-microservices)
- [Service Responsibilities](#service-responsibilities)
- [Why RabbitMQ?](#why-rabbitmq)
- [Why Redis?](#why-redis)
- [Why Two Separate PostgreSQL Databases?](#why-two-separate-postgresql-databases)
- [Heat Score Design](#heat-score-design)
- [ML Model Choices](#ml-model-choices)
- [Frontend Decisions](#frontend-decisions)
- [Notification Resilience (Defence in Depth)](#notification-resilience-defence-in-depth)
- [Infrastructure & Deployment](#infrastructure--deployment)
- [What I Would Change at Scale](#what-i-would-change-at-scale)

---

## Why Polyglot Microservices?

The platform deliberately uses three different backend stacks. This was not a case of throwing frameworks at a problem — each language was chosen for what it genuinely excels at in production systems.

**Java (Spring Boot) for the Core API**

Spring Boot is the de facto standard for enterprise-grade REST APIs in South Africa's financial and public sector — the environments this platform targets. It provides mature solutions for JPA/Hibernate (complex domain queries), Spring Security (JWT auth, CORS, filter chains), and a rich ecosystem for things like scheduled tasks, rate limiting, and AMQP messaging. The strong typing of Java also means domain logic errors surface at compile time rather than at runtime in production.

**Python (FastAPI) for the ML Service**

Python has no serious rival in the ML/data science space. scikit-learn, spaCy, and NumPy are first-class libraries here, and the same Python code runs in Jupyter notebooks for experimentation before being promoted to production endpoints. FastAPI was chosen over Flask because it generates OpenAPI docs automatically, uses async I/O natively, and enforces Pydantic schemas — which makes the contract between the Java API and ML service explicit and validated.

**C# (.NET 8) for Notifications**

.NET 8's background services (the `BackgroundService` base class) are a natural fit for long-running worker processes that consume queues and dispatch emails. MailKit is the best email library in any ecosystem for SMTP/IMAP work. EF Core provides clean migrations for the notifications database. The .NET service also demonstrates the breadth of the stack — showing that I can write production C# alongside Java and Python in the same project.

**The boundary rule:** Each service owns its own database schema and communicates with others only through well-defined APIs or the message queue. No service reaches into another service's database.

---

## Service Responsibilities

```
┌─────────────────────────────────────────────────────────┐
│  Service         │  Owns                               │
├──────────────────┼──────────────────────────────────────┤
│  Spring Boot     │  Incidents, Suburbs, Forum, Users,  │
│                  │  Heat scores, SAPS import, Auth      │
├──────────────────┼──────────────────────────────────────┤
│  FastAPI (ML)    │  No persistent state. Pure inference │
│                  │  on-demand. Models trained at boot.  │
├──────────────────┼──────────────────────────────────────┤
│  .NET Notif.     │  Subscribers, Subscriptions,        │
│                  │  Notification logs, Email dispatch   │
└──────────────────┴──────────────────────────────────────┘
```

This clear ownership means each service can be scaled, deployed, or replaced independently. If the ML service goes down, incident reporting still works. If the notification service goes down, heat scores still update.

---

## Why RabbitMQ?

The original architecture used HTTP webhooks: when the Java API detected a suburb escalation, it made a direct HTTP `POST` to the .NET service. This has a fundamental flaw — **if the .NET service is temporarily unavailable, the alert is lost.** There is no retry, no durability, no guarantee.

RabbitMQ solves this with a persistent, durable message queue:

- The Java API publishes a JSON event to the `suburb-alerts` queue and moves on immediately. Its job is done.
- The .NET service consumes from the queue at its own pace. If it restarts mid-processing, RabbitMQ re-delivers the unacknowledged message.
- Manual acknowledgement (`BasicAck`) means a message is only removed from the queue after the .NET service has successfully processed it and dispatched the notification.
- `BasicNack` with requeue=true means a failed message is not dropped — it goes back to the front of the queue.

This is the **at-least-once delivery** guarantee that HTTP webhooks cannot provide.

**Why not Kafka?** Kafka is the right choice when you need ordered, replayable event logs at very high throughput (millions of events/day). For a community safety app with dozens to hundreds of suburb escalation events per day, RabbitMQ's simpler operational model is the right fit. Kafka also requires Zookeeper (or KRaft) and a more complex consumer group setup — unnecessary overhead for this scale.

**Graceful degradation in local dev:** RabbitMQ is gated behind `spring.rabbitmq.enabled=true` (only set in the Docker profile). In local development without Docker, `SuburbAlertPublisher` silently no-ops — the app starts cleanly without a RabbitMQ connection. This was an important design choice: a developer working on core API features should not need to run a full message broker just to test incident creation.

---

## Why Redis?

The suburb list — all 63 Cape Town police stations with their heat scores — is fetched on every map load. Without caching, this hits the database on every request from every user simultaneously, and the heat score calculation involves joining incidents within a time window. Under load, this becomes expensive.

Redis provides a **5-minute TTL cache** for the suburb heat score list. This means:

- Database load is dramatically reduced during peak usage periods.
- The map loads from memory in sub-millisecond time.
- A 5-minute staleness window is acceptable for community safety data — heat scores are not a live feed.

The cache is automatically invalidated (or simply expires) when heat scores are recalculated after a new incident. Cache keys are versioned (`v2::suburbs::`) to prevent stale data being served after schema changes or serializer updates.

**Like RabbitMQ, Redis is also gated** behind `spring.data.redis.enabled=true`. When absent, Spring Boot automatically falls back to its built-in `ConcurrentMapCacheManager` — an in-memory cache that works fine for single-instance local development.

---

## Why Two Separate PostgreSQL Databases?

Running a dedicated PostgreSQL instance per service (not just a separate schema on the same instance) enforces the microservices boundary at the infrastructure level:

- **No accidental cross-service JOINs.** If both services shared a database server, a developer might be tempted to write a JOIN across `communityalertsdb.suburbs` and `notifications.subscriptions`. This couples the services at the data layer — exactly what microservices architecture is trying to prevent.
- **Independent scaling.** The notifications database is write-heavy during alert bursts (many log entries). The incidents database is read-heavy (constant map queries). Separate instances can be tuned, backed up, and scaled independently.
- **Separate connection pools.** A slow query in the notifications service cannot starve the connection pool of the core API.

In Kubernetes (see `infra/k8s/`), each PostgreSQL instance has its own `PersistentVolumeClaim`, `Deployment`, and `Service`. They are fully independent.

---

## Heat Score Design

The heat score system is split across two services deliberately.

**Deterministic calculation (Java API)**

Every time an incident is reported in a suburb, `HeatScoreServiceImpl` recalculates the suburb's score from scratch using a simple weighted sum with recency decay:

- Incidents within **7 days**: full weight applied
- Incidents **7–30 days** ago: half weight
- Incidents older than **30 days**: excluded entirely

Each incident type carries a weight: CRIME=5, FIRE=4, SUSPICIOUS=3, ACCIDENT=2, POWER_OUTAGE/INFO=1.

This deterministic score is the **source of truth**. It is what drives the alert level thresholds, the map heatmap colours, and the RabbitMQ escalation events.

**Predictive layer (Python ML service)**

The `predict-heat` endpoint adds a forward-looking dimension — it takes the current score, recent incident counts by type, and temporal features (hour of day, day of week) and returns a forecast of where the score will be in 24 hours. This uses a Gradient Boosting Regressor trained on synthetic time-series data that reflects Cape Town's crime patterns.

The predictive score is **displayed alongside** the deterministic score in the UI — it never overwrites it. This separation means the system is never in a state where a misbehaving ML model corrupts the canonical heat data.

**Alert levels:**

| Score | Level | Meaning |
|---|---|---|
| < 12 | GREEN | Normal activity |
| 12–19 | YELLOW | Elevated — residents should stay aware |
| 20–29 | ORANGE | High — notification dispatch triggered |
| ≥ 30 | RED | Critical — full alert blast |

---

## ML Model Choices

All five models are trained on startup against synthetic data. In a production deployment, they would be retrained nightly against real accumulated incident data via a scheduled job.

**Entity Extractor — rule-based NLP (spaCy)**

Urgency and pattern detection are probabilistic. But entity extraction (finding a suspect description, vehicle colour, number plate in freetext) benefits from explicit rules that a detective would recognise. spaCy's `EntityRuler` lets you define these patterns precisely — "silver Toyota", "blue hoodie", "CA 123 456" — without the false positive risk of a general-purpose NER model that might hallucinate entities.

**Urgency Classifier — TF-IDF + Logistic Regression**

A transformer model (BERT, etc.) would be overkill. Incident descriptions are short, domain-specific, and the vocabulary is relatively constrained. TF-IDF + Logistic Regression trains in milliseconds, runs inference in microseconds, and produces well-calibrated confidence scores. It is also fully explainable — you can see which terms drove the classification — which matters for a safety system.

**Heat Predictor — Gradient Boosting Regressor**

GBR handles the non-linear relationship between incident types, time features, and heat scores better than linear regression, without the complexity of a neural network. It also deals well with the relatively small feature set (a dozen input dimensions) and trains quickly.

**Pattern Detector — K-Means Clustering**

When three or more incidents share similar location, incident type, and time-of-day signature, K-Means can surface potential serial crime patterns that a human analyst might miss across a noisy feed. The silhouette score is returned alongside clusters so the frontend can communicate how confident the pattern detection is.

**Risk Forecaster — Gaussian Naïve Bayes + frequency analysis**

For predicting peak risk hours and days, the historical frequency distributions (how many crimes happen at 2am on Fridays in Mitchells Plain?) work well with Gaussian NB. The "recommendations" output (e.g. "Avoid suburb after dark on weekends") is generated from the peak hour/day outputs.

---

## Frontend Decisions

**Next.js 14 App Router**

The App Router's server components reduce the JavaScript bundle sent to the browser. Pages like the suburb detail view can pre-render the static suburb metadata at request time while streaming the dynamic incident data. This is important for the map experience on low-bandwidth connections.

**Zustand over Redux**

Redux is well-suited to very large teams where action/reducer patterns enforce consistency. For a project of this scope, Zustand's minimal API (a single `create` call) removes significant boilerplate without sacrificing the predictability of a centralised store.

**TanStack Query**

All API calls go through TanStack Query. This gives automatic background refetching, stale-while-revalidate behaviour, and cache invalidation — meaning the incidents feed stays fresh without polling intervals hardcoded throughout the component tree.

**Leaflet.js for the map**

Google Maps and Mapbox both require API keys and have usage costs. Leaflet is open source, uses free OpenStreetMap tiles, and has a rich plugin ecosystem. The KDE heatmap overlay uses Leaflet.heat. For a community safety application that should be deployable without third-party billing accounts, this was the right call.

**Fallback data**

`src/lib/data/fallback.ts` contains a snapshot of Cape Town suburb data. If the backend stack is unavailable (common during portfolio reviews on free-tier hosting), the UI still renders a meaningful map rather than a blank screen with error messages.

---

## Notification Resilience (Defence in Depth)

The notification delivery path has three independent layers, each acting as a fallback for the one above:

1. **RabbitMQ consumer (`RabbitMqConsumerWorker`)** — Primary path. Java publishes to queue, .NET consumes. Guaranteed delivery with acknowledgements.
2. **HTTP Webhook (`WebhookController`)** — The Java API can also make a direct HTTP POST to the .NET service for immediate escalation events, bypassing the queue. Acts as a low-latency complement to the queue for real-time scenarios.
3. **Suburb Polling (`SuburbPollingWorker`)** — A background worker that polls the Java API every few minutes for high-alert suburbs. Entirely independent of RabbitMQ. If both the queue and webhook fail, polling ensures that subscribers eventually receive their notifications.

This layered approach means that a single component failure does not result in missed alerts. Community safety notifications are high-stakes — the cost of a false negative (a resident not being warned) is higher than the cost of a duplicate (which deduplication logic handles anyway).

**Deduplication** is handled in `NotificationService` — if a subscriber has already been notified about a suburb within a configurable time window, the notification is suppressed.

---

## Infrastructure & Deployment

**Docker Compose (dev)**

`infra/docker/docker-compose.yml` spins up all six backing services (Java, Python, .NET, PostgreSQL ×2, Redis, RabbitMQ) with a single command. Health checks on each database ensure the Java API does not attempt to connect before PostgreSQL is ready. The `community-net` Docker bridge network means services resolve each other by container name (`backend-java`, `backend-csharp`, etc.) without exposing ports to the host unnecessarily.

**Kubernetes (production-ready manifests)**

`infra/k8s/` contains a full set of Kubernetes manifests:
- Separate `Deployment` and `Service` for each backend service
- Dedicated `PersistentVolumeClaim` for each PostgreSQL instance
- `ConfigMap` for non-secret environment configuration
- `Secrets` manifest (values should be supplied by a secrets manager in real deployment)
- `Ingress` for external routing
- `kustomization.yaml` to manage the full manifest set

This means the platform can move from Docker Compose to a managed Kubernetes cluster (AKS on Azure, or GKE) without rewriting infrastructure.

**Terraform (Azure)**

`infra/terraform/` provisions the Azure infrastructure — Container Registry, AKS cluster, and related resources — as code. This makes the deployment reproducible and version-controlled alongside the application code.

---

## What I Would Change at Scale

A few honest trade-offs made for portfolio scope that would need revisiting in a real production system:

**ML models trained on synthetic data** — In production, the models would train on real SAPS historical incident data. The current synthetic data reproduces realistic Cape Town patterns (hotspot suburbs, peak crime hours) but is not a substitute for real incident history.

**JWT secrets in config files** — For the portfolio, JWT signing secrets are in `application.yml`. In production, these would be in Azure Key Vault (or equivalent), referenced via the Terraform-provisioned secret store.

**Single Redis instance** — The current Redis setup has no replication. For production, a Redis Sentinel or Cluster configuration would be appropriate to avoid the cache being a single point of failure.

**No authentication on ML endpoints** — The FastAPI ML service is currently open. In production, it would sit behind the Java API's Spring Security layer and would not be exposed directly to the frontend or public internet.

**Email is in Log mode by default** — `Email__Mode=Log` means no emails are actually sent during Docker Compose startup. Setting this to `Send` with real SMTP credentials (SMTP2Go, SendGrid) activates the full email pipeline.
